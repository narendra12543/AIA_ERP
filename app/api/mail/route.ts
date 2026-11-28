import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
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
    const isAdmin = normalizeRole(auth.user.role) === "Admin";
    const [historyRes, draftsRes, templatesRes] = await Promise.all([
      query(
        isAdmin
          ? `SELECT id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails,
                    subject, body_html, attachments, status, error_message, provider_message_id,
                    sent_by, sent_at
             FROM email_history
             ORDER BY sent_at DESC
             LIMIT 100`
          : `SELECT id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails,
                    subject, body_html, attachments, status, error_message, provider_message_id,
                    sent_by, sent_at
             FROM email_history
             WHERE LOWER(sent_by) = LOWER($1)
             ORDER BY sent_at DESC
             LIMIT 100`,
        isAdmin ? [] : [auth.user.email]
      ),
      query(
        isAdmin
          ? `SELECT id, quotation_no, document_type, to_emails, cc_emails, bcc_emails,
                    subject, body_html, attachments, updated_by, updated_at
             FROM email_drafts
             ORDER BY updated_at DESC
             LIMIT 50`
          : `SELECT id, quotation_no, document_type, to_emails, cc_emails, bcc_emails,
                    subject, body_html, attachments, updated_by, updated_at
             FROM email_drafts
             WHERE LOWER(updated_by) = LOWER($1)
             ORDER BY updated_at DESC
             LIMIT 50`,
        isAdmin ? [] : [auth.user.email]
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
        lastTestResult: zoho.lastTestResult || null,
        lastTestAt: zoho.lastTestAt || null,
        lastTestError: zoho.lastTestError || null,
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

  await logAudit(
    "LEGACY_MAIL_POST_BLOCKED",
    auth.user.email,
    `Blocked direct POST /api/mail by role=${auth.user.role}`,
    { actorName: auth.user.name, module: "mail", recordRef: "/api/mail", outcome: "denied" }
  );

  return NextResponse.json(
    {
      error: "Legacy SMTP sending endpoint (/api/mail) is disabled. Use the unified Zoho Mail Workspace (/api/mail/messages).",
      code: "LEGACY_SMTP_DISABLED",
    },
    { status: 410 }
  );
}
