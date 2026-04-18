import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { getRolePrefix, APP_ROLES } from "@/lib/roles";

type NotificationType = "message" | "task" | "enrollment" | "lead" | "social" | "invoice";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  time: string;
  link: string;
};

function getStorageKey(userId: string) {
  return `read-notification-ids-${userId}`;
}

function getReadIds(userId?: string): Set<string> {
  if (!userId) return new Set();
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markAsRead(id: string, userId: string) {
  const ids = getReadIds(userId);
  ids.add(id);
  // Keep only last 200 to avoid bloat
  const arr = [...ids].slice(-200);
  localStorage.setItem(getStorageKey(userId), JSON.stringify(arr));
}

export function NotificationBell() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadIds(user?.id));
  const prefix = getRolePrefix(role || APP_ROLES.CONSULTANT);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications-bell", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const items: NotificationItem[] = [];

      // 1. Unread messages
      const { data: convos } = await supabase
        .from("direct_conversations")
        .select("id, participant_1, participant_2")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);

      if (convos && convos.length > 0) {
        const convoIds = convos.map((c: any) => c.id);
        const { data: unreadMsgs } = await supabase
          .from("direct_messages")
          .select("id, content, sender_id, created_at, conversation_id")
          .in("conversation_id", convoIds)
          .neq("sender_id", user.id)
          .is("read_at", null)
          .order("created_at", { ascending: false })
          .limit(5);

        if (unreadMsgs) {
          const senderIds = [...new Set(unreadMsgs.map((m: any) => m.sender_id))];
          const { data: senderProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", senderIds);
          const nameMap = Object.fromEntries((senderProfiles || []).map((p: any) => [p.id, p.full_name]));

          unreadMsgs.forEach((msg: any) => {
            items.push({
              id: `msg-${msg.id}`,
              type: "message",
              title: `New message from ${nameMap[msg.sender_id] || "Unknown"}`,
              description: msg.content.length > 60 ? msg.content.slice(0, 60) + "…" : msg.content,
              time: msg.created_at,
              link: `${prefix}/messages`,
            });
          });
        }
      }

      // 2. Recent tasks assigned to user (not done)
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, priority, created_at")
        .eq("assigned_to", user.id)
        .neq("status", "done")
        .order("created_at", { ascending: false })
        .limit(5);

      if (tasks) {
        tasks.forEach((task: any) => {
          items.push({
            id: `task-${task.id}`,
            type: "task",
            title: `Task: ${task.title}`,
            description: `Priority: ${task.priority}`,
            time: task.created_at,
            link: `${prefix}/tasks`,
          });
        });
      }

      // 3. Recent enrollment status changes (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, status, updated_at, student_id, students(first_name, last_name)")
        .gte("updated_at", sevenDaysAgo.toISOString())
        .order("updated_at", { ascending: false })
        .limit(5);

      if (enrollments) {
        enrollments.forEach((e: any) => {
          const studentName = e.students ? `${e.students.first_name} ${e.students.last_name}` : "Unknown";
          items.push({
            id: `enroll-${e.id}`,
            type: "enrollment",
            title: `Enrollment updated`,
            description: `${studentName} → ${e.status.replace(/_/g, " ")}`,
            time: e.updated_at,
            link: `${prefix}/students/${e.student_id}`,
          });
        });
      }

      // 4. New leads
      {
        let leadsQuery = supabase
          .from("leads")
          .select("id, first_name, last_name, email, phone, created_at")
          .eq("status", "new")
          .order("created_at", { ascending: false })
          .limit(5);
        if (role !== APP_ROLES.SUPER_ADMIN) {
          leadsQuery = leadsQuery.eq("agent_id", user.id);
        }
        const { data: newLeads } = await leadsQuery;
        if (newLeads) {
          newLeads.forEach((lead: any) => {
            items.push({
              id: `lead-${lead.id}`,
              type: "lead",
              title: `New lead: ${lead.first_name} ${lead.last_name}`,
              description: [lead.email, lead.phone].filter(Boolean).join(" · "),
              time: lead.created_at,
              link: `${prefix}/leads`,
            });
          });
        }
      }

      // 5. Pending tier upgrade requests (owner only)
      if (role === APP_ROLES.SUPER_ADMIN) {
        const { data: upgrades } = await (supabase as any)
          .from("tier_upgrade_requests")
          .select("id, user_id, user_role, current_tier_name, new_tier_name, current_rate, new_rate, student_count, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5);

        if (upgrades) {
          const upgradeUserIds = [...new Set(upgrades.map((u: any) => u.user_id))] as string[];
          const { data: upgradeProfiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", upgradeUserIds);
          const upgradeNameMap = Object.fromEntries((upgradeProfiles || []).map((p: any) => [p.id, p.full_name]));

          upgrades.forEach((u: any) => {
            items.push({
              id: `upgrade-${u.id}`,
              type: "enrollment",
              title: `Tier upgrade: ${upgradeNameMap[u.user_id] || "Unknown"}`,
              description: `${u.current_tier_name} → ${u.new_tier_name} (£${u.current_rate} → £${u.new_rate})`,
              time: u.created_at,
              link: `${prefix}/commissions`,
            });
          });
        }
      }

      // 6. Unseen social posts for agents/admins
      {
        const { data: unseenPosts } = await supabase
          .from("social_post_recipients")
          .select("id, post_id, social_posts(caption, created_at)")
          .eq("agent_id", user.id)
          .is("seen_at", null)
          .order("id", { ascending: false })
          .limit(5);

        if (unseenPosts) {
          unseenPosts.forEach((sp: any) => {
            const caption = sp.social_posts?.caption || "New post";
            items.push({
              id: `social-${sp.id}`,
              type: "social",
              title: "New social post ready",
              description: caption.length > 60 ? caption.slice(0, 60) + "…" : caption,
              time: sp.social_posts?.created_at || new Date().toISOString(),
              link: `${prefix}/social-posts`,
            });
          });
        }
      }

      // 7. Invoice status updates (for agents/admins)
      if (role !== APP_ROLES.SUPER_ADMIN) {
        const { data: invoiceUpdates } = await (supabase as any)
          .from("invoice_requests")
          .select("id, invoice_number, status, amount, updated_at")
          .eq("requester_id", user.id)
          .in("status", ["approved", "paid", "rejected"])
          .order("updated_at", { ascending: false })
          .limit(5);

        if (invoiceUpdates) {
          invoiceUpdates.forEach((inv: any) => {
            const statusLabel = inv.status === "approved" ? "approved ✅" : inv.status === "paid" ? "paid 💰" : "rejected ❌";
            items.push({
              id: `invoice-${inv.id}`,
              type: "invoice",
              title: `Invoice ${inv.invoice_number} ${statusLabel}`,
              description: `£${Number(inv.amount).toFixed(2)}`,
              time: inv.updated_at,
              link: `${prefix}/invoices`,
            });
          });
        }
      }

      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      return items.slice(0, 15);
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length;

  const handleClick = useCallback((notification: NotificationItem) => {
    if (user) markAsRead(notification.id, user.id);
    setReadIds(getReadIds(user?.id));
    setOpen(false);
    navigate(notification.link);
  }, [navigate, user]);

  const handleMarkAllRead = useCallback(() => {
    if (user) notifications.forEach((n) => markAsRead(n.id, user.id));
    setReadIds(getReadIds(user?.id));
  }, [notifications, user]);

  const typeIcon: Record<string, string> = {
    message: "💬",
    task: "📋",
    enrollment: "🎓",
    lead: "📥",
    social: "📢",
    invoice: "🧾",
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[16px] h-[16px] px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Notifications</h4>
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleMarkAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[360px]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => {
                const isUnread = !readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
                    onClick={() => handleClick(n)}
                  >
                    <div className="flex gap-2">
                      <span className="text-sm mt-0.5">{typeIcon[n.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm truncate ${isUnread ? "font-semibold" : "font-medium text-muted-foreground"}`}>{n.title}</p>
                          {isUnread && <span className="shrink-0 w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{n.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {formatDistanceToNow(new Date(n.time), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
