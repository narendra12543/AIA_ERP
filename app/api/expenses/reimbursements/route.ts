import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { getCurrentBusinessDate, getFYFromDate } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canAll = auth.user.role === "Admin" || auth.user.permissions.includes("expenses.reimburse") || auth.user.permissions.includes("expenses.view");
  const canOwn = auth.user.permissions.includes("expenses.view_own") || auth.user.permissions.includes("expenses.submit");
  if (!canAll && !canOwn) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await initDb();
    const tbl = await query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_reimbursements'`, []);
    if (!tbl || tbl.rows.length === 0) return NextResponse.json({ items: [], tableMissing: true });

    const scope = req.nextUrl.searchParams.get("scope") || (canAll ? "all" : "own");
    const where = !canAll || scope === "own" ? `WHERE ec.user_id = $1` : "";
    const params = !canAll || scope === "own" ? [auth.user.userId] : [];
    const res = await query(
      `SELECT er.*, ec.claim_no, ec.category_name, ec.paid_to, ep.employee_id AS emp_code, ep.full_name AS emp_name
       FROM expense_reimbursements er
       JOIN expense_claims ec ON ec.id = er.claim_id
       LEFT JOIN employee_profiles ep ON ep.id = er.employee_profile_id
       ${where}
       ORDER BY er.payment_date DESC, er.created_at DESC
       LIMIT 200`,
      params
    );
    const rows = res?.rows || [];
    return NextResponse.json({ items: rows, reimbursements: rows, tableMissing: false });
  } catch {
    return NextResponse.json({ error: "Failed to load reimbursements." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "expenses.reimburse" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const claimId = String(body.claim_id || body.claimId || "").trim();
    if (!claimId) {
      return NextResponse.json({ error: "Valid claim_id is required." }, { status: 400 });
    }

    const cRes = await query(`SELECT * FROM expense_claims WHERE id = $1`, [claimId]);
    const claim = cRes?.rows[0];
    if (!claim) return NextResponse.json({ error: "Expense claim not found." }, { status: 404 });
    if (claim.status !== "Approved" || claim.paid_by !== "Self") {
      return NextResponse.json({ error: "Only Approved self-paid claims are eligible for reimbursement." }, { status: 400 });
    }

    const approvedAmt = Number(claim.approved_amount ?? claim.amount);
    const alreadyPaid = Number(claim.reimbursed_amount || 0);
    const remaining = Math.max(0, Number((approvedAmt - alreadyPaid).toFixed(2)));
    const amount = body.amount !== undefined && body.amount !== null ? Number(body.amount) : remaining;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Positive reimbursement amount is required." }, { status: 400 });
    }
    if (amount > remaining + 0.01) {
      return NextResponse.json({ error: `Reimbursement ₹${amount} exceeds remaining payable ₹${remaining}.` }, { status: 400 });
    }

    const rawDate = body.payment_date || body.paidDate;
    const paymentDate =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))
        ? String(rawDate)
        : getCurrentBusinessDate();
    const fyCode = getFYFromDate(paymentDate);
    const payMode = String(body.payment_mode || body.paymentMode || "UPI").trim();
    const accountId = String(body.account_id || body.accountId || "acc_bank_main");
    const referenceNo = body.reference_no || body.referenceNo || null;
    const reimbId = `reimb_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    await query(
      `INSERT INTO expense_reimbursements (
        id, claim_id, employee_profile_id, payment_date, fy_code, amount, payment_mode, account_id, reference_no, notes, recorded_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        reimbId,
        claimId,
        claim.employee_profile_id,
        paymentDate,
        fyCode,
        amount,
        payMode,
        accountId,
        referenceNo ? String(referenceNo).trim() : null,
        body.notes ? String(body.notes).trim() : null,
        auth.user.email,
      ]
    );

    const newPaid = Number((alreadyPaid + amount).toFixed(2));
    const newReimbStatus = newPaid >= approvedAmt - 0.01 ? "Reimbursed" : "Partially Reimbursed";
    await query(
      `UPDATE expense_claims SET reimbursed_amount = $1, reimbursement_status = $2, updated_at = NOW() WHERE id = $3`,
      [newPaid, newReimbStatus, claimId]
    );

    // Record cash/bank outflow WITHOUT creating a second expense (tx_type = 'Reimbursement')
    const txSeq = await query(`SELECT nextval('finance_tx_seq')::bigint AS n`, []);
    await query(
      `INSERT INTO finance_transactions (
        id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
        account_id, payment_mode, reference_no, source_type, source_record_id, related_employee_id, created_by
      ) VALUES ($1,$2,$3,$4,'Reimbursement','Employee Reimbursement',$5,$6,$7,$8,$9,$10,'reimbursement',$11,$12,$13)`,
      [
        `ftx_reimb_${reimbId}`,
        `TX-${fyCode}-${String(txSeq?.rows[0]?.n || Date.now()).padStart(6, "0")}`,
        paymentDate,
        fyCode,
        claim.paid_to,
        `Reimbursement for ${claim.claim_no}`,
        amount,
        accountId,
        payMode,
        body.reference_no ? String(body.reference_no).trim() : null,
        reimbId,
        claim.employee_profile_id,
        auth.user.email,
      ]
    );

    if (claim.user_id) {
      await query(
        `INSERT INTO erp_notifications (id, target_user_id, title, message, module, record_ref)
         VALUES ($1,$2,'Reimbursement Recorded',$3,'expenses',$4)`,
        [`notif_${Date.now()}`, claim.user_id, `₹${amount.toFixed(2)} reimbursed for ${claim.claim_no} (${newReimbStatus}).`, claimId]
      );
    }

    await logAudit(auth.user.userId, "EXPENSE_REIMBURSED", { claimNo: claim.claim_no, amount, newReimbStatus }, { actorName: auth.user.name, module: "expenses", recordRef: claim.claim_no, outcome: "SUCCESS" });
    return NextResponse.json({ success: true, id: reimbId, reimbursement_status: newReimbStatus, reimbursed_amount: newPaid });
  } catch (err: any) {
    console.error("Failed to record reimbursement:", err);
    return NextResponse.json({ error: "Failed to record reimbursement." }, { status: 500 });
  }
}
