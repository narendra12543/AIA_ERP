# VERCEL RUNTIME LIMITATIONS REPORT (HOBBY PLAN AUDIT)

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`

## 1. Verified Vercel Hobby Plan Limits (Official Documentation)

| Capability | Vercel Hobby (Current Plan) | Impact on AVEN Master ERP |
| :--- | :--- | :--- |
| **Request & Response Body Limit** | **4.5 MB** hard limit | **Resolved in Phase 1:** Eliminating client Base64 bloat reduced `POST /api/export-pdf` payloads from `~2.5 MB` to `12–32 KB`. PDF responses are `95 KB – 1.92 MB` (under 4.5 MB). |
| **Fluid Compute `maxDuration`** | Up to **300s** with Fluid Compute enabled (10s–60s on legacy non-Fluid config) | `export const maxDuration = 60;` is configured in `app/api/export-pdf/route.ts`. Ensure **Fluid Compute** is enabled in Vercel Project Settings -> Functions. |
| **Memory Allocation** | Fixed **2 GB** with Fluid Compute | Sufficient for `@sparticuz/chromium` + 2-page PDF rendering. |
| **Serverless Bundle Size** | **250 MB** uncompressed limit | `@sparticuz/chromium@158.0.0` (~74.3 MB) + Next.js fits cleanly under 250 MB. |
| **Commercial Usage Restriction** | **Prohibited on Hobby** (Non-commercial personal projects only) | **Verified Compliance Blocker:** Running a commercial business ERP on Vercel Hobby violates Vercel Terms of Service. |

## 2. Recommended Alternatives for Commercial Production

1. **Vercel Pro (\$20/member/month):** Full commercial license, up to 300s/800s Fluid Compute, up to 4 GB memory, zero architecture changes.
2. **Dedicated Linux VPS / Docker (\$6–\$12/month):** Ubuntu VPS running `npm run start` behind Nginx/Caddy with native `google-chrome-stable` (`apt-get install`), zero 4.5 MB body limit, zero cold-start brotli inflation, and full commercial freedom.
