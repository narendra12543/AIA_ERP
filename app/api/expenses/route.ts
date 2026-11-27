import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { getCurrentBusinessDate, getFYDateRange, getFYFromDate } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canViewAll =
    auth.user.role === "Admin" ||
    auth.user.permissions.includes("expenses.view") ||
    auth.user.permissions.includes("expenses.review") ||
    auth.user.permissions.includes("expenses.approve");
  const canViewOwn = auth.user.permissions.includes("expenses.view_own") || auth.user.permissions.includes("expenses.submit");

  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await initDb();
    const tbl = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='expense_claims'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({ items: [], summary: {}, tableMissing: true });
    }

    const fy = req.nextUrl.searchParams.get("fy") || "ALL";
    const scope = req.nextUrl.searchParams.get("scope") || (canViewAll ? "all" : "own");
    const statusFilter = req.nextUrl.searchParams.get("status") || "";
    const categoryFilter = req.nextUrl.searchParams.get("category") || "";
    const search = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const where: string[] = [];
    const params: any[] = [];

    // Strict IDOR protection: non-privileged users ONLY ever see their own claims
    if (!canViewAll || scope === "own") {
      params.push(auth.user.userId);
      where.push(`ec.user_id = $${params.length}`);
    }

    const range = getFYDateRange(fy);
    if (range) {
      params.push(range.startDate, range.endDate);
      where.push(`ec.expense_date >= $${params.length - 1} AND ec.expense_date <= $${params.length}`);
    }
    if (statusFilter && statusFilter !== "ALL") {
      params.push(statusFilter);
      where.push(`ec.status = $${params.length}`);
    }
    if (categoryFilter && categoryFilter !== "ALL") {
      params.push(categoryFilter);
      where.push(`ec.category_name = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      where.push(`(LOWER(ec.paid_to) LIKE $${params.length} OR LOWER(ec.description) LIKE $${params.length} OR LOWER(ec.claim_no) LIKE $${params.length})`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const res = await query(
      `SELECT ec.*, ep.employee_id AS emp_code, ep.full_name AS emp_name, ep.department AS emp_dept
       FROM expense_claims ec
       LEFT JOIN employee_profiles ep ON ep.id = ec.employee_profile_id
       ${whereSql}
       ORDER BY ec.expense_date DESC, ec.created_at DESC
       LIMIT 250`,
      params
    );

    const items = res?.rows || [];
    const summary = {
      totalCount: items.length,
      pendingApprovalCount: items.filter((r: any) => r.status === "Submitted" || r.status === "Under Review").length,
      pendingApprovalAmount: items
        .filter((r: any) => r.status === "Submitted" || r.status === "Under Review")
        .reduce((s: number, r: any) => s + Number(r.amount || 0), 0),
      approvedAmount: items
        .filter((r: any) => r.status === "Approved")
        .reduce((s: number, r: any) => s + Number(r.approved_amount ?? r.amount ?? 0), 0),
      rejectedCount: items.filter((r: any) => r.status === "Rejected").length,
      pendingReimbursementAmount: items
        .filter((r: any) => r.status === "Approved" && r.paid_by === "Self" && r.reimbursement_status !== "Reimbursed")
        .reduce((s: number, r: any) => s + Math.max(0, Number(r.approved_amount ?? r.amount ?? 0) - Number(r.reimbursed_amount || 0)), 0),
      reimbursedAmount: items.reduce((s: number, r: any) => s + Number(r.reimbursed_amount || 0), 0),
    };

    return NextResponse.json({ items, claims: items, summary, tableMissing: false });
  } catch (err: any) {
    console.error("Failed to fetch expenses:", err);
    return NextResponse.json({ error: "Failed to fetch expenses." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canSubmit =
    auth.user.role === "Admin" ||
    auth.user.permissions.includes("expenses.submit") ||
    auth.user.permissions.includes("expenses.create");
  if (!canSubmit) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await initDb();
    const body = await req.json();

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Expense amount must be greater than zero." }, { status: 400 });
    }
    const categoryName = String(body.category_name || body.categoryName || "Other").trim();
    const titleStr = String(body.title || "").trim();
    const paidTo = String(body.paid_to || body.vendorOrPayee || titleStr || "General").trim();
    const description = String(body.description || titleStr || "").trim();
    if (!categoryName || !description) {
      return NextResponse.json({ error: "Category and Short Description / Title are required." }, { status: 400 });
    }

    const rawDate = body.expense_date || body.expenseDate;
    const expenseDate =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(String(rawDate))
        ? String(rawDate)
        : getCurrentBusinessDate();
    const fyCode = getFYFromDate(expenseDate);
    const paidBy =
      body.paid_by === "Company" || String(body.paymentMode || "").startsWith("Company")
        ? "Company"
        : "Self";
    const paymentMode = String(body.payment_mode || body.paymentMode || "UPI").trim();
    const isDraft = body.asDraft === true || body.action === "draft";
    const isOwnerDirect = (body.ownerDirectPost === true || body.isCompanyDirect === true) && (auth.user.role === "Admin" || auth.user.role === "Accounts");

    // Derive employee profile from authenticated userId (never trust client-submitted employee_id)
    const epRes = await query(`SELECT id FROM employee_profiles WHERE user_id = $1`, [auth.user.userId]);
    const empProfileId = epRes?.rows[0]?.id || null;

    const seqRes = await query(`SELECT nextval('expense_claim_seq')::bigint AS n`, []);
    const seqNum = seqRes?.rows[0]?.n || Date.now();
    const claimNo = `EXP-${fyCode}-${String(seqNum).padStart(5, "0")}`;
    const id = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const status = isOwnerDirect ? "Approved" : isDraft ? "Draft" : "Submitted";
    const reimbStatus = paidBy === "Self" ? (isOwnerDirect ? "Pending" : "Not Required") : "Not Required";

    await query(
      `INSERT INTO expense_claims (
        id, claim_no, employee_profile_id, user_id, expense_date, fy_code, amount, approved_amount,
        category_name, paid_to, description, payment_mode, paid_by, project_ref, client_id,
        merchant_address, transaction_ref, invoice_no, gstin, gst_amount, notes,
        receipt_url, receipt_mime, receipt_name, missing_receipt_reason,
        status, reimbursement_status, submitted_at, approved_by, approved_at, is_owner_entry
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31
      )`,
      [
        id,
        claimNo,
        empProfileId,
        auth.user.userId,
        expenseDate,
        fyCode,
        amount,
        isOwnerDirect ? amount : null,
        categoryName,
        paidTo,
        description,
        paymentMode,
        paidBy,
        body.project_ref ? String(body.project_ref).trim() : null,
        body.client_id ? String(body.client_id).trim() : null,
        body.merchant_address ? String(body.merchant_address).trim() : null,
        body.transaction_ref ? String(body.transaction_ref).trim() : null,
        body.invoice_no ? String(body.invoice_no).trim() : null,
        body.gstin ? String(body.gstin).trim() : null,
        Number(body.gst_amount) || 0,
        body.notes ? String(body.notes).trim() : null,
        body.receipt_url ? String(body.receipt_url) : null,
        body.receipt_mime ? String(body.receipt_mime) : null,
        body.receipt_name ? String(body.receipt_name) : null,
        body.missing_receipt_reason ? String(body.missing_receipt_reason).trim() : null,
        status,
        reimbStatus,
        isDraft ? null : new Date().toISOString(),
        isOwnerDirect ? auth.user.email : null,
        isOwnerDirect ? new Date().toISOString() : null,
        isOwnerDirect,
      ]
    );

    await query(
      `INSERT INTO expense_approval_history (id, claim_id, action, actor_user_id, actor_email, actor_name, note, previous_status, new_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULL,$8)`,
      [
        `eah_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        id,
        isOwnerDirect ? "OWNER_DIRECT_POST" : isDraft ? "DRAFT_SAVED" : "SUBMITTED",
        auth.user.userId,
        auth.user.email,
        auth.user.name,
        isOwnerDirect ? "Owner business expense posted directly" : "Expense claim created",
        status,
      ]
    );

    if (isOwnerDirect) {
      const txSeq = await query(`SELECT nextval('finance_tx_seq')::bigint AS n`, []);
      await query(
        `INSERT INTO finance_transactions (
          id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
          account_id, payment_mode, source_type, source_record_id, related_employee_id, created_by
        ) VALUES ($1,$2,$3,$4,'Expense',$5,$6,$7,$8,$9,$10,'expense_claim',$11,$12,$13)`,
        [
          `ftx_exp_${id}`,
          `TX-${fyCode}-${String(txSeq?.rows[0]?.n || Date.now()).padStart(6, "0")}`,
          expenseDate,
          fyCode,
          categoryName,
          paidTo,
          description,
          amount,
          paidBy === "Company" ? "acc_bank_main" : "acc_cash_petty",
          paymentMode,
          id,
          empProfileId,
          auth.user.email,
        ]
      );
    } else if (!isDraft) {
      await query(
        `INSERT INTO erp_notifications (id, target_role, title, message, module, record_ref)
         VALUES ($1, 'ADMIN', $2, $3, 'expenses', $4)`,
        [
          `notif_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          "New Expense Claim Submitted",
          `${auth.user.name} submitted ${claimNo} for ₹${amount.toFixed(2)} (${categoryName}).`,
          id,
        ]
      );
    }

    await logAudit(auth.user.userId, isDraft ? "EXPENSE_DRAFT" : "EXPENSE_SUBMITTED", { claimNo, amount, categoryName, paidBy }, { actorName: auth.user.name, module: "expenses", recordRef: claimNo, outcome: "SUCCESS" });
    return NextResponse.json(
      { success: true, id, claim_no: claimNo, status, claim: { id, claim_no: claimNo, status, amount } },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("Failed to submit expense:", err);
    return NextResponse.json({ error: "Failed to submit expense." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    const action = String(body.action || "").trim();
    if (!id || !action) {
      return NextResponse.json({ error: "Expense id and action are required." }, { status: 400 });
    }

    const cRes = await query(`SELECT * FROM expense_claims WHERE id = $1`, [id]);
    const claim = cRes?.rows[0];
    if (!claim) return NextResponse.json({ error: "Expense claim not found." }, { status: 404 });

    // Employee edit/resubmit/cancel on own Draft or Changes Requested
    if (action === "resubmit" || action === "edit_draft" || action === "cancel") {
      if (claim.user_id !== auth.user.userId && auth.user.role !== "Admin") {
        return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
      }
      if (!["Draft", "Changes Requested", "Rejected", "Submitted"].includes(claim.status)) {
        return NextResponse.json({ error: "Approved claims cannot be directly edited." }, { status: 400 });
      }
      if (action === "cancel") {
        await query(`UPDATE expense_claims SET status = 'Cancelled', updated_at = NOW() WHERE id = $1`, [id]);
        await query(
          `INSERT INTO expense_approval_history (id, claim_id, action, actor_user_id, actor_email, actor_name, previous_status, new_status)
           VALUES ($1,$2,'CANCELLED',$3,$4,$5,$6,'Cancelled')`,
          [`eah_${Date.now()}`, id, auth.user.userId, auth.user.email, auth.user.name, claim.status]
        );
        return NextResponse.json({ success: true, status: "Cancelled" });
      }

      const nextAmt = body.amount !== undefined ? Number(body.amount) : Number(claim.amount);
      if (!Number.isFinite(nextAmt) || nextAmt <= 0) {
        return NextResponse.json({ error: "Amount must be positive." }, { status: 400 });
      }
      const nextDate = body.expense_date || claim.expense_date;
      const nextStatus = action === "resubmit" ? "Submitted" : "Draft";
      await query(
        `UPDATE expense_claims SET
           expense_date = $1, fy_code = $2, amount = $3, category_name = $4, paid_to = $5,
           description = $6, payment_mode = $7, paid_by = $8, notes = $9,
           status = $10, submitted_at = COALESCE(submitted_at, NOW()), updated_at = NOW()
         WHERE id = $11`,
        [
          nextDate,
          getFYFromDate(nextDate),
          nextAmt,
          body.category_name || claim.category_name,
          body.paid_to || claim.paid_to,
          body.description || claim.description,
          body.payment_mode || claim.payment_mode,
          body.paid_by === "Company" ? "Company" : "Self",
          body.notes !== undefined ? body.notes : claim.notes,
          nextStatus,
          id,
        ]
      );
      await query(
        `INSERT INTO expense_approval_history (id, claim_id, action, actor_user_id, actor_email, actor_name, note, previous_status, new_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [`eah_${Date.now()}`, id, action.toUpperCase(), auth.user.userId, auth.user.email, auth.user.name, body.note || "Updated by employee", claim.status, nextStatus]
      );
      return NextResponse.json({ success: true, status: nextStatus });
    }

    // Approval / Review / Reject / Request Changes
    const canApprove = auth.user.role === "Admin" || auth.user.permissions.includes("expenses.approve");
    const canReview = canApprove || auth.user.permissions.includes("expenses.review");
    if (!canReview) {
      return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
    }

    if (action === "approve") {
      if (!canApprove) {
        return NextResponse.json({ error: "Final expense approval requires Administrator permission.", code: "FORBIDDEN" }, { status: 403 });
      }
      // Prevent ordinary employees from approving their own claim
      if (claim.user_id === auth.user.userId && auth.user.role !== "Admin") {
        return NextResponse.json({ error: "You cannot approve your own expense claim." }, { status: 403 });
      }

      const approvedAmt = body.approved_amount !== undefined ? Number(body.approved_amount) : Number(claim.amount);
      if (!Number.isFinite(approvedAmt) || approvedAmt <= 0) {
        return NextResponse.json({ error: "Approved amount must be positive." }, { status: 400 });
      }
      if (approvedAmt !== Number(claim.amount) && !String(body.adjustment_reason || "").trim()) {
        return NextResponse.json({ error: "Reason is required when adjusting the approved amount." }, { status: 400 });
      }

      // Idempotent atomic state transition: only approve if not already Approved
      const upd = await query(
        `UPDATE expense_claims
         SET status = 'Approved',
             approved_amount = $1,
             adjustment_reason = $2,
             reimbursement_status = CASE WHEN paid_by = 'Self' THEN 'Pending' ELSE 'Not Required' END,
             approved_by = $3,
             approved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status IN ('Submitted', 'Under Review', 'Changes Requested')
         RETURNING *`,
        [approvedAmt, body.adjustment_reason || null, auth.user.email, id]
      );
      if (!upd || upd.rows.length === 0) {
        return NextResponse.json({ error: "Expense claim is already approved or not in a submittable state." }, { status: 409 });
      }

      // Post to finance_transactions exactly once
      const existingTx = await query(`SELECT id FROM finance_transactions WHERE source_type='expense_claim' AND source_record_id=$1`, [id]);
      if (!existingTx || existingTx.rows.length === 0) {
        const txSeq = await query(`SELECT nextval('finance_tx_seq')::bigint AS n`, []);
        await query(
          `INSERT INTO finance_transactions (
            id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
            account_id, payment_mode, source_type, source_record_id, related_employee_id, created_by
          ) VALUES ($1,$2,$3,$4,'Expense',$5,$6,$7,$8,$9,$10,'expense_claim',$11,$12,$13)`,
          [
            `ftx_exp_${id}`,
            `TX-${claim.fy_code}-${String(txSeq?.rows[0]?.n || Date.now()).padStart(6, "0")}`,
            claim.expense_date,
            claim.fy_code,
            claim.category_name,
            claim.paid_to,
            claim.description,
            approvedAmt,
            claim.paid_by === "Company" ? "acc_bank_main" : null,
            claim.payment_mode,
            id,
            claim.employee_profile_id,
            auth.user.email,
          ]
        );
      }

      await query(
        `INSERT INTO expense_approval_history (id, claim_id, action, actor_user_id, actor_email, actor_name, note, previous_status, new_status)
         VALUES ($1,$2,'APPROVED',$3,$4,$5,$6,$7,'Approved')`,
        [`eah_${Date.now()}`, id, auth.user.userId, auth.user.email, auth.user.name, body.adjustment_reason || "Approved", claim.status]
      );
      if (claim.user_id) {
        await query(
          `INSERT INTO erp_notifications (id, target_user_id, title, message, module, record_ref)
           VALUES ($1,$2,'Expense Approved',$3,'expenses',$4)`,
          [`notif_${Date.now()}`, claim.user_id, `Your claim ${claim.claim_no} for ₹${approvedAmt.toFixed(2)} has been approved.`, id]
        );
      }
      await logAudit(auth.user.userId, "EXPENSE_APPROVED", { claimNo: claim.claim_no, approvedAmt }, { actorName: auth.user.name, module: "expenses", recordRef: claim.claim_no, outcome: "SUCCESS" });
      return NextResponse.json({ success: true, status: "Approved" });
    }

    if (action === "reject" || action === "request_changes" || action === "under_review") {
      const reason = String(body.reason || "").trim();
      if ((action === "reject" || action === "request_changes") && !reason) {
        return NextResponse.json({ error: "Reason is required." }, { status: 400 });
      }
      const nextStatus =
        action === "reject" ? "Rejected" : action === "request_changes" ? "Changes Requested" : "Under Review";
      await query(
        `UPDATE expense_claims SET
           status = $1::varchar,
           rejection_reason = CASE WHEN $1::text = 'Rejected' THEN $2::text ELSE rejection_reason END,
           change_request_reason = CASE WHEN $1::text = 'Changes Requested' THEN $2::text ELSE change_request_reason END,
           reviewed_by = $3,
           reviewed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $4 AND status IN ('Submitted', 'Under Review')`,
        [nextStatus, reason || null, auth.user.email, id]
      );
      await query(
        `INSERT INTO expense_approval_history (id, claim_id, action, actor_user_id, actor_email, actor_name, note, previous_status, new_status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          `eah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          id,
          action.toUpperCase(),
          auth.user.userId,
          auth.user.email,
          auth.user.name,
          reason || nextStatus,
          claim.status,
          nextStatus,
        ]
      );
      if (claim.user_id) {
        await query(
          `INSERT INTO erp_notifications (id, target_user_id, title, message, module, record_ref)
           VALUES ($1,$2,$3,$4,'expenses',$5)`,
          [
            `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            claim.user_id,
            `Expense ${nextStatus}`,
            `${claim.claim_no}: ${reason || nextStatus}`,
            id,
          ]
        );
      }
      await logAudit(auth.user.userId, `EXPENSE_${action.toUpperCase()}`, { claimNo: claim.claim_no, reason }, { actorName: auth.user.name, module: "expenses", recordRef: claim.claim_no, outcome: "SUCCESS" });
      return NextResponse.json({ success: true, status: nextStatus });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (err: any) {
    console.error("Failed to update expense:", err);
    return NextResponse.json({ error: "Failed to update expense." }, { status: 500 });
  }
}
