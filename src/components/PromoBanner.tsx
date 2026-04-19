import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Trophy, X, PartyPopper } from "lucide-react";
import { useState, useEffect } from "react";
import { Progress } from "@/components/ui/progress";

function useCountdown(deadline: string | null) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0, expired: false });

  useEffect(() => {
    if (!deadline) return;
    const calc = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, expired: true };
      return {
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins: Math.floor((diff % 3600000) / 60000),
        secs: Math.floor((diff % 60000) / 1000),
        expired: false,
      };
    };
    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  return timeLeft;
}

const QUALIFYING_STATUSES = ["final_offer", "enrolled", "commission_25_ready", "commission_paid"];

export function PromoBanner() {
  const { user, role } = useAuth();

  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("dismissed-promos");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  // Only agents and admins see banners
  const isEligible = role === "consultant" || role === "branch_manager";

  // Fetch active promotion matching user's role
  const { data: promo } = useQuery({
    queryKey: ["active-promotion", role],
    queryFn: async () => {
      const { data } = await (supabase.from("promotions") as any)
        .select("*")
        .eq("is_active", true)
        .eq("target_role", role!)
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
    enabled: isEligible,
  });

  // Fetch or auto-create personal promo record
  const { data: agentPromo } = useQuery({
    queryKey: ["agent-promo", promo?.id, user?.id],
    queryFn: async () => {
      if (!promo || !user) return null;

      const { data: existing } = await supabase
        .from("agent_promotions" as any)
        .select("*")
        .eq("promotion_id", promo.id)
        .eq("agent_id", user.id)
        .maybeSingle();

      if (existing) return existing as any;

      const personalDeadline = new Date();
      personalDeadline.setDate(personalDeadline.getDate() + 30);

      const { data: created } = await supabase
        .from("agent_promotions" as any)
        .insert({
          promotion_id: promo.id,
          agent_id: user.id,
          personal_deadline: personalDeadline.toISOString(),
        } as any)
        .select()
        .single();

      return created as any;
    },
    enabled: !!promo && !!user && isEligible,
  });

  // For admin: get team agent IDs
  const { data: teamAgentIds } = useQuery({
    queryKey: ["team-agent-ids", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("admin_id", user!.id);
      return data?.map((a) => a.id) || [];
    },
    enabled: !!user && role === "branch_manager",
  });

  // Count qualifying enrollments
  const { data: qualifyingCount = 0 } = useQuery({
    queryKey: ["promo-qualifying-count", user?.id, agentPromo?.started_at, role, teamAgentIds],
    queryFn: async () => {
      if (!user || !agentPromo) return 0;

      if (role === "branch_manager") {
        // Count enrollments from all team agents' students
        const ids = teamAgentIds || [];
        if (ids.length === 0) return 0;

        const { count } = await (supabase
          .from("enrollments")
          .select("id, students!inner(agent_id)", { count: "exact", head: true }) as any)
          .in("students.agent_id", ids)
          .in("status", QUALIFYING_STATUSES)
          .gte("created_at", agentPromo.started_at)
          .lte("created_at", agentPromo.personal_deadline);
        return count || 0;
      }

      // Agent: count own enrollments
      const { count } = await supabase
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .in("status", QUALIFYING_STATUSES)
        .gte("created_at", agentPromo.started_at)
        .lte("created_at", agentPromo.personal_deadline);
      return count || 0;
    },
    enabled: !!user && !!agentPromo && (role === "consultant" || (role === "branch_manager" && !!teamAgentIds)),
  });

  if (!isEligible || !promo || dismissed.has(promo.id)) return null;

  const handleDismiss = () => {
    const next = new Set(dismissed);
    next.add(promo.id);
    setDismissed(next);
    localStorage.setItem("dismissed-promos", JSON.stringify([...next]));
  };

  return (
    <PromoBannerCard
      promo={promo}
      agentPromo={agentPromo}
      qualifyingCount={qualifyingCount}
      onDismiss={handleDismiss}
      isTeam={role === "branch_manager"}
    />
  );
}

function PromoBannerCard({
  promo,
  agentPromo,
  qualifyingCount,
  onDismiss,
  isTeam,
}: {
  promo: any;
  agentPromo: any;
  qualifyingCount: number;
  onDismiss: () => void;
  isTeam: boolean;
}) {
  const deadline = agentPromo?.personal_deadline || promo.deadline;
  const { days, hours, mins, secs, expired } = useCountdown(deadline);

  const target = promo.target_students || 5;
  const remaining = Math.max(0, target - qualifyingCount);
  const reached = qualifyingCount >= target;
  const progressPct = Math.min(100, (qualifyingCount / target) * 100);
  const label = isTeam ? "team" : "students";

  if (expired && !reached) return null;

  if (reached) {
    return (
      <div className="relative rounded-lg bg-gradient-to-r from-green-600 to-green-500 p-4 sm:p-5 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
        <button onClick={onDismiss} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="relative flex items-center gap-4">
          <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
            <PartyPopper className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-lg">🎉 Congratulations! Target reached!</h3>
            <p className="text-sm mt-1 opacity-90">
              {isTeam ? "Your team enrolled" : "You enrolled"} {qualifyingCount}/{target} students. Your bonus: £{promo.bonus_amount}
              {promo.bonus_percentage ? ` + ${promo.bonus_percentage}% commission` : ""}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg bg-gradient-to-r from-accent/90 to-accent p-4 sm:p-5 text-accent-foreground overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <button onClick={onDismiss} className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors">
        <X className="w-4 h-4" />
      </button>

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
          <Trophy className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <h3 className="font-bold text-lg leading-tight">{promo.title}</h3>
          {promo.description && (
            <p className="text-sm opacity-90">{promo.description}</p>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>🎯 {qualifyingCount}/{target} {label} · {remaining} remaining</span>
              <span>💰 £{promo.bonus_amount}{promo.bonus_percentage ? ` + ${promo.bonus_percentage}%` : ""}</span>
            </div>
            <Progress value={progressPct} className="h-2 bg-white/20" />
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
          {[
            { val: days, label: "Days" },
            { val: hours, label: "Hrs" },
            { val: mins, label: "Min" },
            { val: secs, label: "Sec" },
          ].map(({ val, label }) => (
            <div key={label} className="text-center bg-white/20 rounded-md px-2 py-1.5 min-w-[48px]">
              <p className="text-xl font-bold leading-none">{String(val).padStart(2, "0")}</p>
              <p className="text-[10px] uppercase tracking-wider mt-0.5 opacity-80">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
