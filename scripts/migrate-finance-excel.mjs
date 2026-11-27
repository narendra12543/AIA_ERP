import fs from "fs";
import crypto from "crypto";
import ExcelJS from "exceljs";
import pg from "pg";

const { Pool } = pg;

const DEFAULT_WORKBOOK =
  "C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751/.user_uploaded/media_1795773460135_87b31ae8.xlsm";

function cellVal(cell) {
  if (!cell) return null;
  const v = cell.value;
  if (v && typeof v === "object" && "result" in v) return v.result ?? null;
  return v ?? null;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isoDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function fyFromDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date("2026-11-01");
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const y1 = m >= 4 ? y : y - 1;
  return `${y1}-${String((y1 + 1) % 100).padStart(2, "0")}`;
}

async function run() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const wbPath = args.find((a) => !a.startsWith("--")) || DEFAULT_WORKBOOK;

  if (!fs.existsSync(wbPath)) {
    throw new Error(`Workbook not found: ${wbPath}`);
  }
  const buf = fs.readFileSync(wbPath);
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);

  const wsDb = wb.getWorksheet("CLIENT_DATABASE");
  const wsAcc = wb.getWorksheet("03_Accounts");
  if (!wsDb || !wsAcc) throw new Error("Required sheets CLIENT_DATABASE or 03_Accounts missing.");

  const orders = [];
  for (let r = 2; r <= wsDb.rowCount; r++) {
    const row = wsDb.getRow(r);
    const legacyRef = String(cellVal(row.getCell(1)) || "").trim();
    const companyName = String(cellVal(row.getCell(2)) || "").trim();
    if (!legacyRef || !companyName) continue;

    const orderDate = isoDate(cellVal(row.getCell(13))) || "2026-09-01";
    const fyCode = fyFromDate(orderDate);
    const basicValue = num(cellVal(row.getCell(18)));
    const gstRate = num(cellVal(row.getCell(19)));
    const gstAmount = num(cellVal(row.getCell(20)));
    const totalValue = num(cellVal(row.getCell(21)));
    const totalReceived = num(cellVal(row.getCell(37)));
    const balance = num(cellVal(row.getCell(38)));

    const payments = [];
    const pDefs = [
      { amtCol: 30, dtCol: 31, type: "Advance" },
      { amtCol: 32, dtCol: 33, type: "Progress Payment" },
      { amtCol: 34, dtCol: 35, type: "Progress Payment" },
      { amtCol: 36, dtCol: null, type: "Other Payment" },
    ];
    for (const pd of pDefs) {
      const amt = num(cellVal(row.getCell(pd.amtCol)));
      if (amt > 0) {
        const dt = pd.dtCol ? isoDate(cellVal(row.getCell(pd.dtCol))) : null;
        payments.push({
          amount: amt,
          payment_date: dt,
          payment_type: pd.type,
          date_missing_flag: !dt,
        });
      }
    }

    const prodName = String(cellVal(row.getCell(50)) || cellVal(row.getCell(14)) || "Product").trim();
    const qty = num(cellVal(row.getCell(52))) || 1;
    const sellPrice = num(cellVal(row.getCell(53)));
    const salesVal = num(cellVal(row.getCell(54))) || basicValue;
    const mfgCost = num(cellVal(row.getCell(55)));
    const instCost = num(cellVal(row.getCell(56)));
    const otherCost = num(cellVal(row.getCell(57)));
    const totalCost = num(cellVal(row.getCell(58))) || mfgCost + instCost + otherCost;
    const grossProfit = salesVal - totalCost;
    const profitPct = salesVal > 0 ? Number(((grossProfit / salesVal) * 100).toFixed(2)) : 0;

    orders.push({
      sourceRow: r,
      legacyRef,
      companyName,
      gstin: String(cellVal(row.getCell(10)) || "").trim(),
      orderDate,
      fyCode,
      projectName: String(cellVal(row.getCell(14)) || prodName).trim(),
      projectDesc: String(cellVal(row.getCell(15)) || "").trim(),
      customerPoNo: String(cellVal(row.getCell(16)) || "").trim(),
      customerPoDate: isoDate(cellVal(row.getCell(17))),
      basicValue,
      gstRate,
      gstAmount,
      totalValue,
      piNumber: String(cellVal(row.getCell(22)) || "").trim(),
      piDate: isoDate(cellVal(row.getCell(23))),
      piAmount: num(cellVal(row.getCell(24))),
      tiNumber: String(cellVal(row.getCell(25)) || "").trim(),
      tiDate: isoDate(cellVal(row.getCell(26))),
      tiAmount: num(cellVal(row.getCell(27))),
      invoiceStatus: String(cellVal(row.getCell(28)) || "Not Generated").trim(),
      orderStatus: String(cellVal(row.getCell(40)) || "Completed").trim(),
      totalReceived,
      balance,
      payments,
      item: {
        productId: String(cellVal(row.getCell(49)) || "").trim(),
        productName: prodName,
        category: String(cellVal(row.getCell(51)) || "").trim(),
        qty,
        sellingPrice: sellPrice,
        salesValue: salesVal,
        mfgCost,
        instCost,
        otherCost,
        totalCost,
        grossProfit,
        profitPct,
      },
      maintenance: {
        required: String(cellVal(row.getCell(41)) || "").toLowerCase() === "yes",
        type: String(cellVal(row.getCell(42)) || "").trim(),
        startDate: isoDate(cellVal(row.getCell(43))),
        endDate: isoDate(cellVal(row.getCell(44))),
        revenue: num(cellVal(row.getCell(45))),
        cost: num(cellVal(row.getCell(46))),
        profit: num(cellVal(row.getCell(47))),
        status: String(cellVal(row.getCell(48)) || "Not Applicable").trim(),
      },
      remarks: String(cellVal(row.getCell(62)) || "").trim(),
    });
  }

  const expenses = [];
  for (let r = 11; r <= wsAcc.rowCount; r++) {
    const row = wsAcc.getRow(r);
    const dt = isoDate(cellVal(row.getCell(1)));
    const typ = String(cellVal(row.getCell(2)) || "").trim();
    const cat = String(cellVal(row.getCell(3)) || "").trim();
    const party = String(cellVal(row.getCell(4)) || "").trim();
    const desc = String(cellVal(row.getCell(5)) || "").trim();
    const amtRaw = cellVal(row.getCell(6));
    const notes = String(cellVal(row.getCell(7)) || "").trim();
    if (!dt && !typ && !cat && !desc) continue;
    const amt = num(amtRaw);
    expenses.push({
      sourceRow: r,
      expenseDate: dt || "2026-09-01",
      fyCode: fyFromDate(dt || "2026-09-01"),
      txType: typ || "Expense",
      category: cat || "Other",
      paidTo: party || "Unknown",
      description: desc || cat || "Historical Expense",
      amount: amt,
      zeroAmountFlag: amt === 0,
      notes,
    });
  }

  const summary = {
    mode: apply ? "APPLY" : "DRY_RUN",
    workbookSha256: sha256,
    orderCount: orders.length,
    basicTurnover: orders.reduce((s, o) => s + o.basicValue, 0),
    gstInclusiveTotal: orders.reduce((s, o) => s + o.totalValue, 0),
    customerReceived: orders.reduce((s, o) => s + o.totalReceived, 0),
    outstanding: orders.reduce((s, o) => s + o.balance, 0),
    productCost: orders.reduce((s, o) => s + o.item.totalCost, 0),
    grossProfit: orders.reduce((s, o) => s + o.item.grossProfit + o.maintenance.profit, 0),
    expenseCount: expenses.length,
    zeroAmountExpenseCount: expenses.filter((e) => e.zeroAmountFlag).length,
    totalHistoricalExpenses: expenses.reduce((s, e) => s + e.amount, 0),
  };
  summary.historicalNetProfit = summary.grossProfit - summary.totalHistoricalExpenses;

  console.log("RECONCILIATION_SUMMARY:", JSON.stringify(summary, null, 2));
  if (!apply) {
    console.log("DRY_RUN_COMPLETE: Pass --apply with DATABASE_URL set to import.");
    return;
  }

  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required for --apply");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const dupBatch = await client.query(`SELECT id FROM finance_import_batches WHERE workbook_sha256 = $1`, [sha256]);
    if (dupBatch.rows.length > 0) {
      console.log("WORKBOOK_ALREADY_IMPORTED=true (idempotent skip)");
      await client.query("ROLLBACK");
      return;
    }

    const existingClients = (await client.query(`SELECT id, name, data FROM clients`)).rows;

    for (const o of orders) {
      const matched = existingClients.find((c) => {
        const cGstin = (c.data?.gstin || "").trim().toUpperCase();
        if (o.gstin && cGstin && o.gstin.toUpperCase() === cGstin) return true;
        return c.name.trim().toLowerCase() === o.companyName.toLowerCase();
      });

      const orderId = `ford_hist_${o.legacyRef}`;
      const seqRes = await client.query(`SELECT nextval('finance_order_seq')::bigint AS n`);
      const orderNo = `${o.fyCode}-AIA-ORD_${String(seqRes.rows[0].n).padStart(6, "0")}`;

      await client.query(
        `INSERT INTO finance_orders (
          id, order_no, legacy_ref, client_id, client_name, customer_po_no, customer_po_date,
          order_date, fy_code, project_name, project_description, basic_value, gst_rate, gst_amount,
          total_order_value, pi_number, pi_date, pi_amount, tax_invoice_number, tax_invoice_date,
          tax_invoice_amount, invoice_status, order_status, remarks, source_type, is_historical, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,'excel_import',true,'excel_migration')
        ON CONFLICT (id) DO NOTHING`,
        [
          orderId,
          orderNo,
          o.legacyRef,
          matched ? matched.id : null,
          matched ? matched.name : o.companyName,
          o.customerPoNo || null,
          o.customerPoDate,
          o.orderDate,
          o.fyCode,
          o.projectName,
          o.projectDesc || null,
          o.basicValue,
          o.gstRate,
          o.gstAmount,
          o.totalValue,
          o.piNumber || null,
          o.piDate,
          o.piAmount,
          o.tiNumber || null,
          o.tiDate,
          o.tiAmount,
          o.invoiceStatus,
          o.orderStatus,
          o.remarks || null,
        ]
      );

      await client.query(
        `INSERT INTO finance_order_items (
          id, order_id, product_id, product_name, category, qty, selling_price, sales_value,
          manufacturing_cost, installation_cost, other_cost, total_cost, gross_profit, profit_pct
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
        [
          `foi_hist_${o.legacyRef}`,
          orderId,
          o.item.productId || null,
          o.item.productName,
          o.item.category || null,
          o.item.qty,
          o.item.sellingPrice,
          o.item.salesValue,
          o.item.mfgCost,
          o.item.instCost,
          o.item.otherCost,
          o.item.totalCost,
          o.item.grossProfit,
          o.item.profitPct,
        ]
      );

      let pIdx = 0;
      for (const p of o.payments) {
        pIdx++;
        const payId = `fpay_hist_${o.legacyRef}_${pIdx}`;
        await client.query(
          `INSERT INTO finance_customer_payments (
            id, order_id, client_id, payment_date, fy_code, amount, payment_type, payment_mode,
            account_id, status, date_missing_flag, recorded_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,'Bank Transfer','acc_bank_main','Posted',$8,'excel_migration')
          ON CONFLICT (id) DO NOTHING`,
          [payId, orderId, matched ? matched.id : null, p.payment_date, o.fyCode, p.amount, p.payment_type, p.date_missing_flag]
        );
      }

      if (o.maintenance.required || o.maintenance.revenue > 0 || o.maintenance.cost > 0) {
        await client.query(
          `INSERT INTO finance_maintenance_records (
            id, order_id, required, maintenance_type, start_date, end_date, status, revenue, cost, profit
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
          [
            `fmaint_hist_${o.legacyRef}`,
            orderId,
            o.maintenance.required,
            o.maintenance.type || null,
            o.maintenance.startDate,
            o.maintenance.endDate,
            o.maintenance.status,
            o.maintenance.revenue,
            o.maintenance.cost,
            o.maintenance.profit,
          ]
        );
      }
    }

    for (const e of expenses) {
      const claimId = `exp_hist_${e.sourceRow}`;
      const seqRes = await client.query(`SELECT nextval('expense_claim_seq')::bigint AS n`);
      const claimNo = `EXP-HIST-${String(seqRes.rows[0].n).padStart(5, "0")}`;
      await client.query(
        `INSERT INTO expense_claims (
          id, claim_no, expense_date, fy_code, amount, approved_amount, category_name, paid_to,
          description, payment_mode, paid_by, notes, status, reimbursement_status,
          is_historical, zero_amount_flag, source_row, approved_by, approved_at
        ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,'Cash','Company',$9,'Approved','Not Required',true,$10,$11,'excel_migration',CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO NOTHING`,
        [
          claimId,
          claimNo,
          e.expenseDate,
          e.fyCode,
          e.amount,
          e.category,
          e.paidTo,
          e.description,
          e.notes || null,
          e.zeroAmountFlag,
          e.sourceRow,
        ]
      );

      const txSeq = await client.query(`SELECT nextval('finance_tx_seq')::bigint AS n`);
      await client.query(
        `INSERT INTO finance_transactions (
          id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
          account_id, payment_mode, source_type, source_record_id, notes, created_by
        ) VALUES ($1,$2,$3,$4,'Expense',$5,$6,$7,$8,'acc_cash_petty','Cash','excel_expense',$9,$10,'excel_migration')
        ON CONFLICT (id) DO NOTHING`,
        [
          `ftx_hist_exp_${e.sourceRow}`,
          `TX-${e.fyCode}-${String(txSeq.rows[0].n).padStart(6, "0")}`,
          e.expenseDate,
          e.fyCode,
          e.category,
          e.paidTo,
          e.description,
          e.amount,
          claimId,
          e.notes || null,
        ]
      );
    }

    await client.query(
      `INSERT INTO finance_import_batches (id, workbook_name, workbook_sha256, imported_by, summary)
       VALUES ($1,$2,$3,'excel_migration',$4)`,
      [`batch_${Date.now()}`, "AIA_ERP.xlsm", sha256, JSON.stringify(summary)]
    );

    await client.query("COMMIT");
    console.log("EXCEL_IMPORT_APPLIED_OK=true");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error("IMPORT_FAILED:", e);
  process.exit(1);
});
