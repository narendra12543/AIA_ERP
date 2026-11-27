const IST_TIMEZONE = "Asia/Kolkata";

export function getCurrentBusinessDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value || String(now.getUTCFullYear());
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function parseYmd(input?: string | Date | null): { year: number; month: number } | null {
  if (!input) return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    const ist = getCurrentBusinessDate(input);
    const [y, m] = ist.split("-").map(Number);
    return { year: y, month: m };
  }
  const raw = String(input).trim();
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  }
  const dmyMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) {
    return { year: Number(dmyMatch[3]), month: Number(dmyMatch[2]) };
  }
  const dt = new Date(raw);
  if (!isNaN(dt.getTime())) {
    const ist = getCurrentBusinessDate(dt);
    const [y, m] = ist.split("-").map(Number);
    return { year: y, month: m };
  }
  return null;
}

export function getFYFromDate(input?: string | Date | null): string {
  const parsed = parseYmd(input) || parseYmd(getCurrentBusinessDate())!;
  const startYear = parsed.month >= 4 ? parsed.year : parsed.year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endShort}`;
}

export function getCurrentFY(now: Date = new Date()): string {
  return getFYFromDate(getCurrentBusinessDate(now));
}

export function normalizeFYCode(raw?: string | null): string {
  const val = (raw || "").trim().toUpperCase();
  if (!val) return getCurrentFY();
  if (val === "ALL") return "ALL";
  const full = val.match(/^(\d{4})-(\d{2})$/);
  if (full) return `${full[1]}-${full[2]}`;
  const short = val.match(/^(\d{2})-(\d{2})$/);
  if (short) return `20${short[1]}-${short[2]}`;
  return getCurrentFY();
}

export function getFYDateRange(fyCode: string): {
  start: string;
  end: string;
  startDate: string;
  endDate: string;
  fy: string;
} {
  const normalized = normalizeFYCode(fyCode);
  const fy = normalized === "ALL" ? getCurrentFY() : normalized;
  const startYear = Number(fy.slice(0, 4));
  const start = `${startYear}-04-01`;
  const end = `${startYear + 1}-03-31`;
  return {
    fy,
    start,
    end,
    startDate: start,
    endDate: end,
  };
}

export function listAvailableFYs(dates: string[], currentFY: string = getCurrentFY()): string[] {
  const set = new Set<string>([currentFY]);
  for (const d of dates) {
    if (!d) continue;
    const parsed = parseYmd(d);
    if (parsed) {
      set.add(getFYFromDate(d));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function matchesReportingFY(
  dateStr?: string | null,
  docNo?: string | null,
  targetFY: string = getCurrentFY()
): boolean {
  const norm = normalizeFYCode(targetFY);
  if (norm === "ALL") return true;
  if (dateStr) {
    const parsed = parseYmd(dateStr);
    if (parsed) {
      return getFYFromDate(dateStr) === norm;
    }
  }
  if (docNo) {
    const shortFy = `${norm.slice(2, 4)}-${norm.slice(5, 7)}`;
    const compactFy = `${norm.slice(2, 4)}${norm.slice(5, 7)}`;
    if (docNo.includes(norm) || docNo.includes(shortFy) || docNo.includes(compactFy)) {
      return true;
    }
  }
  return false;
}

export function formatFYLabel(fyCode: string): string {
  const norm = normalizeFYCode(fyCode);
  if (norm === "ALL") return "All Financial Years";
  return `FY ${norm}`;
}
