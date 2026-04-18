import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Users, UserCheck, ClipboardList, PoundSterling, TrendingUp, Target, Trophy } from "lucide-react";
import { calcCommission } from "@/lib/commissions";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, subMonths, startOfMonth } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import {
  ChartContainer, ChartTooltipContent, ChartConfig,
} from "@/components/ui/chart";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { PromoBanner } from "@/components/PromoBanner";
import { EmailLogSection } from "@/components/EmailLogSection";
import { DashboardSearchCard } from "@/components/DashboardSearchCard";
import { CancellationRequestsSection } from "@/components/CancellationRequestsSection";
import { ExportToSheetsButton } from "@/components/ExportToSheetsButton";

const teamChartConfig: ChartConfig = {
  students: { label: "Students", color: "hsl(var(--primary))" },
  enrollments: { label: "Enrollments", color: "hsl(var(--accent))" },
};

const pipelineChartConfig: ChartConfig = {
  count: { label: "Enrollments", color: "hsl(var(--primary))" },
};

const trendChartConfig: ChartConfig = {
  count: { label: "New Enrollments", color: "hsl(var(--primary))" },
};

const DONUT_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 71% 45%)",
  "hsl(38 92% 50%)",
  "hsl(280 65% 60%)",
  "hsl(200 80% 50%)",
  "hsl(350 80% 55%)",
  "hsl(170 60% 45%)",
];

const PIPELINE_STATUSES = [
  "new_application", "processing", "assessment_booked", "pass",
  "additional_requirements", "final_offer", "enrolled",
  "commission_25_ready", "commission_paid",
];

const STATUS_LABELS: Record<string, string> = {
  new_application: "New Application",
  processing: "Processing",
  assessment_booked: "Assessment Booked",
  pass: "Pass",
  additional_requirements: "Additional Req.",
  final_offer: "Final Offer",
  enrolled: "Enrolled",
  commission_25_ready: "Comm. 25% Ready",
  commission_paid: "Comm. Paid",
};

export default function OwnerDashboard() {
  const [openAdmins, setOpenAdmins] = useState<Set<string>>(new Set());
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [filterAdmin, setFilterAdmin] = useState<string>("all");

  const { data: students = [] } = useQuery({
    queryKey: ["owner-students-all"],
    queryFn: async () => {
      const { data } = await supabase.from("students").select("id, agent_id");
      return data || [];
    },
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["owner-revenue-snapshots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_snapshots")
        .select("id, agent_rate, admin_rate, override_amount, snapshot_status, enrollment_id, university_id")
        .neq("snapshot_status", "cancelled");
      return (data || []) as any[];
    },
  });

  const { data: snapshotPayments = [] } = useQuery({
    queryKey: ["owner-revenue-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_payments")
        .select("id, amount");
      return (data || []) as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["owner-profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, is_active, admin_id, created_at")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: recentEnrollments = [] } = useQuery({
    queryKey: ["owner-enrollments-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select(`
          id, status, created_at,
          students!inner(first_name, last_name, agent_id),
          universities!inner(name),
          courses!inner(name)
        `)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const { data: allEnrollments = [] } = useQuery({
    queryKey: ["owner-enrollments-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, status, student_id, created_at, university_id");
      return data || [];
    },
  });

  const { data: universities = [] } = useQuery({
    queryKey: ["owner-universities"],
    queryFn: async () => {
      const { data } = await supabase.from("universities").select("id, name");
      return data || [];
    },
  });

  const { data: leads = [] } = useQuery({
    queryKey: ["owner-leads-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("id, status, agent_id");
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["owner-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data || [];
    },
  });

  const { data: tiers = [] } = useQuery({
    queryKey: ["commission-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("commission_tiers").select("*").order("min_students");
      return data || [];
    },
  });

  const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));
  const admins = profiles.filter((p: any) => roleMap.get(p.id) === "admin");
  const agents = profiles.filter((p: any) => roleMap.get(p.id) === "agent");
  const activeAgents = agents.filter((a: any) => a.is_active);

  const studentAgentMap = new Map(students.map((s: any) => [s.id, s.agent_id]));

  const agentActiveEnrollments = new Map<string, number>();
  const agentTotalEnrollments = new Map<string, number>();
  for (const e of allEnrollments) {
    const agentId = studentAgentMap.get((e as any).student_id);
    if (agentId) {
      agentTotalEnrollments.set(agentId, (agentTotalEnrollments.get(agentId) || 0) + 1);
      if (e.status === "enrolled") {
        agentActiveEnrollments.set(agentId, (agentActiveEnrollments.get(agentId) || 0) + 1);
      }
    }
  }

  const agentStudentCounts = new Map<string, number>();
  for (const s of students) {
    agentStudentCounts.set(s.agent_id, (agentStudentCounts.get(s.agent_id) || 0) + 1);
  }

  const pipelineCount = allEnrollments.filter((e: any) => !["fail", "withdrawn", "cancelled", "transferred"].includes(e.status)).length;

  const totalLeads = leads.length;
  const convertedLeads = leads.filter((l: any) => l.status === "converted").length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const agentLeadCounts = new Map<string, number>();
  for (const l of leads) {
    agentLeadCounts.set((l as any).agent_id, (agentLeadCounts.get((l as any).agent_id) || 0) + 1);
  }
  const agentConvertedLeads = new Map<string, number>();
  for (const l of leads.filter((l: any) => l.status === "converted")) {
    agentConvertedLeads.set((l as any).agent_id, (agentConvertedLeads.get((l as any).agent_id) || 0) + 1);
  }

  const totalSnapshotRevenue = snapshots.reduce((sum: number, s: any) => {
    const effectiveRate = s.override_amount != null ? Number(s.override_amount) : Number(s.agent_rate);
    return sum + effectiveRate + Number(s.admin_rate);
  }, 0);
  const totalPaidOut = snapshotPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

  const totalRevenue = activeAgents.reduce((sum: number, agent: any) => {
    const count = agentActiveEnrollments.get(agent.id) || 0;
    const { amount } = calcCommission(count, tiers);
    return sum + amount;
  }, 0);

  // === NEW: Pipeline data ===
  const pipelineData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const status of PIPELINE_STATUSES) counts[status] = 0;
    for (const e of allEnrollments) {
      if (PIPELINE_STATUSES.includes(e.status)) {
        counts[e.status] = (counts[e.status] || 0) + 1;
      }
    }
    return PIPELINE_STATUSES.map((s) => ({
      status: STATUS_LABELS[s] || s,
      count: counts[s],
    }));
  }, [allEnrollments]);

  // === NEW: Monthly trend (last 6 months) ===
  const monthlyTrendData = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(startOfMonth(d), "yyyy-MM");
      months.push({ key, label: format(d, "MMM yyyy"), count: 0 });
    }
    for (const e of allEnrollments) {
      const key = (e as any).created_at?.substring(0, 7);
      const m = months.find((m) => m.key === key);
      if (m) m.count++;
    }
    return months;
  }, [allEnrollments]);

  // === NEW: Revenue per university ===
  const uniMap = useMemo(() => new Map(universities.map((u: any) => [u.id, u.name])), [universities]);
  const revenueByUni = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of snapshots) {
      const uniName = uniMap.get(s.university_id) || "Unknown";
      const effectiveRate = s.override_amount != null ? Number(s.override_amount) : Number(s.agent_rate);
      const total = effectiveRate + Number(s.admin_rate);
      map.set(uniName, (map.get(uniName) || 0) + total);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [snapshots, uniMap]);

  // === NEW: Top 5 agents leaderboard ===
  const topAgents = useMemo(() => {
    const agentList = agents.map((a: any) => ({
      name: a.full_name || a.email,
      enrollments: agentTotalEnrollments.get(a.id) || 0,
      active: agentActiveEnrollments.get(a.id) || 0,
    }));
    agentList.sort((a, b) => b.enrollments - a.enrollments);
    return agentList.slice(0, 5);
  }, [agents, agentTotalEnrollments, agentActiveEnrollments]);

  const maxTopEnrollments = topAgents.length > 0 ? Math.max(topAgents[0]?.enrollments, 1) : 1;

  // Build hierarchical data
  const unassignedAgents = agents.filter((a: any) => !a.admin_id);

  const buildAgentData = (agentList: any[]) =>
    agentList.map((agent: any) => {
      const studentCount = agentStudentCounts.get(agent.id) || 0;
      const enrollmentCount = agentTotalEnrollments.get(agent.id) || 0;
      const activeCount = agentActiveEnrollments.get(agent.id) || 0;
      const leadCount = agentLeadCounts.get(agent.id) || 0;
      const converted = agentConvertedLeads.get(agent.id) || 0;
      const agentConvRate = leadCount > 0 ? Math.round((converted / leadCount) * 100) : 0;
      const { amount } = calcCommission(activeCount, tiers);
      return {
        name: agent.full_name || agent.email,
        students: studentCount,
        enrollments: enrollmentCount,
        leads: leadCount,
        conversionRate: agentConvRate,
        commission: amount,
        isActive: agent.is_active,
      };
    });

  const adminChartData = admins.map((admin: any) => {
    const teamAgents = agents.filter((a: any) => a.admin_id === admin.id);
    const agentData = buildAgentData(teamAgents);
    const totalStudents = agentData.reduce((s, a) => s + a.students, 0);
    const totalEnrollments = agentData.reduce((s, a) => s + a.enrollments, 0);
    const totalCommission = agentData.reduce((s, a) => s + a.commission, 0);
    return {
      admin,
      agentData,
      totalStudents,
      totalEnrollments,
      totalCommission,
      agentCount: teamAgents.length,
    };
  });

  const toggleAdmin = (id: string) => {
    setOpenAdmins((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Summary chart — NO commission, only students vs enrollments
  const summaryChartData = adminChartData.map((a) => ({
    name: a.admin.full_name || a.admin.email,
    students: a.totalStudents,
    enrollments: a.totalEnrollments,
  }));

  if (unassignedAgents.length > 0) {
    const unassignedData = buildAgentData(unassignedAgents);
    summaryChartData.push({
      name: "Unassigned",
      students: unassignedData.reduce((s, a) => s + a.students, 0),
      enrollments: unassignedData.reduce((s, a) => s + a.enrollments, 0),
    });
  }

  return (
    <DashboardLayout allowedRoles={["owner"]}>
      <div className="space-y-6">
        <PromoBanner />
        <DashboardSearchCard />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <ExportToSheetsButton />
        </div>

        <CancellationRequestsSection />

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          <MetricCard title="Total Students" value={students.length} icon={Users} />
          <MetricCard title="Active Agents" value={activeAgents.length} icon={UserCheck} />
          <MetricCard title="In Pipeline" value={pipelineCount} icon={ClipboardList} />
          <MetricCard title="Total Leads" value={totalLeads} icon={Target} />
          <MetricCard
            title="Conversion Rate"
            value={`${conversionRate}%`}
            icon={TrendingUp}
            description={`${convertedLeads} of ${totalLeads} leads converted`}
          />
          <MetricCard
            title="Revenue (Locked)"
            value={`£${totalSnapshotRevenue.toLocaleString()}`}
            icon={PoundSterling}
            description={`${snapshots.length} snapshots`}
          />
          <MetricCard
            title="Paid Out"
            value={`£${totalPaidOut.toLocaleString()}`}
            icon={PoundSterling}
            description="Total payments made"
          />
          <MetricCard
            title="Outstanding"
            value={`£${(totalSnapshotRevenue - totalPaidOut).toLocaleString()}`}
            icon={PoundSterling}
            description="Remaining to pay"
          />
        </div>

        {/* Row 1: Pipeline Funnel + Monthly Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Enrollment Pipeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={pipelineChartConfig} className="h-[280px] w-full">
                <BarChart data={pipelineData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} className="fill-muted-foreground" width={100} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Monthly Enrollments (6 months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={trendChartConfig} className="h-[280px] w-full">
                <LineChart data={monthlyTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--color-count)"
                    strokeWidth={2}
                    dot={{ fill: "var(--color-count)", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Team Performance (fixed) + Revenue per University */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {summaryChartData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Performance (Students vs Enrollments)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={teamChartConfig} className="h-[280px] w-full">
                  <BarChart data={summaryChartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" allowDecimals={false} />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend />
                    <Bar dataKey="students" fill="var(--color-students)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="enrollments" fill="var(--color-enrollments)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Revenue by University</CardTitle>
            </CardHeader>
            <CardContent>
              {revenueByUni.length > 0 ? (
                <div className="h-[280px] w-full flex items-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueByUni}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, value }) => `${name}: £${value.toLocaleString()}`}
                      >
                        {revenueByUni.map((_, i) => (
                          <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `£${value.toLocaleString()}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-12">No revenue data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Row 3: Top 5 Agents Leaderboard */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-lg">Top 5 Agents</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {topAgents.length > 0 ? (
              <div className="space-y-4">
                {topAgents.map((agent, i) => (
                  <div key={agent.name} className="flex items-center gap-4">
                    <span className="text-lg font-bold text-muted-foreground w-6 text-right">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium truncate">{agent.name}</span>
                        <span className="text-sm text-muted-foreground ml-2 shrink-0">
                          {agent.enrollments} enrollments ({agent.active} active)
                        </span>
                      </div>
                      <Progress
                        value={(agent.enrollments / maxTopEnrollments) * 100}
                        className="h-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No agent data</p>
            )}
          </CardContent>
        </Card>

        {/* Hierarchical Admin → Agents breakdown */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Admin → Agent Hierarchy</h2>
          {adminChartData.map(({ admin, agentData, totalStudents, totalEnrollments, totalCommission, agentCount }) => (
            <Collapsible
              key={admin.id}
              open={openAdmins.has(admin.id)}
              onOpenChange={() => toggleAdmin(admin.id)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform ${
                            openAdmins.has(admin.id) ? "rotate-0" : "-rotate-90"
                          }`}
                        />
                        <div>
                          <CardTitle className="text-base">{admin.full_name}</CardTitle>
                          <p className="text-sm text-muted-foreground">{admin.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <div className="text-center">
                          <p className="font-semibold">{agentCount}</p>
                          <p className="text-muted-foreground text-xs">Agents</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{totalStudents}</p>
                          <p className="text-muted-foreground text-xs">Students</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold">{totalEnrollments}</p>
                          <p className="text-muted-foreground text-xs">Enrollments</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-green-600">£{totalCommission.toLocaleString()}</p>
                          <p className="text-muted-foreground text-xs">Commission</p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-4">
                    {agentData.length > 0 ? (
                      <>
                        <ChartContainer config={teamChartConfig} className="h-[200px] w-full">
                          <BarChart data={agentData} barGap={4}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                            <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
                            <Tooltip content={<ChartTooltipContent />} />
                            <Bar dataKey="students" fill="var(--color-students)" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="enrollments" fill="var(--color-enrollments)" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ChartContainer>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Agent</TableHead>
                              <TableHead className="text-right">Students</TableHead>
                              <TableHead className="text-right">Leads</TableHead>
                              <TableHead className="text-right">Enrollments</TableHead>
                              <TableHead className="text-right">Conversion</TableHead>
                              <TableHead className="text-right">Commission</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {agentData.map((a) => (
                              <TableRow key={a.name}>
                                <TableCell className="font-medium">{a.name}</TableCell>
                                <TableCell className="text-right">{a.students}</TableCell>
                                <TableCell className="text-right">{a.leads}</TableCell>
                                <TableCell className="text-right">{a.enrollments}</TableCell>
                                <TableCell className="text-right">
                                  <span className={a.conversionRate >= 50 ? "text-green-600 font-medium" : a.conversionRate >= 25 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                                    {a.conversionRate}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-medium">£{a.commission.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant={a.isActive ? "default" : "destructive"} className="text-xs">
                                    {a.isActive ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground py-4 text-center">No agents assigned</p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}

          {unassignedAgents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-muted-foreground">Unassigned Agents</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Students</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Enrollments</TableHead>
                      <TableHead className="text-right">Conversion</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {buildAgentData(unassignedAgents).map((a) => (
                      <TableRow key={a.name}>
                        <TableCell className="font-medium">{a.name}</TableCell>
                        <TableCell className="text-right">{a.students}</TableCell>
                        <TableCell className="text-right">{a.leads}</TableCell>
                        <TableCell className="text-right">{a.enrollments}</TableCell>
                        <TableCell className="text-right">
                          <span className={a.conversionRate >= 50 ? "text-green-600 font-medium" : a.conversionRate >= 25 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                            {a.conversionRate}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">£{a.commission.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={a.isActive ? "default" : "destructive"} className="text-xs">
                            {a.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Enrollments with Filters */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-semibold">Recent Enrollments</h2>
            <div className="flex gap-2">
              <Select value={filterAdmin} onValueChange={(v) => { setFilterAdmin(v); setFilterAgent("all"); }}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Admins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Admins</SelectItem>
                  <SelectItem value="none">No Admin</SelectItem>
                  {admins.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Agents</SelectItem>
                  {(filterAdmin === "all"
                    ? agents
                    : filterAdmin === "none"
                    ? agents.filter((a: any) => !a.admin_id)
                    : agents.filter((a: any) => a.admin_id === filterAdmin)
                  ).map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>University</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentEnrollments
                  .filter((e: any) => {
                    const agentId = e.students?.agent_id;
                    if (filterAgent !== "all") return agentId === filterAgent;
                    if (filterAdmin !== "all") {
                      if (filterAdmin === "none") {
                        const agentP = profileMap.get(agentId);
                        return agentP && !agentP.admin_id;
                      }
                      const agentP = profileMap.get(agentId);
                      return agentP?.admin_id === filterAdmin;
                    }
                    return true;
                  })
                  .map((e: any) => {
                    const agentProfile = profileMap.get(e.students?.agent_id);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          {e.students?.first_name} {e.students?.last_name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {agentProfile?.full_name || "—"}
                        </TableCell>
                        <TableCell>{e.universities?.name}</TableCell>
                        <TableCell>{e.courses?.name}</TableCell>
                        <TableCell><StatusBadge status={e.status} /></TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(e.created_at), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                {recentEnrollments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No enrollments yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

        {/* Email Log */}
        <EmailLogSection />
      </div>
      </div>
    </DashboardLayout>
  );
}
