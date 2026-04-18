import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Upload, FileText, Trash2, ShieldCheck } from "lucide-react";

type TokenStatus = "loading" | "valid" | "expired" | "submitted" | "error";

interface PendingFile {
  file: File;
  docType: string;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function UploadDocumentsPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<TokenStatus>("loading");
  const [studentName, setStudentName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [docTypes, setDocTypes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!token) { setStatus("error"); return; }
    supabase.functions.invoke("validate-document-token", { body: { token } }).then(({ data, error }) => {
      if (error || !data) { setStatus("error"); return; }
      if (data.status === "submitted") { setStatus("submitted"); return; }
      if (data.status === "expired") { setStatus("expired"); return; }
      if (data.status === "valid") {
        setStudentName(data.studentName || "Student");
        setAgentName(data.agentName || "EduForYou UK");
        setDocTypes(data.requestedDocTypes || []);
        setMessage(data.message || null);
        setStatus("valid");
        return;
      }
      setStatus("error");
    });
  }, [token]);

  const handleAddFile = (docType: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPending((prev) => [...prev, ...files.map((file) => ({ file, docType }))]);
    e.target.value = "";
  };

  const handleRemove = (idx: number) => {
    setPending((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!token || pending.length === 0) return;
    setSubmitting(true);
    setErrorMsg("");
    try {
      const filesPayload = await Promise.all(
        pending.map(async (p) => ({
          name: p.file.name,
          type: p.file.type,
          docType: p.docType,
          base64: await fileToBase64(p.file),
        }))
      );

      const { data, error } = await supabase.functions.invoke("submit-student-documents", {
        body: { token, files: filesPayload },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setDone(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Upload failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "error" || status === "expired" || status === "submitted") {
    const titles = {
      error: "Invalid Link",
      expired: "Link Expired",
      submitted: "Documents Already Submitted",
    } as const;
    const descs = {
      error: "This upload link is invalid. Please contact your agent for a new one.",
      expired: "This upload link has expired. Please request a new one from your agent.",
      submitted: "You've already uploaded your documents using this link. Thank you!",
    } as const;
    const Icon = status === "submitted" ? CheckCircle2 : XCircle;
    const colorClass = status === "submitted" ? "text-accent" : "text-destructive";

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Icon className={`w-16 h-16 mx-auto ${colorClass}`} />
            <h1 className="text-2xl font-bold">{titles[status]}</h1>
            <p className="text-muted-foreground">{descs[status]}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-accent" />
            <h1 className="text-2xl font-bold">Documents Uploaded!</h1>
            <p className="text-muted-foreground">
              Thank you, <strong>{studentName}</strong>. Your documents have been securely sent to <strong>{agentName}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Brand header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-primary">🎓 EduForYou UK</h1>
          <p className="text-sm text-muted-foreground">Secure Document Upload</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-accent" />
              Hello, {studentName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your agent <strong className="text-foreground">{agentName}</strong> has requested the following documents.
              Please upload them securely below — they will go directly into your application file.
            </p>
            {message && (
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30">
                <p className="text-xs font-semibold text-accent mb-1">Message from your agent:</p>
                <p className="text-sm">{message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Required Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {docTypes.map((dt) => {
              const filesForType = pending.filter((p) => p.docType === dt);
              return (
                <div key={dt} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary shrink-0" />
                      <p className="text-sm font-medium truncate">{dt}</p>
                      {filesForType.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent shrink-0">
                          {filesForType.length} file{filesForType.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => fileInputs.current[dt]?.click()}
                      disabled={submitting}
                    >
                      <Upload className="w-3 h-3 mr-1" /> Add
                    </Button>
                    <input
                      ref={(el) => { fileInputs.current[dt] = el; }}
                      type="file"
                      className="hidden"
                      multiple
                      accept="image/*,application/pdf,.doc,.docx"
                      onChange={handleAddFile(dt)}
                    />
                  </div>
                  {filesForType.length > 0 && (
                    <div className="space-y-1 pl-6">
                      {filesForType.map((p) => {
                        const idx = pending.indexOf(p);
                        return (
                          <div key={idx} className="flex items-center justify-between text-xs gap-2">
                            <span className="truncate">{p.file.name} <span className="text-muted-foreground">({(p.file.size / 1024).toFixed(0)} KB)</span></span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => handleRemove(idx)} disabled={submitting}>
                              <Trash2 className="w-3 h-3 text-destructive" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={pending.length === 0 || submitting}
            >
              {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              {submitting ? "Uploading…" : `Submit ${pending.length} file${pending.length !== 1 ? "s" : ""}`}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              🔒 Files are uploaded securely and only visible to your agent and our team.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
