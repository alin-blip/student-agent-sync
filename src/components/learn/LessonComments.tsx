import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ImagePlus, Send, Smile, Reply, Trash2, X, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const REACTION_EMOJIS = ["👍", "❤️", "🎉", "🙌", "🔥"] as const;
const QUICK_REPLIES = ["Great!", "So powerful!", "Amazing!", "Thank you!"] as const;
const PICKER_EMOJIS = [
  "😀","😂","😍","🤔","😎","😢","😡","👏",
  "🙏","💪","🚀","✨","💯","✅","❓","❤️",
  "🔥","🎉","👍","👎","🙌","🤝","💡","📚",
];

type CommentRow = {
  id: string;
  lesson_id: string;
  user_id: string;
  parent_comment_id: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
};

type ReactionRow = {
  id: string;
  comment_id: string;
  user_id: string;
  emoji: string;
};

type Profile = { id: string; full_name: string; avatar_url: string | null };
type RoleRow = { user_id: string; role: string };

interface Props {
  lessonId: string;
}

export function LessonComments({ lessonId }: Props) {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  const canDeleteAny = role === "owner" || role === "admin";

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["lesson-comments", lessonId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learn_lesson_comments")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  const commentIds = useMemo(() => comments.map((c) => c.id), [comments]);
  const userIds = useMemo(() => Array.from(new Set(comments.map((c) => c.user_id))), [comments]);

  const { data: reactions = [] } = useQuery({
    queryKey: ["lesson-comment-reactions", lessonId, commentIds.length],
    enabled: commentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("learn_comment_reactions")
        .select("*")
        .in("comment_id", commentIds);
      if (error) throw error;
      return data as ReactionRow[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["lesson-comment-profiles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["lesson-comment-roles", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles" as any)
        .select("user_id, role")
        .in("user_id", userIds);
      if (error) return [] as RoleRow[];
      return ((data ?? []) as unknown) as RoleRow[];
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, Profile>();
    profiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [profiles]);

  const roleMap = useMemo(() => {
    const m = new Map<string, string>();
    roles.forEach((r) => m.set(r.user_id, r.role));
    return m;
  }, [roles]);

  // Realtime subscription
  useEffect(() => {
    const ch = supabase
      .channel(`lesson-comments-${lessonId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "learn_lesson_comments", filter: `lesson_id=eq.${lessonId}` }, () => {
        qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "learn_comment_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["lesson-comment-reactions", lessonId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [lessonId, qc]);

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = useMemo(() => {
    const m = new Map<string, CommentRow[]>();
    comments.filter((c) => c.parent_comment_id).forEach((c) => {
      const arr = m.get(c.parent_comment_id!) ?? [];
      arr.push(c);
      m.set(c.parent_comment_id!, arr);
    });
    return m;
  }, [comments]);

  const reactionsByComment = useMemo(() => {
    const m = new Map<string, ReactionRow[]>();
    reactions.forEach((r) => {
      const arr = m.get(r.comment_id) ?? [];
      arr.push(r);
      m.set(r.comment_id, arr);
    });
    return m;
  }, [reactions]);

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase.from("learn_lesson_comments").delete().eq("id", commentId);
    if (error) toast.error("Could not delete comment");
    else {
      toast.success("Comment deleted");
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
    }
  };

  const toggleReaction = async (commentId: string, emoji: string) => {
    if (!user) return;
    const existing = reactions.find((r) => r.comment_id === commentId && r.user_id === user.id && r.emoji === emoji);
    if (existing) {
      await supabase.from("learn_comment_reactions").delete().eq("id", existing.id);
    } else {
      await supabase.from("learn_comment_reactions").insert({ comment_id: commentId, user_id: user.id, emoji });
    }
    qc.invalidateQueries({ queryKey: ["lesson-comment-reactions", lessonId] });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <h4 className="text-sm font-semibold flex items-center gap-2">
        Discussion
        <Badge variant="secondary">{comments.length}</Badge>
      </h4>

      <CommentComposer lessonId={lessonId} parentId={null} />

      {isLoading ? (
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No comments yet. Be the first to start the conversation!</p>
      ) : (
        <div className="space-y-4">
          {topLevel.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              replies={repliesByParent.get(c.id) ?? []}
              reactions={reactionsByComment.get(c.id) ?? []}
              repliesReactions={reactionsByComment}
              profileMap={profileMap}
              roleMap={roleMap}
              currentUserId={user?.id}
              canDeleteAny={canDeleteAny}
              lessonId={lessonId}
              onDelete={handleDelete}
              onToggleReaction={toggleReaction}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CommentItem({
  comment, replies, reactions, repliesReactions, profileMap, roleMap, currentUserId, canDeleteAny, lessonId, onDelete, onToggleReaction,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  reactions: ReactionRow[];
  repliesReactions: Map<string, ReactionRow[]>;
  profileMap: Map<string, Profile>;
  roleMap: Map<string, string>;
  currentUserId: string | undefined;
  canDeleteAny: boolean;
  lessonId: string;
  onDelete: (id: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const profile = profileMap.get(comment.user_id);
  const userRole = roleMap.get(comment.user_id);
  const canDelete = canDeleteAny || comment.user_id === currentUserId;

  const reactionCounts = REACTION_EMOJIS.map((e) => ({
    emoji: e,
    count: reactions.filter((r) => r.emoji === e).length,
    mine: reactions.some((r) => r.emoji === e && r.user_id === currentUserId),
  }));

  return (
    <div className="space-y-2">
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback>{(profile?.full_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold">{profile?.full_name ?? "Unknown"}</span>
            {userRole && (
              <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{userRole}</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap mt-0.5">{comment.content}</p>
          {comment.image_url && (
            <a href={comment.image_url} target="_blank" rel="noopener noreferrer">
              <img src={comment.image_url} alt="Attachment" className="mt-2 max-h-64 rounded border" />
            </a>
          )}
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {reactionCounts.map(({ emoji, count, mine }) => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(comment.id, emoji)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${mine ? "bg-primary/10 border-primary" : "border-border hover:bg-muted"}`}
              >
                {emoji} {count > 0 && <span className="ml-1">{count}</span>}
              </button>
            ))}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setReplying((v) => !v)}>
              <Reply className="h-3 w-3 mr-1" /> Reply
            </Button>
            {canDelete && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(comment.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
          {replying && (
            <div className="mt-2">
              <CommentComposer lessonId={lessonId} parentId={comment.id} onDone={() => setReplying(false)} compact />
            </div>
          )}
        </div>
      </div>

      {replies.length > 0 && (
        <div className="ml-11 space-y-3 border-l pl-3">
          {replies.map((r) => {
            const rProfile = profileMap.get(r.user_id);
            const rRole = roleMap.get(r.user_id);
            const rReactions = repliesReactions.get(r.id) ?? [];
            const rCanDelete = canDeleteAny || r.user_id === currentUserId;
            const rCounts = REACTION_EMOJIS.map((e) => ({
              emoji: e,
              count: rReactions.filter((x) => x.emoji === e).length,
              mine: rReactions.some((x) => x.emoji === e && x.user_id === currentUserId),
            }));
            return (
              <div key={r.id} className="flex gap-2">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={rProfile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs">{(rProfile?.full_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold">{rProfile?.full_name ?? "Unknown"}</span>
                    {rRole && <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">{rRole}</Badge>}
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap mt-0.5">{r.content}</p>
                  {r.image_url && (
                    <a href={r.image_url} target="_blank" rel="noopener noreferrer">
                      <img src={r.image_url} alt="Attachment" className="mt-1 max-h-48 rounded border" />
                    </a>
                  )}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    {rCounts.map(({ emoji, count, mine }) => (
                      <button
                        key={emoji}
                        onClick={() => onToggleReaction(r.id, emoji)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${mine ? "bg-primary/10 border-primary" : "border-border hover:bg-muted"}`}
                      >
                        {emoji} {count > 0 && <span className="ml-1">{count}</span>}
                      </button>
                    ))}
                    {rCanDelete && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CommentComposer({ lessonId, parentId, onDone, compact }: { lessonId: string; parentId: string | null; onDone?: () => void; compact?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(f);
    setImagePreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!user) return;
    if (!text.trim() && !imageFile) {
      toast.error("Add a message or image");
      return;
    }
    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `lesson-comments/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("brand-assets").upload(path, imageFile, { contentType: imageFile.type });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
        image_url = pub.publicUrl;
      }
      const { error } = await supabase.from("learn_lesson_comments").insert({
        lesson_id: lessonId,
        user_id: user.id,
        parent_comment_id: parentId,
        content: text.trim(),
        image_url,
      });
      if (error) throw error;
      setText("");
      setImageFile(null);
      setImagePreview(null);
      qc.invalidateQueries({ queryKey: ["lesson-comments", lessonId] });
      onDone?.();
    } catch (e: any) {
      toast.error(e.message || "Could not post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={parentId ? "Write a reply..." : "Share your thoughts or ask a question..."}
        className={compact ? "min-h-[60px]" : "min-h-[70px]"}
      />

      {imagePreview && (
        <div className="relative inline-block">
          <img src={imagePreview} alt="Preview" className="max-h-32 rounded border" />
          <button
            onClick={() => { setImageFile(null); setImagePreview(null); }}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {!compact && (
        <div className="flex flex-wrap gap-1">
          {QUICK_REPLIES.map((q) => (
            <button
              key={q}
              onClick={() => setText((t) => (t ? `${t} ${q}` : q))}
              className="text-xs px-2 py-1 rounded-full bg-muted hover:bg-muted/70 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {showEmoji && (
        <div className="grid grid-cols-8 gap-1 p-2 border rounded-md bg-card">
          {PICKER_EMOJIS.map((e) => (
            <button key={e} onClick={() => setText((t) => t + e)} className="text-lg hover:bg-muted rounded p-1">
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowEmoji((v) => !v)}>
            <Smile className="h-4 w-4" />
          </Button>
        </div>
        <Button onClick={submit} disabled={submitting} size="sm">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
          {parentId ? "Reply" : "Post"}
        </Button>
      </div>
    </div>
  );
}
