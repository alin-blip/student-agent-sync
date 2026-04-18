import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check user is admin
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins need delete codes" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { entity_type, entity_id } = await req.json();
    if (!entity_id) {
      return new Response(JSON.stringify({ error: "entity_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate 6-char code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Store the code
    const { error: insertError } = await serviceClient
      .from("delete_confirmation_codes")
      .insert({
        admin_id: user.id,
        entity_type: entity_type || "document",
        entity_id,
        code,
      });

    if (insertError) throw insertError;

    // Get admin profile name
    const { data: adminProfile } = await serviceClient
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    // Get owner(s) to notify
    const { data: owners } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "owner");

    if (owners && owners.length > 0) {
      for (const owner of owners) {
        const { data: ownerProfile } = await serviceClient
          .from("profiles")
          .select("email, full_name")
          .eq("id", owner.user_id)
          .single();

        if (ownerProfile?.email) {
          // Send notification email to owner with the code
          await serviceClient.functions.invoke("send-transactional-email", {
            body: {
              templateName: "admin-delete-code",
              recipientEmail: ownerProfile.email,
              idempotencyKey: `delete-code-${entity_id}-${Date.now()}`,
              templateData: {
                ownerName: ownerProfile.full_name || "Owner",
                adminName: adminProfile?.full_name || "An admin",
                entityType: entity_type || "document",
                code,
              },
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Delete code sent to owner" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
