import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const mailboxId = String(req.nextUrl.searchParams.get("mailboxId") || "all").trim();

  try {
    await initDb();
    const res = await query(
      `SELECT mailbox_id, auto_new, auto_reply, auto_reply_all, auto_forward, default_signature_id
       FROM mail_signature_preferences
       WHERE user_id = $1 AND (mailbox_id = $2 OR mailbox_id = 'all')
       ORDER BY CASE WHEN mailbox_id = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [auth.user.userId, mailboxId]
    ).catch(() => ({ rows: [] }));

    return NextResponse.json(
      res?.rows[0] || {
        mailbox_id: mailboxId,
        auto_new: true,
        auto_reply: true,
        auto_reply_all: true,
        auto_forward: true,
        default_signature_id: null,
      }
    );
  } catch {
    return NextResponse.json({
      mailbox_id: mailboxId,
      auto_new: true,
      auto_reply: true,
      auto_reply_all: true,
      auto_forward: true,
      default_signature_id: null,
    });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const body = await req.json();
    const mailboxId = String(body.mailbox_id || "all").trim();
    const id = `sigpref_${auth.user.userId}_${mailboxId}`;

    await query(
      `INSERT INTO mail_signature_preferences (id, user_id, mailbox_id, auto_new, auto_reply, auto_reply_all, auto_forward, default_signature_id, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (user_id, mailbox_id) DO UPDATE SET
         auto_new = EXCLUDED.auto_new,
         auto_reply = EXCLUDED.auto_reply,
         auto_reply_all = EXCLUDED.auto_reply_all,
         auto_forward = EXCLUDED.auto_forward,
         default_signature_id = EXCLUDED.default_signature_id,
         updated_at = NOW()`,
      [
        id,
        auth.user.userId,
        mailboxId,
        body.auto_new !== false,
        body.auto_reply !== false,
        body.auto_reply_all !== false,
        body.auto_forward !== false,
        body.default_signature_id ? String(body.default_signature_id) : null,
      ]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to save signature preferences." }, { status: 500 });
  }
}
