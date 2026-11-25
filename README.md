# AVEN Master ERP & Quotation System (Next.js Edition)

Modern, full-stack Next.js 14 application built for **AVEN INDUSTRIAL AUTOMATION** (Legal Brand: `SPARECONN SOLUTIONS PVT. LTD`).

## Key Features

1. **Codentra Systems InvoiceHub Theme & Layout (Black & White / Dark Mode)**:
   - Clean, high-contrast dark aesthetic (`#09090b` zinc dark mode) inspired by modern enterprise billing portals.
   - **Left Sidebar**: Streamlined with only **two** primary buttons:
     - **Overview**: Proposals & estimates dashboard with 4 KPI cards (`Total Quotations`, `Total Value`, `Accepted`, `Pending`), status filter tabs, search, and action controls.
     - **Quotation System**: Hosts the complete quotation engine with sub-tabs for `Dashboard`, `Page 1 (Technical)`, `Commercial Offer`, `Proforma Invoice`, `Tax Invoice`, `Purchase Order (PO)`, `Database`, and `Spec Profiles`.

2. **100% Calibrated 2-Page Quotation PDF (Zero Cutoff)**:
   - **Page 1**: Technical proposal with corporate header, layout drawing container, and enclosed 1px technical specification table.
   - **Page 2 (Commercial Offer)**: Strict single-page A4 canvas containing the items table with multiline bullets, universal tax breakdown (CGST 9% + SGST 9% vs IGST 18%), and the 3-column footer (**Bank Details**, **Material Specification**, **Authorized Signatory**).
   - Calibrated element heights ensure the entire document ends well within A4 boundaries (no cutoff or missing borders).

3. **Complete VBA Logic Line-to-Line & Word-to-Word (`lib/vba-engine.ts`)**:
   - Numbering engines (`CurrentFY`, `NextQuotationNo`, `NextPINumber`, `NextTaxInvoiceNumber`).
   - Dynamic item height & line-wrapping calculations (38-character threshold + padding).
   - Number to Words converter (Indian numbering system: Lakhs / Crores).
   - Intra-state (Maharashtra code 27) vs Inter-state (IGST) tax detection.

4. **Updated Corporate & Bank Details**:
   - **Company**: AVEN INDUSTRIAL AUTOMATION
   - **Legal Brand Line**: `(A brand of SPARECONN SOLUTIONS PVT. LTD)`
   - **GSTIN**: `27ABLCS1425N1ZX`
   - **PAN**: `ABLCS1425N`
   - **Bank**: `KOTAK BANK`
   - **Account Name**: `SPARECONN SOLUTIONS PVT. LTD`
   - **Account No**: `9048397387`
   - **IFSC**: `KKBK0001774`
   - **Branch**: `Bhosari, Pune`

5. **User Roles & Access Control**:
   - Built-in user role system (`Admin`, `User`, `Staff`).
   - User Management modal for adding accounts, editing permissions, and resetting passwords.

## Local Development

```bash
cd nextjs-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build & Deployment

```bash
npm run build
npm run start
```
Can also be deployed directly to Vercel via `vercel --prod`.
