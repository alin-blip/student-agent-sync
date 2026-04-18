import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  reviewed: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
};

const categoryLabels: Record<string, string> = {
  suggestion: "Suggestion",
  bug: "Bug",
  simplify: "Simplification",
  feature: "New Feature",
};

export default function FeedbackPage() {
  const [filterStatus, setFilterStatus] = useState("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["feedback", filterStatus],
    queryFn: async () => {
      let q = supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false });
      if (filterStatus !== "all") q = q.eq("status", filterStatus);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for user names
  const userIds = [...new Set(feedbacks.map((f: any) => f.user_id))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["feedback-profiles", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      return data || [];
    },
  });

  const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
      toast({ title: "Status updated" });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">User Feedback</h1>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
               <SelectItem value="all">All</SelectItem>
               <SelectItem value="new">New</SelectItem>
               <SelectItem value="reviewed">Reviewed</SelectItem>
               <SelectItem value="done">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : feedbacks.length === 0 ? (
          <p className="text-muted-foreground">No feedback yet.</p>
        ) : (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
               <TableHead>Date</TableHead>
                   <TableHead>User</TableHead>
                   <TableHead>Category</TableHead>
                   <TableHead className="min-w-[300px]">Message</TableHead>
                   <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {feedbacks.map((fb: any) => {
                  const profile = profileMap[fb.user_id];
                  return (
                    <TableRow key={fb.id}>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(new Date(fb.created_at), "dd MMM yyyy HH:mm")}
                      </TableCell>
                      <TableCell className="text-sm">
                        {profile?.full_name || profile?.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{categoryLabels[fb.category] || fb.category}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[400px]">{fb.message}</TableCell>
                      <TableCell>
                        <Select
                          value={fb.status}
                          onValueChange={(val) => updateStatus.mutate({ id: fb.id, status: val })}
                        >
                          <SelectTrigger className="w-28 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="new">New</SelectItem>
                             <SelectItem value="reviewed">Reviewed</SelectItem>
                             <SelectItem value="done">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
