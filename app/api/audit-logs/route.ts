import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "audit_logs.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim().toLowerCase();
    const action = (searchParams.get("action") || "").trim();
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(10, Number(searchParams.get("limit") || 25)));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (action) {
      conditions.push(`action = $${idx++}`);
      params.push(action);
    }
    if (q) {
      conditions.push(
        `(LOWER(COALESCE(actor_name, '')) LIKE $${idx} OR LOWER(COALESCE(action, '')) LIKE $${idx} OR LOWER(COALESCE(record_ref, '')) LIKE $${idx} OR LOWER(COALESCE(user_id, '')) LIKE $${idx})`
      );
      params.push(`%${q}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const countRes = await query(`SELECT COUNT(*) AS cnt FROM audit_logs ${whereClause}`, params);
    const total = Number(countRes?.rows[0]?.cnt || 0);

    const rowsRes = await query(
      `SELECT id, user_id, actor_name, action, module, record_ref, outcome, request_id, details, created_at
       FROM audit_logs
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset]
    );

    return NextResponse.json({
      logs: rowsRes?.rows || [],
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err: any) {
    console.error("Audit logs fetch error:", err?.message || err);
    return NextResponse.json({ error: "Failed to retrieve audit logs" }, { status: 500 });
  }
}
