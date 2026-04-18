import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { dataUrlToBytes } from "./image-composition.ts";
import { runPromptAgent } from "./prompt-agent.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check user role for limit bypass
    const { data: roleRow } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const isOwner = roleRow?.role === "owner";

    const { prompt, preset, includePhoto, timezone, language, courseId, previousImageUrl, editInstruction } = await req.json();
    if (!prompt || !preset) throw new Error("Missing prompt or preset");

    // Daily limit check
    const DAILY_LIMIT = 5;
    let currentCount = 0;
    if (!isOwner) {
      const tz = timezone || "Europe/Bucharest";
      const now = new Date();
      const utcStr = now.toLocaleString("en-US", { timeZone: "UTC" });
      const tzStr = now.toLocaleString("en-US", { timeZone: tz });
      const offsetMs = new Date(tzStr).getTime() - new Date(utcStr).getTime();
      const todayInTz = new Date(now.getTime() + offsetMs);
      todayInTz.setHours(0, 0, 0, 0);
      const todayUtc = new Date(todayInTz.getTime() - offsetMs);

      const { count } = await adminClient
        .from("generated_images")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", todayUtc.toISOString());

      currentCount = count ?? 0;
      if (currentCount >= DAILY_LIMIT) {
        return new Response(
          JSON.stringify({
            ok: false,
            errorType: "daily_limit",
            error: `Daily limit reached (${DAILY_LIMIT}/${DAILY_LIMIT}). Try again tomorrow.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const remainingCount = isOwner ? 999 : DAILY_LIMIT - (currentCount + 1);

    // Fetch brand settings & profile
    const [{ data: brand }, { data: profile }] = await Promise.all([
      adminClient.from("brand_settings").select("*").limit(1).single(),
      adminClient.from("profiles").select("avatar_url, full_name").eq("id", user.id).single(),
    ]);

    // Build course context string
    let courseContext = "";
    if (courseId) {
      const [{ data: courseRow }, { data: detailsRow }] = await Promise.all([
        adminClient.from("courses").select("name, level, study_mode, duration, fees").eq("id", courseId).single(),
        adminClient.from("course_details").select("entry_requirements, documents_required").eq("course_id", courseId).single(),
      ]);
      if (courseRow) {
        courseContext = `Course: ${courseRow.name}, Level: ${courseRow.level}, Study Mode: ${courseRow.study_mode}, Duration: ${courseRow.duration || "N/A"}, Fees: ${courseRow.fees || "N/A"}`;
        if (detailsRow?.entry_requirements) courseContext += `, Entry Requirements: ${detailsRow.entry_requirements}`;
      }
    }

    const lang = language || "English";
    const isEditMode = !!previousImageUrl && !!editInstruction;

    let agentOutput: any = null;

    if (!isEditMode) {
      // ═══════════════════════════════════════════════════════
      // STEP 1: Prompt Agent — generate structured marketing copy
      // ═══════════════════════════════════════════════════════
      console.log("Step 1: Running prompt agent...");
      agentOutput = await runPromptAgent(
        {
          userPrompt: prompt,
          language: lang,
          preset,
          brandPrompt: brand?.brand_prompt || undefined,
          courseContext: courseContext || undefined,
          includePhoto: !!includePhoto,
          agentName: profile?.full_name || undefined,
        },
        LOVABLE_API_KEY
      );
      console.log("Step 1 complete:", JSON.stringify(agentOutput).slice(0, 300));
    }

    // ═══════════════════════════════════════════════════════
    // STEP 2: Image Generation / Edit
    // ═══════════════════════════════════════════════════════
    const presetDimensions: Record<string, string> = {
      social_post: "1080x1080 square",
      story: "1080x1920 vertical",
      flyer: "A5 portrait (1240x1754)",
      banner: "1200x628 horizontal",
    };

    let aiRequestBody: string;

    if (isEditMode) {
      const editPrompt = `ABSOLUTE RULE: Do NOT draw any people, faces, human figures, silhouettes, or portraits anywhere in the image. The image must contain ZERO humans.
ABSOLUTE RULE: Do NOT render any text that reads "LOGO", "WATERMARK", "Headline", "Subheadline", "Bullet", "Primary text", "Supporting text", or any colon-prefixed label or placeholder text.

Edit this marketing image according to these instructions: ${editInstruction}

RULES:
- Keep the overall layout and style consistent
- Apply ONLY the requested changes
- Text must be in ${lang} with perfect spelling and diacritics
${includePhoto ? "- Keep bottom-left corner clean and empty" : ""}
- Do NOT add any people, faces, or human figures
- Do NOT write the word "LOGO", "Headline:", "Subheadline:", "Bullet:", or any placeholder/label/watermark text
- Only render the actual marketing copy itself — never render field names or labels`;

      aiRequestBody = JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: editPrompt },
            { type: "image_url", image_url: { url: previousImageUrl } },
          ],
        }],
        modalities: ["image", "text"],
      });
    } else {
      const bulletsBlock = agentOutput!.bullets.length > 0
        ? `\nSHORT POINTS (small list, below supporting text, render with bullet marks):\n${agentOutput!.bullets.map((b: string) => `  • "${b}"`).join("\n")}`
        : "";

      const imagePrompt = `ABSOLUTE RULE: Do NOT draw any people, faces, human figures, silhouettes, or portraits anywhere in the image. The image must contain ZERO humans.
ABSOLUTE RULE: Do NOT render any text that reads "LOGO", "WATERMARK", "Headline", "Subheadline", "Headline:", "Subheadline:", "Bullet", "Bullets", "Primary text", "Supporting text", or any colon-prefixed label, field name, or placeholder text. Only the quoted marketing copy below may appear as visible text.

Create a ${presetDimensions[preset] || "1080x1080 square"} marketing image.

VISUAL STYLE: ${agentOutput!.visual_description}

TEXT TO RENDER ON THE IMAGE — render ONLY the quoted strings below, EXACTLY character-by-character. Do NOT render the field names ("PRIMARY TEXT", "SUPPORTING TEXT", "SHORT POINTS"). Do NOT add labels, prefixes, colons, or any extra words. Do NOT translate or rephrase.

PRIMARY TEXT (largest, top of composition): "${agentOutput!.headline}"
SUPPORTING TEXT (medium size, directly below primary): "${agentOutput!.subheadline}"${bulletsBlock}

TYPOGRAPHY & LAYOUT RULES:
- Single harmonious sans-serif font family throughout
- Primary text: bold, largest, highest contrast against background
- Supporting text: medium weight, ~50% the size of primary text
- Short points (if any): small, tight line spacing, simple "•" bullet marks
- Minimum margin from every edge: 8% of the image
- Text must NOT overlap faces, logos, or focal objects in the background visual
- Clean hierarchy: primary > supporting > points
${agentOutput!.layout_notes}
${includePhoto ? `- Keep the bottom-left corner clean and empty (reserved for an avatar overlay).` : ""}
- Composition: ~70% visual, ~30% text. Modern, professional, intentional.
- Do NOT draw placeholder text like "LOGO", "YOUR BRAND HERE", "Headline:", "Subheadline:", or any field labels.`;

      aiRequestBody = JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      });
    }

    console.log(`Step 2: ${isEditMode ? "Editing" : "Generating"} image...`);

    // Add delay between Step 1 and Step 2 to avoid rate limits
    if (!isEditMode) {
      await new Promise(r => setTimeout(r, 5000));
    }

    let aiResponse: Response | null = null;
    const MAX_RETRIES = 4;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: aiRequestBody,
      });
      if (aiResponse.status !== 429) break;
      const delay = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s, 40s
      console.log(`AI rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay/1000}s...`);
      if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, delay));
    }

    if (!aiResponse!.ok) {
      const status = aiResponse!.status;
      let errorType = "generation_failed";
      let errorMsg = "AI generation failed";
      let retryAfter = 0;
      if (status === 429) { errorType = "rate_limit"; errorMsg = "AI is busy right now. I'll retry automatically..."; retryAfter = 15; }
      if (status === 402) { errorType = "credits_exhausted"; errorMsg = "AI credits exhausted. Please contact admin."; }
      return new Response(
        JSON.stringify({ ok: false, errorType, error: errorMsg, retryAfter }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse!.json();
    const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      console.error("No image in AI response:", JSON.stringify(aiData).slice(0, 500));
      return new Response(
        JSON.stringify({ ok: false, error: "No image generated" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upload to storage
    const binaryData = dataUrlToBytes(imageBase64);
    const fileName = `${user.id}/${Date.now()}_${preset}.png`;
    const { error: uploadErr } = await adminClient.storage
      .from("generated-images")
      .upload(fileName, binaryData, { contentType: "image/png", upsert: false });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      return new Response(
        JSON.stringify({ ok: false, error: "Failed to save image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: publicUrl } = adminClient.storage.from("generated-images").getPublicUrl(fileName);

    // Save record
    await adminClient.from("generated_images").insert({
      user_id: user.id,
      prompt,
      preset,
      image_path: fileName,
    });

    // Return the generated text along with the image for client-side review
    let avatarUrl: string | null = null;
    if (includePhoto) {
      if (!profile?.avatar_url) {
        // Image already generated, just skip avatar overlay
        avatarUrl = null;
      } else {
        avatarUrl = profile.avatar_url;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        url: publicUrl.publicUrl,
        avatarUrl,
        remaining: remainingCount,
        isEdit: isEditMode,
        generatedText: agentOutput ? {
          headline: agentOutput.headline,
          subheadline: agentOutput.subheadline,
          bullets: agentOutput.bullets,
        } : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
