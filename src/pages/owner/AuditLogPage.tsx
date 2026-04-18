import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Shield, Search, Eye } from "lucide-react";

const PAGE_SIZE = 50;

export default function AuditLogPage() {
  const { role } = useAuth();
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<any>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs", tableFilter, actionFilter, searchTerm, page],
    queryFn: async () => {
      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
      if (actionFilter !== "all") query = query.eq("action", actionFilter);

      const { data } = await query;
      return data || [];
    },
    enabled: role === "owner" || role === "admin",
  });

  // Fetch profiles for user names
  const userIds = [...new Set(logs.map((l: any) => l.user_id).filter(Boolean))];
  const { data: profiles = [] } = useQuery({
    queryKey: ["audit-log-profiles", userIds.join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.id, p]));

  const getActionColor = (action: string) => {
    switch (action) {
      case "INSERT": return "bg-green-100 text-green-700 border-green-200";
      case "UPDATE": return "bg-blue-100 text-blue-700 border-blue-200";
      case "DELETE": return "bg-red-100 text-red-700 border-red-200";
      default: return "";
    }
  };

  const getChangedFields = (log: any) => {
    if (log.action !== "UPDATE" || !log.old_values || !log.new_values) return [];
    const changes: string[] = [];
    for (const key of Object.keys(log.new_values)) {
      if (["updated_at", "created_at"].includes(key)) continue;
      if (JSON.stringify(log.old_values[key]) !== JSON.stringify(log.new_values[key])) {
        changes.push(key);
      }
    }
    return changes;
  };

  if (role !== "owner" && role !== "admin") {
    return <DashboardLayout><div className="text-center text-muted-foreground py-20">Access denied</div></DashboardLayout>;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by record ID..."
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
              <Select value={tableFilter} onValueChange={(v) => { setTableFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  <SelectItem value="students">Students</SelectItem>
                  <SelectItem value="enrollments">Enrollments</SelectItem>
                  <SelectItem value="student_documents">Documents</SelectItem>
                  <SelectItem value="student_notes">Notes</SelectItem>
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">Create</SelectItem>
                  <SelectItem value="UPDATE">Update</SelectItem>
                  <SelectItem value="DELETE">Delete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Changed Fields</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No audit logs found</TableCell></TableRow>
                ) : (
                  logs.map((log: any) => {
                    const profile = profileMap.get(log.user_id);
                    const changes = getChangedFields(log);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.created_at), "dd MMM yyyy HH:mm:ss")}
                        </TableCell>
                        <TableCell className="text-sm">
                          {profile ? profile.full_name : log.user_id ? <span className="text-muted-foreground text-xs">{log.user_id.slice(0, 8)}…</span> : "System"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getActionColor(log.action)}>
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.table_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {changes.length > 0 ? changes.join(", ") : log.action === "INSERT" ? "new record" : "—"}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDetailLog(log)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {logs.length > 0 && (
              <div className="flex items-center justify-between p-4 border-t">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page + 1}</span>
                <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detailLog} onOpenChange={(o) => { if (!o) setDetailLog(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              Audit Detail — {detailLog?.action} on {detailLog?.table_name}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Time</p>
                    <p className="font-medium">{format(new Date(detailLog.created_at), "dd MMM yyyy HH:mm:ss")}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">User</p>
                    <p className="font-medium">{profileMap.get(detailLog.user_id)?.full_name || detailLog.user_id || "System"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Record ID</p>
                    <p className="font-mono text-xs">{detailLog.record_id}</p>
                  </div>
                </div>

                {detailLog.action === "UPDATE" && detailLog.old_values && detailLog.new_values && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Changes</p>
                    <div className="space-y-2">
                      {getChangedFields(detailLog).map((field) => (
                        <div key={field} className="rounded border p-2 text-xs">
                          <p className="font-medium text-foreground">{field}</p>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <div>
                              <span className="text-muted-foreground">Before: </span>
                              <span className="text-destructive">{JSON.stringify(detailLog.old_values[field]) ?? "null"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">After: </span>
                              <span className="text-green-600">{JSON.stringify(detailLog.new_values[field]) ?? "null"}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {detailLog.action === "INSERT" && detailLog.new_values && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Created Record</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[300px]">
                      {JSON.stringify(detailLog.new_values, null, 2)}
                    </pre>
                  </div>
                )}

                {detailLog.action === "DELETE" && detailLog.old_values && (
                  <div>
                    <p className="text-sm font-semibold mb-2">Deleted Record</p>
                    <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[300px]">
                      {JSON.stringify(detailLog.old_values, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
