const puppeteer = require("puppeteer-core");

async function test() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("BROWSER LOG:", msg.text()));

  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  console.log("Waiting for email input...");
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  console.log("Email input found! Logging in...");

  await page.type('input[type="email"]', "sales@avenautomation.in");
  await page.type('input[type="password"]', "admin123");
  await page.click('button[type="submit"]');

  console.log("Waiting for Dashboard...");
  await page.waitForSelector('button:has-text("Save Quotation (PDF)")', { timeout: 10000 }).catch(async () => {
    // fallback if :has-text not supported in waitForSelector
    await page.waitForFunction(() => {
      const btns = Array.from(document.querySelectorAll("button"));
      return btns.some((b) => b.textContent.includes("Save Quotation"));
    }, { timeout: 10000 });
  });

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll("button")).map((b) => b.textContent.trim());
  });
  console.log("Buttons found count:", buttons.length);
  console.log("Sample buttons:", buttons.filter(b => b.includes("Save")));

  await browser.close();
  console.log("SUCCESS!");
}

test().catch(console.error);
