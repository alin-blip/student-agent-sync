import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

type Line = { text: string; x: number; y: number; size?: number; bold?: boolean };

interface PageContent {
  lines: Line[];
  sigImg?: { rgb: Uint8Array; width: number; height: number; rect: { x: number; y: number; w: number; h: number } };
}

const CLAUSES = [
  {
    title: "1. ROLE AND PURPOSE",
    text: "The Student seeks guidance regarding higher education opportunities and Student Finance in the UK. EduForYou acts as an independent education consultancy providing guidance, application support, and administrative assistance.",
  },
  {
    title: "2. STUDENT RESPONSIBILITIES",
    text: "The Student agrees to:",
    bullets: [
      "Provide accurate, complete, and truthful information",
      "Submit genuine and authentic documents only",
      "Attend interviews, tests, and required appointments",
      "Review and confirm all application details before submission",
      "Accept full responsibility for any incorrect or misleading information",
    ],
  },
  {
    title: "3. EDUFORYOU RESPONSIBILITIES",
    text: "EduForYou agrees to:",
    bullets: [
      "Provide accurate and up-to-date information",
      "Assist with university and Student Finance applications",
      "Maintain confidentiality in accordance with UK GDPR",
      "Act in a professional and ethical manner",
    ],
  },
  {
    title: "4. AUTHORISATION",
    text: "The Student authorises EduForYou to submit applications on their behalf and communicate with universities, colleges, and Student Finance England.",
  },
  {
    title: "5. DATA PROTECTION (UK GDPR)",
    text: "All personal data will be processed in accordance with UK GDPR. Data will only be shared with relevant institutions involved in the application process.",
  },
  {
    title: "6. NO GUARANTEE CLAUSE",
    text: "EduForYou does not guarantee university admission, visa approval, or Student Finance approval. Outcomes depend on eligibility and third-party decisions.",
  },
  {
    title: "7. COMMISSION DISCLOSURE",
    text: "EduForYou may receive a commission or referral fee from partner institutions. This does not affect the impartiality of the advice provided to the Student.",
  },
  {
    title: "8. LIMITATION OF LIABILITY",
    text: "EduForYou is not liable for decisions made by universities or Student Finance, delays outside its control, or consequences of incorrect information provided by the student.",
  },
  {
    title: "9. DOCUMENT AUTHENTICITY & LIABILITY",
    text: "EduForYou does not verify the authenticity of documents provided. The Student is fully responsible for the legality and accuracy of all documents submitted.",
  },
  {
    title: "10. WITHDRAWAL & TERMINATION",
    text: "The Student may withdraw at any time. EduForYou is not responsible for any outcomes resulting from withdrawal or incomplete applications.",
  },
  {
    title: "11. CONFIDENTIALITY",
    text: "All information shared will remain confidential and used solely for application purposes.",
  },
];

interface MarketingConsent {
  contact_consent?: boolean;
  data_sharing_consent?: boolean;
  marketing_yes?: boolean;
  marketing_no?: boolean;
}

function buildPages(
  studentName: string, agentName: string, consentDate: string,
  signature: string | null, marketingConsent: MarketingConsent | null,
): PageContent[] {
  const pages: PageContent[] = [];
  let lines: Line[] = [];
  let y = 790;
  const lm = 50;
  const lh = 13;
  const sg = 16;
  const maxW = 90;
  const PAGE_BOTTOM = 60;

  function checkPage(needed: number) {
    if (y - needed < PAGE_BOTTOM) {
      pages.push({ lines });
      lines = [];
      y = 790;
    }
  }

  // Header
  lines.push({ text: "EduForYou", x: lm, y, size: 18, bold: true }); y -= 22;
  lines.push({ text: "CONSENT & AUTHORISATION AGREEMENT", x: lm, y, size: 13, bold: true }); y -= 16;
  lines.push({ text: "Education made simple, tailored to your needs", x: lm, y, size: 9 }); y -= 6;
  lines.push({ text: "_______________________________________________________________", x: lm, y, size: 10 }); y -= sg;

  // PARTIES
  lines.push({ text: "PARTIES", x: lm, y, size: 11, bold: true }); y -= lh + 4;
  lines.push({ text: `Student Name: ${studentName}`, x: lm, y, size: 10 }); y -= lh;
  lines.push({ text: `EduForYou Representative: ${agentName}`, x: lm, y, size: 10 }); y -= lh;
  lines.push({ text: `Date: ${consentDate}`, x: lm, y, size: 10 }); y -= sg;

  // Clauses 1-11
  for (const clause of CLAUSES) {
    const textLines = wrapText(clause.text, maxW);
    const bulletCount = clause.bullets?.length || 0;
    const neededHeight = lh + 4 + textLines.length * (lh - 1) + bulletCount * (lh - 1) + 10;
    checkPage(neededHeight);

    lines.push({ text: clause.title, x: lm, y, size: 10, bold: true }); y -= lh;
    for (const wl of textLines) {
      lines.push({ text: wl, x: lm, y, size: 9 }); y -= lh - 1;
    }
    if (clause.bullets) {
      for (const bullet of clause.bullets) {
        const bulletLines = wrapText(`- ${bullet}`, maxW - 2);
        for (let bi = 0; bi < bulletLines.length; bi++) {
          checkPage(lh);
          lines.push({ text: bulletLines[bi], x: lm + (bi === 0 ? 10 : 18), y, size: 9 }); y -= lh - 1;
        }
      }
    }
    y -= 6;
  }

  // Section 12 — Marketing
  checkPage(80);
  lines.push({ text: "12. MARKETING & THIRD-PARTY CONSENT", x: lm, y, size: 10, bold: true }); y -= lh + 2;

  const mc = marketingConsent || {};
  const marketingItems = [
    { label: "I consent to being contacted by EduForYou", checked: !!mc.contact_consent },
    { label: "I consent to data sharing with partner institutions", checked: !!mc.data_sharing_consent },
    { label: "I consent to receiving marketing communications", checked: !!mc.marketing_yes },
    { label: "I do NOT consent to marketing communications", checked: !!mc.marketing_no },
  ];

  for (const item of marketingItems) {
    const check = item.checked ? "[X]" : "[  ]";
    lines.push({ text: `${check}  ${item.label}`, x: lm + 10, y, size: 9 }); y -= lh;
  }
  y -= 6;

  // Section 13 — Declaration
  checkPage(30);
  lines.push({ text: "13. DECLARATION", x: lm, y, size: 10, bold: true }); y -= lh;
  lines.push({ text: "I confirm that I have read, understood, and agree to the terms outlined in this document.", x: lm, y, size: 9 }); y -= sg;

  // Signature block
  checkPage(80);
  lines.push({ text: "SIGNATURES", x: lm, y, size: 11, bold: true }); y -= lh + 4;

  if (signature) {
    lines.push({ text: `Student Signature: ${signature}`, x: lm, y, size: 10, bold: true }); y -= lh;
  } else {
    lines.push({ text: "Student Signature: __________________________", x: lm, y, size: 10 }); y -= lh;
  }
  lines.push({ text: `Date: ${consentDate}`, x: lm, y, size: 10 }); y -= lh + 6;

  // Placeholder for drawn signature image (will be placed here)
  const sigImgY = y;
  y -= 68; // reserve space for signature image

  lines.push({ text: `EduForYou Signature: ${agentName}`, x: lm, y, size: 10, bold: true }); y -= lh;
  lines.push({ text: `Date: ${consentDate}`, x: lm, y, size: 10 });

  pages.push({ lines, sigImg: undefined });
  // Return sigImgY info for caller to set
  (pages as any)._sigImgY = sigImgY;
  return pages;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function buildMultiPagePdf(
  allPages: PageContent[],
  sigImg?: { rgb: Uint8Array; width: number; height: number; rect: { x: number; y: number; w: number; h: number } },
  sigPageIndex?: number,
): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  function pushText(s: string) { chunks.push(encoder.encode(s)); }
  function pushBytes(b: Uint8Array) { chunks.push(b); }
  function currentLength(): number { let len = 0; for (const c of chunks) len += c.length; return len; }

  const pageCount = allPages.length;
  const hasSigImg = !!sigImg;

  // Object numbering:
  // 1 = Catalog, 2 = Pages, 3 = Font Helvetica, 4 = Font Helvetica-Bold
  // 5..5+pageCount-1 = Page objects
  // 5+pageCount..5+2*pageCount-1 = Content stream objects
  // if hasSigImg: 5+2*pageCount = Image XObject
  const fontObj1 = 3;
  const fontObj2 = 4;
  const firstPageObj = 5;
  const firstContentObj = firstPageObj + pageCount;
  const imgObjNum = hasSigImg ? firstContentObj + pageCount : 0;
  const totalObjects = hasSigImg ? imgObjNum + 1 : firstContentObj + pageCount;

  // Build content streams
  const contentStreams: Uint8Array[] = [];
  for (let p = 0; p < pageCount; p++) {
    let stream = "BT\n";
    for (const line of allPages[p].lines) {
      const fontKey = line.bold ? "/F2" : "/F1";
      const fontSize = line.size || 10;
      const escaped = line.text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
      stream += `${fontKey} ${fontSize} Tf\n1 0 0 1 ${line.x} ${line.y} Tm\n(${escaped}) Tj\n`;
    }
    stream += "ET\n";

    if (hasSigImg && p === (sigPageIndex ?? pageCount - 1)) {
      stream += "q\n";
      stream += `${sigImg!.rect.w} 0 0 ${sigImg!.rect.h} ${sigImg!.rect.x} ${sigImg!.rect.y} cm\n`;
      stream += "/SigImg Do\nQ\n";
    }
    contentStreams.push(encoder.encode(stream));
  }

  // Build PDF
  pushText("%PDF-1.4\n");
  const offsets: number[] = [];

  // Obj 1 — Catalog
  offsets.push(currentLength());
  pushText("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // Obj 2 — Pages
  offsets.push(currentLength());
  const kids = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`).join(" ");
  pushText(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  // Obj 3 — Font Helvetica
  offsets.push(currentLength());
  pushText(`${fontObj1} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n`);

  // Obj 4 — Font Helvetica-Bold
  offsets.push(currentLength());
  pushText(`${fontObj2} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n`);

  // Page objects
  for (let p = 0; p < pageCount; p++) {
    offsets.push(currentLength());
    const contentObjNum = firstContentObj + p;
    const needsSigImg = hasSigImg && p === (sigPageIndex ?? pageCount - 1);
    const xobjectStr = needsSigImg ? ` /XObject << /SigImg ${imgObjNum} 0 R >>` : "";
    pushText(`${firstPageObj + p} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R >>${xobjectStr} >> >>\nendobj\n`);
  }

  // Content stream objects
  for (let p = 0; p < pageCount; p++) {
    offsets.push(currentLength());
    const streamBytes = contentStreams[p];
    pushText(`${firstContentObj + p} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`);
    pushBytes(streamBytes);
    pushText("\nendstream\nendobj\n");
  }

  // Image XObject (if present)
  if (hasSigImg) {
    offsets.push(currentLength());
    pushText(`${imgObjNum} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${sigImg!.width} /Height ${sigImg!.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length ${sigImg!.rgb.length} >>\nstream\n`);
    pushBytes(sigImg!.rgb);
    pushText("\nendstream\nendobj\n");
  }

  // Cross-reference table
  const xrefOffset = currentLength();
  pushText(`xref\n0 ${totalObjects + 1}\n0000000000 65535 f \n`);
  for (const o of offsets) pushText(`${String(o).padStart(10, "0")} 00000 n \n`);
  pushText(`trailer\n<< /Size ${totalObjects + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  let totalLen = 0;
  for (const c of chunks) totalLen += c.length;
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const c of chunks) { result.set(c, pos); pos += c.length; }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const {
      studentName, agentName,
      signature, signatureImage, signatureRgb, signatureWidth, signatureHeight,
      consentDate, marketingConsent,
    } = await req.json();

    if (!studentName || (!signature && !signatureImage && !signatureRgb)) {
      return new Response(JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const date = consentDate || new Date().toLocaleDateString("en-GB");
    const agent = agentName || "EduForYou UK";

    const pages = buildPages(studentName, agent, date, signature, marketingConsent || null);
    const sigImgY = (pages as any)._sigImgY as number;

    let sigImgData: { rgb: Uint8Array; width: number; height: number; rect: { x: number; y: number; w: number; h: number } } | undefined;

    if (signatureRgb && signatureWidth && signatureHeight) {
      const binaryString = atob(signatureRgb as string);
      const rgbBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) rgbBytes[i] = binaryString.charCodeAt(i);

      sigImgData = {
        rgb: rgbBytes,
        width: signatureWidth,
        height: signatureHeight,
        rect: { x: 50, y: sigImgY - 60, w: 200, h: 60 },
      };
    }

    const pdfBytes = buildMultiPagePdf(pages, sigImgData, pages.length - 1);
    const base64 = uint8ArrayToBase64(pdfBytes);

    return new Response(JSON.stringify({ pdf_base64: base64 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Error generating consent PDF:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
