import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Loader2, ExternalLink, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type ExportResult = {
  success: boolean;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  service_account_email?: string;
  admins_count?: number;
  agents_count?: number;
  students_count?: number;
  enrollments_count?: number;
  error?: string;
  details?: string;
};

export function ExportToSheetsButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [open, setOpen] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<ExportResult>(
        "export-to-sheets",
        { body: {} }
      );
      if (error && !data) throw error;
      setResult(data || null);
      setOpen(true);
      if (data?.success) {
        toast.success("Exported to Google Sheet");
      } else {
        toast.error(data?.error || "Export failed");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Export failed");
    } finally {
      setLoading(false);
    }
  };

  const copyEmail = () => {
    if (result?.service_account_email) {
      navigator.clipboard.writeText(result.service_account_email);
      toast.success("Email copied");
    }
  };

  return (
    <>
      <Button
        onClick={handleExport}
        disabled={loading}
        variant="outline"
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {loading ? "Syncing…" : "Sync to Google Sheet"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {result?.success ? "Sync Complete" : "Sync Failed"}
            </DialogTitle>
            <DialogDescription>
              {result?.success
                ? "Data was written to your Google Sheet — one tab per Admin plus a Summary tab."
                : "The service account doesn't have access to your sheet yet."}
            </DialogDescription>
          </DialogHeader>

          {result?.success && (
            <div className="space-y-3">
              <a
                href={result.spreadsheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">Open Google Sheet</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {result.spreadsheet_url}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 rounded bg-muted">
                  <div className="text-xs text-muted-foreground">Admins</div>
                  <div className="font-semibold">{result.admins_count}</div>
                </div>
                <div className="p-2 rounded bg-muted">
                  <div className="text-xs text-muted-foreground">Agents</div>
                  <div className="font-semibold">{result.agents_count}</div>
                </div>
                <div className="p-2 rounded bg-muted">
                  <div className="text-xs text-muted-foreground">Students</div>
                  <div className="font-semibold">{result.students_count}</div>
                </div>
                <div className="p-2 rounded bg-muted">
                  <div className="text-xs text-muted-foreground">Enrollments</div>
                  <div className="font-semibold">
                    {result.enrollments_count}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!result?.success && result?.service_account_email && (
            <div className="space-y-3 text-sm">
              <p>
                Open your sheet, click <strong>Share</strong>, and add this
                email as <strong>Editor</strong>:
              </p>
              <div className="flex items-center gap-2 p-2 rounded border bg-muted">
                <code className="flex-1 text-xs break-all">
                  {result.service_account_email}
                </code>
                <Button size="sm" variant="ghost" onClick={copyEmail}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              {result.spreadsheet_url && (
                <a
                  href={result.spreadsheet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <ExternalLink className="h-3 w-3" /> Open sheet
                </a>
              )}
              {result.details && (
                <p className="text-xs text-muted-foreground">
                  Details: {result.details}
                </p>
              )}
            </div>
          )}

          {!result?.success && !result?.service_account_email && (
            <p className="text-sm text-destructive">
              {result?.error || "Unknown error"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
