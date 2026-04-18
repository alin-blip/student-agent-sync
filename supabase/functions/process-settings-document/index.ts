import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "npm:xlsx@0.18.5";
import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const schemaByType: Record<string, string> = {
  courses: `Return a JSON array of objects with: name (string), level (one of: undergraduate, postgraduate, foundation), study_mode (one of: blended, online, on-campus, part-time, full-time). Example: [{"name":"BSc Computer Science","level":"undergraduate","study_mode":"blended"}]`,
  timetable: `Return a JSON array of objects with: label (string – the group/pattern name with day and times). Example: [{"label":"Group A – Monday 9am-1pm"},{"label":"Group B – Tuesday 2pm-6pm"}]`,
  campuses: `Return a JSON array of objects with: name (string), city (string or null). Example: [{"name":"Main Campus","city":"London"}]`,
  intakes: `Return a JSON array of objects with: label (string), start_date (YYYY-MM-DD), application_deadline (YYYY-MM-DD or null). Example: [{"label":"September 2026","start_date":"2026-09-15","application_deadline":"2026-08-01"}]`,
  course_timetable: `You are extracting a matrix that maps courses to their available timetable groups per campus/location.
Return a JSON array of objects with: course_name (string - the full course name), campus (string - the campus/location name like "East London", "West London", "Birmingham", "Manchester", "Leeds"), groups (array of single-letter group codes like ["A","B","C","K","N","E","P","G"]).
Each combination of course + campus should be a separate object. Only include entries where groups are actually listed (not empty).
The groups are typically single letters (A, B, C, E, K, N, P, G etc.) that correspond to timetable schedules.
Also look for the provider/university name associated with each course.
Example: [{"course_name":"BSc (Hons) Computing with Foundation Year","campus":"East London","groups":["A","K","N"]},{"course_name":"BSc (Hons) Computing with Foundation Year","campus":"West London","groups":["B","C","K"]}]`,
  course_details: `You are extracting detailed course requirement information from a university/college document.
Return a JSON array of objects with: course_name (string - the full course name),
personal_statement_guidelines (string or null - word count, topics to cover, specific requirements),
admission_test_info (string or null - test times, number of attempts, format, what is tested),
interview_info (string or null - on-campus/online, process, preparation, forms to complete),
entry_requirements (string or null - qualifications needed, work experience, age requirements, alternative routes),
documents_required (string or null - list of all documents needed for application),
additional_info (string or null - travel time limits, DBS checks, SFE requirements, any other important info).
Extract ALL sections from the document, preserving specific details like word counts, times, number of attempts, qualification levels, years of experience, travel time limits etc.
If information applies to all courses in the document, repeat it for each course.
Example: [{"course_name":"BSc (Hons) Computing","personal_statement_guidelines":"150 words covering: why this course, long-term goals, relevant experience","admission_test_info":"Tests at 10:30 AM and 2:00 PM, 3 chances to pass","interview_info":"On campus, online only in exceptional cases","entry_requirements":"Level 3 qualification or Level 2 + 1 year work experience for 21+","documents_required":"Passport, CV (3 years work experience), NINO, Proof of address, Share Code","additional_info":"Max 1.5 hours travel time from postcode to campus, DBS check required"}]`,
};

/**
 * Parse an XLSX/XLS file from base64 and return all sheets as readable text.
 * Each sheet is formatted as a markdown-style table for the AI to parse.
 */
function parseSpreadsheet(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const workbook = XLSX.read(bytes, { type: "array" });

  const parts: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert to array of arrays
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
    if (rows.length === 0) continue;

    parts.push(`\n=== Sheet: ${sheetName} ===`);
    for (const row of rows) {
      const line = row.map((cell: any) => String(cell ?? "").trim()).join(" | ");
      if (line.replace(/\|/g, "").trim()) {
        parts.push(line);
      }
    }
  }

  return parts.join("\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { file_base64, file_type, document_type } = await req.json();

    if (!file_base64 || !document_type) {
      return new Response(JSON.stringify({ success: false, error: "Missing file or document_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const schema = schemaByType[document_type];
    if (!schema) {
      return new Response(JSON.stringify({ success: false, error: "Invalid document_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a document data extractor for a UK education platform. Extract structured data from the uploaded document.
Document type: ${document_type}
${schema}
IMPORTANT: Return ONLY the JSON array. No markdown, no explanation, no code fences. Just the raw JSON array.
If you cannot find any relevant data, return an empty array [].`;

    // Determine media type for the content
    const isImage = file_type?.startsWith("image/");
    const isPdf = file_type === "application/pdf";
    const isSpreadsheet = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "application/xlsx",
    ].includes(file_type) || file_type?.includes("spreadsheet") || file_type?.includes("excel");
    const isDocx = file_type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || file_type === "application/docx"
      || file_type?.includes("wordprocessingml");

    // Build the user message content
    const userContent: any[] = [];

    if (isImage) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${file_type};base64,${file_base64}` },
      });
      userContent.push({ type: "text", text: "Extract the structured data from this image." });
    } else if (isPdf) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:application/pdf;base64,${file_base64}` },
      });
      userContent.push({ type: "text", text: "Extract the structured data from this PDF document." });
    } else if (isDocx) {
      // Parse DOCX server-side: extract text from word/document.xml
      try {
        const bytes = Uint8Array.from(atob(file_base64), (c) => c.charCodeAt(0));
        const zip = await JSZip.loadAsync(bytes);
        const docXml = await zip.file("word/document.xml")?.async("string");
        if (!docXml) {
          return new Response(JSON.stringify({ success: false, error: "Invalid DOCX file – no document.xml found." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Strip XML tags, keep text content
        const textContent = docXml
          .replace(/<w:br[^>]*\/>/gi, "\n")
          .replace(/<\/w:p>/gi, "\n")
          .replace(/<\/w:tr>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        if (!textContent) {
          return new Response(JSON.stringify({ success: false, error: "DOCX appears to be empty." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userContent.push({
          type: "text",
          text: `Extract the structured data from this document content:\n\n${textContent.substring(0, 50000)}`,
        });
      } catch (parseErr) {
        console.error("DOCX parse error:", parseErr);
        return new Response(JSON.stringify({ success: false, error: "Failed to parse DOCX. Please ensure it's a valid .docx file." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (isSpreadsheet) {
      // Parse XLSX/XLS server-side into text, then send as text prompt
      try {
        const textContent = parseSpreadsheet(file_base64);
        if (!textContent.trim()) {
          return new Response(JSON.stringify({ success: false, error: "Spreadsheet appears to be empty." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        userContent.push({
          type: "text",
          text: `Extract the structured data from this spreadsheet content:\n\n${textContent.substring(0, 50000)}`,
        });
      } catch (parseErr) {
        console.error("XLSX parse error:", parseErr);
        return new Response(JSON.stringify({ success: false, error: "Failed to parse spreadsheet. Please ensure it's a valid XLSX/XLS file." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ success: false, error: "Unsupported file type. Please upload a PDF, DOCX, image (JPG, PNG), or spreadsheet (XLSX, XLS)." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const rawContent = aiResult.choices?.[0]?.message?.content || "[]";

    // Parse the JSON array from AI response
    let items: any[];
    try {
      // Remove potential markdown fences
      const cleaned = rawContent.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      items = JSON.parse(cleaned);
      if (!Array.isArray(items)) items = [];
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      items = [];
    }

    return new Response(JSON.stringify({ success: true, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-settings-document error:", e);
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
