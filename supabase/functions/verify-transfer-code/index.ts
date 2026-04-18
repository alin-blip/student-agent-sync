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

    const { transfer_request_id, code } = await req.json();
    if (!transfer_request_id || !code) {
      return new Response(JSON.stringify({ error: "transfer_request_id and code required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find matching pending request
    const { data: transferReq, error: fetchError } = await serviceClient
      .from("transfer_requests")
      .select("*")
      .eq("id", transfer_request_id)
      .eq("status", "pending")
      .eq("code", code.toUpperCase())
      .single();

    if (fetchError || !transferReq) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired transfer code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the caller is the requester (who received the code from their approver)
    if (transferReq.requested_by !== user.id) {
      return new Response(
        JSON.stringify({ error: "Only the requester can verify the transfer code" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get old enrollment details to copy student_id
    const { data: oldEnrollment } = await serviceClient
      .from("enrollments")
      .select("student_id, status")
      .eq("id", transferReq.enrollment_id)
      .single();

    if (!oldEnrollment) {
      return new Response(
        JSON.stringify({ error: "Original enrollment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute transfer: mark old as "transferred", create new enrollment
    const { error: updateError } = await serviceClient
      .from("enrollments")
      .update({ status: "transferred" })
      .eq("id", transferReq.enrollment_id);

    if (updateError) throw updateError;

    const { error: insertError } = await serviceClient
      .from("enrollments")
      .insert({
        student_id: oldEnrollment.student_id,
        university_id: transferReq.new_university_id,
        campus_id: transferReq.new_campus_id,
        course_id: transferReq.new_course_id,
        intake_id: transferReq.new_intake_id,
        status: "new_application",
      });

    if (insertError) throw insertError;

    // Mark transfer request as approved
    await serviceClient
      .from("transfer_requests")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", transferReq.id);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
