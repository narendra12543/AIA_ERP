const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

async function renderHeaderTest() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 850, height: 750, deviceScaleFactor: 2 });

  const logoPath = path.join(__dirname, "..", "public", "assets", "logo.png");
  let logoBase64 = "";
  if (fs.existsSync(logoPath)) {
    logoBase64 = fs.readFileSync(logoPath).toString("base64");
  }

  function renderHeaderHtml(title, hasTagline) {
    return `
    <div style="font-weight: bold; font-size: 13px; margin: 15px 0 6px 0; color: #333; text-transform: uppercase;">${title}:</div>
    <div style="width: 754px; background: #ffffff; border: 1px solid #000000; box-sizing: border-box;">
      <div style="display: flex; flex-direction: row; border-bottom: 1px solid #000000;">
        <!-- Left Company Information Block (Top-Aligned, Compact Letterhead) -->
        <div style="flex: 1; padding: 10px 12px; display: flex; gap: 14px; align-items: flex-start; justify-content: flex-start; border-right: 1px solid #000000; box-sizing: border-box; text-align: left;">
          <div style="width: 80px; flex-shrink: 0; align-self: flex-start;">
            <img src="data:image/png;base64,${logoBase64}" style="width: 80px; height: auto; max-height: 75px; object-fit: contain; display: block;" />
          </div>
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; align-items: flex-start; text-align: left; gap: 3px; line-height: 1.45; box-sizing: border-box;">
            <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.3px; color: #000000; line-height: 1.2;">
              AVEN INDUSTRIAL AUTOMATION
            </div>
            ${
              hasTagline
                ? '<div style="font-weight: 700; font-size: 9px; color: #222222; line-height: 1.25;">(A brand of SPARECONN SOLUTIONS PVT. LTD.)</div>'
                : ""
            }
            <div style="font-size: 9px; color: #222222;">
              Office Address:- Office No-03, Near Akurdi Railway Station, Tal- Haveli, Dist Pune- 411035
            </div>
            <div style="font-size: 9px; color: #222222;">
              Phone: 8766918892 &nbsp;|&nbsp; Email: sales@avenautomation.in
            </div>
            <div style="font-size: 9px; color: #222222;">
              GSTIN: <span style="font-family: monospace; font-weight: 700;">27ABLCS1425N1ZX</span> &nbsp;|&nbsp; PAN No: <span style="font-family: monospace; font-weight: 700;">ABLCS1425N</span>
            </div>
            <div style="font-size: 9px; color: #222222;">
              State: 27-Maharashtra
            </div>
          </div>
        </div>

        <!-- Right 5-row table -->
        <table style="width: 230px; font-size: 8px; font-weight: 600; border-collapse: collapse; border: none;">
          <tbody>
            <tr>
              <td style="width: 55%; padding: 2.5px 5px; border-right: 1px solid #000000; border-bottom: 1px solid #000000; vertical-align: middle;">
                <span style="font-size: 7px; display: block; color: #444;">Invoice No.</span>
                <strong style="font-size: 9px; font-family: monospace;">Sale Order 2627-02</strong>
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
    </div>
    `;
  }

  const fullHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { margin: 25px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #eaecf0; }
    </style>
  </head>
  <body>
    ${renderHeaderHtml("Compact Top-Aligned Letterhead (With Legal Entity)", true)}
    <br/>
    ${renderHeaderHtml("Compact Top-Aligned Letterhead (Without Legal Entity)", false)}
  </body>
  </html>
  `;

  await page.setContent(fullHtml, { waitUntil: "domcontentloaded" });
  const outPath = path.join(
    "C:\\Users\\user\\.gemini\\antigravity\\brain\\1e04822f-1daf-42d2-a597-54b342b78751",
    "header_compact_top_aligned.png"
  );
  await page.screenshot({ path: outPath, fullPage: true });
  console.log("Saved compact top-aligned header to:", outPath);
  await browser.close();
}

renderHeaderTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
