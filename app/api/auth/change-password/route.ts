import { NextRequest, NextResponse } from "next/server";
import { query, isProduction } from "@/lib/db";
import {
  DEFAULT_PASSWORD_EXPIRY_DAYS,
  PASSWORD_HISTORY_LIMIT,
  authenticateRequest,
  checkRateLimit,
  createSession,
  hashPassword,
  logAudit,
  recordFailedLogin,
  resetLoginAttempts,
  revokeAllUserSessions,
  validatePasswordStrength,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { allowPasswordChangeOnly: true });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const session = auth.user;
  const rateKey = `chgpw:${session.userId}`;
  const rateCheck = await checkRateLimit(rateKey);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: `Too many password change attempts. Try again in ${rateCheck.waitSeconds} seconds.` },
      { status: 429 }
    );
  }

  try {
    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    const confirmPassword = String(body.confirmPassword || "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Current password, new password, and confirmation are required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    const userRes = await query(`SELECT * FROM users WHERE id = $1 LIMIT 1`, [session.userId]);
    if (!userRes || userRes.rows.length === 0) {
      return NextResponse.json({ error: "User record not found in database." }, { status: 404 });
    }

    const userRow = userRes.rows[0];
    if (!verifyPassword(currentPassword, userRow.password || "")) {
      await recordFailedLogin(rateKey);
      await logAudit(
        session.userId,
        "PASSWORD_CHANGE_FAILED_CURRENT",
        { email: session.email },
        { actorName: session.name, module: "auth", outcome: "FAILURE" }
      );
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
    }

    // Check against current password and recent password history (last 5 hashes)
    if (verifyPassword(newPassword, userRow.password || "")) {
      return NextResponse.json(
        { error: "New password cannot be the same as your current password." },
        { status: 400 }
      );
    }

    const history: string[] = Array.isArray(userRow.password_history) ? userRow.password_history : [];
    for (const oldHash of history.slice(0, PASSWORD_HISTORY_LIMIT)) {
      if (verifyPassword(newPassword, oldHash)) {
        return NextResponse.json(
          { error: `Cannot reuse any of your last ${PASSWORD_HISTORY_LIMIT} passwords.` },
          { status: 400 }
        );
      }
    }

    await resetLoginAttempts(rateKey);

    const newHash = hashPassword(newPassword);
    const updatedHistory = [userRow.password, ...history].filter(Boolean).slice(0, PASSWORD_HISTORY_LIMIT);
    const policyDays = Number(userRow.password_policy_days || DEFAULT_PASSWORD_EXPIRY_DAYS) || DEFAULT_PASSWORD_EXPIRY_DAYS;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + policyDays * 24 * 60 * 60 * 1000);

    await query(
      `UPDATE users
       SET password = $1,
           password_changed_at = $2,
           password_expires_at = $3,
           must_change_password = false,
           password_history = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [newHash, now.toISOString(), expiresAt.toISOString(), JSON.stringify(updatedHistory), session.userId]
    );

    // Revoke all previous sessions across all devices/tabs and issue a fresh full session
    await revokeAllUserSessions(session.userId);

    const newSession = await createSession(
      {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: session.role,
        permissions: session.permissions,
        status: userRow.status,
        password_expires_at: expiresAt.toISOString(),
      },
      { mustChangePassword: false, passwordExpiresAt: expiresAt.toISOString() }
    );

    await logAudit(
      session.userId,
      session.mustChangePassword ? "FORCED_PASSWORD_CHANGED" : "PASSWORD_CHANGED",
      { email: session.email, nextExpiry: expiresAt.toISOString() },
      { actorName: session.name, module: "auth", outcome: "SUCCESS" }
    );

    const res = NextResponse.json({
      success: true,
      passwordExpiresAt: expiresAt.toISOString(),
      session: {
        token: newSession.token,
        expiresAt: newSession.expiresAt.toISOString(),
        mustChangePassword: false,
        passwordExpiresAt: expiresAt.toISOString(),
      },
    });

    res.cookies.set("aven_session", newSession.token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      path: "/",
      expires: newSession.expiresAt,
    });

    return res;
  } catch (err: any) {
    console.error("Change password error:", err?.message || err);
    return NextResponse.json({ error: "Failed to update password." }, { status: 500 });
  }
}
