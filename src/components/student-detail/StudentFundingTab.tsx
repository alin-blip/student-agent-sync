import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Save, Download, Upload, FileText, CheckCircle2, Clock, Pencil } from "lucide-react";
import { useState, useRef } from "react";
import { StudentFinanceFormDialog } from "./StudentFinanceFormDialog";

const FUNDING_STATUSES = ["not_started", "application_submitted", "approved", "rejected", "disbursed"];
const FUNDING_TYPES = ["SFE (Student Finance England)", "SFW (Student Finance Wales)", "SAAS", "Student Finance NI", "Bursary", "Scholarship", "Self-funded", "Employer Sponsored", "Other"];

interface Props {
  studentId: string;
  canEdit: boolean;
  student?: any;
}

export function StudentFundingTab({ studentId, canEdit, student }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments-funding", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status, funding_status, funding_type, funding_reference, funding_notes, universities!inner(name), courses!inner(name)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: financeForms = [] } = useQuery({
    queryKey: ["student-finance-forms", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_finance_forms")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateFunding = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase.from("enrollments").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-enrollments-funding", studentId] });
      setEditingId(null);
      toast({ title: "Funding updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const startEdit = (e: any) => {
    setEditingId(e.id);
    setEditData({
      funding_status: e.funding_status || "not_started",
      funding_type: e.funding_type || "",
      funding_reference: e.funding_reference || "",
      funding_notes: e.funding_notes || "",
    });
  };

  const handleUploadPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    const filePath = `${studentId}/finance_form_${Date.now()}_${file.name}`;
    const { error: uploadErr } = await supabase.storage.from("student-documents").upload(filePath, file);
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      return;
    }
    const { error: insertErr } = await supabase.from("student_finance_forms").insert({
      student_id: studentId,
      agent_id: user.id,
      method: "upload",
      uploaded_file_path: filePath,
    });
    if (insertErr) {
      toast({ title: "Error saving record", description: insertErr.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["student-finance-forms", studentId] });
    toast({ title: "Finance form uploaded successfully" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownloadUploaded = async (filePath: string) => {
    const { data } = await supabase.storage.from("student-documents").createSignedUrl(filePath, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const openEditForm = (form: any) => {
    setEditingForm(form);
    setFormDialogOpen(true);
  };

  const openNewForm = () => {
    setEditingForm(null);
    setFormDialogOpen(true);
  };

  const hasCompletedForm = financeForms.length > 0;

  return (
    <div className="space-y-6">
      {/* Enrollment Funding Cards */}
      {enrollments.length === 0 ? (
        <Card><CardContent className="py-6"><p className="text-sm text-muted-foreground text-center">No enrollments to track funding for</p></CardContent></Card>
      ) : (
        enrollments.map((e: any) => (
          <Card key={e.id}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{e.universities?.name} — {e.courses?.name}</span>
                <StatusBadge status={e.status} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              {editingId === e.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Funding Status</Label>
                      <Select value={editData.funding_status} onValueChange={(v) => setEditData({ ...editData, funding_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FUNDING_STATUSES.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Funding Type</Label>
                      <Select value={editData.funding_type} onValueChange={(v) => setEditData({ ...editData, funding_type: v })}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>{FUNDING_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Reference Number</Label>
                    <Input value={editData.funding_reference} onChange={(ev) => setEditData({ ...editData, funding_reference: ev.target.value })} placeholder="e.g. SFE reference" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={editData.funding_notes} onChange={(ev) => setEditData({ ...editData, funding_notes: ev.target.value })} placeholder="Funding notes..." />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateFunding.mutate({ id: e.id, ...editData })} disabled={updateFunding.isPending}>
                      <Save className="w-3 h-3 mr-1" /> Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Funding Status</p>
                    <StatusBadge status={e.funding_status || "not_started"} />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Type</p>
                    <p className="font-medium">{e.funding_type || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-0.5">Reference</p>
                    <p className="font-medium">{e.funding_reference || "—"}</p>
                  </div>
                  <div>
                    {canEdit && (
                      <Button size="sm" variant="outline" onClick={() => startEdit(e)} className="mt-3">Edit Funding</Button>
                    )}
                  </div>
                  {e.funding_notes && (
                    <div className="col-span-full">
                      <p className="text-muted-foreground text-xs mb-0.5">Notes</p>
                      <p className="font-medium whitespace-pre-wrap">{e.funding_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Student Finance Application Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Student Finance Application
            </span>
            {hasCompletedForm ? (
              <Badge className="gap-1 bg-green-100 text-green-700 border-green-200">
                <CheckCircle2 className="w-3 h-3" /> Completed
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Clock className="w-3 h-3" /> Not Started
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Existing forms */}
          {financeForms.map((f: any) => (
            <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {f.method === "platform" ? "Filled in Platform" : "Uploaded PDF"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("en-GB")}
                    {f.consent_full_name && ` — Signed by ${f.consent_full_name}`}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {f.method === "platform" && canEdit && (
                  <Button size="sm" variant="outline" onClick={() => openEditForm(f)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                )}
                {f.method === "upload" && f.uploaded_file_path && (
                  <Button size="sm" variant="outline" onClick={() => handleDownloadUploaded(f.uploaded_file_path)}>
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                )}
              </div>
            </div>
          ))}

          {/* Action buttons */}
          {canEdit && (
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={openNewForm}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" /> Fill in Platform
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/EduForYou_Student_Finance_Form.pdf" download target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download Blank Form
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="w-3.5 h-3.5 mr-1.5" /> Upload Completed Form
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleUploadPdf}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <StudentFinanceFormDialog
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        studentId={studentId}
        student={student}
        existingForm={editingForm}
      />
    </div>
  );
}
