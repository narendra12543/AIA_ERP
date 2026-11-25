# AVEN MASTER ERP — FINAL PRODUCTION COMPATIBILITY & SECURITY AUDIT

**Release Date:** 25 November 2026  
**System:** AVEN Industrial Automation Master ERP  
**Authoritative Workspace Directory:** `D:\Project\AIA_ERP`  
**Git Remote:** `git@github.com:narendra12543/AIA_ERP.git` (Branch: `main`)  
**Status:** **AUDITED, HARDENED & PRODUCTION-READY** (Deployment Pending Explicit User Approval)

---

## 1. PERMANENT PROJECT ISOLATION & DIRECTORY LOCK

In strict accordance with Section 1 of the Master Audit Prompt:
- **Authoritative Directory:** All development, testing, building, and verification are strictly bound to `D:\Project\AIA_ERP`.
- **Zero Interference:** No older project directories, previous repositories, public company websites, or third-party folders have been modified.
- **Git Repository Isolation:**
  - `git rev-parse --show-toplevel`: Confirmed `D:/Project/AIA_ERP`.
  - `git remote -v`: Confirmed dedicated repository `git@github.com:narendra12543/AIA_ERP.git` (fetch & push).
  - `git branch --show-current`: `main`.
  - `.gitignore`: Fully protects `.env`, `.env*.local`, `.next/`, `node_modules/`, `*.pdf`, `backups/`, `*.log`, and temporary files.

---

## 2. PRODUCTION DATABASE SAFETY & POSTGRESQL PERSISTENCE (P0)

### 2.1 Elimination of Silent JSON Fallback in Production
In production business transactions, silent fallback to local JSON storage is unacceptable because serverless instances (e.g. Vercel) have ephemeral, read-only file systems. 
- **Enforced Rule:** When `process.env.NODE_ENV === "production"`, `DATABASE_URL` is **strictly mandatory**.
- **Fail-Safe Mechanism:**
  - In `lib/db.ts`, `query()` now throws `DATABASE_UNAVAILABLE` errors in production if the pool is offline, rather than returning `null`.
  - In `app/api/quotes/route.ts`, `app/api/clients/route.ts`, `app/api/company/route.ts`, `app/api/vendors/route.ts`, and `app/api/spec-profiles/route.ts`, all production requests read and write exclusively through PostgreSQL.
  - If PostgreSQL is unreachable or unconfigured in production, the API immediately returns HTTP `503 Service Unavailable` with a descriptive JSON error (`{ error: "DATABASE_UNAVAILABLE: Failed to persist record to database. Operation aborted.", code: "DATABASE_UNAVAILABLE" }`).
  - **The system will never display a false success toast if persistent storage fails.**
  - Local JSON storage is retained strictly as an optional offline development mode when `NODE_ENV !== "production"`.

### 2.2 Non-Destructive Migrations & Record Protection
- **Audited `scripts/migrate.js`:** Modified all `INSERT` statements to use `ON CONFLICT (id) DO NOTHING` (and `ON CONFLICT (name) DO NOTHING`, `ON CONFLICT (email) DO NOTHING`).
- Running `npm run migrate` will **never overwrite, reset, truncate, or recreate existing business records** in PostgreSQL.
- Seeding logic in API routes was removed to prevent old local JSON files from automatically re-importing into live tables.

### 2.3 Database TLS Certificate Verification
- Configured Neon-compatible TLS enforcement in `lib/db.ts`:
  ```typescript
  const sslConfig = isLocalhost
    ? false
    : isProduction
    ? { rejectUnauthorized: true }
    : { rejectUnauthorized: false };
  ```
  This ensures encrypted communication between Vercel/VPS and the Neon PostgreSQL cluster using trusted public root CAs.

### 2.4 Distributed Authentication & Multi-Instance Rate Limiting
- `sessions` and `login_attempts` tables in PostgreSQL provide distributed state across multiple serverless or container instances:
  - Account lockouts after 5 consecutive failed attempts are recorded directly in PostgreSQL `login_attempts` and enforced globally across all serverless function instances.
  - In production (`isProduction`), `verifySession()` validates sessions exclusively against the PostgreSQL `sessions` table (joined with `users`), ensuring session invalidations and logouts take immediate effect across all server instances.

---

## 3. DYNAMIC BRANCH LOCATION — FINAL BINDING VERIFICATION

### 3.1 Hardcoded Fallback Elimination
In the previous implementation, templates contained `company.branch || "Bhosari, Pune"`, which would silently display `"Bhosari, Pune"` even if the branch was deliberately cleared or moved.

### 3.2 Authoritative Binding Applied
All document templates and dashboard bindings now strictly bind to the authoritative Company Profile value:
- `components/CommercialOffer.tsx` (line 475):
  ```tsx
  <div><strong>Branch:</strong> {company.branch || ""}</div>
  ```
- `components/ProformaInvoice.tsx` (line 601):
  ```tsx
  <div><strong>Branch:</strong> {company.branch || ""}</div>
  ```
- `components/TaxInvoice.tsx` (line 576):
  ```tsx
  <div><strong>Branch:</strong> {company.branch || ""}</div>
  ```
- `components/QuotationSystem.tsx` (line 1422):
  ```tsx
  value={companyInfo.branch !== undefined ? companyInfo.branch : (company.branch || "")}
  ```
- **Visual & Layout Preservation:** Applied solely to existing Bank Details text blocks. Zero changes were made to typography, font size, margins, cell padding, or single-line borders.

---

## 4. VERCEL SERVERLESS CHROMIUM RUNTIME ANALYSIS (P0)

### 4.1 Technical Architecture & Environment Resolution
In `app/api/export-pdf/route.ts`, browser executable detection has been architected to seamlessly support multi-platform execution:
1. **Explicit Override:** `process.env.CHROME_PATH`.
2. **Local Windows Development:** Auto-detects Google Chrome and Microsoft Edge (`C:\Program Files\Google\Chrome\Application\chrome.exe`).
3. **Linux VPS / Docker Container:** Auto-detects system Google Chrome (`/usr/bin/google-chrome-stable`, `/usr/bin/chromium`).
4. **Vercel Serverless / AWS Lambda:** Dynamically resolves `@sparticuz/chromium` or `@sparticuz/chromium-min` when deployed to AWS Lambda environments without triggering Next.js webpack build failures.

### 4.2 Vercel Serverless Limitations & Platform Compatibility Audit
| Constraint | Vercel Serverless (AWS Lambda) | Linux VPS / Dedicated Docker | AVEN ERP Status |
| :--- | :--- | :--- | :--- |
| **Serverless Function Zip Limit** | 50 MB compressed | Unlimited | `@sparticuz/chromium-min` downloads binary at runtime to `/tmp` to stay within 50MB. |
| **Serverless Function Uncompressed**| 250 MB | Unlimited | Supported. |
| **Execution Timeout** | 10s default (Hobby), up to 300s (Pro) | Unlimited | Configured `export const maxDuration = 60;` in `app/api/export-pdf/route.ts`. |
| **Memory Allocation** | 1024 MB | Flexible (2GB - 4GB recommended) | 1024 MB is sufficient for 2-page Chromium vector PDF rendering. |
| **Native Vector PDF Fidelity** | 100% Vector (Skia) | 100% Vector (Skia) | Identical vector output. Selectable text, embedded fonts. |
| **Commercial Terms of Service** | **Non-commercial only on Hobby (Free)** | Fully Commercial | **CRITICAL AUDIT FINDING:** Vercel Hobby terms prohibit commercial business operations. **A Vercel Pro Plan ($20/mo) or a dedicated Linux VPS (Ubuntu with Docker) is required for commercial licensing.** |

---

## 5. ENVIRONMENT CREDENTIALS & SECURITY AUDIT

### 5.1 Credential Sanitation in `.env.example`
- **Sanitized:** Replaced all hardcoded credentials in `.env.example` with safe placeholder strings (`your_cloudinary_api_key`, `your_cloudinary_api_secret`, etc.).
- **Security Alert:** Because real Cloudinary credentials (`CLOUDINARY_API_KEY=728157961344236`) were previously placed in `.env.example`, **we recommend rotating these API secrets in your Cloudinary Dashboard before final production go-live**.

### 5.2 Required Production Variables
1. `DATABASE_URL`: Neon PostgreSQL connection string with `?sslmode=require`.
2. `CLOUDINARY_CLOUD_NAME`: Cloudinary cloud name.
3. `CLOUDINARY_API_KEY`: Cloudinary API key.
4. `CLOUDINARY_API_SECRET`: Cloudinary API secret.
5. `CLOUDINARY_FOLDER`: Set to `new_erp` (Strictly preserved).
6. `NODE_ENV`: Set to `production`.
7. `PORT`: Set to `3000` (for standalone/VPS) or managed by Vercel.

---

## 6. SEARCH ENGINE PROTECTION & PRIVATE ERP HEADERS

To prevent search engine indexing of private commercial quotations, client pricing, and company invoices:
1. **Robots Exclusion Standard (`public/robots.txt`):**
   ```
   User-agent: *
   Disallow: /
   ```
2. **Next.js Metadata (`app/layout.tsx`):**
   ```typescript
   robots: {
     index: false,
     follow: false,
     nocache: true,
     googleBot: { index: false, follow: false, noimageindex: true },
   }
   ```
3. **HTTP Security Headers (`next.config.js`):**
   - `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`
   - `X-Frame-Options: SAMEORIGIN`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`

---

## 7. CUSTOM DOMAIN CONFIGURATION (`erp.avenautomation.in`)

To map `erp.avenautomation.in` without modifying the existing public company website (`avenautomation.in`):
1. In Vercel Project Settings -> Domains: Add `erp.avenautomation.in`.
2. In your DNS Provider (Hostinger / GoDaddy / Cloudflare):
   - **Type:** `CNAME`
   - **Name / Host:** `erp`
   - **Target / Value:** `cname.vercel-dns.com`
   - **TTL:** `Automatic` or `3600`
   - **Proxy status:** DNS Only (if using Cloudflare, grey-cloud icon during initial SSL verification).
3. Vercel automatically provisions and renews a free Let's Encrypt SSL certificate for `erp.avenautomation.in`.

---

## 8. AUTOMATED REGRESSION & PRODUCTION BUILD RESULTS

### 8.1 Automated Regression Test Suite (`scripts/test-final-corrections.js`)
Executed via Chromium Puppeteer automation:
- **Suite 1 (New Quotation Reset):** PASSED (1 clean empty row, empty subject, ₹3,00,000.00 calculation).
- **Suite 2 (Client Search & Auto-Fetch):** PASSED (Flowzen Technology auto-populated, item data preserved).
- **Suite 3 (Dynamic Bank Branch):** PASSED (Updated to "Talawade MIDC Software Park, Pune", verified in Offer, PI, TI, and restored to "Bhosari, Pune").
- **Suite 4 (Multi-Viewport Responsiveness):** PASSED (Tested at 320px, 375px, 414px, 768px, 1440px with 0 overflow).
- **Suite 5 (Vector PDF Exports):** PASSED (Quotation: 1,919,134 B, PI: 349,524 B, TI: 349,450 B, PO: 96,745 B).
- **Overall Result:** **100% SUCCESS RATE ACROSS ALL 5 SUITES**.

### 8.2 Production Build Output (`npm run build`)
```
Route (app)                              Size     First Load JS
┌ ○ /                                    101 kB          189 kB
├ ○ /_not-found                          873 B          88.1 kB
├ ƒ /api/auth/login                      0 B                0 B
├ ƒ /api/auth/logout                     0 B                0 B
├ ƒ /api/auth/session                    0 B                0 B
├ ƒ /api/clients                         0 B                0 B
├ ƒ /api/company                         0 B                0 B
├ ƒ /api/export-pdf                      0 B                0 B
├ ƒ /api/quotes                          0 B                0 B
├ ƒ /api/spec-profiles                   0 B                0 B
├ ƒ /api/upload                          0 B                0 B
├ ƒ /api/users                           0 B                0 B
└ ƒ /api/vendors                         0 B                0 B
+ First Load JS shared by all            87.2 kB
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

✓ Compiled successfully (0 errors, 0 warnings)
```

---

## 9. DEPLOYMENT CLEARANCE & NEXT STEPS

> [!IMPORTANT]
> In strict compliance with your instructions, **no remote git push or production cloud deployment has been executed**.
> All changes are isolated in `D:\Project\AIA_ERP`, verified locally, and ready for deployment upon your explicit authorization.
