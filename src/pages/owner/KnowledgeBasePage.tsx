
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Trash2, BookOpen, GraduationCap, Palette, Settings2, Globe, FileText, Download, Loader2, Check, Pencil, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const CATEGORIES = [
  { value: "courses", label: "Courses", icon: GraduationCap },
  { value: "brand", label: "Brand", icon: Palette },
  { value: "processes", label: "Processes", icon: Settings2 },
  { value: "immigration", label: "Immigration", icon: Globe },
  { value: "general", label: "General", icon: FileText },
] as const;

type KBEntry = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  created_by: string | null;
};

type ScrapedCourse = {
  name: string;
  level: string;
  study_mode: string;
  duration: string;
  campus_locations: string[];
  entry_requirements: string;
  description: string;
  source_url: string;
};

export default function KnowledgeBasePage() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  // Filter state
  const [searchFilter, setSearchFilter] = useState("");

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState("www.globalbanking.ac.uk");
  const [importStep, setImportStep] = useState<"input" | "scraping" | "preview" | "importing" | "done">("input");
  const [scrapedCourses, setScrapedCourses] = useState<ScrapedCourse[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(new Set());
  const [importSummary, setImportSummary] = useState<any>(null);
  const [universityName, setUniversityName] = useState("");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["ai-knowledge-base"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_knowledge_base")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KBEntry[];
    },
  });

  // Extract unique university names from titles (pattern: "UniversityName — ...")
  const universityNames = useMemo(() => {
    const names = new Set<string>();
    entries.forEach((e) => {
      if (e.category === "courses" && e.title.includes(" — ")) {
        names.add(e.title.split(" — ")[0].trim());
      }
    });
    return [...names].sort();
  }, [entries]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ai_knowledge_base").insert({
        title: title.trim(),
        content: content.trim(),
        category,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
      toast.success("Knowledge entry added");
      setTitle("");
      setContent("");
      setCategory("general");
      setDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editId) return;
      const { error } = await supabase
        .from("ai_knowledge_base")
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory,
        })
        .eq("id", editId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
      toast.success("Entry updated");
      setEditOpen(false);
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
      toast.success("Entry deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canManage = role === "owner" || role === "branch_manager";

  const openEdit = (entry: KBEntry) => {
    setEditId(entry.id);
    setEditTitle(entry.title);
    setEditContent(entry.content);
    setEditCategory(entry.category);
    setEditOpen(true);
  };

  const handleScrape = async () => {
    setImportStep("scraping");
    try {
      const { data, error } = await supabase.functions.invoke("scrape-university", {
        body: { url: importUrl },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Scrape failed");

      const courses = data.courses || [];
      setScrapedCourses(courses);
      setSelectedCourses(new Set(courses.map((_: any, i: number) => i)));

      const urlLower = importUrl.toLowerCase();
      if (urlLower.includes("globalbanking")) setUniversityName("Global Banking School");
      else {
        const domain = importUrl.replace(/https?:\/\//, "").replace("www.", "").split(".")[0];
        setUniversityName(domain.charAt(0).toUpperCase() + domain.slice(1));
      }

      setImportStep("preview");
      toast.success(`Found ${courses.length} courses`);
    } catch (e: any) {
      toast.error(e.message || "Scraping failed");
      setImportStep("input");
    }
  };

  const handleImport = async () => {
    setImportStep("importing");
    try {
      const selected = scrapedCourses.filter((_, i) => selectedCourses.has(i));
      const { data, error } = await supabase.functions.invoke("bulk-import-university", {
        body: { university_name: universityName, courses: selected },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || "Import failed");

      setImportSummary(data.summary);
      setImportStep("done");
      queryClient.invalidateQueries({ queryKey: ["ai-knowledge-base"] });
      toast.success("Import completed!");
    } catch (e: any) {
      toast.error(e.message || "Import failed");
      setImportStep("preview");
    }
  };

  const resetImport = () => {
    setImportStep("input");
    setScrapedCourses([]);
    setSelectedCourses(new Set());
    setImportSummary(null);
    setUniversityName("");
  };

  const toggleCourse = (idx: number) => {
    setSelectedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const getFilteredEntries = (tab: string) => {
    let filtered = entries.filter((e) => tab === "all" || e.category === tab);
    if (searchFilter) {
      const lower = searchFilter.toLowerCase();
      filtered = filtered.filter(
        (e) => e.title.toLowerCase().includes(lower) || e.content.toLowerCase().includes(lower)
      );
    }
    return filtered;
  };

  return (
    <DashboardLayout allowedRoles={["owner"]}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">AI Knowledge Base</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage content that feeds into the AI assistant's knowledge
          </p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Dialog open={importOpen} onOpenChange={(open) => { setImportOpen(open); if (!open) resetImport(); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" /> Import from Website
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>
                    {importStep === "input" && "Import Courses from Website"}
                    {importStep === "scraping" && "Scanning website…"}
                    {importStep === "preview" && "Review Found Courses"}
                    {importStep === "importing" && "Importing…"}
                    {importStep === "done" && "Import Complete"}
                  </DialogTitle>
                </DialogHeader>

                {importStep === "input" && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>University Website URL</Label>
                      <Input
                        value={importUrl}
                        onChange={(e) => setImportUrl(e.target.value)}
                        placeholder="e.g. www.globalbanking.ac.uk"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      We'll scan the website to find all courses, campuses, and programme details.
                      Found data will be added to your database and knowledge base.
                    </p>
                    <Button onClick={handleScrape} className="w-full" disabled={!importUrl.trim()}>
                      <Globe className="h-4 w-4 mr-2" /> Start Scanning
                    </Button>
                  </div>
                )}

                {importStep === "scraping" && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Scanning website for courses…</p>
                    <p className="text-xs text-muted-foreground">This may take 1-2 minutes</p>
                  </div>
                )}

                {importStep === "preview" && (
                  <div className="flex flex-col gap-4 min-h-0">
                    <div className="space-y-2">
                      <Label>University Name</Label>
                      <Input value={universityName} onChange={(e) => setUniversityName(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {scrapedCourses.length} courses found — {selectedCourses.size} selected
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (selectedCourses.size === scrapedCourses.length) setSelectedCourses(new Set());
                          else setSelectedCourses(new Set(scrapedCourses.map((_, i) => i)));
                        }}
                      >
                        {selectedCourses.size === scrapedCourses.length ? "Deselect All" : "Select All"}
                      </Button>
                    </div>
                    <ScrollArea className="flex-1 max-h-[40vh] border rounded-md">
                      <div className="p-2 space-y-1">
                        {scrapedCourses.map((course, idx) => (
                          <label
                            key={idx}
                            className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedCourses.has(idx)}
                              onCheckedChange={() => toggleCourse(idx)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{course.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {course.level} · {course.study_mode}
                                {course.duration && ` · ${course.duration}`}
                              </p>
                              {course.campus_locations?.length > 0 && (
                                <p className="text-xs text-muted-foreground">
                                  📍 {course.campus_locations.join(", ")}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                    <Button onClick={handleImport} disabled={selectedCourses.size === 0 || !universityName.trim()}>
                      <Check className="h-4 w-4 mr-2" /> Import {selectedCourses.size} Courses
                    </Button>
                  </div>
                )}

                {importStep === "importing" && (
                  <div className="flex flex-col items-center justify-center py-12 gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Importing courses and creating knowledge base entries…</p>
                  </div>
                )}

                {importStep === "done" && importSummary && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Courses Added</p>
                        <p className="text-2xl font-bold">{importSummary.coursesInserted}</p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Skipped (Duplicates)</p>
                        <p className="text-2xl font-bold">{importSummary.coursesSkipped}</p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">Campuses Created</p>
                        <p className="text-2xl font-bold">{importSummary.campusesCreated}</p>
                      </Card>
                      <Card className="p-3">
                        <p className="text-xs text-muted-foreground">KB Entries Created</p>
                        <p className="text-2xl font-bold">{importSummary.knowledgeBaseEntries}</p>
                      </Card>
                    </div>
                    <Button onClick={() => { setImportOpen(false); resetImport(); }} className="w-full">
                      Done
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" /> Add Knowledge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add Knowledge Entry</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!title.trim() || !content.trim()) return;
                    addMutation.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. University of London — Course List" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Paste course details, brand guidelines, process steps, etc."
                      rows={10}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                    {addMutation.isPending ? "Saving…" : "Save Entry"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Knowledge Entry</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editTitle.trim() || !editContent.trim()) return;
              editMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={10} required />
            </div>
            <Button type="submit" className="w-full" disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving…" : "Update Entry"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Search/Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search entries by title or content…"
            className="pl-9"
          />
        </div>
        {universityNames.length > 0 && (
          <Select
            value={searchFilter && universityNames.includes(searchFilter) ? searchFilter : "all"}
            onValueChange={(v) => setSearchFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Filter by university" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Universities</SelectItem>
              {universityNames.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({entries.length})</TabsTrigger>
          {CATEGORIES.map((c) => {
            const count = entries.filter((e) => e.category === c.value).length;
            return (
              <TabsTrigger key={c.value} value={c.value}>
                {c.label} ({count})
              </TabsTrigger>
            );
          })}
        </TabsList>

        {["all", ...CATEGORIES.map((c) => c.value)].map((tab) => {
          const filtered = getFilteredEntries(tab);
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40 rounded-lg" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {filtered.map((entry) => {
                    const cat = CATEGORIES.find((c) => c.value === entry.category);
                    const Icon = cat?.icon || FileText;
                    return (
                      <Card key={entry.id}>
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-primary shrink-0" />
                              <CardTitle className="text-sm">{entry.title}</CardTitle>
                            </div>
                            {canManage && (
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEdit(entry)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => deleteMutation.mutate(entry.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </div>
                          <CardDescription className="text-xs capitalize">{entry.category}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                            {entry.content}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="col-span-2 text-center py-12 text-muted-foreground">
                      <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">
                        {searchFilter
                          ? "No entries match your search."
                          : "No knowledge entries in this category yet."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </DashboardLayout>
  );
}
