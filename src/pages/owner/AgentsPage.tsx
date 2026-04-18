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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, KeyRound, Eye, EyeOff } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { AddressLookupInput } from "@/components/AddressLookupInput";
import { usePresenceMap } from "@/contexts/PresenceContext";
import { APP_ROLES } from "@/lib/roles";

export default function AgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const presenceMap = usePresenceMap();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>(APP_ROLES.CONSULTANT);
  const [newAdminId, setNewAdminId] = useState(""); // This will now be branch_manager_id
  const [newPostcode, setNewPostcode] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      return data || [];
    },
  });

  const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
  const branchManagers = profiles.filter((p: any) => roleMap.get(p.id) === APP_ROLES.BRANCH_MANAGER);

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: {
          email: newEmail,
          full_name: newName,
          role: newRole,
          branch_manager_id: newRole === APP_ROLES.CONSULTANT && newAdminId ? newAdminId : undefined,
          postcode: newPostcode || undefined,
          address: newAddress || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.user_id && newRole === APP_ROLES.CONSULTANT) {
        try {
          const conversationPartnerId = newAdminId || user?.id;
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
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-roles"] });
      toast({ title: "User created successfully" });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewRole(APP_ROLES.CONSULTANT);
      setNewAdminId("");
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["all-profiles"] }),
  });

  const changeRole = useMutation({
    mutationFn: async ({ user_id, new_role }: { user_id: string; new_role: string }) => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: { action: "change_role", user_id, new_role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["all-roles"] });
      toast({ title: "Role updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  return (
    <DashboardLayout allowedRoles={[APP_ROLES.SUPER_ADMIN]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Manage Users</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-1" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New User</DialogTitle>
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
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={APP_ROLES.COMPANY_ADMIN}>Company Admin</SelectItem>
                      <SelectItem value={APP_ROLES.BRANCH_MANAGER}>Branch Manager</SelectItem>
                      <SelectItem value={APP_ROLES.CONSULTANT}>Consultant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRole === APP_ROLES.CONSULTANT && branchManagers.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assign to Branch Manager</Label>
                    <Select value={newAdminId} onValueChange={setNewAdminId}>
                      <SelectTrigger><SelectValue placeholder="Select branch manager (optional)" /></SelectTrigger>
                      <SelectContent>
                        {branchManagers.map((a: any) => (
                          <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <AddressLookupInput
                  postcode={newPostcode}
                  address={newAddress}
                  onPostcodeChange={setNewPostcode}
                  onAddressChange={setNewAddress}
                />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => createUser.mutate()}
                  disabled={!newEmail || !newName || createUser.isPending}
                >
                  {createUser.isPending ? "Creating…" : "Create User"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Online</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{p.email}</TableCell>
                  <TableCell>
                    {(roleMap.get(p.id) as string) === APP_ROLES.SUPER_ADMIN ? (
                      <Badge variant="secondary" className="capitalize text-xs">Super Admin</Badge>
                    ) : (roleMap.get(p.id) as string) === APP_ROLES.COMPANY_ADMIN ? (
                      <Badge variant="outline" className="capitalize text-xs">Company Admin</Badge>
                    ) : (roleMap.get(p.id) as string) === APP_ROLES.BRANCH_MANAGER ? (
                      <Badge variant="outline" className="capitalize text-xs">Branch Manager</Badge>
                    ) : (
                      <Badge variant="outline" className="capitalize text-xs">Consultant</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {presenceMap.has(p.id) ? (
                      <Badge variant="success" className="text-xs">Online</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">Offline</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.is_active ? (
                      <Badge variant="success" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                    {format(new Date(p.created_at), "PPP")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center space-x-2">
                      <Select
                        value={roleMap.get(p.id) as string}
                        onValueChange={(newRole) => changeRole.mutate({ user_id: p.id, new_role: newRole })}
                        disabled={roleMap.get(p.id) === APP_ROLES.SUPER_ADMIN} // Cannot change owner role
                      >
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue placeholder="Change Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={APP_ROLES.COMPANY_ADMIN}>Company Admin</SelectItem>
                          <SelectItem value={APP_ROLES.BRANCH_MANAGER}>Branch Manager</SelectItem>
                          <SelectItem value={APP_ROLES.CONSULTANT}>Consultant</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })}
                        disabled={p.id === user?.id} // Cannot deactivate self
                      >
                        {p.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
