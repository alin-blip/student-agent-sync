import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Download } from "lucide-react";
import { SiFacebook, SiInstagram, SiTiktok, SiWhatsapp } from "react-icons/si";
import { FaLinkedinIn } from "react-icons/fa";
import { toast } from "sonner";

const skipNativeSharePlatforms = ["facebook", "linkedin"];

const platformNames: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

const platformFallbackUrls: Record<string, (text: string, url: string) => string | null> = {
  facebook: (text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
  linkedin: (_text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  whatsapp: (text) => `https://wa.me/?text=${encodeURIComponent(text)}`,
  instagram: () => null,
  tiktok: () => null,
};

const platformIcons = [
  { key: "facebook", Icon: SiFacebook },
  { key: "instagram", Icon: SiInstagram },
  { key: "tiktok", Icon: SiTiktok },
  { key: "linkedin", Icon: FaLinkedinIn },
  { key: "whatsapp", Icon: SiWhatsapp },
];

interface SocialShareButtonsProps {
  imageUrl: string;
  caption?: string;
  cardUrl?: string | null;
  filenamePrefix?: string;
  size?: "sm" | "default";
  onShared?: () => void;
  ogShareUrl?: string | null;
}

export function SocialShareButtons({
  imageUrl,
  caption = "",
  cardUrl,
  filenamePrefix = "eduforyou",
  size = "default",
  onShared,
  ogShareUrl,
}: SocialShareButtonsProps) {
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const btnSize = size === "sm" ? "h-7 w-7" : "h-8 w-8";

  const handleShare = async (platform: string) => {
    const shareText = cardUrl ? `${caption}\n\n🔗 ${cardUrl}` : caption;

    // For Facebook/LinkedIn: open URL synchronously to avoid popup blocking
    if (skipNativeSharePlatforms.includes(platform)) {
      // Use og-share URL for Facebook/LinkedIn so crawlers get proper OG meta tags
      const shareUrlForCrawler = ogShareUrl || cardUrl;
      const fallbackUrl = shareUrlForCrawler
        ? platformFallbackUrls[platform]?.(shareText, shareUrlForCrawler)
        : null;
      if (fallbackUrl) window.open(fallbackUrl, "_blank");

      // Then async: download image + copy caption
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const ext = blob.type.includes("png") ? "png" : "jpg";
        const dlUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = `${filenamePrefix}.${ext}`;
        a.click();
        URL.revokeObjectURL(dlUrl);

        try { if (shareText) await navigator.clipboard.writeText(shareText); } catch {}

        onShared?.();
        const name = platformNames[platform] || platform;
        toast.success(`Image saved & text copied! Post on ${name} and paste the caption.`);
      } catch {
        toast.error("Download failed");
      }
      return;
    }

    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const mimeType = blob.type || "image/jpeg";
      const ext = mimeType.includes("png") ? "png" : "jpg";
      const imageFile = new File([blob], `${filenamePrefix}.${ext}`, { type: mimeType });

      const shareData: ShareData = { files: [imageFile], text: shareText };

      if (navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        onShared?.();
        return;
      }

      // Fallback for other platforms
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${filenamePrefix}.${ext}`;
      a.click();
      URL.revokeObjectURL(dlUrl);

      try { if (shareText) await navigator.clipboard.writeText(shareText); } catch {}

      onShared?.();
      const name = platformNames[platform] || platform;
      toast.success(`Image saved & text copied! Post on ${name} and paste the caption.`);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
      toast.error("Share failed");
    }
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const ext = blob.type.includes("png") ? "png" : "jpg";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filenamePrefix}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      const shareText = cardUrl ? `${caption}\n\n🔗 ${cardUrl}` : caption;
      if (shareText) {
        await navigator.clipboard.writeText(shareText);
        toast.success("Image saved & caption copied!");
      } else {
        toast.success("Image saved!");
      }
      onShared?.();
    } catch {
      toast.error("Download failed");
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex gap-1.5 items-center">
        {platformIcons.map(({ key, Icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <Button size="icon" variant="outline" className={btnSize} onClick={() => handleShare(key)}>
                <Icon className={iconSize} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share on {platformNames[key]}</TooltipContent>
          </Tooltip>
        ))}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="outline" className={btnSize} onClick={handleDownload}>
              <Download className={iconSize} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Download image + copy caption</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
