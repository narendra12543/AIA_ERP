# AVEN MASTER ERP — FINAL VERCEL DEPLOYMENT CHECKLIST

**Release Date:** 25 November 2026  
**System:** AVEN Industrial Automation Master ERP  
**Target Repository:** `git@github.com:narendra12543/AIA_ERP.git` (Branch: `main`)  
**Production Domain:** `erp.avenautomation.in`

---

## 1. VERCEL PROJECT CONFIGURATION SETTINGS

When importing the repository into Vercel, configure the project settings exactly as follows:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Project Name** | `aven-master-erp` | Or custom name of your choice |
| **Framework Preset** | `Next.js` | Auto-detected |
| **Root Directory** | `./` | Leave empty / default root |
| **Node.js Version** | `20.x` | Required for native crypto & TLS CAs |
| **Install Command** | `npm install` | Default |
| **Build Command** | `npm run build` | Verified: compiles with 0 errors |
| **Output Directory** | `.next` | Default Next.js build output |

---

## 2. PRODUCTION ENVIRONMENT VARIABLES MATRIX

Add the following environment variables in **Vercel Project Settings -> Environment Variables**:

| Variable Name | Environment Scope | Example Value | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Production** | `postgresql://neondb_owner:***@ep-***.us-east-2.aws.neon.tech/neondb?sslmode=require` | Mandatory Neon PostgreSQL connection string with TLS |
| `DATABASE_URL` | **Preview / Dev** | Separate Neon branch URL (e.g. `.../neondb_preview?...`) | **CRITICAL:** Use a separate Neon branch for preview deployments to prevent test quotes from modifying live production data |
| `CLOUDINARY_CLOUD_NAME` | All Environments | `your_cloud_name` | Cloudinary asset hosting |
| `CLOUDINARY_API_KEY` | All Environments | `your_api_key` | Cloudinary authenticated uploads |
| `CLOUDINARY_API_SECRET` | All Environments | `your_api_secret` | Rotated secret key |
| `CLOUDINARY_FOLDER` | All Environments | `new_erp` | Authoritative asset directory |
| `NODE_ENV` | Production | `production` | Enables strict fail-safe DB mode |

---

## 3. DATABASE ISOLATION & SAFETY VERIFICATION

Before pushing or triggering deployment:
- [ ] **Verify Production Database URL:** Ensure `DATABASE_URL` connects to the designated production Neon database.
- [ ] **Verify Preview Database URL:** Ensure preview environments use a separate Neon database branch (Neon allows 1-click branch creation).
- [ ] **Run Safe Migration Check:**
  ```bash
  # Run once from local terminal to verify schema without overwriting:
  DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" npm run migrate
  ```
- [ ] **Verify Existing Record Counts:** Confirm existing quotes and client counts are preserved in PostgreSQL.

---

## 4. CUSTOM DOMAIN DNS CONFIGURATION (`erp.avenautomation.in`)

To map `erp.avenautomation.in` cleanly without affecting the existing website (`avenautomation.in`):

1. In Vercel Project Dashboard:
   - Navigate to **Settings** -> **Domains**.
   - Enter `erp.avenautomation.in` and click **Add**.
2. In your DNS Provider (Hostinger / GoDaddy / Cloudflare):
   - Add a new record:
     - **Type:** `CNAME`
     - **Host / Name:** `erp`
     - **Target / Points to:** `cname.vercel-dns.com`
     - **TTL:** `Automatic` or `3600`
3. SSL Certificate: Vercel will automatically issue and renew a free Let's Encrypt SSL certificate once the CNAME resolves.

---

## 5. CHROMIUM RUNTIME & COMMERCIAL LICENSING NOTE

- **Commercial Use on Vercel:** Vercel's Free (Hobby) plan prohibits commercial use and limits functions to 10s timeouts. For an enterprise ERP, **a Vercel Pro Plan ($20/user/mo)** or a **dedicated Ubuntu VPS (Docker container with native Google Chrome)** is required for commercial licensing and unrestricted PDF generation.
- **Function Execution Timeout:** `export const maxDuration = 60;` is configured in `app/api/export-pdf/route.ts` to allow ample time for serverless vector PDF rendering.

---

## 6. PRE-DEPLOYMENT CODE CHECKLIST

- [x] Working directory confirmed: `D:\Project\AIA_ERP`.
- [x] `.gitignore` verified: `.env`, `.env*.local`, `node_modules`, `.next`, `*.pdf` ignored.
- [x] `.env.example` sanitized: placeholder values only.
- [x] Dynamic Bank Branch: `{company.branch || ""}` bound without hardcoded fallback.
- [x] Production DB fail-safe: 503 error returned if DB fails; zero silent JSON fallback.
- [x] Robots exclusion: `public/robots.txt` and `X-Robots-Tag: noindex, nofollow` active.
- [x] Local regression tests: 100% pass rate (`scripts/test-final-corrections.js`).
- [x] Production build: `npm run build` succeeds with 0 errors across 13 routes.

---

## 7. SAFE GIT DEPLOYMENT COMMANDS (AWAITING USER APPROVAL)

When you are ready to initiate deployment to GitHub and Vercel:

```bash
# 1. Switch to authoritative directory
cd D:\Project\AIA_ERP

# 2. Stage verified production source files
git add .

# 3. Create initial production release commit
git commit -m "feat(production): AIA Master ERP production release with PostgreSQL persistence & PDF format lock"

# 4. Push to dedicated AIA_ERP GitHub repository
git push -u origin main
```
