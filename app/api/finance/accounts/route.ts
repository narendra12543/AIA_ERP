import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { getCurrentBusinessDate, getFYDateRange, getFYFromDate, normalizeFYCode } from "@/lib/financial-year";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.accounts" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    await initDb();
    const tbl = await query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='finance_transactions'`, []);
    if (!tbl || tbl.rows.length === 0) return NextResponse.json({ items: [], accounts: [], tableMissing: true });

    const fy = req.nextUrl.searchParams.get("fy") || "ALL";
    const range = fy === "ALL" ? null : getFYDateRange(normalizeFYCode(fy));
    const params = range ? [range.startDate, range.endDate] : [];
    const whereSql = range ? `WHERE ft.tx_date >= $1 AND ft.tx_date <= $2` : "";

    const txRes = await query(
      `SELECT ft.*, fa.name AS account_name
       FROM finance_transactions ft
       LEFT JOIN finance_accounts fa ON fa.id = ft.account_id
       ${whereSql}
       ORDER BY ft.tx_date DESC, ft.posted_at DESC
       LIMIT 300`,
      params
    );
    const accRes = await query(`SELECT * FROM finance_accounts ORDER BY name ASC`, []);

    return NextResponse.json({ items: txRes?.rows || [], accounts: accRes?.rows || [], tableMissing: false });
  } catch {
    return NextResponse.json({ error: "Failed to load accounts register." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "finance.accounts" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const txType = String(body.tx_type || "").trim();
    const amount = Number(body.amount);
    const category = String(body.category || txType).trim();
    if (!txType || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valid transaction type and positive amount are required." }, { status: 400 });
    }

    const txDate =
      body.tx_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.tx_date))
        ? String(body.tx_date)
        : getCurrentBusinessDate();
    const fyCode = getFYFromDate(txDate);
    const txSeq = await query(`SELECT nextval('finance_tx_seq')::bigint AS n`, []);
    const txNo = `TX-${fyCode}-${String(txSeq?.rows[0]?.n || Date.now()).padStart(6, "0")}`;
    const id = `ftx_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

    await query(
      `INSERT INTO finance_transactions (
        id, tx_no, tx_date, fy_code, tx_type, category, party, description, amount,
        account_id, payment_mode, reference_no, source_type, notes, created_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'manual',$13,$14)`,
      [
        id,
        txNo,
        txDate,
        fyCode,
        txType,
        category,
        body.party ? String(body.party).trim() : null,
        body.description ? String(body.description).trim() : null,
        amount,
        String(body.account_id || "acc_bank_main"),
        String(body.payment_mode || "Bank Transfer"),
        body.reference_no ? String(body.reference_no).trim() : null,
        body.notes ? String(body.notes).trim() : null,
        auth.user.email,
      ]
    );

    await logAudit(auth.user.userId, "FINANCE_TX_CREATED", { txNo, txType, amount }, { actorName: auth.user.name, module: "finance_accounts", recordRef: txNo, outcome: "SUCCESS" });
    return NextResponse.json({ success: true, id, tx_no: txNo });
  } catch {
    return NextResponse.json({ error: "Failed to record transaction." }, { status: 500 });
  }
}
