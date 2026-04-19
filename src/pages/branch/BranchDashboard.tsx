import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle, Users } from "lucide-react";

export default function BranchDashboard() {
  const { user, branchId } = useAuth();

  const { data: branch, isLoading: isLoadingBranch, error: branchError } = useQuery({
    queryKey: ["branch", branchId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*, profiles(full_name)").eq("id", branchId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: consultants, isLoading: isLoadingConsultants, error: consultantsError } = useQuery({
    queryKey: ["branchConsultants", branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("branch_id", branchId);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  if (isLoadingBranch || isLoadingConsultants) return <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}><div>Loading...</div></DashboardLayout>;
  if (branchError) return <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}><div>Error loading branch: {branchError.message}</div></DashboardLayout>;
  if (consultantsError) return <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}><div>Error loading consultants: {consultantsError.message}</div></DashboardLayout>;
  if (!branch) return <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}><div>Branch not found.</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{branch.name} Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Consultants</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{consultants?.length || 0}</div>
            </CardContent>
          </Card>
          {/* Add more branch-specific metrics here */}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Consultants</CardTitle>
            <Button asChild size="sm">
              <Link to="/admin/consultants/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Consultant
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {consultants && consultants.length > 0 ? (
              <div className="grid gap-4">
                {consultants.map((consultant) => (
                  <Card key={consultant.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{consultant.full_name}</h3>
                        <p className="text-sm text-muted-foreground">Email: {consultant.email}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/admin/consultants/${consultant.id}`}>View Consultant</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No consultants in this branch yet. Add your first consultant to get started.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
