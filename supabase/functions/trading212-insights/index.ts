import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const CORSHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENVIRONMENTS = {
  demo: "https://demo.trading212.com/api/v0",
  live: "https://live.trading212.com/api/v0",
};

const SYSTEM_PROMPT = `You are a portfolio analysis assistant. You analyse Trading 212 portfolio data and provide actionable insights.

Your analysis should cover:
- Portfolio diversification (sector, geography, asset class)
- Concentration risk (positions that are too large)
- Performance analysis (winners vs losers)
- Dividend yield assessment
- Risk/reward balance
- Suggestions for improvement

Format currency values with the appropriate symbol.
Be specific with numbers and percentages.
Keep insights concise and actionable.
Never recommend specific stocks to buy - only analyse what the user holds.
Always caveat that this is not financial advice.`;

async function fetchT212(baseUrl: string, apiKey: string, endpoint: string) {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: { Authorization: apiKey },
  });
  if (!response.ok) return null;
  return response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORSHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey =
    req.headers.get("apikey") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { apikey: supabaseKey } },
  });

  try {
    const { userId, analysisType } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId is required" }),
        {
          status: 400,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: account } = await supabase
      .from("trading_accounts")
      .select("api_key, environment")
      .eq("user_id", userId)
      .single();

    if (!account) {
      return new Response(
        JSON.stringify({ error: "Trading 212 account not configured" }),
        {
          status: 404,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = ENVIRONMENTS[account.environment as keyof typeof ENVIRONMENTS] || ENVIRONMENTS.demo;

    const [portfolio, accountInfo, instruments, dividends] = await Promise.all([
      fetchT212(baseUrl, account.api_key, "/equity/portfolio"),
      fetchT212(baseUrl, account.api_key, "/equity/account/cash"),
      fetchT212(baseUrl, account.api_key, "/equity/metadata/instruments"),
      fetchT212(baseUrl, account.api_key, "/equity/history/dividends"),
    ]);

    const instrumentMap = new Map();
    if (instruments) {
      for (const inst of instruments) {
        instrumentMap.set(inst.ticker, inst);
      }
    }

    const enrichedPositions = (portfolio || []).map(
      (pos: Record<string, unknown>) => {
        const inst = instrumentMap.get(pos.ticker);
        const currentValue =
          (pos.quantity as number) * (pos.currentPrice as number);
        const investedValue =
          (pos.quantity as number) * (pos.averagePrice as number);
        return {
          ticker: pos.ticker,
          name: inst?.name || pos.ticker,
          type: inst?.type || "UNKNOWN",
          currency: inst?.currencyCode || "GBP",
          quantity: pos.quantity,
          averagePrice: pos.averagePrice,
          currentPrice: pos.currentPrice,
          currentValue,
          investedValue,
          pnl: pos.ppl,
          pnlPercent:
            investedValue > 0
              ? (((pos.ppl as number) / investedValue) * 100).toFixed(2)
              : 0,
        };
      }
    );

    const totalValue = enrichedPositions.reduce(
      (sum: number, p: { currentValue: number }) => sum + p.currentValue,
      0
    );

    const portfolioSummary = {
      totalValue,
      cash: accountInfo,
      positionCount: enrichedPositions.length,
      positions: enrichedPositions.map(
        (p: { ticker: string; name: string; type: string; currentValue: number; pnl: number; pnlPercent: number | string }) => ({
          ...p,
          weight: totalValue > 0 ? ((p.currentValue / totalValue) * 100).toFixed(1) : 0,
        })
      ),
      recentDividends: (dividends?.items || []).slice(0, 20),
    };

    const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!claudeKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        {
          status: 500,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userMessage =
      analysisType === "quick"
        ? `Give me a brief portfolio health check (3-4 key points) for this portfolio:\n\n${JSON.stringify(portfolioSummary)}`
        : `Provide a comprehensive portfolio analysis covering diversification, risk, performance, and recommendations for this portfolio:\n\n${JSON.stringify(portfolioSummary)}`;

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text();
      return new Response(
        JSON.stringify({ error: "AI analysis failed", details: error }),
        {
          status: 500,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const claudeData = await claudeResponse.json();
    const analysis =
      claudeData.content?.find((c: { type: string }) => c.type === "text")
        ?.text || "Unable to generate analysis.";

    await supabase.from("trading_insights").insert({
      user_id: userId,
      analysis_type: analysisType || "full",
      portfolio_snapshot: portfolioSummary,
      analysis,
    });

    return new Response(
      JSON.stringify({
        analysis,
        portfolio: portfolioSummary,
        generatedAt: new Date().toISOString(),
      }),
      {
        headers: { ...CORSHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORSHeaders, "Content-Type": "application/json" },
    });
  }
});
