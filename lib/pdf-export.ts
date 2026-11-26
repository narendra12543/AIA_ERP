export interface PdfExportOptions {
  fileName: string;
  elements: (HTMLElement | null)[];
  onProgress?: (message: string) => void;
}

// Single-flight lock to prevent duplicate simultaneous exports
let activeExportPromise: Promise<boolean> | null = null;

/**
 * Normalize image src attributes so local /assets/... paths and Cloudinary HTTPS URLs
 * are resolved server-side instead of bloating the client-to-server POST payload with Base64.
 */
function normalizeImgSrcForServer(rawSrc: string): string {
  if (!rawSrc) return rawSrc;
  if (rawSrc.startsWith("data:")) return rawSrc;

  try {
    // Convert same-origin http(s)://host/assets/... to clean relative /assets/...
    const url = new URL(rawSrc, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (url.pathname.startsWith("/assets/")) {
      return url.pathname;
    }
    return url.href;
  } catch {
    return rawSrc;
  }
}

/**
 * Build standalone self-contained HTML for Native Chromium Vector PDF export
 */
function buildStandaloneDocumentHtml(elements: HTMLElement[], docTitle?: string): string {
  let extractedStyles = "";
  if (typeof document !== "undefined") {
    const styleNodes = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"));
    extractedStyles = styleNodes.map((s) => s.outerHTML).join("\n");
  }

  const pagesHtml = elements
    .map((el) => {
      const targetEl = (el.querySelector(".a4-sheet") as HTMLElement) || el;
      const clone = targetEl.cloneNode(true) as HTMLElement;
      const originalImgs = Array.from(targetEl.querySelectorAll("img"));
      const cloneImgs = Array.from(clone.querySelectorAll("img"));

      for (let idx = 0; idx < cloneImgs.length; idx++) {
        const orig = originalImgs[idx];
        const cImg = cloneImgs[idx];
        if (orig && orig.getAttribute("src")) {
          cImg.setAttribute("src", normalizeImgSrcForServer(orig.getAttribute("src") || orig.src));
        }
      }
      return `<div class="pdf-page-container">${clone.outerHTML}</div>`;
    })
    .join("\n");

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
 * Validate received PDF binary payload before saving
 */
function validateClientPdfBytes(bytes: Uint8Array): { valid: boolean; reason?: string } {
  if (bytes.length < 1000) {
    return { valid: false, reason: `Received empty or truncated PDF (${bytes.length} bytes)` };
  }
  const hasHeader =
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d; // -
  if (!hasHeader) {
    return { valid: false, reason: "Missing %PDF- binary header" };
  }
  const tailText = new TextDecoder("ascii").decode(bytes.subarray(Math.max(0, bytes.length - 128)));
  if (!tailText.includes("%%EOF") || !tailText.includes("startxref")) {
    return { valid: false, reason: "Missing startxref or %%EOF trailer (incomplete transfer)" };
  }
  return { valid: true };
}

function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function parseRetryAfterMs(headerVal: string | null, defaultDelayMs: number): number {
  if (!headerVal) return defaultDelayMs;
  const seconds = Number(headerVal);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 10000);
  }
  return defaultDelayMs;
}

/**
 * Show a clean two-step Save / Share prompt when transient user activation expired
 * during a slow cold start or when on mobile browsers supporting Web Share API.
 */
function showValidatedSavePrompt(pdfBlob: Blob, fileName: string, onProgress?: (msg: string) => void): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(false);
      return;
    }

    const existing = document.getElementById("aven-pdf-save-prompt");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "aven-pdf-save-prompt";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,sans-serif;";

    const card = document.createElement("div");
    card.style.cssText =
      "background:#18181b;color:#f4f4f5;border:1px solid #3f3f46;border-radius:12px;max-width:420px;width:100%;padding:20px;box-shadow:0 20px 40px rgba(0,0,0,0.5);";

    const title = document.createElement("div");
    title.style.cssText = "font-size:15px;font-weight:700;margin-bottom:6px;color:#ffffff;";
    title.textContent = "PDF Ready to Save";

    const desc = document.createElement("div");
    desc.style.cssText = "font-size:12px;color:#a1a1aa;margin-bottom:16px;word-break:break-word;";
    desc.textContent = `${fileName} (${Math.round(pdfBlob.size / 1024)} KB) verified and ready.`;

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText =
      "padding:8px 14px;border-radius:8px;border:1px solid #3f3f46;background:transparent;color:#d4d4d8;font-size:12px;font-weight:600;cursor:pointer;";
    cancelBtn.onclick = () => {
      overlay.remove();
      if (onProgress) onProgress("");
      resolve(false);
    };

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "showSaveFilePicker" in window ? "Choose Folder & Save PDF" : "Download PDF";
    saveBtn.style.cssText =
      "padding:8px 16px;border-radius:8px;border:none;background:#10b981;color:#052e16;font-size:12px;font-weight:700;cursor:pointer;";
    saveBtn.onclick = async () => {
      overlay.remove();
      const saved = await saveValidatedBlobDirect(pdfBlob, fileName, onProgress);
      resolve(saved);
    };

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);
    card.appendChild(title);
    card.appendChild(desc);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  });
}

/**
 * Save already-validated PDF Blob using File System Access API (Save As) or safe Blob download
 */
async function saveValidatedBlobDirect(
  pdfBlob: Blob,
  fileName: string,
  onProgress?: (status: string) => void
): Promise<boolean> {
  // 1. Desktop Chrome/Edge: File System Access API (Save As dialog)
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "PDF Document (*.pdf)",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      try {
        await writable.write(pdfBlob);
        await writable.close();
      } catch (writeErr) {
        try {
          await writable.abort();
        } catch {}
        throw writeErr;
      }

      if (onProgress) onProgress("Saved successfully!");
      return true;
    } catch (err: any) {
      if (err?.name === "AbortError") {
        if (onProgress) onProgress("");
        return false;
      }
      // If user activation expired during slow server generation, offer a 1-click Save As prompt
      if (err?.name === "SecurityError" || String(err?.message || "").toLowerCase().includes("user gesture")) {
        // In automated headless tests (no active human gesture), fall through to direct blob download
        if ((navigator as any).webdriver) {
          console.warn("Headless webdriver detected, using blob download fallback.");
        } else {
          return await showValidatedSavePrompt(pdfBlob, fileName, onProgress);
        }
      } else {
        console.warn("showSaveFilePicker fallback to download:", err);
      }
    }
  }

  // 2. Mobile & Non-FileSystem-API Browsers: Safe Blob download with 60s URL lifetime
  // (prevents premature URL revocation on iOS Safari / Android Chrome)
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(blobUrl);
    link.remove();
  }, 60000);

  if (onProgress) onProgress("Downloaded successfully!");
  return true;
}

/**
 * Master PDF Export Engine for AVEN ERP
 * - Sends lightweight HTML (assets resolved securely on server)
 * - Single-flight lock + bounded automatic retry for transient failures
 * - Strict binary integrity validation before saving
 * - Preserves Save As dialog without creating empty 0-byte files on server failure
 */
export async function exportElementsToPdf(options: PdfExportOptions): Promise<boolean> {
  if (activeExportPromise) {
    if (options.onProgress) options.onProgress("PDF export already in progress...");
    return activeExportPromise;
  }

  activeExportPromise = runExportWithRetry(options).finally(() => {
    activeExportPromise = null;
  });
  return activeExportPromise;
}

export interface GeneratedPdfAttachment {
  fileName: string;
  base64: string;
  sizeBytes: number;
}

/**
 * Generate a validated Native Chromium Vector PDF in memory and return Base64 + size
 * for attaching directly to Zoho Mail emails. Uses the exact same `/api/export-pdf` pipeline.
 */
export async function exportElementsToPdfBase64({
  fileName,
  elements,
  onProgress,
}: PdfExportOptions): Promise<GeneratedPdfAttachment | null> {
  const bytes = await fetchValidatedPdfBytes({ fileName, elements, onProgress });
  if (!bytes) return null;

  // Convert Uint8Array to base64 safely in chunks
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return {
    fileName,
    base64: btoa(binary),
    sizeBytes: bytes.byteLength,
  };
}

async function runExportWithRetry(options: PdfExportOptions): Promise<boolean> {
  const bytes = await fetchValidatedPdfBytes(options);
  if (!bytes) return false;
  const pdfBlob = new Blob([bytes.buffer as ArrayBuffer], { type: "application/pdf" });
  if (typeof window !== "undefined") {
    (window as any).__lastExportedPdfBlob = pdfBlob;
  }
  if (options.onProgress) options.onProgress("Ready to save");
  return await saveValidatedBlobDirect(pdfBlob, options.fileName, options.onProgress);
}

async function fetchValidatedPdfBytes({
  fileName,
  elements,
  onProgress,
}: PdfExportOptions): Promise<Uint8Array | null> {
  const validElements = elements.filter((e): e is HTMLElement => e !== null);
  if (validElements.length === 0) {
    console.error("No valid HTML elements provided for PDF export");
    return null;
  }

  if (onProgress) onProgress("Preparing document...");
  const fullHtml = buildStandaloneDocumentHtml(validElements, fileName);

  if (onProgress) onProgress("Validating session...");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    try {
      const tabSessionRaw = sessionStorage.getItem("aven_tab_session");
      if (tabSessionRaw) {
        const tabSession = JSON.parse(tabSessionRaw);
        if (tabSession?.token) {
          headers["x-tab-session"] = tabSession.token;
        }
      }
    } catch {}
  }

  const MAX_RETRIES = 2;
  const BACKOFF_MS = [800, 2000];
  let lastErrorMsg = "PDF export failed.";

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (onProgress) {
        onProgress(
          attempt === 0
            ? "Generating PDF..."
            : `Retrying PDF generation (${attempt}/${MAX_RETRIES})...`
        );
      }

      const apiRes = await fetch("/api/export-pdf", {
        method: "POST",
        credentials: "same-origin",
        headers,
        body: JSON.stringify({ html: fullHtml, fileName }),
      });

      if (apiRes.ok) {
        if (onProgress) onProgress("Verifying PDF...");
        const contentType = (apiRes.headers.get("content-type") || "").toLowerCase();
        if (!contentType.includes("application/pdf")) {
          lastErrorMsg = `Unexpected response type (${contentType || "unknown"}) instead of application/pdf.`;
          break;
        }

        const arrayBuffer = await apiRes.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const validation = validateClientPdfBytes(bytes);

        if (!validation.valid) {
          lastErrorMsg = validation.reason || "Received corrupted or truncated PDF binary.";
          if (attempt < MAX_RETRIES) {
            await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
            continue;
          }
          break;
        }

        return bytes;
      }

      // Non-OK HTTP status
      const errData = await apiRes.json().catch(() => ({}));
      lastErrorMsg = errData.error || `Server PDF export error (${apiRes.status})`;

      // Never retry auth/permission/validation errors
      if (!isTransientHttpStatus(apiRes.status) || attempt >= MAX_RETRIES) {
        break;
      }

      const delay = parseRetryAfterMs(apiRes.headers.get("Retry-After"), BACKOFF_MS[attempt]);
      await new Promise((r) => setTimeout(r, delay));
    } catch (netErr: any) {
      lastErrorMsg = netErr?.message || "Network error during PDF generation";
      if (attempt >= MAX_RETRIES) {
        break;
      }
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
    }
  }

  console.error("Native Chromium PDF export failed:", lastErrorMsg);
  if (onProgress) onProgress(`PDF Export Failed: ${lastErrorMsg}`);
  if (typeof window !== "undefined") {
    window.alert(`Server PDF Generation Failed: ${lastErrorMsg}\n\nPlease try again.`);
  }
  return null;
}
