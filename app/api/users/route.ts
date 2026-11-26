import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { defaultUsers } from "@/lib/sample-data";
import {
  DEFAULT_PASSWORD_EXPIRY_DAYS,
  authenticateRequest,
  hashPassword,
  logAudit,
  revokeAllUserSessions,
  validatePasswordStrength,
} from "@/lib/auth";
import { DEFAULT_STAFF_PERMISSIONS, normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "users.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const res = await query(
      `SELECT u.id, u.email, u.name, u.role, u.status, u.permissions,
              u.password_changed_at, u.password_expires_at, u.must_change_password,
              u.password_policy_days, u.last_login_at, u.created_at,
              la.locked_until
       FROM users u
       LEFT JOIN login_attempts la ON LOWER(u.email) = la.key
       ORDER BY u.created_at ASC`
    );

    if (res && res.rows.length > 0) {
      const sanitized = res.rows.map((r: any) => ({
        id: r.id,
        email: r.email,
        name: r.name,
        role: normalizeRole(r.role),
        status: r.status || "active",
        permissions: Array.isArray(r.permissions) ? r.permissions : undefined,
        password_changed_at: r.password_changed_at,
        password_expires_at: r.password_expires_at,
        must_change_password: Boolean(r.must_change_password),
        password_policy_days: Number(r.password_policy_days || DEFAULT_PASSWORD_EXPIRY_DAYS),
        last_login_at: r.last_login_at,
        locked_until: r.locked_until && Number(r.locked_until) > Date.now() ? Number(r.locked_until) : null,
        created_at: r.created_at,
      }));
      return NextResponse.json(sanitized);
    }

    if (isProduction) {
      return NextResponse.json([]);
    }

    const safeDefaults = defaultUsers.map(({ password, ...u }) => ({
      ...u,
      role: normalizeRole(u.role),
    }));
    return NextResponse.json(safeDefaults);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "users.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const admin = auth.user;

  try {
    const body = await req.json();
    const { name, email, password, role, permissions, mustChangePassword } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      return NextResponse.json({ error: strength.error }, { status: 400 });
    }

    await initDb();
    const id = "usr_" + Date.now();
    const hashedPassword = hashPassword(password);
    const canonicalRole = normalizeRole(role);
    const assignedPermissions =
      canonicalRole === "Admin"
        ? null
        : Array.isArray(permissions)
        ? permissions
        : DEFAULT_STAFF_PERMISSIONS;
    const createdAt = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + DEFAULT_PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

    const res = await query(
      `INSERT INTO users (id, email, name, role, password, status, permissions, password_changed_at, password_expires_at, must_change_password, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6, $7, $8, $9, $10)
       RETURNING id, email, name, role, status, permissions, password_changed_at, password_expires_at, must_change_password, created_at`,
      [
        id,
        email.toLowerCase().trim(),
        name.trim(),
        canonicalRole,
        hashedPassword,
        assignedPermissions ? JSON.stringify(assignedPermissions) : null,
        nowIso,
        expiresIso,
        Boolean(mustChangePassword),
        createdAt,
      ]
    );

    await logAudit(
      admin.userId,
      "USER_CREATED",
      { targetEmail: email.toLowerCase().trim(), role: canonicalRole },
      { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
    );

    if (res && res.rows.length > 0) {
      return NextResponse.json(res.rows[0]);
    }
    return NextResponse.json({ id, email, name, role: canonicalRole, status: "active", created_at: createdAt });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "users.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const admin = auth.user;

  try {
    const body = await req.json();
    const {
      id,
      role,
      status,
      password,
      permissions,
      forcePasswordChange,
      unlockAccount,
      revokeSessions,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await initDb();
    const targetRes = await query(`SELECT id, email, role, status FROM users WHERE id = $1`, [id]);
    if (!targetRes || targetRes.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const target = targetRes.rows[0];

    // Protect the last active Admin against deactivation or demotion
    if (normalizeRole(target.role) === "Admin" && (status === "inactive" || (role && normalizeRole(role) !== "Admin"))) {
      const adminCountRes = await query(
        `SELECT COUNT(*) AS cnt FROM users WHERE LOWER(role) = 'admin' AND status = 'active'`
      );
      const activeAdminCount = Number(adminCountRes?.rows[0]?.cnt || 0);
      if (activeAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot demote or deactivate the last active Administrator account." },
          { status: 400 }
        );
      }
    }

    if (password) {
      const strength = validatePasswordStrength(password);
      if (!strength.valid) {
        return NextResponse.json({ error: strength.error }, { status: 400 });
      }
      const hashedPassword = hashPassword(password);
      const expiresIso = new Date(Date.now() + DEFAULT_PASSWORD_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
      await query(
        `UPDATE users SET password = $1, password_changed_at = NOW(), password_expires_at = $2, must_change_password = true, updated_at = NOW() WHERE id = $3`,
        [hashedPassword, expiresIso, id]
      );
      await revokeAllUserSessions(id);
      await logAudit(
        admin.userId,
        "ADMIN_PASSWORD_RESET",
        { targetEmail: target.email },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (forcePasswordChange === true) {
      await query(`UPDATE users SET must_change_password = true, updated_at = NOW() WHERE id = $1`, [id]);
      await revokeAllUserSessions(id);
      await logAudit(
        admin.userId,
        "FORCE_PASSWORD_CHANGE",
        { targetEmail: target.email },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (role) {
      const canonicalRole = normalizeRole(role);
      await query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [canonicalRole, id]);
      await logAudit(
        admin.userId,
        "ROLE_CHANGED",
        { targetEmail: target.email, newRole: canonicalRole },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (Array.isArray(permissions)) {
      await query(`UPDATE users SET permissions = $1, updated_at = NOW() WHERE id = $2`, [
        JSON.stringify(permissions),
        id,
      ]);
      await logAudit(
        admin.userId,
        "PERMISSIONS_UPDATED",
        { targetEmail: target.email, permissionCount: permissions.length },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (status) {
      await query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
      if (status === "inactive") {
        await revokeAllUserSessions(id);
      }
      await logAudit(
        admin.userId,
        status === "inactive" ? "USER_DEACTIVATED" : "USER_ACTIVATED",
        { targetEmail: target.email },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (unlockAccount === true) {
      await query(`DELETE FROM login_attempts WHERE key = $1`, [target.email.toLowerCase()]);
      await logAudit(
        admin.userId,
        "ACCOUNT_UNLOCKED",
        { targetEmail: target.email },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    if (revokeSessions === true) {
      await revokeAllUserSessions(id);
      await logAudit(
        admin.userId,
        "SESSIONS_REVOKED",
        { targetEmail: target.email },
        { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "users.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const admin = auth.user;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }
    if (id === admin.userId) {
      return NextResponse.json({ error: "Cannot delete your own administrator account" }, { status: 400 });
    }

    await initDb();
    const targetRes = await query(`SELECT id, email, role FROM users WHERE id = $1`, [id]);
    if (targetRes && targetRes.rows.length > 0 && normalizeRole(targetRes.rows[0].role) === "Admin") {
      const adminCountRes = await query(`SELECT COUNT(*) AS cnt FROM users WHERE LOWER(role) = 'admin' AND status = 'active'`);
      if (Number(adminCountRes?.rows[0]?.cnt || 0) <= 1) {
        return NextResponse.json({ error: "Cannot delete the last active Administrator account." }, { status: 400 });
      }
    }

    await revokeAllUserSessions(id);
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    await logAudit(
      admin.userId,
      "USER_DELETED",
      { targetId: id },
      { actorName: admin.name, module: "users", recordRef: id, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
