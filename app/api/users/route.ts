import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { defaultUsers } from "@/lib/sample-data";
import { hashPassword, authenticateRequest, logAudit } from "@/lib/auth";

async function requireAdmin(req: NextRequest) {
  const auth = await authenticateRequest(req, "Admin");
  if ("error" in auth) return null;
  return auth.user;
}

export async function GET(req: NextRequest) {
  try {
    await initDb();
    const res = await query(
      `SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at ASC`
    );

    if (res && res.rows.length > 0) {
      return NextResponse.json(res.rows);
    }

    // Fallback to default users without exposing passwords
    const safeDefaults = defaultUsers.map(({ password, ...u }) => u);
    return NextResponse.json(safeDefaults);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    // If sessions active, require Admin; otherwise allow bootstrap
    const body = await req.json();
    const { name, email, password, role } = body;

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Name, email and password are required" }, { status: 400 });
    }

    await initDb();
    const id = "usr_" + Date.now();
    const hashedPassword = hashPassword(password);
    const userRole = role === "Admin" ? "Admin" : "User";
    const createdAt = new Date().toISOString().slice(0, 10);

    const res = await query(
      `INSERT INTO users (id, email, name, role, password, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)
       RETURNING id, email, name, role, status, created_at`,
      [id, email.toLowerCase().trim(), name.trim(), userRole, hashedPassword, createdAt]
    );

    if (admin) {
      await logAudit(admin.userId, "USER_CREATED", { targetEmail: email, role: userRole });
    }

    if (res && res.rows.length > 0) {
      return NextResponse.json(res.rows[0]);
    }

    return NextResponse.json({ id, email, name, role: userRole, status: "active", created_at: createdAt });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const body = await req.json();
    const { id, role, status, password } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    await initDb();

    if (password) {
      const hashedPassword = hashPassword(password);
      await query(`UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2`, [hashedPassword, id]);
    }

    if (role) {
      await query(`UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2`, [role, id]);
    }

    if (status) {
      await query(`UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2`, [status, id]);
    }

    await logAudit(admin.userId, "USER_UPDATED", { targetId: id, role, status });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    if (!admin) {
      return NextResponse.json({ error: "Forbidden: Admin role required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    // Prevent deleting self
    if (id === admin.userId) {
      return NextResponse.json({ error: "Cannot delete your own administrator account" }, { status: 400 });
    }

    await initDb();
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    await logAudit(admin.userId, "USER_DELETED", { targetId: id });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
