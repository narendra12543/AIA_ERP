# AVEN Master ERP — Production Deployment Checklist

## Pre-Deployment Gates
- [x] `npm run verify:protected` — 11/11 protected document files match baseline SHA-256.
- [x] `npx tsc --noEmit` — 0 TypeScript errors.
- [x] `npm run build` — Next.js production build succeeded cleanly.
- [x] Isolated verification passed (`verify-consolidation.mjs`, `verify-mail-center.mjs`, `verify-po-pdf-guard.mjs`, `verify-visual-docs.mjs`, 6-role Legacy SMTP `410` verification, and 3 MB / `413` attachment cap verification).
- [x] `.env.example` reviewed and up to date with Zoho OAuth, `SETTINGS_ENCRYPTION_KEY`, and AI Polish variables.

## Production Database Step (Completed)
- [x] Backed up Neon PostgreSQL (`ep-calm-tooth-bd03v2hh.c-8.us-east-2.aws.neon.tech`, DB `neondb`) to `C:\Users\user\AvenERP_Backups\neondb_backup_pre_009_20261128.json` (5,461,362 bytes) and verified isolated PGlite restore (`ISOLATED_BACKUP_RESTORE_VERIFIED=true`).
- [x] Applied **only** `scripts/migrations/009_zoho_multi_account_mail_and_signatures.sql` transactionally and verified idempotency (table count 34 → 40; `sales@avenautomation.in`, `info@avenautomation.in`, `purchase@avenautomation.in` registered with `Not Connected` status; all existing records preserved).
- [x] Verified legacy `POST /api/mail` SMTP sending disabled with HTTP `410 LEGACY_SMTP_DISABLED` across all 6 roles (read-only `GET /api/mail` preserved).
- [x] Corrected attachment payload limit to 3 MB raw per-file and 3 MB raw total (~4 MB Base64 JSON within Vercel 4.5 MB limit) in `app/api/mail/messages/route.ts` and `components/MailCenter.tsx`.

## Vercel Environment Configuration
- [ ] Verify existing `DATABASE_URL`, `CLOUDINARY_*`, `SETTINGS_ENCRYPTION_KEY`, `PASSWORD_EXPIRY_DAYS=15`, `ENABLE_PASSWORD_EXPIRY=true`, `ENABLE_RBAC_ENFORCEMENT=true`.
- [ ] Add Zoho OAuth variables: `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REDIRECT_URI=https://erp.avenautomation.in/api/mail/oauth/callback`, `ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.in`, `ZOHO_MAIL_BASE_URL=https://mail.zoho.in`.
- [ ] Confirm AI Polish policy: `ENABLE_AI_ASSISTANT=true`, `ALLOW_EXTERNAL_AI="false"` (on-server `local_b2b_engine` active; if enabling external Gemini later, configure `GEMINI_API_KEY` and update `GEMINI_MODEL` to `"gemini-3.5-flash-lite"` since `gemini-2.0-flash` was retired June 1, 2026).

## Post-Deployment Smoke Checks
- [ ] Log in as Admin at `https://erp.avenautomation.in`.
- [ ] Open **Admin Settings → Mail Accounts** and connect Zoho OAuth mailboxes (`sales@`, `info@`, `purchase@`).
- [ ] Open **Mail Center** and verify:
  - No legacy SMTP status badge or `Test SMTP` button appears.
  - `AI Polish` button + 10-action dropdown works and preserves the `Email Signature` block.
  - Send a test email via the connected Zoho OAuth mailbox.
- [ ] Verify Quotation, Proforma Invoice, Tax Invoice, and Purchase Order PDF generation/approval boundaries remain intact.
