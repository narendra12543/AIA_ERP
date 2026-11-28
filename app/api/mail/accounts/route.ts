import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { decryptSecret } from "@/lib/crypto";
import { getAuthorizedMailboxes } from "@/lib/mail-auth";
import {
  discoverZohoAccounts,
  getValidMailboxAccessToken,
  getZohoConfig,
  revokeZohoRefreshToken,
} from "@/lib/zoho-mail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const mailboxes = await getAuthorizedMailboxes(auth.user);
    const isAdmin =
      normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "mail.manage_accounts");

    let permissionsMatrix: any[] = [];
    let zohoConfig: { configured: boolean; redirectUri: string; accountsBase: string; mailBase: string } | null = null;

    if (isAdmin) {
      const cfg = getZohoConfig();
      zohoConfig = {
        configured: cfg.configured,
        redirectUri: cfg.redirectUri,
        accountsBase: cfg.accountsBase,
        mailBase: cfg.mailBase,
      };
      const permRes = await query(
        `SELECT id, mailbox_id, subject_type, subject_value,
                can_read, can_compose, can_send, can_reply_forward,
                can_download_attachments, can_manage_folders, can_archive, can_trash, can_manage_labels,
                assigned_by, updated_at
         FROM mail_account_permissions
         ORDER BY mailbox_id ASC, subject_type ASC, subject_value ASC`,
        []
      ).catch(() => ({ rows: [] }));
      permissionsMatrix = permRes?.rows || [];
    }

    return NextResponse.json({
      mailboxes,
      isAdmin,
      permissions: permissionsMatrix,
      zohoConfig,
    });
  } catch (err: any) {
    console.error("Failed to fetch mail accounts:", err);
    return NextResponse.json({ error: "Failed to load mail accounts." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const canManage =
    normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "mail.manage_accounts");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Admin mailbox management required." }, { status: 403 });
  }

  try {
    await initDb();
    const body = await req.json();
    const action = String(body.action || "upsert").toLowerCase();

    if (action === "verify") {
      const mailboxId = String(body.mailboxId || "").trim();
      const ctx = await getValidMailboxAccessToken(mailboxId);
      const discovered = await discoverZohoAccounts(ctx.accessToken, ctx.mailBaseUrl);
      await query(`UPDATE mail_accounts SET last_sync_at = NOW(), last_error = NULL WHERE id = $1`, [mailboxId]);
      return NextResponse.json({ verified: true, accountCount: discovered.length, email: ctx.emailAddress });
    }

    if (action === "disconnect") {
      const mailboxId = String(body.mailboxId || "").trim();
      const mbxRes = await query(
        `SELECT id, email_address, encrypted_refresh_token, accounts_base_url FROM mail_accounts WHERE id = $1 LIMIT 1`,
        [mailboxId]
      );
      const mbx = mbxRes?.rows[0];
      if (!mbx) return NextResponse.json({ error: "Mailbox not found." }, { status: 404 });

      const refresh = decryptSecret(mbx.encrypted_refresh_token);
      if (refresh) {
        await revokeZohoRefreshToken(refresh, mbx.accounts_base_url);
      }

      await query(
        `UPDATE mail_accounts
         SET encrypted_refresh_token = NULL,
             encrypted_access_token = NULL,
             access_token_expires_at = NULL,
             connection_status = 'Not Connected',
             last_error = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [mailboxId]
      );

      await logAudit(
        auth.user.userId,
        "MAILBOX_DISCONNECTED",
        { mailboxId, email: mbx.email_address },
        { actorName: auth.user.name, module: "mail", recordRef: mbx.email_address, outcome: "SUCCESS" }
      );
      return NextResponse.json({ success: true });
    }

    // Add or update mailbox configuration
    const email = String(body.email_address || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      return NextResponse.json({ error: "Valid email address is required." }, { status: 400 });
    }
    const id = String(body.id || "").trim() || `mbx_${Date.now()}`;
    const displayName = String(body.display_name || "Aven Industrial Automation").trim().slice(0, 120);
    const isEnabled = body.is_enabled !== undefined ? Boolean(body.is_enabled) : true;
    const isDefault = Boolean(body.is_default);

    if (isDefault) {
      await query(`UPDATE mail_accounts SET is_default = false`, []);
    }

    await query(
      `INSERT INTO mail_accounts (id, email_address, display_name, is_enabled, is_default, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email_address) DO UPDATE SET
         display_name = EXCLUDED.display_name,
         is_enabled = EXCLUDED.is_enabled,
         is_default = EXCLUDED.is_default,
         updated_at = NOW()`,
      [id, email, displayName, isEnabled, isDefault, auth.user.email]
    );

    await logAudit(
      auth.user.userId,
      "MAILBOX_SAVED",
      { id, email, displayName, isEnabled, isDefault },
      { actorName: auth.user.name, module: "mail", recordRef: email, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Mail account action error:", err);
    return NextResponse.json({ error: err?.message || "Failed to update mail account." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const canManage =
    normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "mail.manage_accounts");
  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Admin mailbox permission management required." }, { status: 403 });
  }

  try {
    await initDb();
    const body = await req.json();
    const mailboxId = String(body.mailbox_id || "").trim();
    const subjectType = body.subject_type === "user" ? "user" : "role";
    const subjectValue = String(body.subject_value || "").trim();
    if (!mailboxId || !subjectValue) {
      return NextResponse.json({ error: "mailbox_id and subject_value are required." }, { status: 400 });
    }

    if (body.revoke === true) {
      await query(
        `DELETE FROM mail_account_permissions WHERE mailbox_id = $1 AND subject_type = $2 AND LOWER(subject_value) = LOWER($3)`,
        [mailboxId, subjectType, subjectValue]
      );
      await logAudit(
        auth.user.userId,
        "MAILBOX_PERMISSION_REVOKED",
        { mailboxId, subjectType, subjectValue },
        { actorName: auth.user.name, module: "mail", recordRef: mailboxId, outcome: "SUCCESS" }
      );
      return NextResponse.json({ success: true });
    }

    const permId = `mbxp_${mailboxId}_${subjectType}_${subjectValue.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    await query(
      `INSERT INTO mail_account_permissions (
         id, mailbox_id, subject_type, subject_value,
         can_read, can_compose, can_send, can_reply_forward, can_download_attachments,
         can_manage_folders, can_archive, can_trash, can_manage_labels, assigned_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (mailbox_id, subject_type, subject_value) DO UPDATE SET
         can_read = EXCLUDED.can_read,
         can_compose = EXCLUDED.can_compose,
         can_send = EXCLUDED.can_send,
         can_reply_forward = EXCLUDED.can_reply_forward,
         can_download_attachments = EXCLUDED.can_download_attachments,
         can_manage_folders = EXCLUDED.can_manage_folders,
         can_archive = EXCLUDED.can_archive,
         can_trash = EXCLUDED.can_trash,
         can_manage_labels = EXCLUDED.can_manage_labels,
         assigned_by = EXCLUDED.assigned_by,
         updated_at = NOW()`,
      [
        permId,
        mailboxId,
        subjectType,
        subjectValue,
        body.can_read !== false,
        body.can_compose !== false,
        body.can_send !== false,
        body.can_reply_forward !== false,
        body.can_download_attachments !== false,
        Boolean(body.can_manage_folders),
        body.can_archive !== false,
        Boolean(body.can_trash),
        Boolean(body.can_manage_labels),
        auth.user.email,
      ]
    );

    await logAudit(
      auth.user.userId,
      "MAILBOX_PERMISSION_ASSIGNED",
      { mailboxId, subjectType, subjectValue },
      { actorName: auth.user.name, module: "mail", recordRef: mailboxId, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to update mailbox permissions:", err);
    return NextResponse.json({ error: "Failed to update mailbox permissions." }, { status: 500 });
  }
}
