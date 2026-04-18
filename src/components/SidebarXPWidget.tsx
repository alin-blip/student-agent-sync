import { useAgentXP } from "@/hooks/useAgentXP";
import { Progress } from "@/components/ui/progress";
import { Flame, Trophy, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getRolePrefix, APP_ROLES } from "@/lib/roles";

export function SidebarXPWidget({ collapsed }: { collapsed: boolean }) {
  const { streak, levelInfo } = useAgentXP();
  const { role } = useAuth();
  const navigate = useNavigate();
  const prefix = getRolePrefix(role || APP_ROLES.CONSULTANT);

  const currentStreak = streak?.current_streak || 0;
  const totalXp = streak?.total_xp || 0;

  if (collapsed) {
    return (
      <button
        onClick={() => navigate(`${prefix}/leaderboard`)}
        className="flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg hover:bg-sidebar-accent transition-colors w-full"
        title={`${currentStreak} day streak • Level ${levelInfo.current.level}`}
      >
        <Flame className={`h-4 w-4 ${currentStreak > 0 ? "text-orange-500" : "text-sidebar-foreground/40"}`} />
        <span className="text-[10px] font-bold text-sidebar-foreground/70">{currentStreak}</span>
      </button>
    );
  }

  return (
    <button
      onClick={() => navigate(`${prefix}/leaderboard`)}
      className="w-full rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 space-y-2 hover:bg-sidebar-accent/50 transition-colors text-left"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Flame className={`h-4 w-4 ${currentStreak > 0 ? "text-orange-500 animate-pulse" : "text-sidebar-foreground/40"}`} />
          <span className="text-xs font-bold text-sidebar-foreground">
            {currentStreak} {currentStreak === 1 ? "day" : "days"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 text-yellow-500" />
          <span className="text-[10px] font-medium text-sidebar-foreground/70">
            Lv.{levelInfo.current.level}
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-sidebar-foreground/50">{levelInfo.current.title}</span>
          <span className="text-[10px] text-sidebar-foreground/50">{totalXp} XP</span>
        </div>
        <Progress value={levelInfo.progress} className="h-1.5" />
        {levelInfo.next && (
          <p className="text-[9px] text-sidebar-foreground/40">
            {levelInfo.xpForNext - levelInfo.xpInLevel} XP to {levelInfo.next.title}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 pt-0.5">
        <Trophy className="h-3 w-3 text-sidebar-foreground/40" />
        <span className="text-[10px] text-sidebar-foreground/50">View Leaderboard</span>
      </div>
    </button>
  );
}
