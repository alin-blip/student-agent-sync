import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(hons?\)/gi, "")
    .replace(/\b(bsc|ba|msc|ma|hnd|btec|higher national diploma)\b/gi, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCourseMatch(
  extractedName: string,
  courses: { id: string; name: string; normalized: string }[]
): string | null {
  const extNorm = normalize(extractedName);

  for (const c of courses) {
    if (c.normalized === extNorm) return c.id;
  }
  for (const c of courses) {
    if (c.normalized.includes(extNorm) || extNorm.includes(c.normalized)) return c.id;
  }

  const extWords = extNorm.split(" ").filter((w) => w.length > 2);
  let bestScore = 0;
  let bestId: string | null = null;
  for (const c of courses) {
    const cWords = c.normalized.split(" ").filter((w) => w.length > 2);
    const matchCount = extWords.filter((w) => cWords.includes(w)).length;
    // Use smaller set as denominator so partial matches work better
    const score = matchCount / Math.min(extWords.length, cWords.length);
    if (score > bestScore && score >= 0.5 && matchCount >= 2) {
      bestScore = score;
      bestId = c.id;
    }
  }
  return bestId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    if (!firecrawlKey || !lovableKey) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is owner/admin
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles").select("role").eq("user_id", user.id).single();

    if (!roleData || !["owner", "admin"].includes(roleData.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { university_id, university_url, force } = await req.json();
    if (!university_id || !university_url) {
      return new Response(
        JSON.stringify({ error: "university_id and university_url required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scanning details for uni ${university_id} at ${university_url}`);

    // Step 1: Find courses without details
    const { data: allCourses } = await adminClient
      .from("courses").select("id, name").eq("university_id", university_id).eq("is_active", true);

    if (!allCourses?.length) {
      return new Response(
        JSON.stringify({ success: true, message: "No active courses", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let missingCourses: typeof allCourses;

    if (force) {
      // Force mode: re-scan ALL courses
      missingCourses = allCourses;
      console.log(`Force mode: scanning all ${allCourses.length} courses`);
    } else {
      const { data: existingDetails } = await adminClient
        .from("course_details").select("course_id").in("course_id", allCourses.map((c) => c.id));

      const existingIds = new Set((existingDetails || []).map((d) => d.course_id));
      missingCourses = allCourses.filter((c) => !existingIds.has(c.id));

      if (missingCourses.length === 0) {
        return new Response(
          JSON.stringify({ success: true, message: "All courses already have details. Use force=true to rescan.", updated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const coursesWithNorm = missingCourses.map((c) => ({ ...c, normalized: normalize(c.name) }));
    console.log(`Found ${missingCourses.length} courses without details`);

    // Step 2: Use Firecrawl SEARCH to find relevant pages, then scrape top results
    const hostname = new URL(university_url).hostname;
    const searchQueries = [
      `site:${hostname} courses entry requirements admission`,
    ];

    // Add per-course searches (batch in groups of 2-3 course names)
    const batchSize = 2;
    for (let i = 0; i < missingCourses.length; i += batchSize) {
      const batch = missingCourses.slice(i, i + batchSize);
      const courseTerms = batch.map(c => {
        const key = normalize(c.name).split(" ").filter(w => w.length > 3).slice(0, 4).join(" ");
        return `"${key}"`;
      }).join(" OR ");
      searchQueries.push(`site:${hostname} ${courseTerms} entry requirements`);
    }

    const scrapedContent: string[] = [];
    const seenUrls = new Set<string>();

    for (const query of searchQueries) {
      try {
        console.log(`Searching: ${query.slice(0, 120)}`);
        const res = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query,
            limit: 8,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          for (const r of (data?.data || [])) {
            if (r?.url && !seenUrls.has(r.url) && (r?.markdown || "").length > 200) {
              seenUrls.add(r.url);
              scrapedContent.push(`--- ${r.url} ---\n${(r.markdown as string).slice(0, 4000)}`);
            }
          }
        } else {
          console.error(`Search failed (${res.status}):`, await res.text().catch(() => ""));
        }
      } catch (e) {
        console.error(`Search error:`, e);
      }
    }

    console.log(`Got content from ${scrapedContent.length} pages via search`);

    if (scrapedContent.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No course pages found on site", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: AI extraction - keep combined content under 60K chars
    const combinedContent = scrapedContent.join("\n\n").slice(0, 60000);
    const courseNamesList = missingCourses.map((c) => `- "${c.name}"`).join("\n");

    const aiPrompt = `Extract course admission details from the scraped university website content below.

COURSES (use these EXACT names in output):
${courseNamesList}

For each course found, extract:
1. entry_requirements - Academic qualifications, grades, UCAS points needed
2. admission_test_info - Any tests required (null if none)
3. interview_info - Interview details (null if none)
4. documents_required - Required documents
5. personal_statement_guidelines - PS tips (null if none)
6. additional_info - DBS, placements, travel limits etc. (null if none)

RULES:
- Use EXACT course names from my list
- If info applies to multiple courses, include for each
- If no info found for a course, skip it entirely
- Return ONLY a valid JSON array, no markdown formatting

WEBSITE CONTENT:
${combinedContent}`;

    console.log(`Calling AI with ${combinedContent.length} chars of content for ${missingCourses.length} courses...`);

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You extract structured course admission details from university websites. Return valid JSON arrays only.",
          },
          { role: "user", content: aiPrompt },
        ],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      return new Response(
        JSON.stringify({ error: "AI extraction failed", details: errText.slice(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    let extractedCourses: any[];
    try {
      const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error("No JSON array found in AI response");
      extractedCourses = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error("Failed to parse AI response:", rawContent.slice(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse AI response", raw: rawContent.slice(0, 300) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`AI returned ${extractedCourses.length} courses`);

    // Step 4: Upsert with fuzzy matching
    let totalUpdated = 0;
    const updatedNames: string[] = [];
    const matchedIds = new Set<string>();

    for (const ext of extractedCourses) {
      if (!ext.course_name) continue;

      const courseId = findCourseMatch(ext.course_name, coursesWithNorm);
      if (!courseId || matchedIds.has(courseId)) {
        if (!courseId) console.log(`No match for: "${ext.course_name}"`);
        continue;
      }

      const hasContent = [
        ext.entry_requirements, ext.admission_test_info, ext.interview_info,
        ext.documents_required, ext.personal_statement_guidelines, ext.additional_info,
      ].some((v) => v && typeof v === "string" && v.trim());

      if (!hasContent) continue;

      const { error } = await adminClient.from("course_details").upsert(
        {
          course_id: courseId,
          entry_requirements: ext.entry_requirements || null,
          admission_test_info: ext.admission_test_info || null,
          interview_info: ext.interview_info || null,
          documents_required: ext.documents_required || null,
          personal_statement_guidelines: ext.personal_statement_guidelines || null,
          additional_info: ext.additional_info || null,
        },
        { onConflict: "course_id" }
      );

      if (error) {
        console.error(`Upsert error for ${ext.course_name}:`, error);
      } else {
        totalUpdated++;
        matchedIds.add(courseId);
        updatedNames.push(missingCourses.find((c) => c.id === courseId)?.name || ext.course_name);
      }
    }

    console.log(`Done! Updated ${totalUpdated}/${missingCourses.length}: ${updatedNames.join(", ")}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Extracted details for ${totalUpdated} out of ${missingCourses.length} courses`,
        updated: totalUpdated,
        total_missing: missingCourses.length,
        updated_courses: updatedNames,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
