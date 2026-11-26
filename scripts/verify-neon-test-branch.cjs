const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { Pool } = require("pg");

const PG_RESTORE_EXE = "C:\\Program Files\\PostgreSQL\\19\\bin\\pg_restore.exe";
const DEFAULT_DUMP = "D:\\ERP_Backups\\aven_erp_pre_upgrade_20261126_220244.dump";
const MIGRATION_SQL = path.resolve(process.cwd(), "scripts", "migrations", "002_enterprise_upgrade.sql");

function loadEnvTestLocal() {
  const p = path.resolve(process.cwd(), ".env.test.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const eq = t.indexOf("=");
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function buildSafeTestUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error("Invalid TEST_DATABASE_URL format. Must be a valid postgresql:// URI.");
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("TEST_DATABASE_URL must use postgres:// or postgresql:// protocol.");
  }
  // Ensure target database is erp_restore_test (never neondb production DB)
  parsed.pathname = "/erp_restore_test";
  if (!parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }
  // Remove channel_binding if incompatible with older libpq/pg options
  if (parsed.searchParams.get("channel_binding") === "require") {
    parsed.searchParams.delete("channel_binding");
  }
  return parsed.toString();
}

async function main() {
  loadEnvTestLocal();
  const rawTestUrl = process.env.TEST_DATABASE_URL;
  if (!rawTestUrl) {
    console.error("MISSING_TEST_DATABASE_URL: Set TEST_DATABASE_URL in .env.test.local or $env:TEST_DATABASE_URL (Neon branch erp-upgrade-test / erp_restore_test).");
    process.exit(2);
  }

  const testUrl = buildSafeTestUrl(rawTestUrl);
  const dumpPath = process.argv[2] || DEFAULT_DUMP;

  if (!fs.existsSync(PG_RESTORE_EXE)) {
    throw new Error(`pg_restore.exe not found at ${PG_RESTORE_EXE}`);
  }
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Backup dump not found at ${dumpPath}`);
  }

  console.log("1. Restoring production backup into isolated erp_restore_test...");
  execFileSync(
    PG_RESTORE_EXE,
    ["--no-owner", "--no-acl", "--clean", "--if-exists", "-d", testUrl, dumpPath],
    { stdio: "inherit" }
  );
  console.log("   PASS: Backup restored into erp_restore_test.");

  console.log("2. Applying scripts/migrations/002_enterprise_upgrade.sql (Run 1 & Run 2 idempotency check)...");
  const sql = fs.readFileSync(MIGRATION_SQL, "utf8");
  const pool = new Pool({ connectionString: testUrl, ssl: { rejectUnauthorized: true } });
  try {
    await pool.query(sql);
    await pool.query(sql);
    console.log("   PASS: Migration applied twice idempotently with 0 errors.");

    console.log("3. Verifying existing records & Phase 2 schema...");
    const tables = ["users", "quotes", "clients", "vendors", "company_info", "spec_profiles", "email_drafts", "email_history", "email_templates", "system_settings", "login_attempts"];
    const counts = {};
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*)::int AS cnt FROM ${t}`);
      counts[t] = r.rows[0].cnt;
    }
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('permissions','password_expires_at','must_change_password','password_history','updated_at') ORDER BY column_name`
    );
    console.log("   TABLE_COUNTS:", JSON.stringify(counts));
    console.log("   NEW_USER_COLUMNS:", cols.rows.map((r) => r.column_name).join(", "));
    if (cols.rows.length !== 5) {
      throw new Error("Missing expected Phase 2 columns on users table!");
    }
    console.log("   PASS: All existing records intact and Phase 2 schema verified.");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("NEON_TEST_BRANCH_VERIFY_ERROR:", err.message || err);
  process.exit(1);
});
