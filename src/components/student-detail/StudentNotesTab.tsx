import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Send, AlertTriangle, MessageSquare, FileWarning, DollarSign, Info, AlertCircle, RefreshCw, Flame, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { StatusBadge } from "@/components/StatusBadge";
import { notifyAgentOfStatusChange } from "@/lib/enrollment-emails";
import { getVisibleStatuses, getAdminEditableStatuses } from "@/lib/status-utils";

const NOTE_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  note: { label: "Note", icon: MessageSquare, color: "bg-blue-500/10 text-blue-700" },
  status_change: { label: "Status Change", icon: AlertTriangle, color: "bg-yellow-500/10 text-yellow-700" },
  document_request: { label: "Document Request", icon: FileWarning, color: "bg-red-500/10 text-red-700" },
  funding_update: { label: "Funding Update", icon: DollarSign, color: "bg-green-500/10 text-green-700" },
  info_request: { label: "Info Request", icon: Info, color: "bg-purple-500/10 text-purple-700" },
  action_required: { label: "Action Required", icon: AlertCircle, color: "bg-orange-500/10 text-orange-700" },
  status_update: { label: "Status Update", icon: RefreshCw, color: "bg-teal-500/10 text-teal-700" },
};

// Status list is now imported from status-utils.ts (role-aware)

interface Props {
  studentId: string;
  studentName?: string;
  canSendRequests: boolean;
}

async function sendNoteEmailToAgent(studentId: string, studentName: string, noteType: string, content: string, authorName: string) {
  try {
    const { data: student } = await supabase.from("students").select("agent_id").eq("id", studentId).single();
    if (!student?.agent_id) return;
    const { data: agent } = await supabase.from("profiles").select("email").eq("id", student.agent_id).single();
    if (!agent?.email) return;
    const noteId = crypto.randomUUID();
    const studentUrl = `${window.location.origin}/consultant/students/${studentId}`;
    await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: "note-notification",
        recipientEmail: agent.email,
        idempotencyKey: `note-${noteId}`,
        templateData: { studentName, noteType, content, authorName, studentUrl },
      },
    });
  } catch (err) {
    console.error("Failed to send note email:", err);
  }
}

export function StudentNotesTab({ studentId, studentName, canSendRequests }: Props) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [isUrgent, setIsUrgent] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [selectedEnrollment, setSelectedEnrollment] = useState("");

  const { data: notes = [] } = useQuery({
    queryKey: ["student-notes", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_notes")
        .select("*, profiles:user_id(full_name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments-for-notes", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status, universities(name), courses(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: canSendRequests,
  });

  const addNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("student_notes").insert({
        student_id: studentId,
        user_id: user!.id,
        content,
        note_type: noteType,
        is_agent_visible: true,
        is_urgent: isUrgent,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (isUrgent || noteType === "action_required" || noteType === "info_request") {
        sendNoteEmailToAgent(studentId, studentName || "Student", noteType, content, profile?.full_name || "Admin");
      }
      // Auto-create task for actionable note types
      const actionableTypes = ["document_request", "info_request", "action_required"];
      if (actionableTypes.includes(noteType)) {
        try {
          const { data: student } = await supabase.from("students").select("agent_id").eq("id", studentId).single();
          if (student?.agent_id) {
            const typeLabel = NOTE_TYPE_CONFIG[noteType]?.label || noteType;
            await supabase.from("tasks").insert({
              title: `${typeLabel}: ${studentName || "Student"}`,
              description: content,
              assigned_to: student.agent_id,
              created_by: user!.id,
              source: "student_note",
              student_id: studentId,
              priority: isUrgent ? "high" : "medium",
            } as any);
          }
        } catch (err) {
          console.error("Failed to auto-create task:", err);
        }
      }
      qc.invalidateQueries({ queryKey: ["student-notes", studentId] });
      qc.invalidateQueries({ queryKey: ["urgent-note-counts"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setContent("");
      setNoteType("note");
      setIsUrgent(false);
      toast({ title: "Note added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resolveNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase
        .from("student_notes")
        .update({ resolved_at: new Date().toISOString() } as any)
        .eq("id", noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-notes", studentId] });
      qc.invalidateQueries({ queryKey: ["urgent-note-counts"] });
      toast({ title: "Note marked as resolved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateStatusAndLog = useMutation({
    mutationFn: async ({ enrollmentId, status, note }: { enrollmentId: string; status: string; note: string }) => {
      // Capture old status before updating
      const { data: current } = await supabase.from("enrollments").select("status").eq("id", enrollmentId).single();
      const oldStatus = current?.status || "unknown";
      const { error: updateErr } = await supabase.from("enrollments").update({ status }).eq("id", enrollmentId);
      if (updateErr) throw updateErr;
      const { error: noteErr } = await supabase.from("student_notes").insert({
        student_id: studentId, user_id: user!.id,
        content: note || `Status updated to ${status.replace(/_/g, " ")}`,
        note_type: "status_update", is_agent_visible: true, is_urgent: false,
      } as any);
      if (noteErr) throw noteErr;
      return { enrollmentId, status, oldStatus };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["student-notes", studentId] });
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      qc.invalidateQueries({ queryKey: ["student-enrollments-for-notes", studentId] });
      setNewStatus(""); setStatusNote("");
      toast({ title: "Status updated & logged" });
      notifyAgentOfStatusChange(result.enrollmentId, result.status, result.oldStatus, profile?.full_name);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const availableTypes = canSendRequests
    ? ["note", "document_request", "funding_update", "info_request", "action_required"]
    : ["note"];

  return (
    <div className="space-y-4">
      {/* Quick Status Changer */}
      {canSendRequests && enrollments.length > 0 && (
        <Card className="border-accent/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-accent" /> Quick Status Update
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              <Select value={selectedEnrollment} onValueChange={(v) => { setSelectedEnrollment(v); setNewStatus(""); }}>
                <SelectTrigger className="w-[260px] h-9"><SelectValue placeholder="Select enrollment…" /></SelectTrigger>
                <SelectContent>
                  {enrollments.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {(e as any).universities?.name} — {(e as any).courses?.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEnrollment && (
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="New status…" /></SelectTrigger>
                  <SelectContent>
                    {(role === "owner" ? getVisibleStatuses("owner") : getAdminEditableStatuses()).map((s) => (
                      <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedEnrollment && newStatus && (
              <>
                <Textarea value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="Add context (optional)…" rows={2} />
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => updateStatusAndLog.mutate({ enrollmentId: selectedEnrollment, status: newStatus, note: statusNote })} disabled={updateStatusAndLog.isPending}>
                    <RefreshCw className="w-3 h-3 mr-1" /> {updateStatusAndLog.isPending ? "Updating…" : "Update & Log"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes & Activity */}
      <Card>
        <CardHeader><CardTitle className="text-base">Notes & Activity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 border rounded-lg p-4 bg-muted/20">
            <div className="flex items-center gap-2 flex-wrap">
              {canSendRequests && (
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableTypes.map((t) => {
                      const cfg = NOTE_TYPE_CONFIG[t];
                      return <SelectItem key={t} value={t}>{cfg.label}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              )}
              {canSendRequests && (
                <div className="flex items-center gap-2 ml-auto">
                  <Flame className={`w-4 h-4 ${isUrgent ? "text-orange-500" : "text-muted-foreground"}`} />
                  <Label htmlFor="urgent-toggle" className="text-xs cursor-pointer">Urgent</Label>
                  <Switch id="urgent-toggle" checked={isUrgent} onCheckedChange={setIsUrgent} />
                </div>
              )}
            </div>
            <Textarea
              value={content} onChange={(e) => setContent(e.target.value)}
              placeholder={
                noteType === "document_request" ? "Describe which documents are needed…"
                : noteType === "info_request" ? "What information do you need from the agent?"
                : noteType === "action_required" ? "Describe what the agent needs to do…"
                : "Write a note…"
              }
              rows={3}
            />
            <div className="flex justify-end">
              <Button size="sm" onClick={() => addNote.mutate()} disabled={!content.trim() || addNote.isPending}>
                <Send className="w-3 h-3 mr-1" /> {addNote.isPending ? "Sending…" : "Add Note"}
              </Button>
            </div>
          </div>

          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {notes.map((note: any) => {
                const cfg = NOTE_TYPE_CONFIG[note.note_type] || NOTE_TYPE_CONFIG.note;
                const Icon = cfg.icon;
                const urgent = note.is_urgent;
                const isResolvable = (urgent || ["action_required", "info_request"].includes(note.note_type)) && !note.resolved_at;
                const isResolved = !!note.resolved_at;
                return (
                  <div
                    key={note.id}
                    className={`border rounded-lg p-3 space-y-2 ${
                      isResolved ? "opacity-60" : ""
                    } ${
                      urgent && !isResolved ? "border-l-4 border-l-orange-500 bg-orange-500/5" : ""
                    } ${
                      note.note_type === "action_required" && !isResolved ? "border-l-4 border-l-orange-400" : ""
                    } ${
                      note.note_type === "info_request" && !isResolved ? "border-l-4 border-l-purple-400" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-xs ${cfg.color}`}>
                          <Icon className="w-3 h-3 mr-1" /> {cfg.label}
                        </Badge>
                        {urgent && !isResolved && (
                          <Badge className="text-[10px] bg-orange-500 text-white px-1.5 py-0">
                            <Flame className="w-2.5 h-2.5 mr-0.5" /> URGENT
                          </Badge>
                        )}
                        {isResolved && (
                          <Badge variant="outline" className="text-[10px] text-green-700 border-green-300 px-1.5 py-0">
                            <CheckCircle className="w-2.5 h-2.5 mr-0.5" /> Resolved
                          </Badge>
                        )}
                        <span className="text-xs font-medium">{(note as any).profiles?.full_name || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isResolvable && canSendRequests && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs text-green-700 hover:text-green-800 hover:bg-green-50 px-2"
                            onClick={() => resolveNote.mutate(note.id)}
                            disabled={resolveNote.isPending}
                          >
                            <CheckCircle className="w-3 h-3 mr-1" /> Resolve
                          </Button>
                        )}
                        <span className="text-xs text-muted-foreground">{format(new Date(note.created_at), "dd MMM yyyy HH:mm")}</span>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
