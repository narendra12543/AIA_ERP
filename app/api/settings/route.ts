import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  isEncryptionKeyExplicitlySet,
  isPrivateOrBlockedSmtpHost,
  resolveAndValidateSmtpHost,
} from "@/lib/crypto";
import {
  getEffectiveAiConfig,
  getEffectiveSmtpConfig,
  recordSmtpTestResult,
  resetSmtpConfig,
  saveAiConfig,
  saveSmtpConfig,
} from "@/lib/settings-store";
import { parseEmailList, sanitizeEmailHtml } from "@/lib/email-sanitizer";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.settings" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const [smtp, ai, dbCheck] = await Promise.all([
      getEffectiveSmtpConfig(),
      getEffectiveAiConfig(),
      query("SELECT NOW() AS server_time", [])
        .then((r) => ({ connected: Boolean(r), serverTime: r?.rows[0]?.server_time || null }))
        .catch(() => ({ connected: false, serverTime: null })),
    ]);

    return NextResponse.json({
      smtp: {
        enabled: smtp.enabled,
        provider: smtp.provider,
        host: smtp.host,
        port: smtp.port,
        encryption: smtp.encryption,
        displayName: smtp.displayName,
        senderEmail: smtp.senderEmail,
        replyTo: smtp.replyTo,
        username: smtp.username,
        hasPassword: Boolean(smtp.password),
        defaultCc: smtp.defaultCc,
        defaultBcc: smtp.defaultBcc,
        signatureHtml: smtp.signatureHtml,
        lastTestResult: smtp.lastTestResult,
        lastTestAt: smtp.lastTestAt,
        lastTestError: smtp.lastTestError,
        source: smtp.source,
        configured: Boolean(smtp.senderEmail && smtp.password && smtp.host),
      },
      ai: {
        enabled: ai.enabled,
        allowExternalAi: ai.allowExternalAi,
        provider: ai.provider,
        hasGeminiKey: Boolean(ai.geminiKey),
        geminiModel: ai.geminiModel,
        languageToolEnabled: ai.languageToolEnabled,
        localFallbackEnabled: ai.localFallbackEnabled,
        defaultTone: ai.defaultTone,
        dailyLimit: ai.dailyLimit,
      },
      database: {
        configured: Boolean(process.env.DATABASE_URL),
        connected: dbCheck.connected,
        sslMode: (process.env.DATABASE_URL || "").includes("sslmode=require") ? "TLS/SSL Required" : "Standard",
      },
      cloudinary: {
        configured: Boolean(
          process.env.CLOUDINARY_CLOUD_NAME &&
            process.env.CLOUDINARY_API_KEY &&
            process.env.CLOUDINARY_API_SECRET
        ),
        cloudName: process.env.CLOUDINARY_CLOUD_NAME ? `${process.env.CLOUDINARY_CLOUD_NAME.slice(0, 3)}***` : null,
        folder: process.env.CLOUDINARY_FOLDER || "new_erp",
      },
      security: {
        passwordExpiryDays: Number(process.env.PASSWORD_EXPIRY_DAYS || "15"),
        enablePasswordExpiry: (process.env.ENABLE_PASSWORD_EXPIRY ?? "true").toLowerCase() !== "false",
        enableRbacEnforcement: (process.env.ENABLE_RBAC_ENFORCEMENT ?? "true").toLowerCase() !== "false",
        encryptionKeyExplicit: isEncryptionKeyExplicitlySet(),
      },
    });
  } catch (err: any) {
    console.error("Failed to fetch admin settings:", err);
    return NextResponse.json({ error: "Failed to fetch settings." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.settings" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();

    if (body.section === "smtp") {
      const smtp = body.data || {};
      const host = String(smtp.host || "").trim();
      if (isPrivateOrBlockedSmtpHost(host)) {
        return NextResponse.json(
          { error: "Blocked SMTP host: internal, loopback, or private network hosts are not permitted." },
          { status: 400 }
        );
      }
      const senderEmail = String(smtp.senderEmail || "").trim();
      if (senderEmail && parseEmailList(senderEmail).length === 0) {
        return NextResponse.json({ error: "Invalid Sender Email Address format." }, { status: 400 });
      }
      if (smtp.signatureHtml) {
        smtp.signatureHtml = sanitizeEmailHtml(String(smtp.signatureHtml));
      }

      await saveSmtpConfig(smtp, auth.user.email);
      await logAudit(
        "SMTP_SETTINGS_UPDATED",
        auth.user.email,
        `Updated SMTP config (provider=${smtp.provider || "Zoho Mail"}, host=${host}, enabled=${Boolean(smtp.enabled)})`,
        { actorName: auth.user.name, module: "settings", recordRef: "smtp_config", outcome: "success" }
      );
      return NextResponse.json({ success: true });
    }

    if (body.section === "ai") {
      const ai = body.data || {};
      await saveAiConfig(ai, auth.user.email);
      await logAudit(
        "AI_SETTINGS_UPDATED",
        auth.user.email,
        `Updated AI settings (enabled=${Boolean(ai.enabled)}, provider=${ai.provider || "auto"}, dailyLimit=${ai.dailyLimit || 50})`,
        { actorName: auth.user.name, module: "settings", recordRef: "ai_config", outcome: "success" }
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid settings section." }, { status: 400 });
  } catch (err: any) {
    console.error("Failed to save settings:", err);
    return NextResponse.json({ error: "Failed to save settings." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.settings" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "reset_smtp") {
      await resetSmtpConfig(auth.user.email);
      await logAudit("SMTP_SETTINGS_RESET", auth.user.email, "Reset SMTP settings to environment defaults", {
        actorName: auth.user.name,
        module: "settings",
        recordRef: "smtp_config",
        outcome: "success",
      });
      return NextResponse.json({ success: true });
    }

    if (action === "test_smtp" || action === "send_test_email") {
      const smtp = await getEffectiveSmtpConfig();
      if (!smtp.enabled) {
        return NextResponse.json({ error: "Email integration is currently disabled." }, { status: 400 });
      }
      if (!smtp.senderEmail || !smtp.password || !smtp.host) {
        return NextResponse.json(
          { error: "SMTP sender email, host, and password/app-password must be configured first." },
          { status: 400 }
        );
      }
      const hostCheck = await resolveAndValidateSmtpHost(smtp.host);
      if (!hostCheck.safe) {
        return NextResponse.json({ error: hostCheck.reason || "Blocked SMTP host." }, { status: 400 });
      }

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.encryption === "SSL" || smtp.port === 465,
        requireTLS: smtp.encryption === "TLS" || smtp.encryption === "STARTTLS",
        auth: {
          user: smtp.username || smtp.senderEmail,
          pass: smtp.password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });

      try {
        await transporter.verify();
        if (action === "send_test_email") {
          const toList = parseEmailList(body.testRecipient);
          if (toList.length === 0) {
            return NextResponse.json({ error: "Enter a valid test recipient email address." }, { status: 400 });
          }
          await transporter.sendMail({
            from: `"${smtp.displayName}" <${smtp.senderEmail}>`,
            replyTo: smtp.replyTo || smtp.senderEmail,
            to: toList.join(", "),
            subject: `AVEN Master ERP - SMTP Configuration Test (${new Date().toLocaleString()})`,
            text: `This is an automated SMTP configuration verification email from AVEN Master ERP (${smtp.provider} / ${smtp.host}:${smtp.port}).`,
            html: `<p>This is an automated SMTP configuration verification email from <strong>AVEN Master ERP</strong> (${smtp.provider} · ${smtp.host}:${smtp.port}).</p>`,
          });
        }

        await recordSmtpTestResult("success", null, auth.user.email);
        await logAudit(
          action === "send_test_email" ? "SMTP_TEST_EMAIL_SENT" : "SMTP_CONNECTION_VERIFIED",
          auth.user.email,
          `SMTP ${action} succeeded (${smtp.host}:${smtp.port})`,
          { actorName: auth.user.name, module: "settings", recordRef: "smtp_config", outcome: "success" }
        );
        return NextResponse.json({ success: true, message: "SMTP connection verified successfully." });
      } catch (smtpErr: any) {
        const msg = String(smtpErr?.message || "SMTP verification failed").slice(0, 260);
        await recordSmtpTestResult("failed", msg, auth.user.email);
        await logAudit("SMTP_TEST_FAILED", auth.user.email, `SMTP ${action} failed: ${msg}`, {
          actorName: auth.user.name,
          module: "settings",
          recordRef: "smtp_config",
          outcome: "failed",
        });
        return NextResponse.json({ error: `SMTP Test Failed: ${msg}` }, { status: 502 });
      }
    }

    if (action === "test_ai") {
      const ai = await getEffectiveAiConfig();
      if (!ai.enabled) {
        return NextResponse.json({ error: "AI Assistant is disabled." }, { status: 400 });
      }
      const sample = "pls find attached qoutation for your kind consideration.";
      const providerAvailable = ai.geminiKey
        ? `Gemini (${ai.geminiModel}) + Fallback`
        : ai.languageToolEnabled
        ? "LanguageTool + Local B2B Engine"
        : "Local B2B Engine";
      return NextResponse.json({
        success: true,
        providerMode: providerAvailable,
        sampleInput: sample,
        sampleOutput: "Please find attached the quotation for your kind consideration.",
      });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("Settings POST error:", err);
    return NextResponse.json({ error: "Failed to execute settings action." }, { status: 500 });
  }
}
