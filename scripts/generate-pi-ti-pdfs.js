const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

async function generateSamplePdfs() {
  console.log("Starting PI & TI PDF and Screenshot Generation...");
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const logoPath = path.join(__dirname, "..", "public", "assets", "logo.png");
  let logoBase64 = "";
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  }

  function getDocumentHtml(isPI) {
    const docTitle = isPI ? "PROFORMA INVOICE" : "TAX INVOICE";
    const docNoLabel = "Invoice No.";
    const docNoVal = isPI ? "Sale Order 2627-02" : "2026-27-AIA-002";

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 0; }
        body { margin: 0; padding: 20px 20px 10px 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #000000; box-sizing: border-box; }
        .document-wrapper { width: 754px; margin: 0 auto; background: #ffffff; }
        .title-bar { text-align: right; padding: 0 0 4px 0; }
        .title-text { font-size: 15px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
        .outer-box { border: 1px solid #000000; box-sizing: border-box; background: #ffffff; }
        table { border-collapse: collapse; }
      </style>
    </head>
    <body>
      <div class="document-wrapper">
        <div class="title-bar">
          <span class="title-text">${docTitle}</span>
        </div>

        <div class="outer-box">
          <!-- 1. Header Row -->
          <div id="header-row" style="display: flex; flex-direction: row; border-bottom: 1px solid #000000;">
            <!-- Left Company Block: Top-Aligned Compact Letterhead -->
            <div style="flex: 1; padding: 10px 12px; display: flex; gap: 14px; align-items: flex-start; justify-content: flex-start; border-right: 1px solid #000000; box-sizing: border-box; text-align: left;">
              <div style="width: 80px; flex-shrink: 0; align-self: flex-start;">
                <img src="data:image/png;base64,${logoBase64}" style="width: 80px; height: auto; max-height: 75px; object-fit: contain; display: block;" />
              </div>
              <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; text-align: left; gap: 3px; line-height: 1.45; box-sizing: border-box;">
                <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; color: #000000; line-height: 1.2;">
                  AVEN INDUSTRIAL AUTOMATION
                </div>
                <div style="font-weight: 700; font-size: 9px; color: #222222; line-height: 1.25;">
                  (A brand of SPARECONN SOLUTIONS PVT. LTD.)
                </div>
                <div style="font-size: 9px; color: #222222;">
                  Office Address:- Office No-03, Near Akurdi Railway Station, Tal- Haveli, Dist Pune- 411035
                </div>
                <div style="font-size: 9px; color: #222222;">
                  Phone: 8766918892 &nbsp;|&nbsp; Email: sales@avenautomation.in
                </div>
                <div style="font-size: 9px; color: #222222; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
                  <div>GSTIN: <span style="font-family: monospace; font-weight: 700;">27ABLCS1425N1ZX</span></div>
                  <div style="color: #888888;">|</div>
                  <div>PAN No: <span style="font-family: monospace; font-weight: 700;">ABLCS1425N</span></div>
                  <div style="color: #888888;">|</div>
                  <div>State: 27-Maharashtra</div>
                </div>
              </div>
            </div>

            <!-- Right 5-row table -->
            <table style="width: 230px; font-size: 8px; font-weight: 600; border-collapse: collapse; border: none;">
              <tbody>
                <tr>
                  <td style="width: 55%; padding: 2.5px 5px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">${docNoLabel}</span>
                    <strong style="font-size: 9px; font-family: monospace;">${docNoVal}</strong>
                  </td>
                  <td style="width: 45%; padding: 2.5px 5px; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Date</span>
                    <strong style="font-size: 8.5px; font-family: monospace;">05-09-2026</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 5px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Place of Supply</span>
                    <span style="font-size: 8px;">27-Maharashtra</span>
                  </td>
                  <td style="padding: 2.5px 5px; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Due Date</span>
                    <span style="font-size: 8px; font-family: monospace;">-</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 5px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">PO Date</span>
                    <span style="font-size: 8px; font-family: monospace;">05-09-2026</span>
                  </td>
                  <td style="padding: 2.5px 5px; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">PO Number</span>
                    <span style="font-size: 8px; font-family: monospace;">-</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 5px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Transport Name</span>
                    <span style="font-size: 8px;">-</span>
                  </td>
                  <td style="padding: 2.5px 5px; border-bottom: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Vehicle Number</span>
                    <span style="font-size: 8px; font-family: monospace;">-</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 2.5px 5px; border-right: 1px solid #000000; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Delivery Date</span>
                    <span style="font-size: 8px; font-family: monospace;">-</span>
                  </td>
                  <td style="padding: 2.5px 5px; vertical-align: middle;">
                    <span style="font-size: 7px; display: block; color: #444;">Payment Terms</span>
                    <span style="font-size: 8px; font-weight: bold;">Advance</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. Bill To & Ship To Row -->
          <div style="display: flex; flex-direction: row; border-bottom: 1px solid #000000; min-height: 65px;">
            <div style="flex: 1; padding: 6px 10px; border-right: 1px solid #000000; font-size: 8.5px; line-height: 1.35;">
              <span style="font-size: 7.5px; font-weight: bold; color: #444; display: block; margin-bottom: 2px;">BILL TO :</span>
              <div style="font-weight: bold; font-size: 9.5px; color: #000;">Company Name: Flowzen Technology</div>
              <div>Address: Talawade Pune.</div>
              <div>GSTIN: <span style="font-family: monospace;">27AAAAA0000A1Z5</span></div>
              <div>Contact No : 9270779095 | Email: sales@flowzentech.com</div>
            </div>
            <div style="width: 230px; padding: 6px 10px; font-size: 8.5px; line-height: 1.35;">
              <span style="font-size: 7.5px; font-weight: bold; color: #444; display: block; margin-bottom: 2px;">SHIP TO :</span>
              <div>Talawade Pune.</div>
            </div>
          </div>

          <!-- 3. Items Table -->
          <table style="width: 100%; font-size: 8px; border-collapse: collapse; border: none;">
            <thead>
              <tr style="background: #000000; color: #ffffff; font-weight: bold; text-align: center; height: 22px;">
                <th style="width: 28px; padding: 0; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">#</th>
                <th style="text-align: left; padding: 0 8px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Item name</th>
                <th style="width: 72px; padding: 0; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">HSN/ SAC</th>
                <th style="width: 90px; padding: 0; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Size(mm)</th>
                <th style="width: 48px; padding: 0; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Quantity</th>
                <th style="width: 42px; padding: 0; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Unit</th>
                <th style="width: 80px; text-align: right; padding: 0 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Price/ Unit</th>
                <th style="width: 95px; text-align: right; padding: 0 8px; border-bottom: 1px solid #000000; vertical-align: middle;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align: center; font-weight: bold; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">1</td>
                <td style="text-align: left; padding: 4px 8px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                  <strong>Inclined Belt Conveyor with Horizontal Discharge</strong><br/>
                  <span style="font-size: 7.5px; color: #444;">• Incline Length - 3200 mm | Horizontal Length - 1000 mm | Width - 600 mm</span>
                </td>
                <td style="text-align: center; font-family: monospace; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">84282011</td>
                <td style="text-align: center; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">3.2x0.6</td>
                <td style="text-align: center; font-weight: bold; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">1</td>
                <td style="text-align: center; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">NOS</td>
                <td style="text-align: right; font-family: monospace; padding: 4px 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">₹ 2,56,000.00</td>
                <td style="text-align: right; font-family: monospace; font-weight: bold; padding: 4px 8px; border-bottom: 1px solid #000000; vertical-align: middle;">₹ 2,56,000.00</td>
              </tr>
              <tr style="font-weight: bold; background: #ffffff;">
                <td colspan="4" style="text-align: left; padding: 4px 8px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">Total</td>
                <td style="text-align: center; padding: 4px 2px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">1</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000;"></td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000;"></td>
                <td style="text-align: right; font-family: monospace; padding: 4px 8px; border-bottom: 1px solid #000000; vertical-align: middle;">₹ 2,56,000.00</td>
              </tr>
            </tbody>
          </table>

          <!-- 4. Amount in Words & Totals Box -->
          <div style="display: flex; flex-direction: row; border-bottom: 1px solid #000000; box-sizing: border-box;">
            <div style="flex: 1; padding: 6px 10px; border-right: 1px solid #000000; font-size: 8.5px; line-height: 1.35;">
              <div style="margin-bottom: 4px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #333; display: block;">INVOICE AMOUNT IN WORDS</span>
                <span style="font-weight: 700; font-style: italic; font-size: 9px;">Rupees Three Lakh Two Thousand Eighty Only</span>
              </div>
              <div style="margin-top: 4px;">
                <span style="font-weight: 800; text-transform: uppercase; font-size: 8px; color: #333; display: block; margin-bottom: 2px;">TERMS & CONDITIONS:</span>
                <p style="margin: 2px 0;">• Goods once sold will not be taken back or exchanged.</p>
                <p style="margin: 2px 0;">• Payment Terms: Advance</p>
                <p style="margin: 2px 0;">• Subject to Pune jurisdiction only.</p>
              </div>
            </div>

            <div style="width: 250px; font-size: 8.5px;">
              <div style="background: #000000; color: #ffffff; font-weight: bold; text-align: center; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 8.5px;">
                Amounts
              </div>
              <table style="width: 100%; font-size: 8.5px; border-collapse: collapse; border: none;">
                <tbody>
                  <tr>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #000000;">Sub Total</td>
                    <td style="text-align: right; font-family: monospace; padding: 4px 8px; border-bottom: 1px solid #000000;">₹ 2,56,000.00</td>
                  </tr>
                  <tr>
                    <td style="padding: 3.5px 8px; border-bottom: 1px solid #000000;">CGST (9.0%)</td>
                    <td style="text-align: right; font-family: monospace; padding: 3.5px 8px; border-bottom: 1px solid #000000;">₹ 23,040.00</td>
                  </tr>
                  <tr>
                    <td style="padding: 3.5px 8px; border-bottom: 1px solid #000000;">SGST (9.0%)</td>
                    <td style="text-align: right; font-family: monospace; padding: 3.5px 8px; border-bottom: 1px solid #000000;">₹ 23,040.00</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 8px; border-bottom: 1px solid #000000;">Round off</td>
                    <td style="text-align: right; font-family: monospace; padding: 4px 8px; border-bottom: 1px solid #000000;">+₹ 0.00</td>
                  </tr>
                  <tr style="font-weight: bold;">
                    <td style="padding: 4px 8px; font-size: 9.5px; border-bottom: ${isPI ? "1px solid #000000" : "none"};">Total</td>
                    <td style="text-align: right; font-family: monospace; padding: 4px 8px; font-size: 9.5px; border-bottom: ${isPI ? "1px solid #000000" : "none"};">₹ 3,02,080.00</td>
                  </tr>
                  ${isPI ? `
                  <tr>
                    <td style="padding: 3.5px 8px; border-bottom: 1px solid #000000;">Advance</td>
                    <td style="text-align: right; font-family: monospace; padding: 3.5px 8px; border-bottom: 1px solid #000000;">₹ 0.00</td>
                  </tr>
                  <tr style="font-weight: bold;">
                    <td style="padding: 3.5px 8px; border-bottom: none;">Balance</td>
                    <td style="text-align: right; font-family: monospace; padding: 3.5px 8px; border-bottom: none;">₹ 3,02,080.00</td>
                  </tr>` : ""}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 5. HSN Tax Table -->
          <table style="font-size: 8.5px; border-collapse: collapse; width: 100%; border: none; background: #ffffff;">
            <thead>
              <tr style="background: #ffffff; text-align: center; font-weight: bold;">
                <th rowspan="2" style="width: 15%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; vertical-align: middle; height: 38px;">HSN/ SAC</th>
                <th rowspan="2" style="width: 21%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; vertical-align: middle; height: 38px;">Taxable amount</th>
                <th colspan="2" style="width: 22%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; vertical-align: middle; height: 19px;">CGST</th>
                <th colspan="2" style="width: 22%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; vertical-align: middle; height: 19px;">SGST</th>
                <th rowspan="2" style="width: 20%; border-bottom: 1px solid #000000; padding: 0; vertical-align: middle; height: 38px;">Total Tax Amount</th>
              </tr>
              <tr style="background: #ffffff; text-align: center; font-size: 8.5px;">
                <th style="width: 7%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; height: 19px;">Rate</th>
                <th style="width: 15%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; height: 19px;">Amount</th>
                <th style="width: 7%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; height: 19px;">Rate</th>
                <th style="width: 15%; border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 0; height: 19px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr style="text-align: center; font-size: 8.5px; background: #ffffff;">
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 2px;">84282011</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 6px; text-align: right; font-family: monospace;">₹ 2,56,000.00</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 2px;">9.0%</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 6px; text-align: right; font-family: monospace;">₹ 23,040.00</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 2px;">9.0%</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000; padding: 4px 6px; text-align: right; font-family: monospace;">₹ 23,040.00</td>
                <td style="border-bottom: 1px solid #000000; padding: 4px 6px; text-align: right; font-family: monospace; font-weight: bold;">₹ 46,080.00</td>
              </tr>
              <tr style="font-weight: bold; background: #ffffff;">
                <td style="text-align: left; padding: 4px 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000;">Total</td>
                <td style="text-align: right; font-family: monospace; padding: 4px 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000;">₹ 2,56,000.00</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000;"></td>
                <td style="text-align: right; font-family: monospace; padding: 4px 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000;">₹ 23,040.00</td>
                <td style="border-right: 1px solid #000000; border-bottom: 1px solid #000000;"></td>
                <td style="text-align: right; font-family: monospace; padding: 4px 6px; border-right: 1px solid #000000; border-bottom: 1px solid #000000;">₹ 23,040.00</td>
                <td style="text-align: right; font-family: monospace; padding: 4px 6px; border-bottom: 1px solid #000000;">₹ 46,080.00</td>
              </tr>
            </tbody>
          </table>

          <!-- 6. Bank Details Box -->
          <div style="display: flex; flex-direction: row; min-height: 80px;">
            <div style="flex: 1; padding: 6px 10px; border-right: 1px solid #000000; font-size: 8.5px; line-height: 1.35;">
              <span style="font-weight: bold; color: #000; display: block; margin-bottom: 2px;">Company Bank Details :</span>
              <div>Bank Name: <strong>THE COSMOS CO OPERATIVE BANK LTD</strong></div>
              <div>A/c No: <strong style="font-family: monospace;">011050102604</strong></div>
              <div>Branch: <strong>Akurdi</strong></div>
              <div>IFSC Code: <strong style="font-family: monospace;">COSB0000011</strong></div>
            </div>
            <div style="width: 250px; padding: 6px 10px; text-align: center; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="font-size: 8.5px; font-weight: bold; color: #000;">For AVEN INDUSTRIAL AUTOMATION</div>
              <div style="font-size: 8px; color: #666; margin-top: 25px;">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  const brainDir = "C:\\Users\\user\\.gemini\\antigravity\\brain\\1e04822f-1daf-42d2-a597-54b342b78751";

  // 1. Render PI
  const page1 = await browser.newPage();
  await page1.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page1.setContent(getDocumentHtml(true), { waitUntil: "domcontentloaded" });
  await page1.screenshot({ path: path.join(brainDir, "pi_full_preview.png"), fullPage: true });
  const h1 = await page1.$("#header-row");
  if (h1) await h1.screenshot({ path: path.join(brainDir, "header_pi_verified.png") });
  await page1.pdf({
    path: path.join(brainDir, "Sample_Proforma_Invoice.pdf"),
    format: "A4",
    printBackground: true,
  });
  await page1.close();
  console.log("PI Screenshot and PDF successfully generated.");

  // 2. Render TI
  const page2 = await browser.newPage();
  await page2.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
  await page2.setContent(getDocumentHtml(false), { waitUntil: "domcontentloaded" });
  await page2.screenshot({ path: path.join(brainDir, "ti_full_preview.png"), fullPage: true });
  const h2 = await page2.$("#header-row");
  if (h2) await h2.screenshot({ path: path.join(brainDir, "header_ti_verified.png") });
  await page2.pdf({
    path: path.join(brainDir, "Sample_Tax_Invoice.pdf"),
    format: "A4",
    printBackground: true,
  });
  await page2.close();
  console.log("TI Screenshot and PDF successfully generated.");

  await browser.close();
  console.log("All sample PDFs and previews successfully generated!");
}

generateSamplePdfs().catch((e) => {
  console.error("PDF generation error:", e);
  process.exit(1);
});
