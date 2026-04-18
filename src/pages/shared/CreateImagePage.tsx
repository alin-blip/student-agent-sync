import { useState } from "react";
import { compositeFullBranding } from "@/lib/image-composite";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SocialShareButtons } from "@/components/SocialShareButtons";
import {
  Image as ImageIcon,
  Square,
  Smartphone,
  FileText,
  LayoutTemplate,
  Loader2,
  Sparkles,
  User,
  Copy,
  Check,
  Pencil,
  Download,
} from "lucide-react";
import { format } from "date-fns";

const LANGUAGES = [
  { value: "Romanian", label: "🇷🇴 Română" },
  { value: "English", label: "🇬🇧 English" },
  { value: "Arabic", label: "🇸🇦 العربية" },
  { value: "French", label: "🇫🇷 Français" },
  { value: "Spanish", label: "🇪🇸 Español" },
  { value: "Hindi", label: "🇮🇳 हिन्दी" },
];

const PRESETS = [
  { id: "social_post", label: "Social Post", desc: "1080×1080", icon: Square },
  { id: "story", label: "Story", desc: "1080×1920", icon: Smartphone },
  { id: "flyer", label: "Flyer", desc: "A5", icon: FileText },
  { id: "banner", label: "Banner", desc: "1200×628", icon: LayoutTemplate },
];

const PROGRESS_STEPS = [
  "✍️ Writing marketing copy...",
  "🎨 Generating image...",
  "🖼️ Applying branding...",
];

const getGenerationErrorMessage = (errorType?: string, error?: string) => {
  if (errorType === "daily_limit" || error?.includes("Daily limit")) return "Daily limit reached";
  if (errorType === "credits_exhausted") return "AI credits exhausted — please contact admin";
  if (errorType === "rate_limit") return "AI is busy right now. Retrying automatically...";
  return error || "Generation failed. Please try again later.";
};

export default function CreateImagePage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Settings
  const [selectedPreset, setSelectedPreset] = useState("social_post");
  const [prompt, setPrompt] = useState("");
  const [includePhoto, setIncludePhoto] = useState(false);
  const [captionLanguage, setCaptionLanguage] = useState("Romanian");
  const [selectedUniId, setSelectedUniId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);

  // Result
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  const [generatedText, setGeneratedText] = useState<{ headline: string; subheadline: string; bullets: string[] } | null>(null);
  const [saved, setSaved] = useState(false);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editInstruction, setEditInstruction] = useState("");

  // Cooldown
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Copied state
  const [copiedCaption, setCopiedCaption] = useState(false);

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
  const hasAvatar = !!(profile as any)?.avatar_url;

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

  const { data: cardSettings } = useQuery({
    queryKey: ["my-card-settings", user?.id],
    queryFn: async () => {
      const { data: card } = await supabase.from("agent_card_settings").select("is_public").eq("user_id", user!.id).maybeSingle();
      const { data: prof } = await supabase.from("profiles").select("slug").eq("id", user!.id).single();
      return { is_public: card?.is_public || false, slug: prof?.slug || null };
    },
    enabled: !!user,
  });

  const hasCard = cardSettings?.is_public && cardSettings?.slug;
  const cardUrl = hasCard ? `${window.location.origin}/card/${cardSettings.slug}` : null;

  const { data: gallery = [], isLoading: galleryLoading } = useQuery({
    queryKey: ["my-generated-images"],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_images" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("generated-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    setProgressStep(0);
    setSaved(false);
    setIsEditMode(false);
    setEditInstruction("");

    const progressInterval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 8000);

    const attemptGeneration = async (retryCount = 0): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              preset: selectedPreset,
              includePhoto,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: captionLanguage,
              ...(selectedCourseId ? { courseId: selectedCourseId } : {}),
            }),
          }
        );

        const result = await resp.json();
        if (!resp.ok || result?.ok === false) {
          const errorType = result?.errorType;
          if (errorType === "rate_limit" && retryCount < 2) {
            const retryAfter = result?.retryAfter || 15;
            startCooldown(retryAfter);
            toast({ title: "⏳ AI is busy", description: `Retrying automatically in ${retryAfter}s...` });
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            return attemptGeneration(retryCount + 1);
          }
          throw new Error(getGenerationErrorMessage(errorType, result?.error));
        }

        // Client-side branding
        setProgressStep(2);
        const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/brand-assets/eduforyou-logo.png`;
        const finalUrl = await compositeFullBranding(result.url, logoUrl, result.avatarUrl || null, selectedPreset, !!includePhoto);

        setResultImageUrl(finalUrl);
        setRawImageUrl(result.url);
        setGeneratedText(result.generatedText || null);
        if (result.remaining !== undefined) setRemaining(result.remaining);
        qc.invalidateQueries({ queryKey: ["my-generated-images"] });
      } catch (e: any) {
        toast({ title: "❌ Error", description: e.message, variant: "destructive" });
      }
    };

    try {
      await attemptGeneration();
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgressStep(0);
    }
  };

  const handleModify = async () => {
    if (!editInstruction.trim() || !rawImageUrl || isGenerating) return;

    setIsGenerating(true);
    setProgressStep(1); // skip copy step for edits
    setSaved(false);

    const progressInterval = setInterval(() => {
      setProgressStep((prev) => Math.min(prev + 1, PROGRESS_STEPS.length - 1));
    }, 8000);

    const attemptEdit = async (retryCount = 0): Promise<void> => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-image`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              preset: selectedPreset,
              includePhoto,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              language: captionLanguage,
              previousImageUrl: rawImageUrl,
              editInstruction: editInstruction.trim(),
            }),
          }
        );

        const result = await resp.json();
        if (!resp.ok || result?.ok === false) {
          const errorType = result?.errorType;
          if (errorType === "rate_limit" && retryCount < 2) {
            const retryAfter = result?.retryAfter || 15;
            startCooldown(retryAfter);
            toast({ title: "⏳ AI is busy", description: `Retrying in ${retryAfter}s...` });
            await new Promise((r) => setTimeout(r, retryAfter * 1000));
            return attemptEdit(retryCount + 1);
          }
          throw new Error(getGenerationErrorMessage(errorType, result?.error));
        }

        setProgressStep(2);
        const logoUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/brand-assets/eduforyou-logo.png`;
        const finalUrl = await compositeFullBranding(result.url, logoUrl, result.avatarUrl || null, selectedPreset, !!includePhoto);

        setResultImageUrl(finalUrl);
        setRawImageUrl(result.url);
        setGeneratedText(result.generatedText || null);
        if (result.remaining !== undefined) setRemaining(result.remaining);
        setEditInstruction("");
        setIsEditMode(false);
        qc.invalidateQueries({ queryKey: ["my-generated-images"] });
      } catch (e: any) {
        toast({ title: "❌ Error", description: e.message, variant: "destructive" });
      }
    };

    try {
      await attemptEdit();
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
      setProgressStep(0);
    }
  };

  const handleSave = () => {
    setSaved(true);
    toast({ title: "✅ Image saved!", description: "You can find it in your gallery below." });
  };

  const handleCopyCaption = async () => {
    if (!generatedText) return;
    const text = `${generatedText.headline}\n${generatedText.subheadline}${generatedText.bullets.length > 0 ? "\n" + generatedText.bullets.map(b => `• ${b}`).join("\n") : ""}`;
    await navigator.clipboard.writeText(text);
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-accent" />
              AI Image Studio
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create branded marketing images with AI
            </p>
          </div>
          {remaining !== null && (
            <Badge variant="secondary" className="text-sm">
              {remaining}/5 remaining
            </Badge>
          )}
        </div>

        {/* Settings Card */}
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Preset selector */}
            <div>
              <Label className="text-sm mb-2 block">Format</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-sm ${
                      selectedPreset === p.id
                        ? "ring-2 ring-accent border-accent bg-accent/5"
                        : "hover:border-accent/50"
                    }`}
                    onClick={() => setSelectedPreset(p.id)}
                  >
                    <p.icon className={`w-4 h-4 flex-shrink-0 ${selectedPreset === p.id ? "text-accent" : "text-muted-foreground"}`} />
                    <div>
                      <p className="font-medium text-xs">{p.label}</p>
                      <p className="text-[10px] text-muted-foreground">{p.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Course context */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Institution (optional)</Label>
                <Select value={selectedUniId} onValueChange={(v) => { setSelectedUniId(v === "__clear__" ? "" : v); setSelectedCourseId(""); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">All institutions</SelectItem>
                    {universities.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Course (optional)</Label>
                <Select value={selectedCourseId} onValueChange={(v) => setSelectedCourseId(v === "__clear__" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="No course" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__clear__">No course</SelectItem>
                    {filteredCourses.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name} ({c.level})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Options row */}
            <div className="flex items-center gap-4 flex-wrap">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    <Switch checked={includePhoto} onCheckedChange={setIncludePhoto} disabled={!hasAvatar} />
                    <Label className="flex items-center gap-1 cursor-pointer text-sm">
                      <User className="w-3.5 h-3.5" />
                      Include my photo
                    </Label>
                  </div>
                </TooltipTrigger>
                {!hasAvatar && (
                  <TooltipContent>Upload your photo in Profile first</TooltipContent>
                )}
              </Tooltip>

              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Language:</Label>
                <Select value={captionLanguage} onValueChange={setCaptionLanguage}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
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
          </CardContent>
        </Card>

        {/* Prompt + Generate */}
        <Card>
          <CardContent className="pt-4 space-y-3">
            <Label className="text-sm">Describe your image</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder='e.g. "A post about studying Business in London with autumn vibes"'
              rows={3}
              disabled={isGenerating}
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim() || isCoolingDown}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
            >
              {isCoolingDown ? (
                <span>Retrying in {cooldownSeconds}s...</span>
              ) : isGenerating ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {PROGRESS_STEPS[progressStep]}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Generate Image
                </span>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Result Card */}
        {resultImageUrl && (
          <Card>
            <CardContent className="pt-4 space-y-4">
              <img
                src={resultImageUrl}
                alt="Generated"
                className="rounded-lg w-full max-w-lg mx-auto shadow-md"
              />

              {/* Generated text */}
              {generatedText && (
                <div className="p-3 rounded-md bg-muted text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-muted-foreground text-xs">Generated text:</span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={handleCopyCaption}>
                      {copiedCaption ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copiedCaption ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="font-semibold">{generatedText.headline}</p>
                  <p>{generatedText.subheadline}</p>
                  {generatedText.bullets.length > 0 && (
                    <ul className="list-disc pl-4">
                      {generatedText.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2">
                {!saved && (
                  <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    <Check className="w-4 h-4 mr-1" /> Save
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  <Pencil className="w-4 h-4 mr-1" /> Modify
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = resultImageUrl;
                    a.download = `eduforyou-${selectedPreset}-${Date.now()}.png`;
                    a.click();
                  }}
                >
                  <Download className="w-4 h-4 mr-1" /> Download
                </Button>
              </div>

              {/* Share buttons */}
              {saved && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Share:</p>
                  <SocialShareButtons
                    imageUrl={resultImageUrl}
                    caption=""
                    cardUrl={cardUrl}
                    filenamePrefix="eduforyou-generated"
                    size="sm"
                  />
                </div>
              )}

              {/* Edit instruction */}
              {isEditMode && (
                <div className="flex gap-2">
                  <Input
                    value={editInstruction}
                    onChange={(e) => setEditInstruction(e.target.value)}
                    placeholder="e.g. 'make the background darker', 'change text color to white'"
                    disabled={isGenerating}
                    className="flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter") handleModify(); }}
                  />
                  <Button
                    onClick={handleModify}
                    disabled={isGenerating || !editInstruction.trim()}
                    className="bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Gallery */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              My Gallery
            </CardTitle>
            <CardDescription>Previously generated images</CardDescription>
          </CardHeader>
          <CardContent>
            {galleryLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : gallery.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No images generated yet. Create one above!
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gallery.map((img: any) => (
                  <div key={img.id} className="rounded-lg overflow-hidden border">
                    <div className="relative group">
                      <img
                        src={getPublicUrl(img.image_path)}
                        alt={img.prompt}
                        className="w-full aspect-square object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-white text-xs line-clamp-2">{img.prompt}</p>
                        <div className="flex items-center justify-between mt-1">
                          <Badge variant="secondary" className="text-[10px]">{img.preset}</Badge>
                          <span className="text-[10px] text-white/70">{format(new Date(img.created_at), "dd MMM")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2 flex justify-center">
                      <SocialShareButtons
                        imageUrl={getPublicUrl(img.image_path)}
                        caption=""
                        cardUrl={cardUrl}
                        filenamePrefix={`eduforyou-${img.id.slice(0, 8)}`}
                        size="sm"
                      />
                    </div>
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
