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

export default function AgentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const presenceMap = usePresenceMap();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<string>("agent");
  const [newPassword, setNewPassword] = useState("");
  const [newAdminId, setNewAdminId] = useState("");
  const [newPostcode, setNewPostcode] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Password dialog state
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUserId, setPwUserId] = useState("");
  const [pwUserName, setPwUserName] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwVisible, setPwVisible] = useState(false);

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

  const { data: passwords = [] } = useQuery({
    queryKey: ["all-passwords"],
    queryFn: async () => {
      const { data } = await supabase.from("user_passwords").select("user_id, password_plaintext");
      return (data as any[]) || [];
    },
  });

  const passwordMap = new Map(passwords.map((p: any) => [p.user_id, p.password_plaintext]));
  const roleMap = new Map(roles.map((r: any) => [r.user_id, r.role]));
  const admins = profiles.filter((p: any) => roleMap.get(p.id) === "admin");

  const createUser = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName,
          role: newRole,
          admin_id: newRole === "agent" && newAdminId ? newAdminId : undefined,
          postcode: newPostcode || undefined,
          address: newAddress || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.user_id && newRole === "agent") {
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
      queryClient.invalidateQueries({ queryKey: ["all-passwords"] });
      toast({ title: "User created successfully" });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
      setNewRole("agent");
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

  const resetPassword = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { user_id: pwUserId, new_password: pwNew },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-passwords"] });
      toast({ title: "Password updated successfully" });
      setPwDialogOpen(false);
      setPwNew("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const openPwDialog = (userId: string, userName: string) => {
    setPwUserId(userId);
    setPwUserName(userName);
    setPwNew("");
    setPwVisible(false);
    setPwDialogOpen(true);
  };

  return (
    <DashboardLayout allowedRoles={["owner"]}>
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
                  <Label>Password</Label>
                  <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newRole === "agent" && admins.length > 0 && (
                  <div className="space-y-2">
                    <Label>Assign to Admin</Label>
                    <Select value={newAdminId} onValueChange={setNewAdminId}>
                      <SelectTrigger><SelectValue placeholder="Select admin (optional)" /></SelectTrigger>
                      <SelectContent>
                        {admins.map((a: any) => (
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
                  disabled={!newEmail || !newName || !newPassword || createUser.isPending}
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
                    {(roleMap.get(p.id) as string) === "owner" ? (
                      <Badge variant="secondary" className="capitalize text-xs">owner</Badge>
                    ) : (
                      <Select
                        value={(roleMap.get(p.id) as string) || ""}
                        onValueChange={(val) => changeRole.mutate({ user_id: p.id, new_role: val })}
                        disabled={changeRole.isPending}
                      >
                        <SelectTrigger className="w-[110px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="agent">Agent</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      const presence = presenceMap[p.id];
                      const isOnline = presence?.is_online;
                      const lastSeen = presence?.last_seen_at;
                      return (
                        <div className="flex items-center gap-2">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
                          <span className="text-xs text-muted-foreground">
                            {isOnline
                              ? "Online"
                              : lastSeen
                                ? formatDistanceToNow(new Date(lastSeen), { addSuffix: true })
                                : "Never"}
                          </span>
                        </div>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.is_active ? "default" : "destructive"} className="text-xs">
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {format(new Date(p.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(roleMap.get(p.id) as string) !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPwDialog(p.id, p.full_name)}
                          title="Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })}
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

        {/* Password Dialog */}
        <Dialog open={pwDialogOpen} onOpenChange={setPwDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Password — {pwUserName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Current Password</Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    type={pwVisible ? "text" : "password"}
                    value={passwordMap.get(pwUserId) || "—"}
                    className="bg-muted"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setPwVisible(!pwVisible)}>
                    {pwVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <Button
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => resetPassword.mutate()}
                disabled={!pwNew || pwNew.length < 6 || resetPassword.isPending}
              >
                {resetPassword.isPending ? "Updating…" : "Update Password"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
