import { render } from "jsr:@nick/resvg@0.1.0-rc.1";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const PRESET_DIMENSIONS: Record<string, { width: number; height: number }> = {
  social_post: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  flyer: { width: 1240, height: 1754 },
  banner: { width: 1200, height: 628 },
};

function getPresetDimensions(preset: string) {
  return PRESET_DIMENSIONS[preset] || PRESET_DIMENSIONS.social_post;
}

export async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${base64Encode(bytes.buffer)}`;
  } catch {
    return null;
  }
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64Data = dataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  return Uint8Array.from(atob(base64Data), (char) => char.charCodeAt(0));
}

export function compositeExactProfilePhoto(params: {
  avatarDataUrl: string;
  imageDataUrl: string;
  preset: string;
}): Uint8Array {
  const { avatarDataUrl, imageDataUrl, preset } = params;
  const { width, height } = getPresetDimensions(preset);
  const photoSize = Math.max(150, Math.min(220, Math.round(Math.min(width, height) * 0.18)));
  const paddingX = Math.round(width * 0.04);
  const paddingY = Math.round(height * 0.05);
  const photoX = paddingX;
  const photoY = height - photoSize - paddingY;
  const radius = Math.round(photoSize / 2);
  const centerX = photoX + radius;
  const centerY = photoY + radius;
  const borderWidth = Math.max(6, Math.round(photoSize * 0.035));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <clipPath id="agent-photo-clip">
        <circle cx="${centerX}" cy="${centerY}" r="${radius}" />
      </clipPath>
      <filter id="agent-photo-shadow" x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000000" flood-opacity="0.28" />
      </filter>
      <linearGradient id="agent-photo-ring" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f2c14d" />
        <stop offset="100%" stop-color="#c7921a" />
      </linearGradient>
    </defs>

    <image href="${imageDataUrl}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />

    <g filter="url(#agent-photo-shadow)">
      <circle cx="${centerX}" cy="${centerY}" r="${radius + borderWidth}" fill="#ffffff" fill-opacity="0.92" />
      <image
        href="${avatarDataUrl}"
        x="${photoX}"
        y="${photoY}"
        width="${photoSize}"
        height="${photoSize}"
        clip-path="url(#agent-photo-clip)"
        preserveAspectRatio="xMidYMid slice"
      />
      <circle cx="${centerX}" cy="${centerY}" r="${radius + Math.round(borderWidth / 2)}" fill="none" stroke="url(#agent-photo-ring)" stroke-width="${borderWidth}" />
    </g>
  </svg>`;

  return render(svg);
}