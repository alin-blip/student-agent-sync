import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    fetch(`${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`, {
      headers: { apikey: anonKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.valid === false && data.reason === "already_unsubscribed") setStatus("already");
        else if (data.valid) setStatus("valid");
        else setStatus("invalid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  const handleUnsubscribe = async () => {
    setSubmitting(true);
    try {
      const { data } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      setStatus(data?.success ? "success" : "error");
    } catch { setStatus("error"); }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <MailX className="w-10 h-10 mx-auto text-accent mb-2" />
          <CardTitle className="text-xl">Email Preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />}
          {status === "valid" && (
            <>
              <p className="text-muted-foreground">Click below to unsubscribe from email notifications.</p>
              <Button onClick={handleUnsubscribe} disabled={submitting} className="bg-accent text-accent-foreground hover:bg-accent/90">
                {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : "Confirm Unsubscribe"}
              </Button>
            </>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <p className="font-medium">You've been unsubscribed successfully.</p>
            </div>
          )}
          {status === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="w-8 h-8 text-muted-foreground" />
              <p className="text-muted-foreground">You're already unsubscribed.</p>
            </div>
          )}
          {status === "invalid" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="w-8 h-8 text-destructive" />
              <p className="text-muted-foreground">This unsubscribe link is invalid or expired.</p>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2">
              <XCircle className="w-8 h-8 text-destructive" />
              <p className="text-muted-foreground">Something went wrong. Please try again later.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
