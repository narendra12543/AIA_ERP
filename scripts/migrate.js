const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

/**
 * Migration Script: JSON database to PostgreSQL (Neon / Supabase / Local)
 * Safe non-destructive migration script: NEVER overwrites existing database records.
 * Run with: DATABASE_URL="your-postgres-url" node scripts/migrate.js
 */
async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not defined.");
    console.log('Usage: DATABASE_URL="postgresql://..." node scripts/migrate.js');
    process.exit(1);
  }

  console.log("🚀 Starting AVEN ERP PostgreSQL Safe Migration (Non-Destructive Mode)...");
  const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: true },
  });

  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL database.");

    // 1. Create tables if they do not exist (Safe IF NOT EXISTS)
    console.log("📦 Verifying database schema...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS quotes (
        id VARCHAR(100) PRIMARY KEY,
        quotation_no VARCHAR(100) NOT NULL UNIQUE,
        date VARCHAR(50),
        client_name VARCHAR(255),
        client_email VARCHAR(255),
        client_contact VARCHAR(100),
        client_gstin VARCHAR(50),
        client_address TEXT,
        subject TEXT,
        product_type VARCHAR(255),
        pi_number VARCHAR(100),
        tax_invoice_number VARCHAR(100),
        po_number VARCHAR(100),
        client_po_no VARCHAR(100),
        client_po_date VARCHAR(50),
        transport_name VARCHAR(255),
        vehicle_no VARCHAR(100),
        delivery_date VARCHAR(100),
        advance_received NUMERIC(12,2) DEFAULT 0,
        subtotal NUMERIC(12,2) DEFAULT 0,
        tax_amount NUMERIC(12,2) DEFAULT 0,
        round_off NUMERIC(12,2) DEFAULT 0,
        total NUMERIC(12,2) DEFAULT 0,
        is_maharashtra BOOLEAN DEFAULT true,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS clients (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        header TEXT,
        contact VARCHAR(100),
        email VARCHAR(255),
        gstin VARCHAR(50),
        address TEXT,
        place_of_supply VARCHAR(100) DEFAULT '27-Maharashtra',
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS company_info (
        id VARCHAR(50) PRIMARY KEY DEFAULT 'primary',
        name VARCHAR(255),
        gstin VARCHAR(50),
        pan VARCHAR(50),
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS spec_profiles (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        product VARCHAR(255),
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS vendors (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(100),
        email VARCHAR(255),
        gstin VARCHAR(50),
        address TEXT,
        state VARCHAR(100),
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'User',
        password VARCHAR(255),
        status VARCHAR(50) DEFAULT 'active',
        created_at VARCHAR(50),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(50) NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        details JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        key VARCHAR(255) PRIMARY KEY,
        attempts INT NOT NULL DEFAULT 0,
        locked_until BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Safe Import Quotes (DO NOTHING on conflict: preserves live DB records)
    const quotesPath = path.join(process.cwd(), "data", "quotes.json");
    if (fs.existsSync(quotesPath)) {
      const quotes = JSON.parse(fs.readFileSync(quotesPath, "utf-8"));
      console.log(`📄 Checking ${quotes.length} quotations (safe insert only)...`);
      let inserted = 0;
      for (const q of quotes) {
        const id = q.id || q.quotation_no;
        const res = await client.query(
          `INSERT INTO quotes (
            id, quotation_no, date, client_name, client_email, client_contact, client_gstin,
            client_address, subject, product_type, pi_number, tax_invoice_number, po_number,
            client_po_no, client_po_date, transport_name, vehicle_no, delivery_date,
            advance_received, subtotal, tax_amount, round_off, total, is_maharashtra, data
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
          ON CONFLICT (id) DO NOTHING
          RETURNING id`,
          [
            id,
            q.quotation_no,
            q.date || "",
            q.client_name || "",
            q.client_email || "",
            q.client_contact || "",
            q.client_gstin || "",
            q.client_address || "",
            q.subject || "",
            q.product_type || "",
            q.pi_number || "",
            q.tax_invoice_number || "",
            q.po_number || "",
            q.client_po_number || q.client_po_no || "",
            q.client_po_date || "",
            q.transport_name || "",
            q.vehicle_no || q.vehicle_number || "",
            q.delivery_date || q.due_date || "",
            Number(q.advance_received) || 0,
            Number(q.subtotal) || 0,
            Number(q.tax_amount) || 0,
            Number(q.round_off) || 0,
            Number(q.total) || 0,
            q.is_maharashtra !== false,
            JSON.stringify(q),
          ]
        );
        if (res.rows.length > 0) inserted++;
      }
      console.log(`✅ Quotations processed (${inserted} new records added, existing records preserved).`);
    }

    // 3. Safe Import Company Profile
    const companyPath = path.join(process.cwd(), "data", "company.json");
    if (fs.existsSync(companyPath)) {
      const company = JSON.parse(fs.readFileSync(companyPath, "utf-8"));
      await client.query(
        `INSERT INTO company_info (id, name, gstin, pan, data)
         VALUES ('primary', $1, $2, $3, $4)
         ON CONFLICT (id) DO NOTHING`,
        [company.name, company.gstin, company.pan, JSON.stringify(company)]
      );
      console.log(`✅ Company profile verified.`);
    }

    // 4. Safe Import Clients
    const clientsPath = path.join(process.cwd(), "data", "clients.json");
    if (fs.existsSync(clientsPath)) {
      const clients = JSON.parse(fs.readFileSync(clientsPath, "utf-8"));
      let inserted = 0;
      for (const c of clients) {
        const res = await client.query(
          `INSERT INTO clients (id, name, header, contact, email, gstin, address, place_of_supply, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (name) DO NOTHING
           RETURNING id`,
          [c.id, c.name, c.header || "", c.contact || "", c.email || "", c.gstin || "", c.address || "", c.place_of_supply || "27-Maharashtra", JSON.stringify(c)]
        );
        if (res.rows.length > 0) inserted++;
      }
      console.log(`✅ Clients processed (${inserted} new added, existing preserved).`);
    }

    // 5. Safe Import Vendors
    const vendorsPath = path.join(process.cwd(), "data", "vendors.json");
    if (fs.existsSync(vendorsPath)) {
      const vendors = JSON.parse(fs.readFileSync(vendorsPath, "utf-8"));
      let inserted = 0;
      for (const v of vendors) {
        const res = await client.query(
          `INSERT INTO vendors (id, name, phone, email, gstin, address, state, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [v.id, v.name, v.phone || "", v.email || "", v.gstin || "", v.address || "", v.state || "", JSON.stringify(v)]
        );
        if (res.rows.length > 0) inserted++;
      }
      console.log(`✅ Vendors processed (${inserted} new added, existing preserved).`);
    }

    // 6. Safe Import Spec Profiles
    const specPath = path.join(process.cwd(), "data", "spec_profiles.json");
    if (fs.existsSync(specPath)) {
      const profiles = JSON.parse(fs.readFileSync(specPath, "utf-8"));
      let inserted = 0;
      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i];
        const id = prof.name ? prof.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : `prof_${i + 1}`;
        const res = await client.query(
          `INSERT INTO spec_profiles (id, name, product, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING
           RETURNING id`,
          [id, prof.name || `Profile ${i + 1}`, prof.product || prof.name || "", JSON.stringify(prof)]
        );
        if (res.rows.length > 0) inserted++;
      }
      console.log(`✅ Spec profiles processed (${inserted} new added, existing preserved).`);
    }

    // Audit record counts
    const qCount = await client.query("SELECT COUNT(*) FROM quotes");
    const cCount = await client.query("SELECT COUNT(*) FROM clients");
    const vCount = await client.query("SELECT COUNT(*) FROM vendors");
    const sCount = await client.query("SELECT COUNT(*) FROM spec_profiles");
    console.log(`📊 Current PostgreSQL Records -> Quotes: ${qCount.rows[0].count}, Clients: ${cCount.rows[0].count}, Vendors: ${vCount.rows[0].count}, Spec Profiles: ${sCount.rows[0].count}`);

    client.release();
    await pool.end();
    console.log("🎉 Safe migration check completed!");
  } catch (err) {
    console.error("❌ Migration check failed:", err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
