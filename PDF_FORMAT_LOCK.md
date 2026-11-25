# AVEN MASTER ERP — PERMANENT PDF & DOCUMENT FORMAT LOCK SPECIFICATION
**Release Date: 25 November 2026**
**Status: PERMANENTLY LOCKED & REGRESSION TESTED**

---

## 1. ARCHITECTURAL MANDATE & NON-NEGOTIABLE PRINCIPLES

1. **Native Chromium Vector PDF Engine Sole Authorization**:
   - All document PDF downloads across the AVEN ERP must originate exclusively from the headless Chromium vector export pipeline via `/api/export-pdf`.
   - **Absolute Prohibition**: Silent fallback to `html2canvas` or `jsPDF` rasterization is permanently eliminated. No raster screenshots (e.g. 288 DPI images wrapped in jsPDF 4.2.1) are permitted.
   - All exported documents must conform to `%PDF-1.4` standard with embedded TrueType/Type0 font descriptors (`/Type /Font`) and selectable text.

2. **Locked Document Page Geometries**:
   - **Quotation**: Exactly 2 Pages (Page 1 Technical Specifications + Page 2 Commercial Offer).
   - **Proforma Invoice (PI)**: Exactly 1 Page (A4).
   - **Tax Invoice (TI)**: Exactly 1 Page (A4).
   - **Purchase Order (PO)**: Exactly 1 Page (A4).
   - Page dimensions: Standard ISO A4 (210mm × 297mm) with zero margin page container (`@page { size: 210mm 297mm; margin: 0mm; }`) and 8mm top/bottom, 10mm left/right internal padding (`.a4-sheet`).

---

## 2. COMPONENT DESIGN SPECIFICATIONS & BOUNDARIES

### A. Quotation Page 1 (Technical Specifications)
- **File**: `components/Page1Technical.tsx`
- **Container**: Outer border `1px solid #000000`, uniform white background.
- **Top Header**:
  - Left: Company name (`13.5px`, font-weight 900), conditional branding `(A brand of <ENTITY>)`, office address, phone, email, and GSTIN/PAN/State bar.
  - Right: AVEN logo (`maxHeight: 62px`), Quotation No., and Date.
- **Greeting & Description Bullets**:
  - Formal client salutation and multiline product bullet points (`lineHeight: 1.35`, `fontSize: 8.5px`).
- **Product Drawing Image**:
  - Max height strictly constrained to `165px` (`maxHeight: "165px"`, `objectFit: "contain"`).
  - Guarantees complete vertical clearance so all technical specification rows fit cleanly without page overflow or clipping.
- **Technical Specification Section Heading & Underline**:
  - Dynamic profile product name resolved via `resolveTechnicalProfileName(quote, specProfiles)`: Displays `Technical Data - [Selected Profile Product Name]` (e.g. `Technical Data - Inclined Belt Conveyor with Horizontal Discharge`). Commercial dimensions and extra pipe characters are excluded from the heading.
  - Heading underline standardized to uniform `1px solid #000000` (`borderBottom: "1px solid #000000"`).
- **Technical Specification Table**:
  - Dark navy header `#162f56` with white text (`fontSize: 9px`, height `26px`).
  - Table rows: specification label (`fontWeight: 700`) and value (`fontWeight: 400`), padding `3.5px 10px`, line-height `1.35`.

### B. Quotation Page 2 (Commercial Offer)
- **File**: `components/CommercialOffer.tsx`
- **Main Title**: "COMMERCIAL OFFER" centered above the main bordered container.
- **Top Letterhead**:
  - Left: AVEN logo (`height: 56px`), company trade name, address, contact, GSTIN/PAN/State.
  - Right: Estimate No. and Date in bordered metadata box.
- **Estimate For Box**:
  - Client company name, address, email, contact, and GSTIN.
- **Commercial Line Items Table**:
  - `#`, `Item Name & Multiline Bullets`, `HSN/SAC`, `Size`, `Quantity`, `Unit`, `Price/Unit`, `Amount`.
  - All cells bounded by uniform `1px solid #000000` borders.
- **Amounts & GST Summary**:
  - Subtotal, Tax (CGST 9% + SGST 9% or IGST 18%), Round Off, Total.
  - Amounts box has `borderBottom: "1px solid #000000"` with inner table last row having `borderBottom: "none"`, preventing double-line border stacking against the HSN table.
  - Statutory GST table with full column headers (`HSN/ SAC`, `Taxable amount`, `CGST Rate/Amount`, `SGST Rate/Amount`, `Total Tax Amount`).
  - Bank Details & Signatory cleanly share single boundary with HSN table.

### C. Proforma Invoice (PI) & Tax Invoice (TI)
- **Files**: `components/ProformaInvoice.tsx` & `components/TaxInvoice.tsx`
- **Main Title**: "PROFORMA INVOICE" or "TAX INVOICE" centered above container.
- **Company Information Block (Left)**:
  - Top-aligned letterhead layout (`padding: "10px 12px"`, `gap: "14px"`).
  - Logo (`width: "80px"`, `maxHeight: "75px"`).
  - Company trade name (`13px`, font-weight 900, uppercase).
  - Conditional legal branding `formatLegalBranding(company.tagline)`.
  - Full address, phone, email, and GSTIN/PAN/State.
- **Upper-Right 10-Field Metadata Table**:
  - Fixed width `230px`, 5 rows × 2 columns:
    1. Invoice No. | Date
    2. Place of Supply | Due Date
    3. PO Date | PO Number
    4. Transport Name | Vehicle Number
    5. Delivery Date | Payment Terms
  - Cell padding `3.5px 6px`, labels `fontSize: 7px, lineHeight: 1.2`, values `fontSize: 8px-9px, lineHeight: 1.25`.
- **Bill To & Ship To Boxes**:
  - Side-by-side flex layout with solid vertical border divider.
- **Statutory GST Summary Table**:
  - Native table headers (`<th rowSpan={2}>`) with direct padding and text alignment.
  - Zero collapsed nested flex containers.
- **Tax Invoice Footer 3-Box Layout**:
  - Box 1 (Left): Official Bank Details.
  - Box 2 (Center): Material Specification & Declaration.
  - Vertical border divider strictly preserved between declaration and signature box.
  - Box 3 (Right): AVEN INDUSTRIAL AUTOMATION / Authorized Signatory.

---

## 3. SESSION & AUTHENTICATION INTEGRATION

- **Route Protection**: `/api/export-pdf` enforces strict authentication verification via `authenticateRequest(req)`.
- **Tab-Scoped Session Protocol**:
  - The client forwards `x-tab-session` from `sessionStorage.getItem("aven_tab_session")`.
  - `lib/auth.ts` caches active sessions in `globalForAuth` on `globalThis`, persisting across module reloads and serverless route worker boundaries.
- **Statutory Tax Invoice Guard**:
  - Client GSTIN validation is enforced before export. If invalid or missing, export is cleanly prevented.

---

## 4. REGRESSION VERIFICATION COMMANDS

To run the automated end-to-end PDF export regression suite:
```bash
cd nextjs-app
node scripts/test-actual-app-pdf-export.js
```

Expected verification output:
- `Estimate_2627-AIA-114_05-09-2026.pdf`: Exactly 2 pages, Producer: Skia/PDF, Vector: PASSED
- `Sale_Order_2627-02_05-09-2026.pdf`: Exactly 1 page, Producer: Skia/PDF, Vector: PASSED
- `Tax_Invoice_2026-27-AIA-002_05-09-2026.pdf`: Exactly 1 page, Producer: Skia/PDF, Vector: PASSED
- `Purchase_Order_PO-2026-011_05-09-2026.pdf`: Exactly 1 page, Producer: Skia/PDF, Vector: PASSED
