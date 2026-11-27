import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { getCurrentBusinessDate, getFYDateRange, getFYFromDate, normalizeFYCode } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.orders" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const tbl = await query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='finance_orders'`, []);
    if (!tbl || tbl.rows.length === 0) {
      return NextResponse.json({ items: [], tableMissing: true });
    }

    const fy = req.nextUrl.searchParams.get("fy") || "ALL";
    const status = req.nextUrl.searchParams.get("status") || "ALL";
    const clientId = req.nextUrl.searchParams.get("clientId") || "";
    const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();

    const where: string[] = [];
    const params: any[] = [];

    const range = fy === "ALL" ? null : getFYDateRange(normalizeFYCode(fy));
    if (range) {
      params.push(range.startDate, range.endDate);
      where.push(`fo.order_date >= $${params.length - 1} AND fo.order_date <= $${params.length}`);
    }
    if (status && status !== "ALL") {
      params.push(status);
      where.push(`fo.order_status = $${params.length}`);
    }
    if (clientId) {
      params.push(clientId);
      where.push(`fo.client_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(LOWER(fo.client_name) LIKE $${params.length} OR LOWER(fo.order_no) LIKE $${params.length} OR LOWER(COALESCE(fo.legacy_ref,'')) LIKE $${params.length} OR LOWER(fo.project_name) LIKE $${params.length} OR LOWER(COALESCE(fo.quotation_no,'')) LIKE $${params.length})`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const res = await query(
      `SELECT fo.*,
              COALESCE(p.received, 0)::numeric AS received_amount,
              GREATEST(0, fo.total_order_value - COALESCE(p.received, 0))::numeric AS outstanding_amount,
              COALESCE(oi.total_cost, 0)::numeric AS total_product_cost,
              COALESCE(oi.gross_profit, 0)::numeric AS gross_profit,
              COALESCE(mr.maint_profit, 0)::numeric AS maintenance_profit,
              (COALESCE(oi.gross_profit, 0) + COALESCE(mr.maint_profit, 0))::numeric AS total_project_profit
       FROM finance_orders fo
       LEFT JOIN (
         SELECT order_id, SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END) AS received
         FROM finance_customer_payments GROUP BY order_id
       ) p ON p.order_id = fo.id
       LEFT JOIN (
         SELECT order_id, SUM(total_cost) AS total_cost, SUM(gross_profit) AS gross_profit
         FROM finance_order_items GROUP BY order_id
       ) oi ON oi.order_id = fo.id
       LEFT JOIN (
         SELECT order_id, SUM(profit) AS maint_profit
         FROM finance_maintenance_records GROUP BY order_id
       ) mr ON mr.order_id = fo.id
       ${whereSql}
       ORDER BY fo.order_date DESC, fo.order_no DESC
       LIMIT 200`,
      params
    );

    // Fetch line items & maintenance for returned orders
    const orders = res?.rows || [];
    if (orders.length > 0) {
      const ids = orders.map((o: any) => o.id);
      const itemsRes = await query(`SELECT * FROM finance_order_items WHERE order_id = ANY($1) ORDER BY sort_order ASC`, [ids]);
      const maintRes = await query(`SELECT * FROM finance_maintenance_records WHERE order_id = ANY($1)`, [ids]);
      const itemsByOrder = new Map<string, any[]>();
      for (const it of itemsRes?.rows || []) {
        const list = itemsByOrder.get(it.order_id) || [];
        list.push(it);
        itemsByOrder.set(it.order_id, list);
      }
      const maintByOrder = new Map<string, any>();
      for (const m of maintRes?.rows || []) {
        maintByOrder.set(m.order_id, m);
      }
      for (const o of orders) {
        o.items = itemsByOrder.get(o.id) || [];
        o.maintenance = maintByOrder.get(o.id) || null;
        const tot = Number(o.total_order_value || 0);
        const rec = Number(o.received_amount || 0);
        o.payment_status =
          o.order_status === "Financially Closed"
            ? "Financially Closed"
            : tot > 0 && rec >= tot - 0.01
            ? "Fully Paid"
            : rec > 0
            ? "Partially Paid"
            : "Pending Payment";
      }
    }

    return NextResponse.json({ items: orders, orders, tableMissing: false });
  } catch (err: any) {
    console.error("Failed to fetch finance orders:", err);
    return NextResponse.json({ error: "Failed to load orders." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.orders" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const clientName = String(body.client_name || "").trim();
    const projectName = String(body.project_name || "").trim();
    if (!clientName || !projectName) {
      return NextResponse.json({ error: "Client Name and Project Name are required." }, { status: 400 });
    }

    const quotationNo = body.quotation_no ? String(body.quotation_no).trim() : null;
    if (quotationNo && !body.allowMultipleFromQuotation) {
      const dup = await query(
        `SELECT id, order_no FROM finance_orders WHERE quotation_no = $1 AND order_status <> 'Cancelled'`,
        [quotationNo]
      );
      if (dup && dup.rows.length > 0) {
        return NextResponse.json(
          { error: `Quotation ${quotationNo} is already converted to ${dup.rows[0].order_no}.` },
          { status: 409 }
        );
      }
    }

    const orderDate =
      body.order_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.order_date))
        ? String(body.order_date)
        : getCurrentBusinessDate();
    const fyCode = getFYFromDate(orderDate);

    // Check period lock
    const lockRes = await query(`SELECT is_locked FROM finance_period_locks WHERE fy_code = $1`, [fyCode]);
    if (lockRes?.rows[0]?.is_locked) {
      return NextResponse.json({ error: `Financial Year ${fyCode} is locked.` }, { status: 403 });
    }

    const seqRes = await query(`SELECT nextval('finance_order_seq')::bigint AS n`, []);
    const orderNo = `${fyCode}-AIA-ORD_${String(seqRes?.rows[0]?.n || Date.now()).padStart(6, "0")}`;
    const id = `ford_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const itemsInput = Array.isArray(body.items) ? body.items : [];
    const computedItems = itemsInput.map((it: any, idx: number) => {
      const qty = Number(it.qty) || 1;
      const sellingPrice = Number(it.selling_price ?? it.price) || 0;
      const salesValue = Number((qty * sellingPrice).toFixed(2));
      const mfg = Number(it.manufacturing_cost) || 0;
      const inst = Number(it.installation_cost) || 0;
      const other = Number(it.other_cost) || 0;
      const totalCost = Number((mfg + inst + other).toFixed(2));
      const grossProfit = Number((salesValue - totalCost).toFixed(2)); // Allows negative profit truthfully!
      const profitPct = salesValue > 0 ? Number(((grossProfit / salesValue) * 100).toFixed(2)) : 0;
      return {
        id: `foi_${Date.now()}_${idx}`,
        product_name: String(it.product_name || it.name || "Item").split(/\r?\n/)[0].trim(),
        category: it.category ? String(it.category).trim() : null,
        qty,
        selling_price: sellingPrice,
        sales_value: salesValue,
        manufacturing_cost: mfg,
        installation_cost: inst,
        other_cost: other,
        total_cost: totalCost,
        gross_profit: grossProfit,
        profit_pct: profitPct,
        sort_order: idx,
      };
    });

    const basicValue =
      body.basic_value !== undefined
        ? Number(body.basic_value)
        : computedItems.reduce((s: number, it: any) => s + it.sales_value, 0);
    const gstRate = body.gst_rate !== undefined ? Number(body.gst_rate) : 18;
    const gstAmount = Number(((basicValue * gstRate) / 100).toFixed(2));
    const totalOrderValue = Number((basicValue + gstAmount).toFixed(2));

    await query(
      `INSERT INTO finance_orders (
        id, order_no, client_id, client_name, quotation_no, quotation_snapshot,
        customer_po_no, customer_po_date, order_date, fy_code, project_name, project_description,
        basic_value, gst_rate, gst_amount, total_order_value, pi_number, pi_date, pi_amount,
        tax_invoice_number, tax_invoice_date, tax_invoice_amount, invoice_status, payment_terms,
        payment_due_date, order_status, remarks, source_type, created_by
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,'erp',$28
      )`,
      [
        id,
        orderNo,
        body.client_id || null,
        clientName,
        quotationNo,
        body.quotation_snapshot ? JSON.stringify(body.quotation_snapshot) : null,
        body.customer_po_no || null,
        body.customer_po_date || null,
        orderDate,
        fyCode,
        projectName,
        body.project_description || null,
        basicValue,
        gstRate,
        gstAmount,
        totalOrderValue,
        body.pi_number || null,
        body.pi_date || null,
        Number(body.pi_amount) || 0,
        body.tax_invoice_number || null,
        body.tax_invoice_date || null,
        Number(body.tax_invoice_amount) || 0,
        body.invoice_status || "Not Generated",
        body.payment_terms || "Advance",
        body.payment_due_date || null,
        body.order_status || "Confirmed",
        body.remarks || null,
        auth.user.email,
      ]
    );

    for (const it of computedItems) {
      await query(
        `INSERT INTO finance_order_items (
          id, order_id, product_name, category, qty, selling_price, sales_value,
          manufacturing_cost, installation_cost, other_cost, total_cost, gross_profit, profit_pct, sort_order
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          it.id,
          id,
          it.product_name,
          it.category,
          it.qty,
          it.selling_price,
          it.sales_value,
          it.manufacturing_cost,
          it.installation_cost,
          it.other_cost,
          it.total_cost,
          it.gross_profit,
          it.profit_pct,
          it.sort_order,
        ]
      );
    }

    if (body.maintenance && body.maintenance.required) {
      const mRev = Number(body.maintenance.revenue) || 0;
      const mCost = Number(body.maintenance.cost) || 0;
      const mProfit = Number((mRev - mCost).toFixed(2));
      await query(
        `INSERT INTO finance_maintenance_records (
          id, order_id, required, maintenance_type, start_date, end_date, status, revenue, cost, profit, notes
        ) VALUES ($1,$2,true,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          `fmr_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
          id,
          body.maintenance.maintenance_type || "AMC",
          body.maintenance.start_date || null,
          body.maintenance.end_date || null,
          body.maintenance.status || "Active",
          mRev,
          mCost,
          mProfit,
          body.maintenance.notes || null,
        ]
      );
    }

    await logAudit(auth.user.userId, "FINANCE_ORDER_CREATED", { orderNo, clientName, basicValue, totalOrderValue }, { actorName: auth.user.name, module: "finance_orders", recordRef: orderNo, outcome: "SUCCESS" });
    return NextResponse.json({ success: true, id, order_no: orderNo });
  } catch (err: any) {
    console.error("Failed to create finance order:", err);
    return NextResponse.json({ error: "Failed to create finance order." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.orders" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = String(body.id || "").trim();
    if (!id) return NextResponse.json({ error: "Order id required." }, { status: 400 });

    const oRes = await query(`SELECT * FROM finance_orders WHERE id = $1`, [id]);
    const existing = oRes?.rows[0];
    if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (body.order_status === "Financially Closed") {
      const pRes = await query(`SELECT COALESCE(SUM(CASE WHEN status='Posted' THEN amount ELSE 0 END), 0)::numeric AS paid FROM finance_customer_payments WHERE order_id=$1`, [id]);
      const paid = Number(pRes?.rows[0]?.paid || 0);
      const targetTotal = body.total_order_value !== undefined ? Number(body.total_order_value) : Number(existing.total_order_value);
      if (paid + 1 < targetTotal) {
        return NextResponse.json({ error: "Cannot mark Financially Closed while outstanding balance remains." }, { status: 400 });
      }
    }

    const nextBasic = body.basic_value !== undefined ? Number(body.basic_value) : null;
    const nextGstRate = body.gst_rate !== undefined ? Number(body.gst_rate) : null;
    const nextGstAmt =
      body.gst_amount !== undefined
        ? Number(body.gst_amount)
        : nextBasic !== null && nextGstRate !== null
        ? Number(((nextBasic * nextGstRate) / 100).toFixed(2))
        : null;
    const nextTotal =
      body.total_order_value !== undefined
        ? Number(body.total_order_value)
        : nextBasic !== null && nextGstAmt !== null
        ? Number((nextBasic + nextGstAmt).toFixed(2))
        : null;

    await query(
      `UPDATE finance_orders SET
         order_status = COALESCE($1, order_status),
         invoice_status = COALESCE($2, invoice_status),
         tax_invoice_number = COALESCE($3, tax_invoice_number),
         completion_date = COALESCE($4, completion_date),
         remarks = COALESCE($5, remarks),
         project_name = COALESCE($6, project_name),
         project_description = COALESCE($7, project_description),
         customer_po_no = COALESCE($8, customer_po_no),
         customer_po_date = COALESCE($9, customer_po_date),
         pi_number = COALESCE($10, pi_number),
         basic_value = COALESCE($11, basic_value),
         gst_rate = COALESCE($12, gst_rate),
         gst_amount = COALESCE($13, gst_amount),
         total_order_value = COALESCE($14, total_order_value),
         updated_by = $15,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $16`,
      [
        body.order_status || null,
        body.invoice_status || null,
        body.tax_invoice_number !== undefined ? body.tax_invoice_number : null,
        body.completion_date !== undefined ? body.completion_date : null,
        body.remarks !== undefined ? body.remarks : null,
        body.project_name || null,
        body.project_description !== undefined ? body.project_description : null,
        body.customer_po_no !== undefined ? body.customer_po_no : null,
        body.customer_po_date !== undefined ? body.customer_po_date : null,
        body.pi_number !== undefined ? body.pi_number : null,
        nextBasic,
        nextGstRate,
        nextGstAmt,
        nextTotal,
        auth.user.email,
        id,
      ]
    );

    if (Array.isArray(body.items)) {
      await query(`DELETE FROM finance_order_items WHERE order_id = $1`, [id]);
      for (let idx = 0; idx < body.items.length; idx++) {
        const it = body.items[idx];
        const qty = Number(it.qty) || 1;
        const sellingPrice = Number(it.selling_price ?? it.price) || 0;
        const salesValue = Number((qty * sellingPrice).toFixed(2));
        const mfg = Number(it.manufacturing_cost) || 0;
        const inst = Number(it.installation_cost) || 0;
        const other = Number(it.other_cost) || 0;
        const totalCost = Number((mfg + inst + other).toFixed(2));
        const grossProfit = Number((salesValue - totalCost).toFixed(2));
        const profitPct = salesValue > 0 ? Number(((grossProfit / salesValue) * 100).toFixed(2)) : 0;
        await query(
          `INSERT INTO finance_order_items (
            id, order_id, product_name, category, qty, selling_price, sales_value,
            manufacturing_cost, installation_cost, other_cost, total_cost, gross_profit, profit_pct, sort_order
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            `foi_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 5)}`,
            id,
            String(it.product_name || it.name || "Item").split(/\r?\n/)[0].trim(),
            it.category ? String(it.category).trim() : null,
            qty,
            sellingPrice,
            salesValue,
            mfg,
            inst,
            other,
            totalCost,
            grossProfit,
            profitPct,
            idx,
          ]
        );
      }
    }

    await logAudit(auth.user.userId, "FINANCE_ORDER_UPDATED", { orderNo: existing.order_no, order_status: body.order_status }, { actorName: auth.user.name, module: "finance_orders", recordRef: existing.order_no, outcome: "SUCCESS" });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to update order." }, { status: 500 });
  }
}
