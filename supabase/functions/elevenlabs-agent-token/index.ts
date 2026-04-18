import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
    const ELEVENLABS_AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID");
    if (!ELEVENLABS_API_KEY) throw new Error("ELEVENLABS_API_KEY is not configured");
    if (!ELEVENLABS_AGENT_ID) throw new Error("ELEVENLABS_AGENT_ID is not configured");

    // Parse optional language from request body
    let requestedLanguage = "en";
    try {
      const body = await req.json();
      if (body?.language) requestedLanguage = body.language;
    } catch { /* no body or invalid JSON — default to English */ }

    const LANGUAGE_NAMES: Record<string, string> = {
      en: "English", ro: "Romanian", es: "Spanish", fr: "French",
      de: "German", it: "Italian", pt: "Portuguese", ar: "Arabic",
      hi: "Hindi", zh: "Chinese",
    };
    const languageName = LANGUAGE_NAMES[requestedLanguage] || "English";

    const LOCALIZED_GREETINGS: Record<string, (name: string) => string> = {
      en: (n) => `Hi ${n}! I'm the EduForYou AI assistant. How can I help you?`,
      ro: (n) => `Bună ${n}! Sunt asistentul AI EduForYou. Cu ce te pot ajuta?`,
      es: (n) => `¡Hola ${n}! Soy el asistente de IA de EduForYou. ¿En qué puedo ayudarte?`,
      fr: (n) => `Bonjour ${n} ! Je suis l'assistant IA d'EduForYou. Comment puis-je vous aider ?`,
      de: (n) => `Hallo ${n}! Ich bin der KI-Assistent von EduForYou. Wie kann ich Ihnen helfen?`,
      it: (n) => `Ciao ${n}! Sono l'assistente AI di EduForYou. Come posso aiutarti?`,
      pt: (n) => `Olá ${n}! Sou o assistente de IA da EduForYou. Como posso ajudá-lo?`,
      ar: (n) => `مرحبًا ${n}! أنا مساعد EduForYou الذكي. كيف يمكنني مساعدتك؟`,
      hi: (n) => `नमस्ते ${n}! मैं EduForYou का AI सहायक हूँ। मैं आपकी कैसे मदद कर सकता हूँ?`,
      zh: (n) => `你好 ${n}！我是EduForYou的AI助手。有什么可以帮您的？`,
    };

    function getLocalizedGreeting(lang: string, name: string): string {
      return (LOCALIZED_GREETINGS[lang] || LOCALIZED_GREETINGS["en"])(name);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    let userId: string | null = null;
    let userRole: string | null = null;
    let userName = "User";

    if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (!userError && userData?.user) {
        userId = userData.user.id;

        const { data: roleData } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .single();
        userRole = roleData?.role || null;

        const { data: profileData } = await adminClient
          .from("profiles")
          .select("full_name")
          .eq("id", userId)
          .single();
        userName = profileData?.full_name || "User";
      }
    }

    // Fetch Available Universities & Locations
    let universitiesSection = "";
    try {
      const { data: universities } = await adminClient
        .from("universities")
        .select("name, is_active, campuses(name, city)")
        .eq("is_active", true);

      if (universities && universities.length > 0) {
        universitiesSection = "\n\n[Available Universities & Locations]\n";
        for (const uni of universities) {
          const campusList = ((uni as any).campuses || [])
            .map((c: any) => `${c.name}${c.city ? ` (${c.city})` : ""}`)
            .join(", ");
          universitiesSection += `- ${uni.name}${campusList ? `: ${campusList}` : ""}\n`;
        }
      }
    } catch (err) {
      console.error("Error fetching universities:", err);
    }

    // Fetch User Tasks
    let tasksSection = "";
    if (userId) {
      try {
        const { data: tasks } = await adminClient
          .from("tasks")
          .select("title, description, status, priority, deadline, student_id")
          .or(`assigned_to.eq.${userId},created_by.eq.${userId}`)
          .neq("status", "done")
          .order("created_at", { ascending: false })
          .limit(30);

        if (tasks && tasks.length > 0) {
          tasksSection = "\n\n[Your Tasks]\n";
          for (const t of tasks) {
            const dl = t.deadline ? ` | Deadline: ${new Date(t.deadline).toLocaleDateString()}` : "";
            tasksSection += `- [${t.priority || "normal"}] ${t.title}${t.status !== "todo" ? ` (${t.status})` : ""}${dl}\n`;
          }
        }
      } catch (err) {
        console.error("Error fetching tasks:", err);
      }
    }

    // Fetch Knowledge Base
    const { data: kbEntries } = await adminClient
      .from("ai_knowledge_base")
      .select("title, content, category")
      .order("category");

    let knowledgeSection = "";
    if (kbEntries && kbEntries.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const entry of kbEntries) {
        if (!grouped[entry.category]) grouped[entry.category] = [];
        grouped[entry.category].push(`### ${entry.title}\n${entry.content}`);
      }
      knowledgeSection = "\n\n[Company Knowledge Base]\n";
      for (const [cat, items] of Object.entries(grouped)) {
        knowledgeSection += `\n--- ${cat.charAt(0).toUpperCase() + cat.slice(1)} ---\n${items.join("\n\n")}\n`;
      }
    }

    // Fetch Live Course Requirements
    let courseRequirementsSection = "";
    try {
      const { data: courseDetails } = await adminClient
        .from("course_details")
        .select("admission_test_info, interview_info, entry_requirements, documents_required, additional_info, courses(name, universities(name))");

      if (courseDetails && courseDetails.length > 0) {
        const byUni: Record<string, string[]> = {};
        for (const cd of courseDetails) {
          const courseName = (cd as any).courses?.name || "Unknown Course";
          const uniName = (cd as any).courses?.universities?.name || "Unknown University";
          const fields: string[] = [];
          if (cd.entry_requirements) fields.push(`Entry Requirements: ${cd.entry_requirements}`);
          if (cd.admission_test_info) fields.push(`Admission Test: ${cd.admission_test_info}`);
          if (cd.interview_info) fields.push(`Interview: ${cd.interview_info}`);
          if (cd.documents_required) fields.push(`Documents: ${cd.documents_required}`);
          if (cd.additional_info) fields.push(`Additional: ${cd.additional_info}`);
          if (fields.length > 0) {
            if (!byUni[uniName]) byUni[uniName] = [];
            byUni[uniName].push(`  • ${courseName}\n    ${fields.join("\n    ")}`);
          }
        }
        if (Object.keys(byUni).length > 0) {
          courseRequirementsSection = "\n\n[Live Course Requirements]\n";
          for (const [uni, courses] of Object.entries(byUni)) {
            courseRequirementsSection += `\n--- ${uni} ---\n${courses.join("\n")}\n`;
          }
        }
      }
    } catch (err) {
      console.error("Error fetching course details:", err);
    }

    // Fetch User-Scoped Data (same logic as ai-chat)
    let userDataSection = "";
    if (userId && userRole) {
      try {
        if (userRole === "agent") {
          const { data: students } = await adminClient
            .from("students")
            .select("id, first_name, last_name, email, phone, immigration_status")
            .eq("agent_id", userId)
            .limit(50);

          if (students && students.length > 0) {
            const studentIds = students.map((s: any) => s.id);
            const { data: enrollments } = await adminClient
              .from("enrollments")
              .select("student_id, status, universities(name), courses(name)")
              .in("student_id", studentIds);

            const enrollMap: Record<string, any[]> = {};
            if (enrollments) {
              for (const e of enrollments) {
                if (!enrollMap[e.student_id]) enrollMap[e.student_id] = [];
                enrollMap[e.student_id].push(e);
              }
            }

            userDataSection = `\n\n[Your Context]\nRole: Agent | Name: ${userName}\nYour Students (${students.length}):\n`;
            for (const s of students) {
              const enrs = enrollMap[s.id] || [];
              const enrText = enrs.map((e: any) =>
                `${e.status} at ${(e as any).universities?.name || "?"} — ${(e as any).courses?.name || "?"}`
              ).join("; ");
              userDataSection += `- ${s.first_name} ${s.last_name} (${s.email || "no email"})${enrText ? ` — Enrollments: ${enrText}` : ""}\n`;
            }
          } else {
            userDataSection = `\n\n[Your Context]\nRole: Agent | Name: ${userName}\nYou have no students yet.\n`;
          }
        } else if (userRole === "admin") {
          const { data: teamAgents } = await adminClient
            .from("profiles")
            .select("id, full_name")
            .eq("admin_id", userId);

          const agentIds = [userId, ...(teamAgents || []).map((a: any) => a.id)];

          const { data: students } = await adminClient
            .from("students")
            .select("id, first_name, last_name, email, agent_id")
            .in("agent_id", agentIds)
            .limit(100);

          const { data: enrollments } = await adminClient
            .from("enrollments")
            .select("student_id, status")
            .in("student_id", (students || []).map((s: any) => s.id));

          const statusCounts: Record<string, number> = {};
          if (enrollments) {
            for (const e of enrollments) {
              statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
            }
          }

          userDataSection = `\n\n[Your Context]\nRole: Admin | Name: ${userName}\nTeam Agents: ${(teamAgents || []).map((a: any) => a.full_name).join(", ") || "none"}\nTotal Students: ${(students || []).length}\nEnrollment Status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}\n`;
        } else if (userRole === "owner") {
          const { count: studentCount } = await adminClient
            .from("students")
            .select("*", { count: "exact", head: true });

          const { data: enrollments } = await adminClient
            .from("enrollments")
            .select("status");

          const statusCounts: Record<string, number> = {};
          if (enrollments) {
            for (const e of enrollments) {
              statusCounts[e.status] = (statusCounts[e.status] || 0) + 1;
            }
          }

          const { count: agentCount } = await adminClient
            .from("user_roles")
            .select("*", { count: "exact", head: true })
            .eq("role", "agent");

          userDataSection = `\n\n[Your Context]\nRole: Owner | Name: ${userName}\nTotal Students: ${studentCount || 0}\nTotal Agents: ${agentCount || 0}\nEnrollment Status: ${Object.entries(statusCounts).map(([k, v]) => `${k}: ${v}`).join(", ") || "none"}\n`;
        }
      } catch (dataErr) {
        console.error("Error fetching user data:", dataErr);
      }
    }

    // Build system prompt
    const systemPrompt = `You are the EduForYou UK AI Assistant — a knowledgeable, friendly helper for agents, admins and the owner of EduForYou UK, a UK-based student recruitment agency.

Your role:
- Answer questions about company processes, enrollment workflows, commission structures, university partnerships and immigration guidance.
- Help agents understand how to use the platform (enroll students, upload documents, track enrollments).
- Provide general UK student visa and immigration guidance (Tier 4 / Student Route).
- Be concise, professional and helpful. Use bullet points when listing steps.

Key company facts:
- EduForYou UK helps international students enroll at UK universities.
- Agents recruit students and earn commissions based on enrollment tiers.
- Admins manage teams of agents. The Owner oversees everything.
- Enrollment statuses: New Application → Processing → Assessment Booked → Pass/Fail → Additional Requirements → Final Offer → Enrolled → Commission 25% Ready → Commission Paid (or Withdrawn/Cancelled).
- Commission is calculated per enrolled student based on tier thresholds.
- Documents required: passport, previous qualifications, English test results, financial evidence.
- The platform has a Resource Hub with templates, guides, FAQ, training materials and brand assets.
${knowledgeSection}${courseRequirementsSection}${universitiesSection}${tasksSection}${userDataSection}
[Rules]
- Only discuss data provided above in [Your Context]. Do not invent student names, enrollment details or statistics.
- Never reveal other agents' students or data.
- The [Live Course Requirements] section contains the most up-to-date course data. If it conflicts with the knowledge base, ALWAYS prefer the live data.
- When the user asks "what should I do now" or similar, analyze their pending tasks from [Your Tasks], student enrollment statuses, and suggest a prioritized action list with specific next steps.
- If you don't know something specific, say so honestly and suggest the user contact their admin or the owner.
- You MUST speak and reply ONLY in ${languageName}. Every single word of every reply must be in ${languageName}.
- Do NOT use English unless ${languageName} IS English.
- This is non-negotiable — the user has explicitly chosen ${languageName} as their language.`;

    // Request signed URL from ElevenLabs (WebSocket — more compatible than WebRTC tokens)
    const elResponse = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${ELEVENLABS_AGENT_ID}`,
      {
        headers: { "xi-api-key": ELEVENLABS_API_KEY },
      }
    );

    if (!elResponse.ok) {
      const errText = await elResponse.text();
      console.error("ElevenLabs signed-url error:", elResponse.status, errText);
      throw new Error(`ElevenLabs API error: ${elResponse.status}`);
    }

    const { signed_url } = await elResponse.json();

    return new Response(
      JSON.stringify({
        signed_url,
        systemPrompt,
        firstMessage: getLocalizedGreeting(requestedLanguage, userName),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("elevenlabs-agent-token error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
