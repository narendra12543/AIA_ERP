import fs from "fs";
import path from "path";
import { Pool } from "pg";

/**
 * Migration Script: JSON database to PostgreSQL (Neon / Supabase / Local)
 * Run with: DATABASE_URL="your-postgres-url" npm run migrate
 */
async function runMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Error: DATABASE_URL environment variable is not defined.");
    console.log("Usage: DATABASE_URL=\"postgresql://...\" node scripts/migrate.js");
    process.exit(1);
  }

  console.log("🚀 Starting AVEN ERP PostgreSQL Migration...");
  const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  });

  try {
    const client = await pool.connect();
    console.log("✅ Successfully connected to PostgreSQL database.");

    // 1. Create tables if they do not exist
    console.log("📦 Creating database schema...");
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
    `);

    // 2. Migrate Quotes
    const quotesPath = path.join(process.cwd(), "data", "quotes.json");
    if (fs.existsSync(quotesPath)) {
      const quotes = JSON.parse(fs.readFileSync(quotesPath, "utf-8"));
      console.log(`📄 Migrating ${quotes.length} quotations...`);
      for (const q of quotes) {
        const id = q.id || q.quotation_no;
        await client.query(
          `INSERT INTO quotes (
            id, quotation_no, date, client_name, client_email, client_contact, client_gstin,
            client_address, subject, product_type, pi_number, tax_invoice_number, po_number,
            client_po_no, client_po_date, transport_name, vehicle_no, delivery_date,
            advance_received, subtotal, tax_amount, round_off, total, is_maharashtra, data
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25)
          ON CONFLICT (id) DO UPDATE SET
            quotation_no = EXCLUDED.quotation_no,
            date = EXCLUDED.date,
            client_name = EXCLUDED.client_name,
            total = EXCLUDED.total,
            data = EXCLUDED.data,
            updated_at = CURRENT_TIMESTAMP`,
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
      }
      console.log(`✅ Quotations migrated successfully.`);
    }

    // 3. Migrate Company Profile
    const companyPath = path.join(process.cwd(), "data", "company.json");
    if (fs.existsSync(companyPath)) {
      const company = JSON.parse(fs.readFileSync(companyPath, "utf-8"));
      console.log(`🏢 Migrating Company Profile...`);
      await client.query(
        `INSERT INTO company_info (id, name, gstin, pan, data)
         VALUES ('primary', $1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           gstin = EXCLUDED.gstin,
           pan = EXCLUDED.pan,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP`,
        [company.name, company.gstin, company.pan, JSON.stringify(company)]
      );
      console.log(`✅ Company profile migrated.`);
    }

    // 4. Migrate Vendors
    const vendorsPath = path.join(process.cwd(), "data", "vendors.json");
    if (fs.existsSync(vendorsPath)) {
      const vendors = JSON.parse(fs.readFileSync(vendorsPath, "utf-8"));
      console.log(`🏭 Migrating ${vendors.length} vendors...`);
      for (const v of vendors) {
        await client.query(
          `INSERT INTO vendors (id, name, phone, email, gstin, address, state, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             email = EXCLUDED.email,
             gstin = EXCLUDED.gstin,
             address = EXCLUDED.address,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [v.id, v.name, v.phone || "", v.email || "", v.gstin || "", v.address || "", v.state || "", JSON.stringify(v)]
        );
      }
      console.log(`✅ Vendors migrated.`);
    }

    // 5. Migrate Spec Profiles
    const specPath = path.join(process.cwd(), "data", "spec_profiles.json");
    if (fs.existsSync(specPath)) {
      const profiles = JSON.parse(fs.readFileSync(specPath, "utf-8"));
      console.log(`⚙️ Migrating ${profiles.length} specification profiles...`);
      for (let i = 0; i < profiles.length; i++) {
        const prof = profiles[i];
        const id = prof.name ? prof.name.toLowerCase().replace(/[^a-z0-9]/g, "_") : `prof_${i + 1}`;
        await client.query(
          `INSERT INTO spec_profiles (id, name, product, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             product = EXCLUDED.product,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [id, prof.name || `Profile ${i + 1}`, prof.product || prof.name || "", JSON.stringify(prof)]
        );
      }
      console.log(`✅ Specification profiles migrated.`);
    }

    client.release();
    await pool.end();
    console.log("🎉 All data successfully migrated to PostgreSQL!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    await pool.end();
    process.exit(1);
  }
}

runMigration();
