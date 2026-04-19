import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Calendar, Upload, FileText, X, Eye, MessageSquare, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { CourseDetailsInfoCard } from "@/components/CourseDetailsInfoCard";
import { syncToDrive } from "@/lib/drive-sync";
import { AddressLookupInput } from "@/components/AddressLookupInput";

const IMMIGRATION_OPTIONS = ["Pre-settled", "Settled", "British Citizen", "Visa Holder", "Refugee", "Other"];
const TITLE_OPTIONS = ["Mr", "Mrs", "Ms", "Miss", "Dr", "Other"];
const GENDER_OPTIONS = ["Male", "Female", "Other", "Prefer not to say"];
const STUDY_PATTERNS_FALLBACK = ["Weekdays", "Weekend", "Evenings"];
const RELATIONSHIP_OPTIONS = ["Parent", "Spouse", "Sibling", "Friend", "Other"];
const DOC_TYPES_ENROLL = ["Passport", "Proof of Address", "Other"];

function sanitizeName(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
}

export default function EnrollStudent() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);

  // Step 1 — pre-fill from URL params if provided
  const [universityId, setUniversityId] = useState(searchParams.get("university") || "");
  const [campusId, setCampusId] = useState("");
  const [courseId, setCourseId] = useState(searchParams.get("course") || "");
  const [intakeId, setIntakeId] = useState("");
  const [studyPattern, setStudyPattern] = useState<string[]>([]);

  // Step 2
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nationality, setNationality] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fullAddress, setFullAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [ukEntryDate, setUkEntryDate] = useState("");
  const [immigrationStatus, setImmigrationStatus] = useState("");
  const [shareCode, setShareCode] = useState("");
  const [niNumber, setNiNumber] = useState("");
  const [previousFundingYears, setPreviousFundingYears] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [notes, setNotes] = useState("");
  const [crn, setCrn] = useState("");

  // Step 3
  const [nokName, setNokName] = useState("");
  const [nokPhone, setNokPhone] = useState("");
  const [nokRelationship, setNokRelationship] = useState("");

  // Step 4 — Documents
  const [docFiles, setDocFiles] = useState<{ file: File; docType: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedDocType, setSelectedDocType] = useState("Passport");

  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [contactingAdmin, setContactingAdmin] = useState(false);

  const { data: universities = [] } = useQuery({
    queryKey: ["universities"],
    queryFn: async () => {
      const { data } = await supabase.from("universities").select("*").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: campuses = [] } = useQuery({
    queryKey: ["campuses", universityId],
    queryFn: async () => {
      const { data } = await supabase.from("campuses").select("*").eq("university_id", universityId).order("name");
      return data || [];
    },
    enabled: !!universityId,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses", universityId],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("*").eq("university_id", universityId).order("name");
      return data || [];
    },
    enabled: !!universityId,
  });

  const { data: intakes = [] } = useQuery({
    queryKey: ["intakes", universityId],
    queryFn: async () => {
      const { data } = await supabase.from("intakes").select("*").eq("university_id", universityId).order("start_date");
      return data || [];
    },
    enabled: !!universityId,
  });

  const { data: campusCourseIds = [] } = useQuery({
    queryKey: ["campus-courses", campusId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_timetable_groups")
        .select("course_id")
        .eq("campus_id", campusId);
      return [...new Set((data || []).map((r: any) => r.course_id))];
    },
    enabled: !!campusId,
  });

  const filteredCourses = campusCourseIds.length > 0
    ? courses.filter((c: any) => campusCourseIds.includes(c.id))
    : courses;

  const { data: courseTimetableGroups = [] } = useQuery({
    queryKey: ["course-timetable-groups", courseId, campusId],
    queryFn: async () => {
      let query = supabase
        .from("course_timetable_groups")
        .select("id, timetable_option_id, timetable_options(id, label)")
        .eq("course_id", courseId);
      if (campusId) {
        query = query.eq("campus_id", campusId);
      }
      const { data } = await query;
      return (data || []).map((row: any) => ({
        id: row.timetable_option_id,
        label: row.timetable_options?.label || "Unknown",
      }));
    },
    enabled: !!courseId,
  });

  const { data: universityTimetableOptions = [] } = useQuery({
    queryKey: ["timetable-options", universityId],
    queryFn: async () => {
      const { data } = await supabase.from("timetable_options").select("id, label").eq("university_id", universityId).order("label");
      return data || [];
    },
    enabled: !!universityId,
  });

  const displayTimetableOptions = courseId
    ? (courseTimetableGroups.length > 0 ? courseTimetableGroups : null)
    : (universityTimetableOptions.length > 0 ? universityTimetableOptions : null);

  const handleAddFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setDocFiles((prev) => [...prev, { file, docType: selectedDocType }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      // Duplicate check by email
      if (email.trim()) {
        const { data: existingByEmail } = await supabase
          .from("students")
          .select("id")
          .ilike("email", email.trim())
          .limit(1);
        if (existingByEmail?.length) {
          throw new Error("DUPLICATE:A student with this email already exists in the system.");
        }
      }
      // Duplicate check by phone
      if (phone.trim()) {
        const { data: existingByPhone } = await supabase
          .from("students")
          .select("id")
          .eq("phone", phone.trim())
          .limit(1);
        if (existingByPhone?.length) {
          throw new Error("DUPLICATE:A student with this phone number already exists in the system.");
        }
      }
      // Duplicate check by name + DOB
      if (firstName.trim() && lastName.trim() && dob) {
        const { data: existingByName } = await supabase
          .from("students")
          .select("id")
          .ilike("first_name", firstName.trim())
          .ilike("last_name", lastName.trim())
          .eq("date_of_birth", dob)
          .limit(1);
        if (existingByName?.length) {
          throw new Error("DUPLICATE:A student with this name and date of birth already exists in the system.");
        }
      }

      const { data: student, error: studentError } = await supabase
        .from("students")
        .insert({
          agent_id: user!.id,
          title: title || null, first_name: firstName, last_name: lastName,
          nationality: nationality || null, gender: gender || null,
          email: email || null, phone: phone || null, date_of_birth: dob || null,
          full_address: fullAddress || null, uk_entry_date: ukEntryDate || null,
          immigration_status: immigrationStatus || null, share_code: shareCode || null,
          ni_number: niNumber || null,
          previous_funding_years: previousFundingYears ? parseInt(previousFundingYears) : null,
          study_pattern: studyPattern.length > 0 ? studyPattern.join(", ") : null,
           qualifications: qualifications || null, notes: notes || null,
           crn: crn || null,
          next_of_kin_name: nokName || null, next_of_kin_phone: nokPhone || null,
          next_of_kin_relationship: nokRelationship || null,
        } as any)
        .select("id")
        .single();
      if (studentError) throw studentError;

      const { error: enrollError } = await supabase.from("enrollments").insert({
        student_id: student.id, university_id: universityId,
        campus_id: campusId || null, course_id: courseId, intake_id: intakeId || null,
        status: "new_application",
      });
      if (enrollError) throw enrollError;

      // Upload documents
      if (docFiles.length > 0) {
        for (const { file, docType } of docFiles) {
          const ext = file.name.split(".").pop();
          const storagePath = `${student.id}/${docType}_${Date.now()}.${ext}`;
          const { error: uploadError } = await supabase.storage.from("student-documents").upload(storagePath, file);
          if (uploadError) throw uploadError;
          await supabase.from("student_documents").insert({
            student_id: student.id, agent_id: user!.id, doc_type: docType,
            file_name: file.name, file_path: storagePath, file_size: file.size, uploaded_by: user!.id,
          });
        }
      }

      // Sync to Google Drive (non-blocking)
      syncToDrive("student_created", student.id);

      return student.id;
    },
    onSuccess: async (studentId) => {
      queryClient.invalidateQueries({ queryKey: ["agent-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      toast({ title: "Student enrolled!", description: "The application has been submitted." });

      const selectedUni = universities.find((u: any) => u.id === universityId);
      const selectedCrs = courses.find((c: any) => c.id === courseId);
      const studentName = `${firstName} ${lastName}`;
      const navPrefix = role === "owner" ? "/owner" : role === "branch_manager" ? "/branch" : "/consultant";
      const studentUrl = `${window.location.origin}/owner/students/${studentId}`;

      try {
        const recipients: string[] = [];
        const { data: agentProfile } = await supabase
          .from("profiles")
          .select("full_name, admin_id")
          .eq("id", user!.id)
          .single();
        const agentName = agentProfile?.full_name || user!.email || "Agent";
        if (agentProfile?.admin_id) {
          const { data: adminProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", agentProfile.admin_id)
            .single();
          if (adminProfile?.email) recipients.push(adminProfile.email);
        }
        const { data: ownerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner");
        if (ownerRoles) {
          for (const ownerRole of ownerRoles) {
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("email")
              .eq("id", ownerRole.user_id)
              .single();
            if (ownerProfile?.email && !recipients.includes(ownerProfile.email)) {
              recipients.push(ownerProfile.email);
            }
          }
        }
        for (const recipientEmail of recipients) {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "new-student-assigned",
              recipientEmail,
              idempotencyKey: `new-student-${studentId}-${recipientEmail}`,
              templateData: {
                studentName,
                universityName: selectedUni?.name,
                courseName: selectedCrs?.name,
                agentName,
                studentUrl,
              },
            },
          });
        }
      } catch (err) {
        console.error("Failed to send new student notification:", err);
      }

      // Auto-send consent signing link to student if they have an email
      if (email.trim()) {
        try {
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke("create-consent-token", {
            body: { student_id: studentId },
          });
          if (!tokenError && tokenData?.signing_url) {
            const studentFullName = `${title ? title + " " : ""}${firstName} ${lastName}`;
            const { data: agentProfileData } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", user!.id)
              .single();

            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "consent-signing-link",
                recipientEmail: email.trim(),
                idempotencyKey: `consent-link-${studentId}-${Date.now()}`,
                templateData: {
                  studentName: studentFullName,
                  agentName: agentProfileData?.full_name || "EduForYou UK",
                  signingUrl: tokenData.signing_url,
                },
              },
            });
          }
        } catch (consentErr) {
          console.error("Failed to auto-send consent link:", consentErr);
        }
      }

      navigate(`${navPrefix}/students/${studentId}`);
    },
    onError: (error: any) => {
      if (error.message?.startsWith("DUPLICATE:")) {
        setDuplicateError(error.message.replace("DUPLICATE:", ""));
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    },
  });

  const handleContactAdmin = async () => {
    if (!user) return;
    setContactingAdmin(true);
    try {
      const { data: agentProfile } = await supabase
        .from("profiles")
        .select("admin_id, full_name")
        .eq("id", user.id)
        .single();

      let targetId: string | null = agentProfile?.admin_id || null;

      if (!targetId) {
        const { data: ownerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner")
          .limit(1);
        if (ownerRoles?.length) targetId = ownerRoles[0].user_id;
      }

      if (!targetId) {
        toast({ title: "Error", description: "No admin or owner found to contact.", variant: "destructive" });
        return;
      }

      const { data: existingConv } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${targetId}),and(participant_1.eq.${targetId},participant_2.eq.${user.id})`)
        .limit(1);

      let conversationId: string;
      if (existingConv?.length) {
        conversationId = existingConv[0].id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from("direct_conversations")
          .insert({ participant_1: user.id, participant_2: targetId })
          .select("id")
          .single();
        if (convErr || !newConv) throw convErr || new Error("Failed to create conversation");
        conversationId = newConv.id;
      }

      const agentName = agentProfile?.full_name || user.email || "An agent";
      await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: `⚠️ Duplicate student detected: ${agentName} has a student that shows as duplicate (${firstName} ${lastName}${email ? ', ' + email : ''}${phone ? ', ' + phone : ''}). Please check and contact the agent.`,
      });

      toast({ title: "Message sent!", description: "Your admin has been notified about the duplicate student." });
      setDuplicateError(null);
    } catch (err) {
      console.error("Failed to contact admin:", err);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
    } finally {
      setContactingAdmin(false);
    }
  };

  const canProceedStep1 = universityId && courseId;
  const canProceedStep2 = firstName && lastName && nationality && gender && dob && email && phone && fullAddress && immigrationStatus;
  const canProceedStep3 = nokName && nokPhone && nokRelationship;

  const selectedUniversity = universities.find((u: any) => u.id === universityId);
  const selectedCampus = campuses.find((c: any) => c.id === campusId);
  const selectedCourse = courses.find((c: any) => c.id === courseId);
  const selectedIntake = intakes.find((i: any) => i.id === intakeId);

  const prefix = role === "owner" ? "/owner" : role === "branch_manager" ? "/branch" : "/consultant";
  const totalSteps = 5;

  return (
    <DashboardLayout allowedRoles={["consultant", "branch_manager", "owner"]}>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">New Student Enrollment</h1>
        </div>

        {duplicateError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Duplicate Student Detected</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{duplicateError}</p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleContactAdmin}
                  disabled={contactingAdmin}
                >
                  <MessageSquare className="w-4 h-4 mr-1" />
                  {contactingAdmin ? "Sending..." : "Contact Admin"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDuplicateError(null)}>
                  Dismiss
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
          {[1, 2, 3, 4, 5].map((s) => (
            <div key={s} className="flex items-center gap-1 sm:gap-2">
              <div
                className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-colors ${
                  s === step ? "bg-accent text-accent-foreground"
                    : s < step ? "bg-accent/20 text-accent"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s < step ? <Check className="w-3 h-3 sm:w-4 sm:h-4" /> : s}
              </div>
              {s < totalSteps && <div className={`w-4 sm:w-8 h-0.5 ${s < step ? "bg-accent" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Institution & Course */}
        {step === 1 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Institution & Course</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>University *</Label>
                <Select value={universityId} onValueChange={(v) => { setUniversityId(v); setCampusId(""); setCourseId(""); setIntakeId(""); }}>
                  <SelectTrigger><SelectValue placeholder="Select university" /></SelectTrigger>
                  <SelectContent>{universities.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {universityId && (
                <>
                  <div className="space-y-2">
                    <Label>Campus</Label>
                    <Select value={campusId} onValueChange={(v) => { setCampusId(v); setCourseId(""); setStudyPattern([]); }}>
                      <SelectTrigger><SelectValue placeholder="Select campus (optional)" /></SelectTrigger>
                      <SelectContent>{campuses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.city ? ` — ${c.city}` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Course *</Label>
                  <Select value={courseId} onValueChange={(v) => { setCourseId(v); setStudyPattern([]); }}>
                    <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                    <SelectContent>{filteredCourses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.level})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Intake Date</Label>
                    <Select value={intakeId} onValueChange={setIntakeId}>
                      <SelectTrigger><SelectValue placeholder="Select intake (optional)" /></SelectTrigger>
                      <SelectContent>{intakes.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Study Pattern / Timetable Group</Label>
                    {(selectedUniversity as any)?.timetable_available === false ? (
                      <div className="p-3 rounded-md bg-muted text-sm text-muted-foreground border">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        {(selectedUniversity as any)?.timetable_message || "Timetable will be assigned by the university."}
                      </div>
                    ) : displayTimetableOptions ? (
                      <>
                        <p className="text-xs text-muted-foreground">Classes currently available. Please note these may fill up, and you may be offered other options after the admission test.</p>
                        <div className="flex flex-wrap gap-3">
                        {displayTimetableOptions.map((g) => (
                          <label key={g.id} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={studyPattern.includes(g.label)}
                              onCheckedChange={(checked) =>
                                setStudyPattern(checked ? [...studyPattern, g.label] : studyPattern.filter((p) => p !== g.label))
                              }
                            />
                            {g.label}
                          </label>
                        ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex gap-4">
                        {STUDY_PATTERNS_FALLBACK.map((sp) => (
                          <label key={sp} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={studyPattern.includes(sp)} onCheckedChange={(checked) => setStudyPattern(checked ? [...studyPattern, sp] : studyPattern.filter((p) => p !== sp))} />
                            {sp}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              {courseId && <CourseDetailsInfoCard courseId={courseId} compact />}
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)} disabled={!canProceedStep1} className="bg-accent text-accent-foreground hover:bg-accent/90">
                  Next <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2 — Applicant Details */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Applicant Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Select value={title} onValueChange={setTitle}>
                    <SelectTrigger><SelectValue placeholder="Title" /></SelectTrigger>
                    <SelectContent>{TITLE_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>First Name *</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="John" /></div>
                <div className="space-y-2"><Label>Last Name *</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Nationality *</Label><Input value={nationality} onChange={(e) => setNationality(e.target.value)} placeholder="e.g. British" /></div>
                <div className="space-y-2">
                  <Label>Gender *</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>{GENDER_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Date of Birth *</Label><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
                <div className="space-y-2"><Label>Email *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@example.com" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Mobile No *</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44..." /></div>
                <div className="space-y-2"><Label>UK Entry Date</Label><Input type="date" value={ukEntryDate} onChange={(e) => setUkEntryDate(e.target.value)} /></div>
              </div>
              <AddressLookupInput postcode={postcode} address={fullAddress} onPostcodeChange={setPostcode} onAddressChange={setFullAddress} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Immigration Status *</Label>
                  <Select value={immigrationStatus} onValueChange={setImmigrationStatus}>
                    <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>{IMMIGRATION_OPTIONS.map((opt) => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Sharecode</Label><Input value={shareCode} onChange={(e) => setShareCode(e.target.value)} placeholder="Share code" /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>NI Number</Label><Input value={niNumber} onChange={(e) => setNiNumber(e.target.value)} placeholder="e.g. QQ 12 34 56 C" /></div>
                <div className="space-y-2"><Label>Previous Funding (years)</Label><Input type="number" min="0" value={previousFundingYears} onChange={(e) => setPreviousFundingYears(e.target.value)} placeholder="0" /></div>
              </div>
              {previousFundingYears && parseInt(previousFundingYears) > 0 && (
                <div className="space-y-2">
                  <Label>CRN (Customer Reference Number)</Label>
                  <Input value={crn} onChange={(e) => setCrn(e.target.value)} placeholder="e.g. 1234567890" />
                  <p className="text-xs text-muted-foreground">Student's SFE reference number</p>
                </div>
              )}
              <div className="space-y-2"><Label>Qualifications</Label><Textarea value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Previous qualifications…" /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes…" /></div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(3)} disabled={!canProceedStep2} className="bg-accent text-accent-foreground hover:bg-accent/90">Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3 — Next of Kin */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Next of Kin Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={nokName} onChange={(e) => setNokName(e.target.value)} placeholder="Full name" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Telephone Number *</Label><Input value={nokPhone} onChange={(e) => setNokPhone(e.target.value)} placeholder="+44..." /></div>
                <div className="space-y-2">
                  <Label>Relationship *</Label>
                  <Select value={nokRelationship} onValueChange={setNokRelationship}>
                    <SelectTrigger><SelectValue placeholder="Select relationship" /></SelectTrigger>
                    <SelectContent>{RELATIONSHIP_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(4)} disabled={!canProceedStep3} className="bg-accent text-accent-foreground hover:bg-accent/90">Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4 — Document Upload */}
        {step === 4 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Upload Documents</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload supporting documents (ID/Passport, Proof of Address, etc.). You can also upload documents later from the student profile.</p>
              <div className="flex items-center gap-2">
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_TYPES_ENROLL.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-1" /> Add File
                </Button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleAddFile} />
              </div>
              {docFiles.length > 0 && (
                <div className="space-y-2">
                  {docFiles.map((df, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{df.docType}</p>
                          <p className="text-xs text-muted-foreground">{df.file.name} • {(df.file.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeFile(i)}>
                        <X className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(5)} className="bg-accent text-accent-foreground hover:bg-accent/90">Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5 — Review & Submit */}
        {step === 5 && (
          <Card>
            <CardHeader><CardTitle className="text-lg">Review & Submit</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Institution & Course</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">University</span><span className="font-medium">{selectedUniversity?.name}</span>
                {selectedCampus && (<><span className="text-muted-foreground">Campus</span><span className="font-medium">{selectedCampus.name}</span></>)}
                <span className="text-muted-foreground">Course</span><span className="font-medium">{selectedCourse?.name}</span>
                {selectedIntake && (<><span className="text-muted-foreground">Intake</span><span className="font-medium">{selectedIntake.label}</span></>)}
                {studyPattern.length > 0 && (<><span className="text-muted-foreground">Study Pattern</span><span className="font-medium">{studyPattern.join(", ")}</span></>)}
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Applicant Details</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Name</span><span className="font-medium">{title ? `${title} ` : ""}{firstName} {lastName}</span>
                <span className="text-muted-foreground">Nationality</span><span className="font-medium">{nationality}</span>
                <span className="text-muted-foreground">Gender</span><span className="font-medium">{gender}</span>
                <span className="text-muted-foreground">Date of Birth</span><span className="font-medium">{dob}</span>
                <span className="text-muted-foreground">Email</span><span className="font-medium">{email}</span>
                <span className="text-muted-foreground">Mobile</span><span className="font-medium">{phone}</span>
                <span className="text-muted-foreground">Address</span><span className="font-medium">{fullAddress}</span>
                <span className="text-muted-foreground">Immigration</span><span className="font-medium">{immigrationStatus}</span>
                {crn && (<><span className="text-muted-foreground">CRN</span><span className="font-medium">{crn}</span></>)}
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Next of Kin</h3>
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <span className="text-muted-foreground">Name</span><span className="font-medium">{nokName}</span>
                <span className="text-muted-foreground">Phone</span><span className="font-medium">{nokPhone}</span>
                <span className="text-muted-foreground">Relationship</span><span className="font-medium">{nokRelationship}</span>
              </div>

              {docFiles.length > 0 && (
                <>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">Documents ({docFiles.length})</h3>
                  <div className="space-y-1">
                    {docFiles.map((df, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">{df.docType}</span>
                        <span className="text-muted-foreground">— {df.file.name}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center gap-2 p-3 rounded-lg border bg-accent/10 text-sm">
                <span className="text-muted-foreground">📧 A consent form signing link will be automatically sent to the student's email after enrollment.</span>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={() => setStep(4)}><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 active:scale-[0.98]"
                >
                  {submitMutation.isPending ? "Submitting…" : "Submit Enrollment"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
