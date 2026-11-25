import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { CompanyInfo } from "../../../lib/types";
import { initialCompany } from "../../../lib/sample-data";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "company.json");

function getStoredCompany(): CompanyInfo {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading company.json:", err);
  }
  return initialCompany;
}

function saveStoredCompany(company: CompanyInfo): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(company, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving company.json:", err);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Production Mode: Mandatory PostgreSQL read
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    try {
      await initDb();
      const res = await query("SELECT data FROM company_info WHERE id = 'primary' LIMIT 1");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows[0].data);
      }
      return NextResponse.json(
        { error: "Company profile record not found in database.", code: "NOT_FOUND" },
        { status: 404 }
      );
    } catch (err: any) {
      console.error("PostgreSQL company read failed in production:", err);
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: Failed to read company profile.", details: err.message },
        { status: 503 }
      );
    }
  }

  // Development Mode: Try PostgreSQL first if configured, else safe local JSON fallback
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      const res = await query("SELECT data FROM company_info WHERE id = 'primary' LIMIT 1");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows[0].data);
      }
    } catch (err) {
      console.warn("Dev mode PostgreSQL company read failed:", err);
    }
  }

  const company = getStoredCompany();
  return NextResponse.json(company);
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, "Admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    // Production Mode: Mandatory PostgreSQL write
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const res = await query(
        `INSERT INTO company_info (id, name, gstin, pan, data)
         VALUES ('primary', $1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           gstin = EXCLUDED.gstin,
           pan = EXCLUDED.pan,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [body.name, body.gstin, body.pan, JSON.stringify(body)]
      );

      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to update company profile in database.", code: "WRITE_FAILED" },
          { status: 503 }
        );
      }

      return NextResponse.json({ success: true, company: body });
    }

    // Development Mode
    saveStoredCompany(body);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `INSERT INTO company_info (id, name, gstin, pan, data)
           VALUES ('primary', $1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             gstin = EXCLUDED.gstin,
             pan = EXCLUDED.pan,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [body.name, body.gstin, body.pan, JSON.stringify(body)]
        );
      } catch (err) {
        console.warn("Dev mode PostgreSQL company update failed, saved to JSON:", err);
      }
    }

    return NextResponse.json({ success: true, company: body });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
