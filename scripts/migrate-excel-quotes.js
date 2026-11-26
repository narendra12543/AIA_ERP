const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { Pool } = require("pg");

const DEFAULT_EXCEL_PATH =
  "C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751/.user_uploaded/media_1795688609339_5d08d3ad.xlsm";

function cellToString(val) {
  if (val === null || val === undefined) return "";
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  if (typeof val === "object") {
    if (val.result !== undefined) return cellToString(val.result);
    if (val.text !== undefined) return String(val.text);
    if (Array.isArray(val.richText)) return val.richText.map((r) => r.text).join("");
  }
  return String(val).trim();
}

function cellToNumber(val) {
  const s = cellToString(val).replace(/[₹,\s]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const excelArg = args.find((a) => !a.startsWith("--"));
  const excelPath = excelArg || DEFAULT_EXCEL_PATH;

  if (!fs.existsSync(excelPath)) {
    console.error("Excel file not found:", excelPath);
    process.exit(1);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.getWorksheet("Database");
  if (!sheet) {
    console.error("Worksheet 'Database' not found in workbook.");
    process.exit(1);
  }

  const headers = [];
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    headers[colNum] = cellToString(cell.value) || `COL_${colNum}`;
  });

  const colIndex = (patterns) => {
    for (let i = 1; i < headers.length; i++) {
      const h = (headers[i] || "").toLowerCase();
      if (patterns.some((p) => h.includes(p))) return i;
    }
    return -1;
  };

  const colExactOrIncludes = (exactNames, fallbackPatterns) => {
    for (let i = 1; i < headers.length; i++) {
      const h = (headers[i] || "").toLowerCase().trim();
      if (exactNames.some((p) => h === p)) return i;
    }
    return colIndex(fallbackPatterns);
  };

  const idxQuoteNo = colExactOrIncludes(["quotation no"], ["quotation no", "quote no"]);
  const idxDate = colExactOrIncludes(["date"], ["date"]);
  const idxClient = colExactOrIncludes(["client company name"], ["client company name", "customer name"]);
  const idxAddress = colExactOrIncludes(["client address"], ["address"]);
  const idxContact = colExactOrIncludes(["client contact"], ["contact", "phone", "mobile"]);
  const idxEmail = colExactOrIncludes(["client email"], ["email"]);
  const idxGstin = colExactOrIncludes(["client gstin", "gstin"], ["gstin", "gst no"]);
  const idxProduct = colExactOrIncludes(["subject"], ["subject", "product"]);
  const idxTerms = colExactOrIncludes(["terms text"], ["terms"]);
  const idxPlaceOfSupply = colExactOrIncludes(["place of supply"], ["place of supply"]);
  const idxTiNo = colExactOrIncludes(["tax invoice number"], ["tax invoice number"]);

  const parsedRows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const quoteNo = idxQuoteNo > 0 ? cellToString(row.getCell(idxQuoteNo).value) : cellToString(row.getCell(1).value);
    if (!quoteNo) continue;

    // Parse Item1..Item9 (starting at col 11, 6 cols per item: Name, HSN, Size, Qty, Unit, Price/Unit)
    const items = [];
    for (let itemIdx = 0; itemIdx < 9; itemIdx++) {
      const baseCol = 11 + itemIdx * 6;
      const name = cellToString(row.getCell(baseCol).value);
      const hsn = cellToString(row.getCell(baseCol + 1).value);
      const size = cellToString(row.getCell(baseCol + 2).value);
      const qty = cellToNumber(row.getCell(baseCol + 3).value);
      const unit = cellToString(row.getCell(baseCol + 4).value) || "Nos";
      const rate = cellToNumber(row.getCell(baseCol + 5).value);
      if (name || rate > 0) {
        items.push({
          name,
          hsn,
          size,
          qty: qty || 1,
          unit,
          rate,
          amount: (qty || 1) * rate,
        });
      }
    }

    const subtotal = items.reduce((sum, it) => sum + it.amount, 0);
    const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;
    const clientName = idxClient > 0 ? cellToString(row.getCell(idxClient).value) : "";

    parsedRows.push({
      excelRow: r,
      quotation_no: quoteNo,
      date: idxDate > 0 ? cellToString(row.getCell(idxDate).value) : "",
      client_name: clientName,
      client_address: idxAddress > 0 ? cellToString(row.getCell(idxAddress).value) : "",
      client_contact: idxContact > 0 ? cellToString(row.getCell(idxContact).value) : "",
      client_email: idxEmail > 0 ? cellToString(row.getCell(idxEmail).value) : "",
      client_gstin: idxGstin > 0 ? cellToString(row.getCell(idxGstin).value) : "",
      product_type: idxProduct > 0 ? cellToString(row.getCell(idxProduct).value) : "",
      terms: idxTerms > 0 ? cellToString(row.getCell(idxTerms).value) : "",
      place_of_supply: idxPlaceOfSupply > 0 ? cellToString(row.getCell(idxPlaceOfSupply).value) : "",
      tax_invoice_number: idxTiNo > 0 ? cellToString(row.getCell(idxTiNo).value) : "",
      items,
      subtotal,
      tax_amount: taxAmount,
      total,
    });
  }

  // Compare against live PostgreSQL quotations (read-only) if DATABASE_URL is available
  let liveMap = new Map();
  let dbChecked = false;
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
    });
    try {
      const res = await pool.query(
        `SELECT id, quotation_no, client_name, total FROM quotes`
      );
      for (const row of res.rows) {
        liveMap.set(String(row.quotation_no || "").trim(), row);
      }
      dbChecked = true;
    } catch (e) {
      console.warn("Could not query live DB for reconciliation:", e.message);
    } finally {
      await pool.end();
    }
  }

  const seenInExcel = new Map();
  const classified = {
    genuine: [],
    duplicate: [],
    conflicting: [],
    suspected_dummy: [],
  };

  for (const row of parsedRows) {
    const lowerClient = row.client_name.toLowerCase();
    const isDummy =
      !row.client_name ||
      lowerClient.includes("test") ||
      lowerClient.includes("dummy") ||
      lowerClient.includes("sample") ||
      row.total <= 0;

    if (isDummy) {
      classified.suspected_dummy.push({
        ...row,
        reason: row.client_name
          ? "Real client name present but ₹0 / empty line items — requires Admin confirmation before import/exclusion"
          : "Missing client/zero total or test/sample entry",
      });
      continue;
    }

    if (seenInExcel.has(row.quotation_no)) {
      classified.duplicate.push({ ...row, reason: `Duplicate quotation_no in Excel (first at row ${seenInExcel.get(row.quotation_no)})` });
      continue;
    }
    seenInExcel.set(row.quotation_no, row.excelRow);

    const liveMatch = liveMap.get(row.quotation_no);
    if (liveMatch) {
      const sameClient = String(liveMatch.client_name || "").trim().toLowerCase() === lowerClient;
      const sameTotal = Math.abs(Number(liveMatch.total || 0) - row.total) < 1;
      if (sameClient && sameTotal) {
        classified.duplicate.push({ ...row, reason: "Already exists identically in live PostgreSQL" });
      } else {
        classified.conflicting.push({
          ...row,
          reason: `Exists in live DB with different client/total (DB: ${liveMatch.client_name}, ₹${liveMatch.total})`,
        });
      }
      continue;
    }

    classified.genuine.push(row);
  }

  if (isApply) {
    console.error("SAFETY BLOCK: --apply is disabled unless explicitly authorized on a verified backup.");
    process.exit(2);
  }

  // Write EXCEL_QUOTATION_MIGRATION_PLAN.md
  const reportLines = [
    "# EXCEL QUOTATION MIGRATION & RECONCILIATION PLAN (DRY-RUN)",
    "",
    `- **Source Workbook:** \`${path.basename(excelPath)}\` (\`Database\` sheet)`,
    `- **Execution Mode:** \`--dry-run\` (Read-only inspection; **0 live database writes**)`,
    `- **Live PostgreSQL Checked:** ${dbChecked ? `Yes (${liveMap.size} existing live quotations compared)` : "No (offline dry-run)"}`,
    `- **Total Excel Quotation Rows Parsed:** ${parsedRows.length}`,
    `- **Active Header Columns Detected:** ${headers.filter(Boolean).length}`,
    "",
    "## Classification Summary",
    "",
    "| Category | Count | Action Recommendation |",
    "| --- | ---: | --- |",
    `| Genuine New Quotations | ${classified.genuine.length} | Safe to import on approved migration window |`,
    `| Duplicate (Excel / Live DB Match) | ${classified.duplicate.length} | Skip (preserve existing live record) |`,
    `| Conflicting Data | ${classified.conflicting.length} | Manual Admin review before import |`,
    `| Suspected Dummy / Incomplete | ${classified.suspected_dummy.length} | Exclude from production import |`,
    "",
    "## Complete 36-Row Reconciliation Table",
    "",
    "| Excel Row | Quotation No | Date | Client Name | Total (INR) | Classification | Conflict / Review Notes |",
    "| ---: | --- | --- | --- | ---: | --- | --- |",
  ];

  const allTagged = [
    ...classified.genuine.map((r) => ({ ...r, cat: "Genuine", note: "Ready to import (no conflict)" })),
    ...classified.duplicate.map((r) => ({ ...r, cat: "Duplicate", note: r.reason || "Skip duplicate" })),
    ...classified.conflicting.map((r) => ({ ...r, cat: "Conflicting", note: r.reason || "Manual review" })),
    ...classified.suspected_dummy.map((r) => ({ ...r, cat: "Incomplete / Review", note: r.reason || "Admin review" })),
  ].sort((a, b) => a.excelRow - b.excelRow);

  for (const r of allTagged) {
    reportLines.push(
      `| ${r.excelRow} | ${r.quotation_no} | ${r.date || "-"} | ${r.client_name || "-"} | ${r.total.toFixed(2)} | ${r.cat} | ${r.note} |`
    );
  }

  reportLines.push(
    "",
    "## Non-Destructive Rollback & Safety Rules",
    "1. Existing live quotations in Neon PostgreSQL are **never deleted or overwritten**.",
    "2. Take a full `pg_dump` backup prior to any future `--apply` import.",
    "3. Only `Genuine` rows should be inserted using `ON CONFLICT (quotation_no) DO NOTHING`.",
    ""
  );

  const outPath = path.resolve(process.cwd(), "EXCEL_QUOTATION_MIGRATION_PLAN.md");
  fs.writeFileSync(outPath, reportLines.join("\n"), "utf8");
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        dbChecked,
        totalRows: parsedRows.length,
        genuine: classified.genuine.length,
        duplicate: classified.duplicate.length,
        conflicting: classified.conflicting.length,
        suspected_dummy: classified.suspected_dummy.length,
        reportPath: outPath,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Excel dry-run migration failed:", err);
  process.exit(1);
});
