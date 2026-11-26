import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import { authenticateRequest } from "@/lib/auth";
import { isProduction } from "@/lib/db";

// Configure Cloudinary from server-side environment variables only (never hardcode secrets)
const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
const apiKey = process.env.CLOUDINARY_API_KEY || "";
const apiSecret = process.env.CLOUDINARY_API_SECRET || "";
const targetFolder = process.env.CLOUDINARY_FOLDER || "new_erp";

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Validate MIME type
    const validMimes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file format: ${file.type}. Allowed formats: PNG, JPG, JPEG, WEBP, SVG.` },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 10MB size limit. Please upload an optimized technical drawing." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64DataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;

    // Generate clean safe filename
    const ext = path.extname(file.name) || (file.type === "image/png" ? ".png" : ".jpg");
    const safeBaseName = path
      .basename(file.name, ext)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_");
    const fileName = `${Date.now()}_${safeBaseName}${ext}`;

    // 1. Cloudinary upload under folder 'new_erp'
    if (cloudName && apiKey && apiSecret) {
      try {
        const uploadResult = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: targetFolder,
              resource_type: "image",
              public_id: `${Date.now()}_${safeBaseName}`,
            },
            (err, result) => {
              if (err || !result) reject(err);
              else resolve(result as any);
            }
          );
          uploadStream.end(buffer);
        });

        // In development only, save local copy for offline caching
        if (!isProduction) {
          const uploadDir = path.join(process.cwd(), "public", "assets", "uploads");
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const filePath = path.join(uploadDir, fileName);
          fs.writeFileSync(filePath, buffer);
        }

        return NextResponse.json({
          url: uploadResult.secure_url,
          dataUrl: base64DataUrl,
          fileName,
          size: file.size,
          mime: file.type,
          storage: "cloudinary",
          publicId: uploadResult.public_id,
        });
      } catch (cloudErr) {
        console.error("Cloudinary upload failed:", cloudErr);
        if (isProduction) {
          return NextResponse.json(
            { error: "Cloud asset upload failed. Please try again." },
            { status: 503 }
          );
        }
      }
    } else if (isProduction) {
      return NextResponse.json(
        { error: "Asset storage service is not configured on the server." },
        { status: 503 }
      );
    }

    // 2. If Cloudflare R2 / S3 is configured, upload to bucket
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY) {
      // Return public R2 URL if public bucket configured
      const publicBase = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
      if (publicBase) {
        return NextResponse.json({
          url: `${publicBase}/uploads/${fileName}`,
          fileName,
          size: file.size,
          mime: file.type,
          storage: "r2",
        });
      }
    }

    // 2. Local filesystem storage (public/assets/uploads/)
    const uploadDir = path.join(process.cwd(), "public", "assets", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      url: `/assets/uploads/${fileName}`,
      dataUrl: base64DataUrl,
      fileName,
      size: file.size,
      mime: file.type,
      storage: "local",
    });
  } catch (err: any) {
    console.error("Upload handler failed:", err);
    return NextResponse.json({ error: err?.message || "File upload failed" }, { status: 500 });
  }
}
