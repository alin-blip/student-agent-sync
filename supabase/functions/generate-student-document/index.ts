import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAI(apiKey: string, messages: any[], model = "google/gemini-3-flash-preview") {
  return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages }),
  });
}

function handleAIError(response: Response) {
  if (response.status === 429) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (response.status === 402) {
    return new Response(JSON.stringify({ error: "AI credits exhausted. Please contact the owner." }), {
      status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

function buildCVPromptFromQuestionnaire(
  cvQ: any,
  studentProfile: string,
  courseField: string,
) {
  const workSection = (cvQ.work_experience || []).map((w: any, i: number) => {
    const period = w.is_present ? `${w.start_date} – Present` : `${w.start_date} – ${w.end_date || "N/A"}`;
    return `Position ${i + 1}: ${w.job_title} at ${w.company}${w.company_address ? ` (${w.company_address})` : ""}, ${period}\nResponsibilities: ${w.responsibilities || "Not specified"}`;
  }).join("\n\n");

  const eduSection = (cvQ.education || []).map((e: any, i: number) => {
    return `Education ${i + 1}: ${e.course} at ${e.school}, ${e.start_date} – ${e.end_date || "N/A"}, Status: ${e.status}, Diploma: ${e.diploma}`;
  }).join("\n\n");

  const skillsSection = cvQ.skills || "Not specified";

  return `STUDENT PROFILE (for personal details only):\n${studentProfile}\n\nWORK EXPERIENCE:\n${workSection || "None provided"}\n\nEDUCATION:\n${eduSection || "None provided"}\n\nSKILLS:\n${skillsSection}\n\nCOURSE FIELD FOR SKILLS MATCHING (do NOT mention this in the CV): ${courseField}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { student_id, document_type, use_guidelines = true, cv_questionnaire } = await req.json();
    if (!student_id || !document_type) {
      return new Response(JSON.stringify({ error: "student_id and document_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Fetch student data
    const { data: student, error: studentError } = await adminClient
      .from("students").select("*").eq("id", student_id).single();
    if (studentError || !student) {
      return new Response(JSON.stringify({ error: "Student not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch enrollments
    const { data: enrollments } = await adminClient
      .from("enrollments")
      .select("status, notes, course_id, universities(name), courses(name, level, study_mode, duration)")
      .eq("student_id", student_id);

    const enrollmentInfo = (enrollments || []).map((e: any) =>
      `${e.courses?.name || "Unknown course"} (${e.courses?.level || ""}, ${e.courses?.duration || "duration unknown"}) at ${e.universities?.name || "Unknown"} — Status: ${e.status}, Study mode: ${e.courses?.study_mode || "unknown"}`
    ).join("\n");

    const primaryEnrollment = (enrollments || [])[0];
    const courseName = primaryEnrollment?.courses?.name || "the course";
    const universityName = primaryEnrollment?.universities?.name || "the university";
    const courseDuration = primaryEnrollment?.courses?.duration || "";
    const courseLevel = primaryEnrollment?.courses?.level || "";
    const courseField = `${courseName} (${courseLevel})`;

    // Student profile summary (personal details)
    const profileSummary = [
      `Name: ${student.title ? student.title + " " : ""}${student.first_name} ${student.last_name}`,
      student.email ? `Email: ${student.email}` : null,
      student.phone ? `Phone: ${student.phone}` : null,
      student.date_of_birth ? `Date of Birth: ${student.date_of_birth}` : null,
      student.nationality ? `Nationality: ${student.nationality}` : null,
      student.gender ? `Gender: ${student.gender}` : null,
      student.full_address ? `Address: ${student.full_address}` : null,
      student.immigration_status ? `Immigration Status: ${student.immigration_status}` : null,
      student.qualifications ? `Qualifications: ${student.qualifications}` : null,
      student.study_pattern ? `Study Pattern: ${student.study_pattern}` : null,
      student.ni_number ? `NI Number: ${student.ni_number}` : null,
      student.share_code ? `Share Code: ${student.share_code}` : null,
      enrollmentInfo ? `\nEnrollments:\n${enrollmentInfo}` : null,
    ].filter(Boolean).join("\n");

    let systemPrompt: string;

    if (document_type === "cv") {
      if (cv_questionnaire) {
        // Questionnaire-based CV
        systemPrompt = `You are an expert CV writer for UK employment. Generate a professional, well-structured CV in Markdown format.

CRITICAL RULES:
- Use the WORK EXPERIENCE, EDUCATION, and SKILLS data provided by the user as the PRIMARY source
- Use the student profile ONLY for personal details (name, contact info, address)
- NEVER mention the university the student is applying to — this CV is independent
- Match and enhance the responsibilities and skills to be relevant to the student's field of interest (provided separately) WITHOUT naming the course or university
- Structure: Personal Details → Personal Profile/Objective → Work Experience → Education → Skills
- For work experience, present each role with company name, address, dates, and bullet-pointed responsibilities
- For education, show each entry with institution, course, dates, status, and diploma availability
- Make responsibilities sound professional and achievement-oriented
- Be professional but personable
- Output ONLY the CV content in Markdown, no explanations`;

        const userContent = buildCVPromptFromQuestionnaire(cv_questionnaire, profileSummary, courseField);

        const response1 = await callAI(LOVABLE_API_KEY, [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ]);

        if (!response1.ok) {
          const errResp = handleAIError(response1);
          if (errResp) return errResp;
          const t = await response1.text();
          console.error("AI gateway error:", response1.status, t);
          return new Response(JSON.stringify({ error: "AI service error" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const result1 = await response1.json();
        const content = result1.choices?.[0]?.message?.content || "";

        return new Response(JSON.stringify({ content, document_type }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } else {
        // Legacy CV generation (no questionnaire)
        systemPrompt = `You are an expert CV writer for UK university students. Generate a professional, well-structured CV in Markdown format based on the student profile provided.

Guidelines:
- Use a clean, professional format with clear sections
- Include: Personal Details, Personal Profile/Objective, Education, Qualifications, Skills, and any relevant information
- If qualifications text contains multiple items, split them into bullet points
- Make it suitable for UK employment/university applications
- Be professional but personable
- Use the enrollment/course information to fill the Education section
- If information is missing, skip that section rather than adding placeholders
- Output ONLY the CV content in Markdown, no explanations`;
      }
    } else {
      // Personal statement — unchanged logic
      // Fetch course details for guidelines
      let courseDetailsInfo = "";
      if (use_guidelines && enrollments && enrollments.length > 0) {
        const courseIds = enrollments.map((e: any) => e.course_id).filter(Boolean);
        if (courseIds.length > 0) {
          const { data: courseDetails } = await adminClient
            .from("course_details")
            .select("personal_statement_guidelines, entry_requirements, courses(name)")
            .in("course_id", courseIds);
          if (courseDetails && courseDetails.length > 0) {
            courseDetailsInfo = courseDetails.map((cd: any) => {
              const parts = [`Course: ${cd.courses?.name || "Unknown"}`];
              if (cd.personal_statement_guidelines) parts.push(`Guidelines: ${cd.personal_statement_guidelines}`);
              if (cd.entry_requirements) parts.push(`Entry Requirements: ${cd.entry_requirements}`);
              return parts.join("\n");
            }).join("\n\n");
          }
        }
      }

      systemPrompt = `You are ghostwriting a personal statement for a real student applying to a UK university. Your goal is to produce text that reads exactly like a genuine 18-22 year old student wrote it by hand — not an AI.

MANDATORY OPENING — the personal statement MUST begin with a sentence like:
"I want to study ${courseName} at ${universityName}${courseDuration ? ` (${courseDuration})` : ""}${courseLevel ? `, ${courseLevel}` : ""} because..."
This opening sentence is NON-NEGOTIABLE. Always include the course name, university name, and duration.

Critical rules to avoid AI detection:

VOCABULARY & TONE:
- Write like an actual teenager/young adult, not a professor. Use everyday words
- Include filler words naturally: "like", "sort of", "kind of", "basically", "honestly", "I guess", "pretty much"
- Use contractions ALWAYS (I'm, didn't, wasn't, it's, I've, that's, won't, can't, I'd)
- Throw in a few slightly awkward phrasings — real students don't write perfectly polished prose
- Occasional minor grammatical looseness is fine (starting sentences with "And" or "But", dangling modifiers)

STRUCTURE:
- Do NOT use evenly-sized paragraphs. Mix short paragraphs (1-2 sentences) with longer ones (4-6 sentences)
- Do NOT use smooth transitions between every paragraph. Sometimes just jump to the next topic
- Don't follow a predictable intro-body-conclusion template
- Avoid numbered lists or bullet points — this is a narrative
- Some paragraphs can feel slightly tangential — that's human

CONTENT:
- Include ONE specific, personal anecdote that feels very particular (mention a specific place, person's first name, or event)
- Reference a specific experience with a real detail (a part-time job at a named shop, a specific module or lesson, a particular moment)
- Show genuine motivation but don't be grandiose or cliché about it
- Mention career aspirations casually, not as a grand declaration
- If relevant, include a throwaway personal detail that has nothing to do with the course but shows personality

BANNED PHRASES (never use these):
"in conclusion", "furthermore", "moreover", "I am deeply passionate", "in today's ever-changing world", "I have always been fascinated by", "this ignited my passion", "I am eager to", "encompasses", "multifaceted", "delve into", "hone my skills", "I believe that", "it is important to note", "plays a crucial role", "this experience taught me", "I am confident that", "throughout my life", "from a young age", "I am passionate about", "I strongly believe", "this solidified my desire"

STYLE TRICKS:
- Use a rhetorical question somewhere (but not at the very start)
- Include one slightly self-deprecating or humble comment
- End with something genuine and understated, not a grand closing statement
- Let some ideas trail off or be left slightly undeveloped — real students do this
- Reference something culturally specific to a UK student (a TV show, a news event, a common experience)

LENGTH: 500-700 words (unless specific guidelines say otherwise)
OUTPUT: ONLY the personal statement text in Markdown, no explanations or meta-commentary`;

      if (courseDetailsInfo) {
        systemPrompt += `\n\nIMPORTANT — Follow these SPECIFIC university/course guidelines:\n${courseDetailsInfo}\n\nYou MUST adhere to any word count limits, specific topics to cover, and formatting requirements specified above.`;
      }
    }

    // === PASS 1: Generate initial content ===
    const response1 = await callAI(LOVABLE_API_KEY, [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Generate a ${document_type === "cv" ? "CV" : "personal statement"} for the following student:\n\n${profileSummary}` },
    ]);

    if (!response1.ok) {
      const errResp = handleAIError(response1);
      if (errResp) return errResp;
      const t = await response1.text();
      console.error("AI gateway error:", response1.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result1 = await response1.json();
    let content = result1.choices?.[0]?.message?.content || "";

    // === PASS 2: Humanize (only for personal statements) ===
    if (document_type === "personal_statement" && content) {
      const humanizePrompt = `You are a human editor. Your job is to take the personal statement below and rewrite it so it is COMPLETELY undetectable by AI detection tools (GPTZero, Turnitin, etc).

Rules:
- Keep the SAME meaning and content — don't add or remove major points
- Keep the opening sentence about wanting to study the specific course at the specific university
- Rewrite sentences to have irregular rhythm — mix very short with medium length
- Add 2-3 natural filler phrases ("to be honest", "I guess", "sort of", "basically")
- Make 1-2 sentences slightly clunky or awkwardly phrased on purpose
- Replace any remaining formal/academic vocabulary with casual everyday words
- Break up any remaining perfectly structured paragraphs
- Ensure contractions are used everywhere (never "I am" → always "I'm", never "do not" → always "don't")
- Remove any remaining AI-sounding phrases
- Add a tiny personal aside that feels random but genuine
- Keep it between 500-700 words
- Output ONLY the rewritten personal statement, nothing else`;

      const response2 = await callAI(LOVABLE_API_KEY, [
        { role: "system", content: humanizePrompt },
        { role: "user", content: content },
      ]);

      if (response2.ok) {
        const result2 = await response2.json();
        const humanized = result2.choices?.[0]?.message?.content;
        if (humanized) content = humanized;
      }
    }

    // === PASS 3: AI Score estimation (only for personal statements) ===
    let ai_score: number | null = null;
    if (document_type === "personal_statement" && content) {
      try {
        const scoreResponse = await callAI(LOVABLE_API_KEY, [
          {
            role: "system",
            content: `You are an AI detection tool similar to GPTZero or Turnitin. Analyze the text provided and estimate what percentage an AI detector would flag it as AI-generated. Consider:
- Sentence structure variety (uniform = AI)
- Vocabulary level (too formal/academic = AI)
- Use of filler words and contractions (present = human)
- Paragraph length variation (uniform = AI)
- Presence of specific personal details (specific = human)
- Transition smoothness (too smooth = AI)
- Overall "feel" — does it read like a real student wrote it?

Respond with ONLY a single integer between 0 and 100 representing the estimated AI detection percentage. Nothing else — just the number.`
          },
          { role: "user", content: content },
        ]);

        if (scoreResponse.ok) {
          const scoreResult = await scoreResponse.json();
          const scoreText = scoreResult.choices?.[0]?.message?.content?.trim() || "";
          const parsed = parseInt(scoreText, 10);
          if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            ai_score = parsed;
          }
        }
      } catch (e) {
        console.error("AI score estimation failed:", e);
      }
    }

    return new Response(JSON.stringify({ content, document_type, ai_score }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-student-document error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
