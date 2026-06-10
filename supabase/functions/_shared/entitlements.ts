// Loosely typed so this helper works with both the @1.x and @2.x
// supabase-js clients used across different edge functions.
interface SupabaseLike {
  from: (table: string) => {
    select: (columns: string) => {
      limit: (count: number) => {
        single: () => Promise<{ data: any; error: any }>;
      };
    };
  };
}

// Mirrors src/config/modules.js - keep the module-to-plan mapping in sync
// whenever modules.js changes.
const MODULES_BY_TIER: Record<string, string[]> = {
  solo: ["customers", "routes", "jobs", "invoicing", "gocardless", "dashboard", "pwa"],
  team: [
    "field_worker", "scheduling", "job_assignment", "recurring_invoices", "quotes",
    "customer_portal", "stripe", "csv_import", "notifications", "multi_user",
  ],
  business: [
    "vat_mtd", "xero", "quickbooks", "open_banking", "companies_house",
    "vat_validation", "audit_log", "data_export", "receipt_ocr",
  ],
  ai: [
    "ai_copilot", "cashflow_forecast", "smart_scheduling_ai", "churn_prediction",
    "auto_comms", "expense_ai", "insights_copilot", "anomaly_detection",
    "route_optimisation", "smart_onboarding_ai", "invoice_writer", "fraud_detection",
  ],
};

const PLAN_MODULES: Record<string, string[]> = {
  solo: [...MODULES_BY_TIER.solo],
  team: [...MODULES_BY_TIER.solo, ...MODULES_BY_TIER.team],
  business: [...MODULES_BY_TIER.solo, ...MODULES_BY_TIER.team, ...MODULES_BY_TIER.business],
  ai: [...MODULES_BY_TIER.solo, ...MODULES_BY_TIER.team, ...MODULES_BY_TIER.business, ...MODULES_BY_TIER.ai],
};

export async function getCompanyEntitlements(
  supabase: SupabaseLike
): Promise<{ plan: string; modules: Set<string> }> {
  const { data, error } = await supabase
    .from("company_settings")
    .select("plan, enabled_modules")
    .limit(1)
    .single();

  if (error || !data) {
    // If entitlements can't be loaded, default to full access so this
    // never breaks existing accounts.
    return { plan: "ai", modules: new Set(PLAN_MODULES.ai) };
  }

  const plan = data.plan || "solo";
  const planModules = PLAN_MODULES[plan] || PLAN_MODULES.solo;
  const overrides: string[] = Array.isArray(data.enabled_modules) ? data.enabled_modules : [];

  return { plan, modules: new Set([...planModules, ...overrides]) };
}

// Returns a 403 Response if the company isn't entitled to the given module,
// or null if the request should proceed.
export async function requireModule(
  supabase: SupabaseLike,
  moduleKey: string,
  corsHeaders: Record<string, string>
): Promise<Response | null> {
  const { modules } = await getCompanyEntitlements(supabase);

  if (!modules.has(moduleKey)) {
    return new Response(
      JSON.stringify({ error: "This feature isn't available on your current plan", module: moduleKey }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null;
}
