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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, KeyRound, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { AddressLookupInput } from "@/components/AddressLookupInput";

export default function AdminAgentsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPostcode, setNewPostcode] = useState("");
  const [newAddress, setNewAddress] = useState("");

  // Password dialog state
  const [pwDialogOpen, setPwDialogOpen] = useState(false);
  const [pwUserId, setPwUserId] = useState("");
  const [pwUserName, setPwUserName] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwVisible, setPwVisible] = useState(false);

  const { data: agents = [] } = useQuery({
    queryKey: ["admin-agents", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("admin_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: passwords = [] } = useQuery({
    queryKey: ["admin-agent-passwords", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_passwords").select("user_id, password_plaintext");
      return (data as any[]) || [];
    },
    enabled: !!user?.id,
  });

  const passwordMap = new Map(passwords.map((p: any) => [p.user_id, p.password_plaintext]));

  const createAgent = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-owner", {
        body: {
          email: newEmail,
          password: newPassword,
          full_name: newName,
          role: "agent",
          admin_id: user!.id,
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
          const { data: convo } = await supabase.from("direct_conversations").insert({
            participant_1: user!.id,
            participant_2: data.user_id,
          } as any).select().single();
          if (convo) {
            await supabase.from("direct_messages").insert({
              conversation_id: convo.id,
              sender_id: user!.id,
              content: "Welcome to the team! 🎉 If you have any questions, please ask here.",
            } as any);
          }
        } catch (e) {
          console.error("Failed to create welcome conversation:", e);
        }
      }
      queryClient.invalidateQueries({ queryKey: ["admin-agents"] });
      queryClient.invalidateQueries({ queryKey: ["admin-agent-passwords"] });
      toast({ title: "Agent created successfully" });
      setOpen(false);
      setNewEmail("");
      setNewName("");
      setNewPassword("");
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-agents"] }),
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
      queryClient.invalidateQueries({ queryKey: ["admin-agent-passwords"] });
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
    <DashboardLayout allowedRoles={["admin"]}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">My Agents</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="w-4 h-4 mr-1" /> Add Agent
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Agent</DialogTitle>
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
                <AddressLookupInput
                  postcode={newPostcode}
                  address={newAddress}
                  onPostcodeChange={setNewPostcode}
                  onAddressChange={setNewAddress}
                />
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  onClick={() => createAgent.mutate()}
                  disabled={!newEmail || !newName || !newPassword || createAgent.isPending}
                >
                  {createAgent.isPending ? "Creating…" : "Create Agent"}
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
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No agents yet. Add your first agent to get started.
                  </TableCell>
                </TableRow>
              ) : (
                agents.map((agent: any) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{agent.email}</TableCell>
                    <TableCell>
                      <Badge variant={agent.is_active ? "default" : "destructive"} className="text-xs">
                        {agent.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {agent.created_at ? format(new Date(agent.created_at), "dd MMM yyyy") : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openPwDialog(agent.id, agent.full_name)}
                          title="Password"
                        >
                          <KeyRound className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive.mutate({ id: agent.id, is_active: !agent.is_active })}
                        >
                          {agent.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
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
