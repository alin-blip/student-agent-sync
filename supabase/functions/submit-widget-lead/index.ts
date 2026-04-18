import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.2";

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { "X-Client-Info": "supabase-functions-submit-widget-lead" } } },
  );

  try {
    const { branch_id, full_name, email, phone, message, origin_domain } = await req.json();

    if (!branch_id || !full_name || !email) {
      return new Response("Missing required fields", { status: 400 });
    }

    // Validate origin domain
    const { data: widgetSettings, error: settingsError } = await supabaseClient
      .from("widget_settings")
      .select("allowed_domains")
      .eq("branch_id", branch_id)
      .single();

    if (settingsError) {
      console.error("Error fetching widget settings:", settingsError);
      // For security, if settings can't be fetched, deny access
      return new Response("Unauthorized origin", { status: 403 });
    }

    const allowedDomains = widgetSettings?.allowed_domains || [];
    const requestOrigin = new URL(origin_domain).hostname;

    if (allowedDomains.length > 0 && !allowedDomains.some(domain => requestOrigin.endsWith(domain))) {
      return new Response("Unauthorized origin", { status: 403 });
    }

    // Find consultants in the branch for round-robin assignment
    const { data: consultants, error: consultantsError } = await supabaseClient
      .from("profiles")
      .select("id")
      .eq("branch_id", branch_id)
      .eq("role", "consultant");

    if (consultantsError) {
      console.error("Error fetching consultants:", consultantsError);
      return new Response("Internal Server Error", { status: 500 });
    }

    let assignedConsultantId = null;
    if (consultants && consultants.length > 0) {
      // Simple round-robin: get the last assigned consultant for this branch, or pick the first one
      const { data: lastLead, error: lastLeadError } = await supabaseClient
        .from("widget_leads")
        .select("consultant_id")
        .eq("branch_id", branch_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let lastConsultantIndex = -1;
      if (lastLead && lastLead.consultant_id) {
        lastConsultantIndex = consultants.findIndex(c => c.id === lastLead.consultant_id);
      }

      const nextConsultantIndex = (lastConsultantIndex + 1) % consultants.length;
      assignedConsultantId = consultants[nextConsultantIndex].id;
    }

    // Insert into widget_leads
    const { data: lead, error: insertError } = await supabaseClient
      .from("widget_leads")
      .insert({
        branch_id,
        consultant_id: assignedConsultantId,
        full_name,
        email,
        phone,
        message,
        origin_domain,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting lead:", insertError);
      return new Response("Internal Server Error", { status: 500 });
    }

    return new Response(JSON.stringify({ message: "Lead submitted successfully", leadId: lead.id }), {
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
