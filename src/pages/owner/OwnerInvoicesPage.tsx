import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Receipt, PoundSterling, Clock, CheckCircle2, Loader2, Eye, X, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { MetricCard } from "@/components/MetricCard";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  submitted: { label: "Submitted", variant: "secondary" },
  in_review: { label: "In Review", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default function OwnerInvoicesPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("all");
  const [detailInvoice, setDetailInvoice] = useState<any>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  // Fetch all invoices with requester profile
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["owner-invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Get requester profiles
      const requesterIds = [...new Set(data.map((i: any) => i.requester_id))] as string[];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", requesterIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      return data.map((inv: any) => ({
        ...inv,
        requester_name: profileMap[inv.requester_id]?.full_name || "Unknown",
        requester_email: profileMap[inv.requester_id]?.email || "",
      }));
    },
  });

  // Fetch billing details for detail view
  const { data: billingDetail } = useQuery({
    queryKey: ["billing-detail-owner", detailInvoice?.requester_id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("billing_details")
        .select("*")
        .eq("user_id", detailInvoice.requester_id)
        .maybeSingle();
      return data;
    },
    enabled: !!detailInvoice,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, owner_notes }: { id: string; status: string; owner_notes?: string }) => {
      const update: any = { status };
      if (owner_notes !== undefined) update.owner_notes = owner_notes;
      if (status === "paid") update.paid_at = new Date().toISOString();
      const { error } = await (supabase as any).from("invoice_requests").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invoice updated" });
      qc.invalidateQueries({ queryKey: ["owner-invoices"] });
      setRejectId(null);
      setRejectNotes("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = tab === "all" ? invoices : invoices.filter((i: any) => i.status === tab);

  const totalPending = invoices.filter((i: any) => ["submitted", "in_review"].includes(i.status)).reduce((s: number, i: any) => s + Number(i.amount), 0);
  const totalApproved = invoices.filter((i: any) => i.status === "approved").reduce((s: number, i: any) => s + Number(i.amount), 0);
  const now = new Date();
  const totalPaidMonth = invoices
    .filter((i: any) => i.status === "paid" && i.paid_at && new Date(i.paid_at).getMonth() === now.getMonth() && new Date(i.paid_at).getFullYear() === now.getFullYear())
    .reduce((s: number, i: any) => s + Number(i.amount), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6" /> Invoice Management
          </h1>
          <p className="text-sm text-muted-foreground">Review and manage agent/admin payout requests</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Pending" value={`£${totalPending.toFixed(2)}`} icon={Clock} />
          <MetricCard title="Approved (Unpaid)" value={`£${totalApproved.toFixed(2)}`} icon={CheckCircle2} />
          <MetricCard title="Paid This Month" value={`£${totalPaidMonth.toFixed(2)}`} icon={PoundSterling} />
        </div>

        <Card>
          <CardHeader>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
                <TabsTrigger value="submitted">Submitted</TabsTrigger>
                <TabsTrigger value="in_review">In Review</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">No invoices found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Agent / Admin</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv: any) => {
                    const cfg = statusConfig[inv.status] || statusConfig.submitted;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell>
                          <div>{inv.requester_name}</div>
                          <div className="text-xs text-muted-foreground">{inv.requester_email}</div>
                        </TableCell>
                        <TableCell className="font-semibold">£{Number(inv.amount).toFixed(2)}</TableCell>
                        <TableCell><Badge variant={cfg.variant}>{cfg.label}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(inv.created_at), "dd MMM yyyy")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => setDetailInvoice(inv)}>
                              <Eye className="w-3 h-3" />
                            </Button>
                            {inv.status === "submitted" && (
                              <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: inv.id, status: "in_review" })}>
                                Review
                              </Button>
                            )}
                            {["submitted", "in_review"].includes(inv.status) && (
                              <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: inv.id, status: "approved" })}>
                                Approve
                              </Button>
                            )}
                            {inv.status === "approved" && (
                              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStatus.mutate({ id: inv.id, status: "paid" })}>
                                <CreditCard className="w-3 h-3 mr-1" /> Pay
                              </Button>
                            )}
                            {!["paid", "rejected"].includes(inv.status) && (
                              <Button size="sm" variant="destructive" onClick={() => setRejectId(inv.id)}>
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailInvoice} onOpenChange={(o) => !o && setDetailInvoice(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Invoice Details — {detailInvoice?.invoice_number}</DialogTitle>
            </DialogHeader>
            {detailInvoice && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Requester:</span> {detailInvoice.requester_name}</div>
                  <div><span className="text-muted-foreground">Amount:</span> <strong>£{Number(detailInvoice.amount).toFixed(2)}</strong></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge variant={statusConfig[detailInvoice.status]?.variant || "secondary"}>{statusConfig[detailInvoice.status]?.label}</Badge></div>
                  <div><span className="text-muted-foreground">Date:</span> {format(new Date(detailInvoice.created_at), "dd MMM yyyy HH:mm")}</div>
                </div>
                {detailInvoice.notes && (
                  <div><span className="text-muted-foreground">Agent Notes:</span><p className="mt-1 p-2 bg-muted rounded text-sm">{detailInvoice.notes}</p></div>
                )}
                {detailInvoice.owner_notes && (
                  <div><span className="text-muted-foreground">Owner Notes:</span><p className="mt-1 p-2 bg-muted rounded text-sm">{detailInvoice.owner_notes}</p></div>
                )}
                {billingDetail ? (
                  <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                    <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-2">Billing Info</p>
                    <div className="grid grid-cols-2 gap-1 text-xs">
                      <div><span className="text-muted-foreground">Holder:</span> {billingDetail.account_holder_name || "—"}</div>
                      <div><span className="text-muted-foreground">Bank:</span> {billingDetail.bank_name || "—"}</div>
                      <div><span className="text-muted-foreground">Sort Code:</span> {billingDetail.sort_code || "—"}</div>
                      <div><span className="text-muted-foreground">Account:</span> {billingDetail.account_number || "—"}</div>
                      {billingDetail.iban && <div className="col-span-2"><span className="text-muted-foreground">IBAN:</span> {billingDetail.iban}</div>}
                      {billingDetail.is_company && (
                        <>
                          <div className="col-span-2 border-t pt-1 mt-1"><span className="text-muted-foreground">Company:</span> {billingDetail.company_name}</div>
                          <div><span className="text-muted-foreground">Co. No:</span> {billingDetail.company_number || "—"}</div>
                          <div><span className="text-muted-foreground">VAT:</span> {billingDetail.vat_number || "—"}</div>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border text-sm text-muted-foreground">No billing details on file</div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={!!rejectId} onOpenChange={(o) => !o && setRejectId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Invoice</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason (visible to agent)</Label>
                <Textarea value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} placeholder="Explain why..." rows={3} />
              </div>
              <Button variant="destructive" className="w-full" onClick={() => updateStatus.mutate({ id: rejectId!, status: "rejected", owner_notes: rejectNotes })} disabled={updateStatus.isPending}>
                Confirm Reject
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
