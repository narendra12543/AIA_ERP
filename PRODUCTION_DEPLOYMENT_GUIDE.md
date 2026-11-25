# AVEN INDUSTRIAL AUTOMATION — MASTER ERP SYSTEM
## PRODUCTION DEPLOYMENT & ARCHITECTURE GUIDE

**Release Date:** 25 November 2026  
**System:** AVEN Industrial Automation Master ERP  
**Project Workspace:** `D:\Project\AIA_ERP`  
**Framework:** Next.js 14.2.35 (App Router, React 18, TypeScript, Tailwind CSS)  

---

## 1. PROJECT DIRECTORY ARCHITECTURE

The authoritative project root is structured as follows:

```
D:\Project\AIA_ERP/
├── app/
│   ├── api/
│   │   ├── auth/           # Login, logout, session verification
│   │   ├── clients/        # Client repository API (PostgreSQL + JSON fallback)
│   │   ├── company/        # Company profile & banking information API
│   │   ├── export-pdf/     # Native Chromium Skia vector PDF generation engine
│   │   ├── quotes/         # Quotation CRUD and revision management
│   │   ├── spec-profiles/  # Technical specification profiles
│   │   ├── upload/         # Cloudinary cloud asset upload API
│   │   ├── users/          # User management and RBAC administration
│   │   └── vendors/        # Vendor management API
│   ├── globals.css         # Global Tailwind and print CSS
│   ├── layout.tsx          # Root layout and session provider
│   └── page.tsx            # Main application orchestrator
├── components/
│   ├── CommercialOffer.tsx # Page 2: Commercial Quotation Document (A4 Locked)
│   ├── Page1Technical.tsx  # Page 1: Technical Specifications Document (A4 Locked)
│   ├── ProformaInvoice.tsx # Proforma Invoice Document (A4 Locked)
│   ├── PurchaseOrder.tsx   # Purchase Order Document (A4 Locked)
│   ├── QuotationSystem.tsx # Full ERP Dashboard, line item editor, combobox
│   ├── TaxInvoice.tsx      # Official Tax Invoice Document (A4 Locked)
│   └── ...                 # Modals (User, Vendor, Login, Sidebar, Header)
├── data/                   # Authoritative initial data & offline JSON fallbacks
│   ├── clients.json        # 26 pre-seeded client records
│   ├── company.json        # Company branding & banking profile
│   ├── quotes.json         # Quotation records & revisions
│   └── spec_profiles.json  # Pre-configured technical spec profiles
├── lib/
│   ├── auth.ts             # Scrypt hashing, token sessions, rate limiting
│   ├── db.ts               # PostgreSQL connection pool & schema migration
│   ├── pdf-export.ts       # Client-side capture & serverless export pipeline
│   ├── types.ts            # Enterprise TypeScript interfaces
│   └── vba-engine.ts       # Excel VBA calculation replication engine
├── public/
│   └── assets/             # Logos, stamps, default drawings, vector fonts
├── scripts/                # Automated regression & migration test suites
├── .env.example            # Sanitized environment variable template
├── .env.local              # Local private environment credentials (GIT-IGNORED)
├── .gitignore              # Strict credential and build ignore rules
├── package.json            # Dependencies and NPM scripts
└── tsconfig.json           # TypeScript configuration
```

---

## 2. GITHUB PREPARATION & SECURE REPOSITORY SETUP

### 2.1 Git Ignore Verification
Before staging or committing any code, verify that private credentials and build artifacts are strictly ignored:
- `.env.local`, `.env`, and `*.pem` are excluded.
- `node_modules/` and `.next/` are excluded.
- `*.tsbuildinfo` and temporary test outputs are excluded.

### 2.2 Step-by-Step Git Commands
Execute the following commands in PowerShell from the project root (`D:\Project\AIA_ERP`):

```powershell
# 1. Navigate to the project directory
cd D:\Project\AIA_ERP

# 2. Check current git status
git status

# 3. If git is not initialized:
# git init

# 4. Verify that .env.local is NOT tracked
git status --ignored

# 5. Stage only source code and authorized configuration
git add .

# 6. Verify staged files (ensure no .env or private credentials appear)
git status

# 7. Create safe release checkpoint commit
git commit -m "chore(release): AVEN Master ERP v2.0.0 Production Release with Item Reset and Dynamic Branch Location"

# 8. Link to authorized private GitHub repository (Replace with your actual GitHub repo URL)
# git remote add origin https://github.com/YourOrg/aven-master-erp.git

# 9. Push to main branch (ONLY AFTER EXPLICIT APPROVAL)
# git branch -M main
# git push -u origin main
```

---

## 3. DATABASE CONFIGURATION (NEON POSTGRESQL)

The application features a dual-persistence architecture:
1. **Primary Enterprise Tier:** High-performance PostgreSQL with connection pooling.
2. **Resilience Tier:** Fail-safe JSON storage (`data/*.json`), guaranteeing that local or offline workflows never halt if the database experiences network latency.

### 3.1 Connection String Setup
In your Neon Console (or Supabase / AWS RDS):
1. Navigate to your project dashboard.
2. Under **Connection Details**, select **Pooled connection** for production web runtime.
3. Ensure the connection string includes `?sslmode=require`:
   ```
   postgresql://neondb_owner:YOUR_PASSWORD@ep-cool-project-123456-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### 3.2 Schema Auto-Provisioning
The application automatically executes `initDb()` on startup through `lib/db.ts`, creating all required tables with indexes if they do not already exist:
- `company_info` (Primary company branding & banking details)
- `quotations` (Quotation records, revisions, line items, and financial values)
- `clients` (Client directory, contact details, GSTIN, and Place of Supply)
- `spec_profiles` (Technical engineering specification templates)
- `vendors` (Suppliers and procurement contacts)
- `users` (User accounts with salted Scrypt password hashes)
- `sessions` (Token sessions with fixed expiration)
- `rate_limits` (Brute-force protection tracking)

*No manual SQL execution is required. Existing database records are preserved.*

---

## 4. CLOUDINARY CLOUD ASSET STORAGE

Technical product drawings, conveyor CAD mockups, and customer-uploaded gate designs are stored securely in Cloudinary.

### 4.1 Required Credentials
Obtain the following from your Cloudinary Dashboard:
- **Cloud Name:** (e.g. `dwvi432ol`)
- **API Key:** (e.g. `728157961344236`)
- **API Secret:** (Configured securely in `.env.local` / Vercel Environment Variables)
- **Folder:** `new_erp`

### 4.2 Security & Permissions
- All uploads are handled server-side via `app/api/upload/route.ts`.
- File size is restricted to 10MB maximum.
- Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/svg+xml`.
- Image URLs are served over HTTPS and seamlessly inlined as Base64 data during PDF export to prevent external image blocking.

---

## 5. CHROMIUM PDF ENGINE — PRODUCTION COMPATIBILITY ANALYSIS

This is a critical architectural requirement:

### 5.1 Local Dev & Dedicated VPS / Docker Runtime
The existing local PDF engine operates via `puppeteer-core` calling the system-installed Chromium binary (`C:\Program Files\Google\Chrome\Application\chrome.exe` on Windows, or `/usr/bin/google-chrome` on Ubuntu Linux).
- **Quality:** Native vector PDF output via Skia PDF graphics pipeline.
- **Speed:** 400ms – 1.2s per export.
- **Borders & Typography:** 100% pixel-perfect vector borders (`1px solid #000000`).
- **Compatibility:** **Fully compatible out-of-the-box on any Linux VPS, Docker container, or cloud VM (AWS EC2, DigitalOcean, Railway, Render).**

### 5.2 Vercel Serverless Function Considerations
Vercel Serverless Functions run inside ephemeral AWS Lambda micro-containers with:
- Strict uncompressed package size limits (250MB).
- No pre-installed Google Chrome in `/usr/bin/google-chrome`.
- 15-second execution timeout on Hobby plans (or 60s on Pro plans).

**Recommended Production Options for Vercel:**
1. **Option A (Dedicated Container / VPS — Recommended):**
   Deploy the Next.js ERP as a Docker container or Node service on a VPS (Ubuntu with `google-chrome-stable` installed) or modern container host (Railway / Render / AWS ECS). This guarantees identical vector PDF output with zero serverless limitations.
2. **Option B (Vercel Serverless with `@sparticuz/chromium-min`):**
   If deploying strictly to Vercel Serverless, configure `@sparticuz/chromium-min` to download a headless Chromium binary from a public GitHub release URL on demand, or route `/api/export-pdf` to a lightweight dedicated PDF microservice.

---

## 6. VERCEL DEPLOYMENT PROCEDURE (STEP-BY-STEP)

> [!IMPORTANT]
> Do not trigger production deployment without explicit authorization from the client.

### Step 1: Connect Repository
1. Log in to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Import your GitHub repository (`aven-master-erp`).

### Step 2: Configure Project Settings
- **Project Name:** `aven-master-erp`
- **Framework Preset:** Next.js
- **Root Directory:** `./` (Root directory contains `package.json`)
- **Build Command:** `npm run build` (or default `next build`)
- **Output Directory:** `.next`
- **Install Command:** `npm install`
- **Node.js Version:** `20.x`

### Step 3: Configure Environment Variables in Vercel
Under **Settings** > **Environment Variables**, add the following variables for **Production** and **Preview**:

| Variable Name | Value Description |
| :--- | :--- |
| `DATABASE_URL` | Pooled Neon PostgreSQL connection string (`sslmode=require`) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Cloud Name |
| `CLOUDINARY_API_KEY` | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret |
| `CLOUDINARY_FOLDER` | `new_erp` |
| `NODE_ENV` | `production` |

### Step 4: Staging Deployment & Verification
1. Click **Deploy**.
2. Inspect the build log to confirm `✓ Compiled successfully` and 0 TypeScript errors.
3. Once deployed, open the staging URL and verify:
   - Login authentication (`sales@avenautomation.in` / user credentials).
   - Click `+ NEW QUOTATION`: confirm previous items are cleared and 1 fresh row is shown.
   - Edit "Branch Location" in Company Profile: confirm active previews update.
   - Export 2-Page Quotation PDF: confirm native vector PDF generation.

---

## 7. CUSTOM SUBDOMAIN CONFIGURATION (`erp.avenautomation.in`)

To connect the production ERP to a dedicated business subdomain without affecting the public website:

### 7.1 Vercel Domain Setup
1. In Vercel Project Dashboard, navigate to **Settings** > **Domains**.
2. Enter `erp.avenautomation.in` and click **Add**.

### 7.2 DNS Records (Domain Registrar / Cloudflare)
Add the following CNAME record in your DNS provider (e.g. Cloudflare, GoDaddy, Namecheap):

| Type | Name / Host | Target / Value | TTL | Proxy Status |
| :--- | :--- | :--- | :--- | :--- |
| **CNAME** | `erp` | `cname.vercel-dns.com.` | Auto / 300 | DNS Only (Gray Cloud if using Cloudflare) |

*Vercel automatically issues and renews a free Let's Encrypt SSL/TLS certificate for `erp.avenautomation.in` within minutes of DNS propagation.*

### 7.3 Search Engine Protection
To ensure private company quotations and invoices are never indexed by Google:
- The ERP automatically serves `X-Robots-Tag: noindex, nofollow, noarchive` headers.
- All application and API routes require authenticated sessions.

---

## 8. ROLLBACK & INCIDENT RESPONSE PROCEDURE

If an issue occurs post-deployment:
1. **Instant Rollback in Vercel:**
   - In Vercel Dashboard, go to **Deployments**.
   - Locate the previous stable production deployment.
   - Click the three dots (`...`) > **Promote to Production**. Rollback is effective instantly (0 downtime).
2. **Local Rollback:**
   - Use the verified pre-fix checkpoint backup: `D:\Project\AIA_ERP_backup_20261125_pre_fix\`.
