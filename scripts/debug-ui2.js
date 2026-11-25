const puppeteer = require("puppeteer-core");

async function test() {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

  page.on("request", (req) => {
    if (req.url().includes("/api/auth/login")) {
      console.log("LOGIN REQ:", req.method(), req.postData());
    }
  });

  page.on("response", async (res) => {
    if (res.url().includes("/api/auth/login")) {
      console.log("LOGIN RES:", res.status(), await res.text());
    }
  });

  await page.goto("http://localhost:3000", { waitUntil: "networkidle2" });
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });

  console.log("Triggering form submit directly from browser context...");
  const submitRes = await page.evaluate(async () => {
    const form = document.querySelector("form");
    if (!form) return "NO_FORM";
    form.requestSubmit();
    return "SUBMITTED";
  });
  console.log("Submit result:", submitRes);

  await new Promise((r) => setTimeout(r, 3000));

  const text = await page.evaluate(() => document.body.innerText);
  console.log("Body text snippet after login:", text.slice(0, 300));

  await browser.close();
}

test().catch(console.error);
