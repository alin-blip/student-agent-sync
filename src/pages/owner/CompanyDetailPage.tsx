import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, Building2 } from "lucide-react";

export default function CompanyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [newBranchName, setNewBranchName] = useState("");

  const { data: company, isLoading: isLoadingCompany, error: companyError } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*, profiles(full_name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: branches, isLoading: isLoadingBranches, error: branchesError, refetch: refetchBranches } = useQuery({
    queryKey: ["companyBranches", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*, profiles(full_name)").eq("company_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleAddBranch = async () => {
    if (!newBranchName || !id) return;
    const { error } = await supabase.from("branches").insert({ company_id: id, name: newBranchName });
    if (error) {
      console.error("Error adding branch:", error.message);
    } else {
      setNewBranchName("");
      refetchBranches();
    }
  };

  if (isLoadingCompany || isLoadingBranches) return <div>Loading company details...</div>;
  if (companyError) return <div>Error loading company: {companyError.message}</div>;
  if (branchesError) return <div>Error loading branches: {branchesError.message}</div>;
  if (!company) return <div>Company not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{company.name}</h1>
        <Button asChild>
          <Link to="/owner/companies">Back to Companies</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Business Type:</p>
            <p className="text-base">{company.business_type}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Contact Email:</p>
            <p className="text-base">{company.contact_email}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Contact Phone:</p>
            <p className="text-base">{company.contact_phone}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Address:</p>
            <p className="text-base">{company.address}, {company.city}, {company.postcode}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Company Admin:</p>
            <p className="text-base">{company.profiles?.full_name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Contract Dates:</p>
            <p className="text-base">{company.contract_start} to {company.contract_end}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <CardDescription>Manage physical locations for this company.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-4">
            <Input
              placeholder="New Branch Name"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddBranch}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Branch
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Branch Manager</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches?.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell className="font-medium">{branch.name}</TableCell>
                  <TableCell>{branch.profiles?.full_name || "N/A"}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/owner/branches/${branch.id}`}>View Branch</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
