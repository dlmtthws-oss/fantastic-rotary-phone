// AI credential resolution and usage metering.
//
// Subscribers either bring their own Anthropic API key (stored in
// company_settings.anthropic_api_key, unmetered) or use the platform key,
// in which case requests count against a monthly allowance. Usage is
// recorded in ai_usage_log either way so the Settings page can show it.

// Loosely typed so this works with both the @1.x and @2.x supabase-js
// clients used across different edge functions.
type SupabaseLike = any;

// Monthly platform-key request allowance by plan. Companies can be given a
// custom allowance via company_settings.ai_monthly_request_limit.
const PLAN_AI_REQUEST_LIMITS: Record<string, number> = {
  ai: 500,
};

export interface AiCredentials {
  key: string;
  source: "own" | "platform";
}

// Resolves which Anthropic API key a request should use.
//
// Returns:
// - AiCredentials when a key is available (own key, or platform key within
//   the monthly allowance)
// - a 429 Response when the platform allowance is exhausted and no own key
//   is configured
// - null when no key is configured anywhere, so callers can keep their
//   existing "AI unavailable" fallback behaviour
export async function getAiCredentials(
  supabase: SupabaseLike,
  corsHeaders: Record<string, string>
): Promise<AiCredentials | Response | null> {
  let settings: any = null;
  try {
    const { data } = await supabase
      .from("company_settings")
      .select("plan, anthropic_api_key, ai_monthly_request_limit")
      .limit(1)
      .single();
    settings = data;
  } catch (_err) {
    settings = null;
  }

  if (settings?.anthropic_api_key) {
    return { key: settings.anthropic_api_key, source: "own" };
  }

  const platformKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!platformKey) return null;

  const limit =
    settings?.ai_monthly_request_limit ??
    PLAN_AI_REQUEST_LIMITS[settings?.plan] ??
    0;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  let used = 0;
  try {
    const { count } = await supabase
      .from("ai_usage_log")
      .select("id", { count: "exact", head: true })
      .eq("key_source", "platform")
      .gte("created_at", monthStart.toISOString());
    used = count ?? 0;
  } catch (_err) {
    // If usage can't be read, fail open rather than blocking the feature.
    used = 0;
  }

  if (used >= limit) {
    return new Response(
      JSON.stringify({
        error:
          "Your included monthly AI allowance has been used. Add your own Anthropic API key in Settings → Plan & Modules to continue without limits.",
        code: "ai_allowance_exhausted",
        used,
        limit,
      }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return { key: platformKey, source: "platform" };
}

// Records one AI request in ai_usage_log. Best-effort: metering must never
// break the feature, so errors are swallowed.
export async function recordAiUsage(
  supabase: SupabaseLike,
  functionName: string,
  model: string | null,
  source: "own" | "platform",
  usage?: { input_tokens?: number; output_tokens?: number }
): Promise<void> {
  try {
    await supabase.from("ai_usage_log").insert({
      function_name: functionName,
      model,
      key_source: source,
      input_tokens: usage?.input_tokens ?? null,
      output_tokens: usage?.output_tokens ?? null,
    });
  } catch (_err) {
    // ignore
  }
}
