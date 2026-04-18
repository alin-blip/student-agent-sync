import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";

export default function CompanyDashboard() {
  const { user, companyId } = useAuth();

  const { data: company, isLoading: isLoadingCompany, error: companyError } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*, profiles(full_name)").eq("id", companyId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: branches, isLoading: isLoadingBranches, error: branchesError } = useQuery({
    queryKey: ["companyBranches", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*, profiles(full_name)").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  if (isLoadingCompany || isLoadingBranches) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Loading...</div></DashboardLayout>;
  if (companyError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading company: {companyError.message}</div></DashboardLayout>;
  if (branchesError) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Error loading branches: {branchesError.message}</div></DashboardLayout>;
  if (!company) return <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}><div>Company not found.</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{company.name} Dashboard</h1>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Branches</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{branches?.length || 0}</div>
            </CardContent>
          </Card>
          {/* Add more company-specific metrics here */}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Your Branches</CardTitle>
            <Button asChild size="sm">
              <Link to="/company/branches/new">
                <PlusCircle className="mr-2 h-4 w-4" /> Add New Branch
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {branches && branches.length > 0 ? (
              <div className="grid gap-4">
                {branches.map((branch) => (
                  <Card key={branch.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{branch.name}</h3>
                        <p className="text-sm text-muted-foreground">Manager: {branch.profiles?.full_name || 'N/A'}</p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/company/branches/${branch.id}`}>View Branch</Link>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No branches added yet. Add your first branch to get started.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
