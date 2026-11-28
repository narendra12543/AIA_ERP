import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
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

function hasMaterialPoChange(prev: any, next: any): boolean {
  if (!prev) return false;
  const normItems = (arr: any[]) =>
    JSON.stringify(
      (Array.isArray(arr) ? arr : []).map((it) => ({
        name: String(it?.name || ""),
        qty: Number(it?.qty || 0),
        price: Number(it?.price || 0),
        amount: Number(it?.amount || 0),
      }))
    );
  return (
    String(prev.vendor_id || "") !== String(next.vendor_id || "") ||
    String(prev.vendor_name || "") !== String(next.vendor_name || "") ||
    Number(prev.subtotal || 0) !== Number(next.subtotal || 0) ||
    Number(prev.tax_amount || 0) !== Number(next.tax_amount || 0) ||
    Number(prev.total || 0) !== Number(next.total || 0) ||
    String(prev.terms || "") !== String(next.terms || "") ||
    String(prev.instructions || "") !== String(next.instructions || "") ||
    normItems(prev.items) !== normItems(next.items)
  );
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const canonRole = normalizeRole(auth.user.role);
  const canViewAll =
    canonRole === "Admin" ||
    hasPermission(auth.user, "purchase_order.view_all") ||
    hasPermission(auth.user, "purchase_order.approve") ||
    hasPermission(auth.user, "quotations.view_all");
  const canViewOwn =
    hasPermission(auth.user, "purchase_order.view_own") ||
    hasPermission(auth.user, "purchase_order.create");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Forbidden: Missing Purchase Order view permission.", code: "FORBIDDEN" }, { status: 403 });
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
      `SELECT data, po_number, updated_at, created_by
       FROM purchase_orders
       ORDER BY po_number DESC, updated_at DESC`,
      []
    );
    let rows = res?.rows || [];
    if (!canViewAll) {
      const me = auth.user.email.toLowerCase();
      rows = rows.filter(
        (r: any) =>
          String(r.created_by || r.data?.created_by || "").toLowerCase() === me ||
          String(r.data?.approval_status || "") === "Approved"
      );
    }
    const items = rows.map((r: any) => r.data);
    return NextResponse.json({
      items,
      nextPoNumber: nextPONumber((res?.rows || []).map((r: any) => r.data)),
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
    const existingRes = await query(`SELECT id, po_number, created_by, data FROM purchase_orders`, []);
    const existingRows = existingRes?.rows || [];

    let poNo = String(body.po_number || "").trim();
    if (!poNo) {
      poNo = nextPONumber(existingRows);
    }

    const id = String(body.id || "").trim() || `po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const existingRecord = existingRows.find((r: any) => r.id === id);

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

    const canonRole = normalizeRole(auth.user.role);
    const isAdmin = canonRole === "Admin";
    const submitForApproval = Boolean(body.submitForApproval);
    if (submitForApproval && !isAdmin && !hasPermission(auth.user, "purchase_order.submit")) {
      return NextResponse.json(
        { error: "Forbidden: Missing permission to submit Purchase Order for approval." },
        { status: 403 }
      );
    }

    const prevData = existingRecord?.data || null;
    if (
      !isAdmin &&
      existingRecord &&
      String(existingRecord.created_by || prevData?.created_by || "").toLowerCase() !== auth.user.email.toLowerCase()
    ) {
      return NextResponse.json(
        { error: "Forbidden: You can only edit Purchase Orders you created." },
        { status: 403 }
      );
    }

    const prevVersion = Number(prevData?.current_version || 1);
    const prevApprovalStatus = String(prevData?.approval_status || "Draft");
    const materialChanged = hasMaterialPoChange(prevData, body);

    const nowIso = new Date().toISOString();
    let currentVersion = prevVersion;
    let approvalStatus = prevApprovalStatus;
    let approvedBy = prevData?.approved_by || null;
    let approvedAt = prevData?.approved_at || null;
    let approvedVersion = Number(prevData?.approved_version || 0);
    let submittedBy = prevData?.submitted_by || null;
    let submittedAt = prevData?.submitted_at || null;

    if (isAdmin) {
      if (materialChanged && existingRecord) currentVersion = prevVersion + 1;
      approvalStatus = "Approved";
      approvedBy = auth.user.email;
      approvedAt = nowIso;
      approvedVersion = currentVersion;
    } else {
      if (prevApprovalStatus === "Approved" && materialChanged) {
        currentVersion = prevVersion + 1;
        approvalStatus = "Draft";
        approvedBy = null;
        approvedAt = null;
        approvedVersion = 0;
      } else if (!existingRecord) {
        approvalStatus = "Draft";
      }

      if (submitForApproval) {
        approvalStatus = "Pending Approval";
        submittedBy = auth.user.email;
        submittedAt = nowIso;
      }
    }

    const poRecord = {
      ...body,
      id,
      po_number: poNo,
      created_by: existingRecord?.created_by || prevData?.created_by || auth.user.email,
      approval_status: approvalStatus,
      submitted_by: submittedBy,
      submitted_at: submittedAt,
      approved_by: approvedBy,
      approved_at: approvedAt,
      approval_remarks: submitForApproval ? null : prevData?.approval_remarks || null,
      approved_version: approvedVersion,
      current_version: currentVersion,
      updated_at: nowIso,
    };

    await query(
      `INSERT INTO purchase_orders (
         id, po_number, po_date, vendor_id, vendor_name, linked_quotation_no, total, status, data,
         created_by, updated_by, approval_status, submitted_by, submitted_at, approved_by, approved_at, approved_version, current_version
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
         approval_status = EXCLUDED.approval_status,
         submitted_by = EXCLUDED.submitted_by,
         submitted_at = EXCLUDED.submitted_at,
         approved_by = EXCLUDED.approved_by,
         approved_at = EXCLUDED.approved_at,
         approved_version = EXCLUDED.approved_version,
         current_version = EXCLUDED.current_version,
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
        poRecord.created_by,
        auth.user.email,
        approvalStatus,
        submittedBy,
        submittedAt,
        approvedBy,
        approvedAt,
        approvedVersion,
        currentVersion,
      ]
    ).catch(async () => {
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
          poRecord.created_by,
          auth.user.email,
        ]
      );
    });

    if (submitForApproval && !isAdmin) {
      await query(
        `INSERT INTO erp_notifications (id, target_user_id, target_role, title, message, module, record_ref)
         VALUES ($1, NULL, 'Admin', $2, $3, 'purchase_order', $4)`,
        [
          `notif_po_sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          `PO Approval Required: ${poNo}`,
          `${auth.user.name} submitted Purchase Order ${poNo} (${body.vendor_name || "Vendor"}) for Admin approval.`,
          poNo,
        ]
      ).catch(() => {});
    }

    await logAudit(
      auth.user.userId,
      submitForApproval && !isAdmin ? "PO_SUBMITTED_FOR_APPROVAL" : isAdmin ? "PO_SAVED_DIRECT_ADMIN" : "PO_SAVED",
      { po_number: poNo, vendor_name: body.vendor_name || "", total: Number(body.total) || 0, approval_status: approvalStatus },
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
    const targetRes = await query(`SELECT id, created_by, data FROM purchase_orders WHERE id = $1 OR po_number = $1 LIMIT 1`, [id]);
    const target = targetRes?.rows[0];
    if (!target) {
      return NextResponse.json({ error: "Purchase Order not found." }, { status: 404 });
    }
    if (normalizeRole(auth.user.role) !== "Admin") {
      if (String(target.created_by || target.data?.created_by || "").toLowerCase() !== auth.user.email.toLowerCase()) {
        return NextResponse.json({ error: "Forbidden: You can only delete your own draft Purchase Orders." }, { status: 403 });
      }
      if (String(target.data?.approval_status || "Draft") === "Approved") {
        return NextResponse.json({ error: "Forbidden: Approved Purchase Orders cannot be deleted by non-Admin users." }, { status: 403 });
      }
    }
    await query(`DELETE FROM purchase_orders WHERE id = $1 OR po_number = $1`, [id]);
    await logAudit(auth.user.userId, "PO_DELETED", { id }, { actorName: auth.user.name, module: "purchase_order", recordRef: id, outcome: "SUCCESS" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("Failed to delete purchase order:", err);
    return NextResponse.json({ error: "Failed to delete purchase order." }, { status: 500 });
  }
}
