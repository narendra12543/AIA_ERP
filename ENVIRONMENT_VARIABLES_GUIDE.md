# AVEN MASTER ERP — PRODUCTION ENVIRONMENT VARIABLES GUIDE

**Release Date:** 25 November 2026  
**System:** AVEN Industrial Automation Master ERP  
**Authoritative Directory:** `D:\Project\AIA_ERP`  
**Security Classification:** Highly Confidential — Never Commit Secrets

---

## 1. ENVIRONMENT CONFIGURATION MATRIX

| Variable Name | Required | Default / Format | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes (in Production)** | `postgresql://[user]:[password]@[neon-host].aws.neon.tech/[db]?sslmode=require` | Authoritative PostgreSQL connection string. Enables strict TLS certificate validation. Mandatory when `NODE_ENV=production`. |
| `NODE_ENV` | **Yes (in Production)** | `production` | Enables strict production mode: disables silent local JSON fallback, enforces PostgreSQL persistence, and activates security cookies. |
| `CLOUDINARY_CLOUD_NAME` | **Yes** | String (e.g. `your_cloud_name`) | Cloudinary cloud account name for storing technical drawings and assets. |
| `CLOUDINARY_API_KEY` | **Yes** | Numeric String | Cloudinary API Key for authenticated asset uploads. |
| `CLOUDINARY_API_SECRET` | **Yes** | Secret String | Cloudinary API Secret Key. |
| `CLOUDINARY_FOLDER` | **Yes** | `new_erp` | Preserved authoritative Cloudinary upload folder. |
| `CHROME_PATH` | Optional | Absolute Path (e.g. `/usr/bin/google-chrome`) | Manual path override for Chromium executable on custom Linux VPS or Docker environments. Auto-detected if omitted. |
| `PORT` | Optional | `3000` | Port for local server or custom VPS container. |

---

## 2. SECURITY POLICY & CREDENTIAL ROTATION

### 2.1 Git Ignore Verification
Ensure the following files are strictly ignored by Git and never staged:
```
.env
.env*.local
!.env.example
*.pem
*.key
```
Verify before every commit:
```bash
git status --ignored
```

### 2.2 Cloudinary Key Rotation Alert
> [!WARNING]
> Because real Cloudinary credentials (`CLOUDINARY_API_KEY=728157961344236`) were previously placed in `.env.example`, **you should rotate your API Secret in the Cloudinary Console** (Dashboard -> Settings -> Access Keys) before deploying to live production.

---

## 3. LOCAL DEVELOPMENT TEMPLATE (`.env.local`)

For local offline development in `D:\Project\AIA_ERP`:

```env
# Local Development Settings
DATABASE_URL="postgresql://neondb_owner:your_password@ep-***.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Cloudinary Assets
CLOUDINARY_CLOUD_NAME="your_cloudinary_cloud_name"
CLOUDINARY_API_KEY="your_cloudinary_api_key"
CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
CLOUDINARY_FOLDER="new_erp"

# Development Runtime
NODE_ENV="development"
PORT=3000
```
