import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export interface PdfExportOptions {
  fileName: string;
  elements: (HTMLElement | null)[];
  onProgress?: (message: string) => void;
}

/**
 * Pre-load all images inside an element to ensure html2canvas captures them
 */
async function preloadImages(el: HTMLElement): Promise<void> {
  const imgs = Array.from(el.querySelectorAll("img"));
  if (imgs.length === 0) return;

  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight !== 0) {
            resolve();
            return;
          }
          const onLoad = () => {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
            resolve();
          };
          const onError = () => {
            img.removeEventListener("load", onLoad);
            img.removeEventListener("error", onError);
            resolve();
          };
          img.addEventListener("load", onLoad);
          img.addEventListener("error", onError);
        })
    )
  );
}

/**
 * Capture an element to canvas with high resolution (scale 3 = ultra-sharp 288+ DPI print quality)
 * Lossless PNG capture guarantees zero pixelation, zero JPEG ringing blur, and razor-sharp text.
 */
async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  await preloadImages(el);

  const targetWidth = el.offsetWidth || 794;
  const targetHeight = el.offsetHeight || 1123;

  return await html2canvas(el, {
    scale: 3, // 3x scale delivers needle-sharp 288+ DPI print resolution
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    scrollX: 0,
    scrollY: 0,
    width: targetWidth,
    height: targetHeight,
    windowWidth: targetWidth,
    windowHeight: targetHeight,
    onclone: (clonedDoc, clonedElement) => {
      // 1. Force Calibri/Arial font family for crisp, balanced vertical typography
      clonedElement.style.fontFamily = "Calibri, Arial, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";

      // 2. Normalize table cell baselines and vertical centering
      const cells = clonedElement.querySelectorAll("td, th");
      cells.forEach((cell) => {
        const c = cell as HTMLElement;
        c.style.verticalAlign = "middle";
        c.style.lineHeight = "1.25";
      });
    },
  });
}

/**
 * Convert an image element or URL to Base64 data URL reliably
 * Uses fetch + FileReader as primary strategy (works even if offscreen or hidden),
 * with canvas fallback.
 */
async function convertImgToDataUrlAsync(img: HTMLImageElement): Promise<string | null> {
  if (!img.src) return null;
  if (img.src.startsWith("data:")) return img.src;

  // 1. Primary Strategy: fetch() + FileReader (works for offscreen/unrendered DOM elements)
  try {
    const res = await fetch(img.src);
    if (res.ok) {
      const blob = await res.blob();
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (base64 && base64.startsWith("data:")) return base64;
    }
  } catch (fetchErr) {
    // Continue to canvas fallback
  }

  // 2. Secondary Strategy: Canvas drawImage
  try {
    if (!img.complete || img.naturalWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (canvasErr) {
    return null;
  }
}

/**
 * Build standalone self-contained HTML for Native Chromium Vector PDF export
 */
async function buildStandaloneDocumentHtml(elements: HTMLElement[], docTitle?: string): Promise<string> {
  // Capture document styles (Tailwind, typography, print rules)
  let extractedStyles = "";
  if (typeof document !== "undefined") {
    const styleNodes = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"));
    extractedStyles = styleNodes.map((s) => s.outerHTML).join("\n");
  }

  const pagesHtml = (
    await Promise.all(
      elements.map(async (el) => {
        // If el contains an a4-sheet child, target the a4-sheet directly
        const targetEl = (el.querySelector(".a4-sheet") as HTMLElement) || el;
        const clone = targetEl.cloneNode(true) as HTMLElement;
        const originalImgs = Array.from(targetEl.querySelectorAll("img"));
        const cloneImgs = Array.from(clone.querySelectorAll("img"));

        for (let idx = 0; idx < cloneImgs.length; idx++) {
          const orig = originalImgs[idx];
          const cImg = cloneImgs[idx];
          if (orig) {
            if (orig.src && orig.src.startsWith("data:")) {
              cImg.src = orig.src;
            } else {
              const dataUrl = await convertImgToDataUrlAsync(orig);
              if (dataUrl) {
                cImg.src = dataUrl;
              }
            }
          }
        }
        return `<div class="pdf-page-container">${clone.outerHTML}</div>`;
      })
    )
  ).join("\n");

  const titleText = (docTitle || "Document").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${titleText}</title>
  ${extractedStyles}
  <style>
    @page {
      size: 210mm 297mm;
      margin: 0mm;
    }
    * {
      box-sizing: border-box !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
    .pdf-page-container {
      width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      overflow: hidden !important;
      page-break-after: always !important;
      break-after: page !important;
      background: #ffffff !important;
    }
    .pdf-page-container:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
    .a4-sheet {
      width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      padding: 8mm 10mm !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      background: #ffffff !important;
      color: #000000 !important;
      overflow: hidden !important;
    }
    table {
      border-collapse: collapse !important;
    }
    th, td {
      vertical-align: middle !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
  </style>
</head>
<body>
  ${pagesHtml}
</body>
</html>`;
}

/**
 * Master PDF Export Engine for AVEN ERP
 * 1. Generates True Native Chromium Vector PDF via /api/export-pdf (100% exact vector fonts & colors)
 * 2. Guaranteed print-ready fidelity with selectable text, sharp borders, and zero raster degradation
 */
export async function exportElementsToPdf({
  fileName,
  elements,
  onProgress,
}: PdfExportOptions): Promise<boolean> {
  const validElements = elements.filter((e): e is HTMLElement => e !== null);
  if (validElements.length === 0) {
    console.error("No valid HTML elements provided for PDF export");
    return false;
  }

  // 1. Try Native Chromium Vector PDF Engine
  try {
    if (onProgress) onProgress("Generating Native Chromium Vector PDF...");
    const fullHtml = await buildStandaloneDocumentHtml(validElements, fileName);

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (typeof window !== "undefined") {
      try {
        const tabSessionRaw = sessionStorage.getItem("aven_tab_session");
        if (tabSessionRaw) {
          const tabSession = JSON.parse(tabSessionRaw);
          if (tabSession.token) {
            headers["x-tab-session"] = tabSession.token;
          }
        }
      } catch (e) {}
    }

    const apiRes = await fetch("/api/export-pdf", {
      method: "POST",
      headers,
      body: JSON.stringify({ html: fullHtml, fileName }),
    });

    if (apiRes.ok) {
      const pdfBlob = await apiRes.blob();
      if (pdfBlob && pdfBlob.size > 1000) {
        if (typeof window !== "undefined") {
          (window as any).__lastExportedPdfBlob = pdfBlob;
        }
        if (onProgress) onProgress("Saving Native Vector PDF...");
        return await saveBlobToFile(pdfBlob, fileName, onProgress);
      }
    } else {
      const errData = await apiRes.json().catch(() => ({}));
      const errMsg = errData.error || `Server PDF export error (${apiRes.status})`;
      console.error("Chromium PDF export endpoint responded with error:", errMsg);
      if (onProgress) onProgress(`PDF Export Failed: ${errMsg}`);
      if (typeof window !== "undefined") {
        window.alert(`Server PDF Generation Failed: ${errMsg}`);
      }
      return false;
    }
  } catch (apiErr: any) {
    const errMsg = apiErr?.message || "Network error during PDF generation";
    console.error("Native Chromium API export error:", errMsg);
    if (onProgress) onProgress(`PDF Export Failed: ${errMsg}`);
    if (typeof window !== "undefined") {
      window.alert(`PDF Export Failed: ${errMsg}`);
    }
    return false;
  }

  return false;
}

/**
 * Universal file saver supporting File System Access API and browser download
 */
async function saveBlobToFile(
  pdfBlob: Blob,
  fileName: string,
  onProgress?: (status: string) => void
): Promise<boolean> {
  // 1. Try File System Access API (showSaveFilePicker)
  // Allows user to pick exact save location (e.g. OneDrive, Desktop) with suggested filename
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "PDF Document (*.pdf)",
            accept: {
              "application/pdf": [".pdf"],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      if (onProgress) onProgress("Saved successfully!");
      return true;
    } catch (err: any) {
      if (err.name === "AbortError") {
        if (onProgress) onProgress("");
        return false;
      }
      console.warn("showSaveFilePicker fallback to download:", err);
    }
  }

  // 2. Fallback: Browser direct file download
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    link.remove();
  }, 2000);

  if (onProgress) onProgress("Downloaded successfully!");
  return true;
}
