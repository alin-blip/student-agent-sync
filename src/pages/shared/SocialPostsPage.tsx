import { useState } from "react";
import { compositeFullBranding } from "@/lib/image-composite";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Send,
  Upload,
  Loader2,
  Image as ImageIcon,
  Trash2,
  Square,
  Smartphone,
  FileText,
  LayoutTemplate,
  Sparkles,
  User,
  MessageSquare,
  Copy,
  Check,
  Download,
  Video,
} from "lucide-react";

const LANGUAGES = [
  { value: "Romanian", label: "🇷🇴 Română" },
  { value: "English", label: "🇬🇧 English" },
  { value: "Arabic", label: "🇸🇦 العربية" },
  { value: "French", label: "🇫🇷 Français" },
  { value: "Spanish", label: "🇪🇸 Español" },
  { value: "Hindi", label: "🇮🇳 हिन्दी" },
];

const PRESETS = [
  { id: "social_post", label: "Social Post", desc: "1080×1080 square", icon: Square },
  { id: "story", label: "Story", desc: "1080×1920 vertical", icon: Smartphone },
  { id: "flyer", label: "Flyer", desc: "A5 portrait", icon: FileText },
  { id: "banner", label: "Banner", desc: "1200×628 horizontal", icon: LayoutTemplate },
];

type GeneratedResult = {
  preset: string;
  url?: string;
  script?: string;
  error?: string;
};

const getGenerationErrorMessage = (errorType?: string, error?: string) => {
  if (errorType === "daily_limit" || error?.includes("Daily limit")) return "Daily limit reached";
  if (errorType === "credits_exhausted") return "AI credits exhausted — please contact admin";
  if (errorType === "rate_limit") return "AI rate limit — please wait a moment and try again";
  return error || "Generation failed. Please try again later.";
};

function CaptionDisplay({ caption }: { caption: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          Generated Caption
        </Label>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="p-3 rounded-md bg-muted text-sm whitespace-pre-wrap border">{caption}</div>
    </div>
  );
}

function ScriptDisplay({ script }: { script: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-1">
          <Video className="w-4 h-4" />
          Teleprompter Script
        </Label>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCopy}>
          {copied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
      <div className="p-4 rounded-lg bg-card border-2 text-base leading-relaxed whitespace-pre-wrap font-medium">
        {script}
      </div>
    </div>
  );
}

export default function SocialPostsPage() {
  const { user, role, profile } = useAuth();
  const qc = useQueryClient();
  const isOwnerOrAdmin = role === "owner" || role === "branch_manager";

  // --- Image source tab ---
  const [imageSource, setImageSource] = useState<"ai" | "upload">("ai");

  // --- AI generation state (multi-select presets) ---
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["social_post"]);
  const [prompt, setPrompt] = useState("");
  const [includePhoto, setIncludePhoto] = useState(false);
  const [generatedResults, setGeneratedResults] = useState<GeneratedResult[]>([]);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState("Romanian");
  const [aiCaption, setAiCaption] = useState<string | null>(null);
  const hasAvatar = !!(profile as any)?.avatar_url;

  // --- Cooldown state ---
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // --- Course context state ---
  const [selectedUniId, setSelectedUniId] = useState<string>("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");

  // --- Manual upload state ---
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // --- Publish state ---
  const [caption, setCaption] = useState("");
  const [targetMode, setTargetMode] = useState<"all" | "team" | "select">("all");
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);

  // Determine which images we have
  const imageResults = generatedResults.filter((r) => r.url);
  const hasImage = imageSource === "ai" ? imageResults.length > 0 : !!imageFile;
  const firstImageUrl = imageResults[0]?.url || null;
  const previewImage = imageSource === "ai" ? firstImageUrl : imagePreview;

  // Toggle preset selection
  const togglePreset = (presetId: string) => {
    setSelectedPresets((prev) =>
      prev.includes(presetId)
        ? prev.filter((p) => p !== presetId)
        : [...prev, presetId]
    );
  };

  // Select all presets
  const selectAllPresets = () => {
    if (selectedPresets.length === PRESETS.length) {
      setSelectedPresets(["social_post"]);
    } else {
      setSelectedPresets(PRESETS.map((p) => p.id));
    }
  };

  // --- Course context queries ---
  const { data: universities = [] } = useQuery({
    queryKey: ["universities-active"],
    queryFn: async () => {
      const { data } = await supabase.from("universities").select("id, name").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-active"],
    queryFn: async () => {
      const { data } = await supabase.from("courses").select("id, name, level, study_mode, university_id").eq("is_active", true).order("name");
      return data || [];
    },
  });

  const filteredCourses = selectedUniId ? courses.filter((c: any) => c.university_id === selectedUniId) : courses;

  // --- Queries ---
  const { data: agents = [] } = useQuery({
    queryKey: ["agents-for-posts", role],
    queryFn: async () => {
      let query = supabase.from("profiles").select("id, full_name, email, admin_id");
      if (role === "branch_manager") {
        query = query.eq("admin_id", user!.id);
      }
      const { data, error } = await query.order("full_name");
      if (error) throw error;
      return (data || []).filter((p: any) => p.id !== user?.id);
    },
    enabled: isOwnerOrAdmin && !!user,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["social-posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  // --- AI Generate (batch for selected presets) ---
  const [generating, setGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState("");

  // Cooldown timer
  const startCooldown = (seconds: number) => {
    const until = Date.now() + seconds * 1000;
    setCooldownUntil(until);
    setCooldownSeconds(seconds);
    const interval = setInterval(() => {
      const left = Math.ceil((until - Date.now()) / 1000);
      if (left <= 0) {
        setCooldownUntil(null);
        setCooldownSeconds(0);
        clearInterval(interval);
      } else {
        setCooldownSeconds(left);
      }
    }, 1000);
  };

  const isCoolingDown = cooldownUntil !== null && Date.now() < cooldownUntil;

  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  const handleGenerateSingle = async (preset: string, session: any): Promise<GeneratedResult> => {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt,
          preset,
          includePhoto,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: captionLanguage,
          ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
        }),
      }
    );
    const result = await resp.json();

    if (result?.ok === false || !resp.ok) {
      const errorMessage = getGenerationErrorMessage(result?.errorType, result?.error);
      if (result?.errorType === "rate_limit") startCooldown(30);
      return { preset, error: errorMessage };
    }

    // Client-side branding composition (logo + profile photo)
    let finalUrl = result.url;
    const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/brand-assets/eduforyou-logo.png`;
    finalUrl = await compositeFullBranding(result.url, logoUrl, result.avatarUrl || null, preset, !!includePhoto);

    if (result.remaining !== undefined) setRemaining(result.remaining);
    return { preset, url: finalUrl };
  };

  const handleGenerate = async () => {
    if (selectedPresets.length === 0) {
      toast.error("Select at least one format");
      return;
    }
    setGenerating(true);
    setGeneratedResults([]);
    setAiCaption(null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Not authenticated");
      setGenerating(false);
      return;
    }

    const results: GeneratedResult[] = [];
    let shouldSkipFollowUpAi = false;

    // Generate images sequentially with stagger delay
    for (let i = 0; i < selectedPresets.length; i++) {
      const preset = selectedPresets[i];
      const presetLabel = PRESETS.find((p) => p.id === preset)?.label || preset;
      setGeneratingProgress(`Generating ${presetLabel}… (${i + 1}/${selectedPresets.length})`);

      if (i > 0) await delay(3000);

      try {
        const result = await handleGenerateSingle(preset, session);
        results.push(result);

        if (result.error) {
          // Check if it's a terminal error that should stop the batch
          const isTerminal = result.error.includes("Daily limit") ||
            result.error.includes("credits exhausted") ||
            result.error.includes("rate limit");
          if (isTerminal) {
            shouldSkipFollowUpAi = true;
            toast.error(result.error);
            break;
          }
        }
      } catch (e: any) {
        results.push({ preset, error: e.message });
      }
    }

    if (!shouldSkipFollowUpAi) {
      // Delay before script generation
      await delay(3000);

      // Generate teleprompter script
      setGeneratingProgress("Generating teleprompter script…");
      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-caption`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              prompt,
              preset: "script",
              language: captionLanguage,
              ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
            }),
          }
        );
        const result = await resp.json();
        if (!resp.ok || result?.ok === false) {
          results.push({ preset: "script", error: getGenerationErrorMessage(result?.errorType, result?.error || "Script generation failed") });
          if (result?.errorType === "rate_limit" || result?.errorType === "credits_exhausted") {
            shouldSkipFollowUpAi = true;
            if (result?.errorType === "rate_limit") startCooldown(30);
          }
        } else {
          results.push({ preset: "script", script: result.caption });
        }
      } catch (e: any) {
        results.push({ preset: "script", error: e.message });
      }

      // Caption generation (skip if script hit rate limit)
      if (!shouldSkipFollowUpAi) {
        await delay(3000);
        setGeneratingProgress("Generating caption…");
        try {
          const resp = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-caption`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                prompt,
                preset: "social_post",
                language: captionLanguage,
                ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
              }),
            }
          );
          const result = await resp.json();
          if (!resp.ok || result?.ok === false) {
            console.error("Caption generation failed:", getGenerationErrorMessage(result?.errorType, result?.error));
            if (result?.errorType === "rate_limit") startCooldown(30);
          } else {
            setAiCaption(result.caption);
            setCaption(result.caption);
          }
        } catch (e: any) {
          console.error("Caption generation error:", e.message);
        }
      }
    }

    setGeneratedResults(results);
    setGeneratingProgress("");
    setGenerating(false);

    const successCount = results.filter((r) => r.url || r.script).length;
    const errorCount = results.filter((r) => r.error).length;
    if (successCount > 0) {
      toast.success(`${successCount} format(s) generated!`);
    } else if (errorCount > 0) {
      toast.error("All generations failed. Please try again in a moment.");
    }
  };

  // Caption is now auto-generated after image generation

  // --- Manual upload ---
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  // --- Publish (publishes each generated image as a separate post with same caption) ---
  const handlePublish = async () => {
    if (!hasImage || !caption.trim()) {
      toast.error("Please add an image and caption");
      return;
    }
    setPublishing(true);
    try {
      // Collect all image URLs to publish
      let imageUrls: string[] = [];

      if (imageSource === "ai") {
        imageUrls = imageResults.map((r) => r.url!);
      } else if (imageFile) {
        const ext = imageFile.name.split(".").pop();
        const filePath = `social-posts/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("generated-images")
          .upload(filePath, imageFile);
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("generated-images")
          .getPublicUrl(filePath);
        imageUrls = [urlData.publicUrl];
      }

      if (imageUrls.length === 0) throw new Error("No image available");

      // Determine recipients
      let recipientIds: string[] = [];
      if (targetMode === "all") {
        recipientIds = agents.map((a: any) => a.id);
      } else if (targetMode === "team") {
        recipientIds = agents.filter((a: any) => a.admin_id === user!.id).map((a: any) => a.id);
      } else {
        recipientIds = selectedAgents;
      }

      // Create a post for each image URL (same caption)
      for (const imageUrl of imageUrls) {
        const { data: post, error: postErr } = await supabase
          .from("social_posts")
          .insert({
            created_by: user!.id,
            image_url: imageUrl,
            caption: caption.trim(),
            target_role: targetMode,
          })
          .select()
          .single();
        if (postErr) throw postErr;

        if (recipientIds.length > 0) {
          const recipientRows = recipientIds.map((agentId) => ({
            post_id: post.id,
            agent_id: agentId,
          }));
          const { error: recErr } = await supabase
            .from("social_post_recipients")
            .insert(recipientRows);
          if (recErr) throw recErr;
        }
      }

      toast.success(`${imageUrls.length} post(s) published to ${recipientIds.length} recipient(s)`);
      // Reset
      setCaption("");
      setImageFile(null);
      setImagePreview(null);
      setGeneratedResults([]);
      setAiCaption(null);
      setPrompt("");
      setSelectedAgents([]);
      setSelectedPresets(["social_post"]);
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from("social_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      qc.invalidateQueries({ queryKey: ["social-posts"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!isOwnerOrAdmin) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">
          You don't have access to create social posts.
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-accent" />
              Social Posts
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and send marketing content to your agents
            </p>
          </div>
          {remaining !== null && (
            <Badge variant="secondary" className="text-sm">
              {remaining}/5 AI images remaining today
            </Badge>
          )}
        </div>

        {/* Step 1: Image Source */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Create Content</CardTitle>
            <CardDescription>Generate with AI or upload manually. Select multiple formats!</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={imageSource} onValueChange={(v) => setImageSource(v as "ai" | "upload")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="ai" className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  AI Generate
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-1.5">
                  <Upload className="w-4 h-4" />
                  Upload
                </TabsTrigger>
              </TabsList>

              {/* AI Tab */}
              <TabsContent value="ai" className="space-y-4 mt-4">
                {/* Course context selectors */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Filter by institution (optional)</Label>
                    <Select value={selectedUniId} onValueChange={(v) => { setSelectedUniId(v === "__clear__" ? "" : v); setSelectedCourseId(""); }}>
                      <SelectTrigger><SelectValue placeholder="All institutions" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__">All institutions</SelectItem>
                        {universities.map((u: any) => (
                          <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Select course (optional — enriches AI context)</Label>
                    <Select value={selectedCourseId} onValueChange={(v) => setSelectedCourseId(v === "__clear__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="No course selected" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__clear__">No course selected</SelectItem>
                        {filteredCourses.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name} ({c.level})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Preset multi-selector */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Select formats (multiple allowed)</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={selectAllPresets}
                    >
                      <Check className="w-3 h-3 mr-1" />
                      {selectedPresets.length === PRESETS.length ? "Deselect all" : "Select all"}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {PRESETS.map((p) => {
                      const isSelected = selectedPresets.includes(p.id);
                      return (
                        <Card
                          key={p.id}
                          className={`cursor-pointer transition-all hover:shadow-md relative ${
                            isSelected
                              ? "ring-2 ring-accent border-accent"
                              : "hover:border-accent/50"
                          }`}
                          onClick={() => togglePreset(p.id)}
                        >
                          <CardContent className="p-3 text-center">
                            {isSelected && (
                              <div className="absolute top-1.5 right-1.5">
                                <Check className="w-3.5 h-3.5 text-accent" />
                              </div>
                            )}
                            <p.icon className={`w-5 h-5 mx-auto mb-1 ${isSelected ? "text-accent" : "text-muted-foreground"}`} />
                            <p className="font-medium text-xs">{p.label}</p>
                            <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                  {selectedPresets.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedPresets.length} formats selected — each image format uses 1 daily credit
                    </p>
                  )}
                </div>

                {/* Prompt */}
                <div className="space-y-2">
                  <Label>What should the content show?</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. A vibrant promotional post about studying in London with scholarship opportunities..."
                    rows={3}
                  />
                </div>

                {/* Options row */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={includePhoto}
                            onCheckedChange={setIncludePhoto}
                            disabled={!hasAvatar}
                          />
                          <Label className="flex items-center gap-1 cursor-pointer text-sm">
                            <User className="w-4 h-4" />
                            Include my photo
                          </Label>
                        </div>
                      </TooltipTrigger>
                      {!hasAvatar && (
                        <TooltipContent>Upload your photo in Profile first</TooltipContent>
                      )}
                    </Tooltip>

                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">Content Language:</Label>
                      <Select value={captionLanguage} onValueChange={setCaptionLanguage}>
                        <SelectTrigger className="w-[140px] h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGES.map((l) => (
                            <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim() || selectedPresets.length === 0 || isCoolingDown}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isCoolingDown ? (
                      <>AI busy — wait {cooldownSeconds}s</>
                    ) : generating ? (
                      <><Loader2 className="w-4 h-4 mr-1 animate-spin" />{generatingProgress || "Generating..."}</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-1" />Generate {selectedPresets.length > 1 ? `(${selectedPresets.length})` : ""}</>
                    )}
                  </Button>
                </div>

                {/* Generated results */}
                {generatedResults.length > 0 && (
                  <div className="space-y-4">
                    <Label className="text-sm font-medium">Generated Content</Label>

                    {/* Image grid */}
                    {imageResults.length > 0 && (
                      <div className={`grid gap-3 ${imageResults.length === 1 ? "grid-cols-1 max-w-lg mx-auto" : "grid-cols-1 md:grid-cols-2"}`}>
                        {imageResults.map((result) => {
                          const presetInfo = PRESETS.find((p) => p.id === result.preset);
                          return (
                            <div key={result.preset} className="relative group rounded-lg overflow-hidden border">
                              <img
                                src={result.url}
                                alt={`Generated ${presetInfo?.label}`}
                                className="w-full rounded-lg"
                              />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                                <Badge variant="secondary" className="text-[10px]">
                                  {presetInfo?.label}
                                </Badge>
                              </div>
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={result.url} download target="_blank" rel="noopener noreferrer">
                                  <Button size="icon" variant="secondary" className="h-7 w-7">
                                    <Download className="w-3 h-3" />
                                  </Button>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Script results */}
                    {generatedResults
                      .filter((r) => r.script)
                      .map((r) => (
                        <ScriptDisplay key="script" script={r.script!} />
                      ))}

                    {/* Error results */}
                    {generatedResults
                      .filter((r) => r.error)
                      .map((r) => (
                        <div key={r.preset} className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                          <span className="font-medium">{PRESETS.find((p) => p.id === r.preset)?.label}:</span>{" "}
                          {r.error}
                        </div>
                      ))}

                    {aiCaption && <CaptionDisplay caption={aiCaption} />}
                  </div>
                )}
              </TabsContent>

              {/* Upload Tab */}
              <TabsContent value="upload" className="space-y-4 mt-4">
                {imagePreview ? (
                  <div className="relative">
                    <img
                      src={imagePreview}
                      alt="Preview"
                      className="w-full max-h-64 object-cover rounded-lg border"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => { setImageFile(null); setImagePreview(null); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <ImageIcon className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Click to upload image</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                  </label>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Step 2: Caption & Publish */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Caption & Publish</CardTitle>
            <CardDescription>
              {hasImage
                ? `${imageResults.length > 1 ? `${imageResults.length} images ready — ` : ""}Same caption will be used for all posts`
                : "Generate or upload an image first"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview thumbnails */}
            {imageSource === "ai" && imageResults.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-2">
                {imageResults.map((r) => (
                  <img
                    key={r.preset}
                    src={r.url}
                    alt={r.preset}
                    className="w-20 h-20 object-cover rounded-lg border shrink-0"
                  />
                ))}
              </div>
            )}
            {imageSource === "upload" && previewImage && (
              <img
                src={previewImage}
                alt="Selected"
                className="w-full max-h-48 object-cover rounded-lg border"
              />
            )}

            {/* Caption */}
            <div className="space-y-2">
              <Label>Caption (with CTA)</Label>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption for your post… (AI captions always include a call-to-action)"
                rows={3}
              />
            </div>

            {/* Target selector */}
            <div className="space-y-2">
              <Label>Send to</Label>
              <Select value={targetMode} onValueChange={(v: any) => setTargetMode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {role === "branch_manager" && <SelectItem value="team">My team</SelectItem>}
                  <SelectItem value="select">Select individually</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {targetMode === "select" && (
              <ScrollArea className="max-h-48 border rounded-lg p-3">
                <div className="space-y-2">
                  {agents.map((agent: any) => (
                    <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedAgents.includes(agent.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAgents(checked
                            ? [...selectedAgents, agent.id]
                            : selectedAgents.filter((id) => id !== agent.id)
                          );
                        }}
                      />
                      <span className="text-sm">{agent.full_name}</span>
                      <span className="text-xs text-muted-foreground">{agent.email}</span>
                    </label>
                  ))}
                  {agents.length === 0 && (
                    <p className="text-sm text-muted-foreground">No agents found</p>
                  )}
                </div>
              </ScrollArea>
            )}

            <Button
              onClick={handlePublish}
              disabled={publishing || !hasImage || !caption.trim()}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {publishing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {publishing
                ? "Publishing…"
                : `Publish ${imageResults.length > 1 ? `${imageResults.length} Posts` : "Post"}`}
            </Button>
          </CardContent>
        </Card>

        {/* Published Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Published Posts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No posts yet</p>
            ) : (
              <div className="space-y-3">
                {posts.map((post: any) => (
                  <div key={post.id} className="flex gap-4 p-3 rounded-lg border">
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-24 h-24 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm whitespace-pre-wrap line-clamp-3">{post.caption}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(post.created_at), "dd MMM yyyy HH:mm")}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {post.target_role === "all" ? "All agents" : post.target_role}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(post.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
