import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { authorizeMailboxAction, sanitizeIncomingEmailHtml } from "@/lib/mail-auth";
import { isZohoMockEnabled, zohoFetch } from "@/lib/zoho-mail";
import { parseEmailList, sanitizeEmailHtml, stripHtmlToText } from "@/lib/email-sanitizer";

export const dynamic = "force-dynamic";

function mockMessagesForMailbox(mailboxId: string, email: string, folderId: string) {
  return [
    {
      messageId: `${mailboxId}_msg_1001`,
      folderId,
      threadId: `${mailboxId}_thr_1`,
      subject: `[Test Mock] Inquiry for Belt Conveyor (${email})`,
      fromAddress: "client@example.com",
      fromName: "Test Client",
      toAddress: email,
      summary: "Please share commercial offer and delivery timeline for inclined conveyor.",
      receivedTime: Date.now() - 3600_000,
      isRead: false,
      hasAttachment: false,
      isStarred: true,
      labels: [],
    },
    {
      messageId: `${mailboxId}_msg_1002`,
      folderId,
      threadId: `${mailboxId}_thr_2`,
      subject: `[Test Mock] Purchase Confirmation (${email})`,
      fromAddress: "vendor@example.com",
      fromName: "Test Vendor",
      toAddress: email,
      summary: "Material dispatch scheduled for tomorrow.",
      receivedTime: Date.now() - 7200_000,
      isRead: true,
      hasAttachment: true,
      isStarred: false,
      labels: [],
    },
  ];
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "mail.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const sp = req.nextUrl.searchParams;
  const mailboxId = String(sp.get("mailboxId") || "").trim();
  const folderId = String(sp.get("folderId") || "").trim();
  const messageId = String(sp.get("messageId") || "").trim();
  const attachmentId = String(sp.get("attachmentId") || "").trim();
  const search = String(sp.get("search") || "").trim();
  const allowRemoteImages = sp.get("allowRemoteImages") === "1";
  const start = Math.max(0, Number(sp.get("start") || 0) || 0);
  const limit = Math.min(50, Math.max(1, Number(sp.get("limit") || 25) || 25));

  const gate = await authorizeMailboxAction(auth.user, mailboxId, attachmentId ? "download_attachments" : "read");
  if (gate.authorized === false) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  try {
    await initDb();

    // 1. Attachment download
    if (attachmentId && messageId && folderId) {
      const rawName = String(sp.get("name") || "attachment.bin").replace(/[^\w.\- ()]/g, "_");
      if (isZohoMockEnabled()) {
        return new NextResponse(Buffer.from("Mock attachment content"), {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename="${rawName}"`,
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      const bin = await zohoFetch(
        mailboxId,
        `/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
        { isBinary: true }
      );
      return new NextResponse(bin.buffer, {
        status: 200,
        headers: {
          "Content-Type": bin.contentType || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${rawName}"`,
          "X-Content-Type-Options": "nosniff",
          "Cache-Control": "private, no-store",
        },
      });
    }

    // 2. Single message body + attachments
    if (messageId && folderId) {
      if (isZohoMockEnabled()) {
        const mockList = mockMessagesForMailbox(mailboxId, gate.mailbox.email_address, folderId);
        const found = mockList.find((m) => m.messageId === messageId) || mockList[0];
        const safe = sanitizeIncomingEmailHtml(
          `<p>Hello,</p><p>${found.summary}</p><p>Mailbox: <strong>${gate.mailbox.email_address}</strong></p>`,
          allowRemoteImages
        );
        return NextResponse.json({
          message: {
            ...found,
            htmlContent: safe.html,
            hasBlockedRemoteImages: safe.hasBlockedRemoteImages,
            attachments: found.hasAttachment
              ? [{ attachmentId: "att_mock_1", attachmentName: "dispatch_note.pdf", attachmentSize: 1024 }]
              : [],
          },
        }, { headers: { "Cache-Control": "private, no-store" } });
      }

      const [detailsRes, contentRes, attachRes] = await Promise.all([
        zohoFetch(mailboxId, `/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/details`),
        zohoFetch(mailboxId, `/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/content`),
        zohoFetch(mailboxId, `/folders/${encodeURIComponent(folderId)}/messages/${encodeURIComponent(messageId)}/attachmentinfo`).catch(() => ({ data: { attachments: [] } })),
      ]);
      const d = detailsRes.data || {};
      const rawHtml = String(contentRes.data?.content || d.content || "");
      const safe = sanitizeIncomingEmailHtml(rawHtml, allowRemoteImages);
      return NextResponse.json({
        message: {
          messageId: String(d.messageId || messageId),
          folderId: String(d.folderId || folderId),
          threadId: d.threadId ? String(d.threadId) : undefined,
          subject: String(d.subject || "(No Subject)"),
          fromAddress: String(d.fromAddress || ""),
          fromName: String(d.sender || d.fromAddress || ""),
          toAddress: String(d.toAddress || ""),
          ccAddress: String(d.ccAddress || ""),
          receivedTime: Number(d.receivedTime || Date.now()),
          isRead: String(d.status || "") === "1",
          htmlContent: safe.html,
          hasBlockedRemoteImages: safe.hasBlockedRemoteImages,
          attachments: Array.isArray(attachRes.data?.attachments)
            ? attachRes.data.attachments.map((a: any) => ({
                attachmentId: String(a.attachmentId),
                attachmentName: String(a.attachmentName || "file"),
                attachmentSize: Number(a.attachmentSize || 0),
              }))
            : [],
        },
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // 3. Message list / search
    if (gate.mailbox.connection_status !== "Connected" && !isZohoMockEnabled()) {
      return NextResponse.json({
        mailboxId,
        connectionStatus: gate.mailbox.connection_status,
        messages: [],
        notConnected: true,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    let messages: any[] = [];
    if (isZohoMockEnabled()) {
      const all = mockMessagesForMailbox(mailboxId, gate.mailbox.email_address, folderId || `${mailboxId}_inbox`);
      messages = search
        ? all.filter((m) => `${m.subject} ${m.fromAddress} ${m.summary}`.toLowerCase().includes(search.toLowerCase()))
        : all;
    } else {
      const endpoint = search
        ? `/messages/search?searchKey=${encodeURIComponent(search)}&start=${start}&limit=${limit}`
        : `/messages/view?folderId=${encodeURIComponent(folderId)}&start=${start}&limit=${limit}`;
      const zRes = await zohoFetch(mailboxId, endpoint);
      const raw = Array.isArray(zRes.data) ? zRes.data : [];
      messages = raw.map((m: any) => ({
        messageId: String(m.messageId),
        folderId: String(m.folderId || folderId),
        threadId: m.threadId ? String(m.threadId) : undefined,
        subject: String(m.subject || "(No Subject)"),
        fromAddress: String(m.fromAddress || ""),
        fromName: String(m.sender || m.fromAddress || ""),
        toAddress: String(m.toAddress || ""),
        summary: String(m.summary || ""),
        receivedTime: Number(m.receivedTime || 0),
        isRead: String(m.status || "") === "1",
        hasAttachment: String(m.hasAttachment || "0") === "1" || Boolean(m.hasAttachment === true),
        isStarred: String(m.flagid || "") !== "" && String(m.flagid || "0") !== "0",
        labels: Array.isArray(m.tags) ? m.tags : [],
      }));
    }

    // Update lightweight metadata cache (no bodies)
    for (const m of messages.slice(0, 30)) {
      await query(
        `INSERT INTO mail_messages_cache (id, mailbox_id, folder_id, message_id, thread_id, subject, from_address, from_name, to_addresses, summary, received_time, is_read, has_attachment, is_starred, cached_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
         ON CONFLICT (mailbox_id, folder_id, message_id) DO UPDATE SET
           subject = EXCLUDED.subject,
           is_read = EXCLUDED.is_read,
           is_starred = EXCLUDED.is_starred,
           cached_at = NOW()`,
        [
          `${mailboxId}_${m.folderId}_${m.messageId}`,
          mailboxId,
          m.folderId,
          m.messageId,
          m.threadId || null,
          m.subject,
          m.fromAddress,
          m.fromName,
          m.toAddress,
          m.summary,
          m.receivedTime,
          m.isRead,
          m.hasAttachment,
          m.isStarred,
        ]
      ).catch(() => {});
    }

    return NextResponse.json({
      mailboxId,
      folderId,
      messages,
      connectionStatus: gate.mailbox.connection_status,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err: any) {
    console.error("Failed to fetch messages:", err);
    return NextResponse.json({ error: err?.message || "Failed to fetch messages." }, { status: 502 });
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
    const mode = String(body.mode || "new").toLowerCase(); // 'new' | 'reply' | 'replyAll' | 'forward' | 'draft'
    const isDraft = mode === "draft";
    const requiredCap = isDraft
      ? "compose"
      : mode === "reply" || mode === "replyall" || mode === "forward"
      ? "reply_forward"
      : "send";

    const gate = await authorizeMailboxAction(auth.user, mailboxId, requiredCap);
    if (gate.authorized === false) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }
    if (!isDraft && !gate.mailbox.capabilities.send) {
      return NextResponse.json({ error: "Forbidden: Sending disabled for your account on this mailbox." }, { status: 403 });
    }

    const toList = parseEmailList(body.to);
    const ccList = parseEmailList(body.cc);
    const bccList = parseEmailList(body.bcc);
    const subject = String(body.subject || "").trim().slice(0, 300);
    const safeHtml = sanitizeEmailHtml(String(body.body_html || ""));
    const plainText = stripHtmlToText(safeHtml);

    if (!isDraft && toList.length === 0) {
      return NextResponse.json({ error: "At least one valid 'To' email address is required." }, { status: 400 });
    }
    if (!isDraft && !subject) {
      return NextResponse.json({ error: "Email subject is required." }, { status: 400 });
    }

    // Revalidate ERP PO attachment authorization & Vercel serverless payload cap (3 MB raw -> ~4.0 MB Base64 < 4.5 MB limit)
    const rawAttachments = Array.isArray(body.attachments) ? body.attachments : [];
    const MAX_RAW_ATTACHMENT_BYTES = 3 * 1024 * 1024;
    let totalRawBytes = 0;
    for (const att of rawAttachments) {
      if (!att?.base64) continue;
      const bufLen = Buffer.byteLength(String(att.base64), "base64");
      totalRawBytes += bufLen;
      if (bufLen > MAX_RAW_ATTACHMENT_BYTES || totalRawBytes > MAX_RAW_ATTACHMENT_BYTES) {
        return NextResponse.json(
          {
            error: "Attachment size exceeds the 3 MB raw limit (4.5 MB Vercel serverless JSON/Base64 limit).",
            code: "ATTACHMENT_TOO_LARGE",
          },
          { status: 413 }
        );
      }
    }
    const isAdmin = normalizeRole(auth.user.role) === "Admin";
    const hasPoAtt =
      String(body.document_type || "").toLowerCase() === "po" ||
      rawAttachments.some((a: any) => String(a?.docType || "").toLowerCase() === "po" || /^PO[-_]/i.test(String(a?.filename || "")));
    if (hasPoAtt) {
      if (!isAdmin && !hasPermission(auth.user, "purchase_order.create") && !hasPermission(auth.user, "purchase_order.view_own")) {
        return NextResponse.json({ error: "Forbidden: Not authorized to attach Purchase Orders." }, { status: 403 });
      }
      const poRef = String(body.quotation_no || rawAttachments.find((a: any) => a?.quoteRef)?.quoteRef || "").trim();
      const poRes = poRef
        ? await query(`SELECT id, approval_status, data FROM purchase_orders WHERE po_number = $1 OR id = $1 LIMIT 1`, [poRef])
        : null;
      const poRow = poRes?.rows[0];
      if (!poRow || String(poRow.approval_status || poRow.data?.approval_status || "Draft") !== "Approved") {
        return NextResponse.json({ error: "Admin approval required. Unapproved Purchase Orders cannot be sent." }, { status: 403 });
      }
    }

    // Prevent duplicate send within 15 seconds
    if (!isDraft) {
      const dupCheck = await query(
        `SELECT id FROM email_history
         WHERE sent_by = $1 AND mailbox_id = $2 AND subject = $3 AND to_emails = $4
           AND status = 'sent' AND sent_at > NOW() - INTERVAL '15 seconds'
         LIMIT 1`,
        [auth.user.email, mailboxId, subject, toList.join(", ")]
      ).catch(() => ({ rows: [] }));
      if (dupCheck && dupCheck.rows.length > 0) {
        return NextResponse.json({ error: "Duplicate send prevented." }, { status: 409 });
      }
    }

    let providerMessageId: string | null = null;
    if (isZohoMockEnabled()) {
      providerMessageId = `zoho_mock_${Date.now()}`;
    } else {
      // Upload attachments to Zoho if present
      const uploadedAttachments: Array<{ storeName: string; attachmentName: string; attachmentPath: string }> = [];
      for (const att of rawAttachments) {
        if (!att?.base64) continue;
        const filename = String(att.filename || "attachment.pdf").replace(/[^\w.\- ()]/g, "_");
        const buf = Buffer.from(String(att.base64), "base64");
        const upRes = await zohoFetch(mailboxId, `/messages/attachments?fileName=${encodeURIComponent(filename)}`, {
          method: "POST",
          body: buf,
          isBinary: true,
          headers: { "Content-Type": String(att.contentType || "application/pdf") },
        });
        if (upRes.data) {
          uploadedAttachments.push({
            storeName: String(upRes.data.storeName || ""),
            attachmentName: String(upRes.data.attachmentName || filename),
            attachmentPath: String(upRes.data.attachmentPath || ""),
          });
        }
      }

      const payload: Record<string, any> = {
        fromAddress: gate.mailbox.email_address,
        toAddress: toList.join(","),
        ccAddress: ccList.join(","),
        bccAddress: bccList.join(","),
        subject,
        content: safeHtml || plainText,
        mailFormat: "html",
        askReceipt: "no",
      };
      if (isDraft) payload.mode = "draft";
      if (body.inReplyTo) payload.inReplyTo = String(body.inReplyTo);
      if (uploadedAttachments.length > 0) payload.attachments = uploadedAttachments;

      const sendPath =
        (mode === "reply" || mode === "replyall" || mode === "forward") && body.originalMessageId
          ? `/messages/${encodeURIComponent(String(body.originalMessageId))}`
          : "/messages";
      if (mode === "reply") payload.action = "reply";
      else if (mode === "replyall") payload.action = "replyall";
      else if (mode === "forward") payload.action = "forward";

      const zRes = await zohoFetch(mailboxId, sendPath, { method: "POST", body: payload });
      providerMessageId = zRes.data?.messageId ? String(zRes.data.messageId) : `zoho_${Date.now()}`;
    }

    if (!isDraft) {
      await query(
        `INSERT INTO email_history (id, mailbox_id, quotation_no, document_type, from_email, to_emails, cc_emails, bcc_emails, subject, body_html, attachments, status, provider_message_id, sent_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'sent',$12,$13)`,
        [
          `mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          mailboxId,
          body.quotation_no ? String(body.quotation_no) : null,
          body.document_type ? String(body.document_type) : "General",
          gate.mailbox.email_address,
          toList.join(", "),
          ccList.join(", "),
          bccList.join(", "),
          subject,
          safeHtml,
          JSON.stringify(rawAttachments.map((a: any) => ({ filename: a.filename, contentType: a.contentType }))),
          providerMessageId,
          auth.user.email,
        ]
      ).catch(() => {});
    }

    await logAudit(
      auth.user.userId,
      isDraft ? "MAIL_DRAFT_SYNCED" : "MAIL_SENT_ZOHO_API",
      { mailboxId, from: gate.mailbox.email_address, toCount: toList.length, mode, providerMessageId },
      { actorName: auth.user.name, module: "mail", recordRef: providerMessageId || mailboxId, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true, providerMessageId, from: gate.mailbox.email_address });
  } catch (err: any) {
    console.error("Zoho Mail send/draft error:", err);
    return NextResponse.json({ error: err?.message || "Failed to send via Zoho Mail API." }, { status: 502 });
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
    const messageIds: string[] = Array.isArray(body.messageIds)
      ? body.messageIds.map(String)
      : body.messageId
      ? [String(body.messageId)]
      : [];
    const op = String(body.operation || "").trim();

    if (!mailboxId || messageIds.length === 0 || !op) {
      return NextResponse.json({ error: "mailboxId, messageIds, and operation are required." }, { status: 400 });
    }

    const capMap: Record<string, any> = {
      markRead: "read",
      markUnread: "read",
      flag: "read",
      unflag: "read",
      archive: "archive",
      move: "manage_folders",
      trash: "trash",
      restore: "trash",
      spam: "trash",
      notSpam: "trash",
      applyLabel: "manage_labels",
      removeLabel: "manage_labels",
    };
    const gate = await authorizeMailboxAction(auth.user, mailboxId, capMap[op] || "read");
    if (gate.authorized === false) {
      return NextResponse.json({ error: gate.error }, { status: gate.status });
    }

    if (!isZohoMockEnabled()) {
      const zBody: Record<string, any> = { messageId: messageIds };
      if (op === "markRead") zBody.mode = "markAsRead";
      else if (op === "markUnread") zBody.mode = "markAsUnread";
      else if (op === "flag") { zBody.mode = "setFlag"; zBody.flagid = "1"; }
      else if (op === "unflag") zBody.mode = "removeFlag";
      else if (op === "move" || op === "archive" || op === "trash" || op === "restore" || op === "spam" || op === "notSpam") {
        zBody.mode = op === "spam" ? "markAsSpam" : op === "notSpam" ? "notSpam" : "moveMessage";
        if (body.destFolderId) zBody.destfolderId = String(body.destFolderId);
      } else if (op === "applyLabel" || op === "removeLabel") {
        zBody.mode = op === "applyLabel" ? "applyLabel" : "removeLabel";
        zBody.labelId = [String(body.labelId || "")];
      }

      await zohoFetch(mailboxId, "/updatemessage", { method: "PUT", body: zBody });
    }

    // Update cache only after provider confirms
    if (op === "markRead" || op === "markUnread") {
      await query(
        `UPDATE mail_messages_cache SET is_read = $1 WHERE mailbox_id = $2 AND message_id = ANY($3::text[])`,
        [op === "markRead", mailboxId, messageIds]
      ).catch(() => {});
    } else if (op === "flag" || op === "unflag") {
      await query(
        `UPDATE mail_messages_cache SET is_starred = $1 WHERE mailbox_id = $2 AND message_id = ANY($3::text[])`,
        [op === "flag", mailboxId, messageIds]
      ).catch(() => {});
    } else if (op === "trash" || op === "archive" || op === "move") {
      await query(
        `DELETE FROM mail_messages_cache WHERE mailbox_id = $1 AND folder_id = $2 AND message_id = ANY($3::text[])`,
        [mailboxId, folderId, messageIds]
      ).catch(() => {});
    }

    if (["trash", "spam"].includes(op)) {
      await logAudit(
        auth.user.userId,
        `MAIL_${op.toUpperCase()}`,
        { mailboxId, count: messageIds.length },
        { actorName: auth.user.name, module: "mail", recordRef: mailboxId, outcome: "SUCCESS" }
      );
    }

    return NextResponse.json({ success: true, operation: op, count: messageIds.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to execute mailbox operation." }, { status: 502 });
  }
}
