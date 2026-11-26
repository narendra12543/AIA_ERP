import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Module-level caches for warm container reuse (Vercel Fluid Compute / Node server)
let cachedBrowser: any = null;
let cachedLaunchConfig: { executablePath: string; args: string[]; headless: boolean | "shell" } | null = null;
const localAssetDataUrlCache = new Map<string, string>();
const MAX_LOCAL_CACHE_ENTRIES = 25;

// Strict SSRF Allowlist for remote image fetching during server-side PDF rendering
const ALLOWED_REMOTE_HOSTS = new Set(["res.cloudinary.com"]);

function isAllowedRemoteAssetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();
    // Block IP literals, localhost, private/link-local/metadata ranges
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "0.0.0.0" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host) ||
      host.startsWith("[")
    ) {
      return false;
    }

    if (ALLOWED_REMOTE_HOSTS.has(host) || host.endsWith(".cloudinary.com")) {
      return true;
    }

    const appHost = process.env.VERCEL_URL?.toLowerCase();
    if (appHost && host === appHost) return true;

    if (process.env.NEXT_PUBLIC_APP_URL) {
      try {
        const publicHost = new URL(process.env.NEXT_PUBLIC_APP_URL).hostname.toLowerCase();
        if (host === publicHost) return true;
      } catch {}
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Strip untrusted <script> tags and inline event handlers from HTML before rendering
 */
function sanitizeDocumentHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
}

/**
 * Resolve local /assets/... files (with path traversal guard) and allowlisted remote HTTPS images (Cloudinary)
 */
async function resolveAndInlineAssets(html: string): Promise<{ html: string; assetCount: number }> {
  const publicDirs = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "nextjs-app", "public"),
    path.resolve(__dirname, "../../../../public"),
    path.resolve(__dirname, "../../../public"),
    path.resolve(__dirname, "../../public"),
  ];

  // 1. Collect all unique image src URLs
  const srcMatches = Array.from(html.matchAll(/src=["']([^"']+)["']/gi));
  const replacements = new Map<string, string>();
  let assetCount = 0;

  await Promise.all(
    Array.from(new Set(srcMatches.map((m) => m[1]))).map(async (origSrc) => {
      if (!origSrc || origSrc.startsWith("data:")) return;

      // Case A: Local /assets/... path (or same-origin URL ending in /assets/...)
      const localMatch = origSrc.match(/^(?:https?:\/\/[^\/]+)?\/?(assets\/[^?#]+)/i);
      if (localMatch) {
        const relAsset = localMatch[1].replace(/\\/g, "/");
        if (relAsset.includes("..")) return;

        if (localAssetDataUrlCache.has(relAsset)) {
          replacements.set(origSrc, localAssetDataUrlCache.get(relAsset)!);
          assetCount++;
          return;
        }

        for (const baseDir of publicDirs) {
          const resolvedBase = path.resolve(baseDir);
          const fullPath = path.resolve(resolvedBase, relAsset);
          if (!fullPath.startsWith(resolvedBase + path.sep)) continue;

          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            let mime = "image/png";
            if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
            else if (ext === ".svg") mime = "image/svg+xml";
            else if (ext === ".webp") mime = "image/webp";

            const dataUrl = `data:${mime};base64,${fs.readFileSync(fullPath).toString("base64")}`;
            if (localAssetDataUrlCache.size < MAX_LOCAL_CACHE_ENTRIES) {
              localAssetDataUrlCache.set(relAsset, dataUrl);
            }
            replacements.set(origSrc, dataUrl);
            assetCount++;
            return;
          }
        }
        return;
      }

      // Case B: Allowlisted remote HTTPS URL (e.g. Cloudinary) with strict SSRF checks
      if (origSrc.startsWith("https://") && isAllowedRemoteAssetUrl(origSrc)) {
        try {
          const res = await fetch(origSrc, {
            method: "GET",
            redirect: "error",
            signal: AbortSignal.timeout(5000),
          });
          if (!res.ok) return;

          const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          const validMimes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);
          if (!validMimes.has(contentType)) return;

          const arrBuf = await res.arrayBuffer();
          if (arrBuf.byteLength === 0 || arrBuf.byteLength > 10 * 1024 * 1024) return;

          const dataUrl = `data:${contentType};base64,${Buffer.from(arrBuf).toString("base64")}`;
          replacements.set(origSrc, dataUrl);
          assetCount++;
        } catch (err: any) {
          console.warn("Remote asset fetch skipped:", origSrc.slice(0, 80), err?.message || "");
        }
      }
    })
  );

  if (replacements.size === 0) {
    return { html, assetCount: 0 };
  }

  const updatedHtml = html.replace(/src=["']([^"']+)["']/gi, (match, srcVal) => {
    if (!srcVal || srcVal.startsWith("data:")) return match;
    const replacement = replacements.get(srcVal);
    // Strip any unresolved/disallowed external URL so Chromium never makes unapproved outbound requests
    return replacement ? `src="${replacement}"` : `src=""`;
  });

  return { html: updatedHtml, assetCount };
}

/**
 * Resolve Chromium Launch Configuration across environments
 */
async function resolveChromiumLaunchConfig(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
}> {
  if (cachedLaunchConfig && (cachedLaunchConfig.executablePath === "" || fs.existsSync(cachedLaunchConfig.executablePath))) {
    return cachedLaunchConfig;
  }

  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--font-render-hinting=none",
  ];

  // 1. Explicit environment variable override
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    cachedLaunchConfig = { executablePath: process.env.CHROME_PATH, args: defaultArgs, headless: true };
    return cachedLaunchConfig;
  }

  // 2. Windows Local Development
  if (process.platform === "win32") {
    const winPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        cachedLaunchConfig = { executablePath: p, args: defaultArgs, headless: true };
        return cachedLaunchConfig;
      }
    }
  }

  // 3. Linux VPS / Docker Container system binaries (when not running in Vercel/Lambda)
  if (!process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const linuxPaths = [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/chromium",
      "/usr/bin/chromium-browser",
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        cachedLaunchConfig = { executablePath: p, args: defaultArgs, headless: true };
        return cachedLaunchConfig;
      }
    }
  }

  // 4. Vercel Serverless / AWS Lambda Runtime via @sparticuz/chromium
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false;
    const execPath = await chromium.executablePath();
    if (execPath) {
      cachedLaunchConfig = {
        executablePath: execPath,
        args: chromium.args,
        headless: "shell",
      };
      return cachedLaunchConfig;
    }
  } catch (serverlessErr: any) {
    console.error("Failed to initialize @sparticuz/chromium:", serverlessErr?.message || serverlessErr);
  }

  return { executablePath: "", args: [], headless: true };
}

async function getOrLaunchBrowser(puppeteer: any, launchConfig: { executablePath: string; args: string[]; headless: boolean | "shell" }) {
  if (cachedBrowser && cachedBrowser.connected) {
    return { browser: cachedBrowser, reused: true };
  }
  if (cachedBrowser) {
    try {
      await cachedBrowser.close();
    } catch {}
    cachedBrowser = null;
  }

  const browser = await puppeteer.launch({
    executablePath: launchConfig.executablePath,
    headless: launchConfig.headless,
    args: launchConfig.args,
  });
  browser.on("disconnected", () => {
    if (cachedBrowser === browser) {
      cachedBrowser = null;
    }
  });
  cachedBrowser = browser;
  return { browser, reused: false };
}

/**
 * Validate structural integrity of generated PDF binary
 */
function validatePdfBinary(pdfBytes: Buffer): { valid: boolean; reason?: string } {
  if (pdfBytes.length < 1000) {
    return { valid: false, reason: `PDF too small (${pdfBytes.length} bytes)` };
  }
  if (pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
    return { valid: false, reason: "Missing %PDF- header signature" };
  }
  const tailText = pdfBytes.subarray(Math.max(0, pdfBytes.length - 128)).toString("ascii");
  if (!tailText.includes("%%EOF") || !tailText.includes("startxref")) {
    return { valid: false, reason: "Missing startxref or %%EOF trailer" };
  }
  // Check core PDF catalog / pages structure in Latin-1 text scan
  const bodySample = pdfBytes.toString("latin1");
  if (!bodySample.includes("/Type /Catalog") && !bodySample.includes("/Type/Catalog")) {
    return { valid: false, reason: "Missing PDF /Catalog object" };
  }
  if (!bodySample.includes("/Type /Pages") && !bodySample.includes("/Type/Pages")) {
    return { valid: false, reason: "Missing PDF /Pages object" };
  }
  return { valid: true };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomBytes(4).toString("hex");
  const tStart = performance.now();
  const isColdStart = !cachedBrowser;

  const tAuthStart = performance.now();
  const auth = await authenticateRequest(req, { requiredPermission: "quotations.export" });
  const authMs = Math.round(performance.now() - tAuthStart);

  if ("error" in auth) {
    console.warn(`[PDF_EXPORT_DIAGNOSTICS]`, JSON.stringify({ requestId, status: auth.status, authMs, error: "unauthorized" }));
    return NextResponse.json({ error: auth.error, code: auth.code, requestId }, { status: auth.status });
  }

  let page: any = null;

  try {
    const rawBody = await req.text();
    const payloadBytes = Buffer.byteLength(rawBody, "utf8");
    const { html, fileName } = JSON.parse(rawBody);

    if (!html || typeof html !== "string") {
      return NextResponse.json({ error: "No HTML content provided", requestId }, { status: 400 });
    }

    // 1. Sanitize HTML and resolve assets server-side
    const tAssetStart = performance.now();
    const sanitizedHtml = sanitizeDocumentHtml(html);
    const { html: inlinedHtml, assetCount } = await resolveAndInlineAssets(sanitizedHtml);
    const assetResolveMs = Math.round(performance.now() - tAssetStart);

    // 2. Import puppeteer-core & resolve Chromium executable
    let puppeteer: any;
    try {
      puppeteer = await import("puppeteer-core");
      if (puppeteer.default) puppeteer = puppeteer.default;
    } catch {
      return NextResponse.json({ error: "puppeteer-core module not available", requestId }, { status: 501 });
    }

    const tResolveStart = performance.now();
    const launchConfig = await resolveChromiumLaunchConfig();
    const chromiumResolveMs = Math.round(performance.now() - tResolveStart);

    if (!launchConfig.executablePath) {
      return NextResponse.json(
        {
          error: "Chromium binary not found on runtime host.",
          code: "CHROMIUM_BINARY_MISSING",
          requestId,
        },
        { status: 503 }
      );
    }

    // 3. Launch or reuse Chromium instance
    const tLaunchStart = performance.now();
    const { browser, reused } = await getOrLaunchBrowser(puppeteer, launchConfig);
    const launchMs = Math.round(performance.now() - tLaunchStart);

    // 4. Render document in isolated page (JS disabled + outbound network blocked for defense-in-depth SSRF protection)
    const tContentStart = performance.now();
    page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const url = req.url();
      if (url === "about:blank" || url.startsWith("data:")) {
        req.continue();
      } else {
        req.abort("blockedbyclient");
      }
    });
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(inlinedHtml, { waitUntil: ["domcontentloaded", "load"], timeout: 25000 });

    await page.evaluateHandle("document.fonts.ready");
    const contentMs = Math.round(performance.now() - tContentStart);

    const tRenderStart = performance.now();
    const pdfRaw = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    const renderMs = Math.round(performance.now() - tRenderStart);

    // 5. Structural PDF binary validation
    const tValidateStart = performance.now();
    const pdfBytes = Buffer.from(pdfRaw);
    const validation = validatePdfBinary(pdfBytes);
    const validateMs = Math.round(performance.now() - tValidateStart);

    if (!validation.valid) {
      console.error(
        `[PDF_EXPORT_DIAGNOSTICS]`,
        JSON.stringify({ requestId, status: 500, reason: validation.reason, responseBytes: pdfBytes.length })
      );
      return NextResponse.json(
        { error: "Generated PDF failed binary integrity validation.", code: "INVALID_PDF_BINARY", requestId },
        { status: 500 }
      );
    }

    const totalMs = Math.round(performance.now() - tStart);
    console.info(
      `[PDF_EXPORT_DIAGNOSTICS]`,
      JSON.stringify({
        requestId,
        status: 200,
        coldStart: isColdStart,
        browserReused: reused,
        payloadBytes,
        assetCount,
        authMs,
        assetResolveMs,
        chromiumResolveMs,
        launchMs,
        contentMs,
        renderMs,
        validateMs,
        responseBytes: pdfBytes.length,
        totalMs,
      })
    );

    const safeFileName = (fileName || "document.pdf").replace(/["\r\n]/g, "");
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBytes.length),
        "Content-Disposition": `attachment; filename="${safeFileName}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-PDF-Request-Id": requestId,
        "X-PDF-Total-Ms": String(totalMs),
        "X-PDF-Cold-Start": String(isColdStart),
      },
    });
  } catch (error: any) {
    const totalMs = Math.round(performance.now() - tStart);
    // Reset cached browser on unexpected crash so next retry gets a fresh instance
    if (cachedBrowser) {
      try {
        await cachedBrowser.close();
      } catch {}
      cachedBrowser = null;
    }
    console.error(
      `[PDF_EXPORT_DIAGNOSTICS]`,
      JSON.stringify({ requestId, status: 500, totalMs, error: error?.message || "PDF generation error" })
    );
    return NextResponse.json({ error: error?.message || "PDF generation error", requestId }, { status: 500 });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}
