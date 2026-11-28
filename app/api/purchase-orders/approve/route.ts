import { NextRequest, NextResponse } from "next/server";
import { getDbPool, initDb, isProduction } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canApprove =
    normalizeRole(auth.user.role) === "Admin" || hasPermission(auth.user, "purchase_order.approve");
  if (!canApprove) {
    return NextResponse.json(
      { error: "Forbidden: Administrator approval permission required.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const pool = getDbPool();
  if (!pool) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }

  const client = await pool.connect();
  try {
    await initDb();
    const body = await req.json();
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim().toLowerCase();
    const remarks = String(body.remarks || "").trim();

    if (!id || !["approve", "reject", "request_changes"].includes(action)) {
      return NextResponse.json(
        { error: "Valid Purchase Order id and action (approve, reject, request_changes) are required." },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const rowRes = await client.query(
      `SELECT id, po_number, vendor_name, total, created_by, submitted_by, approval_status, current_version, data
       FROM purchase_orders
       WHERE id = $1 OR po_number = $1
       FOR UPDATE`,
      [id]
    );

    if (rowRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Purchase Order not found." }, { status: 404 });
    }

    const row = rowRes.rows[0];
    if (
      row.submitted_by &&
      row.submitted_by.toLowerCase() === auth.user.email.toLowerCase() &&
      normalizeRole(auth.user.role) !== "Admin"
    ) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Self-approval is not permitted." },
        { status: 403 }
      );
    }

    const nextStatus =
      action === "approve"
        ? "Approved"
        : action === "reject"
        ? "Rejected"
        : "Changes Requested";

    const currentVersion = Number(row.current_version || row.data?.current_version || 1);
    const approvedVersion = action === "approve" ? currentVersion : Number(row.data?.approved_version || 0);
    const nowIso = new Date().toISOString();

    const updatedData = {
      ...(row.data || {}),
      approval_status: nextStatus,
      approved_by: action === "approve" ? auth.user.email : row.data?.approved_by || null,
      approved_at: action === "approve" ? nowIso : row.data?.approved_at || null,
      approval_remarks: remarks || null,
      approved_version: approvedVersion,
      current_version: currentVersion,
    };

    await client.query(
      `UPDATE purchase_orders
       SET approval_status = $1,
           approved_by = $2,
           approved_at = $3,
           approval_remarks = $4,
           approved_version = $5,
           data = $6,
           updated_by = $7,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8`,
      [
        nextStatus,
        action === "approve" ? auth.user.email : null,
        action === "approve" ? nowIso : null,
        remarks || null,
        approvedVersion,
        JSON.stringify(updatedData),
        auth.user.email,
        row.id,
      ]
    ).catch(async () => {
      // Fallback if migration 008 columns are not yet applied: update JSONB data cleanly
      await client.query(
        `UPDATE purchase_orders
         SET data = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [JSON.stringify(updatedData), auth.user.email, row.id]
      );
    });

    // Notify submitter/creator via in-app notification system
    const targetEmail = row.submitted_by || row.created_by;
    if (targetEmail) {
      const uRes = await client.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`, [
        targetEmail,
      ]);
      const targetUserId = uRes.rows[0]?.id || null;
      await client
        .query(
          `INSERT INTO erp_notifications (id, target_user_id, target_role, title, message, module, record_ref)
           VALUES ($1, $2, $3, $4, $5, 'purchase_order', $6)`,
          [
            `notif_po_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            targetUserId,
            targetUserId ? null : "Purchase",
            `PO ${row.po_number}: ${nextStatus}`,
            `Purchase Order ${row.po_number} (${row.vendor_name || "Vendor"}) was marked ${nextStatus} by ${auth.user.name}.${remarks ? ` Remarks: ${remarks}` : ""}`,
            row.po_number,
          ]
        )
        .catch(() => {});
    }

    await client.query("COMMIT");

    await logAudit(
      auth.user.userId,
      `PO_${nextStatus.toUpperCase().replace(/\s+/g, "_")}`,
      { po_number: row.po_number, remarks, approved_version: approvedVersion },
      { actorName: auth.user.name, module: "purchase_order", recordRef: row.po_number, outcome: "SUCCESS" }
    );

    return NextResponse.json({ success: true, item: updatedData });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Failed to process PO approval:", err);
    return NextResponse.json(
      { error: isProduction ? "Failed to update Purchase Order approval." : err?.message || "Failed." },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}
