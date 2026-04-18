import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function CompanyBranchDetailPage() {
  const { branchId } = useParams();
  const { user } = useAuth();

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
      const { data, error } = await supabase.from("profiles").select("*").eq("branch_id", branchId).eq("role", APP_ROLES.CONSULTANT);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  if (isLoadingBranch || isLoadingConsultants) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Loading...</div></DashboardLayout>;
  if (branchError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading branch: {branchError.message}</div></DashboardLayout>;
  if (consultantsError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading consultants: {consultantsError.message}</div></DashboardLayout>;
  if (!branch) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Branch not found.</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{branch.name}</h1>
        <p className="text-muted-foreground">Manager: {branch.profiles?.full_name || 'N/A'}</p>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Consultants</CardTitle>
            <Button asChild size="sm">
              <Link to={`/company/branches/${branchId}/consultants/new`}>
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
                        <Link to={`/company/consultants/${consultant.id}`}>View Consultant</Link>
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
