# PHASE 1 REGRESSION TEST REPORT

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`

## 1. Automated Test Results (Local Windows Environment)

1. **Next.js Production Build (`npm run build`):**
   - Exited with code `0` (`0` errors, `0` warnings across all 13 routes).
   - `/` First Load JS reduced from `189 kB` to `144 kB`.
2. **Existing Regression Suite (`node scripts/test-final-corrections.js`):**
   - Suite 1 (New Quotation Reset): **PASSED**
   - Suite 2 (Client Search & Auto-Fetch): **PASSED**
   - Suite 3 (Dynamic Bank Branch Location): **PASSED**
   - Suite 4 (Multi-Viewport Responsiveness 320px–1440px): **PASSED** (`0` horizontal overflow)
   - Suite 5 (All 4 Native Vector PDF Exports): **PASSED** (`Quotation 1,918,797 B`, `PI 349,498 B`, `TI 349,433 B`, `PO 96,745 B`)
3. **Phase 1 Benchmark & Security Suite (`node scripts/test-phase1-benchmarks.js`):**
   - Unauth `GET /api/users`, `POST /api/users`, `POST /api/export-pdf`: `401` (**PASSED**)
   - Auth Admin `GET /api/users`: `200`, `leaksPassword=false` (**PASSED**)
   - 10 Consecutive Cold & Warm Exports across Quotation (2p), PI (1p), TI (1p), PO (1p): **10/10 PASSED** (`valid=true`, exact page counts)
   - SSRF (`http://169.254.169.254/...`) & `<script>` sanitization: **PASSED** (`200 application/pdf`, outbound blocked)

## 2. Untested Scenarios (Pending Deployment Approval)

- Actual deployed Vercel Linux cold-start latency (`@sparticuz/chromium` inflation on `https://erp.avenautomation.in`).
- Physical iPhone Safari, iPhone Chrome, and Android Chrome downloads on the deployed HTTPS domain.

*Local testing is clearly distinguished from deployed production verification. Awaiting user approval before committing and pushing to GitHub/Vercel.*
