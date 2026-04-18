import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

// This is a placeholder for OpenAI API call. In a real scenario, you would use an actual OpenAI client.
// For this task, we will simulate the response.
async function callOpenAI(prompt: string): Promise<any> {
  console.log("OpenAI Prompt:", prompt);
  // Simulate a response from OpenAI
  const simulatedResponse = {
    choices: [
      {
        message: {
          content: JSON.stringify([
            {
              sequence_number: 1,
              subject: "Your Future in the UK: Explore Funded University Courses!",
              body_html: `<p>Hi {{contact_name}},</p><p>Are you ready to take the next step in your academic journey? EduForYou, in partnership with {{company_name}}, is excited to offer you an incredible opportunity to study at the University of London, Royal Holloway, on the BSc Computer Science course.</p><p>This program is designed for ambitious individuals like you, offering a comprehensive curriculum and a vibrant campus experience. The best part? It's fully funded, so you can focus on your studies without financial worries.</p><p>Learn more and apply here: <a href=\"{{apply_link}}\">{{apply_link}}</a></p><p>Best regards,</p><p>The {{company_name}} Team</p>`,
              body_text: `Hi {{contact_name}},\n\nAre you ready to take the next step in your academic journey? EduForYou, in partnership with {{company_name}}, is excited to offer you an incredible opportunity to study at the University of London, Royal Holloway, on the BSc Computer Science course.\n\nThis program is designed for ambitious individuals like you, offering a comprehensive curriculum and a vibrant campus experience. The best part? It's fully funded, so you can focus on your studies without financial worries.\n\nLearn more and apply here: {{apply_link}}\n\nBest regards,\nThe {{company_name}} Team`,
            },
            {
              sequence_number: 2,
              subject: "Don't Miss Out: Funded Computer Science at Royal Holloway!",
              body_html: `<p>Hi {{contact_name}},</p><p>Just a friendly reminder about the amazing opportunity to study BSc Computer Science at Royal Holloway, University of London, with full funding through EduForYou.</p><p>This course offers a unique blend of theoretical knowledge and practical skills, preparing you for a successful career in technology. Imagine studying in a world-class institution without the burden of tuition fees!</p><p>Spaces are limited, so we encourage you to explore this option soon. Click here to find out more: <a href=\"{{apply_link}}\">{{apply_link}}</a></p><p>Warmly,</p><p>The {{company_name}} Team</p>`,
              body_text: `Hi {{contact_name}},\n\nJust a friendly reminder about the amazing opportunity to study BSc Computer Science at Royal Holloway, University of London, with full funding through EduForYou.\n\nThis course offers a unique blend of theoretical knowledge and practical skills, preparing you for a successful career in technology. Imagine studying in a world-class institution without the burden of tuition fees!\n\nSpaces are limited, so we encourage you to explore this option soon. Click here to find out more: {{apply_link}}\n\nWarmly,\nThe {{company_name}} Team`,
            },
          ]),
        },
      },
    ],
  };
  return simulatedResponse;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { "X-Client-Info": "supabase-functions-generate-email-sequence" } } },
  );

  try {
    const {
      university_id,
      campus_id,
      course_id,
      audience,
      tone,
      email_count,
      company_name,
      branch_name,
      apply_link,
      contact_name,
    } = await req.json();

    if (!university_id || !campus_id || !course_id || !audience || !tone) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Fetch course details
    const { data: course, error: courseError } = await supabaseClient
      .from("courses")
      .select("name, description, duration, timetable, campuses(name, universities(name))")
      .eq("id", course_id)
      .single();

    if (courseError || !course) {
      console.error("Error fetching course details:", courseError);
      return new Response("Course not found", { status: 404 });
    }

    const universityName = course.campuses?.universities?.name || "";
    const campusName = course.campuses?.name || "";
    const courseName = course.name;
    const courseDescription = course.description;
    const courseDuration = course.duration;
    const courseTimetable = course.timetable;

    const prompt = `Generate ${email_count} ${tone} email(s) for a ${audience} audience. The emails should promote the ${courseName} course at ${universityName}, ${campusName}.\n\nCourse Details:\n- Name: ${courseName}\n- Description: ${courseDescription}\n- Duration: ${courseDuration}\n- Timetable: ${courseTimetable}\n\nThe emails should mention that EduForYou, in partnership with ${company_name}${branch_name ? ` (via ${branch_name})` : ""}, offers this opportunity. They should encourage the recipient to apply via this link: ${apply_link}.\n\nUse placeholders for dynamic content: {{contact_name}}, {{company_name}}, {{apply_link}}. The output should be a JSON array of objects, each with 'sequence_number', 'subject', 'body_html', and 'body_text' fields.`;

    // Call OpenAI (simulated)
    const openaiResponse = await callOpenAI(prompt);
    const emails_json = openaiResponse.choices[0].message.content;

    return new Response(JSON.stringify({ emails_json }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Request error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
