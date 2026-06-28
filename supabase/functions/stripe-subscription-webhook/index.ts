import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";

const CORSHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  items: { data: Array<{ price: { id: string } }> };
  metadata?: Record<string, string>;
}

interface StripeEvent {
  id: string;
  type: string;
  data: {
    object: StripeSubscription;
  };
}

const PRICE_TO_PLAN: Record<string, string> = {};
const teamPriceId = Deno.env.get("STRIPE_PRICE_ID_TEAM");
const businessPriceId = Deno.env.get("STRIPE_PRICE_ID_BUSINESS");
const aiPriceId = Deno.env.get("STRIPE_PRICE_ID_AI");
if (teamPriceId) PRICE_TO_PLAN[teamPriceId] = "team";
if (businessPriceId) PRICE_TO_PLAN[businessPriceId] = "business";
if (aiPriceId) PRICE_TO_PLAN[aiPriceId] = "ai";

const CANCELLED_STATUSES = ["canceled", "unpaid", "incomplete_expired"];
const ACTIVE_STATUSES = ["active", "trialing"];

// Reject signatures older than this to mitigate replay attacks
const SIGNATURE_TOLERANCE_SECONDS = 300;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifyStripeSignature(payload: string, signatureHeader: string, secret: string): Promise<boolean> {
  const parts = signatureHeader.split(",").reduce((acc, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const timestampSeconds = parseInt(timestamp, 10);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${payload}`));
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(computedSignature, signature);
}

function resolvePlanFromSubscription(subscription: StripeSubscription, currentPlan: string): string {
  if (CANCELLED_STATUSES.includes(subscription.status)) {
    return "solo";
  }

  if (ACTIVE_STATUSES.includes(subscription.status)) {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    return (priceId && PRICE_TO_PLAN[priceId]) || "solo";
  }

  // Transitional states (past_due, incomplete, etc.) - keep the current plan
  return currentPlan;
}

const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(supabaseUrl, supabaseKey);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORSHeaders });
  }

  const webhookSecret = Deno.env.get("STRIPE_SUBSCRIPTION_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  if (!signature || !webhookSecret) {
    console.error("Missing webhook secret or signature");
    return new Response(null, { status: 400, headers: CORSHeaders });
  }

  const isValid = await verifyStripeSignature(body, signature, webhookSecret);
  if (!isValid) {
    console.error("Invalid Stripe webhook signature");
    return new Response(null, { status: 400, headers: CORSHeaders });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(body);
  } catch (err) {
    console.error("Failed to parse webhook:", err);
    return new Response(null, { status: 400, headers: CORSHeaders });
  }

  console.log("Stripe subscription webhook event:", event.type);

  const supabase = createSupabaseClient();

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        // Resolve the OWNING company - never a "limit(1)" guess. Prefer the
        // company_id stamped in subscription metadata at checkout, then fall
        // back to matching the Stripe customer id.
        const metaCompanyId = subscription.metadata?.company_id;
        let lookup = supabase
          .from("company_settings")
          .select("id, company_id, plan, stripe_customer_id");
        lookup = metaCompanyId
          ? lookup.eq("company_id", metaCompanyId)
          : lookup.eq("stripe_customer_id", subscription.customer);

        const { data: companySettings, error: fetchError } = await lookup.maybeSingle();

        if (fetchError || !companySettings) {
          console.error("No company matched subscription webhook (company_id/customer):", fetchError);
          break;
        }

        if (companySettings.stripe_customer_id && companySettings.stripe_customer_id !== subscription.customer) {
          console.error("Stripe customer mismatch on subscription webhook - ignoring event");
          break;
        }

        const isCancelled = event.type === "customer.subscription.deleted";
        const plan = isCancelled ? "solo" : resolvePlanFromSubscription(subscription, companySettings.plan);

        await supabase
          .from("company_settings")
          .update({
            plan,
            stripe_customer_id: subscription.customer,
            stripe_subscription_id: subscription.id,
            stripe_subscription_status: isCancelled ? "canceled" : subscription.status,
          })
          .eq("id", companySettings.id);

        break;
      }
    }

    return new Response(null, { status: 200, headers: CORSHeaders });
  } catch (error) {
    console.error("Subscription webhook processing error:", error);
    return new Response(null, { status: 200, headers: CORSHeaders });
  }
});
