import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { APP_ROLES } from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { AddressLookupInput } from "@/components/AddressLookupInput";

export default function CompanyBranchCreatePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const [name, setName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");

  const createBranch = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Company ID is missing.");
      const { data, error } = await supabase.from("branches").insert({
        company_id: companyId,
        name,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        address,
        city,
        postcode,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companyBranches"] });
      toast({ title: "Branch created successfully" });
      navigate("/company/dashboard");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.COMPANY_ADMIN]}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Create New Branch</h1>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Branch Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Branch Name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="contact@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+44 1234 567890" />
          </div>
          <AddressLookupInput
            postcode={postcode}
            address={address}
            onPostcodeChange={setPostcode}
            onAddressChange={setAddress}
            onCityChange={setCity}
          />
          <Button
            className="w-full"
            onClick={() => createBranch.mutate()}
            disabled={!name || !contactEmail || createBranch.isPending}
          >
            {createBranch.isPending ? "Creating..." : "Create Branch"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
