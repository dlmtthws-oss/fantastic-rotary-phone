// Suggests an expense category + VAT treatment for an expense.
//
// REFERENCE IMPLEMENTATION of the company-scoped edge-function pattern.
// The previous version scoped everything by a `profiles_id`/`userId` model
// that no longer exists in the schema (and required a userId the client
// never sent, so it always 401'd). This version:
//   1. resolves the caller's company from their JWT (resolveCompanyId),
//   2. gates the feature per-company (requireModule(..., companyId)),
//   3. reads only that company's data (.eq('company_id', companyId)),
//   4. tailors the prompt to the company's trade (business_type).
//
// Note: the old "learned rules" path referenced an
// `expense_categorisation_rules` table that does not exist, so it has been
// dropped. Categorisation now uses company history + the model.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireModule, resolveCompanyId } from "../_shared/entitlements.ts";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES: Record<string, string> = {
  fuel: "Petrol, diesel, vehicle fuel",
  equipment: "Tools, machinery, equipment",
  supplies: "Consumables, chemicals, cloths, disposables, uniforms",
  insurance: "Vehicle insurance, public liability, employer liability, equipment insurance",
  other: "Office, phone, professional fees, training, other",
};

// deno-lint-ignore no-explicit-any
type Supa = any;

const tradeLabel = (businessType?: string) =>
  (businessType || "window_cleaning").replace(/_/g, " ");

// Look for a confident category from this company's own past expenses.
async function checkHistoricalMatch(
  supabase: Supa, companyId: string, supplier?: string, description?: string,
) {
  const { data: expenses } = await supabase
    .from("expenses")
    .select("category, supplier, description")
    .eq("company_id", companyId)
    .not("category", "is", null)
    .limit(100);

  if (!expenses || expenses.length < 3) return null;

  const supplierExpenses = (expenses as any[]).filter((e) =>
    supplier && e.supplier?.toLowerCase() === supplier.toLowerCase()
  );
  if (supplierExpenses.length >= 2) {
    const counts: Record<string, number> = {};
    for (const e of supplierExpenses) {
      const cat = e.category?.toLowerCase();
      if (cat) counts[cat] = (counts[cat] || 0) + 1;
    }
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2) {
      return {
        category: top[0],
        vatReclaimable: top[0] !== "insurance",
        confidence: Math.min(0.5 + top[1] * 0.15, 0.9),
        source: "history",
        reasoning: `Based on ${supplierExpenses.length} past expenses for this supplier`,
        suggestedDescription: description,
      };
    }
  }
  return null;
}

async function callClaude(
  businessType?: string, supplier?: string, description?: string,
  amount?: number, vatAmount?: number,
) {
  const fallback = {
    category: "other", vat_reclaimable: false, confidence: 0.3,
    reasoning: "AI unavailable - using default", suggested_description: description,
  };
  const claudeKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!claudeKey) return fallback;

  const prompt = `You are an expense categorisation assistant for a UK ${tradeLabel(businessType)} business.

Categorise this expense:
- Supplier: ${supplier || "Unknown"}
- Description: ${description || "Unknown"}
- Amount: £${amount ?? "0"}
- VAT amount: £${vatAmount ?? "0"}

Available categories:
${Object.entries(CATEGORIES).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

UK VAT reclaim rules: fuel/equipment/supplies reclaimable if business use; insurance NOT reclaimable; other not by default.

Respond only with JSON:
{ "category": string, "vat_reclaimable": boolean, "confidence": number, "reasoning": string, "suggested_description": string }`;

  try {
    const response = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return fallback;
    const data = await response.json();
    return JSON.parse(data.content?.[0]?.text || "{}");
  } catch {
    return { ...fallback, reasoning: "Error categorising expense" };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Who is calling, and which company do they belong to?
  const companyId = await resolveCompanyId(supabase, req);
  if (!companyId) return json({ error: "Not authenticated" }, 401);

  // 2. Is this company entitled to the AI expense feature?
  const entitlementError = await requireModule(supabase, "expense_ai", corsHeaders, companyId);
  if (entitlementError) return entitlementError;

  try {
    const { description, supplier, amount, vatAmount } = await req.json();

    const { data: company } = await supabase
      .from("companies").select("business_type").eq("id", companyId).maybeSingle();

    // 3. Company-scoped history first, then the model.
    let result = await checkHistoricalMatch(supabase, companyId, supplier, description);
    if (!result || result.confidence < 0.85) {
      const ai = await callClaude(company?.business_type, supplier, description, amount, vatAmount);
      result = {
        category: ai.category,
        vatReclaimable: ai.vat_reclaimable,
        confidence: ai.confidence,
        source: "ai",
        reasoning: ai.reasoning,
        suggestedDescription: ai.suggested_description,
      };
    }

    return json(result);
  } catch (error) {
    return json({ error: (error as Error).message }, 500);
  }
});
