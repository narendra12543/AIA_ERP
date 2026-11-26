import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { sanitizeEmailHtml } from "@/lib/email-sanitizer";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.templates" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = body.id ? String(body.id).trim() : "tpl_" + Date.now();
    const name = String(body.name || "").trim().slice(0, 120);
    const category = String(body.category || "General").trim().slice(0, 60);
    const subjectTemplate = String(body.subject_template || "").trim().slice(0, 300);
    const bodyHtml = sanitizeEmailHtml(String(body.body_html || ""));

    if (!name || !subjectTemplate || !bodyHtml) {
      return NextResponse.json(
        { error: "Template name, subject, and body are required." },
        { status: 400 }
      );
    }

    await query(
      `INSERT INTO email_templates (
         id, name, category, subject_template, body_html, is_default, created_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,false,$6,CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         category = EXCLUDED.category,
         subject_template = EXCLUDED.subject_template,
         body_html = EXCLUDED.body_html,
         updated_at = CURRENT_TIMESTAMP`,
      [id, name, category, subjectTemplate, bodyHtml, auth.user.email]
    );

    await logAudit(
      "EMAIL_TEMPLATE_SAVED",
      auth.user.email,
      `Saved template ${name} (${category})`,
      { actorName: auth.user.name, module: "mail", recordRef: id, outcome: "success" }
    );
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Failed to save email template:", err);
    return NextResponse.json({ error: "Failed to save email template." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.templates" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  try {
    const check = await query(`SELECT is_default FROM email_templates WHERE id = $1`, [id]);
    if (check?.rows[0]?.is_default) {
      return NextResponse.json(
        { error: "Built-in default templates can be edited but not deleted." },
        { status: 400 }
      );
    }
    await query(`DELETE FROM email_templates WHERE id = $1`, [id]);
    await logAudit(
      "EMAIL_TEMPLATE_DELETED",
      auth.user.email,
      `Deleted template ${id}`,
      { actorName: auth.user.name, module: "mail", recordRef: id, outcome: "success" }
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete email template." }, { status: 500 });
  }
}
