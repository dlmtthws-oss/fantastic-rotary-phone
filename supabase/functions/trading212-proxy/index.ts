import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@1.35.7";

const CORSHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ENVIRONMENTS = {
  demo: "https://demo.trading212.com/api/v0",
  live: "https://live.trading212.com/api/v0",
};

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
    const { endpoint, method, body, userId } = await req.json();

    if (!endpoint || !userId) {
      return new Response(
        JSON.stringify({ error: "endpoint and userId are required" }),
        {
          status: 400,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: account, error: accountError } = await supabase
      .from("trading_accounts")
      .select("api_key, environment")
      .eq("user_id", userId)
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({
          error: "Trading 212 account not configured. Add your API key in Trading Settings.",
        }),
        {
          status: 404,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const baseUrl = ENVIRONMENTS[account.environment as keyof typeof ENVIRONMENTS] || ENVIRONMENTS.demo;
    const url = `${baseUrl}${endpoint}`;

    const fetchOptions: RequestInit = {
      method: method || "GET",
      headers: {
        Authorization: account.api_key,
        "Content-Type": "application/json",
      },
    };

    if (body && method !== "GET") {
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `Trading 212 API error: ${response.status}`,
          details: errorText,
        }),
        {
          status: response.status,
          headers: { ...CORSHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      headers: { ...CORSHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORSHeaders, "Content-Type": "application/json" },
    });
  }
});
