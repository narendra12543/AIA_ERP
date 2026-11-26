const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const { Pool } = require("pg");

const DEFAULT_EXCEL_PATH =
  "C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751/.user_uploaded/media_1795713322018_e165b6b8.xlsm";

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

function loadEnvFile(fileName) {
  const envPath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
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

function parseRevisionNo(quotationNo) {
  const m = String(quotationNo || "").match(/-R(\d+)$/i);
  return m ? Number(m[1]) : 0;
}

function parseSerialNo(quotationNo) {
  const m = String(quotationNo || "").match(/\/(\d+)(?:-R\d+)?$/i);
  return m ? Number(m[1]) : 0;
}

async function main() {
  loadEnvFile(".env.production.local");
  loadEnvFile(".env.local");

  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const includeIncomplete = args.includes("--include-incomplete");
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

  // Parse Spec Profiles sheet for technical spec matching
  const specSheet = workbook.getWorksheet("Spec Profiles");
  const specProfiles = [];
  if (specSheet) {
    const spHeaders = [];
    specSheet.getRow(1).eachCell({ includeEmpty: true }, (c, i) => {
      spHeaders[i] = cellToString(c.value);
    });
    for (let r = 2; r <= specSheet.rowCount; r++) {
      const row = specSheet.getRow(r);
      const name = cellToString(row.getCell(1).value);
      const product = cellToString(row.getCell(2).value);
      if (!name || name.toLowerCase() === "profile name") continue;
      const specs = {};
      for (let c = 3; c < spHeaders.length; c++) {
        const key = spHeaders[c];
        const val = cellToString(row.getCell(c).value);
        if (key && val) specs[key] = val;
      }
      specProfiles.push({
        id: `sp_${name.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        name,
        product: product || name,
        specs,
      });
    }
  }

  const headers = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, colNum) => {
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
  const idxHeader = colExactOrIncludes(["client header line (page1)"], ["client header"]);
  const idxClient = colExactOrIncludes(["client company name"], ["client company name", "customer name"]);
  const idxAddress = colExactOrIncludes(["client address"], ["address"]);
  const idxEmail = colExactOrIncludes(["client email"], ["email"]);
  const idxContact = colExactOrIncludes(["client contact"], ["contact", "phone", "mobile"]);
  const idxSubject = colExactOrIncludes(["subject"], ["subject", "product"]);
  const idxTerms = colExactOrIncludes(["terms text"], ["terms"]);
  const idxPlaceOfSupply = colExactOrIncludes(["place of supply"], ["place of supply"]);
  const idxDeliveryDate = colExactOrIncludes(["due / delivery date"], ["delivery date"]);
  const idxPaymentTerms = colExactOrIncludes(["payment terms"], ["payment terms"]);
  const idxAdvance = colExactOrIncludes(["advance received"], ["advance received"]);
  const idxTiNo = colExactOrIncludes(["tax invoice number"], ["tax invoice number"]);
  const idxTiDate = colExactOrIncludes(["tax invoice date"], ["tax invoice date"]);
  const idxShipTo = colExactOrIncludes(["ship to address"], ["ship to"]);

  const parsedRows = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const quoteNo = idxQuoteNo > 0 ? cellToString(row.getCell(idxQuoteNo).value) : cellToString(row.getCell(1).value);
    if (!quoteNo) continue;

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
        const effQty = qty || 1;
        items.push({
          id: `itm_${r}_${itemIdx + 1}`,
          name,
          hsn,
          size,
          qty: effQty,
          unit,
          rate,
          price: rate,
          amount: effQty * rate,
        });
      }
    }

    const subtotal = items.reduce((sum, it) => sum + it.amount, 0);
    const taxAmount = Math.round(subtotal * 0.18 * 100) / 100;
    const rawTotal = subtotal + taxAmount;
    const total = Math.round(rawTotal);
    const roundOff = Math.round((total - rawTotal) * 100) / 100;

    const clientName = idxClient > 0 ? cellToString(row.getCell(idxClient).value) : "";
    const subject = idxSubject > 0 ? cellToString(row.getCell(idxSubject).value) : "";
    const pos = (idxPlaceOfSupply > 0 ? cellToString(row.getCell(idxPlaceOfSupply).value) : "") || "27-Maharashtra";

    parsedRows.push({
      excelRow: r,
      quotation_no: quoteNo,
      revision_no: parseRevisionNo(quoteNo),
      serial_no: parseSerialNo(quoteNo),
      date: idxDate > 0 ? cellToString(row.getCell(idxDate).value) : "",
      client_header: idxHeader > 0 ? cellToString(row.getCell(idxHeader).value) : "",
      client_name: clientName,
      client_address: idxAddress > 0 ? cellToString(row.getCell(idxAddress).value) : "",
      client_email: idxEmail > 0 ? cellToString(row.getCell(idxEmail).value) : "",
      client_contact: idxContact > 0 ? cellToString(row.getCell(idxContact).value) : "",
      client_gstin: "",
      subject,
      product_type: subject || (items[0]?.name ? items[0].name.split("\n")[0] : "Industrial Automation System"),
      terms: idxTerms > 0 ? cellToString(row.getCell(idxTerms).value) : "",
      place_of_supply: pos,
      is_maharashtra: pos.startsWith("27"),
      delivery_date: idxDeliveryDate > 0 ? cellToString(row.getCell(idxDeliveryDate).value) : "",
      payment_terms: idxPaymentTerms > 0 ? cellToString(row.getCell(idxPaymentTerms).value) : "",
      advance_received: idxAdvance > 0 ? cellToNumber(row.getCell(idxAdvance).value) : 0,
      tax_invoice_number: idxTiNo > 0 ? cellToString(row.getCell(idxTiNo).value) : "",
      tax_invoice_date: idxTiDate > 0 ? cellToString(row.getCell(idxTiDate).value) : "",
      ship_to_address: idxShipTo > 0 ? cellToString(row.getCell(idxShipTo).value) : "",
      items,
      subtotal,
      tax_amount: taxAmount,
      round_off: roundOff,
      total,
    });
  }

  // Connect to PostgreSQL for live reconciliation (read-only during dry-run)
  const liveQuotesMap = new Map();
  const liveClientsMap = new Map();
  const erpStoreQuotesMap = new Map();
  let erpStoreSpecCount = 0;
  let dbChecked = false;
  let pool = null;

  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: true },
    });
    const [qRes, cRes, esRes] = await Promise.all([
      pool.query(`SELECT id, quotation_no, client_name, total FROM quotes`),
      pool.query(`SELECT id, name, email, contact, gstin FROM clients`),
      pool.query(`SELECT data FROM erp_store WHERE key = 'app_data'`),
    ]);
    for (const r of qRes.rows) liveQuotesMap.set(String(r.quotation_no || "").trim(), r);
    for (const r of cRes.rows) liveClientsMap.set(String(r.name || "").trim().toLowerCase(), r);
    const appData = esRes.rows[0]?.data || {};
    for (const eq of appData.quotations || []) {
      erpStoreQuotesMap.set(String(eq.quotation_no || "").trim(), eq);
    }
    erpStoreSpecCount = Array.isArray(appData.spec_profiles) ? appData.spec_profiles.length : 0;
    dbChecked = true;
  }

  // Enrich Excel rows with any legacy erp_store metadata (GSTIN, product_image, technical_specs, pi_number)
  for (const row of parsedRows) {
    const legacy = erpStoreQuotesMap.get(row.quotation_no);
    if (legacy) {
      if (legacy.client_gstin && !row.client_gstin) row.client_gstin = legacy.client_gstin;
      if (legacy.product_image) row.product_image = legacy.product_image;
      if (legacy.technical_specs) row.technical_specs = legacy.technical_specs;
      if (legacy.pi_number) row.pi_number = legacy.pi_number;
      if (legacy.client_name && (!row.client_name || row.client_name === "-")) {
        row.client_name = legacy.client_name;
      }
    }
  }

  const seenInExcel = new Map();
  const classified = { genuine: [], duplicate: [], conflicting: [], flagged_incomplete: [] };

  for (const row of parsedRows) {
    const lowerClient = row.client_name.toLowerCase();
    const isIncomplete = !row.client_name || row.total <= 0 || lowerClient.includes("test") || lowerClient.includes("dummy");

    if (isIncomplete) {
      classified.flagged_incomplete.push({
        ...row,
        reason: row.client_name
          ? "Incomplete record (₹0 / empty line items) — flagged for Admin review"
          : "Missing client name / ₹0 total",
      });
      continue;
    }

    if (seenInExcel.has(row.quotation_no)) {
      classified.duplicate.push({ ...row, reason: `Duplicate quotation_no in Excel (row ${seenInExcel.get(row.quotation_no)})` });
      continue;
    }
    seenInExcel.set(row.quotation_no, row.excelRow);

    const liveMatch = liveQuotesMap.get(row.quotation_no);
    if (liveMatch) {
      const sameClient = String(liveMatch.client_name || "").trim().toLowerCase() === lowerClient;
      const sameTotal = Math.abs(Number(liveMatch.total || 0) - row.total) < 5;
      if (sameClient && sameTotal) {
        classified.duplicate.push({ ...row, reason: "Already exists in live quotes table" });
      } else {
        classified.conflicting.push({ ...row, reason: `Live quotes mismatch (${liveMatch.client_name}, ₹${liveMatch.total})` });
      }
      continue;
    }

    classified.genuine.push(row);
  }

  // Deduplicate genuine clients
  const uniqueClientsMap = new Map();
  for (const row of classified.genuine) {
    const cname = row.client_name.trim();
    if (!cname || cname === "-") continue;
    const key = cname.toLowerCase();
    const existing = uniqueClientsMap.get(key) || {
      id: `cli_${key.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`,
      name: cname,
      header: row.client_header || `To, ${cname}`,
      contact: "",
      email: "",
      gstin: "",
      address: "",
      place_of_supply: row.place_of_supply || "27-Maharashtra",
    };
    if (!existing.contact && row.client_contact) existing.contact = row.client_contact;
    if (!existing.email && row.client_email) existing.email = row.client_email;
    if (!existing.gstin && row.client_gstin) existing.gstin = row.client_gstin;
    if (!existing.address && row.client_address) existing.address = row.client_address;
    if (row.place_of_supply) existing.place_of_supply = row.place_of_supply;
    uniqueClientsMap.set(key, existing);
  }
  const uniqueClients = Array.from(uniqueClientsMap.values());
  const maxSerial = parsedRows.reduce((m, r) => Math.max(m, r.serial_no || 0), 0);

  if (isApply) {
    if (!pool) throw new Error("DATABASE_URL is required for --apply");
    const rowsToImport = includeIncomplete
      ? [...classified.genuine, ...classified.flagged_incomplete]
      : classified.genuine;

    await pool.query("BEGIN");
    try {
      let clientsInserted = 0;
      for (const c of uniqueClients) {
        await pool.query(
          `INSERT INTO clients (id, name, header, contact, email, gstin, address, place_of_supply, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (name) DO UPDATE SET
             header = COALESCE(NULLIF(EXCLUDED.header,''), clients.header),
             contact = COALESCE(NULLIF(EXCLUDED.contact,''), clients.contact),
             email = COALESCE(NULLIF(EXCLUDED.email,''), clients.email),
             gstin = COALESCE(NULLIF(EXCLUDED.gstin,''), clients.gstin),
             address = COALESCE(NULLIF(EXCLUDED.address,''), clients.address),
             place_of_supply = EXCLUDED.place_of_supply,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [c.id, c.name, c.header, c.contact, c.email, c.gstin, c.address, c.place_of_supply, JSON.stringify(c)]
        );
        clientsInserted++;
      }

      let quotesInserted = 0;
      for (const q of rowsToImport) {
        const qId = `q_${q.quotation_no.replace(/[^a-zA-Z0-9]+/g, "_")}`;
        const qObj = {
          id: qId,
          quotation_no: q.quotation_no,
          revision_no: q.revision_no,
          date: q.date,
          client_header: q.client_header,
          client_name: q.client_name,
          client_address: q.client_address,
          client_contact: q.client_contact,
          client_email: q.client_email,
          client_gstin: q.client_gstin,
          place_of_supply: q.place_of_supply,
          state: q.place_of_supply,
          is_maharashtra: q.is_maharashtra,
          subject: q.subject,
          product_type: q.product_type,
          items: q.items,
          subtotal: q.subtotal,
          tax_amount: q.tax_amount,
          round_off: q.round_off,
          total: q.total,
          terms: q.terms,
          pi_number: q.pi_number || `PI-${q.quotation_no}`,
          tax_invoice_number: q.tax_invoice_number || "",
          delivery_date: q.delivery_date || "",
          advance_received: q.advance_received || 0,
          technical_specs: q.technical_specs || {},
          product_image: q.product_image || "",
          status: "Approved",
        };

        const res = await pool.query(
          `INSERT INTO quotes (
             id, quotation_no, date, client_name, client_email, client_contact, client_gstin, client_address,
             subject, product_type, pi_number, tax_invoice_number, delivery_date, advance_received,
             subtotal, tax_amount, round_off, total, is_maharashtra, data
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
           ON CONFLICT (quotation_no) DO NOTHING`,
          [
            qId, q.quotation_no, q.date, q.client_name, q.client_email, q.client_contact, q.client_gstin, q.client_address,
            q.subject, q.product_type, qObj.pi_number, q.tax_invoice_number, q.delivery_date, q.advance_received,
            q.subtotal, q.tax_amount, q.round_off, q.total, q.is_maharashtra, JSON.stringify(qObj),
          ]
        );
        if (res.rowCount > 0) quotesInserted++;
      }

      await pool.query("COMMIT");
      console.log(JSON.stringify({ applied: true, clientsUpserted: clientsInserted, quotesInserted }));
    } catch (e) {
      await pool.query("ROLLBACK");
      throw e;
    } finally {
      await pool.end();
    }
    return;
  }

  if (pool) await pool.end();

  // Write EXCEL_QUOTATION_MIGRATION_PLAN.md
  const reportLines = [
    "# EXCEL-TO-POSTGRESQL MIGRATION & RECONCILIATION REPORT (DRY-RUN)",
    "",
    `- **Workbook:** \`Quotation_System.xlsm\``,
    `- **Mode:** \`--dry-run\` (Read-only inspection; **0 database writes**)`,
    `- **Live Neon Checked:** ${dbChecked ? "Yes" : "No"}`,
    `- **Live PostgreSQL Counts (Before Import):** \`quotes=${liveQuotesMap.size}\`, \`clients=${liveClientsMap.size}\`, \`erp_store.app_data.quotations=${erpStoreQuotesMap.size}\`, \`erp_store.app_data.spec_profiles=${erpStoreSpecCount}\``,
    `- **Excel Parsed Counts:** \`Database\` quotations = **${parsedRows.length}** (\`${classified.genuine.length}\` genuine, \`${classified.flagged_incomplete.length}\` flagged incomplete, \`${classified.duplicate.length}\` duplicate, \`${classified.conflicting.length}\` conflicting) | Unique Clients = **${uniqueClients.length}** | \`Spec Profiles\` = **${specProfiles.length}**`,
    `- **Future Quotation Numbering Continuity:** Highest Excel serial is \`26-27/AIA/${maxSerial}\` → next generated quotation will safely continue at \`26-27/AIA/${maxSerial + 1}\`.`,
    "",
    "## Complete 36-Row Quotation Reconciliation Table",
    "",
    "| Row | Quotation No | Date | Client Name | Total (INR) | In `erp_store`? | Status | Notes |",
    "| ---: | --- | --- | --- | ---: | --- | --- | --- |",
  ];

  const allTagged = [
    ...classified.genuine.map((r) => ({ ...r, cat: "Genuine (Ready)", note: "Will import into quotes & clients" })),
    ...classified.duplicate.map((r) => ({ ...r, cat: "Duplicate", note: r.reason })),
    ...classified.conflicting.map((r) => ({ ...r, cat: "Conflicting", note: r.reason })),
    ...classified.flagged_incomplete.map((r) => ({ ...r, cat: "Flagged (Review)", note: r.reason })),
  ].sort((a, b) => a.excelRow - b.excelRow);

  for (const r of allTagged) {
    const inStore = erpStoreQuotesMap.has(r.quotation_no) ? "Yes" : "New from Excel";
    reportLines.push(
      `| ${r.excelRow} | ${r.quotation_no} | ${r.date || "-"} | ${r.client_name || "-"} | ${r.total.toFixed(2)} | ${inStore} | ${r.cat} | ${r.note} |`
    );
  }

  const outPath = path.resolve(process.cwd(), "EXCEL_QUOTATION_MIGRATION_PLAN.md");
  fs.writeFileSync(outPath, reportLines.join("\n"), "utf8");

  console.log(
    JSON.stringify(
      {
        dryRun: true,
        dbChecked,
        liveQuotesCount: liveQuotesMap.size,
        liveClientsCount: liveClientsMap.size,
        erpStoreQuotesCount: erpStoreQuotesMap.size,
        erpStoreSpecCount,
        excelQuotationsTotal: parsedRows.length,
        genuineQuotesToImport: classified.genuine.length,
        flaggedIncomplete: classified.flagged_incomplete.map((r) => ({
          quotation_no: r.quotation_no,
          client_name: r.client_name,
          total: r.total,
          reason: r.reason,
        })),
        duplicates: classified.duplicate.length,
        conflicts: classified.conflicting.length,
        uniqueClientsToImport: uniqueClients.length,
        excelSpecProfilesCount: specProfiles.length,
        nextQuotationSerial: `26-27/AIA/${maxSerial + 1}`,
        reportPath: outPath,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error("Migration script failed:", err);
  process.exit(1);
});
