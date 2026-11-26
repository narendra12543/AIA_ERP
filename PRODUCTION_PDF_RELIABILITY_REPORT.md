# PRODUCTION PDF RELIABILITY REPORT

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`

## 1. Reliability Improvements Implemented

1. **Payload Size Reduction (>98%):** `POST /api/export-pdf` request payloads dropped from `~2.5+ MB` (Base64-inlined) to `12.4 KB – 32.5 KB`, eliminating Vercel 4.5 MB body limit rejections and mobile Safari upload drops (`Load failed`).
2. **Server-Side Asset Resolution & Caching:** Local `/assets/...` files (`logo.png`, `default_gate.png`) are resolved safely on the server and cached in `localAssetDataUrlCache` (bounded at 25 entries). Remote Cloudinary images are fetched with `5s` timeout and `redirect: "error"`.
3. **Browser Reuse & Crash Recovery:** `getOrLaunchBrowser()` reuses connected Chromium instances on warm containers and resets `cachedBrowser` on crash/disconnect so subsequent retries launch a clean browser.
4. **Single-Flight Lock & Controlled Retry:** Concurrent export clicks are deduplicated (`activeExportPromise`). Transient errors (`429`, `502`, `503`, `504`, network errors) retry up to **2 times** with `800ms` / `2000ms` backoff (respecting `Retry-After`). Auth/validation errors (`400`, `401`, `403`, `413`) and user cancellations (`AbortError`) never retry.
5. **Post-Validation Save As:** `showSaveFilePicker()` is invoked only *after* `/api/export-pdf` returns a structurally validated PDF Blob—preventing 0-byte empty files on disk when server generation fails. If transient user activation expired during a slow cold start, a clean 1-click **"PDF Ready to Save"** modal opens a fresh Save As gesture.

## 2. Remaining Production Risks

- Cold-start testing on the actual Vercel Hobby Lambda container (`@sparticuz/chromium` `74.9 MB` brotli inflation to `/tmp`) can only be measured after deploying this release to Vercel staging/production.
