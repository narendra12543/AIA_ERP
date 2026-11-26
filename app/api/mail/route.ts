import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import {
  DEFAULT_EMAIL_TEMPLATES,
  parseEmailList,
  sanitizeEmailHtml,
  stripHtmlToText,
} from "@/lib/email-sanitizer";
import { getEffectiveAiConfig, getEffectiveSmtpConfig } from "@/lib/settings-store";
import { isPrivateOrBlockedSmtpHost, resolveAndValidateSmtpHost } from "@/lib/crypto";

const MAX_TOTAL_ATTACHMENT_BYTES = 12 * 1024 * 1024; // 12 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

async function ensureDefaultTemplatesSeeded() {
  try {
    const existing = await query("SELECT COUNT(*)::int AS cnt FROM email_templates", []);
    if ((existing?.rows[0]?.cnt || 0) === 0) {
      for (const tpl of DEFAULT_EMAIL_TEMPLATES) {
        await query(
          `INSERT INTO email_templates (id, name, category, subject_template, body_html, is_default, created_by)
           VALUES ($1, $2, $3, $4, $5, true, 'system')
           ON CONFLICT (id) DO NOTHING`,
          [tpl.id, tpl.name, tpl.category, tpl.subject_template, tpl.body_html]
        );
      }
    }
  } catch (e) {
    console.warn("Could not seed default email templates:", e);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const [zoho, aiCfg] = await Promise.all([getEffectiveSmtpConfig(), getEffectiveAiConfig()]);
  await ensureDefaultTemplatesSeeded();

  try {
    const [historyRes, draftsRes, templatesRes] = await Promise.all([
      query(
        `SELECT id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails,
                subject, body_html, attachments, status, error_message, provider_message_id,
                sent_by, sent_at
         FROM email_history
         ORDER BY sent_at DESC
         LIMIT 100`,
        []
      ),
      query(
        `SELECT id, quotation_no, document_type, to_emails, cc_emails, bcc_emails,
                subject, body_html, attachments, updated_by, updated_at
         FROM email_drafts
         ORDER BY updated_at DESC
         LIMIT 50`,
        []
      ),
      query(
        `SELECT id, name, category, subject_template, body_html, is_default, updated_at
         FROM email_templates
         ORDER BY is_default DESC, name ASC`,
        []
      ),
    ]);

    return NextResponse.json({
      zoho: {
        configured: Boolean(zoho.enabled && zoho.senderEmail && zoho.password && zoho.host),
        enabled: zoho.enabled,
        provider: zoho.provider,
        host: zoho.host,
        port: zoho.port,
        senderEmail: zoho.senderEmail || null,
        fromName: zoho.displayName,
        defaultCc: zoho.defaultCc || null,
        defaultBcc: zoho.defaultBcc || null,
        signatureHtml: zoho.signatureHtml || null,
        source: zoho.source,
        oauthConfigured: Boolean(process.env.ZOHO_OAUTH_CLIENT_ID && process.env.ZOHO_OAUTH_CLIENT_SECRET),
      },
      aiEnabled: aiCfg.enabled,
      history: historyRes?.rows || [],
      drafts: draftsRes?.rows || [],
      templates: templatesRes?.rows || [],
    });
  } catch (err: any) {
    console.error("Failed to fetch Mail Center data:", err);
    return NextResponse.json({ error: "Failed to load Mail Center data." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.send" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const toList = parseEmailList(body.to);
    const ccList = parseEmailList(body.cc);
    const bccList = parseEmailList(body.bcc);
    const subject = String(body.subject || "").trim().slice(0, 300);
    const rawHtml = String(body.body_html || "");
    const safeHtml = sanitizeEmailHtml(rawHtml);
    const plainText = stripHtmlToText(safeHtml);
    const quotationNo = body.quotation_no ? String(body.quotation_no).trim() : null;
    const documentType = body.document_type ? String(body.document_type).trim() : "General";
    const draftId = body.draft_id ? String(body.draft_id).trim() : null;

    if (toList.length === 0) {
      return NextResponse.json({ error: "At least one valid 'To' email address is required." }, { status: 400 });
    }
    if (!subject) {
      return NextResponse.json({ error: "Email subject is required." }, { status: 400 });
    }
    if (!plainText && !safeHtml) {
      return NextResponse.json({ error: "Email body cannot be empty." }, { status: 400 });
    }

    // Validate attachments
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const mailAttachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    const attachmentMeta: Array<{ filename: string; contentType: string; sizeBytes: number }> = [];
    let totalBytes = 0;

    for (const att of rawAttachments) {
      const filename = String(att?.filename || "document.pdf").replace(/[^\w.\- ()]/g, "_");
      const contentType = String(att?.contentType || "application/pdf").toLowerCase();
      const base64 = String(att?.base64 || "");
      if (!ALLOWED_MIME_TYPES.has(contentType)) {
        return NextResponse.json(
          { error: `Unsupported attachment type: ${contentType}` },
          { status: 400 }
        );
      }
      if (!base64) continue;
      const buf = Buffer.from(base64, "base64");
      totalBytes += buf.byteLength;
      if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
        return NextResponse.json(
          { error: "Total attachment size exceeds the 12 MB limit." },
          { status: 400 }
        );
      }
      mailAttachments.push({ filename, content: buf, contentType });
      attachmentMeta.push({ filename, contentType, sizeBytes: buf.byteLength });
    }

    // Prevent accidental duplicate send within 15 seconds
    const dupCheck = await query(
      `SELECT id FROM email_history
       WHERE sent_by = $1 AND subject = $2 AND to_emails = $3
         AND status = 'sent'
         AND sent_at > NOW() - INTERVAL '15 seconds'
       LIMIT 1`,
      [auth.user.email, subject, toList.join(", ")]
    );
    if (dupCheck && dupCheck.rows.length > 0) {
      return NextResponse.json(
        { error: "Duplicate send prevented: this exact email was just sent seconds ago." },
        { status: 409 }
      );
    }

    const zoho = await getEffectiveSmtpConfig();
    if (!zoho.enabled) {
      return NextResponse.json(
        { error: "Email integration is disabled by the Administrator.", code: "EMAIL_DISABLED" },
        { status: 403 }
      );
    }
    if (!zoho.senderEmail || !zoho.password || !zoho.host) {
      return NextResponse.json(
        {
          error:
            "SMTP is not configured. Configure it in Settings → Email & SMTP Configuration or set ZOHO_EMAIL and ZOHO_APP_PASSWORD.",
          code: "ZOHO_NOT_CONFIGURED",
        },
        { status: 503 }
      );
    }
    const hostCheck = await resolveAndValidateSmtpHost(zoho.host);
    if (!hostCheck.safe) {
      return NextResponse.json({ error: hostCheck.reason || "Blocked SMTP host configuration." }, { status: 400 });
    }

    const effectiveCc = ccList.length > 0 ? ccList : parseEmailList(zoho.defaultCc);
    const effectiveBcc = bccList.length > 0 ? bccList : parseEmailList(zoho.defaultBcc);

    const historyId = "mail_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);

    const transporter = nodemailer.createTransport({
      host: zoho.host,
      port: zoho.port,
      secure: zoho.encryption === "SSL" || zoho.port === 465,
      requireTLS: zoho.encryption === "TLS" || zoho.encryption === "STARTTLS",
      auth: {
        user: zoho.username || zoho.senderEmail,
        pass: zoho.password,
      },
      connectionTimeout: 12000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });

    try {
      const info = await transporter.sendMail({
        from: `"${zoho.displayName}" <${zoho.senderEmail}>`,
        replyTo: zoho.replyTo || zoho.senderEmail,
        to: toList.join(", "),
        cc: effectiveCc.length > 0 ? effectiveCc.join(", ") : undefined,
        bcc: effectiveBcc.length > 0 ? effectiveBcc.join(", ") : undefined,
        subject,
        text: plainText,
        html: safeHtml,
        attachments: mailAttachments,
      });

      await query(
        `INSERT INTO email_history (
           id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails,
           subject, body_html, attachments, status, provider_message_id, sent_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'sent',$11,$12)`,
        [
          historyId,
          quotationNo,
          documentType,
          zoho.senderEmail,
          toList.join(", "),
          effectiveCc.join(", "),
          effectiveBcc.join(", "),
          subject,
          safeHtml,
          JSON.stringify(attachmentMeta),
          info.messageId || null,
          auth.user.email,
        ]
      );

      if (draftId) {
        await query(`DELETE FROM email_drafts WHERE id = $1`, [draftId]);
      }

      await logAudit(
        "EMAIL_SENT",
        auth.user.email,
        `Sent ${documentType} to ${toList.join(", ")} (${attachmentMeta.length} attachments)`,
        { actorName: auth.user.name, module: "mail", recordRef: quotationNo || historyId, outcome: "success" }
      );

      return NextResponse.json({
        success: true,
        id: historyId,
        messageId: info.messageId,
      });
    } catch (smtpErr: any) {
      const safeErr = String(smtpErr?.message || "SMTP delivery failed").slice(0, 300);
      await query(
        `INSERT INTO email_history (
           id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails,
           subject, body_html, attachments, status, error_message, sent_by
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'failed',$11,$12)`,
        [
          historyId,
          quotationNo,
          documentType,
          zoho.senderEmail,
          toList.join(", "),
          ccList.join(", "),
          bccList.join(", "),
          subject,
          safeHtml,
          JSON.stringify(attachmentMeta),
          safeErr,
          auth.user.email,
        ]
      );

      await logAudit(
        "EMAIL_SEND_FAILED",
        auth.user.email,
        `Failed to ${toList.join(", ")}: ${safeErr}`,
        { actorName: auth.user.name, module: "mail", recordRef: quotationNo || historyId, outcome: "failed" }
      );

      return NextResponse.json(
        { error: `Zoho SMTP delivery failed: ${safeErr}` },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("Mail send error:", err);
    return NextResponse.json({ error: "Failed to process email send request." }, { status: 500 });
  }
}
