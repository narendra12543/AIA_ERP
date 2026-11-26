# PDF BINARY VALIDATION REPORT

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`

## 1. Server-Side Validation (`app/api/export-pdf/route.ts`)

`validatePdfBinary(Buffer)` verifies every generated PDF before sending HTTP `200`:
- Minimum size `>= 1000` bytes.
- Exact `%PDF-` header signature at offset `0`.
- `startxref` and `%%EOF` trailer within the final 128 bytes.
- Core PDF structure objects `/Type /Catalog` and `/Type /Pages`.
- Sets explicit `Content-Type: application/pdf` and `Content-Length` headers so truncated transfers are detected.

## 2. Client-Side Validation (`lib/pdf-export.ts`)

`validateClientPdfBytes(Uint8Array)` verifies every response before constructing a `Blob` or writing to disk:
- Requires HTTP `200` and `Content-Type` containing `application/pdf` (rejects HTML/JSON error pages).
- Reads full `ArrayBuffer` and checks `bytes.length >= 1000`, `%PDF-` magic bytes (`0x25 0x50 0x44 0x46 0x2D`), `startxref`, and `%%EOF`.
- Never writes to `showSaveFilePicker` or triggers `<a download>` on invalid/truncated payloads.

## 3. Verified Output Counts (10/10 Passed)

- **Quotation:** `2` pages (`1,924,133 – 1,924,478` bytes), valid header/catalog/pages/trailer.
- **Proforma Invoice:** `1` page (`346,648 – 347,062` bytes), valid header/catalog/pages/trailer.
- **Tax Invoice:** `1` page (`346,734` bytes), valid header/catalog/pages/trailer.
- **Purchase Order:** `1` page (`95,016` bytes), valid header/catalog/pages/trailer.
