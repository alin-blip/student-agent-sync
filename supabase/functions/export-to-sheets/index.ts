import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hard-coded target sheet (the user's existing Google Sheet)
const TARGET_SPREADSHEET_ID = "1Rag7Oa81ZhxhZeUbBXcUrjMDU9U39EdVPL1TUlgBUjQ";

// ---- Google auth ----
async function getAccessToken(serviceAccount: any): Promise<string> {
  const headerB64 = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = btoa(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope:
        "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const unsigned = `${headerB64}.${claimSet}`;

  if (!serviceAccount.private_key) {
    throw new Error("Service account JSON missing private_key field");
  }
  const pem = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned)
  );
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const safe = (s: string) =>
    s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const jwt = `${safe(headerB64)}.${safe(claimSet)}.${sigB64}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const json = await res.json();
  if (!json.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(json)}`);
  }
  return json.access_token;
}

async function getSheetsMeta(accessToken: string, spreadsheetId: string) {
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Failed to read spreadsheet (status ${r.status}): ${txt}`);
  }
  const d = await r.json();
  return (d.sheets || []).map((s: any) => s.properties);
}

async function batchUpdateSheets(
  accessToken: string,
  spreadsheetId: string,
  requests: any[]
) {
  if (!requests.length) return;
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requests }),
    }
  );
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`batchUpdate failed: ${txt}`);
  }
  return r.json();
}

async function writeValues(
  accessToken: string,
  spreadsheetId: string,
  data: { range: string; values: any[][] }[]
) {
  if (!data.length) return;
  const r = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    }
  );
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`values.batchUpdate failed: ${txt}`);
  }
}

const sanitizeTabName = (s: string) =>
  (s || "Untitled")
    .replace(/[\[\]\*\?\/\\:]/g, " ")
    .trim()
    .slice(0, 95) || "Untitled";

type GoogleServiceAccount = {
  client_email: string;
  private_key: string;
};

function parseServiceAccountSecret(raw: string): GoogleServiceAccount {
  let parsed: unknown = raw;

  for (let i = 0; i < 3; i++) {
    if (typeof parsed !== "string") break;

    const trimmed = parsed.trim();
    if (!trimmed) break;

    try {
      parsed = JSON.parse(trimmed);
      continue;
    } catch {
      try {
        parsed = new TextDecoder().decode(Uint8Array.from(atob(trimmed), (c) => c.charCodeAt(0)));
        continue;
      } catch {
        break;
      }
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT must be a full service account JSON object");
  }

  const serviceAccount = parsed as Record<string, unknown>;
  const client_email = typeof serviceAccount.client_email === "string"
    ? serviceAccount.client_email.trim()
    : "";
  const private_key = typeof serviceAccount.private_key === "string"
    ? serviceAccount.private_key.replace(/\\n/g, "\n").trim()
    : "";

  if (!client_email) {
    throw new Error("Service account JSON missing client_email field");
  }

  if (!private_key) {
    throw new Error("Service account JSON missing private_key field");
  }

  return { client_email, private_key };
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SA_RAW = Deno.env.get("GOOGLE_DRIVE_SERVICE_ACCOUNT");

    if (!SA_RAW) throw new Error("GOOGLE_DRIVE_SERVICE_ACCOUNT not set");
    const serviceAccount = parseServiceAccountSecret(SA_RAW);
    const serviceEmail = serviceAccount.client_email;

    // Auth caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const role = roleRow?.role;
    if (role !== "owner" && role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Google access token first — so we can return the service email if sharing fails
    const accessToken = await getAccessToken(serviceAccount);

    // Validate access to the target sheet upfront
    let existingTabs: any[];
    try {
      existingTabs = await getSheetsMeta(accessToken, TARGET_SPREADSHEET_ID);
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Cannot access the Google Sheet. Please share it with the service account as Editor.`,
          service_account_email: serviceEmail,
          spreadsheet_url: `https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`,
          details: err.message,
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch profiles + roles
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, email, admin_id");
    const { data: roles } = await admin
      .from("user_roles")
      .select("user_id, role");
    const roleByUser = new Map<string, string>();
    (roles || []).forEach((r: any) => roleByUser.set(r.user_id, r.role));

    const allAgents = (profiles || []).filter(
      (p: any) => roleByUser.get(p.id) === "agent"
    );
    const allAdmins = (profiles || []).filter(
      (p: any) => roleByUser.get(p.id) === "admin"
    );

    let agentsInScope = allAgents;
    let adminsInScope = allAdmins;
    if (role === "admin") {
      agentsInScope = allAgents.filter((a: any) => a.admin_id === user.id);
      adminsInScope = allAdmins.filter((a: any) => a.id === user.id);
    }

    const agentIds = agentsInScope.map((a: any) => a.id);
    const agentById = new Map<string, any>();
    agentsInScope.forEach((a: any) => agentById.set(a.id, a));

    // Pull data
    const [studentsRes, enrollRes, snapsRes, paysRes] = await Promise.all([
      admin
        .from("students")
        .select(
          "id, title, first_name, last_name, email, phone, date_of_birth, gender, nationality, immigration_status, ni_number, share_code, crn, uk_entry_date, full_address, next_of_kin_name, next_of_kin_phone, next_of_kin_relationship, qualifications, study_pattern, previous_funding_years, notes, agent_id, created_at, updated_at"
        )
        .in("agent_id", agentIds.length ? agentIds : ["00000000-0000-0000-0000-000000000000"]),
      admin
        .from("enrollments")
        .select(
          `id, status, created_at, assessment_date, assessment_time, funding_status, funding_type, notes, student_id,
          students!inner(first_name, last_name, email, phone, agent_id),
          universities(name),
          courses(name),
          campuses(name),
          intakes(label)`
        ),
      admin
        .from("commission_snapshots")
        .select("agent_id, admin_id, agent_rate, admin_rate, snapshot_status"),
      admin
        .from("commission_payments")
        .select("recipient_id, recipient_role, amount"),
    ]);

    const students = studentsRes.data || [];
    const enrollments = (enrollRes.data || []).filter((e: any) =>
      agentIds.includes(e.students?.agent_id)
    );
    const snapshots = snapsRes.data || [];
    const payments = paysRes.data || [];

    // Group: admin_id -> agents
    const agentsByAdmin = new Map<string, any[]>();
    for (const a of agentsInScope) {
      const key = a.admin_id || "__unassigned__";
      if (!agentsByAdmin.has(key)) agentsByAdmin.set(key, []);
      agentsByAdmin.get(key)!.push(a);
    }
    for (const adm of adminsInScope) {
      if (!agentsByAdmin.has(adm.id)) agentsByAdmin.set(adm.id, []);
    }

    // Plan tabs: Summary + one per Admin
    const adminEntries = Array.from(agentsByAdmin.entries()).map(
      ([adminKey, teamAgents]) => {
        const adminProfile = adminsInScope.find((p: any) => p.id === adminKey);
        const adminName =
          adminKey === "__unassigned__"
            ? "Unassigned Agents"
            : adminProfile?.full_name || adminProfile?.email || "Unknown Admin";
        return { adminKey, adminName, teamAgents };
      }
    );

    const desiredTabs = [
      "Summary",
      ...adminEntries.map((e) => sanitizeTabName(e.adminName)),
    ];

    // Ensure unique tab names
    const seen = new Set<string>();
    const uniqueDesired = desiredTabs.map((t) => {
      let name = t;
      let i = 2;
      while (seen.has(name)) name = `${t} (${i++})`.slice(0, 95);
      seen.add(name);
      return name;
    });

    // ---- Reset tabs in the target spreadsheet ----
    // Step 1: temp tab
    const tempTabTitle = `__tmp_${Date.now()}`;
    await batchUpdateSheets(accessToken, TARGET_SPREADSHEET_ID, [
      { addSheet: { properties: { title: tempTabTitle } } },
    ]);

    // Step 2: delete all existing non-temp tabs
    const refreshed = await getSheetsMeta(accessToken, TARGET_SPREADSHEET_ID);
    const deleteReqs = refreshed
      .filter((p: any) => p.title !== tempTabTitle)
      .map((p: any) => ({ deleteSheet: { sheetId: p.sheetId } }));
    if (deleteReqs.length) {
      await batchUpdateSheets(accessToken, TARGET_SPREADSHEET_ID, deleteReqs);
    }

    // Step 3: add desired tabs
    const addReqs = uniqueDesired.map((title) => ({
      addSheet: { properties: { title } },
    }));
    await batchUpdateSheets(accessToken, TARGET_SPREADSHEET_ID, addReqs);

    // Step 4: delete temp
    const finalMeta = await getSheetsMeta(accessToken, TARGET_SPREADSHEET_ID);
    const tmp = finalMeta.find((p: any) => p.title === tempTabTitle);
    if (tmp) {
      await batchUpdateSheets(accessToken, TARGET_SPREADSHEET_ID, [
        { deleteSheet: { sheetId: tmp.sheetId } },
      ]);
    }

    // ---- Build values ----
    const valueWrites: { range: string; values: any[][] }[] = [];

    // Summary tab: one row per agent, grouped by admin
    const summaryRows: any[][] = [
      [
        "Admin",
        "Agent",
        "Email",
        "Total Students",
        "Total Enrollments",
        "New Application",
        "Assessment Booked",
        "Conditional Offer",
        "Final Offer",
        "Enrolled",
        "Cancelled / Withdrawn",
        "Commission Earned (£)",
        "Commission Paid (£)",
        "Commission Remaining (£)",
      ],
    ];

    for (const entry of adminEntries) {
      for (const ag of entry.teamAgents) {
        const myStudents = students.filter((s: any) => s.agent_id === ag.id);
        const myEnrolls = enrollments.filter(
          (e: any) => e.students?.agent_id === ag.id
        );
        const countBy = (st: string) =>
          myEnrolls.filter((e: any) => e.status === st).length;
        const cancelled = myEnrolls.filter((e: any) =>
          ["cancelled", "withdrawn", "fail"].includes(e.status)
        ).length;
        const earned = snapshots
          .filter((s: any) => s.agent_id === ag.id)
          .reduce((acc: number, s: any) => acc + Number(s.agent_rate || 0), 0);
        const paid = payments
          .filter(
            (p: any) =>
              p.recipient_id === ag.id && p.recipient_role === "agent"
          )
          .reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0);
        summaryRows.push([
          entry.adminName,
          ag.full_name || "—",
          ag.email || "—",
          myStudents.length,
          myEnrolls.length,
          countBy("new_application"),
          countBy("assessment_booked"),
          countBy("conditional_offer"),
          countBy("final_offer"),
          countBy("enrolled"),
          cancelled,
          earned.toFixed(2),
          paid.toFixed(2),
          (earned - paid).toFixed(2),
        ]);
      }
      if (entry.teamAgents.length === 0) {
        summaryRows.push([entry.adminName, "(no agents on this team)"]);
      }
    }

    valueWrites.push({ range: `'Summary'!A1`, values: summaryRows });

    // Per-admin tab: ALL students + ALL enrollments for the team
    for (let idx = 0; idx < adminEntries.length; idx++) {
      const entry = adminEntries[idx];
      const tabTitle = uniqueDesired[idx + 1];
      const teamAgentIds = new Set(entry.teamAgents.map((a: any) => a.id));
      const teamStudents = students.filter((s: any) =>
        teamAgentIds.has(s.agent_id)
      );
      const teamEnrolls = enrollments.filter((e: any) =>
        teamAgentIds.has(e.students?.agent_id)
      );

      const rows: any[][] = [];
      rows.push([`ADMIN: ${entry.adminName}`]);
      rows.push([
        `Agents: ${entry.teamAgents.length}`,
        `Students: ${teamStudents.length}`,
        `Enrollments: ${teamEnrolls.length}`,
      ]);
      rows.push([]);

      rows.push(["STUDENTS"]);
      rows.push([
        "Agent",
        "Title",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Date of Birth",
        "Gender",
        "Nationality",
        "Immigration Status",
        "NI Number",
        "Share Code",
        "CRN",
        "UK Entry Date",
        "Full Address",
        "Next of Kin Name",
        "Next of Kin Phone",
        "Next of Kin Relationship",
        "Qualifications",
        "Study Pattern",
        "Previous Funding Years",
        "Notes",
        "Created",
        "Updated",
      ]);
      if (teamStudents.length === 0) {
        rows.push(["(no students)"]);
      } else {
        for (const s of teamStudents) {
          const ag = agentById.get(s.agent_id);
          rows.push([
            ag?.full_name || ag?.email || "—",
            s.title || "",
            s.first_name || "",
            s.last_name || "",
            s.email || "",
            s.phone || "",
            s.date_of_birth || "",
            s.gender || "",
            s.nationality || "",
            s.immigration_status || "",
            s.ni_number || "",
            s.share_code || "",
            s.crn || "",
            s.uk_entry_date || "",
            s.full_address || "",
            s.next_of_kin_name || "",
            s.next_of_kin_phone || "",
            s.next_of_kin_relationship || "",
            s.qualifications || "",
            s.study_pattern || "",
            s.previous_funding_years ?? "",
            s.notes || "",
            s.created_at ? new Date(s.created_at).toISOString().split("T")[0] : "",
            s.updated_at ? new Date(s.updated_at).toISOString().split("T")[0] : "",
          ]);
        }
      }
      rows.push([]);

      rows.push(["ENROLLMENTS"]);
      rows.push([
        "Agent",
        "Student",
        "University",
        "Course",
        "Campus",
        "Intake",
        "Status",
        "Created",
        "Assessment Date",
        "Assessment Time",
        "Funding Status",
        "Funding Type",
        "Notes",
      ]);
      if (teamEnrolls.length === 0) {
        rows.push(["(no enrollments)"]);
      } else {
        for (const e of teamEnrolls) {
          const ag = agentById.get(e.students?.agent_id);
          rows.push([
            ag?.full_name || ag?.email || "—",
            `${e.students?.first_name || ""} ${e.students?.last_name || ""}`.trim(),
            e.universities?.name || "",
            e.courses?.name || "",
            e.campuses?.name || "",
            e.intakes?.label || "",
            e.status || "",
            e.created_at ? new Date(e.created_at).toISOString().split("T")[0] : "",
            e.assessment_date || "",
            e.assessment_time || "",
            e.funding_status || "",
            e.funding_type || "",
            e.notes || "",
          ]);
        }
      }

      valueWrites.push({
        range: `'${tabTitle.replace(/'/g, "''")}'!A1`,
        values: rows,
      });
    }

    // Write in chunks
    for (let i = 0; i < valueWrites.length; i += 5) {
      await writeValues(
        accessToken,
        TARGET_SPREADSHEET_ID,
        valueWrites.slice(i, i + 5)
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        spreadsheet_id: TARGET_SPREADSHEET_ID,
        spreadsheet_url: `https://docs.google.com/spreadsheets/d/${TARGET_SPREADSHEET_ID}/edit`,
        service_account_email: serviceEmail,
        admins_count: adminEntries.length,
        agents_count: agentsInScope.length,
        students_count: students.length,
        enrollments_count: enrollments.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("export-to-sheets error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
