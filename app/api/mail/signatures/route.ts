import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { sanitizeEmailHtml } from "@/lib/email-sanitizer";

const DEFAULT_AVEN_LOGO =
  (process.env.NEXT_PUBLIC_APP_URL || "https://erp.avenautomation.in").replace(/\/$/, "") + "/assets/logo.png";

const DEFAULT_SIGNATURE_HTML = `<div style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt; line-height: 1.5; color: #1f2937;">
  <p style="margin: 0 0 4px 0;">Regards,</p>
  <p style="margin: 0 0 6px 0;"><strong>Aven Industrial Automation</strong></p>
  <p style="margin: 0 0 2px 0;">📞 +91 8766918892</p>
  <p style="margin: 0 0 2px 0;">📧 <a href="mailto:sales@avenautomation.in" style="color: #1d4ed8; text-decoration: none;">sales@avenautomation.in</a></p>
  <p style="margin: 0 0 8px 0;">🌐 <a href="https://avenautomation.in" style="color: #1d4ed8; text-decoration: none;">avenautomation.in</a></p>
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

  await ensureDefaultSignatureSeeded();
  try {
    const res = await query(
      `SELECT id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert, updated_at
       FROM email_signatures
       WHERE user_email IS NULL OR LOWER(user_email) = LOWER($1)
       ORDER BY is_default DESC, name ASC`,
      [auth.user.email]
    );
    return NextResponse.json(res?.rows || []);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load signatures." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.signatures" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

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
    const userEmail = body.user_specific ? auth.user.email : null;

    if (!name || !htmlContent) {
      return NextResponse.json({ error: "Signature name and HTML content are required." }, { status: 400 });
    }

    if (isDefault) {
      await query(`UPDATE email_signatures SET is_default = false`, []);
    }

    await query(
      `INSERT INTO email_signatures (id, name, user_email, html_content, logo_url, font_family, font_size, is_default, auto_insert, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         html_content = EXCLUDED.html_content,
         logo_url = EXCLUDED.logo_url,
         font_family = EXCLUDED.font_family,
         font_size = EXCLUDED.font_size,
         is_default = EXCLUDED.is_default,
         auto_insert = EXCLUDED.auto_insert,
         updated_at = CURRENT_TIMESTAMP`,
      [id, name, userEmail, htmlContent, logoUrl, fontFamily, fontSize, isDefault, autoInsert]
    );

    await logAudit("EMAIL_SIGNATURE_SAVED", auth.user.email, `Saved signature ${name}`, {
      actorName: auth.user.name,
      module: "mail",
      recordRef: id,
      outcome: "success",
    });

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Signature save failed:", err);
    return NextResponse.json({ error: "Failed to save signature." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.signatures" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Signature id is required." }, { status: 400 });
  if (id === "sig_aven_default") {
    return NextResponse.json({ error: "Default AVEN signature cannot be deleted (you can edit it)." }, { status: 400 });
  }

  try {
    await query(`DELETE FROM email_signatures WHERE id = $1`, [id]);
    await logAudit("EMAIL_SIGNATURE_DELETED", auth.user.email, `Deleted signature ${id}`, {
      actorName: auth.user.name,
      module: "mail",
      recordRef: id,
      outcome: "success",
    });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete signature." }, { status: 500 });
  }
}
