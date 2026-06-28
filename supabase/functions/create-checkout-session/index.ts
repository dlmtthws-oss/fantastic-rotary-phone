// Creates a Stripe Checkout session so a company can subscribe to a paid
// plan (Team / Business / AI) with a free trial. Runs with the service role,
// resolves the caller's company from their JWT, ensures a Stripe customer is
// linked to that company, and stamps company_id into the subscription
// metadata so the webhook can attribute events to the right tenant.
//
// Stripe is called over its REST API (form-encoded) - no SDK needed.
// Required env: STRIPE_SECRET_KEY, STRIPE_PRICE_ID_TEAM/BUSINESS/AI, APP_URL.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRIAL_DAYS = 14;
const PRICE_ENV: Record<string, string> = {
  team: "STRIPE_PRICE_ID_TEAM",
  business: "STRIPE_PRICE_ID_BUSINESS",
  ai: "STRIPE_PRICE_ID_AI",
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

async function stripe(path: string, key: string, params: Record<string, string>) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `Stripe ${path} failed`);
  return json;
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

    const { plan, seats } = await req.json();
    const priceEnv = PRICE_ENV[plan];
    if (!priceEnv) return json({ error: "Unknown plan" }, 400);
    const priceId = Deno.env.get(priceEnv);
    if (!priceId) return json({ error: `Price not configured for ${plan}` }, 503);

    const { data: settings } = await supabase
      .from("company_settings")
      .select("id, company_name, email, stripe_customer_id")
      .eq("company_id", companyId)
      .maybeSingle();

    // Ensure a Stripe customer exists for this company.
    let customerId = settings?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe("customers", stripeKey, {
        name: settings?.company_name || "ClearRoute customer",
        ...(settings?.email ? { email: settings.email } : {}),
        "metadata[company_id]": companyId,
      });
      customerId = customer.id;
      await supabase.from("company_settings")
        .update({ stripe_customer_id: customerId })
        .eq("company_id", companyId);
    }

    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "";
    const qty = String(Math.max(1, Number(seats) || 1));

    const session = await stripe("checkout/sessions", stripeKey, {
      mode: "subscription",
      customer: customerId,
      client_reference_id: companyId,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": qty,
      "subscription_data[trial_period_days]": String(TRIAL_DAYS),
      "subscription_data[metadata][company_id]": companyId,
      allow_promotion_codes: "true",
      success_url: `${appUrl}/settings/plan?checkout=success`,
      cancel_url: `${appUrl}/settings/plan?checkout=cancelled`,
    });

    return json({ url: session.url });
  } catch (err) {
    return json({ error: (err as Error).message || "Checkout failed" }, 500);
  }
});
