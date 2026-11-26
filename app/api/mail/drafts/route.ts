import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { sanitizeEmailHtml } from "@/lib/email-sanitizer";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.compose" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = body.id ? String(body.id).trim() : "draft_" + Date.now();
    const quotationNo = body.quotation_no ? String(body.quotation_no).trim() : null;
    const documentType = body.document_type ? String(body.document_type).trim() : "General";
    const toEmails = String(body.to_emails || "").trim();
    const ccEmails = String(body.cc_emails || "").trim();
    const bccEmails = String(body.bcc_emails || "").trim();
    const subject = String(body.subject || "").trim().slice(0, 300);
    const bodyHtml = sanitizeEmailHtml(String(body.body_html || ""));
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    await query(
      `INSERT INTO email_drafts (
         id, quotation_no, document_type, to_emails, cc_emails, bcc_emails,
         subject, body_html, attachments, updated_by, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET
         quotation_no = EXCLUDED.quotation_no,
         document_type = EXCLUDED.document_type,
         to_emails = EXCLUDED.to_emails,
         cc_emails = EXCLUDED.cc_emails,
         bcc_emails = EXCLUDED.bcc_emails,
         subject = EXCLUDED.subject,
         body_html = EXCLUDED.body_html,
         attachments = EXCLUDED.attachments,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        quotationNo,
        documentType,
        toEmails,
        ccEmails,
        bccEmails,
        subject,
        bodyHtml,
        JSON.stringify(attachments),
        auth.user.email,
      ]
    );

    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error("Failed to save email draft:", err);
    return NextResponse.json({ error: "Failed to save email draft." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.compose" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Draft id is required" }, { status: 400 });
  }

  try {
    await query(`DELETE FROM email_drafts WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete email draft." }, { status: 500 });
  }
}
