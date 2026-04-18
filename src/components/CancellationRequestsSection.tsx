import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export function CancellationRequestsSection() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["pending-cancellation-requests", role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cancellation_requests")
        .select("id, enrollment_id, requested_by, reason, status, created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (role === "owner" || role === "admin"),
  });

  // Resolve enrollment details
  const enrollmentIds = [...new Set(requests.map((r: any) => r.enrollment_id))];
  const { data: enrollmentMap = {} } = useQuery({
    queryKey: ["cancellation-enrollment-details", enrollmentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("id, students!inner(first_name, last_name), universities!inner(name), courses!inner(name)")
        .in("id", enrollmentIds);
      const map: Record<string, any> = {};
      (data || []).forEach((e: any) => { map[e.id] = e; });
      return map;
    },
    enabled: enrollmentIds.length > 0,
  });

  // Resolve requester names
  const requesterIds = [...new Set(requests.map((r: any) => r.requested_by))];
  const { data: requesterMap = {} } = useQuery({
    queryKey: ["cancellation-requester-profiles", requesterIds],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", requesterIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.full_name; });
      return map;
    },
    enabled: requesterIds.length > 0,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, decision, enrollmentId }: { id: string; decision: "approved" | "rejected"; enrollmentId: string }) => {
      const { error } = await supabase.from("cancellation_requests").update({
        status: decision,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;

      if (decision === "approved") {
        const { error: enrollError } = await supabase.from("enrollments").update({ status: "cancelled" }).eq("id", enrollmentId);
        if (enrollError) throw enrollError;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pending-cancellation-requests"] });
      qc.invalidateQueries({ queryKey: ["student-enrollments"] });
      toast({ title: vars.decision === "approved" ? "Cancellation approved" : "Request rejected" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (requests.length === 0) return null;

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Pending Cancellation Requests
          <Badge variant="destructive" className="ml-1">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r: any) => {
              const enrollment = (enrollmentMap as any)[r.enrollment_id];
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {enrollment ? `${enrollment.students?.first_name} ${enrollment.students?.last_name}` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {enrollment ? `${enrollment.universities?.name} — ${enrollment.courses?.name}` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {(requesterMap as any)[r.requested_by] || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">
                    {r.reason || "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(r.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-green-600 border-green-200 hover:bg-green-50"
                        title="Approve"
                        onClick={() => reviewMutation.mutate({ id: r.id, decision: "approved", enrollmentId: r.enrollment_id })}
                        disabled={reviewMutation.isPending}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 text-red-600 border-red-200 hover:bg-red-50"
                        title="Reject"
                        onClick={() => reviewMutation.mutate({ id: r.id, decision: "rejected", enrollmentId: r.enrollment_id })}
                        disabled={reviewMutation.isPending}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
