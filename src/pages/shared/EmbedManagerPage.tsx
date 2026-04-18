import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function EmbedManagerPage() {
  const { user, role, companyId } = useAuth();

  const { data: branches, isLoading, error } = useQuery({
    queryKey: ["embedBranches", role, companyId],
    queryFn: async () => {
      let query = supabase.from("branches").select("id, name, slug, widget_settings(allowed_domains)");

      if (role === APP_ROLES.COMPANY_ADMIN && companyId) {
        query = query.eq("company_id", companyId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN, APP_ROLES.COMPANY_ADMIN]}><div>Loading...</div></DashboardLayout>;
  if (error) return <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN, APP_ROLES.COMPANY_ADMIN]}><div>Error loading branches: {error.message}</div></DashboardLayout>;

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN, APP_ROLES.COMPANY_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Embed Manager</h1>
        <p className="text-muted-foreground">Manage your branch widgets and track their performance.</p>

        <Card>
          <CardHeader>
            <CardTitle>Your Branches with Embeds</CardTitle>
          </CardHeader>
          <CardContent>
            {branches && branches.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Name</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Allowed Domains</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell>{branch.name}</TableCell>
                      <TableCell>{branch.slug}</TableCell>
                      <TableCell>{branch.widget_settings?.[0]?.allowed_domains?.join(", ") || "N/A"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/${role === APP_ROLES.SUPER_ADMIN ? 'owner' : 'company'}/branches/${branch.id}`}>View/Edit Widget</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No branches with configured embeds yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
