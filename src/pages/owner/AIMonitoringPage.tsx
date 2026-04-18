import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Search, Bot, User } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import ReactMarkdown from "react-markdown";

export default function AIMonitoringPage() {
  const { role } = useAuth();
  const [search, setSearch] = useState("");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ["ai-monitoring-conversations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, user_id, title, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(200);
      return data || [];
    },
  });

  // Fetch profiles for user names
  const userIds = [...new Set(conversations.map((c) => c.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["ai-monitoring-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  // Fetch roles for users
  const { data: userRoles = [] } = useQuery({
    queryKey: ["ai-monitoring-roles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  // Fetch message counts per conversation
  const convIds = conversations.map((c) => c.id);
  const { data: messageCounts = [] } = useQuery({
    queryKey: ["ai-monitoring-counts", convIds.join(",")],
    queryFn: async () => {
      if (convIds.length === 0) return [];
      const { data } = await supabase
        .from("ai_messages")
        .select("conversation_id")
        .in("conversation_id", convIds);
      // Count per conversation
      const counts: Record<string, number> = {};
      (data || []).forEach((m) => {
        counts[m.conversation_id] = (counts[m.conversation_id] || 0) + 1;
      });
      return Object.entries(counts).map(([id, count]) => ({ id, count }));
    },
    enabled: convIds.length > 0,
  });

  // Selected conversation messages
  const { data: selectedMessages = [] } = useQuery({
    queryKey: ["ai-monitoring-messages", selectedConversation],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data } = await supabase
        .from("ai_messages")
        .select("role, content, created_at")
        .eq("conversation_id", selectedConversation)
        .order("created_at", { ascending: true });
      return data || [];
    },
    enabled: !!selectedConversation,
  });

  const profileMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
  const roleMap = Object.fromEntries(userRoles.map((r) => [r.user_id, r.role]));
  const countMap = Object.fromEntries(messageCounts.map((c) => [c.id, c.count]));

  const filtered = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const profile = profileMap[c.user_id];
    return (
      c.title.toLowerCase().includes(q) ||
      profile?.full_name?.toLowerCase().includes(q) ||
      profile?.email?.toLowerCase().includes(q)
    );
  });

  const selectedConvData = conversations.find((c) => c.id === selectedConversation);

  return (
    <DashboardLayout allowedRoles={["owner"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">AI Monitoring</h1>
            <p className="text-muted-foreground">
              Track all AI conversations from {role === "owner" ? "all users" : "your team"}
            </p>
          </div>
          <Badge variant="outline" className="gap-1">
            <MessageSquare className="h-3 w-3" />
            {conversations.length} conversations
          </Badge>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by user or topic..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-center py-8">Loading...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Topic</TableHead>
                    <TableHead className="text-center">Messages</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((conv) => {
                    const profile = profileMap[conv.user_id];
                    const userRole = roleMap[conv.user_id];
                    return (
                      <TableRow key={conv.id}>
                        <TableCell className="font-medium">
                          {profile?.full_name || "Unknown"}
                          <div className="text-xs text-muted-foreground">{profile?.email}</div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={userRole === "owner" ? "default" : userRole === "admin" ? "secondary" : "outline"}>
                            {userRole || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{conv.title}</TableCell>
                        <TableCell className="text-center">{countMap[conv.id] || 0}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedConversation(conv.id)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No conversations found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversation Transcript Dialog */}
      <Dialog open={!!selectedConversation} onOpenChange={(o) => !o && setSelectedConversation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4" />
              {selectedConvData?.title || "Conversation"}
              {selectedConvData && (
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  {profileMap[selectedConvData.user_id]?.full_name} · {format(new Date(selectedConvData.created_at), "dd MMM yyyy HH:mm")}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 max-h-[60vh]">
            <div className="space-y-3 p-1">
              {selectedMessages.map((msg, i) => (
                <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && <Bot className="h-5 w-5 text-primary shrink-0 mt-1" />}
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                    <p className="text-[10px] opacity-60 mt-1">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </p>
                  </div>
                  {msg.role === "user" && <User className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />}
                </div>
              ))}
              {selectedMessages.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No messages in this conversation</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
