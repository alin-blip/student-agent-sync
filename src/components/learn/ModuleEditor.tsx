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
import { Loader2 } from "lucide-react";

export type ModuleEditorModule = {
  id?: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  module: ModuleEditorModule | null;
  defaultSortOrder: number;
}

export function ModuleEditor({ open, onOpenChange, module, defaultSortOrder }: Props) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("BookOpen");
  const [isPublished, setIsPublished] = useState(true);

  useEffect(() => {
    if (open) {
      setTitle(module?.title ?? "");
      setDescription(module?.description ?? "");
      setIcon(module?.icon ?? "BookOpen");
      setIsPublished(module?.is_published ?? true);
    }
  }, [open, module]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      icon: icon.trim() || "BookOpen",
      sort_order: module?.sort_order ?? defaultSortOrder,
      is_published: isPublished,
    };
    const { error } = module?.id
      ? await supabase.from("learn_modules").update(payload).eq("id", module.id)
      : await supabase.from("learn_modules").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(module?.id ? "Module updated" : "Module created");
    qc.invalidateQueries({ queryKey: ["learn-modules"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{module?.id ? "Edit Module" : "Add Module"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div>
            <Label>Icon name (lucide-react)</Label>
            <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="e.g. Rocket, BookOpen, Megaphone, Flame" />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={isPublished} onCheckedChange={setIsPublished} id="m-published" />
            <Label htmlFor="m-published">Published</Label>
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
