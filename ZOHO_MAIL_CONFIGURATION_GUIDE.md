# AVEN Master ERP — Zoho Mail OAuth 2.0 Configuration Guide

## 1. Zoho API Console Setup (India Data Center)
1. Sign in to [Zoho API Console](https://api-console.zoho.in/) with the organization Zoho Mail Super Admin account.
2. Click **Add Client** → **Server-based Applications**.
3. Configure:
   - **Client Name:** `AVEN Master ERP`
   - **Homepage URL:** `https://erp.avenautomation.in`
   - **Authorized Redirect URI:** `https://erp.avenautomation.in/api/mail/oauth/callback`
4. Copy the generated **Client ID** and **Client Secret**.

---

## 2. Required Environment Variables (Vercel / `.env.local`)
```env
ZOHO_CLIENT_ID="your_zoho_client_id"
ZOHO_CLIENT_SECRET="your_zoho_client_secret"
ZOHO_REDIRECT_URI="https://erp.avenautomation.in/api/mail/oauth/callback"
ZOHO_ACCOUNTS_BASE_URL="https://accounts.zoho.in"
ZOHO_MAIL_BASE_URL="https://mail.zoho.in"
SETTINGS_ENCRYPTION_KEY="your_64_hex_char_32_byte_random_encryption_key"
```
> **Important:** `SETTINGS_ENCRYPTION_KEY` is used to encrypt Zoho OAuth refresh/access tokens at rest in PostgreSQL. Never rotate or regenerate it across deployments without re-authorizing connected mailboxes.

### Optional AI Polish Environment Variables
```env
ENABLE_AI_ASSISTANT="true"
ALLOW_EXTERNAL_AI="false"   # Set "true" only if external Gemini Free Tier is desired
GEMINI_API_KEY=""           # Required when ALLOW_EXTERNAL_AI="true"
GEMINI_MODEL="gemini-3.5-flash-lite"  # Note: gemini-2.0-flash was retired June 1, 2026
```
When `ALLOW_EXTERNAL_AI="false"`, AI Polish runs 100% on-server via `local_b2b_engine` with zero external data egress.

### Attachment Size Limit (Vercel Serverless Compatibility)
- **Maximum raw attachment size:** **3 MB per file** and **3 MB total** per email request (~4.0 MB Base64 JSON payload, staying safely under Vercel's 4.5 MB serverless request body limit).

---

## 3. Connecting Mailboxes in AVEN Master ERP
1. Log in as **Admin** at `https://erp.avenautomation.in`.
2. Open **Admin Settings → Mail Accounts**.
3. For each mailbox (`sales@avenautomation.in`, `info@avenautomation.in`, `purchase@avenautomation.in`):
   - Click **Connect Zoho OAuth** and complete consent with that mailbox's Zoho credentials.
   - Verify the status badge updates to **Connected**.
   - Assign role/user read and send permissions (`Sales`, `Purchase`, `Accounts`, etc.).
4. Open **Mail Center** to confirm the connected mailbox appears in the **From** selector and **Zoho Inbox**.
