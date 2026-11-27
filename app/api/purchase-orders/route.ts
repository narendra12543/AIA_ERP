import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { nextPONumber } from "@/lib/vba-engine";

export const dynamic = "force-dynamic";

async function tableExists(): Promise<boolean> {
  try {
    const res = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'purchase_orders'`,
      []
    );
    return Boolean(res && res.rows.length > 0);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "quotations.view_all" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const exists = await tableExists();
    if (!exists) {
      return NextResponse.json({
        items: [],
        nextPoNumber: nextPONumber([]),
        tableMissing: true,
      });
    }

    const res = await query(
      `SELECT data, po_number, updated_at
       FROM purchase_orders
       ORDER BY po_number DESC, updated_at DESC`,
      []
    );
    const items = (res?.rows || []).map((r: any) => r.data);
    return NextResponse.json({
      items,
      nextPoNumber: nextPONumber(items),
      tableMissing: false,
    });
  } catch (err: any) {
    console.error("Failed to fetch purchase orders:", err);
    return NextResponse.json({ error: "Failed to fetch purchase orders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "purchase_order.create" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const exists = await tableExists();
    if (!exists) {
      return NextResponse.json(
        {
          error: "Purchase Orders table (migration 006) is not yet applied on the database.",
          code: "PO_MIGRATION_PENDING",
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const existingRes = await query(`SELECT id, po_number FROM purchase_orders`, []);
    const existingRows = existingRes?.rows || [];

    let poNo = String(body.po_number || "").trim();
    if (!poNo) {
      poNo = nextPONumber(existingRows);
    }

    const id = String(body.id || "").trim() || `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // Prevent duplicate PO numbers across different IDs
    const conflict = existingRows.find(
      (r: any) => r.po_number.toLowerCase() === poNo.toLowerCase() && r.id !== id
    );
    if (conflict && !body.allowOverwrite) {
      return NextResponse.json(
        {
          error: `Purchase Order number "${poNo}" already exists. Use Update on the existing PO or generate a new PO number.`,
          suggestedPoNumber: nextPONumber(existingRows),
        },
        { status: 409 }
      );
    }

    const poRecord = {
      ...body,
      id,
      po_number: poNo,
      updated_at: new Date().toISOString(),
    };

    await query(
      `INSERT INTO purchase_orders (id, po_number, po_date, vendor_id, vendor_name, linked_quotation_no, total, status, data, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO UPDATE SET
         po_number = EXCLUDED.po_number,
         po_date = EXCLUDED.po_date,
         vendor_id = EXCLUDED.vendor_id,
         vendor_name = EXCLUDED.vendor_name,
         linked_quotation_no = EXCLUDED.linked_quotation_no,
         total = EXCLUDED.total,
         status = EXCLUDED.status,
         data = EXCLUDED.data,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        id,
        poNo,
        String(body.po_date || ""),
        body.vendor_id ? String(body.vendor_id) : null,
        body.vendor_name ? String(body.vendor_name) : null,
        body.linked_quotation_no ? String(body.linked_quotation_no) : null,
        Number(body.total) || 0,
        String(body.status || "Draft"),
        JSON.stringify(poRecord),
        auth.user.email,
        auth.user.email,
      ]
    );

    await logAudit(
      auth.user.userId,
      "PO_SAVED",
      { po_number: poNo, vendor_name: body.vendor_name || "", total: Number(body.total) || 0 },
      { actorName: auth.user.name, module: "purchase_order", recordRef: poNo, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true, item: poRecord });
  } catch (err: any) {
    console.error("Failed to save purchase order:", err);
    return NextResponse.json(
      { error: isProduction ? "Failed to save purchase order." : err?.message || "Failed to save purchase order." },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  return POST(req);
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "purchase_order.create" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Purchase Order id is required." }, { status: 400 });
    }
    const exists = await tableExists();
    if (!exists) {
      return NextResponse.json({ error: "Purchase Orders table not initialized." }, { status: 503 });
    }
    await query(`DELETE FROM purchase_orders WHERE id = $1 OR po_number = $1`, [id]);
    await logAudit(auth.user.userId, "PO_DELETED", { id }, { actorName: auth.user.name, module: "purchase_order", recordRef: id, outcome: "SUCCESS" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete purchase order:", err);
    return NextResponse.json({ error: "Failed to delete purchase order." }, { status: 500 });
  }
}
