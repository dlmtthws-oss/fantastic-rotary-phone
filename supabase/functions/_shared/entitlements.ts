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

// Resolves the company that owns the request, from the caller's JWT.
//
// In a multi-tenant world a service-role function must NOT just grab "the"
// company_settings row - it has to know WHICH company the authenticated
// caller belongs to. Pass the raw Request; this reads the bearer token,
// resolves the user, and returns their company_id (or null if it can't).
export async function resolveCompanyId(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  req: Request,
): Promise<string | null> {
  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return null;
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return null;
    const { data } = await supabase
      .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    return data?.company_id ?? null;
  } catch {
    return null;
  }
}

// Entitlements for a specific company. When companyId is omitted this falls
// back to the legacy single-company lookup (kept so existing callers that
// haven't been migrated still work).
export async function getCompanyEntitlements(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  companyId?: string | null,
): Promise<{ plan: string; modules: Set<string> }> {
  let query = supabase.from("company_settings").select("plan, enabled_modules");
  query = companyId ? query.eq("company_id", companyId) : query.limit(1);
  const { data, error } = await query.maybeSingle();

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
// or null if the request should proceed. Pass `companyId` (from
// resolveCompanyId) to scope the check to the calling company; omitting it
// preserves the legacy single-company behaviour.
export async function requireModule(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  moduleKey: string,
  corsHeaders: Record<string, string>,
  companyId?: string | null,
): Promise<Response | null> {
  const { modules } = await getCompanyEntitlements(supabase, companyId);

  if (!modules.has(moduleKey)) {
    return new Response(
      JSON.stringify({ error: "This feature isn't available on your current plan", module: moduleKey }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return null;
}
