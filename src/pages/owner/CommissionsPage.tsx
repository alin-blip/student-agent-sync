import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PoundSterling, Users, TrendingUp, ChevronDown, ChevronRight,
  CreditCard, Clock, CheckCircle2, AlertCircle, ArrowUpCircle, X, Percent, Edit2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SNAPSHOT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_25: { label: "Pending 25%", color: "bg-amber-500/10 text-amber-700 border-amber-200" },
  paying_25: { label: "Paying 25%", color: "bg-blue-500/10 text-blue-700 border-blue-200" },
  ready_full: { label: "Ready Full Payment", color: "bg-green-500/10 text-green-700 border-green-200" },
  paid: { label: "Fully Paid", color: "bg-emerald-600/10 text-emerald-800 border-emerald-300" },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

export default function CommissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [paymentDialog, setPaymentDialog] = useState<{ snapshotId: string; recipientId: string; recipientRole: string; maxAmount: number } | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payType, setPayType] = useState("25_percent_monthly");
  const [payPeriod, setPayPeriod] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [overrideDialog, setOverrideDialog] = useState<{ snapshotId: string; currentRate: number; studentName: string } | null>(null);
  const [overrideAmount, setOverrideAmount] = useState("");
  const [overridePercentage, setOverridePercentage] = useState("");

  // Fetch snapshots with intake info + override fields
  const { data: snapshots = [] } = useQuery({
    queryKey: ["commission-snapshots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_snapshots")
        .select("*, enrollments(status, funding_status, intake_id, course_id, students(first_name, last_name, agent_id), universities(name), courses(name, fees, tuition_fee_percentage), intakes(label))")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch courses for fee % settings
  const { data: courses = [] } = useQuery({
    queryKey: ["commission-courses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("courses")
        .select("id, name, fees, tuition_fee_percentage, university_id, universities(name)")
        .order("name");
      return (data || []) as any[];
    },
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["commission-payments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commission_payments")
        .select("*")
        .order("paid_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch agents/admins
  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles-commission"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email, admin_id");
      return (data || []) as any[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles-commission"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return (data || []) as any[];
    },
  });

  const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  // Payment mutation
  const recordPayment = useMutation({
    mutationFn: async (data: { snapshot_id: string; recipient_id: string; recipient_role: string; amount: number; payment_type: string; period_label: string; notes: string }) => {
      const { error } = await supabase.from("commission_payments").insert({
        snapshot_id: data.snapshot_id,
        recipient_id: data.recipient_id,
        recipient_role: data.recipient_role,
        amount: data.amount,
        payment_type: data.payment_type,
        period_label: data.period_label || null,
        notes: data.notes || null,
        paid_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-payments"] });
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
      toast({ title: "Payment recorded successfully" });
      setPaymentDialog(null);
      resetPaymentForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Update snapshot status
  const updateSnapshotStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("commission_snapshots").update({ snapshot_status: status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
      toast({ title: "Status updated" });
    },
  });

  // Update course tuition fee percentage
  const updateCourseFeePercentage = useMutation({
    mutationFn: async ({ courseId, percentage }: { courseId: string; percentage: number | null }) => {
      const { error } = await supabase
        .from("courses")
        .update({ tuition_fee_percentage: percentage } as any)
        .eq("id", courseId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-courses"] });
      toast({ title: "Course fee % updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Override snapshot commission
  const overrideSnapshotCommission = useMutation({
    mutationFn: async ({ id, override_amount, override_percentage }: { id: string; override_amount: number | null; override_percentage: number | null }) => {
      const updateData: any = { override_amount, override_percentage };
      // If override_amount is set, also update agent_rate for consistency in calculations
      if (override_amount != null) {
        updateData.agent_rate = override_amount;
      }
      const { error } = await supabase.from("commission_snapshots").update(updateData).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission-snapshots"] });
      qc.invalidateQueries({ queryKey: ["owner-revenue-snapshots"] });
      toast({ title: "Commission override saved" });
      setOverrideDialog(null);
      setOverrideAmount("");
      setOverridePercentage("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function resetPaymentForm() {
    setPayAmount(""); setPayType("25_percent_monthly"); setPayPeriod(""); setPayNotes("");
  }

  // Group snapshots by agent
  const agentSnapshots = new Map<string, any[]>();
  for (const s of snapshots) {
    const list = agentSnapshots.get(s.agent_id) || [];
    list.push(s);
    agentSnapshots.set(s.agent_id, list);
  }

  // Payments per snapshot
  const paymentsBySnapshot = new Map<string, any[]>();
  for (const p of payments) {
    const list = paymentsBySnapshot.get(p.snapshot_id) || [];
    list.push(p);
    paymentsBySnapshot.set(p.snapshot_id, list);
  }

  // Helper: group snapshots by intake
  function groupByIntake(snaps: any[]) {
    const intakeMap = new Map<string, { intakeLabel: string; snapshots: any[] }>();
    for (const snap of snaps) {
      const intakeId = snap.enrollments?.intake_id || "no-intake";
      const intakeLabel = snap.enrollments?.intakes?.label || "No Intake";
      if (!intakeMap.has(intakeId)) {
        intakeMap.set(intakeId, { intakeLabel, snapshots: [] });
      }
      intakeMap.get(intakeId)!.snapshots.push(snap);
    }
    return intakeMap;
  }

  // Calculate agent summaries with per-intake breakdown
  const agentSummaries = Array.from(agentSnapshots.entries()).map(([agentId, snaps]) => {
    const profile = profileMap.get(agentId);
    const adminProfile = profile?.admin_id ? profileMap.get(profile.admin_id) : null;

    const totalAgentOwed = snaps.reduce((s, snap) => s + Number(snap.agent_rate), 0);
    const totalAdminOwed = snaps.reduce((s, snap) => s + Number(snap.admin_rate), 0);

    const agentPayments = payments.filter((p: any) => p.recipient_id === agentId && p.recipient_role === "consultant");
    const adminPayments = profile?.admin_id
      ? payments.filter((p: any) => p.recipient_id === profile.admin_id && snaps.some((snap: any) => snap.id === p.snapshot_id))
      : [];

    const totalAgentPaid = agentPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    const totalAdminPaid = adminPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

    // Per-intake eligibility
    const intakeGroups = groupByIntake(snaps);
    const intakeBreakdown = Array.from(intakeGroups.entries()).map(([intakeId, group]) => {
      const count = group.snapshots.length;
      const qualifies = count >= 5;
      const total25 = group.snapshots.reduce((s: number, snap: any) => s + Math.round(Number(snap.agent_rate) * 0.25 * 100) / 100, 0);
      const total75 = group.snapshots.reduce((s: number, snap: any) => {
        if (snap.snapshot_status === "ready_full" || snap.snapshot_status === "paid") {
          return s + Math.round(Number(snap.agent_rate) * 0.75 * 100) / 100;
        }
        return s;
      }, 0);
      const readyForFull = group.snapshots.filter((s: any) => s.snapshot_status === "ready_full").length;
      return { intakeId, intakeLabel: group.intakeLabel, count, qualifies, total25, total75, readyForFull, snapshots: group.snapshots };
    });

    const eligibleCount = snaps.length;
    const readyForFull = snaps.filter((s: any) => s.snapshot_status === "ready_full").length;

    // Totals across all intakes (only eligible intakes count for 25%)
    const agent25Total = intakeBreakdown.reduce((s, ib) => s + (ib.qualifies ? ib.total25 : 0), 0);
    const agent75Total = intakeBreakdown.reduce((s, ib) => s + ib.total75, 0);
    const agent25Remaining = Math.max(0, Math.round((agent25Total - totalAgentPaid) * 100) / 100);
    const qualifiesFor25 = intakeBreakdown.some(ib => ib.qualifies);

    return {
      agentId,
      agentName: profile?.full_name || "Unknown",
      agentEmail: profile?.email || "",
      adminName: adminProfile?.full_name || "—",
      adminId: profile?.admin_id,
      snapshots: snaps,
      intakeBreakdown,
      eligibleCount,
      qualifiesFor25,
      readyForFull,
      totalAgentOwed,
      totalAgentPaid,
      agentRemaining: totalAgentOwed - totalAgentPaid,
      totalAdminOwed,
      totalAdminPaid,
      adminRemaining: totalAdminOwed - totalAdminPaid,
      agent25Total,
      agent75Total,
      agent25Remaining,
      monthly25Amount: qualifiesFor25 ? agent25Remaining : 0,
    };
  }).sort((a, b) => b.agentRemaining - a.agentRemaining);

  // Totals
  const totalOwed = agentSummaries.reduce((s, a) => s + a.totalAgentOwed + a.totalAdminOwed, 0);
  const totalPaid = agentSummaries.reduce((s, a) => s + a.totalAgentPaid + a.totalAdminPaid, 0);
  const totalRemaining = totalOwed - totalPaid;
  const eligibleAgents = agentSummaries.filter(a => a.qualifiesFor25).length;

  const toggleExpand = (id: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Fetch tier upgrade requests
  const { data: upgradeRequests = [] } = useQuery({
    queryKey: ["tier-upgrade-requests"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("tier_upgrade_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const approveUpgrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("tier_upgrade_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tier-upgrade-requests"] });
      toast({ title: "Tier upgrade approved" });
    },
  });

  const rejectUpgrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("tier_upgrade_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: user?.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tier-upgrade-requests"] });
      toast({ title: "Tier upgrade rejected" });
    },
  });

  return (
    <DashboardLayout allowedRoles={["owner"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Commission Ledger</h1>

        {/* Pending Tier Upgrades */}
        {upgradeRequests.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-amber-600" />
                Pending Tier Upgrades ({upgradeRequests.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upgradeRequests.map((req: any) => {
                const profile = profileMap.get(req.user_id);
                return (
                  <div key={req.id} className="flex items-center justify-between rounded-lg border bg-background p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {profile?.full_name || "Unknown"} <Badge variant="outline" className="text-xs ml-1">{req.user_role}</Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {req.current_tier_name} (£{Number(req.current_rate)}) → {req.new_tier_name} (£{Number(req.new_rate)}) · {req.student_count} students
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">{format(new Date(req.created_at), "dd MMM yyyy HH:mm")}</p>
                    </div>
                    <div className="flex gap-2 ml-3">
                      <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => approveUpgrade.mutate(req.id)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => rejectUpgrade.mutate(req.id)}>
                        <X className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard title="Total Owed" value={`£${totalOwed.toLocaleString()}`} icon={PoundSterling} />
          <MetricCard title="Total Paid" value={`£${totalPaid.toLocaleString()}`} icon={CheckCircle2} />
          <MetricCard title="Remaining" value={`£${totalRemaining.toLocaleString()}`} icon={Clock} />
          <MetricCard title="Eligible Agents (5+)" value={eligibleAgents} icon={Users} />
        </div>

        <Tabs defaultValue="agents">
          <TabsList>
            <TabsTrigger value="agents">Agent Breakdown</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="course-fees">Course Fee %</TabsTrigger>
          </TabsList>

          <TabsContent value="agents" className="space-y-4 mt-4">
            <div className="rounded-lg border bg-card">
              <Table>
                 <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead className="text-right">Students</TableHead>
                    <TableHead className="text-right">25% Due</TableHead>
                    <TableHead className="text-right">75% Due</TableHead>
                    <TableHead className="text-right">Total Owed</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentSummaries.map((a) => {
                    const isExpanded = expandedAgents.has(a.agentId);
                    return (
                      <AgentRow
                        key={a.agentId}
                        agent={a}
                        isExpanded={isExpanded}
                        onToggle={() => toggleExpand(a.agentId)}
                        paymentsBySnapshot={paymentsBySnapshot}
                        onRecordPayment={(snapshotId, recipientId, recipientRole, maxAmount) =>
                          setPaymentDialog({ snapshotId, recipientId, recipientRole, maxAmount })
                        }
                        onUpdateStatus={(id, status) => updateSnapshotStatus.mutate({ id, status })}
                        profileMap={profileMap}
                        onOverride={(snapshotId, currentRate, studentName) =>
                          setOverrideDialog({ snapshotId, currentRate, studentName })
                        }
                      />
                    );
                  })}
                  {agentSummaries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No commission snapshots yet. Snapshots are created when enrollment status reaches funding.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <div className="rounded-lg border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{format(new Date(p.paid_at), "dd MMM yyyy")}</TableCell>
                      <TableCell className="font-medium">{profileMap.get(p.recipient_id)?.full_name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{p.recipient_role}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{p.payment_type.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.period_label || "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">£{Number(p.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{p.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No payments recorded yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="course-fees" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Percent className="w-4 h-4" />
                  Tuition Fee Commission % per Course
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Set what percentage of each course's tuition fees you receive as commission. Leave empty to use the default tier/custom rate.
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>University</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead className="text-right">Tuition Fee</TableHead>
                        <TableHead className="text-right w-[140px]">Fee %</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courses.map((course: any) => {
                        const feeStr = course.fees || "";
                        const feeNum = parseFloat(feeStr.replace(/[^0-9.]/g, "")) || 0;
                        const pct = course.tuition_fee_percentage;
                        const commission = pct != null && feeNum > 0 ? Math.round(feeNum * pct / 100) : null;
                        return (
                          <TableRow key={course.id}>
                            <TableCell className="text-sm">{course.universities?.name || "—"}</TableCell>
                            <TableCell className="text-sm font-medium">{course.name}</TableCell>
                            <TableCell className="text-right text-sm tabular-nums">{feeNum > 0 ? `£${feeNum.toLocaleString()}` : "—"}</TableCell>
                            <TableCell className="text-right">
                              <CourseFeeInput
                                courseId={course.id}
                                currentValue={pct}
                                onSave={(courseId, value) => updateCourseFeePercentage.mutate({ courseId, percentage: value })}
                              />
                            </TableCell>
                            <TableCell className="text-right text-sm tabular-nums font-medium">
                              {commission != null ? `£${commission.toLocaleString()}` : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {courses.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No courses found</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={!!paymentDialog} onOpenChange={(open) => { if (!open) { setPaymentDialog(null); resetPaymentForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder={paymentDialog ? `Max: £${paymentDialog.maxAmount}` : ""}
              />
            </div>
            <div>
              <Label>Payment Type</Label>
              <Select value={payType} onValueChange={setPayType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="25_percent_monthly">25% Monthly</SelectItem>
                  <SelectItem value="remaining_75">Remaining 75%</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Period (e.g. April 2026)</Label>
              <Input value={payPeriod} onChange={(e) => setPayPeriod(e.target.value)} />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPaymentDialog(null); resetPaymentForm(); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!paymentDialog || !payAmount) return;
                recordPayment.mutate({
                  snapshot_id: paymentDialog.snapshotId,
                  recipient_id: paymentDialog.recipientId,
                  recipient_role: paymentDialog.recipientRole,
                  amount: Number(payAmount),
                  payment_type: payType,
                  period_label: payPeriod,
                  notes: payNotes,
                });
              }}
              disabled={!payAmount || Number(payAmount) <= 0}
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Commission Dialog */}
      <Dialog open={!!overrideDialog} onOpenChange={(open) => { if (!open) { setOverrideDialog(null); setOverrideAmount(""); setOverridePercentage(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Commission — {overrideDialog?.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current rate: £{overrideDialog?.currentRate?.toLocaleString()}. Set a custom amount or percentage.
            </p>
            <div>
              <Label>Fixed Amount (£)</Label>
              <Input
                type="number"
                step="0.01"
                value={overrideAmount}
                onChange={(e) => {
                  setOverrideAmount(e.target.value);
                  setOverridePercentage("");
                }}
                placeholder="e.g. 750"
              />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="flex-1 border-t" /> or <span className="flex-1 border-t" />
            </div>
            <div>
              <Label>Percentage of tuition fee (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={overridePercentage}
                onChange={(e) => {
                  setOverridePercentage(e.target.value);
                  setOverrideAmount("");
                }}
                placeholder="e.g. 15"
              />
              <p className="text-xs text-muted-foreground mt-1">Will calculate from the course's tuition fee if available</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOverrideDialog(null); setOverrideAmount(""); setOverridePercentage(""); }}>Cancel</Button>
            <Button
              onClick={() => {
                if (!overrideDialog) return;
                const amt = overrideAmount ? Number(overrideAmount) : null;
                const pct = overridePercentage ? Number(overridePercentage) : null;
                overrideSnapshotCommission.mutate({
                  id: overrideDialog.snapshotId,
                  override_amount: amt,
                  override_percentage: pct,
                });
              }}
              disabled={!overrideAmount && !overridePercentage}
            >
              Save Override
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

/* ──── Agent Row with expand ──── */

function AgentRow({
  agent, isExpanded, onToggle, paymentsBySnapshot, onRecordPayment, onUpdateStatus, profileMap, onOverride,
}: {
  agent: any;
  isExpanded: boolean;
  onToggle: () => void;
  paymentsBySnapshot: Map<string, any[]>;
  onRecordPayment: (snapshotId: string, recipientId: string, recipientRole: string, maxAmount: number) => void;
  onUpdateStatus: (id: string, status: string) => void;
  profileMap: Map<string, any>;
  onOverride: (snapshotId: string, currentRate: number, studentName: string) => void;
}) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell className="w-8 px-2">
          {isExpanded
            ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
            : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{agent.agentName}</p>
            <p className="text-xs text-muted-foreground">{agent.agentEmail}</p>
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground">{agent.adminName}</TableCell>
        <TableCell className="text-right tabular-nums">{agent.eligibleCount}</TableCell>
        <TableCell className="text-right tabular-nums">
          {agent.qualifiesFor25 ? (
            <span className="font-medium text-green-700 dark:text-green-400">£{agent.agent25Total.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground text-xs">{agent.eligibleCount}/5 needed</span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {agent.readyForFull > 0 ? (
            <span className="font-medium text-blue-700 dark:text-blue-400">£{agent.agent75Total.toLocaleString()}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-right font-medium tabular-nums">£{agent.totalAgentOwed.toLocaleString()}</TableCell>
        <TableCell className="text-right tabular-nums text-muted-foreground">£{agent.totalAgentPaid.toLocaleString()}</TableCell>
        <TableCell className="text-right font-semibold tabular-nums">
          £{agent.agentRemaining.toLocaleString()}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <TableRow className="bg-muted/20 hover:bg-muted/30">
          <TableCell colSpan={9} className="py-3">
            <div className="space-y-3">
              {/* Admin commission summary */}
              {agent.adminId && (
                <Card className="border-dashed">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">Admin Commission: {agent.adminName}</p>
                        <p className="text-xs text-muted-foreground">
                          Owed: £{agent.totalAdminOwed.toLocaleString()} | Paid: £{agent.totalAdminPaid.toLocaleString()} | Remaining: £{agent.adminRemaining.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Per-intake grouped snapshots */}
              {agent.intakeBreakdown.map((ib: any) => (
                <div key={ib.intakeId} className="space-y-1">
                  <div className="flex items-center gap-2 px-2 pt-2">
                    <Badge variant="outline" className="text-xs font-semibold">{ib.intakeLabel}</Badge>
                    <span className="text-xs text-muted-foreground">{ib.count} student(s)</span>
                    {ib.qualifies ? (
                      <Badge className="bg-green-500/10 text-green-700 border-green-200 text-[10px]" variant="outline">25% eligible</Badge>
                    ) : (
                      <Badge className="bg-amber-500/10 text-amber-700 border-amber-200 text-[10px]" variant="outline">{ib.count}/5 needed</Badge>
                    )}
                  </div>
                  <div className="rounded-md border bg-background">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Student</TableHead>
                          <TableHead className="text-xs">University</TableHead>
                          <TableHead className="text-xs text-right">Rate</TableHead>
                          <TableHead className="text-xs text-right">25%</TableHead>
                          <TableHead className="text-xs text-right">75%</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Paid</TableHead>
                          <TableHead className="text-xs text-right">Remaining</TableHead>
                          <TableHead className="text-xs">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ib.snapshots.map((snap: any) => {
                          const snapshotPayments = paymentsBySnapshot.get(snap.id) || [];
                          const agentPaid = snapshotPayments
                            .filter((p: any) => p.recipient_role === "consultant")
                            .reduce((s: number, p: any) => s + Number(p.amount), 0);
                          const rate = Number(snap.agent_rate);
                          const amount25 = Math.round(rate * 0.25 * 100) / 100;
                          const amount75 = Math.round(rate * 0.75 * 100) / 100;
                          const remaining = rate - agentPaid;
                          const isReadyFull = snap.snapshot_status === "ready_full" || snap.snapshot_status === "paid";
                          const statusInfo = SNAPSHOT_STATUS_LABELS[snap.snapshot_status] || { label: snap.snapshot_status, color: "" };

                          return (
                            <TableRow key={snap.id}>
                              <TableCell className="text-sm">
                                {snap.enrollments?.students?.first_name} {snap.enrollments?.students?.last_name}
                              </TableCell>
                              <TableCell className="text-sm">{snap.enrollments?.universities?.name || "—"}</TableCell>
                              <TableCell className="text-sm text-right tabular-nums font-medium">
                                £{rate.toLocaleString()}
                                {snap.override_amount != null && (
                                  <Badge variant="outline" className="ml-1 text-[10px] px-1">override</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums">
                                <span className={ib.qualifies ? "text-green-700 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                                  £{amount25.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums">
                                {isReadyFull ? (
                                  <span className="text-blue-700 dark:text-blue-400 font-medium">£{amount75.toLocaleString()}</span>
                                ) : (
                                  <span className="text-muted-foreground">£{amount75.toLocaleString()}</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`text-xs ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums">
                                £{agentPaid.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-sm text-right tabular-nums font-semibold">
                                {remaining > 0 ? `£${remaining.toLocaleString()}` : <span className="text-green-600">✓ Paid</span>}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-1 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const studentName = `${snap.enrollments?.students?.first_name} ${snap.enrollments?.students?.last_name}`;
                                      onOverride(snap.id, rate, studentName);
                                    }}
                                  >
                                    <Edit2 className="w-3 h-3 mr-1" />
                                    Override
                                  </Button>
                                  {remaining > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onRecordPayment(snap.id, agent.agentId, "agent", remaining);
                                      }}
                                    >
                                      <CreditCard className="w-3 h-3 mr-1" />
                                      Pay
                                    </Button>
                                  )}
                                  {snap.admin_id && Number(snap.admin_rate) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const adminPaid = snapshotPayments
                                          .filter((p: any) => p.recipient_role === "branch_manager")
                                          .reduce((s: number, p: any) => s + Number(p.amount), 0);
                                        onRecordPayment(snap.id, snap.admin_id, "admin", Number(snap.admin_rate) - adminPaid);
                                      }}
                                    >
                                      Pay Admin
                                    </Button>
                                  )}
                                  {snap.snapshot_status === "paying_25" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); onUpdateStatus(snap.id, "paid"); }}
                                    >
                                      Mark Paid
                                    </Button>
                                  )}
                                  {snap.snapshot_status === "pending_25" && ib.qualifies && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={(e) => { e.stopPropagation(); onUpdateStatus(snap.id, "paying_25"); }}
                                    >
                                      Start 25%
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/* ──── Inline Course Fee % Input ──── */

function CourseFeeInput({ courseId, currentValue, onSave }: {
  courseId: string;
  currentValue: number | null;
  onSave: (courseId: string, value: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentValue != null ? String(currentValue) : "");

  if (!editing) {
    return (
      <button
        className="inline-flex items-center gap-1 text-sm tabular-nums hover:text-primary transition-colors"
        onClick={() => { setValue(currentValue != null ? String(currentValue) : ""); setEditing(true); }}
      >
        {currentValue != null ? `${currentValue}%` : <span className="text-muted-foreground">Set %</span>}
        <Edit2 className="w-3 h-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        step="0.1"
        className="h-7 w-20 text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(courseId, value ? Number(value) : null);
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { onSave(courseId, value ? Number(value) : null); setEditing(false); }}>
        ✓
      </Button>
    </div>
  );
}
