/**
 * Step 1: Prompt Agent — uses a text model to refine user input into
 * structured, spell-checked marketing copy + visual description.
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface PromptAgentInput {
  userPrompt: string;
  language: string;
  preset: string;
  brandPrompt?: string;
  courseContext?: string;
  includePhoto: boolean;
  agentName?: string;
}

interface PromptAgentOutput {
  headline: string;
  subheadline: string;
  bullets: string[];
  visual_description: string;
  layout_notes: string;
}

export async function runPromptAgent(
  input: PromptAgentInput,
  apiKey: string
): Promise<PromptAgentOutput> {
  const {
    userPrompt,
    language,
    preset,
    brandPrompt,
    courseContext,
    includePhoto,
    agentName,
  } = input;

  const presetDescriptions: Record<string, string> = {
    social_post: "1080×1080 square social media post (Instagram/Facebook)",
    story: "1080×1920 vertical story (Instagram/Facebook stories)",
    flyer: "A5 portrait flyer (print-ready, professional)",
    banner: "1200×628 horizontal banner (web/social headers)",
  };

  const presetDesc = presetDescriptions[preset] || presetDescriptions.social_post;

  const systemPrompt = `You are a senior marketing copywriter for EduForYou, a UK-based education consultancy. Your job is to take a creative brief and produce PERFECT marketing text and a visual description for an AI image generator.

CRITICAL RULES:
1. ALL text you write MUST be in ${language}. Every headline, subheadline, and bullet point MUST be in ${language}.
2. NEVER include any university name — only use course names or fields of study.
3. NEVER use the word "free" or imply anything is free. Student finance is a LOAN repaid after graduation.
4. NEVER say "our courses", "our programs" — use "the course", "this program".
5. Spelling and grammar must be PERFECT in ${language}, especially diacritics (ă, ț, î, ș for Romanian).
6. The user's input is a CREATIVE BRIEF — do NOT copy it verbatim. Create your own professional marketing text.

TEXT STRUCTURE (mandatory):
- headline: Bold, attention-grabbing (max 8 words in ${language})
- subheadline: Supporting context (max 15 words in ${language})  
- bullets: Up to 5 short points (max 6 words each in ${language}). Can be empty array if not needed.

VISUAL DESCRIPTION:
- Describe the image style: colors, mood, layout, background elements
- The image should be 70% visual, 30% text
- Format: ${presetDesc}
- CRITICAL RULE — NO PEOPLE: The visual description must NEVER include any people, faces, human figures, silhouettes, or portraits. The image must be purely graphic/abstract with text overlay.
${includePhoto ? `- The bottom-left corner must be clean and unobstructed — a real photo will be composited there afterward.` : ""}
${brandPrompt ? `\nBrand guidelines: ${brandPrompt}` : ""}
${courseContext ? `\nCourse context (use real details): ${courseContext}` : ""}

Respond with a JSON object matching this exact structure:
{
  "headline": "...",
  "subheadline": "...",
  "bullets": ["...", "..."],
  "visual_description": "...",
  "layout_notes": "..."
}`;

  let response: Response | null = null;
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    response = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_marketing_content",
              description: "Create structured marketing content for image generation",
              parameters: {
                type: "object",
                properties: {
                  headline: { type: "string", description: `Bold headline, max 8 words, in ${language}` },
                  subheadline: { type: "string", description: `Supporting subheadline, max 15 words, in ${language}` },
                  bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: `Up to 5 short bullet points (max 6 words each) in ${language}. Can be empty.`,
                  },
                  visual_description: {
                    type: "string",
                    description: "Detailed visual description for the image generator: colors, mood, layout, background",
                  },
                  layout_notes: {
                    type: "string",
                    description: "Notes about text placement and reserved areas",
                  },
                },
                required: ["headline", "subheadline", "bullets", "visual_description", "layout_notes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_marketing_content" } },
      }),
    });
    if (response!.status !== 429) break;
    const delay = 4000 * Math.pow(2, attempt);
    console.log(`Prompt agent rate limited (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${delay/1000}s...`);
    if (attempt < MAX_RETRIES - 1) await new Promise(r => setTimeout(r, delay));
  }

  if (!response!.ok) {
    const text = await response!.text();
    console.error("Prompt agent error:", response!.status, text);
    throw new Error(`Prompt agent failed (${response!.status})`);
  }

  const data = await response!.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) {
    console.error("No tool call in prompt agent response:", JSON.stringify(data).slice(0, 500));
    throw new Error("Prompt agent did not return structured output");
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  return {
    headline: parsed.headline || "",
    subheadline: parsed.subheadline || "",
    bullets: parsed.bullets || [],
    visual_description: parsed.visual_description || "",
    layout_notes: parsed.layout_notes || "",
  };
}
