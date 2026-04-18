import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { student_id } = await req.json();
    if (!student_id) {
      return new Response(JSON.stringify({ error: "student_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to insert the token (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify the student belongs to this agent
    const { data: student, error: studentErr } = await adminClient
      .from("students")
      .select("id, first_name, last_name, agent_id")
      .eq("id", student_id)
      .single();

    if (studentErr || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check authorization: agent owns student, or admin/owner
    const { data: roleData } = await adminClient.rpc("get_user_role", { _user_id: userId });
    const role = roleData as string;

    if (role === "agent" && student.agent_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expire any existing pending tokens for this student
    await adminClient
      .from("consent_signing_tokens")
      .update({ status: "expired" })
      .eq("student_id", student_id)
      .eq("status", "pending");

    // Create new token
    const { data: tokenData, error: tokenError } = await adminClient
      .from("consent_signing_tokens")
      .insert({
        student_id,
        agent_id: student.agent_id,
      })
      .select("token")
      .single();

    if (tokenError) throw tokenError;

    // Build the signing URL using the production domain
    const signingUrl = `https://agents-eduforyou.co.uk/sign-consent/${tokenData.token}`;

    return new Response(JSON.stringify({ 
      token: tokenData.token,
      signing_url: signingUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating consent token:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
