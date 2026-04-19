import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Save, X, UserCog } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const IMMIGRATION_OPTIONS = ["Pre-settled", "Settled", "British Citizen", "Visa Holder", "Refugee", "Other"];
const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Other"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const STUDY_PATTERNS_FALLBACK = ["Weekdays", "Weekend", "Evenings"];

interface Props {
  student: any;
  agentName: string;
  adminName?: string;
  canEdit: boolean;
}

export function StudentOverviewTab({ student, agentName, adminName, canEdit }: Props) {
  const { toast } = useToast();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>(null);
  const [reassigning, setReassigning] = useState(false);

  // Fetch all agents/admins for reassignment (owner only)
  const { data: allAgents = [] } = useQuery({
    queryKey: ["all-agents-for-reassign"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: role === "owner",
  });

  // Fetch enrollments to get course/campus for timetable lookup
  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments-overview", student.id],
    queryFn: async () => {
      const { data } = await supabase.from("enrollments").select("course_id, campus_id, university_id").eq("student_id", student.id).limit(1);
      return data || [];
    },
  });

  const firstEnrollment = enrollments[0] as any;

  // Fetch dynamic timetable groups for the student's course + campus
  const { data: timetableGroups = [] } = useQuery({
    queryKey: ["course-timetable-groups", firstEnrollment?.course_id, firstEnrollment?.campus_id],
    queryFn: async () => {
      let query = supabase
        .from("course_timetable_groups")
        .select("id, timetable_option_id, timetable_options(id, label)")
        .eq("course_id", firstEnrollment.course_id);
      if (firstEnrollment.campus_id) {
        query = query.eq("campus_id", firstEnrollment.campus_id);
      }
      const { data } = await query;
      return (data || []).map((row: any) => ({
        id: row.timetable_option_id,
        label: row.timetable_options?.label || "Unknown",
      }));
    },
    enabled: !!firstEnrollment?.course_id,
  });

  const { data: universityTimetableOptions = [] } = useQuery({
    queryKey: ["timetable-options", firstEnrollment?.university_id],
    queryFn: async () => {
      const { data } = await supabase.from("timetable_options").select("id, label").eq("university_id", firstEnrollment.university_id).order("label");
      return data || [];
    },
    enabled: !!firstEnrollment?.university_id,
  });

  // Show course-specific groups only; fall back to university-wide only when no course context
  const displayTimetableOptions = firstEnrollment?.course_id
    ? (timetableGroups.length > 0 ? timetableGroups : null)
    : (universityTimetableOptions.length > 0 ? universityTimetableOptions : null);

  const updateStudent = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("students").update(updates).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-detail", student.id] });
      setEditing(false);
      toast({ title: "Student updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reassignStudent = useMutation({
    mutationFn: async (newAgentId: string) => {
      const { error } = await supabase.from("students").update({ agent_id: newAgentId }).eq("id", student.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-detail", student.id] });
      setReassigning(false);
      toast({ title: "Student reassigned successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = () => {
    setEditData({
      title: student.title || "", first_name: student.first_name || "", last_name: student.last_name || "",
      nationality: student.nationality || "", gender: student.gender || "", email: student.email || "",
      phone: student.phone || "", date_of_birth: student.date_of_birth || "", full_address: student.full_address || "",
      uk_entry_date: student.uk_entry_date || "", immigration_status: student.immigration_status || "",
      share_code: student.share_code || "", ni_number: student.ni_number || "",
      previous_funding_years: student.previous_funding_years?.toString() || "",
      crn: (student as any).crn || "",
      study_pattern: student.study_pattern || "", qualifications: student.qualifications || "",
      notes: student.notes || "", next_of_kin_name: student.next_of_kin_name || "",
      next_of_kin_phone: student.next_of_kin_phone || "", next_of_kin_relationship: student.next_of_kin_relationship || "",
    });
    setEditing(true);
  };

  const saveEdit = () => {
    updateStudent.mutate({
      ...editData,
      email: editData.email || null, phone: editData.phone || null,
      date_of_birth: editData.date_of_birth || null, full_address: editData.full_address || null,
      uk_entry_date: editData.uk_entry_date || null, immigration_status: editData.immigration_status || null,
      share_code: editData.share_code || null, ni_number: editData.ni_number || null,
      previous_funding_years: editData.previous_funding_years ? parseInt(editData.previous_funding_years) : null,
      crn: editData.crn || null,
      study_pattern: editData.study_pattern || null, qualifications: editData.qualifications || null,
      notes: editData.notes || null, next_of_kin_name: editData.next_of_kin_name || null,
      next_of_kin_phone: editData.next_of_kin_phone || null, next_of_kin_relationship: editData.next_of_kin_relationship || null,
      title: editData.title || null, nationality: editData.nationality || null, gender: editData.gender || null,
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Student Information</CardTitle>
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        )}
        {editing && (
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={updateStudent.isPending}><Save className="w-3 h-3 mr-1" /> Save</Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}><X className="w-3 h-3 mr-1" /> Cancel</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Select value={editData.title} onValueChange={(v) => setEditData({ ...editData, title: v })}>
                <SelectTrigger><SelectValue placeholder="Title" /></SelectTrigger>
                <SelectContent>{TITLE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>First Name {role === "consultant" && <span className="text-xs text-muted-foreground">(locked)</span>}</Label><Input value={editData.first_name} onChange={(e) => setEditData({ ...editData, first_name: e.target.value })} disabled={role === "consultant"} /></div>
            <div className="space-y-2"><Label>Last Name {role === "consultant" && <span className="text-xs text-muted-foreground">(locked)</span>}</Label><Input value={editData.last_name} onChange={(e) => setEditData({ ...editData, last_name: e.target.value })} disabled={role === "consultant"} /></div>
            <div className="space-y-2"><Label>Nationality</Label><Input value={editData.nationality} onChange={(e) => setEditData({ ...editData, nationality: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Gender</Label>
              <Select value={editData.gender} onValueChange={(v) => setEditData({ ...editData, gender: v })}>
                <SelectTrigger><SelectValue placeholder="Gender" /></SelectTrigger>
                <SelectContent>{GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={editData.phone} onChange={(e) => setEditData({ ...editData, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Date of Birth {role === "consultant" && <span className="text-xs text-muted-foreground">(locked)</span>}</Label><Input type="date" value={editData.date_of_birth} onChange={(e) => setEditData({ ...editData, date_of_birth: e.target.value })} disabled={role === "consultant"} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Full UK Address</Label><Textarea value={editData.full_address} onChange={(e) => setEditData({ ...editData, full_address: e.target.value })} /></div>
            <div className="space-y-2"><Label>UK Entry Date</Label><Input type="date" value={editData.uk_entry_date} onChange={(e) => setEditData({ ...editData, uk_entry_date: e.target.value })} /></div>
            <div className="space-y-2">
              <Label>Immigration Status {role === "consultant" && <span className="text-xs text-muted-foreground">(locked)</span>}</Label>
              <Select value={editData.immigration_status} onValueChange={(v) => setEditData({ ...editData, immigration_status: v })} disabled={role === "consultant"}>
                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                <SelectContent>{IMMIGRATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Share Code</Label><Input value={editData.share_code} onChange={(e) => setEditData({ ...editData, share_code: e.target.value })} /></div>
            <div className="space-y-2"><Label>NI Number</Label><Input value={editData.ni_number} onChange={(e) => setEditData({ ...editData, ni_number: e.target.value })} /></div>
            <div className="space-y-2"><Label>Previous Funding (years)</Label><Input type="number" min="0" value={editData.previous_funding_years} onChange={(e) => setEditData({ ...editData, previous_funding_years: e.target.value })} /></div>
            {editData.previous_funding_years && parseInt(editData.previous_funding_years) > 0 && (
              <div className="space-y-2">
                <Label>CRN (Customer Reference Number)</Label>
                <Input value={editData.crn} onChange={(e) => setEditData({ ...editData, crn: e.target.value })} placeholder="e.g. 1234567890" />
                <p className="text-xs text-muted-foreground">Student's SFE reference number</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Study Pattern / Timetable Group</Label>
              {displayTimetableOptions ? (
                <>
                <p className="text-xs text-muted-foreground">Classes currently available. Please note these may fill up, and you may be offered other options after the admission test.</p>
                <div className="flex flex-wrap gap-3">
                  {displayTimetableOptions.map((g) => {
                    const currentPatterns = (editData.study_pattern || "").split(", ").filter(Boolean);
                    return (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={currentPatterns.includes(g.label)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...currentPatterns, g.label]
                              : currentPatterns.filter((p: string) => p !== g.label);
                            setEditData({ ...editData, study_pattern: updated.join(", ") });
                          }}
                        />
                        {g.label}
                      </label>
                    );
                  })}
                </div>
                </>
              ) : (
                <div className="flex gap-4">
                  {STUDY_PATTERNS_FALLBACK.map((sp) => {
                    const currentPatterns = (editData.study_pattern || "").split(", ").filter(Boolean);
                    return (
                      <label key={sp} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={currentPatterns.includes(sp)}
                          onCheckedChange={(checked) => {
                            const updated = checked
                              ? [...currentPatterns, sp]
                              : currentPatterns.filter((p: string) => p !== sp);
                            setEditData({ ...editData, study_pattern: updated.join(", ") });
                          }}
                        />
                        {sp}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="space-y-2 sm:col-span-2"><Label>Qualifications</Label><Textarea value={editData.qualifications} onChange={(e) => setEditData({ ...editData, qualifications: e.target.value })} /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Notes</Label><Textarea value={editData.notes} onChange={(e) => setEditData({ ...editData, notes: e.target.value })} /></div>
            <div className="sm:col-span-2 border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-3">Next of Kin</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Name</Label><Input value={editData.next_of_kin_name} onChange={(e) => setEditData({ ...editData, next_of_kin_name: e.target.value })} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={editData.next_of_kin_phone} onChange={(e) => setEditData({ ...editData, next_of_kin_phone: e.target.value })} /></div>
                <div className="space-y-2"><Label>Relationship</Label><Input value={editData.next_of_kin_relationship} onChange={(e) => setEditData({ ...editData, next_of_kin_relationship: e.target.value })} /></div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
              {student.title && <div><p className="text-muted-foreground text-xs mb-0.5">Title</p><p className="font-medium">{student.title}</p></div>}
              <div><p className="text-muted-foreground text-xs mb-0.5">Email</p><p className="font-medium">{student.email || "—"}</p></div>
              <div><p className="text-muted-foreground text-xs mb-0.5">Phone</p><p className="font-medium">{student.phone || "—"}</p></div>
              {student.nationality && <div><p className="text-muted-foreground text-xs mb-0.5">Nationality</p><p className="font-medium">{student.nationality}</p></div>}
              {student.gender && <div><p className="text-muted-foreground text-xs mb-0.5">Gender</p><p className="font-medium">{student.gender}</p></div>}
              <div><p className="text-muted-foreground text-xs mb-0.5">Date of Birth</p><p className="font-medium">{student.date_of_birth ? format(new Date(student.date_of_birth), "dd MMM yyyy") : "—"}</p></div>
              {student.full_address && <div className="col-span-full"><p className="text-muted-foreground text-xs mb-0.5">Full UK Address</p><p className="font-medium">{student.full_address}</p></div>}
              {student.uk_entry_date && <div><p className="text-muted-foreground text-xs mb-0.5">UK Entry Date</p><p className="font-medium">{format(new Date(student.uk_entry_date), "dd MMM yyyy")}</p></div>}
              <div><p className="text-muted-foreground text-xs mb-0.5">Immigration Status</p><p className="font-medium">{student.immigration_status || "—"}</p></div>
              {student.share_code && <div><p className="text-muted-foreground text-xs mb-0.5">Share Code</p><p className="font-medium">{student.share_code}</p></div>}
              {student.ni_number && <div><p className="text-muted-foreground text-xs mb-0.5">NI Number</p><p className="font-medium">{student.ni_number}</p></div>}
              {student.previous_funding_years != null && <div><p className="text-muted-foreground text-xs mb-0.5">Previous Funding</p><p className="font-medium">{student.previous_funding_years} year(s)</p></div>}
              {(student as any).crn && <div><p className="text-muted-foreground text-xs mb-0.5">CRN</p><p className="font-medium">{(student as any).crn}</p></div>}
              {student.study_pattern && <div><p className="text-muted-foreground text-xs mb-0.5">Study Pattern</p><p className="font-medium">{student.study_pattern}</p></div>}
              <div><p className="text-muted-foreground text-xs mb-0.5">Qualifications</p><p className="font-medium">{student.qualifications || "—"}</p></div>
              <div>
                <p className="text-muted-foreground text-xs mb-0.5">Agent</p>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{agentName || "—"}</p>
                  {role === "owner" && !reassigning && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => setReassigning(true)}>
                      <UserCog className="w-3 h-3" /> Reassign
                    </Button>
                  )}
                </div>
                {reassigning && role === "owner" && (
                  <div className="flex items-center gap-2 mt-2">
                    <Select onValueChange={(v) => reassignStudent.mutate(v)}>
                      <SelectTrigger className="h-8 text-xs w-[200px]"><SelectValue placeholder="Select agent…" /></SelectTrigger>
                      <SelectContent>
                        {allAgents.filter((a: any) => a.id !== student.agent_id).map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.full_name} ({a.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="sm" className="h-8" onClick={() => setReassigning(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              {adminName && (
                <div><p className="text-muted-foreground text-xs mb-0.5">Admin</p><p className="font-medium">{adminName || "—"}</p></div>
              )}
              <div><p className="text-muted-foreground text-xs mb-0.5">Created</p><p className="font-medium">{format(new Date(student.created_at), "dd MMM yyyy")}</p></div>
              {student.notes && <div className="col-span-full"><p className="text-muted-foreground text-xs mb-0.5">Notes</p><p className="font-medium whitespace-pre-wrap">{student.notes}</p></div>}
            </div>
            {(student.next_of_kin_name || student.next_of_kin_phone || student.next_of_kin_relationship) && (
              <div className="border-t pt-4">
                <h4 className="text-sm font-semibold mb-3">Next of Kin</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-muted-foreground text-xs mb-0.5">Name</p><p className="font-medium">{student.next_of_kin_name || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-0.5">Phone</p><p className="font-medium">{student.next_of_kin_phone || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs mb-0.5">Relationship</p><p className="font-medium">{student.next_of_kin_relationship || "—"}</p></div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
