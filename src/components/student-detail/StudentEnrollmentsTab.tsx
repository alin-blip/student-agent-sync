import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { notifyAgentOfStatusChange } from "@/lib/enrollment-emails";
import { CourseDetailsInfoCard } from "@/components/CourseDetailsInfoCard";
import { ChevronDown, ChevronUp, ArrowRightLeft, AlertTriangle, CalendarDays, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AssessmentBookingDialog } from "./AssessmentBookingDialog";
import { getVisibleStatuses, getDisplayStatus, getAdminEditableStatuses, canAgentBookAssessment, canAgentRequestCancel } from "@/lib/status-utils";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  studentId: string;
  canChangeStatus: boolean;
}

export function StudentEnrollmentsTab({ studentId, canChangeStatus }: Props) {
  const { toast } = useToast();
  const { role } = useAuth();
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Transfer dialog state
  const [transferEnrollment, setTransferEnrollment] = useState<any>(null);
  const [transferUniId, setTransferUniId] = useState("");
  const [transferCampusId, setTransferCampusId] = useState("");
  const [transferCourseId, setTransferCourseId] = useState("");
  const [transferIntakeId, setTransferIntakeId] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Code verification state
  const [transferStep, setTransferStep] = useState<"select" | "code">("select");
  const [transferRequestId, setTransferRequestId] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const isOwner = role === "owner";

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["student-enrollments", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status, created_at, course_id, university_id, campus_id, intake_id, assessment_date, assessment_time, funding_status, funding_type, funding_reference, funding_notes, universities!inner(name), courses!inner(name), campuses(name, city)")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: hasSignedConsent = false } = useQuery({
    queryKey: ["student-consent-signed", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("consent_signing_tokens")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "signed")
        .limit(1);
      return (data?.length || 0) > 0;
    },
  });

  // Universities, campuses, courses, intakes for transfer
  const { data: universities = [] } = useQuery({
    queryKey: ["universities-active"],
    queryFn: async () => {
      const { data } = await supabase.from("universities").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!transferEnrollment,
  });

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses-for-uni", transferUniId],
    queryFn: async () => {
      const { data } = await supabase.from("campuses").select("id, name").eq("university_id", transferUniId).order("name");
      return data || [];
    },
    enabled: !!transferUniId,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-for-campus", transferUniId, transferCampusId],
    queryFn: async () => {
      if (transferCampusId) {
        const { data: ctgs } = await supabase
          .from("course_timetable_groups")
          .select("course_id")
          .eq("university_id", transferUniId)
          .eq("campus_id", transferCampusId);
        const courseIds = [...new Set((ctgs || []).map((c: any) => c.course_id))];
        if (courseIds.length > 0) {
          const { data } = await supabase.from("courses").select("id, name").in("id", courseIds).eq("is_active", true).order("name");
          return data || [];
        }
        const { data } = await supabase.from("courses").select("id, name").eq("university_id", transferUniId).eq("is_active", true).order("name");
        return data || [];
      }
      const { data } = await supabase.from("courses").select("id, name").eq("university_id", transferUniId).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!transferUniId,
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ["intakes-for-uni", transferUniId],
    queryFn: async () => {
      const { data } = await supabase.from("intakes").select("id, label").eq("university_id", transferUniId).order("start_date");
      return data || [];
    },
    enabled: !!transferUniId,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus: string }) => {
      const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status, oldStatus };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      toast({ title: "Status updated" });
      notifyAgentOfStatusChange(result.id, result.status, result.oldStatus, profile?.full_name);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openTransferDialog = (enrollment: any) => {
    setTransferEnrollment(enrollment);
    setTransferUniId("");
    setTransferCampusId("");
    setTransferCourseId("");
    setTransferIntakeId("");
    setTransferStep("select");
    setTransferRequestId(null);
    setVerificationCode("");
  };

  // Owner: direct transfer (preserve history)
  const handleOwnerTransfer = async () => {
    if (!transferEnrollment || !transferUniId || !transferCourseId) return;
    setTransferring(true);
    try {
      // Mark old enrollment as transferred
      const { error: updateError } = await supabase
        .from("enrollments")
        .update({ status: "transferred" })
        .eq("id", transferEnrollment.id);
      if (updateError) throw updateError;

      // Create new enrollment
      const { error: insertError } = await supabase
        .from("enrollments")
        .insert({
          student_id: studentId,
          university_id: transferUniId,
          campus_id: transferCampusId || null,
          course_id: transferCourseId,
          intake_id: transferIntakeId || null,
          status: "new_application",
        });
      if (insertError) throw insertError;

      toast({ title: "Student transferred", description: "Old enrollment preserved in history." });
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      setTransferEnrollment(null);
    } catch (err: any) {
      toast({ title: "Transfer failed", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  // Agent/Admin: request transfer code
  const handleRequestCode = async () => {
    if (!transferEnrollment || !transferUniId || !transferCourseId) return;
    setTransferring(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-transfer-code", {
        body: {
          enrollment_id: transferEnrollment.id,
          new_university_id: transferUniId,
          new_campus_id: transferCampusId || null,
          new_course_id: transferCourseId,
          new_intake_id: transferIntakeId || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setTransferRequestId(data.transfer_request_id);
      setTransferStep("code");
      const approverLabel = role === "consultant" ? "admin" : "owner";
      toast({ title: "Code sent", description: `Approval code sent to your ${approverLabel}. Enter it below.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTransferring(false);
    }
  };

  // Verify transfer code
  const handleVerifyCode = async () => {
    if (!transferRequestId || !verificationCode) return;
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-transfer-code", {
        body: {
          transfer_request_id: transferRequestId,
          code: verificationCode,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Transfer complete", description: "Student transferred successfully." });
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      setTransferEnrollment(null);
    } catch (err: any) {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  // Assessment booking dialog
  const [assessmentEnrollmentId, setAssessmentEnrollmentId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Cancellation request dialog
  const [cancelEnrollmentId, setCancelEnrollmentId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const getAvailableStatuses = (currentStatus: string) => {
    if (!hasSignedConsent) return ["new_application"];
    if (role === "owner") return getVisibleStatuses("owner");
    if (role === "branch_manager") return getAdminEditableStatuses();
    return []; // agents don't use dropdown
  };

  const handleBookAssessment = async (date: Date, time: string) => {
    if (!assessmentEnrollmentId) return;
    setBookingLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const { error } = await supabase.from("enrollments").update({
        status: "assessment_booked",
        assessment_date: dateStr,
        assessment_time: time,
      }).eq("id", assessmentEnrollmentId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["student-enrollments", studentId] });
      toast({ title: "Assessment booked", description: `${format(date, "dd MMM yyyy")} at ${time}` });
      setAssessmentEnrollmentId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleRequestCancel = async () => {
    if (!cancelEnrollmentId) return;
    setCancelLoading(true);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error("Not authenticated");
      const { error } = await supabase.from("cancellation_requests").insert({
        enrollment_id: cancelEnrollmentId,
        requested_by: currentUser.id,
        reason: cancelReason || null,
      });
      if (error) throw error;
      toast({ title: "Cancellation requested", description: "Your admin will review and approve or reject." });
      setCancelEnrollmentId(null);
      setCancelReason("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader><CardTitle className="text-base">Enrollment History</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!hasSignedConsent && canChangeStatus && (
            <div className="px-4 pt-3">
              <Alert className="border-destructive/50 bg-destructive/10">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm text-destructive">
                  Consent form must be signed before the status can progress beyond <strong>New Application</strong>.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>University</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="hidden md:table-cell">Campus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((e: any) => {
                const availableStatuses = getAvailableStatuses(e.status);
                const isTransferred = e.status === "transferred";
                return (
                  <React.Fragment key={e.id}>
                    <TableRow className={isTransferred ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{e.universities?.name}</TableCell>
                      <TableCell>{e.courses?.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {e.campuses ? (
                          <span>{e.campuses.name}{e.campuses.city && <span className="text-xs text-muted-foreground/70"> · {e.campuses.city}</span>}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        {isTransferred ? (
                          <StatusBadge status="transferred" />
                        ) : role === "consultant" ? (
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <StatusBadge status={getDisplayStatus(e.status, role)} />
                              {canAgentBookAssessment(e.status) && hasSignedConsent && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAssessmentEnrollmentId(e.id)}>
                                  <CalendarDays className="w-3 h-3 mr-1" /> Book Assessment
                                </Button>
                              )}
                              {canAgentRequestCancel(e.status) && (
                                <Button variant="outline" size="sm" className="h-7 text-xs text-destructive border-destructive/30" onClick={() => setCancelEnrollmentId(e.id)}>
                                  <XCircle className="w-3 h-3 mr-1" /> Request Cancel
                                </Button>
                              )}
                            </div>
                            {e.assessment_date && (
                              <span className="text-xs text-muted-foreground">
                                Assessment: {format(new Date(e.assessment_date), "dd MMM yyyy")}{e.assessment_time && ` at ${e.assessment_time.slice(0, 5)}`}
                              </span>
                            )}
                          </div>
                        ) : canChangeStatus ? (
                          <div className="flex flex-col gap-1">
                            <Select value={e.status} onValueChange={(v) => {
                              if (v === "assessment_booked") {
                                setAssessmentEnrollmentId(e.id);
                              } else {
                                updateStatus.mutate({ id: e.id, status: v, oldStatus: e.status });
                              }
                            }}>
                              <SelectTrigger className="w-[180px] h-8">
                                <StatusBadge status={getDisplayStatus(e.status, role)} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableStatuses.map((s) => (
                                  <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {e.assessment_date && (
                              <span className="text-xs text-muted-foreground">
                                Assessment: {format(new Date(e.assessment_date), "dd MMM yyyy")}{e.assessment_time && ` at ${e.assessment_time.slice(0, 5)}`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <StatusBadge status={getDisplayStatus(e.status, role)} />
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(e.created_at), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {!isTransferred && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Transfer to another university" onClick={() => openTransferDialog(e)}>
                              <ArrowRightLeft className="w-4 h-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}>
                            {expandedId === e.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === e.id && e.course_id && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-2">
                          <CourseDetailsInfoCard courseId={e.course_id} compact />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
              {enrollments.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No enrollments</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transfer Enrollment Dialog */}
      <Dialog open={!!transferEnrollment} onOpenChange={(o) => { if (!o) setTransferEnrollment(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5" />
              Transfer Enrollment
            </DialogTitle>
          </DialogHeader>

          {transferEnrollment && transferStep === "select" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Transfer from <strong>{transferEnrollment.universities?.name}</strong> — <strong>{transferEnrollment.courses?.name}</strong> to a new university/course. The current enrollment will be marked as <strong>Transferred</strong> and preserved in history.
              </p>

              {!isOwner && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {role === "consultant"
                      ? "An approval code will be sent to your admin. You'll need to enter it to confirm."
                      : "An approval code will be sent to the owner. You'll need to enter it to confirm."}
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-3">
                <div>
                  <Label>New University *</Label>
                  <Select value={transferUniId} onValueChange={(v) => { setTransferUniId(v); setTransferCampusId(""); setTransferCourseId(""); setTransferIntakeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger>
                    <SelectContent>
                      {universities.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {transferUniId && campuses.length > 0 && (
                  <div>
                    <Label>Campus</Label>
                    <Select value={transferCampusId} onValueChange={(v) => { setTransferCampusId(v); setTransferCourseId(""); }}>
                      <SelectTrigger><SelectValue placeholder="Select campus" /></SelectTrigger>
                      <SelectContent>
                        {campuses.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {transferUniId && (
                  <div>
                    <Label>New Course *</Label>
                    <Select value={transferCourseId} onValueChange={setTransferCourseId}>
                      <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                      <SelectContent>
                        {courses.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {transferUniId && intakes.length > 0 && (
                  <div>
                    <Label>Intake</Label>
                    <Select value={transferIntakeId} onValueChange={setTransferIntakeId}>
                      <SelectTrigger><SelectValue placeholder="Select intake" /></SelectTrigger>
                      <SelectContent>
                        {intakes.map((i: any) => (
                          <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTransferEnrollment(null)}>Cancel</Button>
                <Button
                  onClick={isOwner ? handleOwnerTransfer : handleRequestCode}
                  disabled={!transferUniId || !transferCourseId || transferring}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {transferring ? "Processing…" : isOwner ? "Transfer Student" : "Request Transfer"}
                </Button>
              </div>
            </div>
          )}

          {transferEnrollment && transferStep === "code" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                An approval code has been sent to your {role === "consultant" ? "admin" : "owner"}. Enter the code below to complete the transfer.
              </p>

              <div>
                <Label>Approval Code</Label>
                <Input
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-character code"
                  maxLength={6}
                  className="font-mono text-center text-lg tracking-widest"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setTransferEnrollment(null)}>Cancel</Button>
                <Button
                  onClick={handleVerifyCode}
                  disabled={verificationCode.length < 6 || verifying}
                >
                  {verifying ? "Verifying…" : "Confirm Transfer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assessment Booking Dialog */}
      <AssessmentBookingDialog
        open={!!assessmentEnrollmentId}
        onOpenChange={(o) => { if (!o) setAssessmentEnrollmentId(null); }}
        onConfirm={handleBookAssessment}
        loading={bookingLoading}
      />

      {/* Cancellation Request Dialog */}
      <Dialog open={!!cancelEnrollmentId} onOpenChange={(o) => { if (!o) { setCancelEnrollmentId(null); setCancelReason(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              Request Cancellation
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will send a cancellation request to your admin for approval. The enrollment will only be cancelled after approval.
          </p>
          <div>
            <Label>Reason (optional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Why should this enrollment be cancelled?"
              className="mt-1"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setCancelEnrollmentId(null); setCancelReason(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleRequestCancel} disabled={cancelLoading}>
              {cancelLoading ? "Submitting…" : "Submit Request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
