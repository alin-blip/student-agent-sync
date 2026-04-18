import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAgentXP, getLevelInfo } from "@/hooks/useAgentXP";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Flame, Trophy, Star, TrendingUp, Zap, Crown } from "lucide-react";

export default function LeaderboardPage() {
  const { user } = useAuth();
  const { streak, levelInfo } = useAgentXP();

  // Fetch all streaks for leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ["xp-leaderboard"],
    queryFn: async () => {
      const { data: streaks } = await supabase
        .from("agent_streaks")
        .select("*")
        .order("total_xp", { ascending: false });

      if (!streaks) return [];

      // Fetch profiles for all users
      const userIds = streaks.map((s: any) => s.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      return streaks.map((s: any, i: number) => ({
        ...s,
        rank: i + 1,
        profile: profileMap.get(s.user_id),
        levelInfo: getLevelInfo(s.total_xp),
      }));
    },
    refetchInterval: 60000,
  });

  // Recent XP events for current user
  const { data: recentEvents = [] } = useQuery({
    queryKey: ["xp-recent-events", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_xp_events")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  const currentStreak = streak?.current_streak || 0;
  const longestStreak = streak?.longest_streak || 0;
  const totalXp = streak?.total_xp || 0;
  const myRank = leaderboard.findIndex((l: any) => l.user_id === user?.id) + 1;

  const eventLabels: Record<string, string> = {
    daily_login: "🔑 Daily Login",
    enrollment_created: "📋 Enrollment Created",
    student_added: "👤 Student Added",
  };

  const rankIcons = [
    <Crown key="1" className="h-5 w-5 text-yellow-500" />,
    <Trophy key="2" className="h-5 w-5 text-gray-400" />,
    <Trophy key="3" className="h-5 w-5 text-amber-700" />,
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-6 w-6 text-primary" />
          XP Leaderboard
        </h1>

        {/* Personal Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <Flame className={`h-8 w-8 mx-auto mb-2 ${currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
              <p className="text-3xl font-bold">{currentStreak}</p>
              <p className="text-xs text-muted-foreground">Current Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <p className="text-3xl font-bold">{longestStreak}</p>
              <p className="text-xs text-muted-foreground">Longest Streak</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Zap className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-3xl font-bold">{totalXp}</p>
              <p className="text-xs text-muted-foreground">Total XP</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Star className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="text-3xl font-bold">#{myRank || "—"}</p>
              <p className="text-xs text-muted-foreground">Your Rank</p>
            </CardContent>
          </Card>
        </div>

        {/* Level progress */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Level {levelInfo.current.level} — {levelInfo.current.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Progress value={levelInfo.progress} className="h-3" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{totalXp} XP</span>
              {levelInfo.next && <span>{levelInfo.next.xpRequired} XP for {levelInfo.next.title}</span>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Trophy className="h-4 w-4 text-primary" />
                Rankings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaderboard.map((entry: any) => (
                <div
                  key={entry.user_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    entry.user_id === user?.id ? "bg-primary/5 border-primary/20" : "bg-muted/30"
                  }`}
                >
                  <div className="w-8 text-center shrink-0">
                    {entry.rank <= 3 ? rankIcons[entry.rank - 1] : (
                      <span className="text-sm font-bold text-muted-foreground">#{entry.rank}</span>
                    )}
                  </div>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={entry.profile?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {entry.profile?.full_name?.split(" ").map((n: string) => n[0]).join("") || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {entry.profile?.full_name || "Agent"}
                      {entry.user_id === user?.id && <span className="text-xs text-muted-foreground ml-1">(you)</span>}
                    </p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        Lv.{entry.levelInfo.current.level} {entry.levelInfo.current.title}
                      </Badge>
                      {entry.current_streak > 0 && (
                        <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                          <Flame className="h-3 w-3" /> {entry.current_streak}d
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{entry.total_xp}</p>
                    <p className="text-[10px] text-muted-foreground">XP</p>
                  </div>
                </div>
              ))}
              {leaderboard.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No data yet. Start logging in daily!</p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                Recent XP Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentEvents.map((event: any) => (
                <div key={event.id} className="flex items-center justify-between p-2.5 rounded-md border bg-muted/30">
                  <div>
                    <p className="text-sm">{eventLabels[event.event_type] || event.event_type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(event.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                    +{event.xp_amount} XP
                  </Badge>
                </div>
              ))}
              {recentEvents.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">No XP events yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
