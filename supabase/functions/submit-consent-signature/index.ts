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
    const { token, signature, signatureRgb, signatureWidth, signatureHeight, marketingConsent } = await req.json();

    if (!token || !signature) {
      return new Response(JSON.stringify({ error: "token and signature are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("consent_signing_tokens")
      .select("*, students(id, first_name, last_name, title, date_of_birth, nationality, full_address, agent_id)")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(tokenRow.expires_at) < new Date()) {
      await adminClient.from("consent_signing_tokens").update({ status: "expired" }).eq("id", tokenRow.id);
      return new Response(JSON.stringify({ error: "This signing link has expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const student = tokenRow.students as any;
    const studentName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;

    // Get agent name
    const { data: agentProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("id", tokenRow.agent_id)
      .single();

    const agentName = agentProfile?.full_name || "EduForYou UK";
    const consentDate = new Date().toLocaleDateString("en-GB");

    // Get latest enrollment for context
    const { data: enrollments } = await adminClient
      .from("enrollments")
      .select("*, universities(name), courses(name)")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(1);

    const enrollment = enrollments?.[0] as any;

    // Generate PDF via the existing generate-consent-pdf function
    const pdfBody = {
      studentName,
      dateOfBirth: student.date_of_birth || null,
      nationality: student.nationality || null,
      address: student.full_address || null,
      universityName: enrollment?.universities?.name || "N/A",
      courseName: enrollment?.courses?.name || "N/A",
      agentName,
      signature,
      signatureImage: null,
      signatureRgb: signatureRgb || null,
      signatureWidth: signatureWidth || null,
      signatureHeight: signatureHeight || null,
      consentDate,
      marketingConsent: marketingConsent || null,
    };

    // Call generate-consent-pdf internally
    const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-consent-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify(pdfBody),
    });

    if (!pdfResponse.ok) {
      const errText = await pdfResponse.text();
      throw new Error(`PDF generation failed: ${errText}`);
    }

    const pdfResult = await pdfResponse.json();
    const base64 = pdfResult.pdf_base64;

    // Convert base64 to Uint8Array
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Upload to storage
    const storagePath = `${student.id}/Consent_Form_Signed_${Date.now()}.pdf`;
    const { error: uploadError } = await adminClient.storage
      .from("student-documents")
      .upload(storagePath, bytes, { contentType: "application/pdf" });

    if (uploadError) throw uploadError;

    // Insert student_documents record
    const { error: docError } = await adminClient.from("student_documents").insert({
      student_id: student.id,
      agent_id: tokenRow.agent_id,
      doc_type: "Consent Form",
      file_name: `EduForYou_Consent_Form_Signed_${student.first_name}_${student.last_name}.pdf`,
      file_path: storagePath,
      file_size: bytes.length,
      uploaded_by: tokenRow.agent_id,
    });

    if (docError) throw docError;

    // Mark token as signed
    await adminClient.from("consent_signing_tokens").update({
      status: "signed",
      signed_at: new Date().toISOString(),
    }).eq("id", tokenRow.id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error submitting consent signature:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
