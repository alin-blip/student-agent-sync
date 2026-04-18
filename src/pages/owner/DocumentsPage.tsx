import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileText, Search } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const DOC_TYPES = ["All", "Passport", "Transcript", "Offer Letter", "Visa", "Qualification Certificate", "Other"];

export default function DocumentsPage() {
  const { role } = useAuth();
  const navigate = useNavigate();
  const prefix = role === "owner" ? "/owner" : "/admin";
  const [search, setSearch] = useState("");
  const [docTypeFilter, setDocTypeFilter] = useState("All");

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["all-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_documents")
        .select("*, students!inner(first_name, last_name, agent_id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents-list"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return data || [];
    },
  });

  const agentMap = Object.fromEntries(agents.map((a: any) => [a.id, a.full_name]));

  const filtered = documents.filter((doc: any) => {
    const studentName = `${doc.students?.first_name} ${doc.students?.last_name}`.toLowerCase();
    const agentName = (agentMap[doc.agent_id] || "").toLowerCase();
    const matchSearch = !search || studentName.includes(search.toLowerCase()) || agentName.includes(search.toLowerCase()) || doc.file_name.toLowerCase().includes(search.toLowerCase());
    const matchType = docTypeFilter === "All" || doc.doc_type === docTypeFilter;
    return matchSearch && matchType;
  });

  const handleDownload = async (doc: any) => {
    const { data } = await supabase.storage.from("student-documents").download(doc.file_path);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">All Documents</h1>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by student, agent or file name…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={docTypeFilter} onValueChange={setDocTypeFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No documents found</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((doc: any) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate max-w-[200px]">{doc.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{doc.doc_type}</TableCell>
                      <TableCell>
                        <button
                          className="text-sm text-primary hover:underline"
                          onClick={() => navigate(`${prefix}/students/${doc.student_id}`)}
                        >
                          {doc.students?.first_name} {doc.students?.last_name}
                        </button>
                      </TableCell>
                      <TableCell className="text-sm">{agentMap[doc.agent_id] || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {doc.file_size ? `${(doc.file_size / 1024).toFixed(0)} KB` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(doc.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(doc)}>
                          <Download className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
