import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { buildZohoAuthUrl, generatePkcePair, getZohoConfig } from "@/lib/zoho-mail";

export const dynamic = "force-dynamic";

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
    const cfg = getZohoConfig();
    if (!cfg.configured) {
      return NextResponse.json(
        {
          error: "Zoho OAuth credentials (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET) are not configured in server environment.",
          code: "ZOHO_CREDENTIALS_MISSING",
          redirectUri: cfg.redirectUri,
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const mailboxId = String(body.mailboxId || "").trim();
    if (!mailboxId) {
      return NextResponse.json({ error: "mailboxId is required." }, { status: 400 });
    }

    await initDb();
    const mbxRes = await query(
      `SELECT id, email_address, accounts_base_url FROM mail_accounts WHERE id = $1 LIMIT 1`,
      [mailboxId]
    );
    const mbx = mbxRes?.rows[0];
    if (!mbx) {
      return NextResponse.json({ error: "Mailbox not found." }, { status: 404 });
    }

    const state = crypto.randomBytes(32).toString("hex");
    const { codeVerifier, codeChallenge } = generatePkcePair();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await query(
      `INSERT INTO mail_oauth_states (state, mailbox_id, user_id, code_verifier, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [state, mailboxId, auth.user.userId, codeVerifier, expiresAt]
    );

    const authUrl = buildZohoAuthUrl({
      state,
      codeChallenge,
      loginHint: mbx.email_address,
      accountsBaseUrl: mbx.accounts_base_url,
    });

    await logAudit(
      auth.user.userId,
      "MAILBOX_OAUTH_INITIATED",
      { mailboxId, email: mbx.email_address },
      { actorName: auth.user.name, module: "mail", recordRef: mbx.email_address, outcome: "SUCCESS" }
    );

    return NextResponse.json({ authUrl, expiresAt });
  } catch (err: any) {
    console.error("OAuth start error:", err);
    return NextResponse.json({ error: err?.message || "Failed to initiate Zoho OAuth." }, { status: 500 });
  }
}
