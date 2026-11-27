import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, createSecurityAlert, logAudit, revokeAllUserSessions, revokeSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "security.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const [usersRes, devicesRes, sessionsRes, alertsRes, attemptsRes] = await Promise.all([
      query(
        `SELECT id, email, name, role, status, approval_status, mfa_enabled, password_expires_at, last_login_at, created_at
         FROM users ORDER BY created_at DESC`,
        []
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT d.id, d.user_id, u.email, u.name, d.device_name, d.browser, d.os, d.ip_approx,
                d.approval_status, d.approved_by, d.approved_at, d.first_login_at, d.last_activity_at
         FROM trusted_devices d
         JOIN users u ON d.user_id = u.id
         ORDER BY d.last_activity_at DESC
         LIMIT 100`,
        []
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT s.id, s.user_id, u.email, u.name, s.role, s.ip_approx, s.user_agent, s.mfa_verified, s.device_verified, s.expires_at, s.created_at
         FROM sessions s
         JOIN users u ON s.user_id = u.id
         WHERE s.expires_at > NOW()
         ORDER BY s.created_at DESC
         LIMIT 100`,
        []
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT id, severity, category, title, message, actor_email, target_ref, acknowledged, acknowledged_by, created_at
         FROM security_alerts
         ORDER BY created_at DESC
         LIMIT 50`,
        []
      ).catch(() => ({ rows: [] })),
      query(
        `SELECT key, attempts, locked_until, updated_at FROM login_attempts ORDER BY updated_at DESC LIMIT 30`,
        []
      ).catch(() => ({ rows: [] })),
    ]);

    return NextResponse.json({
      users: usersRes?.rows || [],
      devices: devicesRes?.rows || [],
      sessions: sessionsRes?.rows || [],
      alerts: alertsRes?.rows || [],
      loginAttempts: attemptsRes?.rows || [],
      currentUserMfaEnabled: Boolean(
        (usersRes?.rows || []).find((u: any) => u.id === auth.user.userId)?.mfa_enabled
      ),
    });
  } catch (err: any) {
    console.error("Security Center GET failed:", err);
    return NextResponse.json({ error: "Failed to load Security Center data." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "security.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (["approve_device", "reject_device", "revoke_device", "block_device"].includes(action)) {
      const deviceId = String(body.deviceId || "");
      if (!deviceId) return NextResponse.json({ error: "deviceId is required." }, { status: 400 });

      const statusMap: Record<string, string> = {
        approve_device: "Approved",
        reject_device: "Rejected",
        revoke_device: "Revoked",
        block_device: "Blocked",
      };
      const nextStatus = statusMap[action];

      const dRes = await query(
        `UPDATE trusted_devices SET approval_status = $1, approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING user_id`,
        [nextStatus, auth.user.email, deviceId]
      );
      if (action !== "approve_device" && dRes?.rows[0]?.user_id) {
        await query(`DELETE FROM sessions WHERE device_id = $1`, [deviceId]);
      }

      await logAudit(auth.user.userId, `DEVICE_${nextStatus.toUpperCase()}`, { deviceId }, {
        actorName: auth.user.name,
        module: "security",
        recordRef: deviceId,
        outcome: "SUCCESS",
      });
      return NextResponse.json({ success: true });
    }

    if (action === "revoke_session") {
      const sessionId = String(body.sessionId || "");
      if (!sessionId) return NextResponse.json({ error: "sessionId is required." }, { status: 400 });
      const sRes = await query(`SELECT token FROM sessions WHERE id = $1`, [sessionId]);
      if (sRes?.rows[0]?.token) {
        await revokeSession(sRes.rows[0].token);
      } else {
        await query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);
      }
      await logAudit(auth.user.userId, "SESSION_REVOKED", { sessionId }, { actorName: auth.user.name, module: "security", outcome: "SUCCESS" });
      return NextResponse.json({ success: true });
    }

    if (action === "revoke_user_sessions") {
      const targetUserId = String(body.userId || "");
      if (!targetUserId) return NextResponse.json({ error: "userId is required." }, { status: 400 });
      await revokeAllUserSessions(targetUserId);
      await createSecurityAlert({
        severity: "info",
        category: "session_revocation",
        title: "All Sessions Revoked",
        message: `${auth.user.email} revoked all active sessions for user ${targetUserId}.`,
        actorEmail: auth.user.email,
        targetRef: targetUserId,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "acknowledge_alert") {
      const alertId = String(body.alertId || "");
      await query(
        `UPDATE security_alerts SET acknowledged = true, acknowledged_by = $1, acknowledged_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [auth.user.email, alertId]
      );
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown security action." }, { status: 400 });
  } catch (err: any) {
    console.error("Security Center POST failed:", err);
    return NextResponse.json({ error: "Security action failed." }, { status: 500 });
  }
}
