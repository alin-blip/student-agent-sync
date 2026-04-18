import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  nationality: z.string().trim().max(100).optional().or(z.literal("")),
  universityId: z.string().uuid().optional().or(z.literal("")),
  campusId: z.string().uuid().optional().or(z.literal("")),
  courseId: z.string().uuid().optional().or(z.literal("")),
  intakeId: z.string().uuid().optional().or(z.literal("")),
  timetableOption: z.string().trim().max(100).optional().or(z.literal("")),
  gdprConsent: z.literal(true),
  origin: z.string().url().optional(),
});

const normalizeOptional = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      slug,
      firstName,
      lastName,
      email,
      phone,
      nationality,
      universityId,
      campusId,
      courseId,
      intakeId,
      timetableOption,
      origin,
    } = parsed.data;

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const { data: publicProfile, error: publicProfileError } = await supabase
      .from("public_agent_profiles")
      .select("id, full_name")
      .eq("slug", slug)
      .maybeSingle();

    if (publicProfileError || !publicProfile) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: cardSettings, error: cardSettingsError } = await supabase
      .from("agent_card_settings")
      .select("user_id")
      .eq("user_id", publicProfile.id)
      .eq("is_public", true)
      .maybeSingle();

    if (cardSettingsError || !cardSettings) {
      return new Response(JSON.stringify({ error: "Application form is not available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedUniversityId = normalizeOptional(universityId);
    const normalizedCampusId = normalizeOptional(campusId);
    const normalizedCourseId = normalizeOptional(courseId);
    const normalizedIntakeId = normalizeOptional(intakeId);
    const normalizedTimetableOption = normalizeOptional(timetableOption);

    const [universityRes, campusRes, courseRes, intakeRes, timetableRes] = await Promise.all([
      normalizedUniversityId
        ? supabase.from("universities").select("id, name").eq("id", normalizedUniversityId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      normalizedCampusId && normalizedUniversityId
        ? supabase.from("campuses").select("id, name, city").eq("id", normalizedCampusId).eq("university_id", normalizedUniversityId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      normalizedCourseId && normalizedUniversityId
        ? supabase.from("courses").select("id, name").eq("id", normalizedCourseId).eq("university_id", normalizedUniversityId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      normalizedIntakeId && normalizedUniversityId
        ? supabase.from("intakes").select("id, label").eq("id", normalizedIntakeId).eq("university_id", normalizedUniversityId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      normalizedTimetableOption && normalizedUniversityId
        ? supabase.from("timetable_options").select("label").eq("university_id", normalizedUniversityId).eq("label", normalizedTimetableOption).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const courseInterestParts = [
      universityRes.data?.name,
      campusRes.data ? `${campusRes.data.name}${campusRes.data.city ? ` — ${campusRes.data.city}` : ""}` : null,
      courseRes.data?.name,
      intakeRes.data?.label,
      timetableRes.data?.label ?? normalizedTimetableOption,
    ].filter(Boolean);

    const leadId = crypto.randomUUID();
    const normalizedEmail = email.trim().toLowerCase();

    const { error: insertError } = await supabase.from("leads").insert({
      id: leadId,
      agent_id: publicProfile.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: normalizedEmail,
      phone: normalizeOptional(phone),
      nationality: normalizeOptional(nationality),
      course_interest: courseInterestParts.length > 0 ? courseInterestParts.join(" — ") : null,
      university_id: normalizedUniversityId,
      campus_id: normalizedCampusId,
      course_id: normalizedCourseId,
      intake_id: normalizedIntakeId,
      timetable_option: timetableRes.data?.label ?? normalizedTimetableOption,
      status: "new",
    });

    if (insertError) {
      console.error("Failed to insert public lead", insertError);
      return new Response(JSON.stringify({ error: "Failed to save application" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leadsUrl = `${origin ?? "https://agentseduforyou.lovable.app"}/agent/leads`;

    try {
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceRoleKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          templateName: "new-lead-notification",
          recipientEmail: null,
          agentId: publicProfile.id,
          idempotencyKey: `new-lead-${leadId}`,
          templateData: {
            leadName: `${firstName.trim()} ${lastName.trim()}`,
            leadEmail: normalizedEmail,
            leadPhone: normalizeOptional(phone) ?? undefined,
            nationality: normalizeOptional(nationality) ?? undefined,
            courseInterest: courseInterestParts.length > 0 ? courseInterestParts.join(" — ") : undefined,
            leadsUrl,
          },
        }),
      });

      if (!emailResponse.ok) {
        console.error("Public lead notification failed", await emailResponse.text());
      }
    } catch (emailError) {
      console.error("Public lead notification request failed", emailError);
    }

    return new Response(JSON.stringify({ success: true, leadId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Unhandled public application error", error);
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
