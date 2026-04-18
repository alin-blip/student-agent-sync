import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { AddressLookupInput } from "@/components/AddressLookupInput";
import { APP_ROLES } from "@/lib/roles";

export default function AdminAgentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPostcode, setNewPostcode] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const { data: consultants = [] } = useQuery({
    queryKey: ["branch-consultants", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("branch_id", user!.branch_id)
        .eq("role", APP_ROLES.CONSULTANT)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.branch_id,
  });

  const createConsultant = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: {
          email: newEmail,
          full_name: newName,
          role: APP_ROLES.CONSULTANT,
          branch_id: user!.branch_id,
          postcode: newPostcode || undefined,
          address: newAddress || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.user_id) {
        try {
          const conversationPartnerId = user!.id;
          if (conversationPartnerId) {
            const { data: convo } = await supabase.from("direct_conversations").insert({
              participant_1: conversationPartnerId,
              participant_2: data.user_id,
            } as any).select().single();
            if (convo) {
              await supabase.from("direct_messages").insert({
                conversation_id: convo.id,
                sender_id: conversationPartnerId,
                content: "Welcome to the team! 🎉 If you have any questions, please ask here.",
              } as any);
            }
          }
        } catch (e) {
          console.error("Failed to create welcome conversation:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["branch-consultants"] });
      toast({ title: "Consultant created successfully" });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPostcode("");
      setNewAddress("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["branch-consultants"] }),
  });

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.BRANCH_MANAGER]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">My Consultants</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-1" /> Add Consultant
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Consultant</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <AddressLookupInput
                  postcode={newPostcode}
                  address={newAddress}
                  onPostcodeChange={setNewPostcode}
                  onAddressChange={setNewAddress}
                />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => createConsultant.mutate()}
                  disabled={!newEmail || !newName || createConsultant.isPending}
                >
                  {createConsultant.isPending ? "Creating…" : "Create Consultant"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consultant List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consultants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No consultants yet. Add your first consultant to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  consultants.map((consultant: any) => (
                    <TableRow key={consultant.id}>
                      <TableCell className="font-medium">{consultant.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{consultant.email}</TableCell>
                      <TableCell>
                        <Badge variant={consultant.is_active ? "default" : "destructive"} className="text-xs">
                          {consultant.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {consultant.created_at ? format(new Date(consultant.created_at), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleActive.mutate({ id: consultant.id, is_active: !consultant.is_active })}
                          >
                            {consultant.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
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
