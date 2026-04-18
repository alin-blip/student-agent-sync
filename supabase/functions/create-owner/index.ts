import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- JWT Authentication ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseAuth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const callerId = userData.user.id;

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerRole } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", callerId)
    .single();

  if (!callerRole) {
    return new Response(JSON.stringify({ error: "Forbidden: no role assigned" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const body = await req.json();

  // ── Change Role action (owner only) ──
  if (body.action === "change_role") {
    if (callerRole.role !== "owner") {
      return new Response(JSON.stringify({ error: "Forbidden: only owner can change roles" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, new_role } = body;
    if (!user_id || !["admin", "agent"].includes(new_role)) {
      return new Response(JSON.stringify({ error: "Invalid user_id or new_role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Don't allow changing the owner's own role
    const { data: targetRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user_id)
      .single();

    if (targetRole?.role === "owner") {
      return new Response(JSON.stringify({ error: "Cannot change owner role" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update the role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .update({ role: new_role })
      .eq("user_id", user_id);

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Side effects
    if (new_role === "admin") {
      // Agent → Admin: clear their admin_id (no longer under an admin)
      await supabaseAdmin.from("profiles").update({ admin_id: null }).eq("id", user_id);
    } else if (new_role === "agent") {
      // Admin → Agent: unassign agents that were under this admin
      await supabaseAdmin.from("profiles").update({ admin_id: null }).eq("admin_id", user_id);
      // Also clear their own admin_id
      await supabaseAdmin.from("profiles").update({ admin_id: null }).eq("id", user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Original create user flow ──
  const { email, password, full_name, role = "owner", admin_id, postcode, address } = body;

  const validRoles = ["owner", "admin", "agent"];
  if (!validRoles.includes(role)) {
    return new Response(JSON.stringify({ error: "Invalid role" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (callerRole.role === "agent") {
    return new Response(JSON.stringify({ error: "Forbidden: agents cannot create accounts" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (callerRole.role === "admin" && role !== "agent") {
    return new Response(JSON.stringify({ error: "Forbidden: admins can only create agent accounts" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const effectiveAdminId = callerRole.role === "admin" ? callerId : admin_id;

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (authError) {
    return new Response(JSON.stringify({ error: authError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
    user_id: authData.user.id,
    role,
  });

  if (roleError) {
    return new Response(JSON.stringify({ error: roleError.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const profileUpdate: Record<string, unknown> = {};
  if (effectiveAdminId) profileUpdate.admin_id = effectiveAdminId;
  if (postcode) profileUpdate.postcode = postcode;
  if (address) profileUpdate.address = address;

  // Store plaintext password for admin/owner visibility
  await supabaseAdmin.from("user_passwords").upsert(
    { user_id: authData.user.id, password_plaintext: password, set_by: callerId },
    { onConflict: "user_id" }
  );

  if (Object.keys(profileUpdate).length > 0) {
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update(profileUpdate)
      .eq("id", authData.user.id);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (role === "agent" || role === "admin") {
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", callerId)
      .single();

    try {
      await supabaseAdmin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "welcome-agent",
          recipientEmail: email,
          idempotencyKey: `welcome-agent-${authData.user.id}`,
          templateData: {
            agentName: full_name,
            adminName: callerProfile?.full_name || undefined,
          },
        },
      });
    } catch (e) {
      console.error("Failed to send welcome email:", e);
    }
  }

  return new Response(JSON.stringify({ success: true, user_id: authData.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
