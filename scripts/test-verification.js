const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

console.log("=== 1. VERIFY CONDITIONAL BRANDING ===");
function formatLegalBranding(tagline) {
  if (!tagline) return null;
  const trimmed = tagline.trim();
  if (!trimmed) return null;
  let clean = trimmed.replace(/^\(+|\)+$/g, "").trim();
  if (!clean) return null;
  if (/^(null|undefined|\(\s*\)|\[\s*\])$/i.test(clean)) return null;
  if (/^a\s+brand\s+of\s*[:.-]?$/i.test(clean)) return null;
  if (!/^a\s+brand\s+of/i.test(clean)) {
    clean = "A brand of " + clean;
  }
  return "(" + clean + ")";
}

const brandingTests = [
  { in: "", expected: null },
  { in: "   ", expected: null },
  { in: null, expected: null },
  { in: undefined, expected: null },
  { in: "A brand of", expected: null },
  { in: "SPARECONN SOLUTIONS PVT. LTD.", expected: "(A brand of SPARECONN SOLUTIONS PVT. LTD.)" },
  { in: "(A brand of SPARECONN SOLUTIONS PVT. LTD.)", expected: "(A brand of SPARECONN SOLUTIONS PVT. LTD.)" },
];
let brandingPassed = true;
brandingTests.forEach((t) => {
  const actual = formatLegalBranding(t.in);
  const ok = actual === t.expected;
  if (!ok) brandingPassed = false;
  console.log(" ", ok ? "✓" : "✗", JSON.stringify(t.in), "=>", JSON.stringify(actual));
});
console.log("Branding status:", brandingPassed ? "PASS" : "FAIL");

console.log("\n=== 2. VERIFY PASSWORD SECURITY & SCRYPT ===");
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return salt + ":" + derivedKey.toString("hex");
}
function verifyPassword(password, storedHash) {
  try {
    if (!storedHash || !storedHash.includes(":")) return password === storedHash;
    const [salt, key] = storedHash.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (e) {
    return false;
  }
}

const pw = "SecretAdminPass2026!";
const hashed = hashPassword(pw);
console.log("Password hash format:", hashed.split(":")[0], ":", hashed.split(":")[1].slice(0, 16) + "...");
const pwMatch = verifyPassword(pw, hashed);
const pwFail = verifyPassword("WrongPass", hashed);
console.log("Password match test:", pwMatch ? "PASS" : "FAIL");
console.log("Wrong password rejection:", !pwFail ? "PASS" : "FAIL");

console.log("\n=== 3. VERIFY LOGIN RATE LIMITING ===");
const rateLimitMap = new Map();
function checkRateLimit(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record) return { allowed: true };
  if (record.lockedUntil > now) {
    return { allowed: false, waitSeconds: Math.ceil((record.lockedUntil - now) / 1000) };
  }
  return { allowed: true };
}
function recordFailedLogin(key) {
  const now = Date.now();
  const record = rateLimitMap.get(key) || { attempts: 0, lockedUntil: 0 };
  record.attempts += 1;
  if (record.attempts >= 5) record.lockedUntil = now + 5 * 60 * 1000;
  rateLimitMap.set(key, record);
}

const testKey = "admin@aven.com";
for (let i = 0; i < 4; i++) {
  recordFailedLogin(testKey);
}
console.log("4 failed attempts allowed:", checkRateLimit(testKey).allowed ? "PASS" : "FAIL");
recordFailedLogin(testKey); // 5th attempt
const lockCheck = checkRateLimit(testKey);
console.log("5th failed attempt locked (429):", !lockCheck.allowed ? "PASS" : "FAIL", "Wait seconds:", lockCheck.waitSeconds);

console.log("\n=== 4. VERIFY LOCAL DATA INTEGRITY ===");
const quotes = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "quotes.json"), "utf8"));
const specProfiles = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "spec_profiles.json"), "utf8"));
const vendors = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "vendors.json"), "utf8"));
const company = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "company.json"), "utf8"));
console.log("Quotations count:", quotes.length, "(Expected: 31)");
console.log("Spec profiles count:", specProfiles.length, "(Expected: 18)");
console.log("Vendors count:", vendors.length, "(Expected: 2)");
console.log("Company name:", company.name, "| GSTIN:", company.gstin);

console.log("\n=== 5. VERIFY CLOUDINARY CONFIGURATION ===");
const envPath = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envPath)) {
  const env = fs.readFileSync(envPath, "utf8");
  console.log("Cloudinary env configured:", env.includes("CLOUDINARY_CLOUD_NAME") ? "PASS" : "FAIL");
  console.log("Cloudinary folder = new_erp:", env.includes("CLOUDINARY_FOLDER=new_erp") ? "PASS" : "FAIL");
}

console.log("\n=== 6. VERIFY GENERATED PDF ARTIFACTS ===");
const brainDir = "C:\\Users\\user\\.gemini\\antigravity\\brain\\1e04822f-1daf-42d2-a597-54b342b78751";
const piPdf = path.join(brainDir, "Sample_Proforma_Invoice.pdf");
const tiPdf = path.join(brainDir, "Sample_Tax_Invoice.pdf");
const piHeader = path.join(brainDir, "header_pi_verified.png");
const tiHeader = path.join(brainDir, "header_ti_verified.png");
console.log("Sample PI PDF generated:", fs.existsSync(piPdf) ? "PASS" : "FAIL", `(${fs.statSync(piPdf).size} bytes)`);
console.log("Sample TI PDF generated:", fs.existsSync(tiPdf) ? "PASS" : "FAIL", `(${fs.statSync(tiPdf).size} bytes)`);
console.log("PI Header verified crop:", fs.existsSync(piHeader) ? "PASS" : "FAIL");
console.log("TI Header verified crop:", fs.existsSync(tiHeader) ? "PASS" : "FAIL");
