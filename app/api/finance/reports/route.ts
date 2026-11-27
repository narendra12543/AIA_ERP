import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";
import { getCurrentFY, normalizeFYCode } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

function sanitizeCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsv(headers: string[], rows: Record<string, unknown>[], keys: string[]): string {
  const headerLine = headers.map(sanitizeCsvCell).join(",");
  const dataLines = rows.map((row) => keys.map((k) => sanitizeCsvCell(row[k])).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canReports =
    auth.user.role === "Admin" || auth.user.permissions.includes("finance.reports");
  if (!canReports) {
    return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
  }

  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  if (format === "csv") {
    const canExport =
      auth.user.role === "Admin" || auth.user.permissions.includes("finance.export");
    if (!canExport) {
      return NextResponse.json(
        { error: "Export permission required", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
  }

  const rawFy = req.nextUrl.searchParams.get("fy");
  const selectedFY = rawFy ? normalizeFYCode(rawFy) : getCurrentFY();
  const isAll = selectedFY === "ALL";
  const reportType = (req.nextUrl.searchParams.get("type") || "order_register").toLowerCase();

  try {
    await initDb();
    const tbl = await query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='finance_orders'`,
      []
    );
    if (!tbl || tbl.rows.length === 0) {
      if (format === "csv") {
        return new NextResponse("No data\r\n", {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="aven_${reportType}_${selectedFY}.csv"`,
          },
        });
      }
      return NextResponse.json({ selectedFY, type: reportType, rows: [], summary: {} });
    }

    const fyParams = isAll ? [] : [selectedFY];
    const fyOrderWhere = isAll ? "" : "WHERE fo.fy_code = $1";
    const fyTxWhere = isAll ? "" : "WHERE t.fy_code = $1";
    const fyClaimWhere = isAll ? "" : "WHERE c.fy_code = $1";

    let headers: string[] = [];
    let keys: string[] = [];
    let rows: Record<string, unknown>[] = [];
    let summary: Record<string, unknown> = {};

    if (reportType === "client_history") {
      const res = await query(
        `SELECT
          fo.client_name,
          COUNT(*)::int AS order_count,
          COALESCE(SUM(fo.basic_value), 0)::numeric(14,2) AS basic_turnover,
          COALESCE(SUM(fo.total_order_value), 0)::numeric(14,2) AS gst_inclusive_total,
          COALESCE(SUM(COALESCE(p.paid, 0)), 0)::numeric(14,2) AS received_amount,
          COALESCE(SUM(GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))), 0)::numeric(14,2) AS outstanding_amount,
          COALESCE(SUM(COALESCE(oi.total_cost, 0)), 0)::numeric(14,2) AS direct_cost,
          COALESCE(SUM(COALESCE(oi.gross_profit, fo.basic_value)), 0)::numeric(14,2) AS gross_profit,
          MAX(fo.order_date)::text AS last_order_date
         FROM finance_orders fo
         LEFT JOIN (SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid FROM finance_customer_payments GROUP BY order_id) p ON p.order_id = fo.id
         LEFT JOIN (SELECT order_id, SUM(total_cost) AS total_cost, SUM(gross_profit) AS gross_profit FROM finance_order_items GROUP BY order_id) oi ON oi.order_id = fo.id
         ${fyOrderWhere}
         GROUP BY fo.client_name
         ORDER BY basic_turnover DESC, fo.client_name ASC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "Client Name",
        "Orders",
        "Basic Turnover",
        "GST Inclusive Total",
        "Received",
        "Outstanding",
        "Direct Cost",
        "Gross Profit",
        "Last Order Date",
      ];
      keys = [
        "client_name",
        "order_count",
        "basic_turnover",
        "gst_inclusive_total",
        "received_amount",
        "outstanding_amount",
        "direct_cost",
        "gross_profit",
        "last_order_date",
      ];
    } else if (reportType === "receivables") {
      const res = await query(
        `SELECT
          fo.order_no,
          fo.fy_code AS financial_year,
          fo.order_date::text AS order_date,
          fo.client_name,
          fo.order_status AS status,
          fo.basic_value::numeric(14,2) AS basic_amount,
          fo.total_order_value::numeric(14,2) AS total_order_value,
          COALESCE(p.paid, 0)::numeric(14,2) AS received_amount,
          GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))::numeric(14,2) AS outstanding_amount
         FROM finance_orders fo
         LEFT JOIN (SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid FROM finance_customer_payments GROUP BY order_id) p ON p.order_id = fo.id
         WHERE GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0)) > 0 ${isAll ? "" : "AND fo.fy_code = $1"}
         ORDER BY outstanding_amount DESC, fo.order_date DESC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "Order No",
        "FY",
        "Order Date",
        "Client Name",
        "Status",
        "Basic Amount",
        "Total Order Value",
        "Received",
        "Outstanding",
      ];
      keys = [
        "order_no",
        "financial_year",
        "order_date",
        "client_name",
        "status",
        "basic_amount",
        "total_order_value",
        "received_amount",
        "outstanding_amount",
      ];
    } else if (reportType === "profitability") {
      const res = await query(
        `SELECT
          fo.order_no,
          fo.fy_code AS financial_year,
          fo.order_date::text AS order_date,
          fo.client_name,
          fo.basic_value::numeric(14,2) AS basic_amount,
          COALESCE(oi.total_cost, 0)::numeric(14,2) AS direct_cost,
          COALESCE(oi.gross_profit, fo.basic_value)::numeric(14,2) AS gross_profit,
          CASE WHEN fo.basic_value > 0 THEN ROUND((COALESCE(oi.gross_profit, fo.basic_value) / fo.basic_value) * 100, 2) ELSE 0 END AS margin_pct,
          COALESCE(mr.revenue, 0)::numeric(14,2) AS maintenance_revenue,
          COALESCE(mr.profit, 0)::numeric(14,2) AS maintenance_profit
         FROM finance_orders fo
         LEFT JOIN (SELECT order_id, SUM(total_cost) AS total_cost, SUM(gross_profit) AS gross_profit FROM finance_order_items GROUP BY order_id) oi ON oi.order_id = fo.id
         LEFT JOIN (SELECT order_id, SUM(revenue) AS revenue, SUM(profit) AS profit FROM finance_maintenance_records GROUP BY order_id) mr ON mr.order_id = fo.id
         ${fyOrderWhere}
         ORDER BY fo.order_date DESC, fo.order_no DESC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "Order No",
        "FY",
        "Order Date",
        "Client Name",
        "Basic Turnover",
        "Direct Cost",
        "Gross Profit",
        "Margin %",
        "Maintenance Revenue",
        "Maintenance Profit",
      ];
      keys = [
        "order_no",
        "financial_year",
        "order_date",
        "client_name",
        "basic_amount",
        "direct_cost",
        "gross_profit",
        "margin_pct",
        "maintenance_revenue",
        "maintenance_profit",
      ];
    } else if (reportType === "expenses") {
      const res = await query(
        `SELECT
          c.claim_no,
          c.fy_code AS financial_year,
          c.expense_date::text AS expense_date,
          COALESCE(ep.full_name, u.name, 'System') AS employee_name,
          COALESCE(ep.employee_id, '-') AS employee_id,
          COALESCE(ec.name, c.category_name, 'Other') AS category,
          c.description AS title,
          c.paid_to AS vendor_or_payee,
          c.amount::numeric(14,2) AS amount,
          c.status,
          c.reimbursement_status
         FROM expense_claims c
         LEFT JOIN employee_profiles ep ON ep.id = c.employee_profile_id
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN expense_categories ec ON ec.id = c.category_id
         ${fyClaimWhere}
         ORDER BY c.expense_date DESC, c.id DESC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "Claim No",
        "FY",
        "Expense Date",
        "Employee",
        "Employee ID",
        "Category",
        "Title",
        "Vendor/Payee",
        "Amount",
        "Status",
        "Reimbursement",
      ];
      keys = [
        "claim_no",
        "financial_year",
        "expense_date",
        "employee_name",
        "employee_id",
        "category",
        "title",
        "vendor_or_payee",
        "amount",
        "status",
        "reimbursement_status",
      ];
    } else if (reportType === "cash_flow") {
      const res = await query(
        `SELECT
          t.tx_no,
          t.fy_code AS financial_year,
          t.tx_date::text AS tx_date,
          t.tx_type,
          t.category,
          t.description,
          COALESCE(fa.name, '-') AS account_name,
          t.payment_mode,
          t.reference_no,
          t.amount::numeric(14,2) AS amount
         FROM finance_transactions t
         LEFT JOIN finance_accounts fa ON fa.id = t.account_id
         ${fyTxWhere}
         ORDER BY t.tx_date DESC, t.id DESC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "TX No",
        "FY",
        "Date",
        "Type",
        "Category",
        "Description",
        "Account",
        "Mode",
        "Reference",
        "Amount",
      ];
      keys = [
        "tx_no",
        "financial_year",
        "tx_date",
        "tx_type",
        "category",
        "description",
        "account_name",
        "payment_mode",
        "reference_no",
        "amount",
      ];
    } else {
      // order_register
      const res = await query(
        `SELECT
          fo.order_no,
          fo.fy_code AS financial_year,
          fo.order_date::text AS order_date,
          fo.client_name,
          fo.quotation_no,
          fo.order_status AS status,
          fo.basic_value::numeric(14,2) AS basic_amount,
          fo.gst_amount::numeric(14,2) AS gst_amount,
          fo.total_order_value::numeric(14,2) AS total_order_value,
          COALESCE(p.paid, 0)::numeric(14,2) AS received_amount,
          GREATEST(0, fo.total_order_value - COALESCE(p.paid, 0))::numeric(14,2) AS outstanding_amount,
          COALESCE(oi.total_cost, 0)::numeric(14,2) AS direct_cost,
          COALESCE(oi.gross_profit, fo.basic_value)::numeric(14,2) AS gross_profit
         FROM finance_orders fo
         LEFT JOIN (SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS paid FROM finance_customer_payments GROUP BY order_id) p ON p.order_id = fo.id
         LEFT JOIN (SELECT order_id, SUM(total_cost) AS total_cost, SUM(gross_profit) AS gross_profit FROM finance_order_items GROUP BY order_id) oi ON oi.order_id = fo.id
         ${fyOrderWhere}
         ORDER BY fo.order_date DESC, fo.order_no DESC`,
        fyParams
      );
      rows = res.rows;
      headers = [
        "Order No",
        "FY",
        "Order Date",
        "Client Name",
        "Quotation No",
        "Status",
        "Basic Amount",
        "GST Amount",
        "Total Order Value",
        "Received",
        "Outstanding",
        "Direct Cost",
        "Gross Profit",
      ];
      keys = [
        "order_no",
        "financial_year",
        "order_date",
        "client_name",
        "quotation_no",
        "status",
        "basic_amount",
        "gst_amount",
        "total_order_value",
        "received_amount",
        "outstanding_amount",
        "direct_cost",
        "gross_profit",
      ];
    }

    summary = {
      rowCount: rows.length,
    };

    if (format === "csv") {
      const csv = toCsv(headers, rows, keys);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="aven_${reportType}_${selectedFY}.csv"`,
        },
      });
    }

    return NextResponse.json({
      selectedFY,
      type: reportType,
      headers,
      keys,
      rows,
      summary,
    });
  } catch (err) {
    console.error("Finance reports error:", err);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}
