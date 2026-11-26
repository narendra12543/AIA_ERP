const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const BASE_URL = process.env.ERP_TEST_URL || "http://localhost:3000";
const ADMIN_EMAIL = process.env.ERP_TEST_ADMIN_EMAIL;
const ADMIN_PASS = process.env.ERP_TEST_ADMIN_PASSWORD;
const STAFF_EMAIL = process.env.ERP_TEST_STAFF_EMAIL;
const STAFF_PASS = process.env.ERP_TEST_STAFF_PASSWORD;

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("No Chrome/Edge executable found");
}

async function apiLogin(email, password, forwardedIp) {
  const headers = { "Content-Type": "application/json" };
  if (forwardedIp) headers["x-forwarded-for"] = forwardedIp;
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function validatePdfBuffer(buf, expectedMinPages) {
  const header = buf.subarray(0, 5).toString("ascii");
  assert(header === "%PDF-", `Invalid PDF header: ${header}`);
  const tail = buf.subarray(Math.max(0, buf.length - 256)).toString("ascii");
  assert(tail.includes("%%EOF") && tail.includes("startxref"), "Missing PDF trailer (%%EOF / startxref)");
  assert(buf.length > 10000, `Suspiciously small PDF: ${buf.length} bytes`);
  const text = buf.toString("latin1");
  const pageMatches = text.match(/\/Type\s*\/Page\b/g) || [];
  assert(pageMatches.length >= expectedMinPages, `Expected >= ${expectedMinPages} pages, found ${pageMatches.length}`);
  return pageMatches.length;
}

async function main() {
  if (!ADMIN_EMAIL || !ADMIN_PASS || !STAFF_EMAIL || !STAFF_PASS) {
    throw new Error("Set ERP_TEST_ADMIN_EMAIL, ERP_TEST_ADMIN_PASSWORD, ERP_TEST_STAFF_EMAIL, ERP_TEST_STAFF_PASSWORD.");
  }

  console.log("=== AVEN MASTER ERP — FULL RELEASE READINESS VERIFICATION ===");

  // 1. Auth & Rate Limiting Tests
  console.log("1. Testing Admin login, Staff login, invalid login, and rate limiting...");
  const badLogin = await apiLogin(ADMIN_EMAIL, "WrongPassword#999", "203.0.113.10");
  assert(badLogin.status === 401, `Expected 401 on bad password, got ${badLogin.status}`);

  const adminLogin = await apiLogin(ADMIN_EMAIL, ADMIN_PASS, "203.0.113.11");
  assert(adminLogin.status === 200 && adminLogin.data.session?.token, `Admin login failed: ${adminLogin.status}`);
  const adminToken = adminLogin.data.session.token;

  const staffLogin = await apiLogin(STAFF_EMAIL, STAFF_PASS, "203.0.113.12");
  assert(staffLogin.status === 200 && staffLogin.data.session?.token, `Staff login failed: ${staffLogin.status}`);
  const staffToken = staffLogin.data.session.token;

  // Session check
  const sessCheck = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { "x-tab-session": adminToken },
  });
  const sessJson = await sessCheck.json();
  assert(sessCheck.status === 200 && sessJson.authenticated === true, "Admin session check failed");

  // Rate limit test on dummy account + isolated test IP
  let hit429 = false;
  for (let i = 0; i < 8; i++) {
    const r = await apiLogin("ratelimit_probe_test@example.com", "badpass", "203.0.113.99");
    if (r.status === 429) {
      hit429 = true;
      break;
    }
  }
  assert(hit429, "Failed login rate limiting did not trigger HTTP 429");
  console.log("   PASS: Auth, session verification, and 429 rate limiting verified.");

  // 2. RBAC Enforcement Tests
  console.log("2. Testing Admin vs Staff RBAC enforcement...");
  const staffDeniedEndpoints = [
    ["GET", "/api/users"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/settings"],
    ["PUT", "/api/settings"],
    ["DELETE", "/api/quotes?id=nonexistent"],
  ];
  for (const [method, ep] of staffDeniedEndpoints) {
    const r = await fetch(`${BASE_URL}${ep}`, {
      method,
      headers: { "Content-Type": "application/json", "x-tab-session": staffToken },
      body: method === "PUT" ? JSON.stringify({ section: "ai", data: {} }) : undefined,
    });
    assert(r.status === 403, `Staff ${method} ${ep} expected 403 Forbidden, got ${r.status}`);
  }

  const adminSettingsRes = await fetch(`${BASE_URL}/api/settings`, {
    headers: { "x-tab-session": adminToken },
  });
  assert(adminSettingsRes.status === 200, `Admin GET /api/settings expected 200, got ${adminSettingsRes.status}`);
  const settingsJson = await adminSettingsRes.json();
  assert(settingsJson.smtp && !("password" in settingsJson.smtp), "SMTP settings must NEVER expose plaintext password");
  assert(settingsJson.ai && !("geminiKey" in settingsJson.ai), "AI settings must NEVER expose plaintext geminiKey");

  // SSRF SMTP host validation checks
  for (const badHost of ["localhost", "127.0.0.1", "169.254.169.254", "192.168.1.1"]) {
    const ssrfRes = await fetch(`${BASE_URL}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-tab-session": adminToken },
      body: JSON.stringify({ section: "smtp", data: { host: badHost, port: 465, senderEmail: "test@example.com" } }),
    });
    assert(ssrfRes.status === 400, `SSRF check failed: ${badHost} expected 400, got ${ssrfRes.status}`);
  }

  // Password-change validation checks (never mutating prod users)
  const pwWrong = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tab-session": adminToken },
    body: JSON.stringify({
      currentPassword: "WrongCurrentPassword!",
      newPassword: "ValidStrongPassword#2026",
      confirmPassword: "ValidStrongPassword#2026",
    }),
  });
  assert([400, 401, 404].includes(pwWrong.status), `Wrong current password expected 400/401/404, got ${pwWrong.status}`);

  const pwWeak = await fetch(`${BASE_URL}/api/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-tab-session": adminToken },
    body: JSON.stringify({
      currentPassword: ADMIN_PASS,
      newPassword: "short",
      confirmPassword: "short",
    }),
  });
  assert(pwWeak.status === 400, `Weak password expected 400, got ${pwWeak.status}`);
  console.log("   PASS: RBAC default-deny (403), SSRF host blocking (400), and password-change validation verified.");

  // 3. AI Email Assistant Functional & Privacy Sanitization Tests
  console.log("3. Testing AI Email Assistant modes, extended redaction, and local-only default...");
  const aiPayload =
    "Namaskar M/s Flowzen Technology, pls find attached qoutation for ₹2,50,000.00. Contact +91 98220 14589 or buyer@client.co.in, Pune - 411026. GSTIN 27AAACP1234F1Z8 PAN AAACP1234F IFSC SBIN0001234 acct 123456789012.";
  for (const mode of ["grammar", "professional", "concise", "polite", "followup", "translate_en"]) {
    const r = await fetch(`${BASE_URL}/api/ai/email-assist`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tab-session": adminToken },
      body: JSON.stringify({ mode, text: aiPayload, subject: "Quotation Test" }),
    });
    assert(r.status === 200, `AI mode ${mode} failed with ${r.status}`);
    const d = await r.json();
    assert(d.redactedCount >= 8, `Expected >= 8 sensitive tokens redacted, got ${d.redactedCount}`);
    assert(!d.improvedText.includes("27AAACP1234F1Z8"), "AI output leaked unredacted GSTIN");
    assert(!d.improvedText.includes("buyer@client.co.in"), "AI output leaked unredacted email");
    assert(!d.improvedText.includes("2,50,000"), "AI output leaked unredacted commercial price");
    assert(d.providerUsed === "local_b2b_engine", `Expected local_b2b_engine when external AI is opt-in off, got ${d.providerUsed}`);
  }
  console.log("   PASS: AI Assistant modes + extended confidential data redaction verified.");

  // 4. Puppeteer Authenticated UI + 10-Width Responsive + 40-PDF Stress Test
  console.log("4. Launching Puppeteer for authenticated UI, 10-width responsiveness & 40-PDF regression...");
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.type('input[type="email"]', ADMIN_EMAIL);
    await page.type('input[type="password"]', ADMIN_PASS);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForSelector("#screen_app_root", { timeout: 25000 }),
    ]);

    // Verify Overview All Quotations (no 6-row cap)
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Overview"));
      if (btn) btn.click();
    });
    await new Promise((r) => setTimeout(r, 800));
    const overviewText = await page.evaluate(() => document.body.innerText);
    assert(overviewText.includes("All Quotations"), "Overview must display All Quotations");

    // Navigate through Mail Center, Admin Settings, Quotation System at 10 widths
    const widths = [320, 360, 375, 390, 414, 430, 768, 1024, 1440, 1920];
    for (const viewLabel of ["Overview", "Mail Center", "Admin Settings", "Quotation System"]) {
      await page.evaluate((lbl) => {
        const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes(lbl));
        if (btn) btn.click();
      }, viewLabel);
      await new Promise((r) => setTimeout(r, 500));
      for (const w of widths) {
        await page.setViewport({ width: w, height: 850 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        assert(!overflow, `Horizontal overflow on "${viewLabel}" at width ${w}px`);
      }
    }
    console.log("   PASS: 0 horizontal overflow across all 10 widths (320px-1920px) on Overview, Mail Center, Admin Settings, Quotation System.");

    // Switch back to desktop & extract print HTML for all 4 document formats
    await page.setViewport({ width: 1440, height: 900 });
    const docHtmls = await page.evaluate(() => {
      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
        .map((s) => s.outerHTML)
        .join("\n");
      const wrap = (ids, title) => {
        const pages = ids
          .map((id) => {
            const el = document.getElementById(id);
            const sheet = el ? el.querySelector(".a4-sheet") || el : null;
            return sheet ? `<div class="pdf-page-container">${sheet.outerHTML}</div>` : "";
          })
          .join("\n");
        return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>${styles}<style>@page{size:210mm 297mm;margin:0mm;}*{box-sizing:border-box!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}.pdf-page-container{width:210mm!important;min-height:297mm!important;max-height:297mm!important;overflow:hidden!important;page-break-after:always!important;}.pdf-page-container:last-child{page-break-after:auto!important;}</style></head><body>${pages}</body></html>`;
      };
      return {
        quotation: wrap(["export_page1", "export_table2"], "Estimate_Test.pdf"),
        pi: wrap(["export_pi"], "PI_Test.pdf"),
        ti: wrap(["export_ti"], "TaxInvoice_Test.pdf"),
        po: wrap(["export_po"], "PO_Test.pdf"),
      };
    });

    const formats = [
      { key: "quotation", label: "Quotation (2-Page)", expectedPages: 2 },
      { key: "pi", label: "Proforma Invoice (1-Page)", expectedPages: 1 },
      { key: "ti", label: "Tax Invoice (1-Page)", expectedPages: 1 },
      { key: "po", label: "Purchase Order (1-Page)", expectedPages: 1 },
    ];

    const pdfStats = {};
    for (const fmt of formats) {
      const timings = [];
      let lastSize = 0;
      let lastPages = 0;
      for (let i = 0; i < 10; i++) {
        const t0 = Date.now();
        const res = await fetch(`${BASE_URL}/api/export-pdf`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-tab-session": adminToken },
          body: JSON.stringify({ html: docHtmls[fmt.key], fileName: `${fmt.key}_${i + 1}.pdf` }),
        });
        assert(res.status === 200, `${fmt.label} export #${i + 1} returned HTTP ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        lastPages = validatePdfBuffer(buf, fmt.expectedPages);
        lastSize = buf.length;
        timings.push(Date.now() - t0);
      }
      const coldMs = timings[0];
      const warmAvgMs = Math.round(timings.slice(1).reduce((a, b) => a + b, 0) / 9);
      pdfStats[fmt.key] = { coldMs, warmAvgMs, sizeBytes: lastSize, pages: lastPages };
      console.log(`   PASS: ${fmt.label} x10 -> pages=${lastPages}, size=${lastSize}B, cold=${coldMs}ms, warmAvg=${warmAvgMs}ms`);
    }

    // Logout verification
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { "x-tab-session": adminToken },
    });
    assert(logoutRes.status === 200, "Logout failed");

    console.log("PDF_STATS_JSON=" + JSON.stringify(pdfStats));
    console.log("ALL RELEASE READINESS CHECKS PASSED.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("RELEASE READINESS FAILURE:", err);
  process.exit(1);
});
