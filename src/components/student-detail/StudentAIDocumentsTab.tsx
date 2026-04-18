import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, Loader2, ScrollText, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { CVQuestionnaireDialog, type CVQuestionnaireData } from "./CVQuestionnaireDialog";

interface Props {
  studentId: string;
  studentName: string;
}

export function StudentAIDocumentsTab({ studentId, studentName }: Props) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState<"cv" | "personal_statement" | null>(null);
  const [cvContent, setCvContent] = useState<string | null>(null);
  const [psContent, setPsContent] = useState<string | null>(null);
  const [psAiScore, setPsAiScore] = useState<number | null>(null);
  const [useGuidelines, setUseGuidelines] = useState(true);
  const [cvDialogOpen, setCvDialogOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const generateCV = async (questionnaire: CVQuestionnaireData) => {
    setGenerating("cv");
    try {
      const { data, error } = await supabase.functions.invoke("generate-student-document", {
        body: { student_id: studentId, document_type: "cv", cv_questionnaire: questionnaire },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setCvContent(data.content);
      setCvDialogOpen(false);
      toast({ title: "CV generated successfully" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const generatePS = async () => {
    setGenerating("personal_statement");
    try {
      const { data, error } = await supabase.functions.invoke("generate-student-document", {
        body: { student_id: studentId, document_type: "personal_statement", use_guidelines: useGuidelines },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPsContent(data.content);
      setPsAiScore(data.ai_score ?? null);
      toast({ title: "Personal Statement generated successfully" });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const handlePrint = (content: string, title: string) => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title} - ${studentName}</title>
      <style>
        body { font-family: Georgia, 'Times New Roman', serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #222; line-height: 1.6; }
        h1 { font-size: 1.6em; border-bottom: 2px solid #333; padding-bottom: 8px; }
        h2 { font-size: 1.2em; margin-top: 1.5em; color: #444; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        h3 { font-size: 1em; margin-top: 1em; }
        ul { padding-left: 20px; }
        p { margin: 0.5em 0; }
        @media print { body { margin: 0; } }
      </style></head><body>`);

    const html = content
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>")
      .replace(/^\- (.*$)/gm, "<li>$1</li>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n\n/g, "</p><p>")
      .replace(/<\/li>\n<li>/g, "</li><li>");

    const withUl = html.replace(/(<li>.*?<\/li>)+/gs, (match) => `<ul>${match}</ul>`);

    win.document.write(`<p>${withUl}</p></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  const AiScoreBadge = ({ score }: { score: number }) => {
    if (score < 15) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700 gap-1">
          <ShieldCheck className="w-3.5 h-3.5" /> AI Score: {score}% ✓
        </Badge>
      );
    }
    if (score <= 25) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700 gap-1">
          <ShieldAlert className="w-3.5 h-3.5" /> AI Score: {score}% ⚠
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700 gap-1">
        <ShieldX className="w-3.5 h-3.5" /> AI Score: {score}% ✗
      </Badge>
    );
  };

  return (
    <div className="space-y-4 pt-4" ref={printRef}>
      <p className="text-sm text-muted-foreground">
        Generate AI-powered documents based on this student's profile and enrollment data.
      </p>

      {/* CV Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" /> Curriculum Vitae (CV)
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setCvDialogOpen(true)} disabled={generating !== null}>
              {generating === "cv" ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Generating…</> : cvContent ? "Regenerate" : "Generate"}
            </Button>
            {cvContent && (
              <Button size="sm" variant="outline" onClick={() => handlePrint(cvContent, "Curriculum Vitae")}>
                <Download className="w-3.5 h-3.5 mr-1" /> PDF
              </Button>
            )}
          </div>
        </CardHeader>
        {cvContent && (
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-4 bg-muted/30 max-h-[500px] overflow-y-auto">
              <ReactMarkdown>{cvContent}</ReactMarkdown>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Personal Statement Card */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Switch id="use-guidelines" checked={useGuidelines} onCheckedChange={setUseGuidelines} />
          <Label htmlFor="use-guidelines" className="text-sm cursor-pointer">Use course-specific guidelines</Label>
        </div>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ScrollText className="w-4 h-4" /> Personal Statement
              {psAiScore !== null && psAiScore !== undefined && <AiScoreBadge score={psAiScore} />}
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={generatePS} disabled={generating !== null}>
                {generating === "personal_statement" ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Generating…</> : psContent ? "Regenerate" : "Generate"}
              </Button>
              {psContent && (
                <Button size="sm" variant="outline" onClick={() => handlePrint(psContent, "Personal Statement")}>
                  <Download className="w-3.5 h-3.5 mr-1" /> PDF
                </Button>
              )}
            </div>
          </CardHeader>
          {psContent && (
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert border rounded-md p-4 bg-muted/30 max-h-[500px] overflow-y-auto">
                <ReactMarkdown>{psContent}</ReactMarkdown>
              </div>
            </CardContent>
          )}
        </Card>
      </div>

      {/* CV Questionnaire Dialog */}
      <CVQuestionnaireDialog
        open={cvDialogOpen}
        onOpenChange={setCvDialogOpen}
        onSubmit={generateCV}
        generating={generating === "cv"}
      />
    </div>
  );
}
