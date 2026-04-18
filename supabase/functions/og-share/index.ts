import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_DOMAIN = "https://agents-eduforyou.co.uk";
const STATIC_OG_IMAGE = `${APP_DOMAIN}/images/eduforyou-card-preview-v2.png`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");
  const postId = url.searchParams.get("post");

  if (!slug) {
    return new Response("Missing slug", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, slug")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!profile) {
    return new Response("Agent not found", { status: 404 });
  }

  const { data: card } = await supabase
    .from("agent_card_settings")
    .select("job_title, bio, company_name")
    .eq("user_id", profile.id)
    .eq("is_public", true)
    .single();

  // Default: use the static branded image for card shares
  let ogImage = STATIC_OG_IMAGE;
  let ogImageWidth = "1640";
  let ogImageHeight = "624";
  let ogImageType = "image/png";

  let ogDescription = card?.bio || "Education consultant helping you reach your goals in the UK.";
  let ogTitle = `${profile.full_name || "Agent"}${card?.job_title ? ` – ${card.job_title}` : ""} | EduForYou UK`;

  // If a post ID is provided, use post image + caption instead
  if (postId) {
    const { data: post } = await supabase
      .from("social_posts")
      .select("image_url, caption")
      .eq("id", postId)
      .single();

    if (post) {
      if (post.image_url) {
        ogImage = post.image_url;
        ogImageWidth = "1080";
        ogImageHeight = "1080";
        ogImageType = "image/jpeg";
      }
      ogDescription = post.caption || ogDescription;
    }
  }

  const cardPageUrl = `${APP_DOMAIN}/card/${slug}`;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(ogTitle)}</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${esc(ogTitle)}" />
  <meta property="og:description" content="${esc(ogDescription.slice(0, 300))}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:secure_url" content="${esc(ogImage)}" />
  <meta property="og:image:type" content="${ogImageType}" />
  <meta property="og:image:width" content="${ogImageWidth}" />
  <meta property="og:image:height" content="${ogImageHeight}" />
  <meta property="og:image:alt" content="${esc(ogTitle)}" />
  <meta property="og:url" content="${esc(cardPageUrl)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(ogTitle)}" />
  <meta name="twitter:description" content="${esc(ogDescription.slice(0, 200))}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <meta http-equiv="refresh" content="0;url=${esc(cardPageUrl)}" />
</head>
<body>
  <p>Redirecting to <a href="${esc(cardPageUrl)}">${esc(profile.full_name || "agent card")}</a>…</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      ...corsHeaders,
    },
  });
});
