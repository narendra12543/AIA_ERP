# AVEN MASTER ERP — PHASE 2 IMPLEMENTATION PLAN (PHASE 0 AUDIT)

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`  
**GitHub Repository:** `https://github.com/narendra12543/AIA_ERP.git` (Branch: `main`)  
**Deployed Production Commit:** `3ca24ed` (`origin/main` verified via `git ls-remote`)  
**Checkpoint Backup:** `D:\Project\AIA_ERP_backup_20261126_phase0`  
**Production URL:** `https://erp.avenautomation.in`

---

## 1. CURRENT SYSTEM ARCHITECTURE (VERIFIED)

- **Framework:** Next.js `14.2.35` (App Router, React `18.3.1`, TypeScript `5.4.5`).
- **Database:** Neon Serverless PostgreSQL (`pg ^8.23.1`), TLS enforced in production (`rejectUnauthorized: true`). Local JSON fallback (`data/*.json`) is strictly restricted to development (`NODE_ENV !== "production"`).
- **PDF Engine:** Server-side `puppeteer-core ^25.18.1` + `@sparticuz/chromium ^158.0.0` (Linux/Vercel) or local Chrome/Edge (Windows), invoked via `POST /api/export-pdf` (`maxDuration = 60`).
- **Asset Storage:** Cloudinary (`cloudinary ^2.11.0`, folder `new_erp`) via `POST /api/upload`.
- **Authentication:** Custom PostgreSQL-backed sessions (`sessions` table), Scrypt password hashing (`lib/auth.ts`), distributed login rate limiting (`login_attempts`), `x-tab-session` header + `aven_session` HttpOnly cookie.
- **API Routes (11 endpoints):**
  - `auth/login`, `auth/logout`, `auth/session`
  - `quotes`, `clients`, `company`, `vendors`, `spec-profiles`, `users`, `upload`, `export-pdf`
- **Local Uncommitted Changes:** Only `components/ProformaInvoice.tsx` and `components/TaxInvoice.tsx` (GSTIN/PAN/State bolding edits). Everything else matches `origin/main` (`3ca24ed`).

---

## 2. CONFIRMED EXISTING FUNCTIONALITY (PERMANENTLY LOCKED)

- Quotation Page 1 (`Page1Technical.tsx`), Page 2 (`CommercialOffer.tsx`), Proforma Invoice (`ProformaInvoice.tsx`), Tax Invoice (`TaxInvoice.tsx`), Purchase Order (`PurchaseOrder.tsx`).
- Native Chromium vector PDF layout, A4 dimensions (`210mm x 297mm`), margins, typography, uniform `1px solid #000000` single-line borders, GST calculations, dynamic Place of Supply, dynamic Branch Location, New Quotation reset, client search & auto-fetch, and existing desktop/mobile UI.

---

## 3. OUTSTANDING DEFECTS & SECURITY FINDINGS

1. **PDF Reliability & Mobile `"Load failed"` (P0):**
   - `lib/pdf-export.ts` currently converts every image (including `default_gate.png` at `1.65 MB` -> `~2.2 MB` Base64) into an inline data URL on the client and sends the entire multi-megabyte HTML payload to `/api/export-pdf`. Combined with custom uploaded drawings, payloads approach or exceed **Vercel's 4.5 MB serverless request body limit**, causing `413` / connection drops (`"PDF Export Failed: Load failed"` on iPhone Safari).
   - On cold start, `@sparticuz/chromium` inflates `chromium.br` (`74.9 MB`) to `/tmp` AND `verifySession()` runs `initDb()` (15 DDL `CREATE TABLE/INDEX IF NOT EXISTS` queries) before rendering, risking **Vercel Hobby's 10s execution timeout** on the first 1–2 attempts.
   - Calling `window.showSaveFilePicker()` *before* `fetch("/api/export-pdf")` creates an empty 0-byte file on disk if the server request subsequently fails, and `window.showSaveFilePicker` is not supported on iPhone Safari.
   - No structured request-ID timing diagnostics exist yet to measure auth, DB, Chromium launch, asset load, render, and response stages independently.
2. **Hardcoded Cloudinary Credentials in Source Code (P0 Security):**
   - `app/api/upload/route.ts` (lines 8–10) still contains hardcoded fallback Cloudinary credentials (`cloudName`, `apiKey`, `apiSecret`). These must be removed immediately and the credentials rotated upon user approval.
3. **Missing Enterprise Password Policy & RBAC Granularity (P1):**
   - No 15-day password expiration lifecycle (`password_changed_at`, `password_expires_at`, `must_change_password`, password history).
   - Roles are coarse (`Admin` / `User`) without granular per-permission checks (`ADMIN` / `STAFF` with configurable permission keys) or comprehensive audit logging on all CRUD/export/mail actions.
   - `app/api/users/route.ts` `GET` has no `authenticateRequest` guard and falls back to `defaultUsers`.
4. **Overview Quotation Limit (P2):**
   - `components/Overview.tsx` (line 173) slices quotations to `.slice(0, 6)`, hiding older quotations.
5. **Excel Quotation Migration Pending (P3):**
   - Inspected `Quotation_System.xlsm` (`Database` sheet): contains **36 genuine quotation records** (`26-27/AIA/114` through `26-27/AIA/149`) across 71 active columns (`0..70`).
6. **Zoho Mail Center, AI Email Assistant & Expense Readiness (P4–P5):**
   - Not yet implemented.

---

## 4. PHASE-WISE IMPLEMENTATION & FILE-LEVEL PLAN

### Phase 1 (P0): PDF Reliability, Performance & Security Hygiene
- **`app/api/upload/route.ts`:** Remove hardcoded Cloudinary credential fallbacks; require env vars in production.
- **`lib/db.ts` & `lib/auth.ts`:** Skip redundant `initDb()` DDL on every cold-start `/api/export-pdf` call when tables already exist (lazy/cached check + fast-path query).
- **`app/api/export-pdf/route.ts`:**
  - Add structured request-ID timing logs (no secrets/PII logged): `authMs`, `chromiumResolveMs`, `launchMs`, `contentMs`, `renderMs`, `validateMs`, `totalMs`.
  - Allow relative `/assets/...` and `https://res.cloudinary.com/...` URLs to be resolved server-side instead of bloating the client `POST` body with 2–4 MB of Base64, keeping request payloads tiny (`< 150 KB`) so mobile Safari and Vercel 4.5 MB limits never fail!
  - Strengthen PDF structural validation (header `%PDF-`, `/Root`, `/Pages`, `xref`/`startxref`, `%%EOF`).
- **`lib/pdf-export.ts`:**
  - Add single-flight export lock (prevent concurrent duplicate exports), bounded exponential backoff retry (max 2 retries on transient `502/503/504/network` errors only, never on `401/403/400` or user cancel), accurate progress labels (`Preparing document`, `Validating session`, `Loading document assets`, `Generating PDF`, `Verifying PDF`, `Ready to save`).
  - Safe Save As handling: validate PDF bytes **before** writing; handle `AbortError` cleanly; on desktop Chrome/Edge handle failed writes without leaving silent false-success toasts (and document browser behavior if picker pre-creates a 0-byte handle, or offer a clean two-step / validated save flow).

### Phase 2 (P1): Enterprise Login Security & 15-Day Password Policy
- **DB Migration (`scripts/migrations/002_password_policy.sql`):** Add `password_changed_at`, `password_expires_at`, `must_change_password`, `password_version`, `password_history` (JSONB last 5 hashes), `last_login_at`, `failed_attempts_count` to `users` (non-destructive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
- **`components/LoginScreen.tsx` & `components/PasswordChangeModal.tsx`:** `autocomplete="username"` / `"current-password"` / `"new-password"`, visibility toggle, 12-char / passphrase strength meter, non-bypassable forced password change challenge.
- **`app/api/auth/change-password/route.ts` & `lib/auth.ts`:** Verify current password, enforce 12+ chars & last-5 history, rotate session token & invalidate prior sessions atomically, audit log event, feature-flagged rollout (`ENABLE_PASSWORD_EXPIRY`).

### Phase 3 (P1): ADMIN & STAFF RBAC + Audit Logs
- **DB Migration (`scripts/migrations/003_rbac_permissions.sql`):** Add `permissions JSONB` to `users` (migrating `"User"` -> `"STAFF"`, `"Admin"` -> `"ADMIN"` cleanly), expand `audit_logs` with `entity_type`, `entity_id`, `result`, `ip_address`.
- **`lib/permissions.ts`:** Central default-deny permission matrix (`dashboard.view`, `quotations.*`, `proforma.*`, `tax_invoice.*`, `purchase_order.*`, `clients.*`, `vendors.*`, `spec_profiles.*`, `company.manage`, `banking.manage`, `users.manage`, `permissions.manage`, `database.*`, `audit_logs.view`, `mail.*`, `expenses.*`).
- **API Enforcement:** Enforce `requirePermission(req, key)` across all 11 API routes, including `app/api/users/route.ts` `GET` and `app/api/export-pdf/route.ts`.
- **UI:** Enhance `UserManagementModal.tsx` with Staff permission toggles, lock status/unlock, force password change, and Admin Audit Log viewer.

### Phase 4 (P2): Mobile UI Refinements & Overview All Quotations
- **`components/Overview.tsx` & `app/api/quotes/route.ts`:** Remove `.slice(0, 6)`, add server/client search (quote no, client, product/subject), FY/date/status/revision filters, sorting, and pagination (`25 / 50 / 100` per page) + mobile quotation cards.
- **Mobile Polish:** Touch target sizes (`>= 44px`), viewport-safe dropdowns, fit-to-width/zoom/fullscreen A4 preview wrapper without altering exported A4 HTML/CSS.

### Phase 5 (P3): Excel Quotation Migration (`Quotation_System.xlsm`)
- **Scope:** Strictly `Database` sheet quotation rows (`26-27/AIA/114` to `26-27/AIA/149`, 36 rows). No company, bank, user, vendor, or spec profile master overwrites.
- **Script (`scripts/migrate-excel-quotes.js`):** Dry-run classification (genuine vs test/dummy vs duplicate), transactional idempotent upsert (`ON CONFLICT (quotation_no)` review), full reconciliation report before/after user approval.

### Phase 6 & 7 (P4–P5): Zoho Mail Center, Optional AI Assistant & Expense Readiness
- **Zoho Mail Center:** Verify user's Zoho Mail plan (Zoho Mail Free vs Workplace/Mail Lite — REST API OAuth vs SMTP-only), implement `app/api/mail/*` + Tiptap composer + ERP PDF attachments + templates + company signature + mail RBAC.
- **AI Email Assistant:** Provider-independent (`GEMINI_API_KEY` free tier / LanguageTool), strictly opt-in button, minimal sanitized text (no GSTIN/PAN/bank/attachments), Accept/Reject diff preview, Admin kill-switch.
- **Future Expense Readiness:** Reuse `permissions.manage` (`expenses.*`), `audit_logs`, and `upload` service without adding empty tables or dead UI tabs.

---

## 5. ENVIRONMENT VARIABLES (NAMES ONLY)

- **Existing:** `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_FOLDER`, `CHROME_PATH`, `NODE_ENV`, `PORT`
- **Proposed Phase 2 Additions:** `PASSWORD_EXPIRY_DAYS` (default `15`), `ENABLE_PASSWORD_EXPIRY`, `ENABLE_RBAC_ENFORCEMENT`, `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI`, `ZOHO_REGION` (e.g. `in` / `com`), `ZOHO_SMTP_HOST`, `ZOHO_SMTP_PORT`, `ENABLE_MAIL_CENTER`, `GEMINI_API_KEY`, `ENABLE_AI_ASSISTANT`

---

## 6. PLATFORM LIMITATIONS, RISKS & ESTIMATED RECURRING COSTS

| Service | Current / Free Tier | Limitations & Commercial Notes | Estimated Upgrade Cost (If Needed) |
| :--- | :--- | :--- | :--- |
| **Vercel** | Hobby / Pro | Hobby prohibits commercial use, caps function timeout at **10s**, and all plans cap request body at **4.5 MB**. Cold starts with `@sparticuz/chromium` (`74.9 MB`) can exceed 10s on Hobby. | **Vercel Pro:** \$20/member/month (60s–300s timeout, commercial license). *Alternative:* Ubuntu VPS (\$6–\$12/mo) with native Chrome. |
| **Neon PostgreSQL** | Free / Launch | Free tier computes auto-suspend after 5 min inactivity (adds ~0.5–1.5s cold wake-up). | Free up to 0.5 GB storage; **Launch:** ~\$19/mo if always-on compute is needed. |
| **Cloudinary** | Free | 25 credits/month (sufficient for product drawings). | \$0/month. |
| **Zoho Mail** | Existing Account | Zoho Mail Forever Free supports webmail/limited SMTP depending on legacy vs current plan; full REST API OAuth typically requires Mail Lite/Workplace. | \$0 if SMTP/API already enabled on current plan; **Mail Lite:** ~₹59–₹99/user/month if API upgrade needed. |
| **AI Assistant** | Gemini Free / LanguageTool | Free tier has RPM/RPD rate limits and provider data-processing terms (keep Admin-toggleable). | \$0/month (no auto-billing). |

---

## 7. TESTING & ROLLBACK STRATEGY

- **Testing:** Phase-by-phase local build (`npm run build`), Puppeteer regression suite (`scripts/test-final-corrections.js` + new Phase 1–4 specs), 10x consecutive cold/warm PDF exports across all 4 formats, PDF structural parser verification, and physical iPhone Safari + Desktop Chrome/Edge testing on staging.
- **Rollback:** Pre-phase backup at `D:\Project\AIA_ERP_backup_20261126_phase0`, Git commit checkpoints per phase, Neon point-in-time branch snapshot before any schema/data migration, and feature flags (`ENABLE_PASSWORD_EXPIRY`, `ENABLE_RBAC_ENFORCEMENT`, `ENABLE_MAIL_CENTER`, `ENABLE_AI_ASSISTANT`) for instant toggle-off.

---

## 8. REQUIRED USER APPROVALS BEFORE PROCEEDING

1. Approve **Phase 1 (P0) implementation** (PDF payload optimization, diagnostics, retry/Save As safety, and removing hardcoded Cloudinary keys from `app/api/upload/route.ts`).
2. Confirm **Vercel plan** (Hobby vs Pro) and whether you want to rotate the exposed Cloudinary & Neon credentials now or after Phase 1.
3. Confirm **Zoho Mail subscription tier** (whether Zoho Mail India/Global OAuth API is enabled or SMTP-only) before Phase 5.
4. Confirm **Admin/Staff default permission matrix** before Phase 3 enforcement.
5. Note: The **36 quotations** in `Quotation_System.xlsm` (`26-27/AIA/114`–`149`) will be dry-run classified in Phase 5 and **only imported after your explicit approval**.
