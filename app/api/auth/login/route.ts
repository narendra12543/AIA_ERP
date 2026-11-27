import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { defaultUsers } from "@/lib/sample-data";
import { User } from "@/lib/types";
import {
  DEFAULT_PASSWORD_EXPIRY_DAYS,
  ENABLE_MANDATORY_MFA,
  ENABLE_PASSWORD_EXPIRY,
  verifyPassword,
  checkRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  createSession,
  createSecurityAlert,
  extractTrustedIp,
  hashToken,
  logAudit,
} from "@/lib/auth";
import { normalizeRole, resolveEffectivePermissions } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const trimmedEmail = String(email || "").trim().toLowerCase();
    const enteredPassword = String(password || "");

    if (!trimmedEmail || !enteredPassword) {
      return NextResponse.json(
        { error: "Invalid credentials. Please provide work email and password." },
        { status: 400 }
      );
    }

    const clientIp = extractTrustedIp(req);
    const ipRateKey = `ip:${clientIp}`;

    // Distributed Rate Limiting (Account + IP)
    const emailRateCheck = await checkRateLimit(trimmedEmail);
    if (!emailRateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${emailRateCheck.waitSeconds} seconds.`,
        },
        { status: 429 }
      );
    }
    const ipRateCheck = await checkRateLimit(ipRateKey);
    if (!ipRateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many login attempts from this network. Please try again in ${ipRateCheck.waitSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    await initDb();

    let userRecord: User | null = null;
    let storedPasswordHash = "";
    let passwordExpiresAt: string | null = null;
    let mustChangePassword = false;
    let policyDays = DEFAULT_PASSWORD_EXPIRY_DAYS;
    let fromDatabase = false;

    let mfaEnabled = false;
    let approvalStatus = "Approved";

    const dbRes = await query(`SELECT * FROM users WHERE LOWER(email) = $1`, [trimmedEmail]);
    if (dbRes && dbRes.rows.length > 0) {
      fromDatabase = true;
      const row = dbRes.rows[0];
      mfaEnabled = Boolean(row.mfa_enabled);
      approvalStatus = row.approval_status || "Approved";
      policyDays = Number(row.password_policy_days || DEFAULT_PASSWORD_EXPIRY_DAYS) || DEFAULT_PASSWORD_EXPIRY_DAYS;
      passwordExpiresAt = row.password_expires_at ? new Date(row.password_expires_at).toISOString() : null;
      const expiredByDate =
        ENABLE_PASSWORD_EXPIRY &&
        passwordExpiresAt !== null &&
        new Date(passwordExpiresAt).getTime() <= Date.now();
      mustChangePassword = Boolean(row.must_change_password) || expiredByDate;

      userRecord = {
        id: row.id,
        email: row.email,
        name: row.name,
        role: normalizeRole(row.role),
        permissions: Array.isArray(row.permissions) ? row.permissions : undefined,
        status: row.status as "active" | "inactive",
        password_changed_at: row.password_changed_at ? new Date(row.password_changed_at).toISOString() : null,
        password_expires_at: passwordExpiresAt,
        must_change_password: mustChangePassword,
        created_at: row.created_at,
      };
      storedPasswordHash = row.password || "";
    } else if (!isProduction) {
      // Development-only offline fallback (strictly disabled in production)
      const fallback = defaultUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (fallback) {
        userRecord = { ...fallback, role: normalizeRole(fallback.role) };
        storedPasswordHash = fallback.password || (userRecord.role === "Admin" ? "admin123" : "user123");
      }
    }

    if (!userRecord) {
      await recordFailedLogin(trimmedEmail);
      await recordFailedLogin(ipRateKey);
      await logAudit(null, "LOGIN_FAILED_UNKNOWN_USER", { ip: clientIp }, { module: "auth", outcome: "FAILURE" });
      return NextResponse.json(
        { error: "Invalid credentials. Please verify your email and password." },
        { status: 401 }
      );
    }

    if (approvalStatus !== "Approved") {
      await logAudit(userRecord.id, "LOGIN_BLOCKED_UNAPPROVED", { email: trimmedEmail, approvalStatus }, { actorName: userRecord.name, module: "auth", outcome: "BLOCKED" });
      return NextResponse.json(
        {
          error: `Account access is restricted (${approvalStatus}). Explicit Administrator approval is required.`,
          code: "ACCOUNT_NOT_APPROVED",
          approvalStatus,
        },
        { status: 403 }
      );
    }

    if (userRecord.status !== "active") {
      await logAudit(userRecord.id, "LOGIN_BLOCKED_INACTIVE", { email: trimmedEmail, status: userRecord.status }, { actorName: userRecord.name, module: "auth", outcome: "BLOCKED" });
      return NextResponse.json(
        { error: `This account is currently ${userRecord.status}. Please contact the ERP administrator.` },
        { status: 403 }
      );
    }

    const isValid = verifyPassword(enteredPassword, storedPasswordHash);
    if (!isValid) {
      await recordFailedLogin(trimmedEmail);
      await recordFailedLogin(ipRateKey);
      await logAudit(
        userRecord.id,
        "LOGIN_FAILED_PASSWORD",
        { email: trimmedEmail, ip: clientIp },
        { actorName: userRecord.name, module: "auth", outcome: "FAILURE" }
      );
      void createSecurityAlert({
        severity: "warning",
        category: "failed_login",
        title: "Failed Login Attempt",
        message: `Invalid password attempt for ${trimmedEmail} from IP ${clientIp}.`,
        actorEmail: trimmedEmail,
      });
      return NextResponse.json(
        { error: "Invalid credentials. Please verify your email and password." },
        { status: 401 }
      );
    }

    // Login succeeded: reset rate limits
    await resetLoginAttempts(trimmedEmail);
    await resetLoginAttempts(ipRateKey);

    // If MFA is enrolled (or mandatory MFA active), issue short-lived challenge WITHOUT granting an ERP session
    if (fromDatabase && (mfaEnabled || ENABLE_MANDATORY_MFA)) {
      if (!mfaEnabled) {
        // Admin/User must enroll MFA first via secure challenge? If mandatory MFA is enabled before enrollment, block safely with clear code
        return NextResponse.json(
          {
            error: "MFA enrollment is required before accessing the ERP. Contact Administrator.",
            code: "MFA_ENROLLMENT_REQUIRED",
          },
          { status: 403 }
        );
      }
      const challengeToken = crypto.randomBytes(24).toString("hex");
      const challengeId = "chal_" + crypto.randomBytes(8).toString("hex");
      await query(
        `INSERT INTO auth_challenges (id, user_id, purpose, challenge_token_hash, ip_approx, expires_at)
         VALUES ($1, $2, 'mfa_login', $3, $4, $5)`,
        [
          challengeId,
          userRecord.id,
          hashToken(challengeToken),
          clientIp,
          new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        ]
      );
      return NextResponse.json({
        success: true,
        mfaRequired: true,
        challengeToken,
        mustChangePassword,
      });
    }

    // Update last_login_at and establish baseline password_expires_at if missing (without inventing password_changed_at)
    if (fromDatabase) {
      try {
        if (!passwordExpiresAt && ENABLE_PASSWORD_EXPIRY) {
          const baselineExpiry = new Date(Date.now() + policyDays * 24 * 60 * 60 * 1000).toISOString();
          passwordExpiresAt = baselineExpiry;
          await query(
            `UPDATE users SET last_login_at = NOW(), password_expires_at = $1, updated_at = NOW() WHERE id = $2`,
            [baselineExpiry, userRecord.id]
          );
        } else {
          await query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [userRecord.id]);
        }
      } catch {}
    }

    // Create session (restricted if mustChangePassword is true)
    const session = await createSession(userRecord, {
      mustChangePassword,
      passwordExpiresAt,
    });

    const safeUser = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: session.role,
      permissions: Array.from(resolveEffectivePermissions({ role: session.role, permissions: userRecord.permissions })),
      status: userRecord.status,
      must_change_password: mustChangePassword,
      password_expires_at: passwordExpiresAt,
    };

    const res = NextResponse.json({
      success: true,
      user: safeUser,
      mustChangePassword,
      session: {
        expiresAt: session.expiresAt.toISOString(),
        token: session.token,
        mustChangePassword,
        passwordExpiresAt,
      },
    });

    res.cookies.set("aven_session", session.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      expires: session.expiresAt,
    });

    return res;
  } catch (err: any) {
    console.error("Authentication error:", err?.message || err);
    return NextResponse.json(
      { error: "An authentication error occurred. Please try again." },
      { status: 500 }
    );
  }
}
