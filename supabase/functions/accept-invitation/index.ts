// Handles a worker/manager accepting an invitation to join an EXISTING
// company. Runs with the service role because the invitee isn't a member of
// the company yet, so RLS would otherwise hide the invitation from them.
//
// Two actions:
//   { action: 'lookup', invitation_id }                       -> invite details
//   { action: 'accept', invitation_id, password, full_name }  -> create account
//
// On accept it creates the auth user, a profile stamped with the inviting
// company's company_id and the invited role, and marks the invitation used.
// No new company is created.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { action, invitation_id, password, full_name } = await req.json();
    if (!invitation_id) return json({ error: "invitation_id required" }, 400);

    const { data: invite } = await supabase
      .from("invitations")
      .select("id, email, role, company_id, status, expires_at, full_name")
      .eq("id", invitation_id)
      .maybeSingle();

    if (!invite || invite.status === "accepted") {
      return json({ error: "Invalid or already-used invitation" }, 404);
    }
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: "This invitation has expired" }, 410);
    }

    const { data: company } = await supabase
      .from("companies").select("name").eq("id", invite.company_id).maybeSingle();

    if (action === "lookup") {
      return json({
        email: invite.email,
        role: invite.role,
        full_name: invite.full_name,
        company_name: company?.name || "the company",
      });
    }

    if (action !== "accept") return json({ error: "Unknown action" }, 400);
    if (!password || password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    // Create the auth user (email pre-confirmed - they came from an invite).
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || invite.full_name || "", role: invite.role },
    });
    if (createErr || !created?.user) {
      return json({ error: createErr?.message || "Could not create account" }, 400);
    }

    // Profile joined to the INVITING company (not a new one).
    const { error: profileErr } = await supabase.from("profiles").upsert({
      id: created.user.id,
      email: invite.email,
      full_name: full_name || invite.full_name || "",
      role: invite.role,
      company_id: invite.company_id,
      invite_status: "active",
    }, { onConflict: "id" });
    if (profileErr) throw profileErr;

    await supabase
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString() })
      .eq("id", invite.id);

    return json({ ok: true, email: invite.email });
  } catch (err) {
    return json({ error: (err as Error).message || "Accept failed" }, 500);
  }
});
