import crypto from "crypto";
import { NextRequest } from "next/server";
import { query, initDb, isProduction } from "./db";
import { User } from "./types";
import {
  CanonicalRole,
  PermissionKey,
  hasPermission,
  normalizeRole,
  resolveEffectivePermissions,
} from "./permissions";

export const DEFAULT_PASSWORD_EXPIRY_DAYS = Math.max(
  1,
  Number(process.env.PASSWORD_EXPIRY_DAYS || 15) || 15
);
export const ENABLE_PASSWORD_EXPIRY = process.env.ENABLE_PASSWORD_EXPIRY !== "false";
export const ENABLE_RBAC_ENFORCEMENT = process.env.ENABLE_RBAC_ENFORCEMENT !== "false";
export const PASSWORD_HISTORY_LIMIT = 5;

const COMMON_WEAK_PASSWORDS = new Set([
  "123456789012",
  "password1234",
  "password12345",
  "password123456",
  "qwerty123456",
  "admin1234567",
  "letmein12345",
  "welcome12345",
  "avenautomation",
  "spareconn1234",
]);

export interface SessionData {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: CanonicalRole;
  permissions: PermissionKey[];
  mustChangePassword: boolean;
  passwordExpiresAt?: string | null;
  expiresAt: Date;
  token: string;
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string; score: number } {
  const pw = String(password || "");
  if (pw.length < 12) {
    return { valid: false, error: "Password must be at least 12 characters long (passphrases supported).", score: 1 };
  }
  if (pw.length > 128) {
    return { valid: false, error: "Password must not exceed 128 characters.", score: 1 };
  }
  const lower = pw.toLowerCase().trim();
  if (COMMON_WEAK_PASSWORDS.has(lower) || /^(.)\1+$/.test(lower)) {
    return { valid: false, error: "This password is too common or repetitive. Please choose a stronger password or passphrase.", score: 1 };
  }

  let score = 2;
  if (pw.length >= 16) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) || /[^a-zA-Z0-9\s]/.test(pw)) score++;
  if (pw.trim().includes(" ") && pw.length >= 14) score = Math.max(score, 4); // Passphrase bonus

  return { valid: true, score: Math.min(5, score) };
}

// Memory-hard Salted Scrypt Password Hashing
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    if (!storedHash || !storedHash.includes(":")) {
      // Legacy plaintext fallback check (for migration compatibility only)
      return password === storedHash;
    }
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}

const globalForAuth = globalThis as unknown as {
  activeSessions?: Map<string, SessionData>;
  loginRateLimitMap?: Map<string, RateLimitRecord>;
};

export const activeSessions = globalForAuth.activeSessions || new Map<string, SessionData>();
export const loginRateLimitMap = globalForAuth.loginRateLimitMap || new Map<string, RateLimitRecord>();

globalForAuth.activeSessions = activeSessions;
globalForAuth.loginRateLimitMap = loginRateLimitMap;

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; waitSeconds?: number }> {
  const now = Date.now();
  await initDb();

  try {
    const res = await query(`SELECT attempts, locked_until FROM login_attempts WHERE key = $1`, [key]);
    if (res && res.rows.length > 0) {
      const row = res.rows[0];
      const lockedUntil = Number(row.locked_until || 0);
      if (lockedUntil > now) {
        const waitSeconds = Math.ceil((lockedUntil - now) / 1000);
        return { allowed: false, waitSeconds };
      }
      if (lockedUntil <= now && row.attempts >= 5) {
        await query(`DELETE FROM login_attempts WHERE key = $1`, [key]);
        loginRateLimitMap.delete(key);
        return { allowed: true };
      }
    }
  } catch {}

  const record = loginRateLimitMap.get(key);
  if (!record) return { allowed: true };

  if (record.lockedUntil > now) {
    return { allowed: false, waitSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  if (record.lockedUntil <= now && record.attempts >= 5) {
    loginRateLimitMap.delete(key);
  }
  return { allowed: true };
}

export async function recordFailedLogin(key: string) {
  const now = Date.now();
  const record = loginRateLimitMap.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;

  if (record.attempts >= 5) {
    record.lockedUntil = now + 5 * 60 * 1000;
  }
  loginRateLimitMap.set(key, record);

  try {
    await initDb();
    const lockedUntil = record.attempts >= 5 ? now + 5 * 60 * 1000 : 0;
    await query(
      `INSERT INTO login_attempts (key, attempts, locked_until, updated_at)
       VALUES ($1, 1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET
         attempts = login_attempts.attempts + 1,
         locked_until = CASE WHEN login_attempts.attempts + 1 >= 5 THEN $3 ELSE login_attempts.locked_until END,
         updated_at = NOW()`,
      [key, lockedUntil, now + 5 * 60 * 1000]
    );
  } catch {}
}

export async function resetLoginAttempts(key: string) {
  loginRateLimitMap.delete(key);
  try {
    await query(`DELETE FROM login_attempts WHERE key = $1`, [key]);
  } catch {}
}

export async function createSession(
  user: User,
  options?: { mustChangePassword?: boolean; passwordExpiresAt?: string | null }
): Promise<SessionData> {
  await initDb();
  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = "sess_" + crypto.randomBytes(12).toString("hex");
  const canonicalRole = normalizeRole(user.role);
  const mustChangePassword = Boolean(options?.mustChangePassword);

  // Fixed Session Expiry from login: ADMIN 20 mins, STAFF 15 mins (restricted challenge: 10 mins)
  const durationMinutes = mustChangePassword ? 10 : canonicalRole === "Admin" ? 20 : 15;
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  const effectivePermissions = Array.from(resolveEffectivePermissions({ role: canonicalRole, permissions: user.permissions }));

  const sessionData: SessionData = {
    id: sessionId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: canonicalRole,
    permissions: effectivePermissions,
    mustChangePassword,
    passwordExpiresAt: options?.passwordExpiresAt ?? user.password_expires_at ?? null,
    expiresAt,
    token,
  };
  activeSessions.set(token, sessionData);

  try {
    await query(
      `INSERT INTO sessions (id, user_id, role, token, expires_at, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [sessionId, user.id, canonicalRole, token, expiresAt.toISOString(), mustChangePassword]
    );
  } catch (e: any) {
    console.error("Failed to persist session in PostgreSQL:", e?.message || e);
    if (isProduction) {
      throw new Error("Unable to persist authenticated session to database.");
    }
  }

  await logAudit(
    user.id,
    mustChangePassword ? "LOGIN_PASSWORD_CHANGE_REQUIRED" : "LOGIN_SUCCESS",
    { role: canonicalRole, email: user.email },
    { actorName: user.name, module: "auth", outcome: "SUCCESS" }
  );

  return sessionData;
}

export async function verifySession(token: string): Promise<SessionData | null> {
  if (!token) return null;
  await initDb();

  try {
    const res = await query(
      `SELECT s.id, s.user_id, s.role, s.expires_at, s.token, s.must_change_password AS sess_must_change,
              u.email, u.name, u.role AS user_role, u.status, u.permissions,
              u.must_change_password AS user_must_change, u.password_expires_at
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1`,
      [token]
    );

    if (res && res.rows.length > 0) {
      const row = res.rows[0];
      const expiresAt = new Date(row.expires_at);

      if (row.status !== "active") {
        await revokeSession(token);
        return null;
      }

      if (expiresAt.getTime() <= Date.now()) {
        await revokeSession(token);
        return null;
      }

      const canonicalRole = normalizeRole(row.user_role || row.role);
      const pwExpired =
        ENABLE_PASSWORD_EXPIRY &&
        row.password_expires_at &&
        new Date(row.password_expires_at).getTime() <= Date.now();
      const mustChangePassword = Boolean(row.sess_must_change || row.user_must_change || pwExpired);
      const effectivePermissions = Array.from(
        resolveEffectivePermissions({ role: canonicalRole, permissions: row.permissions })
      );

      const sessionData: SessionData = {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: canonicalRole,
        permissions: effectivePermissions,
        mustChangePassword,
        passwordExpiresAt: row.password_expires_at ? new Date(row.password_expires_at).toISOString() : null,
        expiresAt,
        token: row.token,
      };
      activeSessions.set(token, sessionData);
      return sessionData;
    }
  } catch {}

  if (!isProduction) {
    const memSession = activeSessions.get(token);
    if (memSession) {
      if (memSession.expiresAt.getTime() <= Date.now()) {
        activeSessions.delete(token);
        return null;
      }
      return memSession;
    }
  }

  return null;
}

export async function revokeSession(token: string): Promise<boolean> {
  if (!token) return false;
  activeSessions.delete(token);
  try {
    await query(`DELETE FROM sessions WHERE token = $1`, [token]);
  } catch {}
  return true;
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  for (const [tok, sess] of Array.from(activeSessions.entries())) {
    if (sess.userId === userId) {
      activeSessions.delete(tok);
    }
  }
  try {
    await query(`DELETE FROM sessions WHERE user_id = $1`, [userId]);
  } catch {}
}

export async function logAudit(
  userId: string | null,
  action: string,
  details?: any,
  meta?: {
    actorName?: string | null;
    module?: string | null;
    recordRef?: string | null;
    outcome?: string | null;
    requestId?: string | null;
  }
) {
  try {
    const id = "log_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
    await query(
      `INSERT INTO audit_logs (id, user_id, actor_name, action, module, record_ref, outcome, request_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        userId || "system",
        meta?.actorName || null,
        action,
        meta?.module || null,
        meta?.recordRef || null,
        meta?.outcome || "SUCCESS",
        meta?.requestId || null,
        details ? JSON.stringify(details) : null,
      ]
    );
  } catch {
    // Audit logging must never crash the primary transaction
  }
}

export interface AuthGuardOptions {
  requiredRole?: "Admin" | "Staff";
  requiredPermission?: PermissionKey;
  allowPasswordChangeOnly?: boolean;
}

export async function authenticateRequest(
  req: NextRequest,
  roleOrOptions?: "Admin" | "User" | AuthGuardOptions
): Promise<{ user: SessionData } | { error: string; status: number; code?: string }> {
  const token =
    req.headers.get("x-tab-session") ||
    req.cookies.get("aven_session")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { error: "Unauthorized: Missing authentication credentials", status: 401 };
  }

  const session = await verifySession(token);
  if (!session) {
    return { error: "Unauthorized: Invalid or expired session", status: 401 };
  }

  const opts: AuthGuardOptions =
    typeof roleOrOptions === "string"
      ? { requiredRole: roleOrOptions === "Admin" ? "Admin" : "Staff" }
      : roleOrOptions || {};

  if (session.mustChangePassword && !opts.allowPasswordChangeOnly) {
    return {
      error: "Password change required before accessing ERP modules.",
      status: 403,
      code: "PASSWORD_CHANGE_REQUIRED",
    };
  }

  if (opts.requiredRole === "Admin" && session.role !== "Admin") {
    return { error: "Forbidden: Admin privileges required", status: 403 };
  }

  if (ENABLE_RBAC_ENFORCEMENT && opts.requiredPermission && !hasPermission(session, opts.requiredPermission)) {
    return {
      error: `Forbidden: Missing required permission (${opts.requiredPermission})`,
      status: 403,
      code: "PERMISSION_DENIED",
    };
  }

  return { user: session };
}
