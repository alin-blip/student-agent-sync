import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, User, FileText, GraduationCap, DollarSign, MessageSquare, Sparkles, ShieldCheck, ShieldAlert, Lock } from "lucide-react";
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Link } from "react-router-dom";
import { StudentOverviewTab } from "@/components/student-detail/StudentOverviewTab";
import { StudentDocumentsTab } from "@/components/student-detail/StudentDocumentsTab";
import { StudentEnrollmentsTab } from "@/components/student-detail/StudentEnrollmentsTab";
import { StudentFundingTab } from "@/components/student-detail/StudentFundingTab";
import { StudentNotesTab } from "@/components/student-detail/StudentNotesTab";
import { StudentAIDocumentsTab } from "@/components/student-detail/StudentAIDocumentsTab";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { role, user } = useAuth();
  const navigate = useNavigate();
  const prefix = role === "owner" ? "/owner" : role === "branch_manager" ? "/branch" : "/consultant";

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Check if any enrollment is in a locked status (for agents)
  const LOCKED_STATUSES = ["enrolled", "active", "rejected", "withdrawn"];
  const { data: hasLockedEnrollment } = useQuery({
    queryKey: ["student-locked-enrollment", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status")
        .eq("student_id", id!)
        .in("status", LOCKED_STATUSES)
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!id,
  });

  const { data: agentProfile } = useQuery({
    queryKey: ["agent-profile", student?.agent_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, admin_id").eq("id", student!.agent_id).single();
      return data;
    },
    enabled: !!student?.agent_id,
  });

  const { data: adminProfile } = useQuery({
    queryKey: ["admin-profile-for-student", agentProfile?.admin_id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", agentProfile!.admin_id!).single();
      return data;
    },
    enabled: !!agentProfile?.admin_id,
  });

  const { data: hasConsent } = useQuery({
    queryKey: ["student-consent-status", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_documents")
        .select("id")
        .eq("student_id", id!)
        .eq("doc_type", "Consent Form")
        .limit(1);
      return (data && data.length > 0) || false;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div></DashboardLayout>;
  }
  if (!student) {
    return <DashboardLayout><div className="flex items-center justify-center py-20 text-muted-foreground">Student not found</div></DashboardLayout>;
  }

  const isAgentLocked = role === "consultant" && hasLockedEnrollment === true;
  const canEdit = !isAgentLocked && (role === "owner" || role === "branch_manager" || (role === "consultant" && student.agent_id === user?.id));
  const canChangeStatus = role === "owner" || role === "branch_manager";

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild><Link to={`${prefix}/students`}>Students</Link></BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{student.first_name} {student.last_name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`${prefix}/students`)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {student.title ? `${student.title} ` : ""}{student.first_name} {student.last_name}
          </h1>
          {hasConsent === true ? (
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 border-green-200">
              <ShieldCheck className="w-3 h-3" />
              Consent Signed
            </Badge>
          ) : hasConsent === false ? (
            <Badge variant="secondary" className="gap-1 bg-orange-100 text-orange-700 border-orange-200">
              <ShieldAlert className="w-3 h-3" />
              No Consent
            </Badge>
          ) : null}
        </div>

        {isAgentLocked && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <Lock className="w-4 h-4 shrink-0" />
            <span>This student's record is locked because an enrollment has reached a final status. Contact admin to make changes.</span>
          </div>
        )}

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="gap-1.5"><User className="w-3.5 h-3.5" /> Overview</TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> Documents</TabsTrigger>
            <TabsTrigger value="enrollments" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> Enrollments</TabsTrigger>
            <TabsTrigger value="funding" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Funding</TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Notes</TabsTrigger>
            <TabsTrigger value="ai-docs" className="gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <StudentOverviewTab student={student} agentName={agentProfile?.full_name || ""} adminName={adminProfile?.full_name || ""} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="documents">
            <StudentDocumentsTab student={student} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="enrollments">
            <StudentEnrollmentsTab studentId={student.id} canChangeStatus={canChangeStatus} />
          </TabsContent>

          <TabsContent value="funding">
            <StudentFundingTab studentId={student.id} canEdit={canChangeStatus} student={student} />
          </TabsContent>

          <TabsContent value="notes">
            <StudentNotesTab studentId={student.id} studentName={`${student.first_name} ${student.last_name}`} canSendRequests={canChangeStatus} />
          </TabsContent>

          <TabsContent value="ai-docs">
            <StudentAIDocumentsTab studentId={student.id} studentName={`${student.first_name} ${student.last_name}`} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
