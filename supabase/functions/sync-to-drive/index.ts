import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Google Drive API helpers
async function getAccessToken(serviceAccount: any): Promise<string> {
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/drive",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );

  const unsignedToken = `${header}.${claimSet}`;

  // Import the private key and sign the JWT
  if (!serviceAccount.private_key) {
    throw new Error("Service account JSON missing private_key field");
  }
  const pemContents = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${claimSet.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}.${signatureB64}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }
  return tokenData.access_token;
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<string> {
  // Search for existing folder
  const q = `name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  const createData = await createRes.json();
  if (!createData.id) {
    throw new Error(`Failed to create folder "${name}": ${JSON.stringify(createData)}`);
  }
  return createData.id;
}

async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  fileContent: Uint8Array,
  mimeType: string,
  parentId: string
): Promise<string> {
  // Delete existing file with same name first
  const q = `name='${fileName.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();
  if (searchData.files) {
    for (const f of searchData.files) {
      await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    }
  }

  // Upload new file using multipart upload
  const metadata = JSON.stringify({ name: fileName, parents: [parentId] });
  const boundary = "----EdgeFunctionBoundary";
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n`;
  const footer = `\r\n--${boundary}--`;

  const base64Content = btoa(String.fromCharCode(...fileContent));
  const fullBody = body + base64Content + footer;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
    }
  );
  const uploadData = await uploadRes.json();
  if (!uploadData.id) {
    throw new Error(`Failed to upload file "${fileName}": ${JSON.stringify(uploadData)}`);
  }
  return uploadData.id;
}

// Simple PDF generation for student summary
function buildStudentSummaryPdf(student: any, enrollments: any[], notes: any[], documents: any[]): Uint8Array {
  const lines: { x: number; y: number; size: number; bold: boolean; text: string }[] = [];
  let y = 780;
  const lineHeight = 16;
  const smallLineHeight = 14;

  function addLine(text: string, size = 10, bold = false, indent = 50) {
    lines.push({ x: indent, y, size, bold, text });
    y -= size === 14 ? lineHeight + 4 : size === 12 ? lineHeight + 2 : smallLineHeight;
  }

  function addSection(title: string) {
    y -= 6;
    addLine(title, 12, true);
    y -= 2;
  }

  // Header
  addLine("EDUFORYOU UK - STUDENT PROFILE BACKUP", 14, true);
  addLine(`Generated: ${new Date().toLocaleDateString("en-GB")} ${new Date().toLocaleTimeString("en-GB")}`, 8, false);
  y -= 10;

  // Personal Details
  addSection("PERSONAL DETAILS");
  const fullName = `${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`;
  addLine(`Name: ${fullName}`);
  if (student.email) addLine(`Email: ${student.email}`);
  if (student.phone) addLine(`Phone: ${student.phone}`);
  if (student.date_of_birth) addLine(`Date of Birth: ${student.date_of_birth}`);
  if (student.gender) addLine(`Gender: ${student.gender}`);
  if (student.nationality) addLine(`Nationality: ${student.nationality}`);
  if (student.immigration_status) addLine(`Immigration Status: ${student.immigration_status}`);
  if (student.full_address) addLine(`Address: ${student.full_address}`);
  if (student.ni_number) addLine(`NI Number: ${student.ni_number}`);
  if (student.share_code) addLine(`Share Code: ${student.share_code}`);
  if (student.crn) addLine(`CRN: ${student.crn}`);
  if (student.uk_entry_date) addLine(`UK Entry Date: ${student.uk_entry_date}`);
  if (student.qualifications) addLine(`Qualifications: ${student.qualifications}`);
  if (student.study_pattern) addLine(`Study Pattern: ${student.study_pattern}`);
  if (student.previous_funding_years != null) addLine(`Previous Funding Years: ${student.previous_funding_years}`);

  // Next of Kin
  if (student.next_of_kin_name) {
    addSection("NEXT OF KIN");
    addLine(`Name: ${student.next_of_kin_name}`);
    if (student.next_of_kin_phone) addLine(`Phone: ${student.next_of_kin_phone}`);
    if (student.next_of_kin_relationship) addLine(`Relationship: ${student.next_of_kin_relationship}`);
  }

  // Enrollments
  if (enrollments.length > 0) {
    addSection("ENROLLMENTS");
    for (const enr of enrollments) {
      const uniName = enr.universities?.name || "N/A";
      const courseName = enr.courses?.name || "N/A";
      addLine(`University: ${uniName} | Course: ${courseName}`);
      addLine(`Status: ${enr.status} | Funding: ${enr.funding_status || "N/A"} | Type: ${enr.funding_type || "N/A"}`, 9);
      if (enr.funding_reference) addLine(`Funding Ref: ${enr.funding_reference}`, 9);
      if (enr.notes) addLine(`Notes: ${enr.notes}`, 9);
      y -= 4;
    }
  }

  // Notes
  if (notes.length > 0) {
    addSection("NOTES");
    for (const note of notes.slice(0, 20)) {
      const date = new Date(note.created_at).toLocaleDateString("en-GB");
      const prefix = note.is_urgent ? "[URGENT] " : "";
      const text = `${date} - ${prefix}${note.content}`.substring(0, 120);
      addLine(text, 9);
    }
  }

  // Documents list
  if (documents.length > 0) {
    addSection("UPLOADED DOCUMENTS");
    for (const doc of documents) {
      const date = new Date(doc.created_at).toLocaleDateString("en-GB");
      addLine(`${doc.doc_type}: ${doc.file_name} (${date})`, 9);
    }
  }

  // Build PDF bytes
  const fontName = "Helvetica";
  const fontBoldName = "Helvetica-Bold";

  let stream = "";
  for (const line of lines) {
    if (line.y < 40) break; // Don't go below page margin
    const fontKey = line.bold ? "/F2" : "/F1";
    const escaped = line.text
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    stream += `BT\n${fontKey} ${line.size} Tf\n1 0 0 1 ${line.x} ${line.y} Tm\n(${escaped}) Tj\nET\n`;
  }

  const streamBytes = new TextEncoder().encode(stream);

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  objects.push(
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj`
  );
  objects.push(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`
  );
  objects.push(
    `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}endstream\nendobj`
  );
  objects.push(
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontName} >>\nendobj`
  );
  objects.push(
    `6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /${fontBoldName} >>\nendobj`
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + "\n";
  }
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountJson = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT");
    if (!serviceAccountJson) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_DRIVE_SERVICE_ACCOUNT secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rootFolderId = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
    if (!rootFolderId) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_DRIVE_ROOT_FOLDER_ID secret not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, student_id, document_id } = await req.json();

    if (!student_id) {
      return new Response(
        JSON.stringify({ error: "student_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch student data
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("id", student_id)
      .single();

    if (!student) {
      return new Response(
        JSON.stringify({ error: "Student not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch agent profile
    const { data: agentProfile } = await supabase
      .from("profiles")
      .select("id, full_name, admin_id")
      .eq("id", student.agent_id)
      .single();

    // Fetch admin profile if exists
    let adminProfile = null;
    if (agentProfile?.admin_id) {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("id", agentProfile.admin_id)
        .single();
      adminProfile = data;
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);

    // Build folder hierarchy
    const sanitize = (s: string | null | undefined) => (s || "Unknown").replace(/[^a-zA-Z0-9 ]/g, "_").substring(0, 50);

    // Admin folder (or "Agents_Without_Admin")
    let adminFolderId: string;
    const adminEntityId = adminProfile?.id || "no_admin";
    const adminFolderName = adminProfile
      ? `Admin_${sanitize(adminProfile.full_name)}`
      : "Agents_Without_Admin";

    // Check mapping
    const { data: adminMapping } = await supabase
      .from("drive_folder_mappings")
      .select("drive_folder_id")
      .eq("entity_type", "admin")
      .eq("entity_id", adminEntityId)
      .maybeSingle();

    if (adminMapping) {
      adminFolderId = adminMapping.drive_folder_id;
    } else {
      adminFolderId = await findOrCreateFolder(accessToken, adminFolderName, rootFolderId);
      await supabase.from("drive_folder_mappings").insert({
        entity_type: "admin",
        entity_id: adminEntityId,
        drive_folder_id: adminFolderId,
        parent_drive_folder_id: rootFolderId,
        folder_name: adminFolderName,
      });
    }

    // Agent folder
    let agentFolderId: string;
    const agentFolderName = `Agent_${sanitize(agentProfile?.full_name || "Unknown")}`;

    const { data: agentMapping } = await supabase
      .from("drive_folder_mappings")
      .select("drive_folder_id")
      .eq("entity_type", "agent")
      .eq("entity_id", student.agent_id)
      .maybeSingle();

    if (agentMapping) {
      agentFolderId = agentMapping.drive_folder_id;
    } else {
      agentFolderId = await findOrCreateFolder(accessToken, agentFolderName, adminFolderId);
      await supabase.from("drive_folder_mappings").insert({
        entity_type: "agent",
        entity_id: student.agent_id,
        drive_folder_id: agentFolderId,
        parent_drive_folder_id: adminFolderId,
        folder_name: agentFolderName,
      });
    }

    // Student folder
    let studentFolderId: string;
    const studentFolderName = `Student_${sanitize(student.first_name)}_${sanitize(student.last_name)}`;

    const { data: studentMapping } = await supabase
      .from("drive_folder_mappings")
      .select("drive_folder_id")
      .eq("entity_type", "student")
      .eq("entity_id", student_id)
      .maybeSingle();

    if (studentMapping) {
      studentFolderId = studentMapping.drive_folder_id;
    } else {
      studentFolderId = await findOrCreateFolder(accessToken, studentFolderName, agentFolderId);
      await supabase.from("drive_folder_mappings").insert({
        entity_type: "student",
        entity_id: student_id,
        drive_folder_id: studentFolderId,
        parent_drive_folder_id: agentFolderId,
        folder_name: studentFolderName,
      });
    }

    // Fetch related data for summary PDF
    const { data: enrollments = [] } = await supabase
      .from("enrollments")
      .select("*, universities(name), courses(name)")
      .eq("student_id", student_id);

    const { data: notes = [] } = await supabase
      .from("student_notes")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    const { data: documents = [] } = await supabase
      .from("student_documents")
      .select("*")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false });

    // Always upload/update the summary PDF
    const summaryPdfBytes = buildStudentSummaryPdf(student, enrollments || [], notes || [], documents || []);
    await uploadFileToDrive(
      accessToken,
      "Student_Profile.pdf",
      summaryPdfBytes,
      "application/pdf",
      studentFolderId
    );

    // If a specific document was uploaded, sync it
    if (action === "document_uploaded" && document_id) {
      const doc = (documents || []).find((d: any) => d.id === document_id);
      if (doc) {
        const { data: fileData } = await supabase.storage
          .from("student-documents")
          .download(doc.file_path);
        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const ext = doc.file_name.split(".").pop() || "pdf";
          const mimeType = ext === "pdf" ? "application/pdf" : `application/${ext}`;
          await uploadFileToDrive(
            accessToken,
            `${doc.doc_type}_${doc.file_name}`,
            bytes,
            mimeType,
            studentFolderId
          );
        }
      }
    }

    // If full sync or student_created, upload all documents
    if (action === "student_created" || action === "full_sync") {
      for (const doc of documents || []) {
        const { data: fileData } = await supabase.storage
          .from("student-documents")
          .download(doc.file_path);
        if (fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          const ext = doc.file_name.split(".").pop() || "pdf";
          const mimeType = ext === "pdf" ? "application/pdf" : `application/${ext}`;
          await uploadFileToDrive(
            accessToken,
            `${doc.doc_type}_${doc.file_name}`,
            bytes,
            mimeType,
            studentFolderId
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        student_folder_id: studentFolderId,
        message: `Synced to Drive: ${action}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("sync-to-drive error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
