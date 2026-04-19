import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Skeleton } from "@/components/ui/skeleton";
import * as Icons from "lucide-react";
import {
  CheckCircle2,
  Circle,
  Play,
  Plus,
  Pencil,
  Trash2,
  Rocket,
  GraduationCap,
} from "lucide-react";
import { LessonPlayer, type Lesson } from "@/components/learn/LessonPlayer";
import { LessonEditor, type LessonEditorLesson } from "@/components/learn/LessonEditor";
import { ModuleEditor, type ModuleEditorModule } from "@/components/learn/ModuleEditor";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Attachment = { name: string; url: string };

type LessonRow = {
  id: string;
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

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  is_published: boolean;
  lessons: LessonRow[];
};

function formatDuration(s: number | null) {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function getVideoThumbnail(videoUrl: string | null, thumbnailUrl: string | null): string | null {
  if (thumbnailUrl) return thumbnailUrl;
  if (!videoUrl) return null;
  const yt = videoUrl.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/mqdefault.jpg`;
  const loom = videoUrl.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  if (loom) return `https://cdn.loom.com/sessions/thumbnails/${loom[1]}-with-play.gif`;
  return null;
}

function getIconComponent(name: string | null) {
  if (!name) return Icons.BookOpen;
  const Comp = (Icons as any)[name];
  return Comp || Icons.BookOpen;
}

export default function LearnPage() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canManage = role === "owner" || role === "branch_manager";

  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  const [editingLesson, setEditingLesson] = useState<LessonEditorLesson | null>(null);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [lessonEditorOpen, setLessonEditorOpen] = useState(false);

  const [editingModule, setEditingModule] = useState<ModuleEditorModule | null>(null);
  const [moduleEditorOpen, setModuleEditorOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["learn-modules"],
    queryFn: async () => {
      const { data: mods, error: e1 } = await supabase
        .from("learn_modules")
        .select("*")
        .order("sort_order");
      if (e1) throw e1;
      const { data: lessons, error: e2 } = await supabase
        .from("learn_lessons")
        .select("*")
        .order("sort_order");
      if (e2) throw e2;
      return (mods ?? []).map((m: any) => ({
        ...m,
        lessons: (lessons ?? []).filter((l: any) => l.module_id === m.id),
      })) as ModuleRow[];
    },
  });

  const { data: progress } = useQuery({
    queryKey: ["learn-progress", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("learn_progress")
        .select("lesson_id, completed_at")
        .eq("user_id", user.id);
      return data ?? [];
    },
    enabled: !!user,
  });

  const completedSet = useMemo(
    () => new Set((progress ?? []).filter((p: any) => p.completed_at).map((p: any) => p.lesson_id)),
    [progress],
  );

  const { totalLessons, completedCount, percent } = useMemo(() => {
    const all = (data ?? []).flatMap((m) => m.lessons.filter((l) => l.is_published));
    const total = all.length;
    const done = all.filter((l) => completedSet.has(l.id)).length;
    return {
      totalLessons: total,
      completedCount: done,
      percent: total === 0 ? 0 : Math.round((done / total) * 100),
    };
  }, [data, completedSet]);

  const visibleModules = useMemo(() => {
    return (data ?? []).filter((m) => canManage || m.is_published);
  }, [data, canManage]);

  const openLesson = (l: LessonRow) => {
    setActiveLesson({
      id: l.id,
      title: l.title,
      description: l.description,
      video_url: l.video_url,
      video_duration: l.video_duration,
      attachments: l.attachments,
    });
    setPlayerOpen(true);
  };

  const handleAddLesson = (moduleId: string, count: number) => {
    setEditingModuleId(moduleId);
    setEditingLesson(null);
    setLessonEditorOpen(true);
    // store sort hint via editor's defaultSortOrder
    (handleAddLesson as any)._sort = count;
  };

  const handleEditLesson = (l: LessonRow) => {
    setEditingModuleId(l.module_id);
    setEditingLesson({
      id: l.id,
      module_id: l.module_id,
      title: l.title,
      description: l.description,
      video_url: l.video_url,
      video_duration: l.video_duration,
      thumbnail_url: l.thumbnail_url,
      attachments: l.attachments,
      sort_order: l.sort_order,
      is_published: l.is_published,
    });
    setLessonEditorOpen(true);
  };

  const handleDeleteLesson = async (id: string) => {
    if (!confirm("Delete this lesson?")) return;
    const { error } = await supabase.from("learn_lessons").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Lesson deleted");
      qc.invalidateQueries({ queryKey: ["learn-modules"] });
    }
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Delete this module and all its lessons?")) return;
    const { error } = await supabase.from("learn_modules").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Module deleted");
      qc.invalidateQueries({ queryKey: ["learn-modules"] });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Hero / Progress */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="rounded-xl bg-primary/10 p-2">
                <Rocket className="h-6 w-6 text-primary" />
              </div>
              Start Here — Your Learning Path
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              A structured path from setting up your profile to closing your first client. Watch, learn, take action.
            </p>
            <div className="flex items-center gap-3">
              <Progress value={percent} className="flex-1 h-2" />
              <span className="text-sm font-medium tabular-nums">
                {percent}% · {completedCount}/{totalLessons}
              </span>
            </div>
          </CardContent>
        </Card>

        {canManage && (
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setEditingModule(null);
                setModuleEditorOpen(true);
              }}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Module
            </Button>
          </div>
        )}

        {/* Modules */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : (
          <Accordion type="multiple" defaultValue={visibleModules.map((m) => m.id)} className="space-y-3">
            {visibleModules.map((module) => {
              const Icon = getIconComponent(module.icon);
              const visibleLessons = module.lessons.filter((l) => canManage || l.is_published);
              const moduleDone = visibleLessons.filter((l) => completedSet.has(l.id)).length;
              return (
                <AccordionItem
                  key={module.id}
                  value={module.id}
                  className="border rounded-lg bg-card overflow-hidden"
                >
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold flex items-center gap-2">
                          {module.title}
                          {!module.is_published && <Badge variant="outline" className="text-xs">Draft</Badge>}
                        </div>
                        {module.description && (
                          <p className="text-xs text-muted-foreground font-normal mt-0.5">{module.description}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-2">
                        {moduleDone}/{visibleLessons.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {canManage && (
                      <div className="flex justify-end gap-2 mb-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingModule({
                              id: module.id,
                              title: module.title,
                              description: module.description,
                              icon: module.icon,
                              sort_order: module.sort_order,
                              is_published: module.is_published,
                            });
                            setModuleEditorOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(module.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <div className="space-y-1">
                      {visibleLessons.length === 0 && (
                        <p className="text-sm text-muted-foreground italic py-3 text-center">
                          No lessons yet.
                        </p>
                      )}
                      {visibleLessons.map((lesson) => {
                        const done = completedSet.has(lesson.id);
                        const thumb = getVideoThumbnail(lesson.video_url, lesson.thumbnail_url);
                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors group"
                          >
                            <button
                              onClick={() => openLesson(lesson)}
                              className="flex items-center gap-3 flex-1 text-left min-w-0"
                            >
                              {thumb ? (
                                <div className="relative w-24 h-14 rounded-md overflow-hidden bg-muted shrink-0 border">
                                  <img
                                    src={thumb}
                                    alt={lesson.title}
                                    loading="lazy"
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Play className="h-6 w-6 text-white fill-white" />
                                  </div>
                                  {done && (
                                    <div className="absolute top-1 right-1 bg-background rounded-full">
                                      <CheckCircle2 className="h-4 w-4 text-primary" />
                                    </div>
                                  )}
                                </div>
                              ) : done ? (
                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                              ) : (
                                <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                              )}
                              <span className="flex-1 text-sm truncate">{lesson.title}</span>
                              {!lesson.is_published && (
                                <Badge variant="outline" className="text-xs">Draft</Badge>
                              )}
                              {lesson.video_duration && (
                                <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                                  {formatDuration(lesson.video_duration)}
                                </span>
                              )}
                            </button>
                            {canManage && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditLesson(lesson)}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-destructive"
                                  onClick={() => handleDeleteLesson(lesson.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full mt-2 border border-dashed"
                          onClick={() => handleAddLesson(module.id, module.lessons.length)}
                        >
                          <Plus className="h-4 w-4 mr-2" /> Add Lesson
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      <LessonPlayer
        lesson={activeLesson}
        open={playerOpen}
        onOpenChange={setPlayerOpen}
        isCompleted={activeLesson ? completedSet.has(activeLesson.id) : false}
      />

      {editingModuleId && (
        <LessonEditor
          open={lessonEditorOpen}
          onOpenChange={setLessonEditorOpen}
          lesson={editingLesson}
          moduleId={editingModuleId}
          defaultSortOrder={(handleAddLesson as any)._sort ?? 0}
        />
      )}

      <ModuleEditor
        open={moduleEditorOpen}
        onOpenChange={setModuleEditorOpen}
        module={editingModule}
        defaultSortOrder={(data ?? []).length}
      />
    </DashboardLayout>
  );
}
