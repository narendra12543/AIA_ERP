import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { initialVendors } from "../../../lib/sample-data";
import { Vendor } from "../../../lib/types";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "vendors.json");

function getStoredVendors(): Vendor[] {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading vendors.json:", err);
  }
  return initialVendors;
}

function saveStoredVendors(vendors: Vendor[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(vendors, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving vendors.json:", err);
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
      const res = await query("SELECT data FROM vendors ORDER BY updated_at DESC");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows.map((r: any) => r.data));
      }
      return NextResponse.json([]);
    } catch (err: any) {
      console.error("PostgreSQL vendors read failed in production:", err);
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: Failed to read vendors.", details: err.message },
        { status: 503 }
      );
    }
  }

  // Development Mode: Try PostgreSQL first if configured, else safe local JSON fallback
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      const res = await query("SELECT data FROM vendors ORDER BY updated_at DESC");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows.map((r: any) => r.data));
      }
    } catch (err) {
      console.warn("Dev mode PostgreSQL vendors read failed:", err);
    }
  }

  const vendors = getStoredVendors();
  return NextResponse.json(vendors);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const newVendor: Vendor = {
      id: body.id || `ven_${Date.now()}`,
      name: body.name || "New Vendor",
      contact_person: body.contact_person || "",
      phone: body.phone || "",
      email: body.email || "",
      gstin: body.gstin || "",
      pan: body.pan || "",
      address: body.address || "",
      shipping_address: body.shipping_address || body.address || "",
      state: body.state || "27-Maharashtra",
      city: body.city || "Pune",
      pincode: body.pincode || "",
      payment_terms: body.payment_terms || "30 Days Credit",
      notes: body.notes || "",
      created_at: new Date().toISOString().slice(0, 10),
    };

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
        `INSERT INTO vendors (id, name, phone, email, gstin, address, state, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           gstin = EXCLUDED.gstin,
           address = EXCLUDED.address,
           state = EXCLUDED.state,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [newVendor.id, newVendor.name, newVendor.phone, newVendor.email, newVendor.gstin, newVendor.address, newVendor.state, JSON.stringify(newVendor)]
      );

      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to persist vendor to database.", code: "WRITE_FAILED" },
          { status: 503 }
        );
      }

      return NextResponse.json({ success: true, vendor: newVendor });
    }

    // Development Mode
    const vendors = getStoredVendors();
    vendors.unshift(newVendor);
    saveStoredVendors(vendors);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `INSERT INTO vendors (id, name, phone, email, gstin, address, state, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             phone = EXCLUDED.phone,
             email = EXCLUDED.email,
             gstin = EXCLUDED.gstin,
             address = EXCLUDED.address,
             state = EXCLUDED.state,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [newVendor.id, newVendor.name, newVendor.phone, newVendor.email, newVendor.gstin, newVendor.address, newVendor.state, JSON.stringify(newVendor)]
        );
      } catch (err) {
        console.warn("Dev mode PostgreSQL vendor write failed, saved to JSON:", err);
      }
    }

    return NextResponse.json({ success: true, vendor: newVendor, vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();

    // Production Mode: Mandatory PostgreSQL update
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const res = await query(
        `UPDATE vendors SET
           name = $1,
           phone = $2,
           email = $3,
           gstin = $4,
           address = $5,
           state = $6,
           data = $7,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $8
         RETURNING id`,
        [body.name, body.phone || "", body.email || "", body.gstin || "", body.address || "", body.state || "", JSON.stringify(body), body.id]
      );

      if (!res || res.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Vendor not found in database" }, { status: 404 });
      }

      return NextResponse.json({ success: true, vendor: body });
    }

    // Development Mode
    const vendors = getStoredVendors();
    const idx = vendors.findIndex((v) => v.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    }

    vendors[idx] = { ...vendors[idx], ...body };
    saveStoredVendors(vendors);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `UPDATE vendors SET
             name = $1,
             phone = $2,
             email = $3,
             gstin = $4,
             address = $5,
             state = $6,
             data = $7,
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $8`,
          [body.name, body.phone || "", body.email || "", body.gstin || "", body.address || "", body.state || "", JSON.stringify(body), body.id]
        );
      } catch (err) {
        console.warn("Dev mode PostgreSQL vendor update failed:", err);
      }
    }

    return NextResponse.json({ success: true, vendor: vendors[idx], vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, "Admin");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing vendor id" }, { status: 400 });
    }

    // Production Mode: Mandatory PostgreSQL delete
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const res = await query("DELETE FROM vendors WHERE id = $1 RETURNING id", [id]);
      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to delete vendor from database.", code: "DELETE_FAILED" },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, deleted: id });
    }

    // Development Mode
    let vendors = getStoredVendors();
    vendors = vendors.filter((v) => v.id !== id);
    saveStoredVendors(vendors);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query("DELETE FROM vendors WHERE id = $1", [id]);
      } catch (err) {
        console.warn("Dev mode PostgreSQL vendor delete failed:", err);
      }
    }

    return NextResponse.json({ success: true, vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
