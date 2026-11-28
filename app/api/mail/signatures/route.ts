import { NextRequest, NextResponse } from "next/server";
import { initDb, query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { sanitizeEmailHtml } from "@/lib/email-sanitizer";

const DEFAULT_AVEN_LOGO =
  (process.env.NEXT_PUBLIC_APP_URL || "https://erp.avenautomation.in").replace(/\/$/, "") + "/assets/logo.png";

const DEFAULT_SIGNATURE_HTML = `<div data-aven-sig="true" style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt; line-height: 1.5; color: #1f2937;">
  <p style="margin: 0 0 4px 0;">Regards,</p>
  <p style="margin: 0 0 6px 0;"><strong>Aven Industrial Automation</strong></p>
  <p style="margin: 0 0 2px 0;">Phone: +91 8766918892</p>
  <p style="margin: 0 0 2px 0;">Email: <a href="mailto:{{email}}" style="color: #1d4ed8; text-decoration: none;">{{email}}</a></p>
  <p style="margin: 0 0 8px 0;">Website: <a href="https://avenautomation.in" style="color: #1d4ed8; text-decoration: none;">https://avenautomation.in</a></p>
  <img src="${DEFAULT_AVEN_LOGO}" alt="AVEN Industrial Automation" style="height: 46px; width: auto; display: block;" />
</div>`;

async function ensureDefaultSignatureSeeded() {
  try {
    const existing = await query("SELECT COUNT(*)::int AS cnt FROM email_signatures", []);
    if ((existing?.rows[0]?.cnt || 0) === 0) {
      await query(
        `INSERT INTO email_signatures (id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert)
         VALUES ($1, $2, NULL, $3, $4, 'Verdana', '10pt', true, true)
         ON CONFLICT (id) DO NOTHING`,
        ["sig_aven_default", "AVEN Official Signature", DEFAULT_SIGNATURE_HTML, DEFAULT_AVEN_LOGO]
      );
    }
  } catch (e) {
    console.warn("Could not seed default email signature:", e);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  await initDb();
  await ensureDefaultSignatureSeeded();
  try {
    const isAdmin = normalizeRole(auth.user.role) === "Admin";
    const res = await query(
      `SELECT id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert,
              mailbox_id, assigned_mailbox_ids, assigned_roles, assigned_user_ids, template_key, config_json,
              locked_branding, is_disabled, updated_at
       FROM email_signatures
       WHERE ($2::boolean = true)
          OR user_email IS NULL
          OR LOWER(user_email) = LOWER($1)
       ORDER BY is_default DESC, name ASC`,
      [auth.user.email, isAdmin]
    ).catch(async () => {
      return query(
        `SELECT id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert, updated_at
         FROM email_signatures
         WHERE user_email IS NULL OR LOWER(user_email) = LOWER($1)
         ORDER BY is_default DESC, name ASC`,
        [auth.user.email]
      );
    });

    const empRes = await query(
      `SELECT u.name, u.email, u.role, e.designation, e.department, e.mobile
       FROM users u
       LEFT JOIN employees e ON e.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [auth.user.userId]
    ).catch(() => ({ rows: [] }));

    if (req.nextUrl.searchParams.get("withMeta") === "1") {
      return NextResponse.json({
        signatures: res?.rows || [],
        employeeProfile: empRes?.rows[0] || { name: auth.user.name, email: auth.user.email, role: auth.user.role },
      });
    }
    return NextResponse.json(res?.rows || []);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load signatures." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const isAdmin = normalizeRole(auth.user.role) === "Admin";
  const canManageSigs = isAdmin || hasPermission(auth.user, "mail.signatures");

  try {
    const body = await req.json();
    const id = body.id ? String(body.id).trim() : "sig_" + Date.now();
    const name = String(body.name || "").trim().slice(0, 120);
    const htmlContent = sanitizeEmailHtml(String(body.html_content || ""));
    const logoUrl = body.logo_url ? String(body.logo_url).trim() : null;
    const fontFamily = String(body.font_family || "Verdana").slice(0, 60);
    const fontSize = String(body.font_size || "10pt").slice(0, 20);
    const isDefault = Boolean(body.is_default);
    const autoInsert = body.auto_insert !== undefined ? Boolean(body.auto_insert) : true;
    const userEmail = isAdmin && !body.user_specific ? null : auth.user.email;

    if (!canManageSigs && !body.user_specific) {
      return NextResponse.json({ error: "Forbidden: Only Administrators can manage company-wide signatures." }, { status: 403 });
    }

    // Prevent non-Admin from modifying another user's or locked company signature
    const existingRes = await query(`SELECT user_email, locked_branding FROM email_signatures WHERE id = $1 LIMIT 1`, [id]).catch(() => ({ rows: [] }));
    const existing = existingRes?.rows[0];
    if (existing && !isAdmin) {
      if (existing.locked_branding) {
        return NextResponse.json({ error: "Forbidden: Official company branding is locked by Administrator." }, { status: 403 });
      }
      if (!existing.user_email || existing.user_email.toLowerCase() !== auth.user.email.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden: You can only modify your own personal signature." }, { status: 403 });
      }
    }

    if (!name || !htmlContent) {
      return NextResponse.json({ error: "Signature name and HTML content are required." }, { status: 400 });
    }

    if (isDefault && isAdmin) {
      await query(`UPDATE email_signatures SET is_default = false`, []);
    }

    const assignedMailboxes = Array.isArray(body.assigned_mailbox_ids) ? body.assigned_mailbox_ids : [];
    const assignedRoles = Array.isArray(body.assigned_roles) ? body.assigned_roles : [];
    const assignedUsers = Array.isArray(body.assigned_user_ids) ? body.assigned_user_ids : [];
    const mailboxId = body.mailbox_id ? String(body.mailbox_id) : null;
    const templateKey = String(body.template_key || "classic_corporate").slice(0, 60);
    const configJson = body.config_json && typeof body.config_json === "object" ? body.config_json : {};
    const lockedBranding = isAdmin ? Boolean(body.locked_branding) : false;
    const isDisabled = isAdmin ? Boolean(body.is_disabled) : false;

    await query(
      `INSERT INTO email_signatures (
         id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert,
         mailbox_id, assigned_mailbox_ids, assigned_roles, assigned_user_ids, template_key, config_json, locked_branding, is_disabled, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         html_content = EXCLUDED.html_content,
         logo_url = EXCLUDED.logo_url,
         font_family = EXCLUDED.font_family,
         font_size = EXCLUDED.font_size,
         is_default = EXCLUDED.is_default,
         auto_insert = EXCLUDED.auto_insert,
         mailbox_id = EXCLUDED.mailbox_id,
         assigned_mailbox_ids = EXCLUDED.assigned_mailbox_ids,
         assigned_roles = EXCLUDED.assigned_roles,
         assigned_user_ids = EXCLUDED.assigned_user_ids,
         template_key = EXCLUDED.template_key,
         config_json = EXCLUDED.config_json,
         locked_branding = EXCLUDED.locked_branding,
         is_disabled = EXCLUDED.is_disabled,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id, name, userEmail, htmlContent, logoUrl, fontFamily, fontSize, isDefault, autoInsert,
        mailboxId, JSON.stringify(assignedMailboxes), JSON.stringify(assignedRoles), JSON.stringify(assignedUsers),
        templateKey, JSON.stringify(configJson), lockedBranding, isDisabled,
      ]
    ).catch(async () => {
      await query(
        `INSERT INTO email_signatures (id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, html_content = EXCLUDED.html_content, logo_url = EXCLUDED.logo_url,
           font_family = EXCLUDED.font_family, font_size = EXCLUDED.font_size, is_default = EXCLUDED.is_default,
           auto_insert = EXCLUDED.auto_insert, updated_at = CURRENT_TIMESTAMP`,
        [id, name, userEmail, htmlContent, logoUrl, fontFamily, fontSize, isDefault, autoInsert]
      );
    });

    await logAudit(auth.user.userId, "EMAIL_SIGNATURE_SAVED", { name, id, mailboxId }, {
      actorName: auth.user.name,
      module: "mail",
      recordRef: id,
      outcome: "SUCCESS",
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Signature save failed:", err);
    return NextResponse.json({ error: "Failed to save signature." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Signature id is required." }, { status: 400 });
  if (id === "sig_aven_default") {
    return NextResponse.json({ error: "Default AVEN signature cannot be deleted (you can edit it)." }, { status: 400 });
  }

  const isAdmin = normalizeRole(auth.user.role) === "Admin";
  try {
    const existingRes = await query(`SELECT user_email FROM email_signatures WHERE id = $1 LIMIT 1`, [id]);
    const existing = existingRes?.rows[0];
    if (!existing) return NextResponse.json({ error: "Signature not found." }, { status: 404 });
    if (!isAdmin && (!existing.user_email || existing.user_email.toLowerCase() !== auth.user.email.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden: You can only delete your own personal signature." }, { status: 403 });
    }
    await query(`DELETE FROM email_signatures WHERE id = $1`, [id]);
    await logAudit(auth.user.userId, "EMAIL_SIGNATURE_DELETED", { id }, {
      actorName: auth.user.name,
      module: "mail",
      recordRef: id,
      outcome: "SUCCESS",
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete signature." }, { status: 500 });
  }
}
