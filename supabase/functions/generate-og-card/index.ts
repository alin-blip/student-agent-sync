import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { render } from "jsr:@nick/resvg@0.1.0-rc.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function fetchAvatarBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    const ct = resp.headers.get("content-type") || "image/png";
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 = btoa(binary);
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

function buildSvg(params: {
  name: string;
  label: string;
  avatarDataUri: string | null;
  initials: string;
}): string {
  const { name, label, avatarDataUri, initials } = params;
  const W = 1200;
  const H = 630;
  const avatarR = 90;
  const avatarCx = W / 2;
  const avatarCy = 200;

  const avatarSection = avatarDataUri
    ? `<defs>
        <clipPath id="avatarClip">
          <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" />
        </clipPath>
      </defs>
      <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 4}" fill="white" opacity="0.3" />
      <image
        href="${avatarDataUri}"
        x="${avatarCx - avatarR}"
        y="${avatarCy - avatarR}"
        width="${avatarR * 2}"
        height="${avatarR * 2}"
        clip-path="url(#avatarClip)"
        preserveAspectRatio="xMidYMid slice"
      />`
    : `<circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}" fill="rgba(255,255,255,0.15)" />
       <text x="${avatarCx}" y="${avatarCy + 18}" text-anchor="middle"
             font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="bold"
             fill="white">${escapeXml(initials)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
    width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a1a2e" />
        <stop offset="50%" stop-color="#16213e" />
        <stop offset="100%" stop-color="#e67e22" />
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#bg)" />
    ${avatarSection}
    <text x="${avatarCx}" y="${avatarCy + avatarR + 55}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="bold"
          fill="white">${escapeXml(name)}</text>
    <text x="${avatarCx}" y="${avatarCy + avatarR + 100}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="26"
          fill="#f5a623">${escapeXml(label)}</text>
    <text x="${avatarCx}" y="${H - 30}" text-anchor="middle"
          font-family="Arial, Helvetica, sans-serif" font-size="18"
          fill="rgba(255,255,255,0.5)">agents-eduforyou.co.uk</text>
  </svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const refresh = url.searchParams.get("refresh") === "1";

  if (!slug) {
    return new Response("Missing slug", { status: 400, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Check cache first (unless refresh requested)
  const storagePath = `og-cards/${slug}.png`;
  if (!refresh) {
    const { data: listing } = await supabase.storage
      .from("generated-images")
      .list("og-cards", { search: `${slug}.png`, limit: 1 });
    if (listing && listing.length > 0) {
      const { data: pub } = supabase.storage
        .from("generated-images")
        .getPublicUrl(storagePath);
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${pub.publicUrl}?t=${listing[0].updated_at || Date.now()}`,
          "Cache-Control": "public, max-age=3600",
          ...corsHeaders,
        },
      });
    }
  }

  // Fetch profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response("Agent not found", {
      status: 404,
      headers: corsHeaders,
    });
  }

  const name = profile.full_name || "Agent";
  const label = "Agent certificat EduForYou";
  const initials = name
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Fetch avatar as base64
  const avatarDataUri = profile.avatar_url
    ? await fetchAvatarBase64(profile.avatar_url)
    : null;

  // Build SVG
  const svg = buildSvg({ name, label, avatarDataUri, initials });

  // Convert SVG to PNG via resvg
  try {
    const pngData = render(svg, {
      fitTo: { mode: "width", value: 1200 },
    });

    // Upload to storage cache
    await supabase.storage.from("generated-images").upload(
      storagePath,
      pngData,
      {
        contentType: "image/png",
        upsert: true,
      },
    );

    return new Response(pngData, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("resvg render error:", err);
    // Fallback: return SVG directly
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "no-cache",
        ...corsHeaders,
      },
    });
  }
});
