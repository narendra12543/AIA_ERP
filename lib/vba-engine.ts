import { Quotation, QuotationItem, SpecProfile } from "./types";

/**
 * AVEN INDUSTRIAL AUTOMATION - MASTER VBA & BUSINESS LOGIC ENGINE
 * Exact implementation of Quotation_System.xlsm VBA code
 */

// 1. Current Financial Year (e.g. 26-27)
export function currentFY(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  if (m >= 4) {
    const y1 = String(y % 100).padStart(2, "0");
    const y2 = String((y + 1) % 100).padStart(2, "0");
    return `${y1}-${y2}`;
  } else {
    const y1 = String((y - 1) % 100).padStart(2, "0");
    const y2 = String(y % 100).padStart(2, "0");
    return `${y1}-${y2}`;
  }
}

// 2. Next Quotation Number (e.g. 26-27/AIA/145)
export function nextQuotationNo(quotes: Quotation[] = []): string {
  const prefix = `${currentFY()}/AIA/`;
  let maxN = 100;

  for (const q of quotes) {
    const qno = q.quotation_no || "";
    if (qno.startsWith(prefix)) {
      let cleanPart = qno.substring(prefix.length);
      if (cleanPart.includes("-R")) {
        cleanPart = cleanPart.substring(0, cleanPart.indexOf("-R"));
      }
      const n = parseInt(cleanPart, 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }

  return `${prefix}${String(maxN + 1).padStart(3, "0")}`;
}

// 2b. Create Revision (Exact Excel VBA CreateRevision Sub)
export function createRevision(quote: Quotation): Quotation {
  const curNo = (quote.quotation_no || "").trim();
  let baseNo = curNo;
  let revIndex = 1;

  const rPos = curNo.lastIndexOf("-R");
  if (rPos > 0) {
    baseNo = curNo.substring(0, rPos);
    const parsedRev = parseInt(curNo.substring(rPos + 2), 10);
    revIndex = !isNaN(parsedRev) ? parsedRev + 1 : 1;
  }

  const newQuoteNo = `${baseNo}-R${revIndex}`;
  const today = new Date().toISOString().slice(0, 10);

  const prevHistory = quote.revision_history || [];
  const updatedHistory = [
    ...prevHistory,
    {
      date: quote.date,
      quote_no: quote.quotation_no,
      note: `Revised to ${newQuoteNo} on ${today}`,
    },
  ];

  return {
    ...quote,
    id: "q_" + Date.now(),
    quotation_no: newQuoteNo,
    date: today,
    status: "Draft",
    original_quotation_no: baseNo,
    revision_index: revIndex,
    revision_history: updatedHistory,
  };
}

// 3. Next Proforma Invoice Number (e.g. Sale_Order_2627-02)
export function nextPINumber(quotes: Quotation[] = []): string {
  const fyClean = currentFY().replace("-", "");
  let maxN = 0;

  for (const q of quotes) {
    const piVal = q.pi_number || "";
    if (piVal) {
      const digits = piVal.replace(/\D/g, "");
      const n = parseInt(digits.slice(-2), 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }

  return `Sale_Order_${fyClean}-${String(maxN + 1).padStart(2, "0")}`;
}

// 4. Next Tax Invoice Number (e.g. 2026-27-AIA-024)
export function nextTaxInvoiceNumber(quotes: Quotation[] = []): string {
  const fy = currentFY();
  const fyFull = `20${fy.substring(0, 2)}-${fy.substring(3, 5)}`;
  let maxN = 0;

  for (const q of quotes) {
    const tiVal = q.tax_invoice_number || q.tax_invoice_no || "";
    if (tiVal) {
      const match = tiVal.match(/-AIA-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxN) maxN = n;
      }
    }
  }

  return `${fyFull}-AIA-${String(maxN + 1).padStart(3, "0")}`;
}

// 4b. Next Unique Purchase Order Number (e.g. PO-2026-001)
export function nextPONumber(pos: { po_number?: string }[] = []): string {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  let maxN = 0;

  for (const p of pos) {
    const poVal = (p.po_number || "").trim();
    const match = poVal.match(new RegExp(`^PO-${year}-(\\d+)`, "i"));
    if (match) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxN) maxN = n;
    }
  }

  return `${prefix}${String(maxN + 1).padStart(3, "0")}`;
}

export function calculatePOTotals(
  items: { qty?: number; rate?: number; price?: number; amount?: number }[] = [],
  taxRate = 0.18,
  additionalCharges = 0,
  discount = 0
) {
  const subtotal = items.reduce((acc, it) => {
    const qty = Number(it.qty) || 0;
    const rate = Number(it.rate ?? it.price) || 0;
    const amt = Number(it.amount) || qty * rate;
    return acc + amt;
  }, 0);
  const charges = Math.max(0, Number(additionalCharges) || 0);
  const disc = Math.max(0, Number(discount) || 0);
  const taxable_amount = Math.max(0, subtotal + charges - disc);
  const rateVal = Number(taxRate) >= 0 ? Number(taxRate) : 0.18;
  const tax_amount = taxable_amount * rateVal;
  const total = Math.round(taxable_amount + tax_amount);
  return { subtotal, additional_charges: charges, discount: disc, taxable_amount, tax_rate: rateVal, tax_amount, total };
}

// 5. Intra-State Check (Maharashtra = 27)
export function isIntraState(placeOfSupply: string = ""): boolean {
  const clean = (placeOfSupply || "").trim().toUpperCase();
  if (!clean || clean.startsWith("27") || clean.includes("MAHARASHTRA")) {
    return true;
  }
  return false;
}

// 6. Calculate Item Row Height (VBA CalculateItemRowHeight)
export function calculateItemRowHeight(itemText: string = ""): number {
  if (!itemText || !itemText.trim()) return 24;
  const lines = itemText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let totalLines = 0;
  for (const line of lines) {
    const pLines = Math.max(1, Math.ceil(line.length / 38));
    totalLines += pLines;
  }
  const h = totalLines * 14.5 + 8;
  return Math.max(24, Math.min(130, h));
}

// 7. Indian Rupee Number to Words Converter (VBA NumberToWordsINR)
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
const TEENS = [
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen",
  "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty",
  "Sixty", "Seventy", "Eighty", "Ninety"
];

function twoDigitWords(n: number): string {
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const rem = n % 10;
  return TENS[Math.floor(n / 10)] + (rem > 0 ? " " + ONES[rem] : "");
}

function threeDigitWords(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let res = "";
  if (h > 0) res = ONES[h] + " Hundred";
  if (r > 0) {
    if (res) res += " ";
    res += twoDigitWords(r);
  }
  return res;
}

function indianNumberWords(n: number): string {
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000);
  n = n % 10000000;
  const lakh = Math.floor(n / 100000);
  n = n % 100000;
  const thousand = Math.floor(n / 1000);
  const rest = n % 1000;

  let res = "";
  if (crore > 0) res += twoDigitWords(crore) + " Crore ";
  if (lakh > 0) res += twoDigitWords(lakh) + " Lakh ";
  if (thousand > 0) res += twoDigitWords(thousand) + " Thousand ";
  if (rest > 0) res += threeDigitWords(rest);

  return res.trim();
}

export function numberToWordsINR(amount: number): string {
  if (isNaN(amount) || amount <= 0) return "";
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  let words = "Rupees " + indianNumberWords(rupees);
  if (paise > 0) {
    words += " and " + twoDigitWords(paise) + " Paise";
  }
  words += " Only";
  return words;
}

// 8. Date Formatter (ISO YYYY-MM-DD to DD-MM-YYYY)
export function formatIsoToDdMmYyyy(iso: string = ""): string {
  if (!iso) return "";
  const parts = String(iso).split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return iso;
}

// 9. Currency Formatter (₹ INR)
export const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// 10. Re-calculate Totals & Tax with exact VBA rounding
export function calculateTotals(items: QuotationItem[] = [], isIntra: boolean = true) {
  const subtotal = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  const tax_rate = 18.0;
  const tax_amount = subtotal * 0.18;
  const exactTotal = subtotal + tax_amount;
  const total = Math.round(exactTotal);
  const round_off = Number((total - exactTotal).toFixed(2));
  const cgst = isIntra ? tax_amount / 2 : 0;
  const sgst = isIntra ? tax_amount / 2 : 0;
  const igst = isIntra ? 0 : tax_amount;
  const amount_words = numberToWordsINR(total);

  return {
    subtotal,
    tax_rate,
    tax_amount,
    round_off,
    total,
    cgst,
    sgst,
    igst,
    amount_words,
  };
}

// 11. Dynamic HSN Summary Calculation (VBA SetupTable2HSN, SetupPIHSN, SetupTIHSN)
export interface HsnSummaryRow {
  hsn: string;
  taxable: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
}

export function computeHsnSummary(items: QuotationItem[] = [], isIntra: boolean = true): {
  rows: HsnSummaryRow[];
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  totalTaxAmount: number;
} {
  const map: { [hsn: string]: number } = {};
  for (const it of items) {
    const h = (it.hsn && String(it.hsn).trim()) || "73262090";
    map[h] = (map[h] || 0) + (Number(it.amount) || 0);
  }

  const hsnKeys = Object.keys(map);
  const rows: HsnSummaryRow[] = [];
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  let totalTaxAmount = 0;

  for (const hsn of hsnKeys) {
    const taxable = map[hsn];
    const cgstRate = isIntra ? 0.09 : 0;
    const cgstAmount = isIntra ? taxable * 0.09 : 0;
    const sgstRate = isIntra ? 0.09 : 0;
    const sgstAmount = isIntra ? taxable * 0.09 : 0;
    const igstRate = isIntra ? 0 : 0.18;
    const igstAmount = isIntra ? 0 : taxable * 0.18;
    const totalTax = isIntra ? cgstAmount + sgstAmount : igstAmount;

    totalTaxable += taxable;
    totalCgst += cgstAmount;
    totalSgst += sgstAmount;
    totalIgst += igstAmount;
    totalTaxAmount += totalTax;

    rows.push({
      hsn,
      taxable,
      cgstRate,
      cgstAmount,
      sgstRate,
      sgstAmount,
      igstRate,
      igstAmount,
      totalTax,
    });
  }

  return {
    rows,
    totalTaxable,
    totalCgst,
    totalSgst,
    totalIgst,
    totalTaxAmount,
  };
}

// 12. Automated Exact Naming Conventions (VBA BuildPDFName & Document Exports)
export function buildQuotationPdfName(qNo: string = "", dateIso?: string): string {
  const fyDigits = currentFY().replace("-", "");
  let lastNum = "101";
  let revPart = "";
  let cleanQNo = qNo || "";

  const pDash = cleanQNo.lastIndexOf("-R");
  if (pDash > 0) {
    revPart = cleanQNo.substring(pDash);
    cleanQNo = cleanQNo.substring(0, pDash);
  }

  const pSlash = cleanQNo.lastIndexOf("/");
  if (pSlash >= 0) {
    const numPart = parseInt(cleanQNo.substring(pSlash + 1), 10);
    lastNum = !isNaN(numPart) ? String(numPart).padStart(3, "0") : cleanQNo.substring(pSlash + 1);
  } else {
    const numPart = parseInt(cleanQNo.replace(/\D/g, ""), 10);
    if (!isNaN(numPart)) lastNum = String(numPart).padStart(3, "0");
  }

  const dateStr = formatIsoToDdMmYyyy(dateIso || new Date().toISOString().slice(0, 10));
  return `Estimate_${fyDigits}-AIA-${lastNum}${revPart}_${dateStr}.pdf`;
}

export function buildPIPdfName(piNo: string = "", dateIso?: string): string {
  const cleanPi = (piNo || "Sale_Order_2627-01").replace(/[\/\\:]/g, "-");
  const dateStr = formatIsoToDdMmYyyy(dateIso || new Date().toISOString().slice(0, 10));
  return `${cleanPi}_${dateStr}.pdf`;
}

export function buildTIPdfName(tiNo: string = "", dateIso?: string): string {
  const cleanTi = (tiNo || "2026-27-AIA-001").replace(/[\/\\:]/g, "-");
  const dateStr = formatIsoToDdMmYyyy(dateIso || new Date().toISOString().slice(0, 10));
  return `Tax-Invoice_${cleanTi}_${dateStr}.pdf`;
}

export function buildPOPdfName(poNo: string = "", dateIso?: string): string {
  const cleanPo = (poNo || "PO-2026-001").replace(/[\/\\:]/g, "-");
  const dateStr = formatIsoToDdMmYyyy(dateIso || new Date().toISOString().slice(0, 10));
  return `Purchase_Order_${cleanPo}_${dateStr}.pdf`;
}

/**
 * Dynamic resolution of Technical Specification Profile Product Name
 * Prioritizes:
 * 1. Explicit spec_profile_id lookup
 * 2. Profile Name or Product recorded in technical_specs
 * 3. Best normalized substring match against available specProfiles (longest profile first)
 * 4. Fallback: strips dimensions, bullets, and prefixes from product_type
 */
export function resolveTechnicalProfileName(
  quote: Quotation,
  specProfiles: SpecProfile[] = []
): string {
  if (quote.spec_profile_id) {
    const found = specProfiles.find(
      (p) => p.id === quote.spec_profile_id || p.name === quote.spec_profile_id
    );
    if (found) return found.product || found.name;
  }

  const norm = (s: string) =>
    (s || "")
      .toLowerCase()
      .replace(/motorized/g, "motorised")
      .trim();

  if (quote.technical_specs) {
    const profName =
      quote.technical_specs["Profile Name"] || quote.technical_specs["Product"];
    if (profName && profName.trim()) {
      const found = specProfiles.find(
        (p) => norm(p.name) === norm(profName) || norm(p.product || "") === norm(profName)
      );
      if (found) return found.product || found.name;
    }
  }

  const rawProduct = (quote.product_type || "").trim();
  if (rawProduct) {
    const sortedProfiles = [...specProfiles].sort(
      (a, b) => (b.name || "").length - (a.name || "").length
    );
    const normRaw = norm(rawProduct);

    // Exact match
    const exact = sortedProfiles.find(
      (p) => norm(p.name) === normRaw || norm(p.product || "") === normRaw
    );
    if (exact) return exact.product || exact.name;

    // Substring match with normalized strings
    for (const p of sortedProfiles) {
      const pName = norm(p.product || p.name);
      if (pName && normRaw.includes(pName)) {
        return p.product || p.name;
      }
    }

    // Fallback: Strip bullets, dimensions, pipes, "Length –", "Width –", etc.
    const cleanProduct = rawProduct
      .split(/[\r\n•|]/)[0]
      .replace(/\s+(Incline\s+Length|Horizontal\s+Length|Width|Length|Height).*$/i, "")
      .replace(/^Quotation\s+for\s+/i, "")
      .trim();

    if (cleanProduct) return cleanProduct;
  }

  return quote.product_type || "";
}
