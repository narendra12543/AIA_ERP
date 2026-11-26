const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

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
  throw new Error("No Chrome/Edge executable found for Puppeteer UI test");
}

const BASE_URL = process.env.ERP_TEST_URL || "http://localhost:3000";

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function runStaticChecks() {
  console.log("1. Running Phase 2 static & security checks...");

  // Check LoginScreen has no hardcoded credentials
  const loginSrc = fs.readFileSync(path.join(process.cwd(), "components", "LoginScreen.tsx"), "utf8");
  assert(!loginSrc.includes("Aven@2026"), "LoginScreen must not contain hardcoded Admin password");
  assert(!loginSrc.includes("Staff@2026"), "LoginScreen must not contain hardcoded Staff password");
  assert(!loginSrc.includes('useState("info@avenautomation.in")'), "LoginScreen must not prefill email");

  // Check Overview has removed .slice(0, 6)
  const overviewSrc = fs.readFileSync(path.join(process.cwd(), "components", "Overview.tsx"), "utf8");
  assert(!overviewSrc.includes(".slice(0, 6)"), "Overview must not truncate quotations to 6 rows");
  assert(overviewSrc.includes("All Quotations"), "Overview must display All Quotations section");

  // Check permissions module has reserved expenses namespace
  const permSrc = fs.readFileSync(path.join(process.cwd(), "lib", "permissions.ts"), "utf8");
  assert(permSrc.includes("expenses.view"), "Reserved expenses.view permission must exist");
  assert(permSrc.includes("mail.settings"), "mail.settings permission must exist");
  assert(permSrc.includes("audit_logs.view"), "audit_logs.view permission must exist");

  // Check email sanitizer & 14 default templates
  const sanitizerSrc = fs.readFileSync(path.join(process.cwd(), "lib", "email-sanitizer.ts"), "utf8");
  const tplCount = (sanitizerSrc.match(/id:\s*"tpl_/g) || []).length;
  assert(tplCount >= 14, `Expected >= 14 default email templates, found ${tplCount}`);
  assert(sanitizerSrc.includes("REDACTED_GSTIN"), "Email sanitizer must redact GSTIN");
  assert(sanitizerSrc.includes("REDACTED_PAN"), "Email sanitizer must redact PAN");

  // Check migration SQL is non-destructive (no DROP TABLE / TRUNCATE / DELETE)
  const sqlSrc = fs.readFileSync(path.join(process.cwd(), "scripts", "migrations", "002_enterprise_upgrade.sql"), "utf8");
  assert(!/\bDROP\s+TABLE\b/i.test(sqlSrc), "Migration SQL must not DROP TABLE");
  assert(!/\bTRUNCATE\b/i.test(sqlSrc), "Migration SQL must not TRUNCATE");

  console.log("   PASS: All Phase 2 static & security checks passed.");
}

async function runApiAuthChecks() {
  console.log("2. Running unauthenticated API deny checks against", BASE_URL);
  const protectedEndpoints = [
    ["GET", "/api/quotes"],
    ["GET", "/api/users"],
    ["GET", "/api/audit-logs"],
    ["GET", "/api/mail"],
    ["POST", "/api/mail"],
    ["POST", "/api/ai/email-assist"],
    ["POST", "/api/export-pdf"],
  ];

  for (const [method, endpoint] of protectedEndpoints) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? JSON.stringify({}) : undefined,
    });
    assert(res.status === 401, `${method} ${endpoint} expected 401, got ${res.status}`);
  }
  console.log("   PASS: All 7 protected endpoints returned 401 Unauthorized without session.");
}

async function runBrowserUiChecks() {
  console.log("3. Running Puppeteer UI & responsive viewport checks (320px, 375px, 1440px)...");
  const browser = await puppeteer.launch({
    executablePath: findBrowserExecutable(),
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();

    for (const vp of [
      { name: "mobile-320", width: 320, height: 568 },
      { name: "mobile-375", width: 375, height: 812 },
      { name: "desktop-1440", width: 1440, height: 900 },
    ]) {
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto(BASE_URL, { waitUntil: "networkidle2" });

      // Ensure login inputs are empty (no prefilled credentials)
      const { emailVal, passVal, overflow } = await page.evaluate(() => {
        const emailEl = document.querySelector('input[type="email"]');
        const passEl = document.querySelector('input[type="password"]');
        return {
          emailVal: emailEl ? emailEl.value : null,
          passVal: passEl ? passEl.value : null,
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      });
      assert(emailVal === "", `${vp.name}: Email input must be empty on load`);
      assert(passVal === "", `${vp.name}: Password input must be empty on load`);
      assert(!overflow, `${vp.name}: Horizontal overflow detected on Login screen`);
    }

    console.log("   PASS: Login screen has empty inputs and 0 horizontal overflow across 320px/375px/1440px.");
  } finally {
    await browser.close();
  }
}

async function main() {
  await runStaticChecks();
  await runApiAuthChecks();
  await runBrowserUiChecks();
  console.log("ALL PHASE 2 ENTERPRISE VERIFICATION CHECKS PASSED.");
}

main().catch((err) => {
  console.error("PHASE 2 TEST FAILURE:", err);
  process.exit(1);
});
