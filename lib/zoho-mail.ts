import crypto from "crypto";
import { query } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";

export const ZOHO_OAUTH_SCOPES = [
  "ZohoMail.accounts.READ",
  "ZohoMail.folders.ALL",
  "ZohoMail.messages.ALL",
  "ZohoMail.attachments.READ",
  "ZohoMail.tags.ALL",
] as const;

const ALLOWED_ACCOUNTS_HOSTS = new Set([
  "accounts.zoho.in",
  "accounts.zoho.com",
  "accounts.zoho.eu",
  "accounts.zoho.com.au",
  "accounts.zoho.jp",
]);

const ALLOWED_MAIL_HOSTS = new Set([
  "mail.zoho.in",
  "mail.zoho.com",
  "mail.zoho.eu",
  "mail.zoho.com.au",
  "mail.zoho.jp",
]);

export function getZohoConfig() {
  const clientId = (process.env.ZOHO_CLIENT_ID || process.env.ZOHO_OAUTH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.ZOHO_CLIENT_SECRET || process.env.ZOHO_OAUTH_CLIENT_SECRET || "").trim();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://erp.avenautomation.in").replace(/\/$/, "");
  const redirectUri = (process.env.ZOHO_REDIRECT_URI || `${appUrl}/api/mail/oauth/callback`).trim();
  const accountsBase = (process.env.ZOHO_ACCOUNTS_BASE_URL || "https://accounts.zoho.in").replace(/\/$/, "");
  const mailBase = (process.env.ZOHO_MAIL_BASE_URL || "https://mail.zoho.in").replace(/\/$/, "");

  // Enforce allowlisted Zoho endpoints
  const accHost = new URL(accountsBase).hostname.toLowerCase();
  const mailHost = new URL(mailBase).hostname.toLowerCase();
  if (!ALLOWED_ACCOUNTS_HOSTS.has(accHost) || !ALLOWED_MAIL_HOSTS.has(mailHost)) {
    throw new Error("Blocked non-allowlisted Zoho endpoint configuration.");
  }

  return {
    configured: Boolean(clientId && clientSecret),
    clientId,
    clientSecret,
    redirectUri,
    accountsBase,
    mailBase,
  };
}

export function isZohoMockEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.ZOHO_MOCK_MODE === "true";
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function buildZohoAuthUrl(params: {
  state: string;
  codeChallenge: string;
  loginHint?: string;
  accountsBaseUrl?: string;
}): string {
  const cfg = getZohoConfig();
  if (!cfg.configured) {
    throw new Error("ZOHO_CREDENTIALS_MISSING");
  }
  const base = params.accountsBaseUrl || cfg.accountsBase;
  const host = new URL(base).hostname.toLowerCase();
  if (!ALLOWED_ACCOUNTS_HOSTS.has(host)) {
    throw new Error("Invalid Zoho accounts base URL.");
  }

  const u = new URL(`${base}/oauth/v2/auth`);
  u.searchParams.set("scope", ZOHO_OAUTH_SCOPES.join(","));
  u.searchParams.set("client_id", cfg.clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("access_type", "offline");
  u.searchParams.set("redirect_uri", cfg.redirectUri);
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("state", params.state);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (params.loginHint) {
    u.searchParams.set("login_hint", params.loginHint);
  }
  return u.toString();
}

export async function exchangeZohoAuthCode(params: {
  code: string;
  codeVerifier: string;
  accountsBaseUrl?: string;
}) {
  const cfg = getZohoConfig();
  const base = params.accountsBaseUrl || cfg.accountsBase;
  const form = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    redirect_uri: cfg.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });

  const res = await fetch(`${base}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || !data.access_token) {
    throw new Error(data.error_description || data.error || `Zoho token exchange failed (${res.status})`);
  }

  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : null,
    expiresIn: Number(data.expires_in || 3600),
    apiDomain: data.api_domain ? String(data.api_domain) : null,
    scope: data.scope ? String(data.scope) : ZOHO_OAUTH_SCOPES.join(","),
  };
}

export async function revokeZohoRefreshToken(refreshToken: string, accountsBaseUrl?: string) {
  try {
    const cfg = getZohoConfig();
    const base = accountsBaseUrl || cfg.accountsBase;
    const form = new URLSearchParams({ token: refreshToken });
    await fetch(`${base}/oauth/v2/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
  } catch {
    // Non-fatal: local disconnect always proceeds
  }
}

export interface DiscoveredZohoAccount {
  accountId: string;
  primaryEmailAddress: string;
  displayName: string;
  mailboxType: "independent" | "alias" | "shared" | "group";
  allowedSendAs: string[];
  incomingBlocked: boolean;
  outgoingBlocked: boolean;
}

export async function discoverZohoAccounts(
  accessToken: string,
  mailBaseUrl?: string
): Promise<DiscoveredZohoAccount[]> {
  const cfg = getZohoConfig();
  const base = mailBaseUrl || cfg.mailBase;
  const res = await fetch(`${base}/api/accounts`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json?.data)) {
    throw new Error(json?.data?.moreInfo || json?.status?.description || `Zoho account discovery failed (${res.status})`);
  }

  return json.data.map((acc: any) => {
    const sendAs = Array.isArray(acc.sendMailDetails)
      ? acc.sendMailDetails.map((s: any) => String(s.fromAddress || "").trim()).filter(Boolean)
      : [];
    const primary = String(acc.primaryEmailAddress || acc.mailboxAddress || sendAs[0] || "").trim().toLowerCase();
    const rawType = String(acc.type || "").toLowerCase();
    const mailboxType: DiscoveredZohoAccount["mailboxType"] =
      rawType.includes("group")
        ? "group"
        : rawType.includes("shared")
        ? "shared"
        : rawType.includes("alias")
        ? "alias"
        : "independent";

    return {
      accountId: String(acc.accountId),
      primaryEmailAddress: primary,
      displayName: String(acc.displayName || acc.accountDisplayName || "Aven Industrial Automation"),
      mailboxType,
      allowedSendAs: Array.from(new Set([primary, ...sendAs].filter(Boolean))),
      incomingBlocked: Boolean(acc.incomingBlocked),
      outgoingBlocked: Boolean(acc.outgoingBlocked),
    };
  });
}

// Single-flight concurrent refresh lock per mailboxId
const inFlightRefreshMap = new Map<string, Promise<string>>();

export async function getValidMailboxAccessToken(mailboxId: string): Promise<{
  accessToken: string;
  accountId: string;
  mailBaseUrl: string;
  emailAddress: string;
  displayName: string;
  allowedSendAs: string[];
}> {
  const res = await query(
    `SELECT id, provider_account_id, email_address, display_name, allowed_send_as,
            encrypted_refresh_token, encrypted_access_token, access_token_expires_at,
            accounts_base_url, mail_base_url, connection_status, is_enabled
     FROM mail_accounts
     WHERE id = $1
     LIMIT 1`,
    [mailboxId]
  );
  const row = res?.rows[0];
  if (!row) throw new Error("Mailbox not found.");
  if (!row.is_enabled) throw new Error("Mailbox is disabled by Administrator.");
  if (row.connection_status !== "Connected") {
    throw new Error(`Mailbox ${row.email_address} is ${row.connection_status}. Please connect via OAuth first.`);
  }

  const mailBaseUrl = String(row.mail_base_url || "https://mail.zoho.in").replace(/\/$/, "");
  const accountsBaseUrl = String(row.accounts_base_url || "https://accounts.zoho.in").replace(/\/$/, "");
  const accountId = String(row.provider_account_id || "");
  if (!accountId && !isZohoMockEnabled()) {
    throw new Error("Provider accountId missing. Reconnect mailbox via OAuth.");
  }

  const cachedAccess = decryptSecret(row.encrypted_access_token);
  const expiresAtMs = row.access_token_expires_at ? new Date(row.access_token_expires_at).getTime() : 0;
  // Reuse token if > 90s remaining
  if (cachedAccess && expiresAtMs - Date.now() > 90_000) {
    return {
      accessToken: cachedAccess,
      accountId,
      mailBaseUrl,
      emailAddress: row.email_address,
      displayName: row.display_name,
      allowedSendAs: Array.isArray(row.allowed_send_as) ? row.allowed_send_as : [row.email_address],
    };
  }

  // Single-flight refresh
  let refreshPromise = inFlightRefreshMap.get(mailboxId);
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = decryptSecret(row.encrypted_refresh_token);
      if (!refreshToken) {
        await query(
          `UPDATE mail_accounts SET connection_status = 'Revoked', last_error = 'Missing refresh token; reconnect required.', updated_at = NOW() WHERE id = $1`,
          [mailboxId]
        );
        throw new Error("Refresh token missing or revoked. Reconnect mailbox.");
      }

      const cfg = getZohoConfig();
      const form = new URLSearchParams({
        grant_type: "refresh_token",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        refresh_token: refreshToken,
      });

      const tokRes = await fetch(`${accountsBaseUrl}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const tokData = await tokRes.json().catch(() => ({}));
      if (!tokRes.ok || tokData.error || !tokData.access_token) {
        const errMsg = tokData.error_description || tokData.error || `Token refresh failed (${tokRes.status})`;
        const isRevoked = /invalid_grant|invalid_client|revoked/i.test(errMsg);
        await query(
          `UPDATE mail_accounts SET connection_status = $1, last_error = $2, updated_at = NOW() WHERE id = $3`,
          [isRevoked ? "Revoked" : "Error", errMsg, mailboxId]
        );
        throw new Error(errMsg);
      }

      const newAccess = String(tokData.access_token);
      const expiresIn = Number(tokData.expires_in || 3600);
      const newExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();
      await query(
        `UPDATE mail_accounts
         SET encrypted_access_token = $1, access_token_expires_at = $2, connection_status = 'Connected', last_error = NULL, updated_at = NOW()
         WHERE id = $3`,
        [encryptSecret(newAccess), newExpiry, mailboxId]
      );
      return newAccess;
    })().finally(() => {
      inFlightRefreshMap.delete(mailboxId);
    });
    inFlightRefreshMap.set(mailboxId, refreshPromise);
  }

  const freshAccess = await refreshPromise;
  return {
    accessToken: freshAccess,
    accountId,
    mailBaseUrl,
    emailAddress: row.email_address,
    displayName: row.display_name,
    allowedSendAs: Array.isArray(row.allowed_send_as) ? row.allowed_send_as : [row.email_address],
  };
}

export async function zohoFetch(
  mailboxId: string,
  pathSuffix: string,
  options: { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: any; isBinary?: boolean; headers?: Record<string, string> } = {}
): Promise<any> {
  const method = options.method || "GET";
  const ctx = await getValidMailboxAccessToken(mailboxId);
  const url = `${ctx.mailBaseUrl}/api/accounts/${encodeURIComponent(ctx.accountId)}${pathSuffix}`;

  const maxAttempts = method === "GET" ? 3 : 1; // Never blindly retry POST/PUT/DELETE sends
  let lastErr: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const headers: Record<string, string> = {
        Authorization: `Zoho-oauthtoken ${ctx.accessToken}`,
        ...(options.headers || {}),
      };
      let fetchBody: any = undefined;
      if (options.body !== undefined) {
        if (options.isBinary || Buffer.isBuffer(options.body) || options.body instanceof Uint8Array) {
          fetchBody = options.body;
        } else {
          headers["Content-Type"] = headers["Content-Type"] || "application/json";
          fetchBody = JSON.stringify(options.body);
        }
      }

      const res = await fetch(url, { method, headers, body: fetchBody, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 401) {
        throw new Error("Zoho authorization expired or revoked (401). Please reconnect mailbox.");
      }
      if ((res.status === 429 || res.status >= 502) && attempt < maxAttempts) {
        const backoff = 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 150);
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }

      if (options.isBinary) {
        if (!res.ok) throw new Error(`Zoho attachment fetch failed (${res.status})`);
        return { buffer: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") || "application/octet-stream" };
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.data?.moreInfo || json?.status?.description || `Zoho Mail API error (${res.status})`);
      }
      return { data: json?.data, status: json?.status, ctx };
    } catch (err: any) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt >= maxAttempts || /401|abort/i.test(String(err?.message || ""))) {
        break;
      }
    }
  }

  throw lastErr || new Error("Zoho Mail API request failed.");
}
