import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Phone, Mail, MessageCircle, Calendar, UserPlus, CheckCircle, FileText,
  ExternalLink, MapPin, Clock, Building2
} from "lucide-react";
import { SiGoogle, SiInstagram, SiYoutube, SiFacebook, SiTiktok } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa";
import { FaStar } from "react-icons/fa";

interface BranchProfile {
  id: string;
  name: string;
  logo_url: string | null;
  contact_email: string;
  contact_phone: string;
  address: string;
  city: string;
  postcode: string;
  description: string;
  website: string;
  slug: string;
}

interface CardSettings {
  whatsapp: string;
  booking_url: string;
  apply_url: string;
  social_google: string;
  social_trustpilot: string;
  social_instagram: string;
  social_youtube: string;
  social_facebook: string;
  social_linkedin: string;
  social_tiktok: string;
}

export default function BranchCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [branch, setBranch] = useState<BranchProfile | null>(null);
  const [settings, setSettings] = useState<CardSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: branchData } = await supabase
        .from("branches")
        .select("id, name, logo_url, contact_email, contact_phone, address, city, postcode, description, website, slug")
        .eq("slug", slug)
        .single();

      if (!branchData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      // For now, branch card settings are directly from branch data. Can be extended later.
      const cardSettings: CardSettings = {
        whatsapp: branchData.contact_phone, // Using contact phone as whatsapp for now
        booking_url: branchData.website, // Using website as booking url for now
        apply_url: `/apply/${branchData.slug}`, // Placeholder for branch-specific apply form
        social_google: "", // Placeholder
        social_trustpilot: "", // Placeholder
        social_instagram: "", // Placeholder
        social_youtube: "", // Placeholder
        social_facebook: "", // Placeholder
        social_linkedin: "", // Placeholder
        social_tiktok: "", // Placeholder
      };

      setBranch(branchData as BranchProfile);
      setSettings(cardSettings);
      setLoading(false);

      document.title = `${branchData.name} | EduForYou UK`;
      const setMeta = (property: string, content: string) => {
        let el = document.querySelector(`meta[property="${property}"]`);
        if (!el) { el = document.createElement("meta"); el.setAttribute("property", property); document.head.appendChild(el); }
        el.setAttribute("content", content);
      };
      setMeta("og:title", document.title);
      setMeta("og:description", branchData.description || "Partner branch helping students achieve their dreams in the UK.");
      setMeta("og:image", branchData.logo_url || "https://agents-eduforyou.co.uk/images/eduforyou-card-preview-v2.png");
      setMeta("og:url", window.location.href);
    })();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (notFound || !branch || !settings) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Branch not found</h1>
          <p className="text-muted-foreground">This branch card may not be published yet.</p>
        </div>
      </div>
    );
  }

  const initials = branch.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const branchPageUrl = `https://partners.eduforyou.co.uk/branch-card/${slug}`;

  const handleVCard = () => {
    const lines = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${branch.name}`,
      branch.contact_email ? `EMAIL:${branch.contact_email}` : "",
      branch.contact_phone ? `TEL;TYPE=CELL:${branch.contact_phone}` : "",
      branch.address ? `ADR;TYPE=WORK:;;${branch.address};${branch.city};;${branch.postcode};UK` : "",
      branch.website ? `URL:${branch.website}` : "",
      branch.description ? `NOTE:${branch.description.replace(/\n/g, "\\n")}` : "",
      "END:VCARD",
    ].filter(Boolean).join("\n");

    const blob = new Blob([lines], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${branch.name.replace(/\s+/g, "_")}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

        {/* Logo/Avatar */}
        <div className="flex justify-center -mt-14">
          <Avatar className="w-28 h-28 border-4 border-card shadow-lg">
            {branch.logo_url ? (
              <AvatarImage src={branch.logo_url} alt={branch.name} />
            ) : null}
            <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name & details */}
        <div className="text-center mt-3 px-6">
          <h1 className="text-xl font-bold text-foreground">{branch.name}</h1>
          {branch.description && (
            <p className="text-sm text-muted-foreground">{branch.description}</p>
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
              Visit Website
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={handleVCard}>
            <UserPlus className="w-4 h-4 mr-2" />
            Add to contacts
          </Button>
        </div>

        {/* Tabs */}
        <div className="px-6 mt-5 pb-6">
          <Tabs defaultValue="contact">
            <TabsList className="w-full">
              <TabsTrigger value="contact" className="flex-1">Contact Info</TabsTrigger>
              <TabsTrigger value="location" className="flex-1">Location</TabsTrigger>
            </TabsList>

            <TabsContent value="contact" className="mt-4 space-y-3">
              {branch.contact_phone && (
                <a href={`tel:${branch.contact_phone}`} className="flex items-center gap-3 text-sm text-foreground hover:text-accent transition-colors">
                  <Phone className="w-4 h-4 text-accent" />
                  {branch.contact_phone}
                </a>
              )}
              {branch.contact_email && (
                <a href={`mailto:${branch.contact_email}`} className="flex items-center gap-3 text-sm text-foreground hover:text-accent transition-colors">
                  <Mail className="w-4 h-4 text-accent" />
                  {branch.contact_email}
                </a>
              )}
            </TabsContent>

            <TabsContent value="location" className="mt-4 space-y-3">
              {branch.address && (
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <MapPin className="w-4 h-4 text-accent" />
                  <span>{branch.address}, {branch.city}, {branch.postcode}</span>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* CTA buttons */}
          <div className="grid grid-cols-2 gap-3 mt-5">
            <Button
              variant="outline"
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground"
              onClick={() => window.open(settings.apply_url, "_blank")}
            >
              <CheckCircle className="w-4 h-4 mr-1" />
              Check Eligibility
            </Button>
            <Button
              className="bg-accent text-accent-foreground hover:bg-accent/90"
              onClick={() => window.open(settings.apply_url, "_blank")}
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
        </div>
      </div>
    </div>
  );
}
