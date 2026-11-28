import { query, initDb } from "./db";
import { SessionData } from "./auth";
import { hasPermission, normalizeRole } from "./permissions";

export type MailboxCapability =
  | "read"
  | "compose"
  | "send"
  | "reply_forward"
  | "download_attachments"
  | "manage_folders"
  | "archive"
  | "trash"
  | "manage_labels";

export interface AuthorizedMailbox {
  id: string;
  email_address: string;
  display_name: string;
  mailbox_type: string;
  connection_status: string;
  is_enabled: boolean;
  is_default: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  capabilities: Record<MailboxCapability, boolean>;
}

const CAP_COL_MAP: Record<MailboxCapability, string> = {
  read: "can_read",
  compose: "can_compose",
  send: "can_send",
  reply_forward: "can_reply_forward",
  download_attachments: "can_download_attachments",
  manage_folders: "can_manage_folders",
  archive: "can_archive",
  trash: "can_trash",
  manage_labels: "can_manage_labels",
};

export async function getAuthorizedMailboxes(user: SessionData): Promise<AuthorizedMailbox[]> {
  await initDb();
  const isAdmin = normalizeRole(user.role) === "Admin";
  const canonRole = normalizeRole(user.role);

  const mbxRes = await query(
    `SELECT id, email_address, display_name, mailbox_type, connection_status, is_enabled, is_default, last_sync_at, last_error
     FROM mail_accounts
     ORDER BY is_default DESC, email_address ASC`,
    []
  ).catch(() => ({ rows: [] }));

  const rows = mbxRes?.rows || [];
  if (isAdmin) {
    return rows.map((r: any) => ({
      ...r,
      capabilities: {
        read: true,
        compose: true,
        send: true,
        reply_forward: true,
        download_attachments: true,
        manage_folders: true,
        archive: true,
        trash: true,
        manage_labels: true,
      },
    }));
  }

  const permRes = await query(
    `SELECT mailbox_id, subject_type, subject_value,
            can_read, can_compose, can_send, can_reply_forward, can_download_attachments,
            can_manage_folders, can_archive, can_trash, can_manage_labels
     FROM mail_account_permissions
     WHERE (subject_type = 'role' AND LOWER(subject_value) = LOWER($1))
        OR (subject_type = 'user' AND (subject_value = $2 OR LOWER(subject_value) = LOWER($3)))`,
    [canonRole, user.userId, user.email]
  ).catch(() => ({ rows: [] }));

  const permByMailbox = new Map<string, any>();
  for (const p of permRes?.rows || []) {
    const existing = permByMailbox.get(p.mailbox_id);
    // User-specific assignment overrides role assignment if present
    if (!existing || p.subject_type === "user") {
      permByMailbox.set(p.mailbox_id, p);
    }
  }

  return rows
    .filter((r: any) => r.is_enabled && permByMailbox.has(r.id))
    .map((r: any) => {
      const p = permByMailbox.get(r.id);
      return {
        ...r,
        capabilities: {
          read: Boolean(p.can_read),
          compose: Boolean(p.can_compose),
          send: Boolean(p.can_send) && hasPermission(user, "mail.send"),
          reply_forward: Boolean(p.can_reply_forward),
          download_attachments: Boolean(p.can_download_attachments),
          manage_folders: Boolean(p.can_manage_folders),
          archive: Boolean(p.can_archive),
          trash: Boolean(p.can_trash),
          manage_labels: Boolean(p.can_manage_labels),
        },
      };
    })
    .filter((m: AuthorizedMailbox) => m.capabilities.read);
}

export async function authorizeMailboxAction(
  user: SessionData,
  mailboxId: string,
  capability: MailboxCapability
): Promise<{ authorized: true; mailbox: AuthorizedMailbox } | { authorized: false; error: string; status: number }> {
  if (!mailboxId) {
    return { authorized: false, error: "Mailbox ID is required.", status: 400 };
  }
  const boxes = await getAuthorizedMailboxes(user);
  const box = boxes.find((b) => b.id === mailboxId);
  if (!box) {
    return {
      authorized: false,
      error: "Forbidden: You are not assigned to this mailbox.",
      status: 403,
    };
  }
  if (!box.is_enabled) {
    return { authorized: false, error: "This mailbox is currently disabled.", status: 403 };
  }
  if (!box.capabilities[capability]) {
    return {
      authorized: false,
      error: `Forbidden: Missing mailbox capability (${CAP_COL_MAP[capability]}).`,
      status: 403,
    };
  }
  return { authorized: true, mailbox: box };
}

export function sanitizeIncomingEmailHtml(rawHtml: string, allowRemoteImages: boolean = false): {
  html: string;
  hasBlockedRemoteImages: boolean;
} {
  let hasBlockedRemoteImages = false;
  let safe = String(rawHtml || "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^>]*>/gi, "")
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/data\s*:\s*text\/html/gi, "blocked:");

  if (!allowRemoteImages) {
    safe = safe.replace(
      /(<img\b[^>]*?)\bsrc\s*=\s*(["'])(https?:\/\/[^"']+)\2/gi,
      (_m, prefix, q, url) => {
        hasBlockedRemoteImages = true;
        return `${prefix}data-blocked-src=${q}${url}${q} alt="[Remote image blocked for privacy]"`;
      }
    );
  }

  return { html: safe, hasBlockedRemoteImages };
}
