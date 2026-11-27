import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { query, initDb, isProduction } from "@/lib/db";
import {
  authenticateRequest,
  checkRateLimit,
  createSecurityAlert,
  createSession,
  ENABLE_DEVICE_APPROVAL,
  extractTrustedIp,
  hashToken,
  logAudit,
  recordFailedLogin,
  revokeAllUserSessions,
  verifyPassword,
} from "@/lib/auth";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { normalizeRole, resolveEffectivePermissions } from "@/lib/permissions";
import {
  buildOtpAuthUri,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyAndConsumeRecoveryCode,
  verifyTotpCode,
} from "@/lib/totp";

function parseDeviceSummary(ua: string) {
  const browser = /Edg/i.test(ua)
    ? "Microsoft Edge"
    : /Chrome/i.test(ua)
    ? "Google Chrome"
    : /Safari/i.test(ua)
    ? "Safari"
    : /Firefox/i.test(ua)
    ? "Firefox"
    : "Browser";
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /iPhone|iPad/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
    ? "Android"
    : /Mac OS/i.test(ua)
    ? "macOS"
    : /Linux/i.test(ua)
    ? "Linux"
    : "Unknown OS";
  return { browser, os, deviceName: `${browser} on ${os}` };
}

// GET /api/auth/mfa — Generate QR & temp secret for authenticated user's MFA enrollment
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const uRes = await query(`SELECT id, email, mfa_enabled FROM users WHERE id = $1`, [auth.user.userId]);
    const row = uRes?.rows[0];
    if (!row) {
      return NextResponse.json({ error: "User record not found." }, { status: 404 });
    }
    if (row.mfa_enabled) {
      return NextResponse.json({ mfaEnabled: true, message: "MFA is already active on this account." });
    }

    const secret = generateTotpSecret();
    const otpAuthUri = buildOtpAuthUri(row.email, "AVEN Master ERP", secret);
    const qrDataUrl = await QRCode.toDataURL(otpAuthUri, { width: 220, margin: 1 });
    const challengeToken = crypto.randomBytes(24).toString("hex");
    const challengeId = "chal_" + crypto.randomBytes(8).toString("hex");

    await query(
      `INSERT INTO auth_challenges (id, user_id, purpose, challenge_token_hash, temp_secret_enc, expires_at)
       VALUES ($1, $2, 'mfa_enroll', $3, $4, $5)`,
      [
        challengeId,
        row.id,
        hashToken(challengeToken),
        encryptSecret(secret),
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      ]
    );

    return NextResponse.json({
      mfaEnabled: false,
      challengeToken,
      qrDataUrl,
      manualKey: secret,
    });
  } catch (err: any) {
    console.error("MFA setup error:", err);
    return NextResponse.json({ error: "Failed to initialize MFA enrollment." }, { status: 500 });
  }
}

// POST /api/auth/mfa — enroll_confirm | verify_login | reset_mfa
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = String(body.action || "");
    const ip = extractTrustedIp(req);
    const ua = req.headers.get("user-agent") || "";

    if (action === "enroll_confirm") {
      const auth = await authenticateRequest(req);
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
      }
      const { challengeToken, code, currentPassword } = body;
      if (!challengeToken || !code || !currentPassword) {
        return NextResponse.json(
          { error: "Current password, challenge token, and 6-digit authenticator code are required." },
          { status: 400 }
        );
      }

      const uRes = await query(`SELECT id, email, password FROM users WHERE id = $1`, [auth.user.userId]);
      const userRow = uRes?.rows[0];
      if (!userRow || !verifyPassword(String(currentPassword), userRow.password || "")) {
        return NextResponse.json({ error: "Current password verification failed." }, { status: 401 });
      }

      const cRes = await query(
        `SELECT id, temp_secret_enc, attempts, max_attempts, consumed, expires_at
         FROM auth_challenges
         WHERE challenge_token_hash = $1 AND user_id = $2 AND purpose = 'mfa_enroll'`,
        [hashToken(String(challengeToken)), auth.user.userId]
      );
      const chal = cRes?.rows[0];
      if (!chal || chal.consumed || new Date(chal.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "Enrollment challenge expired or invalid." }, { status: 400 });
      }
      if (chal.attempts >= chal.max_attempts) {
        return NextResponse.json({ error: "Maximum OTP attempts exceeded." }, { status: 429 });
      }

      const secret = decryptSecret(chal.temp_secret_enc);
      const check = verifyTotpCode(secret, String(code));
      if (!check.valid) {
        await query(`UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1`, [chal.id]);
        return NextResponse.json({ error: "Invalid 6-digit authenticator code." }, { status: 401 });
      }

      const recoveryCodes = generateRecoveryCodes(8);
      const recoveryHashes = recoveryCodes.map(hashRecoveryCode);

      await query(
        `UPDATE users SET mfa_enabled = true, mfa_secret_enc = $1, mfa_recovery_hashes = $2, mfa_enrolled_at = CURRENT_TIMESTAMP, mfa_last_used_step = $3 WHERE id = $4`,
        [encryptSecret(secret), JSON.stringify(recoveryHashes), check.matchedStep || null, auth.user.userId]
      );
      await query(`UPDATE auth_challenges SET consumed = true WHERE id = $1`, [chal.id]);

      await logAudit(auth.user.userId, "MFA_ENROLLED", { email: auth.user.email }, {
        actorName: auth.user.name,
        module: "security",
        outcome: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        recoveryCodes,
        message: "Two-Factor Authentication enabled. Save these single-use recovery codes securely.",
      });
    }

    if (action === "verify_login") {
      const { challengeToken, code, recoveryCode } = body;
      if (!challengeToken || (!code && !recoveryCode)) {
        return NextResponse.json({ error: "Challenge token and OTP or recovery code are required." }, { status: 400 });
      }

      const rateKey = `mfa:${ip}`;
      const rateCheck = await checkRateLimit(rateKey);
      if (!rateCheck.allowed) {
        return NextResponse.json(
          { error: `Too many MFA attempts. Try again in ${rateCheck.waitSeconds}s.` },
          { status: 429 }
        );
      }

      const cRes = await query(
        `SELECT id, user_id, attempts, max_attempts, consumed, expires_at
         FROM auth_challenges
         WHERE challenge_token_hash = $1 AND purpose = 'mfa_login'`,
        [hashToken(String(challengeToken))]
      );
      const chal = cRes?.rows[0];
      if (!chal || chal.consumed || new Date(chal.expires_at).getTime() <= Date.now()) {
        await recordFailedLogin(rateKey);
        return NextResponse.json({ error: "MFA challenge expired or invalid. Please sign in again." }, { status: 401 });
      }
      if (chal.attempts >= chal.max_attempts) {
        return NextResponse.json({ error: "Maximum MFA verification attempts exceeded." }, { status: 429 });
      }

      const uRes = await query(`SELECT * FROM users WHERE id = $1`, [chal.user_id]);
      const userRow = uRes?.rows[0];
      if (!userRow || userRow.status !== "active" || (userRow.approval_status && userRow.approval_status !== "Approved")) {
        return NextResponse.json({ error: "Account is not approved or active." }, { status: 403 });
      }

      let verified = false;
      let matchedStep: number | undefined;
      if (recoveryCode) {
        const hashes = Array.isArray(userRow.mfa_recovery_hashes) ? userRow.mfa_recovery_hashes : [];
        const rec = verifyAndConsumeRecoveryCode(String(recoveryCode), hashes);
        if (rec.valid) {
          verified = true;
          await query(`UPDATE users SET mfa_recovery_hashes = $1 WHERE id = $2`, [
            JSON.stringify(rec.remainingHashes),
            userRow.id,
          ]);
        }
      } else {
        const secret = decryptSecret(userRow.mfa_secret_enc);
        const totp = verifyTotpCode(secret, String(code), userRow.mfa_last_used_step);
        if (totp.valid) {
          verified = true;
          matchedStep = totp.matchedStep;
        }
      }

      if (!verified) {
        await query(`UPDATE auth_challenges SET attempts = attempts + 1 WHERE id = $1`, [chal.id]);
        await recordFailedLogin(rateKey);
        await logAudit(userRow.id, "MFA_VERIFICATION_FAILED", { ip }, { module: "auth", outcome: "FAILURE" });
        return NextResponse.json({ error: "Invalid MFA code or recovery code." }, { status: 401 });
      }

      // Consume challenge atomically & record replay step
      await query(`UPDATE auth_challenges SET consumed = true WHERE id = $1`, [chal.id]);
      if (matchedStep !== undefined) {
        await query(`UPDATE users SET mfa_last_used_step = $1 WHERE id = $2`, [matchedStep, userRow.id]);
      }

      const canonicalRole = normalizeRole(userRow.role);
      let deviceToken = req.cookies.get("aven_device")?.value || "";
      let deviceId: string | null = null;
      let setNewDeviceCookie = false;

      if (ENABLE_DEVICE_APPROVAL) {
        const { browser, os, deviceName } = parseDeviceSummary(ua);
        if (deviceToken) {
          const dRes = await query(
            `SELECT id, approval_status FROM trusted_devices WHERE device_token_hash = $1 AND user_id = $2`,
            [hashToken(deviceToken), userRow.id]
          );
          const dev = dRes?.rows[0];
          if (dev) {
            if (dev.approval_status === "Blocked" || dev.approval_status === "Rejected" || dev.approval_status === "Revoked") {
              return NextResponse.json(
                { error: "This device has been revoked or blocked by the Administrator.", code: "DEVICE_BLOCKED" },
                { status: 403 }
              );
            }
            if (dev.approval_status === "Pending Approval") {
              return NextResponse.json(
                { error: "New device pending Admin approval. Please contact your Administrator.", code: "DEVICE_PENDING_APPROVAL" },
                { status: 403 }
              );
            }
            deviceId = dev.id;
            await query(`UPDATE trusted_devices SET last_activity_at = CURRENT_TIMESTAMP, ip_approx = $1 WHERE id = $2`, [ip, dev.id]);
          } else {
            deviceToken = "";
          }
        }

        if (!deviceToken) {
          deviceToken = crypto.randomBytes(32).toString("hex");
          deviceId = "dev_" + crypto.randomBytes(8).toString("hex");
          // Staff new devices require Admin approval; Admin new devices trusted after MFA verification
          const devApproval = canonicalRole === "Admin" ? "Approved" : "Pending Approval";
          await query(
            `INSERT INTO trusted_devices (id, user_id, device_token_hash, device_name, browser, os, ip_approx, approval_status, approved_by, approved_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, ${devApproval === "Approved" ? "CURRENT_TIMESTAMP" : "NULL"})`,
            [
              deviceId,
              userRow.id,
              hashToken(deviceToken),
              deviceName,
              browser,
              os,
              ip,
              devApproval,
              devApproval === "Approved" ? userRow.email : null,
            ]
          );
          setNewDeviceCookie = true;

          if (devApproval === "Pending Approval") {
            await createSecurityAlert({
              severity: "warning",
              category: "device_approval",
              title: "New Staff Device Pending Approval",
              message: `${userRow.email} attempted login from unrecognized device (${deviceName}, IP ${ip}).`,
              actorEmail: userRow.email,
              targetRef: deviceId,
            });
            const pendingRes = NextResponse.json(
              {
                error: "Unrecognized device detected. Admin device approval is required before accessing the ERP.",
                code: "DEVICE_PENDING_APPROVAL",
              },
              { status: 403 }
            );
            pendingRes.cookies.set("aven_device", deviceToken, {
              httpOnly: true,
              secure: isProduction,
              sameSite: "strict",
              path: "/",
              maxAge: 60 * 60 * 24 * 90,
            });
            return pendingRes;
          }
        }
      }

      const mustChangePassword = Boolean(userRow.must_change_password) || (userRow.password_expires_at && new Date(userRow.password_expires_at).getTime() <= Date.now());
      const session = await createSession(
        {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name,
          role: canonicalRole,
          permissions: userRow.permissions,
          status: userRow.status,
          password_expires_at: userRow.password_expires_at,
        },
        {
          mustChangePassword,
          passwordExpiresAt: userRow.password_expires_at ? new Date(userRow.password_expires_at).toISOString() : null,
          mfaVerified: true,
          deviceVerified: true,
          deviceId,
          ipApprox: ip,
          userAgent: ua,
        }
      );

      const safeUser = {
        id: userRow.id,
        email: userRow.email,
        name: userRow.name,
        role: session.role,
        permissions: Array.from(resolveEffectivePermissions({ role: session.role, permissions: userRow.permissions })),
        status: userRow.status,
        must_change_password: mustChangePassword,
        password_expires_at: session.passwordExpiresAt,
      };

      const res = NextResponse.json({
        success: true,
        user: safeUser,
        mustChangePassword,
        session: {
          expiresAt: session.expiresAt.toISOString(),
          token: session.token,
          mustChangePassword,
          passwordExpiresAt: session.passwordExpiresAt,
        },
      });

      res.cookies.set("aven_session", session.token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "strict",
        path: "/",
        expires: session.expiresAt,
      });
      if (setNewDeviceCookie && deviceToken) {
        res.cookies.set("aven_device", deviceToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "strict",
          path: "/",
          maxAge: 60 * 60 * 24 * 90,
        });
      }
      return res;
    }

    if (action === "reset_mfa") {
      const auth = await authenticateRequest(req, { requiredPermission: "users.manage" });
      if ("error" in auth) {
        return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
      }
      const { targetUserId, adminPassword } = body;
      if (!targetUserId || !adminPassword) {
        return NextResponse.json({ error: "Target user ID and Admin password confirmation are required." }, { status: 400 });
      }
      const adminRes = await query(`SELECT password FROM users WHERE id = $1`, [auth.user.userId]);
      if (!adminRes?.rows[0] || !verifyPassword(String(adminPassword), adminRes.rows[0].password || "")) {
        return NextResponse.json({ error: "Admin password verification failed." }, { status: 401 });
      }

      await query(
        `UPDATE users SET mfa_enabled = false, mfa_secret_enc = NULL, mfa_recovery_hashes = '[]'::jsonb, mfa_last_used_step = NULL WHERE id = $1`,
        [targetUserId]
      );
      await revokeAllUserSessions(String(targetUserId));
      await createSecurityAlert({
        severity: "critical",
        category: "mfa_reset",
        title: "User MFA Reset by Admin",
        message: `${auth.user.email} reset MFA for user ${targetUserId} and revoked active sessions.`,
        actorEmail: auth.user.email,
        targetRef: String(targetUserId),
      });
      await logAudit(auth.user.userId, "MFA_RESET", { targetUserId }, { actorName: auth.user.name, module: "security", outcome: "SUCCESS" });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unsupported MFA action." }, { status: 400 });
  } catch (err: any) {
    console.error("MFA POST error:", err);
    return NextResponse.json({ error: "MFA operation failed." }, { status: 500 });
  }
}
