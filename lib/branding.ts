/**
 * Utility for formatting the Legal Company Entity branding line
 * Strictly adheres to Section 5 of the Master Implementation Prompt:
 * - If valid company name exists: displays '(A brand of <NAME>)'
 * - If empty, whitespace, null, or undefined: returns null (completely hidden, no empty brackets, no empty row)
 * - Normalizes legacy input to prevent double prefixes like '(A brand of (A brand of ...))'
 */
export function formatLegalBranding(tagline?: string | null): string | null {
  if (!tagline) return null;
  const trimmed = tagline.trim();
  if (!trimmed) return null;

  // Strip existing outer brackets if user typed (A brand of ...)
  let clean = trimmed.replace(/^\(+|\)+$/g, "").trim();
  if (!clean) return null;

  // Filter out invalid/empty placeholders
  if (/^(null|undefined|\(\s*\)|\[\s*\])$/i.test(clean)) return null;

  // Filter out bare prefix with no company name, e.g. "A brand of", "A brand of:", etc.
  if (/^a\s+brand\s+of\s*[:.-]?$/i.test(clean)) return null;

  // Normalize prefix: ensure it starts with "A brand of "
  if (!/^a\s+brand\s+of/i.test(clean)) {
    clean = `A brand of ${clean}`;
  }

  return `(${clean})`;
}
