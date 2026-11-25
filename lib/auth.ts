import crypto from "crypto";
import { NextRequest } from "next/server";
import { query, initDb, isProduction } from "./db";
import { User } from "./types";

export interface SessionData {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: "Admin" | "User";
  expiresAt: Date;
  token: string;
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
      // Legacy plaintext fallback check
      return password === storedHash;
    }
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    return false;
  }
}

// Distributed & In-Memory Rate Limiting for Multi-Instance Protection
interface RateLimitRecord {
  attempts: number;
  lockedUntil: number;
}

// Global shared stores across Next.js route bundles and hot reloads
const globalForAuth = globalThis as unknown as {
  activeSessions?: Map<string, SessionData>;
  loginRateLimitMap?: Map<string, RateLimitRecord>;
};

export const activeSessions =
  globalForAuth.activeSessions || new Map<string, SessionData>();
export const loginRateLimitMap =
  globalForAuth.loginRateLimitMap || new Map<string, RateLimitRecord>();

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
  } catch (e) {}

  const record = loginRateLimitMap.get(key);
  if (!record) {
    return { allowed: true };
  }

  if (record.lockedUntil > now) {
    const waitSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  if (record.lockedUntil <= now && record.attempts >= 5) {
    loginRateLimitMap.delete(key);
    return { allowed: true };
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
  } catch (e) {}
}

export async function resetLoginAttempts(key: string) {
  loginRateLimitMap.delete(key);
  try {
    await query(`DELETE FROM login_attempts WHERE key = $1`, [key]);
  } catch (e) {}
}

// Create cryptographically secure session
export async function createSession(user: User): Promise<SessionData> {
  await initDb();
  const token = crypto.randomBytes(32).toString("hex");
  const sessionId = "sess_" + crypto.randomBytes(12).toString("hex");
  
  // Fixed Session Expiry from login: ADMIN 20 mins, USER 15 mins
  const durationMinutes = user.role === "Admin" ? 20 : 15;
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const sessionData: SessionData = {
    id: sessionId,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role === "Admin" ? "Admin" : "User",
    expiresAt,
    token,
  };
  activeSessions.set(token, sessionData);

  // Store in PostgreSQL (mandatory in production for cross-instance verification)
  try {
    await query(
      `INSERT INTO sessions (id, user_id, role, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [sessionId, user.id, user.role, token, expiresAt.toISOString()]
    );
  } catch (e: any) {
    console.error("Failed to persist session in PostgreSQL:", e?.message || e);
    if (isProduction) {
      throw new Error("Unable to persist authenticated session to database.");
    }
  }

  // Audit log
  await logAudit(user.id, "LOGIN_SUCCESS", { role: user.role, email: user.email });

  return sessionData;
}

// Verify Session Token (Server-Side)
export async function verifySession(token: string): Promise<SessionData | null> {
  if (!token) return null;
  await initDb();

  // 1. Try PostgreSQL if configured
  try {
    const res = await query(
      `SELECT s.id, s.user_id, s.role, s.expires_at, s.token, u.email, u.name, u.status
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token = $1`,
      [token]
    );

    if (res && res.rows.length > 0) {
      const row = res.rows[0];
      const expiresAt = new Date(row.expires_at);

      // Check if account disabled
      if (row.status !== "active") {
        await revokeSession(token);
        return null;
      }

      // Check if session expired
      if (expiresAt.getTime() <= Date.now()) {
        await revokeSession(token);
        return null;
      }

      const sessionData: SessionData = {
        id: row.id,
        userId: row.user_id,
        email: row.email,
        name: row.name,
        role: row.role === "Admin" ? "Admin" : "User",
        expiresAt,
        token: row.token,
      };
      activeSessions.set(token, sessionData);
      return sessionData;
    }
  } catch (e) {}

  // 2. Fallback to active in-memory session store (Development only)
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

// Revoke Session (Logout)
export async function revokeSession(token: string): Promise<boolean> {
  if (!token) return false;
  activeSessions.delete(token);
  try {
    await query(`DELETE FROM sessions WHERE token = $1`, [token]);
  } catch (e) {}
  return true;
}

// Audit Logger
export async function logAudit(userId: string, action: string, details?: any) {
  try {
    const id = "log_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
    await query(
      `INSERT INTO audit_logs (id, user_id, action, details)
       VALUES ($1, $2, $3, $4)`,
      [id, userId, action, details ? JSON.stringify(details) : null]
    );
  } catch (e) {
    // Audit log should never crash application
  }
}

// Request Authentication and Role Guard Helper
export async function authenticateRequest(
  req: NextRequest,
  requiredRole?: "Admin" | "User"
): Promise<{ user: SessionData } | { error: string; status: number }> {
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

  if (requiredRole === "Admin" && session.role !== "Admin") {
    return { error: "Forbidden: Admin privileges required", status: 403 };
  }

  return { user: session };
}
