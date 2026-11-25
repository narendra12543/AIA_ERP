const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = "C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751";
const SCRATCH_DIR = path.join(ARTIFACTS_DIR, "scratch");
if (!fs.existsSync(SCRATCH_DIR)) {
  fs.mkdirSync(SCRATCH_DIR, { recursive: true });
}

async function runTest() {
  console.log("=== STARTING ACTUAL ERP UI SAVE PDF END-TO-END TEST ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1400,900",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 });

  page.on("console", (msg) => {
    const text = msg.text();
    if (!text.includes("React DevTools")) {
      console.log(`[BROWSER CONSOLE] ${text}`);
    }
  });

  page.on("dialog", async (dialog) => {
    console.log(`[BROWSER DIALOG] Type: ${dialog.type()}, Message: ${dialog.message()}`);
    await dialog.accept();
  });

  console.log("1. Navigating to http://localhost:3000...");
  await page.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 20000 });

  // 2. Perform Login
  console.log("2. Checking authentication state...");
  const loginInput = await page.waitForSelector('input[type="email"]', { timeout: 8000 }).catch(() => null);
  if (loginInput) {
    console.log("2b. Submitting login credentials (sales@avenautomation.in / admin123)...");
    await page.evaluate(() => {
      const emailInp = document.querySelector('input[type="email"]');
      const passInp = document.querySelector('input[type="password"]');
      if (emailInp) emailInp.value = "sales@avenautomation.in";
      if (passInp) passInp.value = "admin123";
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
    });
    await page.waitForSelector("#screen_app_root", { timeout: 15000 });
    console.log("2c. Successfully logged in! ERP Dashboard is visible.");
  } else {
    console.log("2b. Already authenticated.");
  }

  // Prevent headless OS file picker prompt so direct download logic completes
  await page.evaluate(() => {
    delete window.showSaveFilePicker;
  });

  // Helper to extract generated PDF blob directly from browser page memory
  async function waitForExportedPdf(expectedDocType, maxWaitSeconds = 45) {
    console.log(`Waiting up to ${maxWaitSeconds}s for ${expectedDocType} export...`);
    const startTime = Date.now();
    while ((Date.now() - startTime) < maxWaitSeconds * 1000) {
      const base64Data = await page.evaluate(() => {
        const blob = window.__lastExportedPdfBlob;
        if (!blob) return null;
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      });

      if (base64Data && typeof base64Data === "string" && base64Data.startsWith("data:")) {
        const matches = base64Data.match(/^data:.+;base64,(.+)$/);
        if (matches && matches[1]) {
          return Buffer.from(matches[1], "base64");
        }
      }
      await new Promise((r) => setTimeout(r, 600));
    }
    throw new Error(`Timeout waiting for ${expectedDocType} PDF export!`);
  }

  // 3. Select Quotation 26-27/AIA/114
  console.log("3. Selecting Quotation 26-27/AIA/114...");
  await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll("select"));
    for (const sel of selects) {
      const options = Array.from(sel.options);
      const match = options.find((opt) => opt.value.includes("114") || opt.text.includes("114"));
      if (match) {
        sel.value = match.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        break;
      }
    }
  });
  await new Promise((r) => setTimeout(r, 1500));

  const capturedDocuments = {};

  // 4. Test Export Quotation (PDF) - 2 Pages
  console.log("4. Triggering 'Save Quotation (PDF)' button in UI...");
  await page.evaluate(() => {
    window.__lastExportedPdfBlob = null;
    const buttons = Array.from(document.querySelectorAll("button"));
    const saveBtn = buttons.find(
      (b) =>
        b.textContent.includes("Save Quotation (PDF)") ||
        b.textContent.includes("Save 2-Page Quotation")
    );
    if (saveBtn) saveBtn.click();
    else console.error("Save Quotation button not found!");
  });

  const quoteBuffer = await waitForExportedPdf("Quotation (2 Pages)");
  capturedDocuments["Estimate_2627-AIA-114_05-09-2026.pdf"] = quoteBuffer;
  console.log(`Captured Quotation PDF: ${quoteBuffer.length} bytes`);

  // 5. Test Export Proforma Invoice (PDF) - 1 Page
  console.log("5. Switching to Proforma Invoice tab...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim() === "Proforma Invoice");
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("5b. Triggering 'Save Proforma Invoice (PDF)' button...");
  await page.evaluate(() => {
    window.__lastExportedPdfBlob = null;
    const buttons = Array.from(document.querySelectorAll("button"));
    const saveBtn = buttons.find(
      (b) =>
        b.textContent.includes("Save Proforma Invoice (PDF)") ||
        b.textContent.includes("Save PI (PDF)")
    );
    if (saveBtn) saveBtn.click();
    else console.error("Save PI button not found!");
  });

  const piBuffer = await waitForExportedPdf("Proforma Invoice (1 Page)");
  capturedDocuments["Sale_Order_2627-02_05-09-2026.pdf"] = piBuffer;
  console.log(`Captured Proforma Invoice PDF: ${piBuffer.length} bytes`);

  // 6. Test Tax Invoice: Ensure GSTIN is set then export - 1 Page
  console.log("6. Switching to Dashboard to enter Client GSTIN for Tax Invoice...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim() === "Dashboard");
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));

  await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const gstinInput = inputs.find((inp) => inp.placeholder && inp.placeholder.includes("27XXXXX"));
    if (gstinInput) {
      const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      nativeSetter.call(gstinInput, "27ABLCS1425N1ZX");
      gstinInput.dispatchEvent(new Event("input", { bubbles: true }));
      gstinInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("6b. Switching to Tax Invoice tab...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim() === "Tax Invoice");
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("6c. Triggering 'Save Tax Invoice (PDF)' button...");
  await page.evaluate(() => {
    window.__lastExportedPdfBlob = null;
    const buttons = Array.from(document.querySelectorAll("button"));
    const saveBtn = buttons.find(
      (b) =>
        b.textContent.includes("Save Tax Invoice (PDF)") ||
        b.textContent.includes("Save TI (PDF)")
    );
    if (saveBtn) saveBtn.click();
    else console.error("Save TI button not found!");
  });

  const tiBuffer = await waitForExportedPdf("Tax Invoice (1 Page)");
  capturedDocuments["Tax_Invoice_2026-27-AIA-002_05-09-2026.pdf"] = tiBuffer;
  console.log(`Captured Tax Invoice PDF: ${tiBuffer.length} bytes`);

  // 7. Test Purchase Order - 1 Page
  console.log("7. Switching to Purchase Order tab...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim() === "Purchase Order");
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));

  console.log("7b. Triggering 'Save Purchase Order (PDF)' button...");
  await page.evaluate(() => {
    window.__lastExportedPdfBlob = null;
    const buttons = Array.from(document.querySelectorAll("button"));
    const saveBtn = buttons.find(
      (b) =>
        b.textContent.includes("Save Purchase Order (PDF)") ||
        b.textContent.includes("Save PO (PDF)")
    );
    if (saveBtn) saveBtn.click();
    else console.error("Save PO button not found!");
  });

  const poBuffer = await waitForExportedPdf("Purchase Order (1 Page)");
  capturedDocuments["Purchase_Order_PO-2026-011_05-09-2026.pdf"] = poBuffer;
  console.log(`Captured Purchase Order PDF: ${poBuffer.length} bytes`);

  await browser.close();

  // 8. Analyze all captured PDFs
  console.log("\n=======================================================");
  console.log("=== COMPREHENSIVE VERIFICATION OF CAPTURED REAL ERP PDFS ===");
  console.log("=======================================================");
  const fileNames = Object.keys(capturedDocuments);
  console.log(`Total PDF documents captured: ${fileNames.length}`);

  const results = {};

  for (const fn of fileNames) {
    const buf = capturedDocuments[fn];
    const outPath = path.join(SCRATCH_DIR, fn);
    fs.writeFileSync(outPath, buf);

    // Copy to root artifacts dir
    const artifactPdfPath = path.join(ARTIFACTS_DIR, fn);
    fs.writeFileSync(artifactPdfPath, buf);

    const str = buf.toString("latin1");
    const isPdf = str.startsWith("%PDF-");
    const versionMatch = str.match(/%PDF-([0-9.]+)/);
    const version = versionMatch ? versionMatch[1] : "unknown";

    const producerMatch = str.match(/\/Producer\s*\(([^)]+)\)/);
    const creatorMatch = str.match(/\/Creator\s*\(([^)]+)\)/);
    const producer = producerMatch ? producerMatch[1] : "Unknown";
    const creator = creatorMatch ? creatorMatch[1] : "Unknown";

    const pageMatches = str.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 1;

    const fontMatches = str.match(/\/Type\s*\/Font\b/g);
    const fontCount = fontMatches ? fontMatches.length : 0;

    const isRaster = producer.includes("jsPDF") || str.includes("html2canvas");
    const isNativeChromium = producer.includes("Chromium") || producer.includes("Skia") || creator.includes("Chromium");

    results[fn] = {
      sizeBytes: buf.length,
      sizeKb: (buf.length / 1024).toFixed(1),
      isPdf,
      version,
      producer,
      creator,
      pageCount,
      fontCount,
      isNativeChromium,
      isRaster,
      hasSelectableText: fontCount > 0,
      path: outPath,
    };

    console.log(`\nDocument: ${fn}`);
    console.log(`- File Size: ${(buf.length / 1024).toFixed(1)} KB`);
    console.log(`- PDF Specification: %PDF-${version}`);
    console.log(`- Producer Engine: ${producer}`);
    console.log(`- Creator Engine: ${creator}`);
    console.log(`- Exact Page Count: ${pageCount}`);
    console.log(`- Embedded Font Objects: ${fontCount}`);
    console.log(`- Native Vector Architecture: ${isNativeChromium ? "PASSED (Chromium Vector)" : "CHECK"}`);
    console.log(`- Zero Raster Regression: ${!isRaster ? "PASSED (No jsPDF/html2canvas)" : "FAILED"}`);
  }

  // Save report JSON
  fs.writeFileSync(
    path.join(SCRATCH_DIR, "pdf_verification_results.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("\nResults successfully saved to pdf_verification_results.json");
  return results;
}

runTest().catch((err) => {
  console.error("FATAL ERROR IN TEST:", err);
  process.exit(1);
});
