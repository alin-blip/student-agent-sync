import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EnrollStudentDialog } from "@/components/EnrollStudentDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { Download, Search, ChevronLeft, ChevronRight, Plus, Flame } from "lucide-react";

const PAGE_SIZE = 20;
const IMMIGRATION_OPTIONS = ["All", "Pre-settled", "Settled", "British Citizen", "Visa Holder", "Refugee", "Other"];

export default function StudentsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const prefix = role === "owner" ? "/owner" : role === "admin" ? "/admin" : "/agent";
  const [search, setSearch] = useState("");
  const [immigrationFilter, setImmigrationFilter] = useState("All");
  const [page, setPage] = useState(0);
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["all-students", search, immigrationFilter, page],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, email, phone, immigration_status, created_at, agent_id", { count: "exact" });

      if (search.trim()) {
        query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      if (immigrationFilter !== "All") {
        query = query.eq("immigration_status", immigrationFilter);
      }

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      return { students: data || [], total: count || 0 };
    },
  });

  // Resolve agent & admin names for displayed students
  const agentIds = [...new Set((data?.students || []).map((s: any) => s.agent_id).filter(Boolean))];
  const { data: agentProfiles = {} } = useQuery({
    queryKey: ["agent-profiles-for-students", agentIds],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, admin_id").in("id", agentIds);
      const map: Record<string, { full_name: string; admin_id: string | null }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, admin_id: p.admin_id }; });
      return map;
    },
    enabled: agentIds.length > 0,
  });

  const adminIds = [...new Set(Object.values(agentProfiles).map((p: any) => p.admin_id).filter(Boolean))];
  const { data: adminProfiles = {} } = useQuery({
    queryKey: ["admin-profiles-for-students", adminIds],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", adminIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.id] = p.full_name; });
      return map;
    },
    enabled: adminIds.length > 0,
  });

  // Fetch latest enrollment (course + campus) per visible student
  const studentIds = (data?.students || []).map((s: any) => s.id);
  const { data: latestEnrollments = {} } = useQuery({
    queryKey: ["latest-enrollments-for-students", studentIds],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("student_id, created_at, courses(name), campuses(name, city)")
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });
      const map: Record<string, { course?: string; campus?: string; city?: string }> = {};
      (data || []).forEach((e: any) => {
        if (!map[e.student_id]) {
          map[e.student_id] = {
            course: e.courses?.name,
            campus: e.campuses?.name,
            city: e.campuses?.city,
          };
        }
      });
      return map;
    },
    enabled: studentIds.length > 0,
  });

  // Fetch urgent note counts
  const { data: urgentCounts = {} } = useQuery({
    queryKey: ["urgent-note-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_notes")
        .select("student_id")
        .is("resolved_at" as any, null)
        .or("is_urgent.eq.true,note_type.in.(action_required,info_request)");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((n: any) => {
        counts[n.student_id] = (counts[n.student_id] || 0) + 1;
      });
      return counts;
    },
  });

  const students = data?.students || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = () => {
    const headers = ["First Name", "Last Name", "Email", "Phone", "Course", "Campus", "Immigration Status", "Created"];
    const rows = students.map((s: any) => {
      const enr = (latestEnrollments as any)[s.id] || {};
      return [
        s.first_name, s.last_name, s.email || "", s.phone || "",
        enr.course || "",
        enr.campus ? `${enr.campus}${enr.city ? ` (${enr.city})` : ""}` : "",
        s.immigration_status || "",
        s.created_at ? format(new Date(s.created_at), "yyyy-MM-dd") : "",
      ];
    });
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `students_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Students</h1>
          <div className="flex items-center gap-2">
            {(role === "owner" || role === "admin") && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-1" /> Export CSV
              </Button>
            )}
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => setEnrollOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Student
            </Button>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          <Select value={immigrationFilter} onValueChange={(v) => { setImmigrationFilter(v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Immigration" />
            </SelectTrigger>
            <SelectContent>
              {IMMIGRATION_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Course</TableHead>
                <TableHead className="hidden md:table-cell">Campus</TableHead>
                <TableHead className="hidden lg:table-cell">Agent</TableHead>
                <TableHead className="hidden lg:table-cell">Admin</TableHead>
                <TableHead className="hidden md:table-cell">Immigration</TableHead>
                <TableHead className="hidden sm:table-cell">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
              {!isLoading && students.map((s: any) => {
                const urgentCount = urgentCounts[s.id] || 0;
                const agentInfo = (agentProfiles as any)[s.agent_id];
                const agentName = agentInfo?.full_name || "—";
                const adminName = agentInfo?.admin_id ? (adminProfiles as any)[agentInfo.admin_id] || "—" : "—";
                const enr = (latestEnrollments as any)[s.id] || {};
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`${prefix}/students/${s.id}`)}
                  >
                    <TableCell className="font-medium">
                      <span className="flex items-center gap-2">
                        {s.first_name} {s.last_name}
                        {urgentCount > 0 && (
                          <Badge className="text-[10px] bg-orange-500 text-white px-1.5 py-0 gap-0.5">
                            <Flame className="w-2.5 h-2.5" />
                            {urgentCount}
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">{s.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{s.phone || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{enr.course || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {enr.campus ? (
                        <span>{enr.campus}{enr.city && <span className="text-xs text-muted-foreground/70"> · {enr.city}</span>}</span>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{agentName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground">{adminName}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.immigration_status || "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                      {s.created_at ? format(new Date(s.created_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
              {students.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No students found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
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

      <EnrollStudentDialog open={enrollOpen} onOpenChange={setEnrollOpen} />
    </DashboardLayout>
  );
}
