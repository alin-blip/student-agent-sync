import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCap } from "lucide-react";

interface MentionTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export function MentionTextarea({ value, onChange, onKeyDown, placeholder, rows, className }: MentionTextareaProps) {
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["mention-students", mentionQuery],
    queryFn: async () => {
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, email")
        .order("first_name")
        .limit(8);
      if (mentionQuery) {
        query = query.or(
          `first_name.ilike.%${mentionQuery}%,last_name.ilike.%${mentionQuery}%,email.ilike.%${mentionQuery}%`
        );
      }
      const { data } = await query;
      return data || [];
    },
    enabled: mentionQuery !== null,
  });

  const getMentionRange = useCallback((): { start: number; query: string } | null => {
    const el = textareaRef.current;
    if (!el) return null;
    const pos = el.selectionStart;
    const textBefore = value.slice(0, pos);
    const atIndex = textBefore.lastIndexOf("@");
    if (atIndex === -1) return null;
    // @ must be at start or preceded by whitespace
    if (atIndex > 0 && !/\s/.test(textBefore[atIndex - 1])) return null;
    const query = textBefore.slice(atIndex + 1);
    // no spaces in query (simple heuristic)
    if (query.includes("\n")) return null;
    return { start: atIndex, query };
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    setCursorPos(e.target.selectionStart);
  };

  useEffect(() => {
    const range = getMentionRange();
    if (range) {
      setMentionQuery(range.query);
      setMentionIndex(0);
      // Position popover above the textarea
      if (containerRef.current) {
        setPopoverPos({ top: -4, left: 0 });
      }
    } else {
      setMentionQuery(null);
    }
  }, [value, cursorPos, getMentionRange]);

  const insertMention = (student: { first_name: string; last_name: string }) => {
    const range = getMentionRange();
    if (!range) return;
    const name = `${student.first_name} ${student.last_name}`;
    const before = value.slice(0, range.start);
    const after = value.slice(textareaRef.current?.selectionStart || range.start + range.query.length + 1);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setMentionQuery(null);
    // Focus back
    setTimeout(() => {
      const newPos = range.start + name.length + 2;
      textareaRef.current?.setSelectionRange(newPos, newPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && students.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((prev) => Math.min(prev + 1, students.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(students[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    onKeyDown?.(e);
  };

  const isOpen = mentionQuery !== null && students.length > 0;

  return (
    <div ref={containerRef} className="relative flex-1">
      {isOpen && (
        <div
          className="absolute bottom-full left-0 mb-1 w-72 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden"
          style={{ maxHeight: 240 }}
        >
          <div className="px-2 py-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider border-b">
            Students
          </div>
          <ScrollArea className="max-h-[200px]">
            {students.map((s: any, i: number) => (
              <button
                key={s.id}
                type="button"
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors ${
                  i === mentionIndex ? "bg-accent/10 text-accent-foreground" : "hover:bg-muted/50"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(s);
                }}
                onMouseEnter={() => setMentionIndex(i)}
              >
                <GraduationCap className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="truncate font-medium">{s.first_name} {s.last_name}</span>
                {s.email && <span className="text-xs text-muted-foreground truncate ml-auto">{s.email}</span>}
              </button>
            ))}
          </ScrollArea>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart)}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />
    </div>
  );
}
