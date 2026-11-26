# PDF PERFORMANCE BENCHMARK REPORT

**Date:** 26 November 2026  
**Environment:** Local Windows Next.js Dev Server (`localhost:3000`, Chromium `chrome.exe`)  
**Test Script:** `scripts/test-phase1-benchmarks.js`

## 1. Before vs. After Payload & Client Bundle Measurements

| Metric | Before Phase 1 | After Phase 1 | Improvement |
| :--- | :--- | :--- | :--- |
| **Quotation `POST /api/export-pdf` Payload** | `~2,500,000+ B` (`~2.5 MB` Base64) | `32,487 B` (`31.7 KB`) | **98.7% smaller** |
| **PI / TI `POST /api/export-pdf` Payload** | `~350,000+ B` | `26,032 B` (`25.4 KB`) | **92.6% smaller** |
| **PO `POST /api/export-pdf` Payload** | `~300,000+ B` | `12,408 B` (`12.1 KB`) | **95.9% smaller** |
| **Client `/` First Load JS (`npm run build`)** | `189 kB` (`102 kB` route) | `144 kB` (`57 kB` route) | **45 kB smaller (-23.8%)** |

## 2. 10 Consecutive Cold & Warm Export Measurements

| Run | Document | Req Payload | Server Time | Client Time | PDF Size | Pages | Valid |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Quotation (Cold) | `32,487 B` | `2,074 ms` | `2,480 ms` | `1,924,133 B` | 2 | Yes |
| 2 | Proforma Invoice (Warm) | `26,032 B` | `1,410 ms` | `1,598 ms` | `346,648 B` | 1 | Yes |
| 3 | Tax Invoice (Warm) | `26,128 B` | `972 ms` | `1,084 ms` | `346,734 B` | 1 | Yes |
| 4 | Purchase Order (Warm) | `12,408 B` | `677 ms` | `794 ms` | `95,016 B` | 1 | Yes |
| 5 | Quotation (Warm) | `32,512 B` | `1,468 ms` | `1,624 ms` | `1,924,478 B` | 2 | Yes |
| 6 | Proforma Invoice (Warm) | `26,046 B` | `1,013 ms` | `1,111 ms` | `347,062 B` | 1 | Yes |
| 7 | Tax Invoice (Warm) | `26,128 B` | `969 ms` | `1,078 ms` | `346,734 B` | 1 | Yes |
| 8 | Purchase Order (Warm) | `12,408 B` | `640 ms` | `794 ms` | `95,016 B` | 1 | Yes |
| 9 | Quotation (Warm) | `32,512 B` | `1,436 ms` | `1,628 ms` | `1,924,478 B` | 2 | Yes |
| 10 | Proforma Invoice (Warm) | `26,046 B` | `900 ms` | `1,067 ms` | `347,062 B` | 1 | Yes |

## 3. Server-Side Stage Breakdown (`[PDF_EXPORT_DIAGNOSTICS]`)

- **Cold Start (Quotation 2p):** `authMs=0`, `assetResolveMs=11`, `chromiumResolveMs=1`, `launchMs=661`, `contentMs=445`, `renderMs=1258`, `validateMs=3`.
- **Warm Export (Quotation 2p):** `authMs=0`, `assetResolveMs=2`, `chromiumResolveMs=0`, `launchMs=0` (browser reused), `contentMs=342`, `renderMs=983`, `validateMs=2`.
- **Note:** Production Vercel Linux cold-start timings (with `@sparticuz/chromium` brotli inflation + Neon wake-up) must be measured after deployment.
