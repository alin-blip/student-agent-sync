import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.3";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.99.3/cors";

const XP_VALUES: Record<string, number> = {
  daily_login: 10,
  enrollment_created: 50,
  student_added: 25,
  streak_bonus: 5,
};

const LEVELS = [
  { level: 1, xpRequired: 0 },
  { level: 2, xpRequired: 100 },
  { level: 3, xpRequired: 300 },
  { level: 4, xpRequired: 600 },
  { level: 5, xpRequired: 1000 },
  { level: 6, xpRequired: 1500 },
  { level: 7, xpRequired: 2500 },
  { level: 8, xpRequired: 4000 },
  { level: 9, xpRequired: 6000 },
  { level: 10, xpRequired: 10000 },
];

function getLevelFromXp(totalXp: number): number {
  let level = 1;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xpRequired) {
      level = LEVELS[i].level;
      break;
    }
  }
  return level;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // Parse body
    const body = await req.json();
    const eventType = typeof body.event_type === "string" ? body.event_type.trim() : "";
    const metadata = body.metadata || null;

    if (!eventType || !XP_VALUES[eventType]) {
      return new Response(JSON.stringify({ error: "Invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    if (eventType === "daily_login") {
      // Check if already logged today
      const { data: existing } = await supabase
        .from("agent_xp_events")
        .select("id")
        .eq("user_id", userId)
        .eq("event_type", "daily_login")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ ok: true, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get current streak
      const { data: currentStreak } = await supabase
        .from("agent_streaks")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      let newStreak = 1;
      let longestStreak = 1;

      if (currentStreak) {
        if (currentStreak.last_active_date === yesterdayStr) {
          newStreak = currentStreak.current_streak + 1;
        } else if (currentStreak.last_active_date === today) {
          return new Response(JSON.stringify({ ok: true, skipped: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        longestStreak = Math.max(newStreak, currentStreak.longest_streak);
      }

      const streakBonus = Math.max(0, (newStreak - 1) * XP_VALUES.streak_bonus);
      const totalXpEarned = XP_VALUES.daily_login + streakBonus;
      const newTotalXp = (currentStreak?.total_xp || 0) + totalXpEarned;
      const newLevel = getLevelFromXp(newTotalXp);

      await supabase.from("agent_xp_events").insert({
        user_id: userId,
        event_type: "daily_login",
        xp_amount: totalXpEarned,
        metadata: { streak: newStreak, bonus: streakBonus },
      });

      await supabase.from("agent_streaks").upsert(
        {
          user_id: userId,
          current_streak: newStreak,
          longest_streak: longestStreak,
          last_active_date: today,
          total_xp: newTotalXp,
          level: newLevel,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      return new Response(JSON.stringify({ ok: true, xp: totalXpEarned, streak: newStreak }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generic XP event
    const xpAmount = XP_VALUES[eventType];

    await supabase.from("agent_xp_events").insert({
      user_id: userId,
      event_type: eventType,
      xp_amount: xpAmount,
      metadata,
    });

    const { data: streak } = await supabase
      .from("agent_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const newTotalXp = (streak?.total_xp || 0) + xpAmount;
    const newLevel = getLevelFromXp(newTotalXp);

    await supabase.from("agent_streaks").upsert(
      {
        user_id: userId,
        current_streak: streak?.current_streak || 0,
        longest_streak: streak?.longest_streak || 0,
        last_active_date: streak?.last_active_date || today,
        total_xp: newTotalXp,
        level: newLevel,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    return new Response(JSON.stringify({ ok: true, xp: xpAmount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
