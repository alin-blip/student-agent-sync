import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Send, Plus, MessageCircle, Search, Users, Shield, UserCheck, ArrowLeft } from "lucide-react";
import { MentionTextarea } from "@/components/MentionTextarea";
import { Badge } from "@/components/ui/badge";
import { format, formatDistanceToNow } from "date-fns";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { usePresenceMap } from "@/contexts/PresenceContext";
import { useIsMobile } from "@/hooks/use-mobile";


export default function MessagesPage() {
  const { user, role } = useAuth();
  const isMobile = useIsMobile();
  const presenceMap = usePresenceMap();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchUsers, setSearchUsers] = useState("");
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch conversations
  const { data: conversations = [] } = useQuery({
    queryKey: ["direct-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_conversations")
        .select("*, p1:participant_1(id, full_name, avatar_url), p2:participant_2(id, full_name, avatar_url)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch unread counts per conversation
  const { data: unreadMap = {} } = useQuery({
    queryKey: ["unread-per-convo", user?.id],
    queryFn: async () => {
      if (!user || conversations.length === 0) return {};
      const convoIds = conversations.map((c: any) => c.id);
      const { data, error } = await supabase
        .from("direct_messages")
        .select("id, conversation_id")
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (error) return {};
      const counts: Record<string, number> = {};
      for (const msg of data || []) {
        counts[msg.conversation_id] = (counts[msg.conversation_id] || 0) + 1;
      }
      return counts;
    },
    enabled: !!user && conversations.length > 0,
  });

  // Fetch messages for active conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["direct-messages", activeConvo],
    queryFn: async () => {
      if (!activeConvo) return [];
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*, sender:sender_id(full_name, avatar_url)")
        .eq("conversation_id", activeConvo)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeConvo,
  });

  // Fetch users for new conversation with roles
  const { data: availableUsers = [] } = useQuery({
    queryKey: ["available-users-for-chat", searchUsers, role],
    queryFn: async () => {
      // Fetch profiles
      let query = supabase.from("profiles").select("id, full_name, email, avatar_url, admin_id").neq("id", user!.id);
      if (searchUsers.trim()) {
        const sanitized = searchUsers.trim().replace(/[%_\\]/g, '');
        if (sanitized) {
          query = query.or(`full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
        }
      }
      const { data: profiles } = await query.order("full_name").limit(50);
      if (!profiles || profiles.length === 0) return [];

      // Fetch roles for these users
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", profiles.map((p: any) => p.id));

      const roleMap: Record<string, string> = {};
      if (roles) {
        for (const r of roles) roleMap[r.user_id] = r.role;
      }

      let enriched = profiles.map((p: any) => ({
        ...p,
        role: roleMap[p.id] || "unknown",
      }));

      // Filter based on current user's role
      if (role === "consultant") {
        // Agent can only message their admin
        const { data: myProfile } = await supabase
          .from("profiles").select("admin_id").eq("id", user!.id).single();
        if (myProfile?.admin_id) {
          enriched = enriched.filter((u: any) => u.id === myProfile.admin_id);
        } else {
          enriched = [];
        }
      } else if (role === "branch_manager") {
        // Admin can message: their agents + owner
        enriched = enriched.filter((u: any) =>
          u.role === "owner" || u.admin_id === user!.id
        );
      }
      // Owner sees everyone

      return enriched;
    },
    enabled: newConvoOpen && !!user,
  });

  // Mark messages as read
  useEffect(() => {
    if (!activeConvo || !user || messages.length === 0) return;
    const unread = messages.filter((m: any) => m.sender_id !== user.id && !m.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((m: any) => m.id);
    supabase
      .from("direct_messages")
      .update({ read_at: new Date().toISOString() } as any)
      .in("id", ids)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["direct-conversations"] });
        qc.invalidateQueries({ queryKey: ["unread-messages-count"] });
        qc.invalidateQueries({ queryKey: ["unread-per-convo"] });
        qc.invalidateQueries({ queryKey: ["notifications-bell"] });
      });
  }, [activeConvo, messages, user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("direct-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["direct-messages", activeConvo] });
        qc.invalidateQueries({ queryKey: ["direct-conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo]);

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!activeConvo || !messageText.trim()) return;
      const { error } = await supabase.from("direct_messages").insert({
        conversation_id: activeConvo,
        sender_id: user!.id,
        content: messageText.trim(),
      } as any);
      if (error) throw error;
      // Touch conversation updated_at
      await supabase.from("direct_conversations").update({ updated_at: new Date().toISOString() } as any).eq("id", activeConvo);
    },
    onSuccess: () => {
      setMessageText("");
      qc.invalidateQueries({ queryKey: ["direct-messages", activeConvo] });
      qc.invalidateQueries({ queryKey: ["direct-conversations"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startConversation = async (otherUserId: string) => {
    // Check if conversation already exists
    const existing = conversations.find((c: any) =>
      (c.participant_1 === user!.id && c.participant_2 === otherUserId) ||
      (c.participant_2 === user!.id && c.participant_1 === otherUserId)
    );
    if (existing) {
      setActiveConvo(existing.id);
      setNewConvoOpen(false);
      return;
    }
    const { data, error } = await supabase.from("direct_conversations").insert({
      participant_1: user!.id,
      participant_2: otherUserId,
    } as any).select().single();
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["direct-conversations"] });
    setActiveConvo(data.id);
    setNewConvoOpen(false);
  };

  const isMyConversation = (convo: any) =>
    convo.participant_1 === user?.id || convo.participant_2 === user?.id;

  const getOtherParticipant = (convo: any) => {
    if (convo.p1?.id === user?.id) return convo.p2;
    return convo.p1;
  };

  const getConvoDisplayName = (convo: any) => {
    if (isMyConversation(convo)) {
      return getOtherParticipant(convo)?.full_name || "Unknown";
    }
    return `${convo.p1?.full_name || "?"} ↔ ${convo.p2?.full_name || "?"}`;
  };

  const getUnreadForConvo = (convoId: string) => {
    return (unreadMap as Record<string, number>)[convoId] || 0;
  };

  // Render @mentions as highlighted spans
  const renderMessageContent = (content: string, isMine: boolean) => {
    const parts = content.split(/(@[\p{L}\p{N}]+(?: [\p{L}\p{N}]+)*)/u);
    return parts.map((part, i) => {
      if (part.startsWith("@") && part.length > 1) {
        return (
          <span key={i} className={`font-semibold ${isMine ? "text-accent-foreground" : "text-accent"}`}>
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5rem)] sm:h-[calc(100vh-6rem)] gap-0 border rounded-lg bg-card overflow-hidden">
        {/* Conversation list */}
        <div className={`${isMobile && activeConvo ? "hidden" : "flex"} ${isMobile ? "w-full" : "w-80"} border-r flex-col shrink-0`}>
          <div className="p-3 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Messages</h2>
            <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
              <DialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <Plus className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Conversation</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users…"
                      value={searchUsers}
                      onChange={(e) => setSearchUsers(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <ScrollArea className="h-72">
                    <div className="space-y-1">
                      {/* Group users by role */}
                      {(() => {
                        const groups: Record<string, any[]> = {};
                        const order = ["agent", "admin", "owner"];
                        for (const u of availableUsers) {
                          const r = (u as any).role || "other";
                          if (!groups[r]) groups[r] = [];
                          groups[r].push(u);
                        }
                        const roleLabel: Record<string, string> = { agent: "Agents", admin: "Admins", owner: "Owner", other: "Other" };
                        const roleIcon: Record<string, typeof Users> = { agent: Users, admin: Shield, owner: UserCheck };
                        const sortedKeys = [...order.filter(k => groups[k]), ...Object.keys(groups).filter(k => !order.includes(k))];

                        if (availableUsers.length === 0) {
                          return <p className="text-sm text-muted-foreground text-center py-4">No users found</p>;
                        }

                        return sortedKeys.map((groupKey) => {
                          const Icon = roleIcon[groupKey] || Users;
                          return (
                            <div key={groupKey}>
                              <div className="flex items-center gap-1.5 px-2 py-1.5 mt-1">
                                <Icon className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  {roleLabel[groupKey] || groupKey}
                                </span>
                                <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 ml-auto">
                                  {groups[groupKey].length}
                                </Badge>
                              </div>
                              {groups[groupKey].map((u: any) => (
                                <button
                                  key={u.id}
                                  onClick={() => startConversation(u.id)}
                                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 text-left transition-colors"
                                >
                                  <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs bg-accent/20 text-accent">{getInitials(u.full_name)}</AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{u.full_name}</p>
                                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                                  </div>
                                </button>
                              ))}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <ScrollArea className="flex-1">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MessageCircle className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            ) : (
              <div className="p-1">
                    {conversations.map((convo: any) => {
                  const isMine = isMyConversation(convo);
                  const other = isMine ? getOtherParticipant(convo) : null;
                  const displayName = getConvoDisplayName(convo);
                  const isActive = activeConvo === convo.id;
                  const unread = getUnreadForConvo(convo.id);
                  return (
                    <button
                      key={convo.id}
                      onClick={() => setActiveConvo(convo.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        isActive ? "bg-accent/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="text-xs bg-accent/20 text-accent">{isMine ? getInitials(other?.full_name) : "↔"}</AvatarFallback>
                        </Avatar>
                        {isMine && presenceMap[other?.id]?.is_online ? (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
                        ) : unread > 0 ? (
                          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                            {unread > 99 ? "99+" : unread}
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm truncate ${unread > 0 ? "font-semibold" : "font-medium"}`}>{displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {isMine && presenceMap[other?.id]?.is_online
                            ? "Online"
                            : isMine && presenceMap[other?.id]?.last_seen_at
                              ? `Active ${formatDistanceToNow(new Date(presenceMap[other?.id].last_seen_at), { addSuffix: true })}`
                              : format(new Date(convo.updated_at), "dd MMM, HH:mm")}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Message area */}
        <div className={`${isMobile && !activeConvo ? "hidden" : "flex"} flex-1 flex-col`}>
          {!activeConvo ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation or start a new one</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              {(() => {
                const convo = conversations.find((c: any) => c.id === activeConvo);
                if (!convo) return null;
                const isMine = isMyConversation(convo);
                const other = isMine ? getOtherParticipant(convo) : null;
                const headerName = getConvoDisplayName(convo);
                return (
                  <div className="p-3 border-b flex items-center gap-3">
                    {isMobile && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setActiveConvo(null)}>
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs bg-accent/20 text-accent">{isMine ? getInitials(other?.full_name) : "↔"}</AvatarFallback>
                      </Avatar>
                      {isMine && presenceMap[other?.id]?.is_online && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-card" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{headerName}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {isMine && presenceMap[other?.id]?.is_online
                          ? "Online"
                          : isMine && presenceMap[other?.id]?.last_seen_at
                            ? `Active ${formatDistanceToNow(new Date(presenceMap[other?.id].last_seen_at), { addSuffix: true })}`
                            : isMine ? "Offline" : format(new Date(convo.updated_at), "dd MMM, HH:mm")}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3">
                  {messages.map((msg: any) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[70%] rounded-lg px-3 py-2 ${
                          isMine ? "bg-accent text-accent-foreground" : "bg-muted"
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">
                            {renderMessageContent(msg.content, isMine)}
                          </p>
                          <p className={`text-[10px] mt-1 ${isMine ? "text-accent-foreground/60" : "text-muted-foreground"}`}>
                            {format(new Date(msg.created_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-3 border-t">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMessage.mutate(); }}
                  className="flex gap-2"
                >
                  <MentionTextarea
                    value={messageText}
                    onChange={setMessageText}
                    placeholder="Type a message… Use @ to mention a student"
                    rows={1}
                    className="resize-none min-h-[40px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage.mutate();
                      }
                    }}
                  />
                  <Button type="submit" size="icon" className="shrink-0 bg-accent text-accent-foreground hover:bg-accent/90" disabled={!messageText.trim() || sendMessage.isPending}>
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
