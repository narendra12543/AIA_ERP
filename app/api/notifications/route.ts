import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const tbl = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'erp_notifications'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({ items: [], unreadCount: 0 });
    }

    const roleUpper = auth.user.role.toUpperCase();
    const res = await query(
      `SELECT id, title, message, module, record_ref, is_read, created_at
       FROM erp_notifications
       WHERE target_user_id = $1 OR (target_user_id IS NULL AND UPPER(target_role) = $2)
       ORDER BY created_at DESC
       LIMIT 40`,
      [auth.user.userId, roleUpper]
    );
    const items = res?.rows || [];
    const unreadCount = items.filter((n: any) => !n.is_read).length;
    return NextResponse.json({ items, notifications: items, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ items: [], unreadCount: 0 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const roleUpper = auth.user.role.toUpperCase();
    if (body.markAllRead) {
      await query(
        `UPDATE erp_notifications SET is_read = true WHERE target_user_id = $1 OR (target_user_id IS NULL AND UPPER(target_role) = $2)`,
        [auth.user.userId, roleUpper]
      );
    } else if (body.id) {
      await query(
        `UPDATE erp_notifications SET is_read = true WHERE id = $1 AND (target_user_id = $2 OR (target_user_id IS NULL AND UPPER(target_role) = $3))`,
        [String(body.id), auth.user.userId, roleUpper]
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update notifications." }, { status: 500 });
  }
}
