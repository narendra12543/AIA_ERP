import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { encryptSecret } from "@/lib/crypto";
import { discoverZohoAccounts, exchangeZohoAuthCode, getZohoConfig } from "@/lib/zoho-mail";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
  const redirectBack = (status: string, msg: string) =>
    NextResponse.redirect(
      `${appUrl}/?mail_oauth=${encodeURIComponent(status)}&mail_msg=${encodeURIComponent(msg)}`
    );

  if ("error" in auth) {
    return redirectBack("error", "Session required to complete Zoho OAuth.");
  }
  const canManage =
    normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "mail.manage_accounts");
  if (!canManage) {
    return redirectBack("error", "Forbidden: Administrator authorization required.");
  }

  const sp = req.nextUrl.searchParams;
  const oauthError = sp.get("error");
  if (oauthError) {
    return redirectBack("error", `Zoho OAuth denied: ${oauthError}`);
  }

  const code = sp.get("code") || "";
  const state = sp.get("state") || "";
  if (!code || !state) {
    return redirectBack("error", "Missing authorization code or state.");
  }

  try {
    await initDb();
    const stRes = await query(
      `SELECT state, mailbox_id, user_id, code_verifier, expires_at, used_at
       FROM mail_oauth_states
       WHERE state = $1
       LIMIT 1`,
      [state]
    );
    const stRow = stRes?.rows[0];
    if (!stRow) {
      return redirectBack("error", "Invalid OAuth state.");
    }
    if (stRow.used_at) {
      return redirectBack("error", "OAuth state already consumed (replay blocked).");
    }
    if (new Date(stRow.expires_at).getTime() <= Date.now()) {
      return redirectBack("error", "OAuth state expired. Please retry connection.");
    }
    if (stRow.user_id !== auth.user.userId) {
      return redirectBack("error", "OAuth session mismatch.");
    }

    // Consume state immediately (single-use)
    await query(`UPDATE mail_oauth_states SET used_at = NOW() WHERE state = $1`, [state]);

    const mbxRes = await query(
      `SELECT id, email_address, accounts_base_url, mail_base_url FROM mail_accounts WHERE id = $1 LIMIT 1`,
      [stRow.mailbox_id]
    );
    const mbx = mbxRes?.rows[0];
    if (!mbx) {
      return redirectBack("error", "Target mailbox record not found.");
    }

    const cfg = getZohoConfig();
    const tokens = await exchangeZohoAuthCode({
      code,
      codeVerifier: stRow.code_verifier,
      accountsBaseUrl: mbx.accounts_base_url || cfg.accountsBase,
    });

    const accounts = await discoverZohoAccounts(tokens.accessToken, mbx.mail_base_url || cfg.mailBase);
    const targetEmailLower = String(mbx.email_address).toLowerCase();
    const matched =
      accounts.find(
        (a) =>
          a.primaryEmailAddress === targetEmailLower ||
          a.allowedSendAs.some((s) => s.toLowerCase() === targetEmailLower)
      ) || accounts[0];

    if (!matched) {
      await query(
        `UPDATE mail_accounts SET connection_status = 'Error', last_error = 'No Zoho mailbox discovered for this account.', updated_at = NOW() WHERE id = $1`,
        [mbx.id]
      );
      return redirectBack("error", "Zoho account discovery returned no matching mailbox.");
    }

    const isAlias =
      matched.primaryEmailAddress !== targetEmailLower &&
      matched.allowedSendAs.some((s) => s.toLowerCase() === targetEmailLower);
    const discoveredType = isAlias ? "alias" : matched.mailboxType;
    const accessExpiry = new Date(Date.now() + tokens.expiresIn * 1000).toISOString();

    await query(
      `UPDATE mail_accounts
       SET provider_account_id = $1,
           mailbox_type = $2,
           allowed_send_as = $3,
           encrypted_refresh_token = COALESCE($4, encrypted_refresh_token),
           encrypted_access_token = $5,
           access_token_expires_at = $6,
           granted_scopes = $7,
           connection_status = 'Connected',
           last_error = NULL,
           connected_at = COALESCE(connected_at, NOW()),
           last_sync_at = NOW(),
           updated_at = NOW()
       WHERE id = $8`,
      [
        matched.accountId,
        discoveredType,
        JSON.stringify(matched.allowedSendAs),
        tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
        encryptSecret(tokens.accessToken),
        accessExpiry,
        tokens.scope,
        mbx.id,
      ]
    );

    await logAudit(
      auth.user.userId,
      "MAILBOX_CONNECTED",
      { mailboxId: mbx.id, email: mbx.email_address, providerAccountId: matched.accountId, mailboxType: discoveredType },
      { actorName: auth.user.name, module: "mail", recordRef: mbx.email_address, outcome: "SUCCESS" }
    );

    return redirectBack("connected", `${mbx.email_address} connected (${discoveredType}).`);
  } catch (err: any) {
    console.error("Zoho OAuth callback error:", err);
    return redirectBack("error", err?.message || "Zoho OAuth callback failed.");
  }
}
