# AVEN MASTER ERP — FINAL PRODUCTION DEPLOYMENT HANDOVER

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`  
**GitHub Repository:** `https://github.com/narendra12543/AIA_ERP.git` (`main`)  
**Production URL:** `https://erp.avenautomation.in`  
**Private Local Reference (Git-Ignored):** `D:\Project\AIA_ERP\.env.production.local`

---

## 1. Final Production Readiness Status

All local application development, security hardening, production build (`npm run build`), production runtime startup (`npm run start`), secret scanning, and authenticated regression testing are **complete and verified**.

| Area | Local Status | Notes / Production Gate |
| --- | --- | --- |
| Locked PDF Formats & Native Chromium Engine | **READY** | 40/40 consecutive exports valid across Quotation (2p), PI (1p), TI (1p), PO (1p) |
| Enterprise Auth, 15-Day Expiry & RBAC | **READY** | Verified in `npm run start` (`NODE_ENV=production`) against isolated PostgreSQL (`002_enterprise_upgrade.sql` applied twice idempotently): Admin `200`, Staff `200`, Invalid `401`, Unauth `401`, Staff RBAC `403`, Inactive `403`, `defaultUsers` fallback blocked (`401`), expired password `403 PASSWORD_CHANGE_REQUIRED` + change-password + session revocation (`401`) + reuse prevention (`400`) |
| Dynamic Encrypted SMTP & AI Settings | **READY** | AES-256-GCM (`SETTINGS_ENCRYPTION_KEY`), DNS-rebinding SSRF protection, Admin UI |
| All Quotations Overview & Mobile UI | **READY** | 0 horizontal overflow across `320px–1920px` (desktop Chromium emulation) |
| Zoho Mail Center & AI Assistant | **READY** | Local B2B engine active by default; external AI opt-in (`ALLOW_EXTERNAL_AI=false`) |
| Git Secret Scan & `.gitignore` | **READY** | 0 forbidden files (`.env*`, `.xlsm`, `.dump`, `.pdf`) and 0 secret hits in `git status` |
| Live Neon DB Migration & Excel Import | **PENDING USER** | Prepared; do not run until backup & approval |
| Live Vercel Deployment & Physical Mobile Test | **PENDING USER** | User will push to GitHub and deploy via Vercel |

---

## 2. Exact Vercel Environment Variables (Audited from Source Code)

A private, Git-ignored file [`.env.production.local`](file:///D:/Project/AIA_ERP/.env.production.local) has been created on your machine containing your available Cloudinary values, Excel Zoho SMTP values, and a newly generated 32-byte `SETTINGS_ENCRYPTION_KEY`. **Never commit `.env.production.local`.**

### A. Existing Environment Variables (Keep Unchanged / Rotate Secrets Before Final Go-Live)

| Variable Name | Req/Opt | Purpose | In `.env.production.local` | Add to Vercel? | Source | Expected Format | Prod / Preview |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | **Required** | Neon PostgreSQL pooled connection | Commented placeholder | **Verify existing** | Neon Console / Vercel | `postgresql://user:pass@host/db?sslmode=require` | Prod: Live DB / Preview: Isolated DB |
| `CLOUDINARY_CLOUD_NAME` | **Required** | Cloudinary cloud identifier | Yes (from `.env.local`) | **Keep existing** | Cloudinary Console | Alphanumeric string | Required in both |
| `CLOUDINARY_API_KEY` | **Required** | Cloudinary API key | Yes (from `.env.local`) | **Keep existing** | Cloudinary Console | Numeric string | Required in both |
| `CLOUDINARY_API_SECRET` | **Required** | Cloudinary signing secret | Yes (from `.env.local`) | **Keep existing** (rotate recommended) | Cloudinary Console | Secret string | Required in both |
| `CLOUDINARY_FOLDER` | **Required** | Target upload folder | Yes (`new_erp`) | **Keep existing** | Existing config | `new_erp` | `new_erp` |

### B. Newly Introduced Environment Variables (Must Be Added to Vercel)

| Variable Name | Req/Opt | Purpose | In `.env.production.local` | Add to Vercel? | Source | Expected Format | Prod / Preview |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SETTINGS_ENCRYPTION_KEY` | **Required** | Independent 32-byte key for AES-256-GCM encryption of SMTP/AI secrets in DB | Yes (generated 64-hex key) | **YES (Add & back up!)** | Generated in `.env.production.local` | 64-char hex string (32 bytes) | **Required in Prod** (do NOT regenerate on redeploys!) |
| `PASSWORD_EXPIRY_DAYS` | **Required** | Mandatory password rotation interval | Yes (`15`) | **YES** | Policy setting | `15` | Prod & Preview: `15` |
| `ENABLE_PASSWORD_EXPIRY` | **Required** | Enforces 15-day password expiry gate | Yes (`true`) | **YES** | Policy setting | `true` | Prod & Preview: `true` |
| `ENABLE_RBAC_ENFORCEMENT` | **Required** | Enables granular Admin/Staff permissions | Yes (`true`) | **YES** | Policy setting | `true` | Prod & Preview: `true` |

### C. Optional Email & AI Environment Variables

| Variable Name | Req/Opt | Purpose | In `.env.production.local` | Add to Vercel? | Source | Expected Format | Prod / Preview |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ZOHO_SMTP_HOST` | Optional | Default SMTP server (also editable in Admin UI) | Yes (`smtp.zoho.in`) | Recommended | Excel / Zoho Mail | `smtp.zoho.in` or `smtp.zoho.com` | Prod: `smtp.zoho.in` |
| `ZOHO_SMTP_PORT` | Optional | SMTP port | Yes (`465`) | Recommended | Zoho Mail | `465` (SSL) or `587` (STARTTLS) | Prod: `465` |
| `ZOHO_EMAIL` | Optional | Default sender email | Yes (`sales@avenautomation.in`) | Recommended | Excel Dashboard R38 | Valid email address | Prod: `sales@avenautomation.in` |
| `ZOHO_APP_PASSWORD` | Optional | Zoho App-Specific Password | Yes (from Excel R39; **rotate!**) | Recommended | Zoho Security → App Passwords | Secret string | Prod only (omit in Preview) |
| `ZOHO_FROM_NAME` | Optional | Sender display name | Yes (`AVEN Industrial Automation`) | Optional | Company Name | Plain string | Prod: `AVEN Industrial Automation` |
| `ZOHO_DEFAULT_CC` | Optional | Default CC address | Yes (`info@avenautomation.in`) | Optional | Excel Dashboard R41 | Valid email address | Prod: `info@avenautomation.in` |
| `ENABLE_AI_ASSISTANT` | Optional | Enables AI Email Assistant toolbar | Yes (`true`) | Optional | Feature toggle | `true` / `false` | `true` |
| `ALLOW_EXTERNAL_AI` | Optional | Opt-in gate for external Gemini/LanguageTool APIs | Yes (`false`) | Recommended (`false`) | Privacy control | `false` (default) or `true` | `false` unless authorized |
| `GEMINI_API_KEY` | Optional | Free-tier Gemini API key | Empty (`""`) | Optional | Google AI Studio | `AIza...` | Optional |
| `GEMINI_MODEL` | Optional | Gemini model identifier | Yes (`gemini-2.0-flash`) | Optional | Google AI Studio | `gemini-2.0-flash` | `gemini-2.0-flash` |
| `NEXT_PUBLIC_APP_URL` | Optional | Explicit origin for PDF asset resolution | Not needed if `VERCEL_URL` present | Optional | Domain | `https://erp.avenautomation.in` | Prod: `https://erp.avenautomation.in` |

### D. Obsolete / Legacy Variables (Do Not Add)
- `AI_PROVIDER`, `ZOHO_OAUTH_REFRESH_TOKEN`, `SESSION_SECRET`, `PORT` are **not** required by the application. (`R2_*` and `CHROME_PATH` are legacy/Docker-only overrides and not needed on Vercel.)

---

## 3. Production Database Backup, Migration & Excel Import Commands

Run these from a machine with `psql` / `pg_dump` and your live `DATABASE_URL` exported:

### Step 1: Backup & Verify Backup Integrity
```bash
pg_dump "$DATABASE_URL" -Fc -f aven_erp_pre_phase2_backup.dump
pg_restore --list aven_erp_pre_phase2_backup.dump | head -n 30
```

### Step 2: Run Transactional Non-Destructive Schema Migration
```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/migrations/002_enterprise_upgrade.sql
```
*(Wrapped in `BEGIN; ... COMMIT;`, uses `ADD COLUMN IF NOT EXISTS` & `CREATE TABLE IF NOT EXISTS` — preserves all existing users, passwords, clients, vendors, company info, and quotations.)*

### Step 3: Verify Schema Migration
```bash
psql "$DATABASE_URL" -c "\dt" -c "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position;"
```

### Step 4: Excel Quotation Dry-Run & Reconciliation
- Current workbook (`Quotation_System.xlsm`, `Database` sheet): **36 total rows** — **35 genuine** (`26-27/AIA/114`–`149`), **1 incomplete** (`26-27/AIA/146` — `HK ENTERPRISES`, ₹0 / empty items, flagged for Admin review in [EXCEL_QUOTATION_MIGRATION_PLAN.md](file:///D:/Project/AIA_ERP/EXCEL_QUOTATION_MIGRATION_PLAN.md)).
```bash
node scripts/migrate-excel-quotes.js --dry-run
```
*(Live `--apply` remains safety-blocked in `scripts/migrate-excel-quotes.js` until Admin decides treatment of `26-27/AIA/146` and explicitly authorizes import.)*

### Step 5: Safe Database Rollback (If Ever Needed)
```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" aven_erp_pre_phase2_backup.dump
```

---

## 4. Safe GitHub Commit & Push Commands (Run Locally in Git Bash)

Verify no secrets are staged, then commit and push to `origin main`:
```bash
cd /d/Project/AIA_ERP
git status --short
git check-ignore -v .env.local .env.production.local
git add .
git status --short
git commit -m "Release AVEN Master ERP Phase 2: Enterprise Security, RBAC, Mail Center, AI & Admin Settings"
git push origin main
```

---

## 5. Vercel Deployment Instructions & Hosting Restrictions

1. **Existing Project:** Open the existing Vercel project (`aia-erp`) linked to `narendra12543/AIA_ERP` (`main`). Do **not** create a new Vercel project or alter DNS for `erp.avenautomation.in`.
2. **Build & Runtime Settings:**
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `./`
   - **Node.js Version:** `20.x`
   - **Install Command:** `npm install`
   - **Build Command:** `npm run build`
3. **Add Environment Variables** from Section 2 (copy values from your local `.env.production.local`), **redeploy after adding `SETTINGS_ENCRYPTION_KEY`** and running Step 2 (`002_enterprise_upgrade.sql`) on Neon.
4. **Commercial Plan Restriction:** Vercel's **Hobby** plan is restricted to non-commercial use per Vercel Terms; commercial ERP operation requires **Vercel Pro** (or self-hosted VPS/Docker).
5. **Post-Deployment Verification Checklist (`https://erp.avenautomation.in`):**
   - [ ] Admin & Staff login work (no dev fallback, empty fields on load)
   - [ ] 15-day password change modal & RBAC Staff `403` restrictions work
   - [ ] All 4 PDF formats (Quotation 2p, PI, TI, PO) export cleanly on desktop & physical iOS Safari / Android Chrome
   - [ ] Overview displays All Quotations with search, filters, and pagination
   - [ ] `Settings → Email & SMTP Configuration` → `Test SMTP Connection` & `Send Test Email` (to your own test inbox, not customer emails) succeed
   - [ ] `Settings → Database & Cloudinary` shows `Connected` & `Configured`

---

## 6. Mandatory Credential Rotation Checklist

1. **Neon PostgreSQL:** Rotate database user password in Neon Console and update `DATABASE_URL` in Vercel.
2. **Cloudinary:** Rotate `CLOUDINARY_API_SECRET` in Cloudinary Console and update Vercel.
3. **Zoho Mail App Password:** Revoke the App Password stored in `Quotation_System.xlsm` (`Dashboard` R39), generate a new App-Specific Password in Zoho Security, and save it in Vercel (`ZOHO_APP_PASSWORD`) or `Settings → Email & SMTP Configuration`.
4. **Backup `SETTINGS_ENCRYPTION_KEY`:** Store your 64-char hex `SETTINGS_ENCRYPTION_KEY` from `.env.production.local` in a secure password manager. **Never regenerate it on future deployments** or stored encrypted SMTP/AI credentials in `system_settings` will become unreadable.
