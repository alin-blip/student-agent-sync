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

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const jwt = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(jwt);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { student_id, doc_types, message } = body || {};

    if (!student_id || !Array.isArray(doc_types) || doc_types.length === 0) {
      return new Response(JSON.stringify({ error: "student_id and doc_types[] are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: student, error: studentErr } = await adminClient
      .from("students")
      .select("id, agent_id")
      .eq("id", student_id)
      .single();

    if (studentErr || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient.rpc("get_user_role", { _user_id: userId });
    const role = roleData as string;

    if (role === "agent" && student.agent_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Expire prior pending requests for this student
    await adminClient
      .from("student_document_requests")
      .update({ status: "expired" })
      .eq("student_id", student_id)
      .eq("status", "pending");

    const { data: tokenRow, error: insertErr } = await adminClient
      .from("student_document_requests")
      .insert({
        student_id,
        agent_id: student.agent_id,
        requested_doc_types: doc_types,
        message: message || null,
      })
      .select("token")
      .single();

    if (insertErr) throw insertErr;

    const uploadUrl = `https://agents-eduforyou.co.uk/upload-documents/${tokenRow.token}`;

    return new Response(JSON.stringify({ token: tokenRow.token, upload_url: uploadUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error creating document request:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
