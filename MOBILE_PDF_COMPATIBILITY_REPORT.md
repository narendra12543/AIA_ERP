# MOBILE PDF COMPATIBILITY REPORT

**Date:** 26 November 2026  
**Workspace:** `D:\Project\AIA_ERP`

## 1. Root Cause of iPhone Safari `"PDF Export Failed: Load failed"`

- Sending `2.5+ MB` Base64 HTML payloads over mobile networks to Vercel's `4.5 MB` serverless limit caused connection aborts on iOS WebKit (`TypeError: Load failed`).
- Premature `URL.revokeObjectURL()` (`2000ms` timeout) could revoke Blob URLs before iOS Safari / Android Chrome finished opening or saving the file.

## 2. Mobile Compatibility Fixes Implemented

1. **Lightweight Payloads (`12 KB – 32 KB`):** Eliminated client-side Base64 image conversion, reducing upload payload size by `>92–98%`.
2. **Transient Retry on Mobile Network Drops:** Automatically retries up to 2 times with exponential backoff (`800ms`, `2000ms`) on `"Load failed"` / `"Failed to fetch"` / `502`/`503`/`504`.
3. **Capability-Based Save Flow:**
   - Desktop Chrome/Edge (`"showSaveFilePicker" in window`): Opens native **Save As** folder picker after PDF validation (with 1-click Save As modal fallback if transient activation expired).
   - Mobile Safari / iPhone Chrome / Android Chrome: Triggers `<a download>` with `60,000 ms` (`60s`) Blob URL lifetime so iOS "Save to Files" / Android Download Manager completes reliably without blank tabs.

## 3. Testing Scope Distinction

- **Locally Verified:** Multi-viewport responsive checks (`320px`, `375px`, `414px`, `768px`, `1440px`) passed with `0` horizontal overflow in headless Chromium.
- **Physical Device Testing Pending:** Actual physical iPhone Safari, iPhone Chrome, and Android Chrome export tests on `https://erp.avenautomation.in` must be executed after deploying Phase 1.
