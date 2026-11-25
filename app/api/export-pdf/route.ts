import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel serverless execution timeout (Pro plan supports up to 300s)

/**
 * Replace relative public asset URLs (e.g. /assets/logo.png) with inline Base64 data URLs
 * so Chromium/Puppeteer renders them immediately on about:blank with zero network latency or broken images.
 */
function inlineAssetsInHtml(html: string): string {
  const publicDirs = [
    path.join(process.cwd(), "public"),
    path.join(process.cwd(), "nextjs-app", "public"),
    path.resolve(__dirname, "../../../../public"),
    path.resolve(__dirname, "../../../public"),
    path.resolve(__dirname, "../../public"),
  ];

  return html.replace(/src=["'](?:https?:\/\/[^\/]+)?\/?(assets\/[^"']+)["']/gi, (match, assetPath) => {
    try {
      const cleanPath = (assetPath.startsWith("/") ? assetPath.slice(1) : assetPath).split("?")[0];

      for (const baseDir of publicDirs) {
        const fullPath = path.join(baseDir, cleanPath);
        if (fs.existsSync(fullPath)) {
          const ext = path.extname(fullPath).toLowerCase();
          let mime = "image/png";
          if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
          else if (ext === ".svg") mime = "image/svg+xml";
          else if (ext === ".webp") mime = "image/webp";
          const base64 = fs.readFileSync(fullPath).toString("base64");
          return `src="data:${mime};base64,${base64}"`;
        }
      }
    } catch (e) {
      console.warn("Failed to inline asset:", assetPath, e);
    }
    return match;
  });
}

/**
 * Resolve Chromium Launch Configuration across environments:
 * 1. Explicit CHROME_PATH environment variable override.
 * 2. Windows local development (Google Chrome / Microsoft Edge).
 * 3. Vercel Serverless / AWS Lambda via @sparticuz/chromium.
 * 4. Linux VPS / Docker Container (/usr/bin/google-chrome, /usr/bin/chromium).
 */
async function resolveChromiumLaunchConfig(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
}> {
  const defaultArgs = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--font-render-hinting=none",
  ];

  // 1. Explicit environment variable override
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return {
      executablePath: process.env.CHROME_PATH,
      args: defaultArgs,
      headless: true,
    };
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
        return {
          executablePath: p,
          args: defaultArgs,
          headless: true,
        };
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
        return {
          executablePath: p,
          args: defaultArgs,
          headless: true,
        };
      }
    }
  }

  // 4. Vercel Serverless / AWS Lambda Runtime via @sparticuz/chromium
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    chromium.setGraphicsMode = false; // Faster cold start; swiftshader not needed for HTML/CSS vector PDFs
    const execPath = await chromium.executablePath();
    if (execPath) {
      return {
        executablePath: execPath,
        args: chromium.args,
        headless: "shell",
      };
    }
  } catch (serverlessErr: any) {
    console.error("Failed to initialize @sparticuz/chromium:", serverlessErr?.message || serverlessErr);
  }

  return { executablePath: "", args: [], headless: true };
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let browser: any = null;

  try {
    const { html, fileName } = await req.json();

    if (!html) {
      return NextResponse.json({ error: "No HTML content provided" }, { status: 400 });
    }

    // Inline local assets as Base64 data URLs
    const inlinedHtml = inlineAssetsInHtml(html);

    // Import puppeteer-core
    let puppeteer: any;
    try {
      puppeteer = await import("puppeteer-core");
      if (puppeteer.default) puppeteer = puppeteer.default;
    } catch (e) {
      return NextResponse.json({ error: "puppeteer-core module not available" }, { status: 501 });
    }

    const launchConfig = await resolveChromiumLaunchConfig();

    if (!launchConfig.executablePath) {
      return NextResponse.json(
        {
          error: "Chromium binary not found on runtime host.",
          details:
            process.platform === "win32"
              ? "Ensure Google Chrome or Microsoft Edge is installed in default system directories."
              : "Serverless @sparticuz/chromium failed to resolve executablePath, and no system Chrome binary was found.",
          code: "CHROMIUM_BINARY_MISSING",
        },
        { status: 503 }
      );
    }

    browser = await puppeteer.launch({
      executablePath: launchConfig.executablePath,
      headless: launchConfig.headless,
      args: launchConfig.args,
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(inlinedHtml, { waitUntil: ["domcontentloaded", "load"], timeout: 25000 });

    if (fileName) {
      await page.evaluate((title: string) => {
        document.title = title;
      }, fileName);
    }

    // Ensure all images are loaded completely before PDF capture
    await page.evaluate(async () => {
      const imgs = Array.from(document.querySelectorAll("img"));
      await Promise.all(
        imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            setTimeout(() => resolve(false), 2000);
          });
        })
      );
    });

    await page.evaluateHandle("document.fonts.ready");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName || "document.pdf"}"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error("Chromium PDF export failed:", error);
    return NextResponse.json({ error: error?.message || "PDF generation error" }, { status: 500 });
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.warn("Browser cleanup warning:", closeErr);
      }
    }
  }
}
