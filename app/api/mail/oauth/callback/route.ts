import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { authenticateRequest, logAudit, SessionData, verifySession } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { discoverZohoAccounts, exchangeZohoAuthCode, getZohoConfig } from "@/lib/zoho-mail";

export const dynamic = "force-dynamic";

interface OAuthCtxCookie {
  state: string;
  sessionId: string;
  sessionToken: string;
  userId: string;
  mailboxId: string;
  expiresAtMs: number;
}

export async function GET(req: NextRequest) {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin).replace(/\/$/, "");
  const redirectBack = (status: string, msg: string) => {
    const res = NextResponse.redirect(
      `${appUrl}/?mail_oauth=${encodeURIComponent(status)}&mail_msg=${encodeURIComponent(msg)}`
    );
    res.cookies.set("aven_mail_oauth_ctx", "", {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/api/mail/oauth/callback",
      maxAge: 0,
    });
    return res;
  };

  const sp = req.nextUrl.searchParams;
  const oauthError = sp.get("error");
  if (oauthError) {
    const desc = sp.get("error_description");
    const msg =
      oauthError === "access_denied"
        ? "Zoho OAuth authorization rejected by user (access_denied)."
        : `Zoho OAuth authorization rejected: ${desc || oauthError}`;
    return redirectBack("error", msg);
  }

  const code = sp.get("code") || "";
  const state = sp.get("state") || "";
  if (!code || !state) {
    return redirectBack("error", "Missing OAuth authorization code or state.");
  }

  // 1. Resolve and validate initiating ERP session:
  //    - Prefer direct header/cookie authentication if present (e.g. x-tab-session or SameSite-compatible request).
  //    - Otherwise securely revalidate the initiating session bound in the encrypted HttpOnly SameSite=Lax
  //      aven_mail_oauth_ctx cookie (since browsers withhold SameSite=Strict cookies on cross-site Zoho redirects).
  let session: SessionData | null = null;
  let boundCtx: OAuthCtxCookie | null = null;

  const directAuth = await authenticateRequest(req);
  if (!("error" in directAuth)) {
    session = directAuth.user;
  } else {
    const rawCtx = req.cookies.get("aven_mail_oauth_ctx")?.value || "";
    if (rawCtx) {
      try {
        const decrypted = decryptSecret(rawCtx);
        if (decrypted) {
          const parsed = JSON.parse(decrypted) as OAuthCtxCookie;
          if (
            parsed &&
            typeof parsed.state === "string" &&
            typeof parsed.sessionToken === "string" &&
            typeof parsed.sessionId === "string" &&
            typeof parsed.userId === "string" &&
            parsed.state === state &&
            Number(parsed.expiresAtMs || 0) > Date.now()
          ) {
            const verified = await verifySession(parsed.sessionToken);
            if (verified && verified.id === parsed.sessionId && verified.userId === parsed.userId) {
              session = verified;
              boundCtx = parsed;
            }
          }
        }
      } catch {
        // Invalid or tampered cookie — treated as unauthenticated
      }
    }
  }

  if (!session) {
    return redirectBack("error", "Session expired or invalid. Please sign in and retry Zoho connection.");
  }
  if (session.mustChangePassword) {
    return redirectBack("error", "Password change required before completing Zoho OAuth.");
  }

  const canManage =
    normalizeRole(session.role) === "Admin" || hasPermission(session, "mail.manage_accounts");
  if (!canManage) {
    return redirectBack("error", "Forbidden: Administrator authorization required.");
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
    if (stRow.user_id !== session.userId) {
      return redirectBack("error", "OAuth session mismatch.");
    }
    if (boundCtx && boundCtx.mailboxId && boundCtx.mailboxId !== stRow.mailbox_id) {
      return redirectBack("error", "OAuth mailbox state mismatch.");
    }

    // Atomically consume state (single-use + race/replay protection)
    const consumeRes = await query(
      `UPDATE mail_oauth_states SET used_at = NOW() WHERE state = $1 AND used_at IS NULL RETURNING state`,
      [state]
    );
    if (!consumeRes || consumeRes.rows.length === 0) {
      return redirectBack("error", "OAuth state already consumed (replay blocked).");
    }

    const mbxRes = await query(
      `SELECT id, email_address, accounts_base_url, mail_base_url FROM mail_accounts WHERE id = $1 LIMIT 1`,
      [stRow.mailbox_id]
    );
    const mbx = mbxRes?.rows[0];
    if (!mbx) {
      return redirectBack("error", "Target mailbox record not found.");
    }

    const cfg = getZohoConfig();
    if (!cfg.configured) {
      return redirectBack("error", "Invalid OAuth configuration: Zoho client credentials are not configured.");
    }

    let tokens: Awaited<ReturnType<typeof exchangeZohoAuthCode>>;
    try {
      tokens = await exchangeZohoAuthCode({
        code,
        codeVerifier: stRow.code_verifier,
        accountsBaseUrl: mbx.accounts_base_url || cfg.accountsBase,
      });
    } catch (tokErr: any) {
      return redirectBack("error", `Zoho token exchange failed: ${tokErr?.message || "Invalid or expired code."}`);
    }

    let accounts: Awaited<ReturnType<typeof discoverZohoAccounts>>;
    try {
      accounts = await discoverZohoAccounts(tokens.accessToken, mbx.mail_base_url || cfg.mailBase);
    } catch (discErr: any) {
      return redirectBack("error", `Zoho API access denied or account discovery failed: ${discErr?.message || "Check Zoho Mail scopes."}`);
    }

    const targetEmailLower = String(mbx.email_address).toLowerCase();
    const matched = accounts.find(
      (a) =>
        a.primaryEmailAddress === targetEmailLower ||
        a.allowedSendAs.some((s) => s.toLowerCase() === targetEmailLower)
    );

    if (!matched) {
      const discoveredList = accounts.map((a) => a.primaryEmailAddress).filter(Boolean).join(", ");
      await logAudit(
        session.userId,
        "MAILBOX_OAUTH_MISMATCH",
        {
          mailboxId: mbx.id,
          expectedEmail: mbx.email_address,
          discoveredEmails: discoveredList,
        },
        { actorName: session.name, module: "mail", recordRef: mbx.email_address, outcome: "DENIED" }
      );
      return redirectBack(
        "error",
        `Wrong Zoho account selected. Expected ${mbx.email_address}, but authorized ${discoveredList || "a different Zoho account"}.`
      );
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
      session.userId,
      "MAILBOX_CONNECTED",
      { mailboxId: mbx.id, email: mbx.email_address, providerAccountId: matched.accountId, mailboxType: discoveredType },
      { actorName: session.name, module: "mail", recordRef: mbx.email_address, outcome: "SUCCESS" }
    );

    return redirectBack("connected", `${mbx.email_address} connected successfully (${discoveredType}).`);
  } catch (err: any) {
    console.error("Zoho OAuth callback error:", err);
    return redirectBack("error", err?.message || "Zoho OAuth callback failed.");
  }
}
