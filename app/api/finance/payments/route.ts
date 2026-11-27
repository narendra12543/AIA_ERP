import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { getCurrentBusinessDate, getFYDateRange, getFYFromDate, normalizeFYCode } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.payments" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const tbl = await query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='finance_customer_payments'`, []);
    if (!tbl || tbl.rows.length === 0) return NextResponse.json({ items: [], tableMissing: true });

    const fy = req.nextUrl.searchParams.get("fy") || "ALL";
    const orderId = req.nextUrl.searchParams.get("orderId") || "";
    const where: string[] = [];
    const params: any[] = [];

    const range = fy === "ALL" ? null : getFYDateRange(normalizeFYCode(fy));
    if (range) {
      params.push(range.startDate, range.endDate, range.fy);
      where.push(`(fcp.fy_code = $${params.length} OR (fcp.payment_date >= $${params.length - 2} AND fcp.payment_date <= $${params.length - 1}))`);
    }
    if (orderId) {
      params.push(orderId);
      where.push(`fcp.order_id = $${params.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const res = await query(
      `SELECT fcp.*, fo.order_no, fo.client_name, fo.project_name, fo.total_order_value,
              fa.name AS account_name
       FROM finance_customer_payments fcp
       JOIN finance_orders fo ON fo.id = fcp.order_id
       LEFT JOIN finance_accounts fa ON fa.id = fcp.account_id
       ${whereSql}
       ORDER BY fcp.payment_date DESC NULLS LAST, fcp.created_at DESC
       LIMIT 250`,
      params
    );
    const items = res?.rows || [];
    return NextResponse.json({ items, payments: items, tableMissing: false });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to load payments." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.payments" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const action = String(body.action || "record");

    if (action === "reverse") {
      const payId = String(body.payment_id || "").trim();
      const origRes = await query(`SELECT * FROM finance_customer_payments WHERE id = $1`, [payId]);
      const orig = origRes?.rows[0];
      if (!orig || orig.status !== "Posted") {
        return NextResponse.json({ error: "Payment not found or already reversed." }, { status: 404 });
      }
      const revDate = getCurrentBusinessDate();
      const revFy = getFYFromDate(revDate);
      const revId = `fpay_rev_${Date.now()}`;
      await query(`UPDATE finance_customer_payments SET status = 'Reversed' WHERE id = $1`, [payId]);
      await query(
        `INSERT INTO finance_customer_payments (
          id, order_id, client_id, payment_date, fy_code, amount, payment_type, payment_mode,
          account_id, transaction_ref, notes, status, reversal_of_id, recorded_by
        ) VALUES ($1,$2,$3,$4,$5,$6,'Reversal',$7,$8,$9,$10,'Posted',$11,$12)`,
        [
          revId,
          orig.order_id,
          orig.client_id,
          revDate,
          revFy,
          -Math.abs(Number(orig.amount)),
          orig.payment_mode,
          orig.account_id || "acc_bank_main",
          orig.transaction_ref,
          body.reason || `Reversal of ${payId}`,
          payId,
          auth.user.email,
        ]
      );
      await logAudit(auth.user.userId, "PAYMENT_REVERSED", { payId, amount: orig.amount }, { actorName: auth.user.name, module: "finance_payments", recordRef: payId, outcome: "SUCCESS" });
      return NextResponse.json({ success: true, reversal_id: revId });
    }

    const orderId = String(body.order_id || body.orderId || "").trim();
    const amount = Number(body.amount);
    if (!orderId || !Number.isFinite(amount) || amount === 0) {
      return NextResponse.json({ error: "Valid order_id and non-zero amount are required." }, { status: 400 });
    }

    const oRes = await query(`SELECT id, order_no, client_id, client_name, total_order_value FROM finance_orders WHERE id = $1`, [orderId]);
    const order = oRes?.rows[0];
    if (!order) return NextResponse.json({ error: "Financial order not found." }, { status: 404 });

    if (amount > 0 && !body.allowOverpayment) {
      const paidRes = await query(
        `SELECT COALESCE(SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END), 0)::numeric AS paid FROM finance_customer_payments WHERE order_id = $1`,
        [orderId]
      );
      const alreadyPaid = Number(paidRes?.rows[0]?.paid || 0);
      const outstanding = Math.max(0, Number(order.total_order_value) - alreadyPaid);
      if (amount > outstanding + 0.01) {
        return NextResponse.json(
          { error: `Payment ₹${amount.toFixed(2)} exceeds remaining order balance ₹${outstanding.toFixed(2)}.`, code: "OVERPAYMENT" },
          { status: 400 }
        );
      }
    }

    const rawDate = body.payment_date || body.paymentDate;
    const paymentDate =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))
        ? String(rawDate)
        : getCurrentBusinessDate();
    const fyCode = getFYFromDate(paymentDate);
    const payId = `fpay_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
    const payMode = String(body.payment_mode || body.paymentMode || "Bank Transfer");
    const accountId = String(body.account_id || body.accountId || "acc_bank_main");
    const txRef = body.transaction_ref || body.referenceNo || null;

    await query(
      `INSERT INTO finance_customer_payments (
        id, order_id, client_id, payment_date, fy_code, amount, payment_type, payment_mode,
        account_id, transaction_ref, notes, status, recorded_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Posted',$12)`,
      [
        payId,
        orderId,
        order.client_id,
        paymentDate,
        fyCode,
        amount,
        String(body.payment_type || body.paymentType || "Progress Payment"),
        payMode,
        accountId,
        txRef ? String(txRef).trim() : null,
        body.notes ? String(body.notes).trim() : null,
        auth.user.email,
      ]
    );

    const txSeq = await query(`SELECT nextval('finance_tx_seq')::bigint AS n`, []);
    await query(
      `INSERT INTO finance_transactions (
        id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
        account_id, payment_mode, reference_no, source_type, source_record_id, related_order_id, created_by
      ) VALUES ($1,$2,$3,$4,'Customer Receipt','Customer Payment',$5,$6,$7,$8,$9,$10,'customer_payment',$11,$12,$13)`,
      [
        `ftx_pay_${payId}`,
        `TX-${fyCode}-${String(txSeq?.rows[0]?.n || Date.now()).padStart(6, "0")}`,
        paymentDate,
        fyCode,
        order.client_name,
        `Receipt for ${order.order_no}`,
        amount,
        accountId,
        payMode,
        txRef ? String(txRef).trim() : null,
        payId,
        orderId,
        auth.user.email,
      ]
    );

    await logAudit(auth.user.userId, "PAYMENT_RECORDED", { orderNo: order.order_no, amount, paymentDate }, { actorName: auth.user.name, module: "finance_payments", recordRef: order.order_no, outcome: "SUCCESS" });
    return NextResponse.json({ success: true, id: payId });
  } catch (err: any) {
    console.error("Failed to record payment:", err);
    return NextResponse.json({ error: "Failed to record payment." }, { status: 500 });
  }
}
