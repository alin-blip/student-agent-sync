
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const { messages, conversation_id } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authenticate user from JWT ---
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

    // --- Conversation persistence ---
    let activeConversationId = conversation_id || null;
    const lastUserMessage = messages[messages.length - 1];

    if (userId) {
      if (!activeConversationId) {
        // Create new conversation
        const title = (lastUserMessage?.content || "New conversation").slice(0, 50);
        const { data: convData } = await adminClient
          .from("ai_conversations")
          .insert({ user_id: userId, title })
          .select("id")
          .single();
        if (convData) activeConversationId = convData.id;
      } else {
        // Update conversation's updated_at
        await adminClient
          .from("ai_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeConversationId);
      }

      // Save user message
      if (activeConversationId && lastUserMessage) {
        await adminClient.from("ai_messages").insert({
          conversation_id: activeConversationId,
          role: "user",
          content: lastUserMessage.content,
        });
      }
    }

    // --- Fetch Knowledge Base ---
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

    // --- Fetch Live Course Requirements ---
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

    // --- Fetch Available Universities & Locations ---
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

    // --- Fetch User Tasks ---
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

    // --- Fetch User-Scoped Data ---
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

    // --- Build System Prompt ---
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
- Enrollment statuses: Applied → Offer Received → CAS Issued → Visa Applied → Enrolled → Completed (or Rejected/Withdrawn).
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
- Always respond in English, regardless of the language the user writes in.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact the owner." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Stream response and collect full assistant reply for persistence
    const responseHeaders = {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      ...(activeConversationId ? { "X-Conversation-Id": activeConversationId } : {}),
    };

    if (!userId || !activeConversationId) {
      // No persistence needed, just proxy
      return new Response(response.body, { headers: responseHeaders });
    }

    // Collect assistant content while streaming through
    const reader = response.body!.getReader();
    let fullAssistantContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            // Pass through to client
            controller.enqueue(value);

            // Parse SSE to collect content
            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) fullAssistantContent += content;
              } catch { /* skip parse errors */ }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          // Save assistant message
          if (fullAssistantContent) {
            await adminClient.from("ai_messages").insert({
              conversation_id: activeConversationId,
              role: "assistant",
              content: fullAssistantContent,
            });
          }
          controller.close();
        }
      },
    });

    return new Response(stream, { headers: responseHeaders });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
