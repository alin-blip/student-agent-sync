import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Textarea } from "@/components/ui/textarea";
import {
  Search, UserPlus, ArrowRight, Phone, Mail, StickyNote, AlertTriangle, MessageSquare, Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";

const STATUSES = ["new", "contacted", "qualified", "converted"] as const;
type LeadStatus = typeof STATUSES[number];

const statusConfig: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  contacted: { label: "Contacted", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  qualified: { label: "Qualified", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  converted: { label: "Converted", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
};

// ─── Leads Table (reused by agent, admin "My Leads", owner tabs) ───
function LeadsTable({
  leads,
  isLoading,
  search,
  setSearch,
  filterStatus,
  setFilterStatus,
  agentMap,
  adminMap,
  showAgentColumn,
  showAdminColumn,
  onConvert,
  onNotes,
  onStatusAdvance,
}: {
  leads: any[];
  isLoading: boolean;
  search: string;
  setSearch: (v: string) => void;
  filterStatus: string;
  setFilterStatus: (v: string) => void;
  agentMap: Record<string, string>;
  adminMap?: Record<string, string>;
  showAgentColumn?: boolean;
  showAdminColumn?: boolean;
  onConvert: (lead: any) => void;
  onNotes: (lead: any) => void;
  onStatusAdvance: (id: string, status: string) => void;
}) {
  const filtered = leads.filter((lead: any) => {
    const matchesSearch =
      !search ||
      `${lead.first_name} ${lead.last_name} ${lead.email}`.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || lead.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = leads.filter((l: any) => l.status === s).length;
    return acc;
  }, {} as Record<LeadStatus, number>);

  return (
    <div className="space-y-4">
      {/* Pipeline summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map((status) => (
          <Card
            key={status}
            className={`cursor-pointer transition-all hover:shadow-md ${filterStatus === status ? "ring-2 ring-accent" : ""}`}
            onClick={() => setFilterStatus(filterStatus === status ? "all" : status)}
          >
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{counts[status]}</p>
              <p className="text-xs text-muted-foreground capitalize">{statusConfig[status].label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{statusConfig[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead className="hidden md:table-cell">Nationality</TableHead>
                <TableHead className="hidden lg:table-cell">Interest</TableHead>
                {showAgentColumn && <TableHead className="hidden md:table-cell">Agent</TableHead>}
                {showAdminColumn && <TableHead className="hidden md:table-cell">Admin</TableHead>}
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {Array.from({ length: showAgentColumn && showAdminColumn ? 9 : showAgentColumn ? 8 : 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={showAgentColumn && showAdminColumn ? 9 : showAgentColumn ? 8 : 7} className="text-center py-8 text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead: any) => {
                  const status = lead.status as LeadStatus;
                  const currentIdx = STATUSES.indexOf(status);
                  const nextStatus = currentIdx < STATUSES.length - 1 ? STATUSES[currentIdx + 1] : null;

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="font-medium">
                        {lead.first_name} {lead.last_name}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex flex-col gap-0.5 text-xs">
                          {lead.email && (
                            <a href={`mailto:${lead.email}`} className="flex items-center gap-1 text-muted-foreground hover:text-accent">
                              <Mail className="w-3 h-3" /> {lead.email}
                            </a>
                          )}
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="flex items-center gap-1 text-muted-foreground hover:text-accent">
                              <Phone className="w-3 h-3" /> {lead.phone}
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{lead.nationality || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm max-w-[140px] truncate">{lead.course_interest || "—"}</TableCell>
                      {showAgentColumn && (
                        <TableCell className="hidden md:table-cell text-sm">{agentMap[lead.agent_id] || "—"}</TableCell>
                      )}
                      {showAdminColumn && (
                        <TableCell className="hidden md:table-cell text-sm">{adminMap?.[lead.agent_id] || "—"}</TableCell>
                      )}
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {format(new Date(lead.created_at), "dd MMM yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusConfig[status].color} border-0 text-[10px]`}>
                          {statusConfig[status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7"
                            onClick={() => onNotes(lead)}
                          >
                            <StickyNote className="w-3 h-3 mr-1" />
                            Notes
                            {lead.notes && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-accent inline-block" />}
                          </Button>
                          {nextStatus && nextStatus !== "converted" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => onStatusAdvance(lead.id, nextStatus)}
                            >
                              <ArrowRight className="w-3 h-3 mr-1" />
                              {statusConfig[nextStatus].label}
                            </Button>
                          )}
                          {status !== "converted" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 border-accent text-accent hover:bg-accent hover:text-accent-foreground"
                              onClick={() => onConvert(lead)}
                            >
                              <UserPlus className="w-3 h-3 mr-1" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Team Summary Cards ───
function AdminTeamSummary({ userId }: { userId: string }) {
  const { data: teamCounts = [], isLoading } = useQuery({
    queryKey: ["team-lead-counts", userId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_team_lead_counts", { _admin_id: userId });
      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="pt-4 pb-4"><Skeleton className="h-12 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  if (teamCounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground text-sm">
          No agents in your team have leads yet.
        </CardContent>
      </Card>
    );
  }

  const total = teamCounts.reduce((sum: number, t: any) => sum + Number(t.lead_count), 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          Team Lead Summary
        </h2>
        <Badge variant="outline">{total} total team leads</Badge>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {teamCounts.map((item: any) => (
          <Card key={item.agent_id}>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-2xl font-bold">{item.lead_count}</p>
              <p className="text-xs text-muted-foreground truncate">{item.agent_name}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function LeadsPage() {
  const { toast } = useToast();
  const { user, profile, role } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [convertLead, setConvertLead] = useState<any | null>(null);
  const [notesLead, setNotesLead] = useState<any | null>(null);
  const [notesText, setNotesText] = useState("");
  const [duplicateError, setDuplicateError] = useState<{ lead: any; existingAgentName: string } | null>(null);
  const [contactingAdmin, setContactingAdmin] = useState(false);
  const [ownerTab, setOwnerTab] = useState("my");

  // For owner "All Leads" tab - separate search/filter state
  const [allSearch, setAllSearch] = useState("");
  const [allFilterStatus, setAllFilterStatus] = useState<string>("all");

  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  // Fetch leads (RLS ensures agent/admin only see own, owner sees all)
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // For owner: split leads into "my" and "all"
  const myLeads = isOwner ? leads.filter((l: any) => l.agent_id === user?.id) : leads;
  const allLeads = leads; // owner sees all via RLS

  // Build agent map from leads
  const agentIds = [...new Set(leads.map((l: any) => l.agent_id))];
  const { data: agents = [] } = useQuery({
    queryKey: ["lead-agents", agentIds.join(",")],
    queryFn: async () => {
      if (agentIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, admin_id")
        .in("id", agentIds);
      return data || [];
    },
    enabled: agentIds.length > 0,
  });

  const agentMap = Object.fromEntries(agents.map((a: any) => [a.id, a.full_name]));

  // For owner "All Leads": resolve admin names
  const adminIds = [...new Set(agents.filter((a: any) => a.admin_id).map((a: any) => a.admin_id))];
  const { data: admins = [] } = useQuery({
    queryKey: ["lead-admins", adminIds.join(",")],
    queryFn: async () => {
      if (adminIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", adminIds);
      return data || [];
    },
    enabled: isOwner && adminIds.length > 0,
  });

  const adminNameMap = Object.fromEntries(admins.map((a: any) => [a.id, a.full_name]));
  // Map agent_id -> admin name
  const agentToAdminMap = Object.fromEntries(
    agents.filter((a: any) => a.admin_id).map((a: any) => [a.id, adminNameMap[a.admin_id] || "—"])
  );

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ notes } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast({ title: "Notes saved" });
      setNotesLead(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const convertToStudent = useMutation({
    mutationFn: async (lead: any) => {
      const checks: PromiseLike<any>[] = [];

      if (lead.email) {
        checks.push(
          supabase
            .from("students")
            .select("id, first_name, last_name, agent_id")
            .ilike("email", lead.email)
            .limit(1)
            .then(r => r)
        );
      }

      if (lead.phone) {
        checks.push(
          supabase
            .from("students")
            .select("id, first_name, last_name, agent_id")
            .eq("phone", lead.phone)
            .limit(1)
            .then(r => r)
        );
      }

      const results = await Promise.all(checks);
      const duplicate = results.flatMap((r) => r.data || []).find((s) => s);

      if (duplicate) {
        const { data: existingAgent } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", duplicate.agent_id)
          .single();

        throw new Error(`DUPLICATE:${existingAgent?.full_name || "Unknown agent"}`);
      }

      const { data: student, error: studentErr } = await supabase.from("students").insert({
        agent_id: lead.agent_id,
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone || null,
        nationality: lead.nationality || null,
        notes: lead.course_interest ? `Course interest: ${lead.course_interest}` : null,
      }).select("id").single();
      if (studentErr) throw studentErr;

      if (lead.university_id && lead.course_id && student) {
        const { error: enrollErr } = await supabase.from("enrollments").insert({
          student_id: student.id,
          university_id: lead.university_id,
          course_id: lead.course_id,
          campus_id: lead.campus_id || null,
          intake_id: lead.intake_id || null,
          status: "new_application",
        });
        if (enrollErr) console.error("Enrollment creation failed:", enrollErr);
      }

      const { error: updateErr } = await supabase
        .from("leads")
        .update({ status: "converted" } as any)
        .eq("id", lead.id);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["enrollments"] });
      toast({ title: "Lead converted to student!" });
      setConvertLead(null);
    },
    onError: (e: any) => {
      if (e.message?.startsWith("DUPLICATE:")) {
        const agentName = e.message.replace("DUPLICATE:", "");
        setDuplicateError({ lead: convertLead, existingAgentName: agentName });
        setConvertLead(null);
      } else {
        toast({ title: "Error", description: e.message, variant: "destructive" });
      }
    },
  });

  const handleContactAdmin = async () => {
    if (!duplicateError || !user) return;
    setContactingAdmin(true);
    try {
      const lead = duplicateError.lead;

      const { data: myProfile } = await supabase
        .from("profiles")
        .select("admin_id")
        .eq("id", user.id)
        .single();

      let adminId = myProfile?.admin_id;

      if (!adminId) {
        const { data: ownerRole } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "owner")
          .limit(1)
          .single();
        adminId = ownerRole?.user_id;
      }

      if (!adminId) {
        toast({ title: "Error", description: "Could not find an admin to contact.", variant: "destructive" });
        return;
      }

      const { data: existingConvo } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${adminId}),and(participant_1.eq.${adminId},participant_2.eq.${user.id})`)
        .limit(1)
        .maybeSingle();

      let conversationId = existingConvo?.id;

      if (!conversationId) {
        const { data: newConvo, error: convoErr } = await supabase
          .from("direct_conversations")
          .insert({ participant_1: user.id, participant_2: adminId })
          .select("id")
          .single();
        if (convoErr) throw convoErr;
        conversationId = newConvo.id;
      }

      const studentName = `${lead.first_name} ${lead.last_name}`;
      const agentName = profile?.full_name || "An agent";
      const contactInfo = [lead.email, lead.phone].filter(Boolean).join(", ");

      const message = `⚠️ Duplicate student detected\n\nI tried to enrol ${studentName} (${contactInfo}) but they appear as a duplicate in the system.\n\nPlease guide me on how to proceed.\n\n— ${agentName}`;

      const { error: msgErr } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: message,
        });
      if (msgErr) throw msgErr;

      toast({ title: "Message sent", description: "Your admin has been notified about the duplicate." });
      setDuplicateError(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setContactingAdmin(false);
    }
  };

  const handleStatusAdvance = (id: string, status: string) => {
    updateStatus.mutate({ id, status });
  };

  const handleNotes = (lead: any) => {
    setNotesLead(lead);
    setNotesText(lead.notes || "");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Lead Management</h1>
          <Badge variant="outline" className="text-sm">
            {isOwner ? `${myLeads.length} my leads · ${allLeads.length} total` : `${leads.length} total leads`}
          </Badge>
        </div>

        {/* Admin: Team summary + My Leads */}
        {isAdmin && user && (
          <div className="space-y-6">
            <AdminTeamSummary userId={user.id} />
            <div>
              <h2 className="text-lg font-semibold mb-3">My Leads</h2>
              <LeadsTable
                leads={myLeads}
                isLoading={isLoading}
                search={search}
                setSearch={setSearch}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                agentMap={agentMap}
                onConvert={setConvertLead}
                onNotes={handleNotes}
                onStatusAdvance={handleStatusAdvance}
              />
            </div>
          </div>
        )}

        {/* Owner: Tabs for My Leads / All Leads */}
        {isOwner && (
          <Tabs value={ownerTab} onValueChange={setOwnerTab}>
            <TabsList>
              <TabsTrigger value="my">My Leads</TabsTrigger>
              <TabsTrigger value="all">All Leads</TabsTrigger>
            </TabsList>
            <TabsContent value="my" className="mt-4">
              <LeadsTable
                leads={myLeads}
                isLoading={isLoading}
                search={search}
                setSearch={setSearch}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
                agentMap={agentMap}
                onConvert={setConvertLead}
                onNotes={handleNotes}
                onStatusAdvance={handleStatusAdvance}
              />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <LeadsTable
                leads={allLeads}
                isLoading={isLoading}
                search={allSearch}
                setSearch={setAllSearch}
                filterStatus={allFilterStatus}
                setFilterStatus={setAllFilterStatus}
                agentMap={agentMap}
                adminMap={agentToAdminMap}
                showAgentColumn
                showAdminColumn
                onConvert={setConvertLead}
                onNotes={handleNotes}
                onStatusAdvance={handleStatusAdvance}
              />
            </TabsContent>
          </Tabs>
        )}

        {/* Agent: plain table */}
        {!isOwner && !isAdmin && (
          <LeadsTable
            leads={leads}
            isLoading={isLoading}
            search={search}
            setSearch={setSearch}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            agentMap={agentMap}
            onConvert={setConvertLead}
            onNotes={handleNotes}
            onStatusAdvance={handleStatusAdvance}
          />
        )}
      </div>

      {/* Convert dialog */}
      <Dialog open={!!convertLead} onOpenChange={() => setConvertLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Lead to Student</DialogTitle>
            <DialogDescription>
              This will create a new student record with the lead's information and mark the lead as converted.
            </DialogDescription>
          </DialogHeader>
          {convertLead && (
            <div className="space-y-2 text-sm py-2">
              <p><strong>Name:</strong> {convertLead.first_name} {convertLead.last_name}</p>
              <p><strong>Email:</strong> {convertLead.email}</p>
              {convertLead.phone && <p><strong>Phone:</strong> {convertLead.phone}</p>}
              {convertLead.nationality && <p><strong>Nationality:</strong> {convertLead.nationality}</p>}
              {convertLead.course_interest && <p><strong>Course Interest:</strong> {convertLead.course_interest}</p>}
              <p><strong>Agent:</strong> {agentMap[convertLead.agent_id] || "Unknown"}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertLead(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={convertToStudent.isPending}
              onClick={() => convertLead && convertToStudent.mutate(convertLead)}
            >
              <UserPlus className="w-4 h-4 mr-1" />
              {convertToStudent.isPending ? "Converting..." : "Convert to Student"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate detected dialog */}
      <Dialog open={!!duplicateError} onOpenChange={() => setDuplicateError(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Duplicate Student Detected
            </DialogTitle>
            <DialogDescription>
              A student with the same contact details already exists in the system.
            </DialogDescription>
          </DialogHeader>
          {duplicateError && (
            <div className="space-y-4 py-2">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>This student already exists in the database</AlertTitle>
                <AlertDescription>
                  <strong>{duplicateError.lead.first_name} {duplicateError.lead.last_name}</strong> ({duplicateError.lead.email})
                  is already registered and belongs to another agent: <strong>{duplicateError.existingAgentName}</strong>.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Please contact your admin for guidance on how to proceed with this student.
              </p>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDuplicateError(null)}>Close</Button>
            <Button
              onClick={handleContactAdmin}
              disabled={contactingAdmin}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              {contactingAdmin ? "Sending..." : "Contact Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes dialog */}
      <Dialog open={!!notesLead} onOpenChange={() => setNotesLead(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notes — {notesLead?.first_name} {notesLead?.last_name}</DialogTitle>
            <DialogDescription>
              Add or edit notes for this lead.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Write notes about this lead..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            rows={5}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesLead(null)}>Cancel</Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              disabled={saveNotes.isPending}
              onClick={() => notesLead && saveNotes.mutate({ id: notesLead.id, notes: notesText })}
            >
              {saveNotes.isPending ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
