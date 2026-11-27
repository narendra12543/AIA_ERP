import fs from "fs";
import path from "path";
import crypto from "crypto";

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, "config", "protected-document-files.json");

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error("PROTECTED_DOCS_ERROR: Missing manifest at", MANIFEST_PATH);
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const entries = manifest.protectedFiles || [];
  let violations = 0;

  for (const entry of entries) {
    const abs = path.join(ROOT, entry.path);
    if (!fs.existsSync(abs)) {
      console.error(`VIOLATION [MISSING]: ${entry.path} (${entry.module})`);
      violations++;
      continue;
    }
    const actual = crypto
      .createHash("sha256")
      .update(fs.readFileSync(abs))
      .digest("hex")
      .toUpperCase();
    const expected = String(entry.sha256 || "").toUpperCase();
    if (actual !== expected) {
      console.error(`VIOLATION [MODIFIED]: ${entry.path} (${entry.module})`);
      console.error(`  Expected: ${expected}`);
      console.error(`  Actual:   ${actual}`);
      violations++;
    }
  }

  if (violations > 0) {
    console.error(`\nPROTECTED_DOCUMENTS_CHECK_FAILED: ${violations} protected file(s) modified or missing.`);
    process.exit(1);
  }

  console.log(`PROTECTED_DOCUMENTS_VERIFIED: ${entries.length}/${entries.length} locked files match baseline SHA-256.`);
}

main();
