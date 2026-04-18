import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CompanyApplicationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCompanyType, setFilterCompanyType] = useState<string>("all");

  const { data: applications, isLoading, error } = useQuery({
    queryKey: ["companyApplications", filterStatus, filterCompanyType],
    queryFn: async () => {
      let query = supabase.from("company_applications").select("*, profiles(full_name)");

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }
      if (filterCompanyType !== "all") {
        query = query.eq("company_type", filterCompanyType);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateApplicationStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { data, error } = await supabase.from("company_applications").update({
        status,
        notes: notes || null,
        reviewed_by: user?.id,
      }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyApplications"] });
      toast({ title: "Application status updated." });
      setIsDetailModalOpen(false);
      setIsRejectModalOpen(false);
      setRejectionNotes("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approveApplication = useMutation({
    mutationFn: async (application: any) => {
      // Create Company
      const { data: companyData, error: companyError } = await supabase.from("companies").insert({
        name: application.company_name,
        contact_email: application.email,
        contact_phone: application.phone,
        business_type: application.company_type,
        address: "", // Placeholder
        city: application.city,
        postcode: "", // Placeholder
      }).select().single();
      if (companyError) throw companyError;

      // Create Company Admin profile
      const { data: profileData, error: profileError } = await supabase.from("profiles").insert({
        full_name: application.contact_name,
        email: application.email,
        role: APP_ROLES.COMPANY_ADMIN,
        company_id: companyData.id,
        // password will be set by user via reset password flow
      }).select().single();
      if (profileError) throw profileError;

      // Create default Branch
      const { data: branchData, error: branchError } = await supabase.from("branches").insert({
        company_id: companyData.id,
        name: `${application.company_name} Main Branch`,
        address: application.city || "",
        city: application.city || "",
        postcode: "",
        manager_id: profileData.id,
        slug: `${application.company_name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-main`,
      }).select().single();
      if (branchError) throw branchError;

      // Update application status to approved
      await updateApplicationStatus.mutateAsync({ id: application.id, status: "approved" });

      return { companyData, profileData, branchData };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyApplications"] });
      toast({ title: "Application approved and company/branch created!" });
      setIsDetailModalOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error approving application", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) return <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN]}><div>Loading applications...</div></DashboardLayout>;
  if (error) return <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN]}><div>Error loading applications: {error.message}</div></DashboardLayout>;

  const companyTypes = Array.from(new Set(applications?.map(app => app.company_type).filter(Boolean) || []));

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Company Applications</h1>
        <p className="text-muted-foreground">Review and manage incoming partner applications.</p>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Applications</CardTitle>
            <div className="flex gap-2">
              <Select onValueChange={setFilterStatus} value={filterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Select onValueChange={setFilterCompanyType} value={filterCompanyType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by Company Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {companyTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {applications && applications.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>City</TableHead>
                    <TableHead>Network Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell>{app.company_name}</TableCell>
                      <TableCell>{app.contact_name}</TableCell>
                      <TableCell>{app.company_type}</TableCell>
                      <TableCell>{app.city}</TableCell>
                      <TableCell>{app.network_size}</TableCell>
                      <TableCell>{app.status}</TableCell>
                      <TableCell>{new Date(app.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => { setSelectedApplication(app); setIsDetailModalOpen(true); }}>View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No company applications found.</p>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Application Details: {selectedApplication?.company_name}</DialogTitle>
            </DialogHeader>
            {selectedApplication && (
              <div className="grid gap-4 py-4">
                <p><strong>Contact:</strong> {selectedApplication.contact_name} ({selectedApplication.email})</p>
                <p><strong>Phone:</strong> {selectedApplication.phone || "N/A"}</p>
                <p><strong>Company Type:</strong> {selectedApplication.company_type || "N/A"}</p>
                <p><strong>City:</strong> {selectedApplication.city || "N/A"}</p>
                <p><strong>Locations:</strong> {selectedApplication.num_locations || "N/A"}</p>
                <p><strong>Employees:</strong> {selectedApplication.num_employees || "N/A"}</p>
                <p><strong>Network Access:</strong> {selectedApplication.network_access?.join(", ") || "N/A"}</p>
                <p><strong>Network Size:</strong> {selectedApplication.network_size || "N/A"}</p>
                <p><strong>Motivation:</strong> {selectedApplication.motivation || "N/A"}</p>
                <p><strong>How Heard:</strong> {selectedApplication.how_heard || "N/A"}</p>
                <p><strong>Status:</strong> {selectedApplication.status}</p>
                {selectedApplication.notes && <p><strong>Notes:</strong> {selectedApplication.notes}</p>}
                {selectedApplication.profiles?.full_name && <p><strong>Reviewed By:</strong> {selectedApplication.profiles.full_name}</p>}
                <p><strong>Applied On:</strong> {new Date(selectedApplication.created_at).toLocaleString()}</p>
              </div>
            )}
            <DialogFooter>
              {selectedApplication?.status === "pending" && (
                <>
                  <Button variant="outline" onClick={() => updateApplicationStatus.mutate({ id: selectedApplication.id, status: "reviewed" })} disabled={updateApplicationStatus.isPending}>
                    Mark as Reviewed
                  </Button>
                  <Button variant="destructive" onClick={() => setIsRejectModalOpen(true)} disabled={updateApplicationStatus.isPending}>
                    Reject
                  </Button>
                  <Button onClick={() => approveApplication.mutate(selectedApplication)} disabled={approveApplication.isPending}>
                    Approve
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setIsDetailModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Modal */}
        <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Application: {selectedApplication?.company_name}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <Label htmlFor="rejectionNotes">Reason for Rejection (Optional)</Label>
              <Textarea
                id="rejectionNotes"
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsRejectModalOpen(false)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => updateApplicationStatus.mutate({ id: selectedApplication.id, status: "rejected", notes: rejectionNotes })}
                disabled={updateApplicationStatus.isPending}
              >
                Confirm Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
