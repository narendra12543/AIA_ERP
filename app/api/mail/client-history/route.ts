import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { getAuthorizedMailboxes } from "@/lib/mail-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canViewClients =
    normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "clients.view");
  if (!canViewClients) {
    return NextResponse.json({ error: "Forbidden: Client access required." }, { status: 403 });
  }

  const clientEmail = String(req.nextUrl.searchParams.get("clientEmail") || "").trim().toLowerCase();
  if (!clientEmail || !clientEmail.includes("@")) {
    return NextResponse.json({ emails: [], clients: [] });
  }

  try {
    await initDb();
    const mailboxes = await getAuthorizedMailboxes(auth.user);
    const allowedMailboxIds = mailboxes.map((m) => m.id);
    if (allowedMailboxIds.length === 0) {
      return NextResponse.json({ emails: [] });
    }

    // Normalized exact email match across authorized mailboxes only (never exposes client financials)
    const [incomingRes, outgoingRes] = await Promise.all([
      query(
        `SELECT mailbox_id, folder_id, message_id, subject, from_address, from_name, to_addresses, summary, received_time, 'incoming' AS direction
         FROM mail_messages_cache
         WHERE mailbox_id = ANY($1::text[])
           AND (LOWER(TRIM(from_address)) = $2 OR LOWER(to_addresses) ~ $3)
         ORDER BY received_time DESC
         LIMIT 30`,
        [allowedMailboxIds, clientEmail, `(^|[ ,;<])${clientEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([ ,;>]|$)`]
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT id, mailbox_id, quotation_no, document_type, from_email, to_emails, subject, sent_at, status, 'outgoing' AS direction
         FROM email_history
         WHERE (mailbox_id IS NULL OR mailbox_id = ANY($1::text[]))
           AND LOWER(to_emails) ~ $2
         ORDER BY sent_at DESC
         LIMIT 30`,
        [allowedMailboxIds, `(^|[ ,;<])${clientEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([ ,;>]|$)`]
      ).catch(() => ({ rows: [] })),
    ]);

    return NextResponse.json({
      clientEmail,
      incoming: incomingRes?.rows || [],
      outgoing: outgoingRes?.rows || [],
    });
  } catch (err: any) {
    console.error("Client email history error:", err);
    return NextResponse.json({ error: "Failed to load client email history." }, { status: 500 });
  }
}
