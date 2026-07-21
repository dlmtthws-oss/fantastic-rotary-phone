// Creates a Stripe Billing Portal session so a company admin can manage,
// upgrade/downgrade or cancel their subscription and update card details.
// Resolves the caller's company from their JWT and uses that company's
// Stripe customer id. Required env: STRIPE_SECRET_KEY, APP_URL.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// deno-lint-ignore no-explicit-any
type Supa = any;

async function resolveCompanyId(supabase: Supa, req: Request): Promise<string | null> {
  try {
    const jwt = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!jwt) return null;
    const { data: { user } } = await supabase.auth.getUser(jwt);
    if (!user) return null;
    const { data } = await supabase.from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    return data?.company_id ?? null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json({ error: "Billing is not configured" }, 503);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const companyId = await resolveCompanyId(supabase, req);
    if (!companyId) return json({ error: "Not authenticated" }, 401);

    const { data: settings } = await supabase
      .from("company_settings")
      .select("stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    if (!settings?.stripe_customer_id) {
      return json({ error: "No active subscription to manage" }, 400);
    }

    // Prefer the browser's own origin (so preview/QA deployments return to
    // themselves instead of bouncing to production); APP_URL is only a
    // fallback for calls that don't carry an Origin header.
    const appUrl = req.headers.get("origin") || Deno.env.get("APP_URL") || "";
    const res = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        customer: settings.stripe_customer_id,
        return_url: `${appUrl}/settings/plan`,
      }),
    });
    const portal = await res.json();
    if (!res.ok) throw new Error(portal.error?.message || "Portal session failed");

    return json({ url: portal.url });
  } catch (err) {
    return json({ error: (err as Error).message || "Portal failed" }, 500);
  }
});
