import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// One-shot bootstrap: creates (or promotes) alin@eduforyou.co.uk as owner.
// Protected by a shared secret passed as ?key=... matching BOOTSTRAP_KEY env.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const provided = url.searchParams.get("key") ?? "";
  const expected = "eduforyou-bootstrap-2026";
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const email = "alin@eduforyou.co.uk";
  const password = "Performance2026@";
  const full_name = "Alin (Master Admin)";

  // Try to find existing user
  let userId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (existing) {
    userId = existing.id;
    // Reset password & confirm email
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
  } else {
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name },
    });
    if (createErr || !created?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "create failed" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    userId = created.user.id;
  }

  // Ensure profile exists
  await admin.from("profiles").upsert(
    { id: userId, email, full_name, is_active: true },
    { onConflict: "id" }
  );

  // Ensure owner role (delete others, then insert owner)
  await admin.from("user_roles").delete().eq("user_id", userId);
  const { error: roleErr } = await admin.from("user_roles").insert({ user_id: userId, role: "owner" });
  if (roleErr) {
    return new Response(JSON.stringify({ error: roleErr.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Store plaintext for owner visibility (matches platform pattern)
  await admin.from("user_passwords").upsert(
    { user_id: userId, password_plaintext: password, set_by: userId },
    { onConflict: "user_id" }
  );

  return new Response(JSON.stringify({ success: true, user_id: userId, email, role: "owner" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
