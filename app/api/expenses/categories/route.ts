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
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_categories'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({ items: [], tableMissing: true });
    }
    const includeInactive = req.nextUrl.searchParams.get("all") === "true" && auth.user.role === "Admin";
    const res = await query(
      `SELECT id, name, is_active, sort_order FROM expense_categories ${includeInactive ? "" : "WHERE is_active = true"} ORDER BY sort_order ASC, name ASC`,
      []
    );
    const rows = res?.rows || [];
    return NextResponse.json({ items: rows, categories: rows, tableMissing: false });
  } catch {
    return NextResponse.json({ error: "Failed to load expense categories." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "expenses.approve" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const name = String(body.name || "").trim().slice(0, 100);
    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

    const id = `cat_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    await query(
      `INSERT INTO expense_categories (id, name, is_active, sort_order, created_by)
       VALUES ($1, $2, true, $3, $4)`,
      [id, name, Number(body.sort_order) || 50, auth.user.email]
    );
    return NextResponse.json({ success: true, id, name });
  } catch (err: any) {
    if (err?.code === "23505") return NextResponse.json({ error: "Category already exists." }, { status: 409 });
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "expenses.approve" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Category id is required." }, { status: 400 });
    if (body.name !== undefined) {
      await query(`UPDATE expense_categories SET name = $1 WHERE id = $2`, [String(body.name).trim(), id]);
    }
    if (body.is_active !== undefined) {
      await query(`UPDATE expense_categories SET is_active = $1 WHERE id = $2`, [Boolean(body.is_active), id]);
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}
