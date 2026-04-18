import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus,
  Download,
  Trash2,
  FileText,
  Image,
  BookOpen,
  HelpCircle,
  GraduationCap,
  Palette,
  FolderOpen,
  ExternalLink,
} from "lucide-react";
import britishCouncilImg from "@/assets/british-council-cert.png";
import facebookCoverImg from "@/assets/eduforyou-facebook-cover.png";

const CATEGORIES = [
  { value: "social-media", label: "Social Media Templates", icon: Image, color: "bg-pink-100 text-pink-700" },
  { value: "guides", label: "Guides", icon: BookOpen, color: "bg-blue-100 text-blue-700" },
  { value: "faq", label: "FAQ", icon: HelpCircle, color: "bg-amber-100 text-amber-700" },
  { value: "training", label: "Training", icon: GraduationCap, color: "bg-green-100 text-green-700" },
  { value: "brand-assets", label: "Brand Assets", icon: Palette, color: "bg-purple-100 text-purple-700" },
];

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function ResourcesPage() {
  const { role, user } = useAuth();
  const canManage = role === "owner" || role === "admin";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("guides");
  const [file, setFile] = useState<File | null>(null);

  const { data: resources = [], isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*, profiles!resources_uploaded_by_fkey(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: { id: string; file_path: string }) => {
      await supabase.storage.from("resource-files").remove([resource.file_path]);
      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource deleted");
    },
    onError: () => toast.error("Failed to delete resource"),
  });

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Title and file are required");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${category}/${Date.now()}_${file.name}`;

      const { error: uploadErr } = await supabase.storage
        .from("resource-files")
        .upload(filePath, file);
      if (uploadErr) throw uploadErr;

      const { error: insertErr } = await supabase.from("resources").insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        file_path: filePath,
        file_name: file.name,
        file_type: file.type || ext,
        file_size: file.size,
        uploaded_by: user!.id,
      });
      if (insertErr) throw insertErr;

      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource uploaded!");
      setTitle("");
      setDescription("");
      setCategory("guides");
      setFile(null);
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (filePath: string, fileName: string) => {
    const { data } = supabase.storage.from("resource-files").getPublicUrl(filePath);
    const a = document.createElement("a");
    a.href = data.publicUrl;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  };

  const filtered = activeTab === "all" ? resources : resources.filter((r: any) => r.category === activeTab);

  return (
    <DashboardLayout allowedRoles={["owner", "admin", "agent"]}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Access templates, guides, training materials and brand assets.
          </p>
          {canManage && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" /> Upload Resource</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Resource</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Title *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource title" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" rows={2} />
                  </div>
                  <div>
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>File *</Label>
                    <Input type="file" onChange={e => setFile(e.target.files?.[0] || null)} />
                  </div>
                  <Button onClick={handleUpload} disabled={uploading} className="w-full">
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Category tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="all">
              <FolderOpen className="h-4 w-4 mr-1" /> All
            </TabsTrigger>
            {CATEGORIES.map(c => (
              <TabsTrigger key={c.value} value={c.value}>
                <c.icon className="h-4 w-4 mr-1" /> {c.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-4 space-y-6">
            {/* Facebook Cover Banner - show on Social Media or All tab */}
            {(activeTab === "social-media" || activeTab === "all") && (
              <Card className="overflow-hidden border-2 border-[hsl(var(--primary))]">
                <div className="flex flex-col">
                  <img
                    src={facebookCoverImg}
                    alt="EduForYou Certified Agent - Facebook Cover"
                    className="w-full object-contain"
                  />
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div>
                      <Badge className="w-fit bg-pink-100 text-pink-700 hover:bg-pink-100 mb-1">
                        <Image className="h-3 w-3 mr-1" /> Social Media Templates
                      </Badge>
                      <h3 className="text-sm font-bold">EduForYou Facebook Cover — Certified Agent</h3>
                    </div>
                    <a href={facebookCoverImg} download="eduforyou-facebook-cover.png">
                      <Button size="sm" variant="outline">
                        <Download className="h-3 w-3 mr-1" /> Download
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            )}

            {/* British Council Banner - show on Training or All tab */}
            {(activeTab === "training" || activeTab === "all") && (
              <Card className="overflow-hidden border-2 border-[hsl(170,80%,45%)]">
                <div className="flex flex-col sm:flex-row">
                  <div className="sm:w-48 shrink-0">
                    <img
                      src={britishCouncilImg}
                      alt="British Council UK Agent Quality Framework - I am a UK Certified Counsellor"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 p-5 flex flex-col justify-center gap-3">
                    <Badge className="w-fit bg-green-100 text-green-700 hover:bg-green-100">
                      <GraduationCap className="h-3 w-3 mr-1" /> Training
                    </Badge>
                    <h3 className="text-lg font-bold">Obține Gratuit Certificarea British Council</h3>
                    <p className="text-sm text-muted-foreground">
                      Înregistrează-te pe platforma UK Agent Quality Framework și obține certificarea de UK Certified Counsellor — gratuit.
                    </p>
                    <a
                      href="https://agent-counsellor-ukhub.britishcouncil.org/Account/Register"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="w-fit">
                        <ExternalLink className="h-4 w-4 mr-2" /> Înregistrează-te Gratuit
                      </Button>
                    </a>
                  </div>
                </div>
              </Card>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse h-40" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card className="py-12">
                <CardContent className="flex flex-col items-center text-center text-muted-foreground">
                  <FolderOpen className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">No resources in this category yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((res: any) => {
                  const cat = CATEGORIES.find(c => c.value === res.category);
                  const CatIcon = cat?.icon || FileText;
                  return (
                    <Card key={res.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${cat?.color || "bg-muted text-foreground"}`}>
                              <CatIcon className="h-4 w-4" />
                            </div>
                            <CardTitle className="text-sm font-semibold truncate">{res.title}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {cat?.label || res.category}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {res.description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">{res.description}</p>
                        )}
                        <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                          <span>{res.file_name} · {formatFileSize(res.file_size)}</span>
                          <span>{res.profiles?.full_name}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleDownload(res.file_path, res.file_name)}>
                            <Download className="h-3 w-3 mr-1" /> Download
                          </Button>
                          {canManage && (role === "owner" || res.uploaded_by === user?.id) && (
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate({ id: res.id, file_path: res.file_path })}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
