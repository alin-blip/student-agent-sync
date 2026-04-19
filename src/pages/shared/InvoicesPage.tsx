import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Receipt, Plus, PoundSterling, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { MetricCard } from "@/components/MetricCard";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  in_review: { label: "In Review", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default function InvoicesPage() {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const prefix = role === "owner" ? "/owner" : role === "branch_manager" ? "/branch" : "/consultant";
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch user invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["my-invoices", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_requests")
        .select("*")
        .eq("requester_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch eligible snapshots (no invoice yet)
  const { data: eligibleSnapshots = [] } = useQuery({
    queryKey: ["eligible-snapshots", user?.id],
    queryFn: async () => {
      // Get user's snapshots
      const { data: snapshots, error } = await supabase
        .from("commission_snapshots")
        .select("id, agent_rate, admin_rate, rate_source, snapshot_status, enrollment_id")
        .or(`agent_id.eq.${user!.id},admin_id.eq.${user!.id}`)
        .in("snapshot_status", ["pending_25", "ready_full"]);
      if (error) throw error;
      if (!snapshots || snapshots.length === 0) return [];

      // Get existing invoice snapshot_ids
      const { data: existingInvoices } = await (supabase as any)
        .from("invoice_requests")
        .select("snapshot_id")
        .eq("requester_id", user!.id)
        .neq("status", "rejected");
      const usedIds = new Set((existingInvoices || []).map((i: any) => i.snapshot_id));

      return snapshots
        .filter((s: any) => !usedIds.has(s.id))
        .map((s: any) => ({
          ...s,
          amount: s.agent_rate || s.admin_rate || 0,
        }));
    },
    enabled: !!user && dialogOpen,
  });

  // Check billing details exist
  const { data: hasBilling } = useQuery({
    queryKey: ["has-billing", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("billing_details")
        .select("id")
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const submitInvoice = useMutation({
    mutationFn: async () => {
      if (!hasBilling) throw new Error("Please add your billing details on your Profile page first.");
      const snap = eligibleSnapshots.find((s: any) => s.id === selectedSnapshot);
      if (!snap) throw new Error("Please select a commission");
      const { error } = await (supabase as any)
        .from("invoice_requests")
        .insert({
          requester_id: user!.id,
          snapshot_id: selectedSnapshot,
          amount: snap.amount,
          notes: notes || null,
          status: "submitted",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invoice submitted" });
      setDialogOpen(false);
      setSelectedSnapshot("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["my-invoices"] });
      qc.invalidateQueries({ queryKey: ["eligible-snapshots"] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalPending = invoices.filter((i: any) => ["submitted", "in_review"].includes(i.status)).reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalApproved = invoices.filter((i: any) => i.status === "approved").reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalPaid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.amount), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Receipt className="w-6 h-6" /> My Invoices
            </h1>
            <p className="text-sm text-muted-foreground">Request payouts for your commissions</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-1" /> Request Invoice
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {!hasBilling && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm">
                    ⚠️ You need to add your billing details first.{" "}
                    <Button variant="link" className="h-auto p-0 text-sm" onClick={() => navigate(`${prefix}/profile`)}>
                      Go to Profile
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Select Commission</Label>
                  <Select value={selectedSnapshot} onValueChange={setSelectedSnapshot}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose an eligible commission" />
                    </SelectTrigger>
                    <SelectContent>
                      {eligibleSnapshots.length === 0 ? (
                        <SelectItem value="_none" disabled>No eligible commissions</SelectItem>
                      ) : (
                        eligibleSnapshots.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            £{s.amount} — {s.rate_source} ({s.snapshot_status.replace(/_/g, " ")})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                {selectedSnapshot && (
                  <div className="p-3 rounded-lg bg-muted text-sm">
                    Amount: <strong>£{eligibleSnapshots.find((s: any) => s.id === selectedSnapshot)?.amount || 0}</strong>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Notes <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." rows={3} />
                </div>
                <Button onClick={() => submitInvoice.mutate()} disabled={!selectedSnapshot || submitInvoice.isPending || !hasBilling} className="w-full">
                  {submitInvoice.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Receipt className="w-4 h-4 mr-1" />}
                  Submit Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Pending" value={`£${totalPending.toFixed(2)}`} icon={Clock} />
          <MetricCard title="Approved" value={`£${totalApproved.toFixed(2)}`} icon={CheckCircle2} />
          <MetricCard title="Total Paid" value={`£${totalPaid.toFixed(2)}`} icon={PoundSterling} />
        </div>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invoice History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : invoices.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No invoices yet. Request your first payout above.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Owner Notes</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => {
                    const cfg = statusConfig[inv.status] || statusConfig.submitted;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell className="font-semibold">£{Number(inv.amount).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{inv.notes || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{inv.owner_notes || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
