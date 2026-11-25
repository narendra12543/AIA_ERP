import { Pool, QueryResult, QueryResultRow } from "pg";

let pool: Pool | null = null;
let isInitialized = false;

export const isProduction = process.env.NODE_ENV === "production";

export function isDbConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getDbPool(): Pool | null {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    if (isProduction) {
      console.error("CRITICAL SECURITY ALERT: DATABASE_URL is required in production but not defined!");
    }
    return null;
  }

  if (!pool) {
    const isLocalhost = databaseUrl.includes("localhost") || databaseUrl.includes("127.0.0.1");
    // Secure Neon-compatible TLS with valid CA verification
    const sslConfig = isLocalhost
      ? false
      : isProduction
      ? { rejectUnauthorized: true }
      : { rejectUnauthorized: false };

    pool = new Pool({
      connectionString: databaseUrl,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on("error", (err) => {
      console.error("Unexpected PostgreSQL client error:", err.message);
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T> | null> {
  const p = getDbPool();
  if (!p) {
    if (isProduction) {
      throw new Error("DATABASE_UNAVAILABLE: PostgreSQL connection pool is not configured or offline in production.");
    }
    return null;
  }

  try {
    return await p.query<T>(text, params);
  } catch (err: any) {
    console.error("PostgreSQL Query Error:", err.message);
    if (isProduction) {
      throw err;
    }
    return null;
  }
}

/**
 * PostgreSQL Schema Definition & Table Initializer
 * Creates tables with JSONB columns for enterprise flexibility while indexing primary business fields.
 */
export async function initDb(): Promise<boolean> {
  if (isInitialized) return true;
  const p = getDbPool();
  if (!p) return false;

  const ddl = `
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

    CREATE INDEX IF NOT EXISTS idx_quotes_no ON quotes(quotation_no);
    CREATE INDEX IF NOT EXISTS idx_quotes_client ON quotes(client_name);
    CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
  `;

  try {
    await p.query(ddl);
    isInitialized = true;
    return true;
  } catch (err: any) {
    console.warn("Failed to initialize PostgreSQL schema:", err.message);
    return false;
  }
}
