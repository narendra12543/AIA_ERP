import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getCurrentFY, getFYDateRange, normalizeFYCode } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canFinance =
    auth.user.role === "Admin" ||
    auth.user.permissions.includes("finance.dashboard") ||
    auth.user.permissions.includes("overview.view");
  if (!canFinance) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  try {
    await initDb();
    const tbl = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='finance_orders'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({
        tableMissing: true,
        selectedFY: req.nextUrl.searchParams.get("fy") || getCurrentFY(),
        kpis: {
          uniqueClients: 0,
          convertedOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          basicTurnover: 0,
          gstInclusiveValue: 0,
          customerReceived: 0,
          selectedFYOutstanding: 0,
          lifetimeOutstanding: 0,
          productSales: 0,
          directProjectCosts: 0,
          grossProfit: 0,
          maintenanceRevenue: 0,
          maintenanceProfit: 0,
          operatingExpenses: 0,
          otherIncome: 0,
          netProfit: 0,
          cashBalance: 0,
          pendingReimbursements: 0,
          pendingExpenseApprovals: 0,
          activePurchaseOrders: 0,
          totalPurchaseOrders: 0,
          registeredVendors: 0,
        },
        monthlySeries: [],
        expenseByCategory: [],
        clientSummary: [],
      });
    }

    const fyParam = req.nextUrl.searchParams.get("fy") || getCurrentFY();
    const fyRange = fyParam === "ALL" ? null : getFYDateRange(normalizeFYCode(fyParam));
    const fyParams = fyRange ? [fyRange.startDate, fyRange.endDate] : [];
    const orderDateCond = fyRange ? `AND fo.order_date >= $1 AND fo.order_date <= $2` : "";
    const payDateCond = fyRange ? `AND fcp.payment_date >= $1 AND fcp.payment_date <= $2` : "";
    const txDateCond = fyRange ? `AND ft.tx_date >= $1 AND ft.tx_date <= $2` : "";
    const expDateCond = fyRange ? `AND ec.expense_date >= $1 AND ec.expense_date <= $2` : "";

    const ordersRes = await query(
      `SELECT
         COUNT(DISTINCT LOWER(fo.client_name))::int AS unique_clients,
         COUNT(*)::int AS converted_orders,
         COUNT(*) FILTER (WHERE fo.order_status IN ('Confirmed','In Progress'))::int AS confirmed_orders,
         COUNT(*) FILTER (WHERE fo.order_status IN ('Completed','Financially Closed'))::int AS completed_orders,
         COALESCE(SUM(CASE WHEN fo.order_status <> 'Cancelled' THEN fo.basic_value ELSE 0 END), 0)::numeric AS basic_turnover,
         COALESCE(SUM(CASE WHEN fo.order_status <> 'Cancelled' THEN fo.total_order_value ELSE 0 END), 0)::numeric AS gst_inclusive_value,
         COALESCE(SUM(oi.sales_value), 0)::numeric AS product_sales,
         COALESCE(SUM(oi.total_cost), 0)::numeric AS direct_costs,
         COALESCE(SUM(oi.gross_profit), 0)::numeric AS product_gross_profit,
         COALESCE(SUM(mr.revenue), 0)::numeric AS maint_revenue,
         COALESCE(SUM(mr.profit), 0)::numeric AS maint_profit
       FROM finance_orders fo
       LEFT JOIN (
         SELECT order_id, SUM(sales_value) AS sales_value, SUM(total_cost) AS total_cost, SUM(gross_profit) AS gross_profit
         FROM finance_order_items GROUP BY order_id
       ) oi ON oi.order_id = fo.id
       LEFT JOIN (
         SELECT order_id, SUM(revenue) AS revenue, SUM(profit) AS profit
         FROM finance_maintenance_records GROUP BY order_id
       ) mr ON mr.order_id = fo.id
       WHERE 1=1 ${orderDateCond}`,
      fyParams
    );
    const paymentsInFyRes = await query(
      `SELECT COALESCE(SUM(fcp.amount), 0)::numeric AS received_in_fy
       FROM finance_customer_payments fcp
       WHERE fcp.status = 'Posted' ${
         fyRange ? `AND (fcp.fy_code = $3 OR (fcp.payment_date >= $1 AND fcp.payment_date <= $2))` : ""
       }`,
      fyRange ? [fyRange.startDate, fyRange.endDate, fyRange.fy] : []
    );
    const allOrdersRecvRes = await query(
      `SELECT
         COALESCE(SUM(fo.total_order_value), 0)::numeric AS total_orders_val,
         COALESCE(SUM(COALESCE(p.paid, 0)), 0)::numeric AS total_paid_val,
         COALESCE(SUM(CASE WHEN 1=1 ${orderDateCond} THEN GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0)) ELSE 0 END), 0)::numeric AS fy_outstanding,
         COALESCE(SUM(GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))), 0)::numeric AS lifetime_outstanding
       FROM finance_orders fo
       LEFT JOIN (
         SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid
         FROM finance_customer_payments GROUP BY order_id
       ) p ON p.order_id = fo.id
       WHERE fo.order_status <> 'Cancelled'`,
      fyParams
    );
    const txSummaryRes = await query(
      `SELECT
         COALESCE(SUM(CASE WHEN ft.tx_type = 'Expense' AND ft.posting_status = 'Posted' THEN ft.amount ELSE 0 END), 0)::numeric AS operating_expenses,
         COALESCE(SUM(CASE WHEN ft.tx_type = 'Income' AND ft.posting_status = 'Posted' THEN ft.amount ELSE 0 END), 0)::numeric AS other_income,
         COALESCE(SUM(CASE WHEN ft.tx_type IN ('Customer Receipt','Income','Opening Balance') AND ft.posting_status = 'Posted' THEN ft.amount ELSE 0 END), 0)::numeric AS cash_inflows,
         COALESCE(SUM(CASE WHEN (ft.tx_type IN ('Reimbursement','Supplier Payment','Refund') OR (ft.tx_type = 'Expense' AND ft.account_id IS NOT NULL)) AND ft.posting_status = 'Posted' THEN ft.amount ELSE 0 END), 0)::numeric AS cash_outflows
       FROM finance_transactions ft
       WHERE 1=1 ${txDateCond}`,
      fyParams
    );
    const accountsOpenRes = await query(
      `SELECT COALESCE(SUM(opening_balance), 0)::numeric AS opening_balance FROM finance_accounts WHERE is_active = true`,
      []
    );
    const expSummaryRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE ec.status IN ('Submitted','Under Review'))::int AS pending_approvals,
         COALESCE(SUM(CASE WHEN ec.status = 'Approved' AND ec.paid_by = 'Self' AND ec.reimbursement_status IN ('Pending','Partially Reimbursed')
             THEN GREATEST(0, COALESCE(ec.approved_amount, ec.amount) - ec.reimbursed_amount) ELSE 0 END), 0)::numeric AS pending_reimbursements
       FROM expense_claims ec
       WHERE 1=1 ${expDateCond}`,
      fyParams
    );
    const expByCatRes = await query(
      `SELECT ec.category_name AS category, COALESCE(SUM(COALESCE(ec.approved_amount, ec.amount)), 0)::numeric AS total, COUNT(*)::int AS count
       FROM expense_claims ec
       WHERE ec.status = 'Approved' ${expDateCond}
       GROUP BY ec.category_name
       ORDER BY total DESC`,
      fyParams
    );
    const clientSumRes = await query(
      `SELECT
         COALESCE(fo.client_id, fo.client_name) AS client_key,
         fo.client_name,
         COUNT(*)::int AS total_orders,
         COUNT(*) FILTER (WHERE fo.order_status IN ('Completed','Financially Closed'))::int AS completed_orders,
         COALESCE(SUM(fo.basic_value), 0)::numeric AS basic_turnover,
         COALESCE(SUM(fo.total_order_value), 0)::numeric AS total_business_value,
         COALESCE(SUM(COALESCE(p.paid, 0)), 0)::numeric AS customer_received,
         COALESCE(SUM(GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))), 0)::numeric AS outstanding,
         COALESCE(SUM(COALESCE(oi.total_cost, 0)), 0)::numeric AS total_cost,
         MAX(fo.order_date) AS last_order_date
       FROM finance_orders fo
       LEFT JOIN (SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid FROM finance_customer_payments GROUP BY order_id) p ON p.order_id = fo.id
       LEFT JOIN (SELECT order_id, SUM(total_cost) AS total_cost FROM finance_order_items GROUP BY order_id) oi ON oi.order_id = fo.id
       WHERE fo.order_status <> 'Cancelled' ${orderDateCond}
       GROUP BY COALESCE(fo.client_id, fo.client_name), fo.client_name
       ORDER BY total_business_value DESC`,
      fyParams
    );
    const poStatsRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('Draft','Issued','Sent'))::int AS active_pos,
         COUNT(*)::int AS total_pos,
         COUNT(*) FILTER (WHERE COALESCE(approval_status, data->>'approval_status', 'Draft') = 'Pending Approval')::int AS pending_po_approvals
       FROM purchase_orders`,
      []
    ).catch(async () => {
      const fallback = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('Draft','Issued','Sent'))::int AS active_pos,
           COUNT(*)::int AS total_pos,
           COUNT(*) FILTER (WHERE COALESCE(data->>'approval_status', 'Draft') = 'Pending Approval')::int AS pending_po_approvals
         FROM purchase_orders`,
        []
      ).catch(() => ({ rows: [{ active_pos: 0, total_pos: 0, pending_po_approvals: 0 }] }));
      return fallback;
    });
    const outstandingOrdersRes = await query(
      `SELECT fo.id, fo.order_no, fo.client_name, fo.order_date, fo.total_order_value,
              COALESCE(p.paid, 0)::numeric AS paid_amount,
              GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))::numeric AS outstanding
       FROM finance_orders fo
       LEFT JOIN (
         SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid
         FROM finance_customer_payments GROUP BY order_id
       ) p ON p.order_id = fo.id
       WHERE fo.order_status <> 'Cancelled' ${orderDateCond}
         AND GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0)) > 0
       ORDER BY outstanding DESC, fo.order_date DESC
       LIMIT 10`,
      fyParams
    ).catch(() => ({ rows: [] }));
    const vendorCountRes = await query(`SELECT COUNT(*)::int AS cnt FROM vendors`, []).catch(() => ({
      rows: [{ cnt: 0 }],
    }));

    const ord = ordersRes?.rows[0] || {};
    const recvFy = Number(paymentsInFyRes?.rows[0]?.received_in_fy || 0);
    const recvAll = allOrdersRecvRes?.rows[0] || {};
    const tx = txSummaryRes?.rows[0] || {};
    const openBal = Number(accountsOpenRes?.rows[0]?.opening_balance || 0);
    const expSum = expSummaryRes?.rows[0] || {};
    const poStats = poStatsRes?.rows[0] || {};

    const basicTurnover = Number(ord.basic_turnover || 0);
    const directCosts = Number(ord.direct_costs || 0);
    const maintProfit = Number(ord.maint_profit || 0);
    const grossProfit = basicTurnover - directCosts + maintProfit;
    const operatingExpenses = Number(tx.operating_expenses || 0);
    const otherIncome = Number(tx.other_income || 0);
    const netProfit = grossProfit - operatingExpenses + otherIncome;
    const cashBalance = openBal + recvFy + Number(tx.cash_inflows || 0) - Number(tx.cash_outflows || 0);

    // Monthly Turnover & Expense series
    const monthlyRes = await query(
      `SELECT TO_CHAR(d.dt, 'YYYY-MM') AS month,
              COALESCE(o.turnover, 0)::numeric AS turnover,
              COALESCE(o.order_total_incl_gst, 0)::numeric AS order_total_incl_gst,
              COALESCE(e.expenses, 0)::numeric AS expenses
       FROM (
         SELECT DISTINCT DATE_TRUNC('month', fo.order_date) AS dt FROM finance_orders fo WHERE 1=1 ${orderDateCond}
         UNION
         SELECT DISTINCT DATE_TRUNC('month', ec.expense_date) AS dt FROM expense_claims ec WHERE ec.status = 'Approved' ${expDateCond}
       ) d
       LEFT JOIN (
         SELECT DATE_TRUNC('month', fo.order_date) AS dt,
                SUM(fo.basic_value) AS turnover,
                SUM(fo.total_order_value) AS order_total_incl_gst
         FROM finance_orders fo WHERE fo.order_status <> 'Cancelled' ${orderDateCond} GROUP BY 1
       ) o ON o.dt = d.dt
       LEFT JOIN (
         SELECT DATE_TRUNC('month', ec.expense_date) AS dt, SUM(COALESCE(ec.approved_amount, ec.amount)) AS expenses
         FROM expense_claims ec WHERE ec.status = 'Approved' ${expDateCond} GROUP BY 1
       ) e ON e.dt = d.dt
       ORDER BY month ASC`,
      fyParams
    );

    return NextResponse.json({
      tableMissing: false,
      selectedFY: fyParam,
      kpis: {
        uniqueClients: Number(ord.unique_clients || 0),
        convertedOrders: Number(ord.converted_orders || 0),
        confirmedOrders: Number(ord.confirmed_orders || 0),
        completedOrders: Number(ord.completed_orders || 0),
        basicTurnover,
        gstInclusiveValue: Number(ord.gst_inclusive_value || 0),
        customerReceived: recvFy,
        selectedFYOutstanding: Number(recvAll.fy_outstanding || 0),
        lifetimeOutstanding: Number(recvAll.lifetime_outstanding || 0),
        productSales: Number(ord.product_sales || 0),
        directProjectCosts: directCosts,
        grossProfit,
        maintenanceRevenue: Number(ord.maint_revenue || 0),
        maintenanceProfit: maintProfit,
        operatingExpenses,
        otherIncome,
        netProfit,
        cashBalance,
        pendingReimbursements: Number(expSum.pending_reimbursements || 0),
        pendingExpenseApprovals: Number(expSum.pending_approvals || 0),
        activePurchaseOrders: Number(poStats.active_pos || 0),
        totalPurchaseOrders: Number(poStats.total_pos || 0),
        pendingPoApprovalsCount: Number(poStats.pending_po_approvals || 0),
        registeredVendors: Number(vendorCountRes?.rows[0]?.cnt || 0),
      },
      monthlySeries: monthlyRes?.rows || [],
      expenseByCategory: expByCatRes?.rows || [],
      clientSummary: clientSumRes?.rows || [],
      outstandingOrders: outstandingOrdersRes?.rows || [],
    });
  } catch (err: any) {
    console.error("Failed to compute finance dashboard:", err);
    return NextResponse.json({ error: "Failed to load finance dashboard." }, { status: 500 });
  }
}
