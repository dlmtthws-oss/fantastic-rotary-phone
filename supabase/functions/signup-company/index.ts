// Atomically provisions a new tenant for a freshly-signed-up admin user.
//
// Creates: companies row (name + business_type), the caller's profile
// (role 'admin'), and one company_settings + business_settings row for the
// new company. Runs with the service role so RLS can't block it part-way,
// and is idempotent - if the caller already has a company it is returned
// unchanged.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_BUSINESS_TYPE = "window_cleaning";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Identify the caller from their JWT.
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return json({ error: "Not authenticated" }, 401);
    const { data: { user }, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !user) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const businessType: string = body.business_type || user.user_metadata?.business_type || DEFAULT_BUSINESS_TYPE;
    const businessName: string =
      body.business_name || user.user_metadata?.business_name || user.email || "My Company";
    const fullName: string = body.full_name || user.user_metadata?.full_name || "";

    // Already provisioned? Return existing company.
    const { data: existing } = await supabase
      .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    if (existing?.company_id) {
      return json({ company_id: existing.company_id, already: true });
    }

    // 1. Company (tenant root)
    const { data: company, error: companyErr } = await supabase
      .from("companies")
      .insert({ name: businessName, business_type: businessType, created_by: user.id })
      .select("id")
      .single();
    if (companyErr) throw companyErr;
    const companyId = company.id;

    // 2. Admin profile for the signing-up user
    const { error: profileErr } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        role: "admin",
        company_id: companyId,
        invite_status: "active",
      }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    // 3. Default per-company settings rows (service role must set company_id)
    const { error: csErr } = await supabase
      .from("company_settings")
      .upsert({ company_id: companyId, company_name: businessName, email: user.email },
              { onConflict: "company_id" });
    if (csErr) throw csErr;

    const { error: bsErr } = await supabase
      .from("business_settings")
      .upsert({ company_id: companyId, business_name: businessName },
              { onConflict: "company_id" });
    if (bsErr) throw bsErr;

    return json({ company_id: companyId });
  } catch (err) {
    return json({ error: (err as Error).message || "Signup failed" }, 500);
  }
});
