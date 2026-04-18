import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileText, ClipboardCheck, Users, BookOpen, FolderOpen, Info } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  courseId: string;
  compact?: boolean;
}

const SECTIONS = [
  { key: "entry_requirements", label: "Entry Requirements", icon: ClipboardCheck, color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  { key: "admission_test_info", label: "Admission Test", icon: FileText, color: "text-amber-400 border-amber-400/30 bg-amber-400/10" },
  { key: "interview_info", label: "Interview", icon: Users, color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  { key: "documents_required", label: "Documents Required", icon: FolderOpen, color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  { key: "personal_statement_guidelines", label: "Personal Statement", icon: BookOpen, color: "text-rose-400 border-rose-400/30 bg-rose-400/10" },
  { key: "additional_info", label: "Additional Info", icon: Info, color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
] as const;

function renderBulletList(items: string[], size: "xs" | "sm"): ReactNode {
  const filtered = items.map(i => i.trim()).filter(Boolean);
  if (filtered.length === 0) return null;
  return (
    <ul className={`list-disc list-inside space-y-1.5 text-${size} text-slate-300`}>
      {filtered.map((item, i) => (
        <li key={i}>{boldBeforeColon(item)}</li>
      ))}
    </ul>
  );
}

function boldBeforeColon(line: string): ReactNode {
  const colonIdx = line.indexOf(":");
  if (colonIdx > 0 && colonIdx < 60) {
    return (
      <>
        <span className="font-semibold text-slate-200">{line.slice(0, colonIdx + 1)}</span>
        {line.slice(colonIdx + 1)}
      </>
    );
  }
  return line;
}

function formatDetailText(text: string, size: "xs" | "sm" = "xs"): ReactNode {
  // Step 1: split by newlines first
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const elements: ReactNode[] = [];
  let currentList: ReactNode[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className={`list-disc list-inside space-y-1.5 text-${size} text-slate-300`}>
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  for (const line of lines) {
    // Detect bullet/dash/numbered lines
    const bulletMatch = line.match(/^[-•●]\s*(.*)/);
    const numberedMatch = line.match(/^(\d+)[.)]\s*(.*)/);

    if (bulletMatch) {
      currentList.push(<li key={`li-${elements.length}-${currentList.length}`}>{boldBeforeColon(bulletMatch[1])}</li>);
    } else if (numberedMatch) {
      currentList.push(<li key={`li-${elements.length}-${currentList.length}`}>{boldBeforeColon(numberedMatch[2])}</li>);
    } else {
      // Priority: semicolons → commas → sentence splitting → paragraph
      const semiItems = line.split(/;\s*/);
      const commaItems = line.split(/,\s*/);

      if (semiItems.length >= 2 && semiItems.every(i => i.length > 0)) {
        // Semicolon-separated list
        flushList();
        elements.push(
          <ul key={`ul-${elements.length}`} className={`list-disc list-inside space-y-1.5 text-${size} text-slate-300`}>
            {semiItems.filter(Boolean).map((item, i) => (
              <li key={i}>{boldBeforeColon(item.trim())}</li>
            ))}
          </ul>
        );
      } else if (commaItems.length >= 3 && commaItems.every((i) => i.length < 80)) {
        // Comma-separated list
        flushList();
        elements.push(
          <ul key={`ul-${elements.length}`} className={`list-disc list-inside space-y-1.5 text-${size} text-slate-300`}>
            {commaItems.map((item, i) => (
              <li key={i}>{boldBeforeColon(item.trim())}</li>
            ))}
          </ul>
        );
      } else if (line.length > 150) {
        // Long text — try sentence splitting
        flushList();
        const sentences = line.split(/\.\s+(?=[A-Z])/).map(s => s.trim()).filter(Boolean);
        if (sentences.length >= 2) {
          elements.push(
            <ul key={`ul-${elements.length}`} className={`list-disc list-inside space-y-1.5 text-${size} text-slate-300`}>
              {sentences.map((s, i) => (
                <li key={i}>{boldBeforeColon(s.endsWith('.') ? s : s + '.')}</li>
              ))}
            </ul>
          );
        } else {
          elements.push(
            <p key={`p-${elements.length}`} className={`text-${size} text-slate-300 leading-relaxed`}>
              {boldBeforeColon(line)}
            </p>
          );
        }
      } else {
        // Short line — heading or paragraph
        flushList();
        const endsWithColon = line.endsWith(":");
        elements.push(
          <p
            key={`p-${elements.length}`}
            className={`text-${size} ${endsWithColon ? "font-semibold text-slate-200 mt-2" : "text-slate-300"} leading-relaxed`}
          >
            {boldBeforeColon(line)}
          </p>
        );
      }
    }
  }
  flushList();

  return <div className="space-y-2">{elements}</div>;
}

export function CourseDetailsInfoCard({ courseId, compact = false }: Props) {
  const { data: details } = useQuery({
    queryKey: ["course-details", courseId],
    queryFn: async () => {
      const { data } = await supabase
        .from("course_details")
        .select("*")
        .eq("course_id", courseId)
        .maybeSingle();
      return data;
    },
    enabled: !!courseId,
  });

  if (!details) return null;

  const activeSections = SECTIONS.filter((s) => (details as any)[s.key]);
  if (activeSections.length === 0) return null;

  if (compact) {
    return (
      <div className="space-y-1">
        <Accordion type="single" collapsible className="w-full">
          {activeSections.map(({ key, label, icon: Icon, color }) => (
            <AccordionItem key={key} value={key} className="border-none">
              <AccordionTrigger className="hover:no-underline py-2 px-0 gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${color.split(" ")[0]}`} />
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${color}`}>
                    {label}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-3 pt-0">
                <div className={`pl-4 border-l-2 ${color.split(" ")[1]} ml-1.5`}>
                  {formatDetailText((details as any)[key], "xs")}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    );
  }

  return (
    <Card className="border-accent/30 bg-accent/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Course Requirements</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {activeSections.map(({ key, label, icon: Icon }) => {
            const value = (details as any)[key];
            return (
              <div key={key} className="flex gap-2">
                <Icon className="w-4 h-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  {formatDetailText(value, "sm")}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}