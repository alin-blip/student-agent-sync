import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  const url = new URL(req.url);
  const branchId = url.searchParams.get("branch");

  if (!branchId) {
    return new Response("// Branch ID is required", {
      headers: { "Content-Type": "application/javascript" },
      status: 400,
    });
  }

  const script = `
    (function() {
      const branchId = "${branchId}";
      const iframe = document.createElement('iframe');
      iframe.src = 'https://partners.eduforyou.co.uk/widget/' + branchId;
      iframe.style.width = '100%';
      iframe.style.height = '400px';
      iframe.style.border = 'none';
      iframe.style.position = 'fixed';
      iframe.style.bottom = '0';
      iframe.style.right = '0';
      iframe.style.zIndex = '9999';
      document.body.appendChild(iframe);
    })();
  `;

  // Basic minification (can be improved with a proper minifier if needed)
  const minifiedScript = script.replace(/\s\s+/g, ' ').replace(/\n/g, '');

  return new Response(minifiedScript, {
    headers: { "Content-Type": "application/javascript" },
  });
});
