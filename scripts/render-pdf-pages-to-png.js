const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const ARTIFACTS_DIR = "C:/Users/user/.gemini/antigravity/brain/1e04822f-1daf-42d2-a597-54b342b78751";

async function renderVisualScreenshots() {
  console.log("=== RENDERING HIGH-RESOLUTION VISUAL EVIDENCE OF GENERATED DOCUMENTS ===");

  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1600,1200",
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 2 });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });

  // Login
  const loginInput = await page.waitForSelector('input[type="email"]', { timeout: 8000 }).catch(() => null);
  if (loginInput) {
    await page.evaluate(() => {
      const emailInp = document.querySelector('input[type="email"]');
      const passInp = document.querySelector('input[type="password"]');
      if (emailInp) emailInp.value = "sales@avenautomation.in";
      if (passInp) passInp.value = "admin123";
      const form = document.querySelector("form");
      if (form) form.requestSubmit();
    });
    await page.waitForSelector("#screen_app_root", { timeout: 15000 });
  }

  // Select Quote 114
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
  await new Promise((r) => setTimeout(r, 1200));

  // Set GSTIN on quote 114
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
  await new Promise((r) => setTimeout(r, 800));

  // 1. Capture Page 1 Technical
  console.log("1. Capturing Page 1 Technical...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim().includes("Page 1 (Technical)"));
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const page1El = await page.$(".a4-sheet");
  if (page1El) {
    await page1El.screenshot({
      path: path.join(ARTIFACTS_DIR, "verified_page1_technical.png"),
    });
    console.log("Saved verified_page1_technical.png");
  }

  // 2. Capture Page 2 Commercial Offer
  console.log("2. Capturing Page 2 Commercial Offer...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim().includes("Commercial Offer"));
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const page2El = await page.$(".a4-sheet");
  if (page2El) {
    await page2El.screenshot({
      path: path.join(ARTIFACTS_DIR, "verified_page2_commercial_offer.png"),
    });
    console.log("Saved verified_page2_commercial_offer.png");
  }

  // 3. Capture Proforma Invoice
  console.log("3. Capturing Proforma Invoice...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim().includes("Proforma Invoice"));
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const piEl = await page.$(".a4-sheet");
  if (piEl) {
    await piEl.screenshot({
      path: path.join(ARTIFACTS_DIR, "verified_proforma_invoice.png"),
    });
    console.log("Saved verified_proforma_invoice.png");
  }

  // 4. Capture Tax Invoice
  console.log("4. Capturing Tax Invoice...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim().includes("Tax Invoice"));
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const tiEl = await page.$(".a4-sheet");
  if (tiEl) {
    await tiEl.screenshot({
      path: path.join(ARTIFACTS_DIR, "verified_tax_invoice.png"),
    });
    console.log("Saved verified_tax_invoice.png");
  }

  // 5. Capture Purchase Order
  console.log("5. Capturing Purchase Order...");
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const tabBtn = buttons.find((b) => b.textContent.trim().includes("Purchase Order"));
    if (tabBtn) tabBtn.click();
  });
  await new Promise((r) => setTimeout(r, 800));
  const poEl = await page.$(".a4-sheet");
  if (poEl) {
    await poEl.screenshot({
      path: path.join(ARTIFACTS_DIR, "verified_purchase_order.png"),
    });
    console.log("Saved verified_purchase_order.png");
  }

  await browser.close();
  console.log("=== ALL VISUAL SCREENSHOTS COMPLETED SUCCESSFULLY ===");
}

renderVisualScreenshots().catch(console.error);
