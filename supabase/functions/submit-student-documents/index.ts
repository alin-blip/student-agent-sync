import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface UploadFile {
  name: string;
  type: string;
  docType: string;
  base64: string;
}

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB per file
const MAX_FILES = 20;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token, files } = await req.json() as { token: string; files: UploadFile[] };

    if (!token || !Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: "token and files[] are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (files.length > MAX_FILES) {
      return new Response(JSON.stringify({ error: `Maximum ${MAX_FILES} files per upload` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate token
    const { data: tokenRow, error: tokenErr } = await adminClient
      .from("student_document_requests")
      .select("*")
      .eq("token", token)
      .eq("status", "pending")
      .single();

    if (tokenErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid or already used link" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      await adminClient.from("student_document_requests").update({ status: "expired" }).eq("id", tokenRow.id);
      return new Response(JSON.stringify({ error: "This upload link has expired" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentId = tokenRow.student_id as string;
    const agentId = tokenRow.agent_id as string;
    const uploaded: { docType: string; fileName: string; path: string }[] = [];

    for (const f of files) {
      if (!f.base64 || !f.name || !f.docType) continue;

      // Decode base64 (strip optional data URL prefix)
      const cleanB64 = f.base64.includes(",") ? f.base64.split(",")[1] : f.base64;
      const binaryString = atob(cleanB64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      if (bytes.length > MAX_FILE_BYTES) {
        return new Response(JSON.stringify({ error: `File "${f.name}" exceeds 25MB limit` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = safeName.includes(".") ? safeName.split(".").pop() : "bin";
      const docTypeSafe = f.docType.replace(/[^a-zA-Z0-9]/g, "_");
      const storagePath = `${studentId}/${docTypeSafe}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadErr } = await adminClient.storage
        .from("student-documents")
        .upload(storagePath, bytes, { contentType: f.type || "application/octet-stream" });

      if (uploadErr) {
        console.error("Upload error:", uploadErr);
        return new Response(JSON.stringify({ error: `Upload failed for ${f.name}: ${uploadErr.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark previous current versions as not current for same doc_type
      const { data: existing } = await adminClient
        .from("student_documents")
        .select("id, version")
        .eq("student_id", studentId)
        .eq("doc_type", f.docType)
        .eq("is_current", true);

      const nextVersion = existing && existing.length > 0
        ? Math.max(...existing.map((d: any) => d.version || 1)) + 1
        : 1;

      if (existing && existing.length > 0) {
        await adminClient
          .from("student_documents")
          .update({ is_current: false })
          .eq("student_id", studentId)
          .eq("doc_type", f.docType)
          .eq("is_current", true);
      }

      const { error: docErr } = await adminClient.from("student_documents").insert({
        student_id: studentId,
        agent_id: agentId,
        doc_type: f.docType,
        file_name: safeName,
        file_path: storagePath,
        file_size: bytes.length,
        uploaded_by: agentId,
        version: nextVersion,
        is_current: true,
      });

      if (docErr) {
        console.error("DB insert error:", docErr);
        return new Response(JSON.stringify({ error: `Could not save record for ${f.name}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      uploaded.push({ docType: f.docType, fileName: safeName, path: storagePath });
    }

    // Mark token submitted
    await adminClient
      .from("student_document_requests")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", tokenRow.id);

    // Trigger Drive sync (best-effort, non-blocking)
    try {
      await fetch(`${supabaseUrl}/functions/v1/sync-to-drive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ action: "document_uploaded", student_id: studentId }),
      });
    } catch (e) {
      console.error("Drive sync skipped:", e);
    }

    return new Response(JSON.stringify({ success: true, uploaded }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("submit-student-documents error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
