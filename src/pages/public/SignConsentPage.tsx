import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { SignatureCanvas } from "@/components/SignatureCanvas";
import { CONSENT_CLAUSES, MARKETING_OPTIONS, DEFAULT_MARKETING_CHECKS } from "@/lib/consent-clauses";
import { ShieldCheck, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { extractSignatureRgb } from "@/lib/signature-utils";

type TokenStatus = "loading" | "valid" | "expired" | "signed" | "error";

export default function SignConsentPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<TokenStatus>("loading");
  const [studentName, setStudentName] = useState("");

  const [consentChecks, setConsentChecks] = useState<Record<string, boolean>>({});
  const [marketingChecks, setMarketingChecks] = useState<Record<string, boolean>>(DEFAULT_MARKETING_CHECKS);
  const [typedName, setTypedName] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const nonMarketingClauses = CONSENT_CLAUSES.filter((c) => !c.isMarketing);
  const allConsentsChecked = nonMarketingClauses.every((c) => consentChecks[c.id]);
  const canSubmit = allConsentsChecked && typedName.trim().length > 0 && !!signatureDataUrl;

  useEffect(() => {
    if (!token) { setStatus("error"); return; }

    supabase.functions.invoke("validate-consent-token", {
      body: { token },
    }).then(({ data, error }) => {
      if (error || !data) { setStatus("error"); return; }
      if (data.status === "signed") { setStatus("signed"); return; }
      if (data.status === "expired") { setStatus("expired"); return; }
      if (data.status === "valid") {
        setStudentName(data.studentName || "Student");
        setStatus("valid");
        return;
      }
      setStatus("error");
    });
  }, [token]);

  const handleSubmit = async () => {
    if (!canSubmit || !token) return;
    setSubmitting(true);
    setErrorMsg("");

    try {
      let sigRgb: string | null = null;
      let sigW: number | null = null;
      let sigH: number | null = null;

      if (signatureDataUrl) {
        const result = await extractSignatureRgb(signatureDataUrl, 400, 120);
        if (result) {
          sigRgb = result.rgb;
          sigW = result.width;
          sigH = result.height;
        }
      }

      const { data, error } = await supabase.functions.invoke("submit-consent-signature", {
        body: {
          token,
          signature: typedName,
          signatureRgb: sigRgb,
          signatureWidth: sigW,
          signatureHeight: sigH,
          marketingConsent: marketingChecks,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit consent. Please try again.");
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

  if (status === "signed" || submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Consent Form Signed</h2>
            <p className="text-muted-foreground">
              Your consent form has been signed and saved successfully. You may close this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Link Expired</h2>
            <p className="text-muted-foreground">
              This signing link has expired. Please contact your agent for a new link.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="w-16 h-16 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Invalid Link</h2>
            <p className="text-muted-foreground">
              This signing link is invalid. Please check the link and try again.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card>
          <CardHeader className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ShieldCheck className="w-6 h-6 text-accent" />
              <CardTitle className="text-xl">EduForYou — Consent & Authorisation</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Hello <strong>{studentName}</strong>, please review and sign the consent form below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {CONSENT_CLAUSES.map((clause) => (
              <div key={clause.id} className="space-y-1 p-3 rounded-lg border bg-muted/20">
                {clause.isMarketing ? (
                  <div>
                    <p className="text-sm font-semibold">{clause.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mt-1 mb-2">{clause.text}</p>
                    <div className="space-y-2 ml-1">
                      {MARKETING_OPTIONS.map((opt) => (
                        <label key={opt.id} className="flex items-center gap-3 cursor-pointer">
                          <Checkbox
                            checked={!!marketingChecks[opt.id]}
                            disabled={!!opt.required}
                            onCheckedChange={(checked) => {
                              if (opt.required) return;
                              setMarketingChecks((prev) => {
                                const next = { ...prev, [opt.id]: !!checked };
                                if (checked && opt.exclusive) next[opt.exclusive] = false;
                                return next;
                              });
                            }}
                          />
                          <span className="text-xs text-foreground">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : (
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      checked={!!consentChecks[clause.id]}
                      onCheckedChange={(checked) =>
                        setConsentChecks((prev) => ({ ...prev, [clause.id]: !!checked }))
                      }
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-semibold">{clause.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{clause.text}</p>
                      {clause.bullets && (
                        <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-0.5">
                          {clause.bullets.map((b, i) => <li key={i}>{b}</li>)}
                        </ul>
                      )}
                    </div>
                  </label>
                )}
              </div>
            ))}

            <div className="space-y-2 pt-4">
              <Label>Full Name (typed confirmation) *</Label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={`e.g. ${studentName}`}
              />
            </div>

            <div className="space-y-2">
              <Label>Signature (draw below) *</Label>
              <SignatureCanvas onSignatureChange={setSignatureDataUrl} width={400} height={120} />
              <p className="text-xs text-muted-foreground">
                Date: {new Date().toLocaleDateString("en-GB")}
              </p>
            </div>

            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting…
                </>
              ) : (
                "Sign & Submit Consent Form"
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
