import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, X, Loader2, Plus } from "lucide-react";

type Attachment = { name: string; url: string };

export type LessonEditorLesson = {
  id?: string;
  module_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration: number | null;
  thumbnail_url: string | null;
  attachments: Attachment[] | null;
  sort_order: number;
  is_published: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: LessonEditorLesson | null;
  moduleId: string;
  defaultSortOrder: number;
}

export function LessonEditor({ open, onOpenChange, lesson, moduleId, defaultSortOrder }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [duration, setDuration] = useState<number | "">("");
  const [isPublished, setIsPublished] = useState(true);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  useEffect(() => {
    if (open) {
      setTitle(lesson?.title ?? "");
      setDescription(lesson?.description ?? "");
      setVideoUrl(lesson?.video_url ?? "");
      setDuration(lesson?.video_duration ?? "");
      setIsPublished(lesson?.is_published ?? true);
      setAttachments(lesson?.attachments ?? []);
      setAttachmentName("");
      setAttachmentUrl("");
    }
  }, [open, lesson]);

  const handleVideoUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${moduleId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("learn-videos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      toast.error("Upload failed: " + error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("learn-videos").getPublicUrl(path);
    setVideoUrl(data.publicUrl);
    toast.success("Video uploaded");
    setUploading(false);
  };

  const addAttachment = () => {
    if (!attachmentName.trim() || !attachmentUrl.trim()) return;
    setAttachments([...attachments, { name: attachmentName.trim(), url: attachmentUrl.trim() }]);
    setAttachmentName("");
    setAttachmentUrl("");
  };

  const removeAttachment = (idx: number) => {
    setAttachments(attachments.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      module_id: moduleId,
      title: title.trim(),
      description: description.trim() || null,
      video_url: videoUrl.trim() || null,
      video_duration: duration === "" ? null : Number(duration),
      thumbnail_url: null,
      attachments: attachments as any,
      sort_order: lesson?.sort_order ?? defaultSortOrder,
      is_published: isPublished,
    };

    const { error } = lesson?.id
      ? await supabase.from("learn_lessons").update(payload).eq("id", lesson.id)
      : await supabase.from("learn_lessons").insert(payload);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(lesson?.id ? "Lesson updated" : "Lesson created");
    qc.invalidateQueries({ queryKey: ["learn-modules"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lesson?.id ? "Edit Lesson" : "Add Lesson"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lesson title" />
          </div>

          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="What will agents learn in this lesson?" />
          </div>

          <div>
            <Label>Video</Label>
            <div className="flex gap-2 mt-1">
              <Input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="Paste YouTube/Loom URL or upload below"
              />
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleVideoUpload(e.target.files[0])}
                />
                <Button type="button" variant="outline" disabled={uploading} asChild>
                  <span>
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </span>
                </Button>
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Supports MP4 upload or YouTube/Loom embed URLs</p>
          </div>

          <div>
            <Label>Duration (seconds, optional)</Label>
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="e.g., 240"
            />
          </div>

          <div>
            <Label>Resources / Attachments</Label>
            <div className="flex gap-2 mt-1">
              <Input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="Name" />
              <Input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="URL" />
              <Button type="button" variant="outline" onClick={addAttachment}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {attachments.length > 0 && (
              <div className="space-y-1 mt-2">
                {attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-muted px-2 py-1 rounded">
                    <span className="flex-1 truncate">{a.name} — {a.url}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(i)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="published" />
            <Label htmlFor="published">Published (visible to agents)</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
