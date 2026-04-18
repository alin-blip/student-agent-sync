import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRAME_PATH = "profile-frame-v1.png";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const body = await req.json().catch(() => ({}));
    const forceRegenerate = body.regenerate === true;

    // Check cache first
    if (!forceRegenerate) {
      const { data: existingFile } = await adminClient.storage
        .from("brand-assets")
        .list("", { search: FRAME_PATH });

      if (existingFile && existingFile.length > 0) {
        const { data: publicUrl } = adminClient.storage
          .from("brand-assets")
          .getPublicUrl(FRAME_PATH);
        return new Response(
          JSON.stringify({ url: publicUrl.publicUrl, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Fetch the brand icon to send as reference
    const iconUrl = `${SUPABASE_URL}/storage/v1/object/public/brand-assets/eduforyou-logo.png`;
    let iconBase64Url: string | null = null;

    try {
      const iconRes = await fetch(iconUrl);
      if (iconRes.ok) {
        const iconBytes = new Uint8Array(await iconRes.arrayBuffer());
        // Chunk the conversion to avoid stack overflow
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < iconBytes.length; i += chunkSize) {
          binary += String.fromCharCode(...iconBytes.slice(i, i + chunkSize));
        }
        const iconB64 = btoa(binary);
        const contentType = iconRes.headers.get("content-type") || "image/jpeg";
        iconBase64Url = `data:${contentType};base64,${iconB64}`;
      }
    } catch (e) {
      console.error("Failed to fetch icon:", e);
    }

    const prompt = `Create a 1080x1080 pixel circular profile picture frame overlay PNG image with TRANSPARENT background.

ABSOLUTE REQUIREMENT — TRANSPARENCY:
- The ENTIRE background must be fully transparent (alpha = 0)
- The CENTER circle must be COMPLETELY TRANSPARENT — this is where a photo will be composited underneath
- Only the ring border, top badge, and bottom badge should have visible pixels
- Everything else = transparent PNG

RING DESIGN:
- A THIN elegant circular ring/border, approximately 40-50px wide (NOT thick, keep it slim and refined)
- The ring should be positioned at the OUTER EDGE of the 1080x1080 canvas, maximizing the transparent center
- Inner radius approximately 490px from center (leaving maximum space for the photo)
- Luxurious gradient from deep orange (#E8600A) to warm amber (#F2A03D) with subtle gold highlights
- Subtle inner glow and soft shine — minimal, elegant, not overdone
- The ring should feel thin, premium, and simple

TOP BADGE — LOGO AREA:
- At the top center, overlapping the ring, place a compact pill-shaped badge
- Inside: reproduce the EXACT icon from the attached reference image (orange pen with graduation cap) on the left
- Next to the icon: "EduForYou" in clean, bold, modern font
- White/cream background with subtle shadow, compact size
- Should sit ON TOP of the ring, partially overlapping

BOTTOM BADGE — CERTIFICATION:
- At the bottom center, overlapping the ring, a slim premium banner
- Text: "CERTIFIED AGENT" in elegant uppercase
- Dark navy background (#1A1A2E) with subtle gold star accents on each side
- Thin, compact pill shape — not bulky
- Should sit ON TOP of the ring, partially overlapping

STYLE:
- Minimalist, clean, premium — think simple luxury, not busy
- NO background fill, NO circular background — ONLY the ring line and two badges
- The transparent center should be as LARGE as possible
- PNG with alpha transparency is CRITICAL`;


    const messageContent: any[] = [
      { type: "text", text: prompt },
    ];

    if (iconBase64Url) {
      messageContent.push({
        type: "image_url",
        image_url: { url: iconBase64Url },
      });
    }

    console.log("Generating profile frame overlay...");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image-preview",
        messages: [{ role: "user", content: messageContent }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const imageBase64 = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    if (!imageBase64) {
      console.error("No image in AI response:", JSON.stringify(aiData).slice(0, 500));
      throw new Error("No image generated");
    }

    // Extract and upload
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const { error: uploadErr } = await adminClient.storage
      .from("brand-assets")
      .upload(FRAME_PATH, binaryData, { contentType: "image/png", upsert: true });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      throw new Error("Failed to save frame");
    }

    const { data: publicUrl } = adminClient.storage
      .from("brand-assets")
      .getPublicUrl(FRAME_PATH);

    console.log("Frame generated and cached:", publicUrl.publicUrl);

    return new Response(
      JSON.stringify({ url: publicUrl.publicUrl, cached: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-profile-frame error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
