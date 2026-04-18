import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await adminClient.auth.getUser(token);
    if (authErr || !user) throw new Error("Unauthorized");

    const { prompt, preset, language, courseId } = await req.json();
    if (!prompt) throw new Error("Missing prompt");
    const lang = language || "English";

    // Fetch brand settings
    const { data: brand } = await adminClient.from("brand_settings").select("brand_prompt").limit(1).single();

    // Fetch knowledge base entries
    const { data: kbEntries } = await adminClient.from("ai_knowledge_base").select("title, content, category").order("category");

    // Fetch courses with universities
    const { data: courses } = await adminClient.from("courses").select("name, level, study_mode, university_id");
    const { data: universities } = await adminClient.from("universities").select("id, name").eq("is_active", true);

    // Build knowledge context
    let knowledgeContext = "";
    if (kbEntries && kbEntries.length > 0) {
      const grouped: Record<string, string[]> = {};
      for (const entry of kbEntries) {
        const cat = entry.category || "general";
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(`${entry.title}: ${entry.content}`);
      }
      knowledgeContext = "\n\nKNOWLEDGE BASE (use this real data in your content):\n";
      for (const [cat, items] of Object.entries(grouped)) {
        knowledgeContext += `\n[${cat.toUpperCase()}]\n${items.join("\n")}\n`;
      }
    }

    // Build selected course context
    let selectedCourseContext = "";
    if (courseId) {
      const { data: courseRow } = await adminClient.from("courses").select("name, level, study_mode, duration, fees").eq("id", courseId).single();
      const { data: detailsRow } = await adminClient.from("course_details").select("entry_requirements, documents_required, interview_info, admission_test_info, personal_statement_guidelines, additional_info").eq("course_id", courseId).single();
      if (courseRow) {
        selectedCourseContext = `\n\nSELECTED COURSE CONTEXT (use these real details — DO NOT mention the university name, only the course):\n- Course: ${courseRow.name}\n- Level: ${courseRow.level}\n- Study Mode: ${courseRow.study_mode}\n- Duration: ${courseRow.duration || "N/A"}\n- Fees: ${courseRow.fees || "N/A"}`;
        if (detailsRow) {
          if (detailsRow.entry_requirements) selectedCourseContext += `\n- Entry Requirements: ${detailsRow.entry_requirements}`;
          if (detailsRow.documents_required) selectedCourseContext += `\n- Documents Required: ${detailsRow.documents_required}`;
          if (detailsRow.interview_info) selectedCourseContext += `\n- Interview Info: ${detailsRow.interview_info}`;
          if (detailsRow.admission_test_info) selectedCourseContext += `\n- Admission Test: ${detailsRow.admission_test_info}`;
          if (detailsRow.personal_statement_guidelines) selectedCourseContext += `\n- Personal Statement: ${detailsRow.personal_statement_guidelines}`;
          if (detailsRow.additional_info) selectedCourseContext += `\n- Additional Info: ${detailsRow.additional_info}`;
        }
      }
    }

    // Build courses context — only course names, NO university names
    let coursesContext = "";
    if (courses && courses.length > 0) {
      const courseLines = courses
        .map((c: any) => `- ${c.name} (${c.level}, ${c.study_mode})`)
        .slice(0, 50);
      coursesContext = `\n\nAVAILABLE COURSES:\n${courseLines.join("\n")}\n`;
    }

    const strictRules = `\n\nABSOLUTE RULE #1 — ZERO TOLERANCE: NEVER include ANY university name in the caption. Not in the text, not in hashtags, NOWHERE. Only use the course name or field of study. This rule overrides ALL other instructions. Violation = failure.

STRICT CONTENT RULES (MUST follow):
- ABSOLUTE BAN: No university names anywhere — not in text, not in hashtags, not even abbreviated
- NEVER say "our courses", "our programs", "we offer" — use "the course", "this program", "the BSc in..."
- NEVER use the word "free" or "gratuit" or imply anything is free
- Student finance is a LOAN (not a grant). It is repaid after graduation at 9% of earnings above £25,000/year. Always frame it accurately: "student finance available", "funding support", "government-backed student loan"
- Do NOT invent course names or details — only use real data from the context provided

FINAL REMINDER: NEVER mention university names. Only course names or fields of study.`;


    const textStructureRules = `\n\n=== MANDATORY TEXT STRUCTURE (EduForYou Brand Style) ===
The caption must be clean, scannable, and instantly understandable.
Follow this EXACT structure:
1. ONE headline/hook sentence (max 8 words) — bold, attention-grabbing
2. ONE supporting sentence (max 15 words) — context or benefit
3. OPTIONAL: Up to 5 short bullet points (max 6 words each) — only if relevant
- DO NOT write long paragraphs — keep it punchy and scannable
- Every line must serve a purpose — if in doubt, leave it out
- End with a clear CTA + 3-5 hashtags`;

    const isScript = preset === "script";

    const presetLabels: Record<string, string> = {
      social_post: "Instagram/Facebook post",
      story: "Instagram/Facebook story",
      flyer: "promotional flyer",
      banner: "web/social banner",
      script: "video teleprompter script",
    };
    const presetLabel = presetLabels[preset] || "social media post";

    const brandSection = brand?.brand_prompt ? `Brand Voice & Guidelines:\n${brand.brand_prompt}\n` : "";

    let systemPrompt: string;

    if (isScript) {
      systemPrompt = `You are the social media manager and video content creator for EduForYou UK, an education recruitment agency that helps students find the right university courses in the UK.

${brandSection}${knowledgeContext}${coursesContext}${selectedCourseContext}${strictRules}${textStructureRules}
Write a teleprompter-ready video script for a short-form video (30-60 seconds) about the given topic.
IMPORTANT: Write the ENTIRE script in ${lang}.

Rules:
- Write in a conversational, natural speaking tone — as if talking directly to the viewer
- Use short sentences that are easy to read from a teleprompter
- Start with a hook / attention grabber (first 3 seconds)
- Reference REAL courses and admissions info from the knowledge base above when relevant
- NEVER mention specific university names — only refer to course names or fields of study generally
- Include a clear CTA (call-to-action) at the end — e.g. "Send us a message", "Link in bio", "Comment below", "Book your free consultation"
- Keep it concise: 80-150 words max
- Add [PAUSE] markers where the speaker should take a brief pause
- Do NOT include hashtags or emojis — this is spoken text
- The script MUST be written in ${lang}
- End with a strong, actionable CTA`;
    } else {
      systemPrompt = `You are the social media manager for EduForYou UK, an education recruitment agency that helps students find the right university courses in the UK.

${brandSection}${knowledgeContext}${coursesContext}${selectedCourseContext}${strictRules}${textStructureRules}
Write an engaging social media post caption for a ${presetLabel} image.
IMPORTANT: Write the ENTIRE caption in ${lang}.

Rules:
- Write in a professional yet friendly and motivational tone
- Include 3-5 relevant hashtags at the end
- Keep the caption concise (2-4 sentences max)
- Reference REAL courses, intakes, or admissions data from the knowledge base above when relevant to the topic — but NEVER mention specific university names, only course names or fields of study
- ALWAYS include a clear call-to-action (CTA) — e.g. "DM us now", "Link in bio", "Apply today", "Book your free consultation", "Comment 'INFO' below"
- The CTA should feel natural and actionable, not generic
- Use emojis sparingly but effectively
- The caption should feel authentic, not generic
- The caption MUST be written in ${lang}`;
    }

    const userMessage = isScript
      ? `Write a teleprompter script about: ${prompt}\n\nREMINDER: The ENTIRE script must be written in ${lang}. Do NOT use English unless the language is English.`
      : `Write a caption for this image. The image shows: ${prompt}\n\nREMINDER: The ENTIRE caption and hashtags must be written in ${lang}. Do NOT use English unless the language is English.`;

    const captionRequestBody = JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
    });

    let aiResponse: Response | null = null;
    const MAX_RETRIES = 5;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: captionRequestBody,
      });
      if (aiResponse.status !== 429) break;
      console.log(`Caption AI rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying...`);
      if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, 3000 * Math.pow(2, attempt)));
    }

    if (!aiResponse!.ok) {
      const status = aiResponse!.status;
      if (status === 429) {
        return new Response(JSON.stringify({
          ok: false,
          errorType: "rate_limit",
          error: "AI rate limit exceeded. Please try again in a moment.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({
          ok: false,
          errorType: "credits_exhausted",
          error: "AI credits exhausted. Please contact admin.",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse!.text();
      console.error("AI error:", status, errText);
      throw new Error("Caption generation failed");
    }

    const aiData = await aiResponse!.json();
    const caption = aiData.choices?.[0]?.message?.content;

    if (!caption) {
      console.error("No caption in AI response:", JSON.stringify(aiData).slice(0, 500));
      throw new Error("No caption generated");
    }

    return new Response(
      JSON.stringify({ ok: true, caption }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-caption error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
