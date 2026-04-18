import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlusCircle, UserPlus } from "lucide-react";

export default function BranchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [newConsultantEmail, setNewConsultantEmail] = useState("");

  const { data: branch, isLoading: isLoadingBranch, error: branchError } = useQuery({
    queryKey: ["branch", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*, companies(name), profiles(full_name)").eq("id", id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: consultants, isLoading: isLoadingConsultants, error: consultantsError, refetch: refetchConsultants } = useQuery({
    queryKey: ["branchConsultants", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").eq("branch_id", id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const handleAddConsultant = async () => {
    if (!newConsultantEmail || !id) return;
    // In a real scenario, you'd likely invite a user or assign an existing one.
    // For simplicity, this example assumes a user with this email exists and can be assigned.
    // A more robust implementation would involve creating a new user or searching for an existing one.
    const { data: userProfile, error: profileError } = await supabase.from("profiles").select("id").eq("email", newConsultantEmail).single();

    if (profileError || !userProfile) {
      console.error("Error finding user or user does not exist:", profileError?.message || "User not found");
      alert("User with this email not found. Please ensure the user exists.");
      return;
    }

    const { error: updateError } = await supabase.from("profiles").update({ branch_id: id }).eq("id", userProfile.id);

    if (updateError) {
      console.error("Error assigning consultant:", updateError.message);
    } else {
      setNewConsultantEmail("");
      refetchConsultants();
    }
  };

  if (isLoadingBranch || isLoadingConsultants) return <div>Loading branch details...</div>;
  if (branchError) return <div>Error loading branch: {branchError.message}</div>;
  if (consultantsError) return <div>Error loading consultants: {consultantsError.message}</div>;
  if (!branch) return <div>Branch not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{branch.name}</h1>
        <Button asChild>
          <Link to={`/owner/companies/${branch.company_id}`}>Back to {branch.companies?.name || "Company"}</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium">Company:</p>
            <p className="text-base">{branch.companies?.name || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Address:</p>
            <p className="text-base">{branch.address}, {branch.city}, {branch.postcode}</p>
          </div>
          <div>
            <p className="text-sm font-medium">Branch Manager:</p>
            <p className="text-base">{branch.profiles?.full_name || "N/A"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Consultants</CardTitle>
          <CardDescription>Manage consultants assigned to this branch.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-2 mb-4">
            <Input
              placeholder="Consultant Email to Assign"
              value={newConsultantEmail}
              onChange={(e) => setNewConsultantEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleAddConsultant}>
              <UserPlus className="mr-2 h-4 w-4" />
              Assign Consultant
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {consultants?.map((consultant) => (
                <TableRow key={consultant.id}>
                  <TableCell className="font-medium">{consultant.full_name}</TableCell>
                  <TableCell>{consultant.email}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" disabled>
                      Remove (TODO)
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
