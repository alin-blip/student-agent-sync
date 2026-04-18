import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Globe, Copy, ExternalLink, Download, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

export default function CardSettingsSection() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["card-settings", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_card_settings")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const { data: currentSlug } = useQuery({
    queryKey: ["profile-slug", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("slug")
        .eq("id", user!.id)
        .single();
      return data?.slug || "";
    },
    enabled: !!user,
  });

  const [slug, setSlug] = useState("");
  const [slugTaken, setSlugTaken] = useState(false);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [jobTitle, setJobTitle] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [applyUrl, setApplyUrl] = useState("");
  const [bio, setBio] = useState("");
  const [companyName, setCompanyName] = useState("EduForYou UK");
  const [companyDescription, setCompanyDescription] = useState("");
  const [workingHours, setWorkingHours] = useState("Mon-Fri 9:00-17:00");
  const [accreditation, setAccreditation] = useState("");
  const [socialGoogle, setSocialGoogle] = useState("");
  const [socialTrustpilot, setSocialTrustpilot] = useState("");
  const [socialInstagram, setSocialInstagram] = useState("");
  const [socialYoutube, setSocialYoutube] = useState("");
  const [socialFacebook, setSocialFacebook] = useState("");
  const [socialLinkedin, setSocialLinkedin] = useState("");
  const [socialTiktok, setSocialTiktok] = useState("");
  const [aiVoiceEnabled, setAiVoiceEnabled] = useState(false);

  useEffect(() => {
    if (currentSlug) setSlug(currentSlug);
  }, [currentSlug]);

  // Debounced slug availability check
  useEffect(() => {
    if (!slug || slug === currentSlug) {
      setSlugTaken(false);
      return;
    }
    setCheckingSlug(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("slug", slug)
        .neq("id", user!.id)
        .maybeSingle();
      setSlugTaken(!!data);
      setCheckingSlug(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [slug, currentSlug, user]);

  useEffect(() => {
    if (settings) {
      setIsPublic((settings as any).is_public || false);
      setJobTitle((settings as any).job_title || "");
      setWhatsapp((settings as any).whatsapp || "");
      setBookingUrl((settings as any).booking_url || "");
      setApplyUrl((settings as any).apply_url || "");
      setBio((settings as any).bio || "");
      setCompanyName((settings as any).company_name || "EduForYou UK");
      setCompanyDescription((settings as any).company_description || "");
      setWorkingHours((settings as any).working_hours || "Mon-Fri 9:00-17:00");
      setAccreditation((settings as any).accreditation || "");
      setSocialGoogle((settings as any).social_google || "");
      setSocialTrustpilot((settings as any).social_trustpilot || "");
      setSocialInstagram((settings as any).social_instagram || "");
      setSocialYoutube((settings as any).social_youtube || "");
      setSocialFacebook((settings as any).social_facebook || "");
      setSocialLinkedin((settings as any).social_linkedin || "");
      setSocialTiktok((settings as any).social_tiktok || "");
      setAiVoiceEnabled((settings as any).ai_voice_enabled || false);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      // Update slug on profile
      if (slug) {
        // Check slug uniqueness
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("slug", slug)
          .neq("id", user!.id)
          .maybeSingle();
        if (existing) throw new Error("This slug is already taken. Choose another.");

        const { error: slugErr } = await supabase
          .from("profiles")
          .update({ slug } as any)
          .eq("id", user!.id);
        if (slugErr) throw slugErr;
      }

      const payload = {
        user_id: user!.id,
        is_public: isPublic,
        job_title: jobTitle,
        whatsapp,
        booking_url: bookingUrl,
        apply_url: applyUrl,
        bio,
        company_name: companyName,
        company_description: companyDescription,
        working_hours: workingHours,
        accreditation,
        social_google: socialGoogle,
        social_trustpilot: socialTrustpilot,
        social_instagram: socialInstagram,
        social_youtube: socialYoutube,
        social_facebook: socialFacebook,
        social_linkedin: socialLinkedin,
        social_tiktok: socialTiktok,
        ai_voice_enabled: aiVoiceEnabled,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("agent_card_settings")
        .upsert(payload as any, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: async () => {
      toast({ title: "Digital card saved!" });
      qc.invalidateQueries({ queryKey: ["card-settings"] });
      qc.invalidateQueries({ queryKey: ["profile-slug"] });
      // Invalidate cached OG card image so it regenerates with new data
      if (slug) {
        try {
          await supabase.storage.from("generated-images").remove([`og-cards/${slug}.png`]);
        } catch {}
      }
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const BASE_URL = import.meta.env.PROD ? "https://agents-eduforyou.co.uk" : window.location.origin;
  const cardUrl = slug ? `${BASE_URL}/card/${slug}` : "";
  const applyFormUrl = slug ? `${BASE_URL}/apply/${slug}` : "";

  const copyLink = (url: string, label = "Link") => {
    navigator.clipboard.writeText(url);
    toast({ title: `${label} copied!` });
  };

  const cardQrRef = useRef<HTMLCanvasElement>(null);
  const applyQrRef = useRef<HTMLCanvasElement>(null);

  const downloadQr = useCallback((ref: React.RefObject<HTMLCanvasElement>, filename: string) => {
    const canvas = ref.current;
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
  }, []);

  if (isLoading) return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-6 space-y-4">
        <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        <div className="space-y-3 pt-2">
          {[1,2,3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Digital Card Settings
          </CardTitle>
          <CardDescription>
            Create your public landing page that students and partners can visit
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={e => { e.preventDefault(); saveSettings.mutate(); }}>
            {/* Slug + publish */}
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-2">
                <Label>Your card URL slug</Label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">/card/</span>
                  <Input
                    value={slug}
                    onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="john-doe"
                  />
                </div>
                {slugTaken && (
                  <p className="text-xs text-destructive">Acest slug este deja luat. Încearcă altul, de ex. adaugă o terminație.</p>
                )}
                {checkingSlug && (
                  <p className="text-xs text-muted-foreground">Se verifică disponibilitatea…</p>
                )}
              </div>
              <div className="flex items-center gap-2 pb-1">
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                <Label className="text-xs">Published</Label>
              </div>
            </div>

            {cardUrl && isPublic && (
              <div className="space-y-4">
                {/* Card Link */}
                <div>
                  <p className="text-xs font-medium mb-1">🔗 Link card digital</p>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-xs">
                    <span className="truncate flex-1">{cardUrl}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyLink(cardUrl, "Card link")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(cardUrl, "_blank")}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">✅ Funcționează peste tot — social media, email, mesaje. Preview-ul va afișa bannerul oficial EduForYou.</p>
                </div>

                {/* Apply Form Link */}
                <div>
                  <p className="text-xs font-medium mb-1">📋 Link formular aplicare</p>
                  <div className="flex items-center gap-2 p-2 rounded-md bg-muted text-xs">
                    <span className="truncate flex-1">{applyFormUrl}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyLink(applyFormUrl, "Application form link")}>
                      <Copy className="w-3 h-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(applyFormUrl, "_blank")}>
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* QR Codes */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><QrCode className="w-3 h-3" /> Digital Card QR</p>
                    <QRCodeCanvas ref={cardQrRef} value={cardUrl} size={120} className="rounded border p-1" />
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => downloadQr(cardQrRef, `card-qr-${slug}.png`)}>
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1"><QrCode className="w-3 h-3" /> Apply Form QR</p>
                    <QRCodeCanvas ref={applyQrRef} value={applyFormUrl} size={120} className="rounded border p-1" />
                    <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => downloadQr(applyQrRef, `apply-qr-${slug}.png`)}>
                      <Download className="w-3 h-3 mr-1" /> Download
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Personal info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Job Title</Label>
                <Input value={jobTitle} onChange={e => setJobTitle(e.target.value)} placeholder="Education Consultant" />
              </div>
              <div className="space-y-2">
                <Label>Accreditation</Label>
                <Input value={accreditation} onChange={e => setAccreditation(e.target.value)} placeholder="British Council Accredited" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Bio / About</Label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="A short intro about yourself..." rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+447..." />
              </div>
              <div className="space-y-2">
                <Label>Booking URL</Label>
                <Input value={bookingUrl} onChange={e => setBookingUrl(e.target.value)} placeholder="https://calendly.com/..." />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Apply / Eligibility URL</Label>
              <Input value={applyUrl} onChange={e => setApplyUrl(e.target.value)} placeholder="https://forms.google.com/..." />
            </div>

            {/* Company */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Company Info</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Working Hours</Label>
                  <Input value={workingHours} onChange={e => setWorkingHours(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2 mt-3">
                <Label>Company Description</Label>
                <Textarea value={companyDescription} onChange={e => setCompanyDescription(e.target.value)} rows={2} />
              </div>
            </div>

            {/* Social links */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-medium mb-3">Social Links</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Google Reviews</Label>
                  <Input value={socialGoogle} onChange={e => setSocialGoogle(e.target.value)} placeholder="https://g.page/..." />
                </div>
                <div className="space-y-2">
                  <Label>Trustpilot</Label>
                  <Input value={socialTrustpilot} onChange={e => setSocialTrustpilot(e.target.value)} placeholder="https://trustpilot.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={socialInstagram} onChange={e => setSocialInstagram(e.target.value)} placeholder="https://instagram.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>YouTube</Label>
                  <Input value={socialYoutube} onChange={e => setSocialYoutube(e.target.value)} placeholder="https://youtube.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>Facebook</Label>
                  <Input value={socialFacebook} onChange={e => setSocialFacebook(e.target.value)} placeholder="https://facebook.com/..." />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={socialLinkedin} onChange={e => setSocialLinkedin(e.target.value)} placeholder="https://linkedin.com/..." />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>TikTok</Label>
                  <Input value={socialTiktok} onChange={e => setSocialTiktok(e.target.value)} placeholder="https://tiktok.com/..." />
                </div>
              </div>
            </div>

            {/* AI Voice Assistant */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">AI Voice Assistant</h4>
                  <p className="text-xs text-muted-foreground">
                    Enable an AI-powered voice chatbot on your public card that can answer questions about courses, universities, and admissions.
                  </p>
                </div>
                <Switch checked={aiVoiceEnabled} onCheckedChange={setAiVoiceEnabled} />
              </div>
            </div>

            <Button type="submit" disabled={saveSettings.isPending || slugTaken || checkingSlug} className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Save className="w-3 h-3 mr-1" />
              {saveSettings.isPending ? "Saving…" : "Save Card Settings"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
