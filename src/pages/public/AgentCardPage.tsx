import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone, Mail, MessageCircle, Calendar, UserPlus, CheckCircle, FileText,
  ExternalLink, MapPin, Clock
} from "lucide-react";
import { SiGoogle, SiInstagram, SiYoutube, SiFacebook, SiTiktok } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa";
import { FaStar } from "react-icons/fa";

interface AgentProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface CardSettings {
  job_title: string;
  whatsapp: string;
  booking_url: string;
  apply_url: string;
  bio: string;
  company_name: string;
  company_description: string;
  working_hours: string;
  accreditation: string;
  social_google: string;
  social_trustpilot: string;
  social_instagram: string;
  social_youtube: string;
  social_facebook: string;
  social_linkedin: string;
  social_tiktok: string;
  ai_voice_enabled: boolean;
}

export default function AgentCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [settings, setSettings] = useState<CardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      // Fetch profile by slug using the public view (no email/phone exposed)
      const { data: prof } = await supabase
        .from("public_agent_profiles")
        .select("id, full_name, avatar_url, slug")
        .eq("slug", slug)
        .single() as { data: { id: string; full_name: string; avatar_url: string | null; slug: string } | null; error: any };

      if (!prof) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // Fetch card settings
      const { data: card } = await supabase
        .from("agent_card_settings")
        .select("*")
        .eq("user_id", prof.id)
        .eq("is_public", true)
        .single();

      if (!card) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(prof as AgentProfile);
      setSettings(card as unknown as CardSettings);
      setLoading(false);

      // Inject dynamic OG meta for platforms with partial JS execution (Telegram, iMessage)
      document.title = `${prof.full_name}${(card as any)?.job_title ? ` – ${(card as any).job_title}` : ""} | EduForYou UK`;
      const setMeta = (property: string, content: string) => {
        let el = document.querySelector(`meta[property="${property}"]`);
        if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
        el.setAttribute("content", content);
      };
      setMeta("og:title", document.title);
      setMeta("og:description", (card as any)?.bio || "Education consultant helping you reach your goals in the UK.");
      // Always use the static branded preview image for consistent social sharing
      setMeta("og:image", "https://agents-eduforyou.co.uk/images/eduforyou-card-preview-v2.png");
      setMeta("og:url", window.location.href);
    })();
  }, [slug]);

  // Load ElevenLabs widget script when AI voice is enabled
  useEffect(() => {
    if (!settings?.ai_voice_enabled) return;
    const scriptId = "elevenlabs-convai-script";
    if (document.getElementById(scriptId)) return;
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://elevenlabs.io/convai-widget/index.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [settings?.ai_voice_enabled]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !profile || !settings) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Agent not found</h1>
          <p className="text-muted-foreground">This card may not be published yet.</p>
        </div>
      </div>
    );
  }

  const initials = profile.full_name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const cardPageUrl = `https://agents-eduforyou.co.uk/card/${slug}`;

  const handleVCard = () => {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${profile.full_name}`,
      settings.job_title ? `TITLE:${settings.job_title}` : "",
      settings.company_name ? `ORG:${settings.company_name}` : "",
      settings.whatsapp ? `TEL;TYPE=CELL:${settings.whatsapp}` : "",
      profile.avatar_url ? `PHOTO;VALUE=URI:${profile.avatar_url}` : "",
      `URL:${cardPageUrl}`,
      settings.bio ? `NOTE:${settings.bio.replace(/\n/g, "\\n")}` : "",
      settings.social_instagram ? `X-SOCIALPROFILE;TYPE=instagram:${settings.social_instagram}` : "",
      settings.social_facebook ? `X-SOCIALPROFILE;TYPE=facebook:${settings.social_facebook}` : "",
      settings.social_linkedin ? `X-SOCIALPROFILE;TYPE=linkedin:${settings.social_linkedin}` : "",
      settings.social_youtube ? `X-SOCIALPROFILE;TYPE=youtube:${settings.social_youtube}` : "",
      settings.social_tiktok ? `X-SOCIALPROFILE;TYPE=tiktok:${settings.social_tiktok}` : "",
      settings.social_google ? `X-SOCIALPROFILE;TYPE=google:${settings.social_google}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");

    const blob = new Blob([lines], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${profile.full_name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const whatsappUrl = settings.whatsapp
    ? `https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, "")}`
    : null;

  const socialLinks = [
    { url: settings.social_google, icon: SiGoogle, label: "Google" },
    { url: settings.social_trustpilot, icon: FaStar, label: "Trustpilot" },
    { url: settings.social_instagram, icon: SiInstagram, label: "Instagram" },
    { url: settings.social_youtube, icon: SiYoutube, label: "YouTube" },
    { url: settings.social_facebook, icon: SiFacebook, label: "Facebook" },
    { url: settings.social_linkedin, icon: FaLinkedinIn, label: "LinkedIn" },
    { url: settings.social_tiktok, icon: SiTiktok, label: "TikTok" },
  ].filter(s => s.url);

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden">
        {/* Header gradient */}
        <div className="h-24 bg-gradient-to-r from-primary to-accent relative" />

        {/* Avatar */}
        <div className="flex justify-center -mt-14">
          <Avatar className="w-28 h-28 border-4 border-card shadow-lg">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
            ) : null}
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name & title */}
        <div className="text-center mt-3 px-6">
          <h1 className="text-xl font-bold text-foreground">{profile.full_name}</h1>
          {settings.job_title && (
            <p className="text-sm text-muted-foreground">{settings.job_title}</p>
          )}
          {settings.accreditation && (
            <p className="text-xs text-accent font-medium mt-1">{settings.accreditation}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 mt-4 space-y-2">
          {settings.booking_url && (
            <Button
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => window.open(settings.booking_url, "_blank")}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book a Free Consultation
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={handleVCard}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add to contacts
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-5 pb-6">
          <Tabs defaultValue="personal">
            <TabsList className="w-full">
              <TabsTrigger value="personal" className="flex-1">Personal info</TabsTrigger>
              <TabsTrigger value="company" className="flex-1">Company</TabsTrigger>
            </TabsList>

            <TabsContent value="personal" className="mt-4 space-y-3">
              {settings.whatsapp && (
                <a href={`tel:${settings.whatsapp}`} className="flex items-center gap-3 text-sm text-foreground hover:text-accent transition-colors">
                  <Phone className="w-4 h-4 text-accent" />
                  {settings.whatsapp}
                </a>
              )}
              {whatsappUrl && (
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-foreground hover:text-accent transition-colors">
                  <MessageCircle className="w-4 h-4 text-accent" />
                  WhatsApp
                </a>
              )}
              {settings.bio && (
                <p className="text-sm text-muted-foreground pt-2 border-t">{settings.bio}</p>
              )}
            </TabsContent>

            <TabsContent value="company" className="mt-4 space-y-3">
              {settings.company_name && (
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <ExternalLink className="w-4 h-4 text-accent" />
                  <span className="font-medium">{settings.company_name}</span>
                </div>
              )}
              {settings.working_hours && (
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Clock className="w-4 h-4 text-accent" />
                  {settings.working_hours}
                </div>
              )}
              {settings.company_description && (
                <p className="text-sm text-muted-foreground pt-2 border-t">
                  {settings.company_description}
                </p>
              )}
            </TabsContent>
          </Tabs>

          {/* CTA buttons */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <Button
              variant="outline"
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              onClick={() => window.open(`/apply/${slug}`, "_blank")}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Check Eligibility
            </Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => window.open(`/apply/${slug}`, "_blank")}
            >
              <FileText className="w-4 h-4 mr-1" />
              Apply Now
            </Button>
          </div>

          {/* Social links */}
          {socialLinks.length > 0 && (
            <div className="flex justify-center gap-4 mt-5 pt-4 border-t">
              {socialLinks.map(({ url, icon: Icon, label }) => (
                <a
                  key={label}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-accent transition-colors"
                  title={label}
                >
                  <Icon className="w-5 h-5" />
                </a>
              ))}
            </div>
          )}

          {/* ElevenLabs AI Voice Widget */}
          {settings.ai_voice_enabled && (
            <div
              dangerouslySetInnerHTML={{
                __html: '<elevenlabs-convai agent-id="agent_4501kmytq1bnekgs59jh6rzjwxw4"></elevenlabs-convai>',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
