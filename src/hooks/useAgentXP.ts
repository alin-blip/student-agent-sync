import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const XP_VALUES: Record<string, number> = {
  daily_login: 10,
  enrollment_created: 50,
  student_added: 25,
  streak_bonus: 5, // per streak day
};

const LEVELS = [
  { level: 1, xpRequired: 0, title: "Rookie" },
  { level: 2, xpRequired: 100, title: "Explorer" },
  { level: 3, xpRequired: 300, title: "Achiever" },
  { level: 4, xpRequired: 600, title: "Pro Agent" },
  { level: 5, xpRequired: 1000, title: "Star Agent" },
  { level: 6, xpRequired: 1500, title: "Elite Agent" },
  { level: 7, xpRequired: 2500, title: "Legend" },
  { level: 8, xpRequired: 4000, title: "Champion" },
  { level: 9, xpRequired: 6000, title: "Grandmaster" },
  { level: 10, xpRequired: 10000, title: "Titan" },
];

export function getLevelInfo(totalXp: number) {
  let current = LEVELS[0];
  let next = LEVELS[1];
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }
  const xpInLevel = totalXp - current.xpRequired;
  const xpForNext = next ? next.xpRequired - current.xpRequired : 1;
  const progress = next ? Math.min((xpInLevel / xpForNext) * 100, 100) : 100;
  return { current, next, progress, xpInLevel, xpForNext };
}

export function useAgentXP() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch streak data
  const { data: streak } = useQuery({
    queryKey: ["agent-streak", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_streaks")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Record daily login via edge function
  const loginMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.functions.invoke("record-xp", {
        body: { event_type: "daily_login" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-streak"] });
    },
  });

  // Auto-record login on mount
  useEffect(() => {
    if (user) {
      loginMutation.mutate();
    }
  }, [user?.id]);

  return {
    streak,
    levelInfo: streak ? getLevelInfo(streak.total_xp) : getLevelInfo(0),
    XP_VALUES,
    LEVELS,
  };
}

// Hook to add XP for specific actions via edge function
export function useAddXP() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ eventType, metadata }: { eventType: string; metadata?: any }) => {
      if (!user) return;
      const { error } = await supabase.functions.invoke("record-xp", {
        body: { event_type: eventType, metadata },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agent-streak"] });
    },
  });
}
