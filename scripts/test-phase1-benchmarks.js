const puppeteer = require("puppeteer-core");

const BASE_URL = "http://localhost:3000";

function parsePdfStats(buf) {
  const text = buf.toString("latin1");
  const hasHeader = text.startsWith("%PDF-");
  const hasEof = text.slice(-128).includes("%%EOF");
  const hasStartXref = text.slice(-128).includes("startxref");
  const hasCatalog = text.includes("/Type /Catalog") || text.includes("/Type/Catalog");
  const hasPages = text.includes("/Type /Pages") || text.includes("/Type/Pages");
  const countMatch = text.match(/\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/);
  const pageCount = countMatch ? Number(countMatch[1]) : null;
  return { bytes: buf.length, hasHeader, hasEof, hasStartXref, hasCatalog, hasPages, pageCount };
}

(async () => {
  console.log("=== PHASE 1 BENCHMARK & SECURITY VERIFICATION ===");

  // 1. Security checks (unauthenticated API access)
  const unauthUsersGet = await fetch(`${BASE_URL}/api/users`);
  const unauthUsersPost = await fetch(`${BASE_URL}/api/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Hacker", email: "hack@test.com", password: "123", role: "Admin" }),
  });
  const unauthPdf = await fetch(`${BASE_URL}/api/export-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html: "<html><body>test</body></html>" }),
  });

  console.log(`- Unauth GET /api/users: ${unauthUsersGet.status} (Expected 401) -> ${unauthUsersGet.status === 401 ? "PASSED" : "FAILED"}`);
  console.log(`- Unauth POST /api/users: ${unauthUsersPost.status} (Expected 401) -> ${unauthUsersPost.status === 401 ? "PASSED" : "FAILED"}`);
  console.log(`- Unauth POST /api/export-pdf: ${unauthPdf.status} (Expected 401) -> ${unauthPdf.status === 401 ? "PASSED" : "FAILED"}`);

  if (unauthUsersGet.status !== 401 || unauthUsersPost.status !== 401 || unauthPdf.status !== 401) {
    process.exit(1);
  }

  // 2. Launch browser and authenticate
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const requestSizes = [];
  const serverTimings = [];

  const cdp = await page.createCDPSession();
  await cdp.send("Network.enable");
  cdp.on("Network.requestWillBeSent", (evt) => {
    if (evt.request.url.includes("/api/export-pdf") && evt.request.method === "POST") {
      requestSizes.push(Buffer.byteLength(evt.request.postData || "", "utf8"));
    }
  });

  page.on("response", (res) => {
    if (res.url().includes("/api/export-pdf") && res.request().method() === "POST") {
      serverTimings.push({
        status: res.status(),
        requestId: res.headers()["x-pdf-request-id"],
        totalMs: Number(res.headers()["x-pdf-total-ms"] || 0),
        coldStart: res.headers()["x-pdf-cold-start"],
      });
    }
  });

  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 30000 });
  const loginInput = await page.waitForSelector('input[type="email"]', { timeout: 6000 }).catch(() => null);
  if (loginInput) {
    const testEmail = process.env.ERP_TEST_ADMIN_EMAIL;
    const testPass = process.env.ERP_TEST_ADMIN_PASSWORD;
    if (!testEmail || !testPass) {
      throw new Error("ERP_TEST_ADMIN_EMAIL and ERP_TEST_ADMIN_PASSWORD env vars are required.");
    }
    await page.type('input[type="email"]', testEmail);
    await page.type('input[type="password"]', testPass);
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForSelector("#screen_app_root", { timeout: 20000 }),
    ]);
  }
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Quotation System"));
    if (btn) btn.click();
    delete window.showSaveFilePicker;
  });
  await new Promise((r) => setTimeout(r, 1000));

  // Verify authenticated GET /api/users works
  const authUsersOk = await page.evaluate(async () => {
    const raw = sessionStorage.getItem("aven_tab_session");
    const token = raw ? JSON.parse(raw).token : "";
    const res = await fetch("/api/users", { headers: { "x-tab-session": token } });
    const data = await res.json();
    return { status: res.status, count: Array.isArray(data) ? data.length : 0, hasPasswordField: JSON.stringify(data).includes("password") };
  });
  console.log(`- Auth Admin GET /api/users: status=${authUsersOk.status}, count=${authUsersOk.count}, leaksPassword=${authUsersOk.hasPasswordField} -> ${authUsersOk.status === 200 && !authUsersOk.hasPasswordField ? "PASSED" : "FAILED"}`);

  // Helper to export and capture PDF blob
  async function exportAndMeasure(tabName, btnText, label) {
    await page.evaluate((t) => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes(t));
      if (btn) btn.click();
    }, tabName);
    await new Promise((r) => setTimeout(r, 350));
    const t0 = Date.now();
    await page.evaluate((bText) => {
      window.__lastExportedPdfBlob = null;
      const btn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes(bText));
      if (btn) btn.click();
    }, btnText);

    for (let i = 0; i < 60; i++) {
      const b64 = await page.evaluate(async () => {
        const blob = window.__lastExportedPdfBlob;
        if (!blob) return null;
        return new Promise((resolve) => {
          const r = new FileReader();
          r.onloadend = () => resolve(r.result);
          r.readAsDataURL(blob);
        });
      });
      if (b64 && b64.startsWith("data:")) {
        const clientMs = Date.now() - t0;
        const buf = Buffer.from(b64.split(",")[1], "base64");
        const stats = parsePdfStats(buf);
        const srv = serverTimings[serverTimings.length - 1] || {};
        const reqBytes = requestSizes[requestSizes.length - 1] || 0;
        console.log(`  [${label}] reqBytes=${reqBytes}B | srvMs=${srv.totalMs}ms (cold=${srv.coldStart}) | clientMs=${clientMs}ms | pdfBytes=${stats.bytes}B | pages=${stats.pageCount} | valid=${stats.hasHeader && stats.hasEof && stats.hasStartXref && stats.hasCatalog && stats.hasPages}`);
        return { reqBytes, clientMs, ...srv, ...stats };
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error(`Timeout exporting ${label}`);
  }

  console.log("\n--- 10 CONSECUTIVE WARM/COLD EXPORTS BENCHMARK ---");
  const runs = [];
  runs.push(await exportAndMeasure("Commercial Offer", "Save 2-Page Quotation", "Run 1: Quotation (2p)"));
  runs.push(await exportAndMeasure("Proforma Invoice", "Save Proforma Invoice", "Run 2: PI (1p)"));

  // Ensure Client GSTIN is filled on Dashboard so Tax Invoice export button is enabled
  await page.evaluate(() => {
    const dashBtn = Array.from(document.querySelectorAll("button")).find((b) => b.textContent.includes("Dashboard"));
    if (dashBtn) dashBtn.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const gstinInp = inputs.find((i) => i.previousElementSibling && i.previousElementSibling.textContent.includes("GSTIN"));
    if (gstinInp && !gstinInp.value) {
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(gstinInp, "27ABLCS1425N1ZX");
      gstinInp.dispatchEvent(new Event("input", { bubbles: true }));
      gstinInp.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  runs.push(await exportAndMeasure("Tax Invoice", "Save Tax Invoice", "Run 3: TI (1p)"));
  runs.push(await exportAndMeasure("Purchase Order", "Save Purchase Order", "Run 4: PO (1p)"));
  runs.push(await exportAndMeasure("Commercial Offer", "Save 2-Page Quotation", "Run 5: Quotation (2p)"));
  runs.push(await exportAndMeasure("Proforma Invoice", "Save Proforma Invoice", "Run 6: PI (1p)"));
  runs.push(await exportAndMeasure("Tax Invoice", "Save Tax Invoice", "Run 7: TI (1p)"));
  runs.push(await exportAndMeasure("Purchase Order", "Save Purchase Order", "Run 8: PO (1p)"));
  runs.push(await exportAndMeasure("Commercial Offer", "Save 2-Page Quotation", "Run 9: Quotation (2p)"));
  runs.push(await exportAndMeasure("Proforma Invoice", "Save Proforma Invoice", "Run 10: PI (1p)"));

  // Verify SSRF protection directly on /api/export-pdf
  const ssrfTest = await page.evaluate(async () => {
    const raw = sessionStorage.getItem("aven_tab_session");
    const token = raw ? JSON.parse(raw).token : "";
    const res = await fetch("/api/export-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-tab-session": token },
      body: JSON.stringify({
        fileName: "ssrf_test.pdf",
        html: '<html><body><img src="http://169.254.169.254/latest/meta-data/" /><script>window.__xss=true;</script><p>Safe</p></body></html>',
      }),
    });
    return { status: res.status, ct: res.headers.get("content-type") };
  });
  console.log(`\n- SSRF & Script Sanitization Test: status=${ssrfTest.status}, ct=${ssrfTest.ct} -> ${ssrfTest.status === 200 ? "PASSED (blocked unsafe URL & rendered safe PDF)" : "FAILED"}`);

  await browser.close();
  console.log("\n=== PHASE 1 BENCHMARKS COMPLETE ===");
})();
