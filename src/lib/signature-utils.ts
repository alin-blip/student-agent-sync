// Helper to extract raw RGB data from a signature canvas data URL
export function extractSignatureRgb(dataUrl: string, canvasWidth: number, canvasHeight: number): { rgb: string; width: number; height: number } | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const img = new Image();
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
        const rgba = imageData.data;
        const rgb = new Uint8Array(canvasWidth * canvasHeight * 3);

        for (let i = 0; i < canvasWidth * canvasHeight; i++) {
          rgb[i * 3] = rgba[i * 4];
          rgb[i * 3 + 1] = rgba[i * 4 + 1];
          rgb[i * 3 + 2] = rgba[i * 4 + 2];
        }

        let binary = "";
        for (let i = 0; i < rgb.length; i++) {
          binary += String.fromCharCode(rgb[i]);
        }
        const base64 = btoa(binary);
        resolve({ rgb: base64, width: canvasWidth, height: canvasHeight });
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    }) as any;
  } catch {
    return null;
  }
}
