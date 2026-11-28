import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { authorizeMailboxAction } from "@/lib/mail-auth";
import { isZohoMockEnabled, zohoFetch } from "@/lib/zoho-mail";

export const dynamic = "force-dynamic";

function mockFoldersForMailbox(mailboxId: string) {
  return [
    { folderId: `${mailboxId}_inbox`, folderName: "Inbox", folderType: "Inbox", unreadCount: 2, messageCount: 4 },
    { folderId: `${mailboxId}_sent`, folderName: "Sent", folderType: "Sent", unreadCount: 0, messageCount: 2 },
    { folderId: `${mailboxId}_drafts`, folderName: "Drafts", folderType: "Drafts", unreadCount: 0, messageCount: 1 },
    { folderId: `${mailboxId}_starred`, folderName: "Starred", folderType: "Starred", unreadCount: 1, messageCount: 1 },
    { folderId: `${mailboxId}_archive`, folderName: "Archive", folderType: "Archive", unreadCount: 0, messageCount: 0 },
    { folderId: `${mailboxId}_spam`, folderName: "Spam", folderType: "Spam", unreadCount: 0, messageCount: 0 },
    { folderId: `${mailboxId}_trash`, folderName: "Trash", folderType: "Trash", unreadCount: 0, messageCount: 0 },
  ];
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const mailboxId = String(req.nextUrl.searchParams.get("mailboxId") || "").trim();
  const cachedOnly = req.nextUrl.searchParams.get("cached") === "1";

  const gate = await authorizeMailboxAction(auth.user, mailboxId, "read");
  if (gate.authorized === false) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    await initDb();
    if (cachedOnly || gate.mailbox.connection_status !== "Connected") {
      const cached = await query(
        `SELECT folder_id AS "folderId", folder_name AS "folderName", folder_type AS "folderType",
                unread_count AS "unreadCount", message_count AS "messageCount"
         FROM mail_folders_cache
         WHERE mailbox_id = $1
         ORDER BY folder_name ASC`,
        [mailboxId]
      ).catch(() => ({ rows: [] }));
      return NextResponse.json({
        mailboxId,
        connectionStatus: gate.mailbox.connection_status,
        folders: cached?.rows || [],
        fromCache: true,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    let folders: any[] = [];
    if (isZohoMockEnabled()) {
      folders = mockFoldersForMailbox(mailboxId);
    } else {
      const zRes = await zohoFetch(mailboxId, "/folders");
      const raw = Array.isArray(zRes.data) ? zRes.data : [];
      folders = raw.map((f: any) => ({
        folderId: String(f.folderId),
        folderName: String(f.folderName || "Folder"),
        folderType: String(f.folderType || f.folderName || "Custom"),
        unreadCount: Number(f.unreadCount || 0),
        messageCount: Number(f.messageCount || 0),
      }));
    }

    for (const f of folders) {
      await query(
        `INSERT INTO mail_folders_cache (id, mailbox_id, folder_id, folder_name, folder_type, unread_count, message_count, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
         ON CONFLICT (mailbox_id, folder_id) DO UPDATE SET
           folder_name = EXCLUDED.folder_name,
           folder_type = EXCLUDED.folder_type,
           unread_count = EXCLUDED.unread_count,
           message_count = EXCLUDED.message_count,
           updated_at = NOW()`,
        [`${mailboxId}_${f.folderId}`, mailboxId, f.folderId, f.folderName, f.folderType, f.unreadCount, f.messageCount]
      ).catch(() => {});
    }

    return NextResponse.json({
      mailboxId,
      connectionStatus: gate.mailbox.connection_status,
      folders,
      fromCache: false,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    console.error("Failed to load folders:", err);
    return NextResponse.json({ error: err?.message || "Failed to load folders." }, { status: 502 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const mailboxId = String(body.mailboxId || "").trim();
    const folderName = String(body.folderName || "").trim().slice(0, 80);
    if (!folderName) {
      return NextResponse.json({ error: "folderName is required." }, { status: 400 });
    }

    const gate = await authorizeMailboxAction(auth.user, mailboxId, "manage_folders");
    if (gate.authorized === false) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    let created: any;
    if (isZohoMockEnabled()) {
      created = { folderId: `${mailboxId}_custom_${Date.now()}`, folderName, folderType: "Custom", unreadCount: 0, messageCount: 0 };
    } else {
      const zRes = await zohoFetch(mailboxId, "/folders", {
        method: "POST",
        body: { folderName },
      });
      created = {
        folderId: String(zRes.data?.folderId || ""),
        folderName: String(zRes.data?.folderName || folderName),
        folderType: "Custom",
        unreadCount: 0,
        messageCount: 0,
      };
    }

    await logAudit(
      auth.user.userId,
      "MAIL_FOLDER_CREATED",
      { mailboxId, folderName },
      { actorName: auth.user.name, module: "mail", recordRef: mailboxId, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true, folder: created });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create folder." }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const mailboxId = String(body.mailboxId || "").trim();
    const folderId = String(body.folderId || "").trim();
    const folderName = String(body.folderName || "").trim().slice(0, 80);
    if (!folderId || !folderName) {
      return NextResponse.json({ error: "folderId and folderName are required." }, { status: 400 });
    }

    const gate = await authorizeMailboxAction(auth.user, mailboxId, "manage_folders");
    if (gate.authorized === false) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    if (!isZohoMockEnabled()) {
      await zohoFetch(mailboxId, `/folders/${encodeURIComponent(folderId)}`, {
        method: "PUT",
        body: { mode: "rename", folderName },
      });
    }

    await query(
      `UPDATE mail_folders_cache SET folder_name = $1, updated_at = NOW() WHERE mailbox_id = $2 AND folder_id = $3`,
      [folderName, mailboxId, folderId]
    ).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to rename folder." }, { status: 502 });
  }
}
