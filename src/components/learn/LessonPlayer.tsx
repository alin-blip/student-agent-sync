import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LessonComments } from "./LessonComments";

type Attachment = { name: string; url: string };

export type Lesson = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration: number | null;
  attachments: Attachment[] | null;
};

interface Props {
  lesson: Lesson | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isCompleted: boolean;
}

function getYouTubeEmbed(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

function getLoomEmbed(url: string): string | null {
  const m = url.match(/loom\.com\/(?:share|embed)\/([\w-]+)/);
  return m ? `https://www.loom.com/embed/${m[1]}` : null;
}

export function LessonPlayer({ lesson, open, onOpenChange, isCompleted }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [marking, setMarking] = useState(false);

  const markComplete = async () => {
    if (!user || !lesson || isCompleted) return;
    setMarking(true);
    const { error } = await supabase.from("learn_progress").upsert(
      {
        user_id: user.id,
        lesson_id: lesson.id,
        completed_at: new Date().toISOString(),
        watched_seconds: lesson.video_duration ?? 0,
      },
      { onConflict: "user_id,lesson_id" },
    );
    setMarking(false);
    if (error) {
      toast.error("Could not save progress");
    } else {
      toast.success("Lesson completed!");
      qc.invalidateQueries({ queryKey: ["learn-progress"] });
    }
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !lesson || isCompleted) return;
    const onTime = () => {
      if (v.duration && v.currentTime / v.duration >= 0.9) {
        markComplete();
        v.removeEventListener("timeupdate", onTime);
      }
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, isCompleted]);

  if (!lesson) return null;

  const url = lesson.video_url ?? "";
  const yt = url ? getYouTubeEmbed(url) : null;
  const loom = url ? getLoomEmbed(url) : null;
  const embedUrl = yt || loom;
  const isDirectVideo = url && !embedUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 pr-8">
            {lesson.title}
            {isCompleted && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Completed</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 min-h-0">
          <div className="relative w-full bg-black rounded-lg overflow-hidden" style={{ aspectRatio: "16 / 9", maxHeight: "55vh" }}>
            {embedUrl ? (
              <iframe
                src={embedUrl}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={lesson.title}
              />
            ) : isDirectVideo ? (
              <video ref={videoRef} src={url} controls className="absolute inset-0 w-full h-full" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
                No video uploaded yet
              </div>
            )}
          </div>

          {lesson.description && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">{lesson.description}</div>
          )}

          {lesson.attachments && lesson.attachments.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Resources</h4>
              <div className="flex flex-wrap gap-2">
                {lesson.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-2">
                      <FileText className="h-4 w-4" />
                      {a.name}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </a>
                ))}
              </div>
            </div>
          )}

          {!isCompleted && (
            <Button onClick={markComplete} disabled={marking} className="w-full">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Mark as completed
            </Button>
          )}

          <LessonComments lessonId={lesson.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
