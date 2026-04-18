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
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "token required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: tokenRow, error } = await adminClient
      .from("student_document_requests")
      .select("*, students(first_name, last_name, title)")
      .eq("token", token)
      .single();

    if (error || !tokenRow) {
      return new Response(JSON.stringify({ status: "error" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenRow.status === "submitted") {
      return new Response(JSON.stringify({ status: "submitted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await adminClient.from("student_document_requests").update({ status: "expired" }).eq("id", tokenRow.id);
      return new Response(JSON.stringify({ status: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenRow.status !== "pending") {
      return new Response(JSON.stringify({ status: tokenRow.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const student = tokenRow.students as any;
    const studentName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;

    const { data: agentProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", tokenRow.agent_id)
      .single();

    return new Response(JSON.stringify({
      status: "valid",
      studentName,
      agentName: agentProfile?.full_name || "EduForYou UK",
      requestedDocTypes: tokenRow.requested_doc_types || [],
      message: tokenRow.message || null,
      expiresAt: tokenRow.expires_at,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("validate-document-token error:", error);
    return new Response(JSON.stringify({ status: "error", error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
