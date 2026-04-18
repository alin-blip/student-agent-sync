import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, UserCheck, ClipboardList, PoundSterling, Clock } from "lucide-react";
import { CancellationRequestsSection } from "@/components/CancellationRequestsSection";
import { PromoBanner } from "@/components/PromoBanner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { CommissionOfferCards } from "@/components/CommissionOfferCards";
import { DashboardSearchCard } from "@/components/DashboardSearchCard";
import { ExportToSheetsButton } from "@/components/ExportToSheetsButton";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active")
        .eq("admin_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, first_name, last_name, agent_id, created_at");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["admin-enrollments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select(`id, status, created_at, students!inner(first_name, last_name), universities!inner(name), courses!inner(name)`)
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!user,
  });

  // Admin commission data
  const { data: adminSnapshots = [] } = useQuery({
    queryKey: ["admin-commission-snapshots", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_snapshots")
        .select("id, admin_rate, agent_rate, snapshot_status, agent_id")
        .not("admin_id", "is", null);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const { data: adminPayments = [] } = useQuery({
    queryKey: ["admin-commission-payments", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("recipient_id", user!.id)
        .eq("recipient_role", "admin");
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const { data: adminSettings } = useQuery({
    queryKey: ["admin-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_commission_settings")
        .select("rate_per_student")
        .eq("admin_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const agentIds = new Set(agents.map((a: any) => a.id));
  const teamSnapshots = adminSnapshots.filter((s: any) => agentIds.has(s.agent_id));
  const adminTotalOwed = teamSnapshots.reduce((s: number, snap: any) => s + Number(snap.admin_rate), 0);
  const adminTotalPaid = adminPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
  const adminRemaining = adminTotalOwed - adminTotalPaid;

  return (
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <PromoBanner />
        <CommissionOfferCards />
        <DashboardSearchCard />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Team Dashboard</h1>
          <ExportToSheetsButton />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="My Agents" value={agents.length} icon={UserCheck} />
          <MetricCard title="Team Students" value={students.length} icon={Users} />
          <MetricCard title="Team Enrollments" value={enrollments.length} icon={ClipboardList} />
          <MetricCard title="My Commission" value={`£${adminTotalOwed.toLocaleString()}`} icon={PoundSterling} description={`£${adminTotalPaid.toLocaleString()} paid`} />
        </div>

        {/* Admin commission card */}
        <Card className="border bg-card">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Your Commission Summary</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Rate: £{adminSettings?.rate_per_student ?? 100}/student | Eligible students: {teamSnapshots.length} | Remaining: £{adminRemaining.toLocaleString()}
                </p>
              </div>
              <Badge variant="outline" className="bg-muted">
                <Clock className="w-3 h-3 mr-1" /> {teamSnapshots.filter((s: any) => s.snapshot_status === "ready_full").length} ready for payment
              </Badge>
            </div>
          </CardContent>
        </Card>

        <CancellationRequestsSection />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">My Agents</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{a.email}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${a.is_active ? "text-green-600" : "text-red-500"}`}>
                        {a.is_active ? "Active" : "Inactive"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {agents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No agents assigned to you yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Team Students */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Team Students</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Date Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((s: any) => {
                  const agent = agents.find((a: any) => a.id === s.agent_id);
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/admin/students/${s.id}`)}
                    >
                      <TableCell className="font-medium">{s.first_name} {s.last_name}</TableCell>
                      <TableCell className="text-muted-foreground">{agent?.full_name || "Unknown"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                      No students yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Recent Enrollments</h2>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>University</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.students?.first_name} {e.students?.last_name}</TableCell>
                    <TableCell>{e.universities?.name}</TableCell>
                    <TableCell>{e.courses?.name}</TableCell>
                    <TableCell><StatusBadge status={e.status} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{format(new Date(e.created_at), "dd MMM yyyy")}</TableCell>
                  </TableRow>
                ))}
                {enrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No enrollments yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
