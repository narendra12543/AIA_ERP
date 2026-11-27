# PROTECTED DOCUMENT SYSTEMS — PERMANENT LOCK POLICY

The following four commercial document systems and their PDF generation pipeline are **permanently locked**:
1. **Quotation System** (Technical Page 1 + Commercial Offer Page 2)
2. **Proforma Invoice**
3. **Tax Invoice**
4. **Purchase Order** (including its independent form)

## Locked Files (`config/protected-document-files.json`)
- `components/QuotationSystem.tsx`
- `components/Page1Technical.tsx`
- `components/CommercialOffer.tsx`
- `components/ProformaInvoice.tsx`
- `components/TaxInvoice.tsx`
- `components/PurchaseOrder.tsx`
- `components/PurchaseOrderForm.tsx`
- `lib/vba-engine.ts`
- `lib/pdf-export.ts`
- `lib/bullet-helper.ts`
- `app/api/export-pdf/route.ts`

## Rules
- **No unapproved edits** to UI, forms, previews, A4 page dimensions, fonts, borders, margins, spacing, calculations, numbering, filenames, or PDF rendering.
- Global theme/UI refinements must use **scoped styles** and must never alter `@media print`, `#export_p1`, `#export_p2`, `#export_pi`, `#export_ti`, or `#export_po`.
- Run `npm run verify:protected` (also executed automatically via `prebuild` before `npm run build`).
- Never regenerate `config/protected-document-files.json` hashes without explicit written approval.
