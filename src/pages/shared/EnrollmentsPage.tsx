import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Search, ChevronLeft, ChevronRight, Download, CalendarDays } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { notifyAgentOfStatusChange } from "@/lib/enrollment-emails";
import { getVisibleStatuses, getDisplayStatus, getAdminEditableStatuses } from "@/lib/status-utils";
import { AssessmentBookingDialog } from "@/components/student-detail/AssessmentBookingDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const PAGE_SIZE = 20;

export default function EnrollmentsPage() {
  const { role, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canEdit = role === "owner" || role === "branch_manager";
  const prefix = role === "owner" ? "/owner" : role === "branch_manager" ? "/branch" : "/consultant";
  const filterStatuses = getVisibleStatuses(role);
  const editableStatuses = role === "owner" ? getVisibleStatuses("owner") : getAdminEditableStatuses();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [bookingEnrollmentId, setBookingEnrollmentId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile-name"],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["enrollments-list", search, statusFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id, status, created_at, updated_at, notes, student_id, assessment_date, assessment_time,
          students!inner(first_name, last_name, agent_id),
          universities!inner(name),
          courses!inner(name),
          campuses(name, city)
        `, { count: "exact" });

      if (search.trim()) {
        query = query.or(`students.first_name.ilike.%${search}%,students.last_name.ilike.%${search}%`, { referencedTable: "students" });
      }
      if (statusFilter !== "All") {
        query = query.eq("status", statusFilter);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { enrollments: data || [], total: count || 0 };
    },
  });

  // Resolve agent names for enrollments
  const enrollmentAgentIds = [...new Set((data?.enrollments || []).map((e: any) => e.students?.agent_id).filter(Boolean))];
  const { data: enrollmentAgentProfiles = {} } = useQuery({
    queryKey: ["agent-profiles-for-enrollments", enrollmentAgentIds],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", enrollmentAgentIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.full_name; });
      return map;
    },
    enabled: enrollmentAgentIds.length > 0,
  });

  const enrollments = data?.enrollments || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, oldStatus }: { id: string; status: string; oldStatus: string }) => {
      const { error } = await supabase.from("enrollments").update({ status }).eq("id", id);
      if (error) throw error;
      return { id, status, oldStatus };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
      toast({ title: "Status updated" });
      notifyAgentOfStatusChange(result.id, result.status, result.oldStatus, profile?.full_name);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleBookAssessment = async (date: Date, time: string) => {
    if (!bookingEnrollmentId) return;
    setBookingLoading(true);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const enrollment = enrollments.find((e: any) => e.id === bookingEnrollmentId);
      const oldStatus = enrollment?.status || "";
      const { error } = await supabase.from("enrollments").update({
        status: "assessment_booked",
        assessment_date: dateStr,
        assessment_time: time,
      }).eq("id", bookingEnrollmentId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["enrollments-list"] });
      toast({ title: "Assessment booked", description: `${format(date, "dd MMM yyyy")} at ${time}` });
      if (oldStatus !== "assessment_booked") {
        notifyAgentOfStatusChange(bookingEnrollmentId, "assessment_booked", oldStatus, profile?.full_name);
      }
      setBookingEnrollmentId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setBookingLoading(false);
    }
  };

  const handleExport = () => {
    const headers = ["Student", "University", "Course", "Campus", "Status", "Date"];
    const rows = enrollments.map((e: any) => [
      `${e.students?.first_name} ${e.students?.last_name}`,
      e.universities?.name || "",
      e.courses?.name || "",
      e.campuses ? `${e.campuses.name}${e.campuses.city ? ` (${e.campuses.city})` : ""}` : "",
      e.status,
      format(new Date(e.created_at), "yyyy-MM-dd"),
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enrollments_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Enrollments</h1>
          {(role === "owner" || role === "branch_manager") && (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-1" /> Export CSV
            </Button>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {filterStatuses.map((s) => <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden lg:table-cell">Agent</TableHead>
                <TableHead>University</TableHead>
                <TableHead>Course</TableHead>
                <TableHead className="hidden md:table-cell">Campus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && enrollments.map((e: any) => (
                <TableRow
                  key={e.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => navigate(`${prefix}/students/${e.student_id}`)}
                >
                  <TableCell className="font-medium">{e.students?.first_name} {e.students?.last_name}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">{(enrollmentAgentProfiles as any)[e.students?.agent_id] || "—"}</TableCell>
                  <TableCell>{e.universities?.name}</TableCell>
                  <TableCell>{e.courses?.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {e.campuses ? (
                      <span>{e.campuses.name}{e.campuses.city && <span className="text-xs text-muted-foreground/70"> · {e.campuses.city}</span>}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <Select
                            value={e.status}
                            onValueChange={(v) => {
                              if (v === "assessment_booked") {
                                setBookingEnrollmentId(e.id);
                              } else {
                                updateStatus.mutate({ id: e.id, status: v, oldStatus: e.status });
                              }
                            }}
                          >
                            <SelectTrigger className="w-[180px] h-8">
                              <StatusBadge status={getDisplayStatus(e.status, role)} />
                            </SelectTrigger>
                            <SelectContent>
                              {editableStatuses.map((s) => (
                                <SelectItem key={s} value={s}><StatusBadge status={s} /></SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <StatusBadge status={getDisplayStatus(e.status, role)} />
                        )}
                        {canEdit && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 shrink-0"
                                  onClick={() => setBookingEnrollmentId(e.id)}
                                >
                                  <CalendarDays className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                {e.assessment_date
                                  ? `Assessment: ${format(new Date(e.assessment_date), "dd MMM yyyy")}${e.assessment_time ? ` at ${e.assessment_time.slice(0, 5)}` : ""}`
                                  : "Set assessment date & time"}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      {e.assessment_date && (
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(e.assessment_date), "dd MMM yyyy")}{e.assessment_time && ` · ${e.assessment_time.slice(0, 5)}`}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(e.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && enrollments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No enrollments found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AssessmentBookingDialog
        open={!!bookingEnrollmentId}
        onOpenChange={(open) => !open && setBookingEnrollmentId(null)}
        onConfirm={handleBookAssessment}
        loading={bookingLoading}
      />
    </DashboardLayout>
  );
}
