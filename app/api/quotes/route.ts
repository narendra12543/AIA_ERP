import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Quotation } from "../../../lib/types";
import { initialQuotations } from "../../../lib/sample-data";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest, logAudit } from "../../../lib/auth";
import { hasPermission } from "../../../lib/permissions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "quotes.json");

function getStoredQuotes(): Quotation[] {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading quotes.json:", err);
  }
  return initialQuotations;
}

function saveStoredQuotes(quotes: Quotation[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(quotes, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving quotes.json:", err);
  }
}

async function syncClientFromQuote(quote: Quotation): Promise<void> {
  const cName = (quote.client_name || "").trim();
  if (!cName) return;

  const clientData = {
    id: `cli_${cName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    name: cName,
    header: quote.client_header || `To, ${cName}${quote.client_address ? `, ${quote.client_address}` : ""}`,
    contact: quote.client_contact || "",
    email: quote.client_email || "",
    gstin: quote.client_gstin || "",
    address: quote.client_address || "",
    place_of_supply: quote.place_of_supply || quote.state || "27-Maharashtra",
    updated_at: new Date().toISOString(),
  };

  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      await query(
        `INSERT INTO clients (id, name, header, contact, email, gstin, address, place_of_supply, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name) DO UPDATE SET
           header = EXCLUDED.header,
           contact = COALESCE(NULLIF(EXCLUDED.contact, ''), clients.contact),
           email = COALESCE(NULLIF(EXCLUDED.email, ''), clients.email),
           gstin = COALESCE(NULLIF(EXCLUDED.gstin, ''), clients.gstin),
           address = COALESCE(NULLIF(EXCLUDED.address, ''), clients.address),
           place_of_supply = EXCLUDED.place_of_supply,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP`,
        [
          clientData.id,
          clientData.name,
          clientData.header,
          clientData.contact,
          clientData.email,
          clientData.gstin,
          clientData.address,
          clientData.place_of_supply,
          JSON.stringify(clientData),
        ]
      );
    } catch (e) {
      console.warn("PostgreSQL client sync warning:", e);
    }
  }

  // Only sync to local JSON in development
  if (!isProduction) {
    try {
      const clientsFilePath = path.join(process.cwd(), "data", "clients.json");
      let clients: any[] = [];
      if (fs.existsSync(clientsFilePath)) {
        clients = JSON.parse(fs.readFileSync(clientsFilePath, "utf-8"));
      }
      const existingIdx = clients.findIndex((c) => c.name.toLowerCase() === cName.toLowerCase());
      if (existingIdx >= 0) {
        clients[existingIdx] = { ...clients[existingIdx], ...clientData, id: clients[existingIdx].id };
      } else {
        clients.push(clientData);
      }
      clients.sort((a, b) => a.name.localeCompare(b.name));
      fs.writeFileSync(clientsFilePath, JSON.stringify(clients, null, 2), "utf-8");
    } catch (err) {
      console.warn("Local client sync error:", err);
    }
  }
}

// GET /api/quotes
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }
  const canViewAll = hasPermission(auth.user, "quotations.view_all");
  const canViewOwn = hasPermission(auth.user, "quotations.view_own");
  if (!canViewAll && !canViewOwn) {
    return NextResponse.json({ error: "Forbidden: Missing quotation view permission", code: "PERMISSION_DENIED" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  // Production requirement: PostgreSQL is mandatory, no silent fallback to JSON
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: DATABASE_URL environment variable is mandatory in production.", code: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    try {
      await initDb();
      if (id) {
        const res = await query("SELECT data FROM quotes WHERE id = $1 OR quotation_no = $1 LIMIT 1", [id]);
        if (!res || res.rows.length === 0) {
          return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
        }
        return NextResponse.json(res.rows[0].data);
      } else {
        const res = await query("SELECT data FROM quotes ORDER BY updated_at DESC");
        if (!res) {
          return NextResponse.json(
            { error: "DATABASE_UNAVAILABLE: Failed to retrieve quotations from persistent storage.", code: "DATABASE_QUERY_FAILED" },
            { status: 503 }
          );
        }
        const quotes = res.rows.map((r) => r.data);
        return NextResponse.json(quotes);
      }
    } catch (dbErr: any) {
      console.error("PostgreSQL read failed in production:", dbErr.message);
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: Persistent database connection error.", details: dbErr.message },
        { status: 503 }
      );
    }
  }

  // Development Mode: Try PostgreSQL first if configured, else safe local JSON fallback
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      if (id) {
        const res = await query("SELECT data FROM quotes WHERE id = $1 OR quotation_no = $1 LIMIT 1", [id]);
        if (res && res.rows.length > 0) {
          return NextResponse.json(res.rows[0].data);
        }
      } else {
        const res = await query("SELECT data FROM quotes ORDER BY updated_at DESC");
        if (res && res.rows.length > 0) {
          const quotes = res.rows.map((r) => r.data);
          return NextResponse.json(quotes);
        }
      }
    } catch (dbErr) {
      console.warn("Dev mode PostgreSQL read failed, falling back to JSON:", dbErr);
    }
  }

  // Local JSON fallback (Development only)
  const quotes = getStoredQuotes();
  if (id) {
    const quote = quotes.find((q) => q.id === id || q.quotation_no === id);
    if (!quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
    }
    return NextResponse.json(quote);
  }

  return NextResponse.json(quotes);
}

// POST /api/quotes (Create or Add)
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "quotations.create" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();

    // Production Mode: Mandatory PostgreSQL write. Never silently fall back to JSON.
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is not configured for production persistence.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();

      if (Array.isArray(body)) {
        for (const q of body) {
          const id = q.id || q.quotation_no;
          await query(
            `INSERT INTO quotes (id, quotation_no, date, client_name, total, data)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) DO UPDATE SET
               quotation_no = EXCLUDED.quotation_no,
               date = EXCLUDED.date,
               client_name = EXCLUDED.client_name,
               total = EXCLUDED.total,
               data = EXCLUDED.data,
               updated_at = CURRENT_TIMESTAMP`,
            [id, q.quotation_no, q.date, q.client_name, Number(q.total) || 0, JSON.stringify(q)]
          );
        }
        return NextResponse.json({ success: true, count: body.length });
      }

      const newQuote: Quotation = {
        ...body,
        id: body.id || "q_" + Date.now(),
      };

      const res = await query(
        `INSERT INTO quotes (id, quotation_no, date, client_name, total, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           quotation_no = EXCLUDED.quotation_no,
           date = EXCLUDED.date,
           client_name = EXCLUDED.client_name,
           total = EXCLUDED.total,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [newQuote.id, newQuote.quotation_no, newQuote.date, newQuote.client_name, Number(newQuote.total) || 0, JSON.stringify(newQuote)]
      );

      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to write quotation to persistent database. Save aborted.", code: "WRITE_FAILED" },
          { status: 503 }
        );
      }

      await syncClientFromQuote(newQuote);
      return NextResponse.json({ success: true, quote: newQuote });
    }

    // Development Mode
    const quotes = getStoredQuotes();

    if (Array.isArray(body)) {
      saveStoredQuotes(body);
      return NextResponse.json({ success: true, count: body.length });
    }

    const newQuote: Quotation = {
      ...body,
      id: body.id || "q_" + Date.now(),
    };

    const updated = [newQuote, ...quotes.filter((q) => q.quotation_no !== newQuote.quotation_no)];
    saveStoredQuotes(updated);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `INSERT INTO quotes (id, quotation_no, date, client_name, total, data)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             quotation_no = EXCLUDED.quotation_no,
             total = EXCLUDED.total,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [newQuote.id, newQuote.quotation_no, newQuote.date, newQuote.client_name, Number(newQuote.total) || 0, JSON.stringify(newQuote)]
        );
      } catch (dbErr) {
        console.warn("Dev mode PostgreSQL write failed, saved to JSON:", dbErr);
      }
    }

    await syncClientFromQuote(newQuote);
    return NextResponse.json({ success: true, quote: newQuote });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// PUT /api/quotes (Update)
export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "quotations.edit" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const id = body.id || body.quotation_no;

    // Production Mode: Mandatory PostgreSQL update
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is not configured for production persistence.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const res = await query(
        `INSERT INTO quotes (id, quotation_no, date, client_name, total, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           quotation_no = EXCLUDED.quotation_no,
           date = EXCLUDED.date,
           client_name = EXCLUDED.client_name,
           total = EXCLUDED.total,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
        [id, body.quotation_no, body.date, body.client_name, Number(body.total) || 0, JSON.stringify(body)]
      );

      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to update quotation in persistent database.", code: "UPDATE_FAILED" },
          { status: 503 }
        );
      }

      await syncClientFromQuote(body);
      return NextResponse.json({ success: true, quote: body });
    }

    // Development Mode
    const quotes = getStoredQuotes();
    const idx = quotes.findIndex(
      (q) => q.id === body.id || q.quotation_no === body.quotation_no
    );

    if (idx === -1) {
      quotes.unshift(body);
    } else {
      quotes[idx] = { ...quotes[idx], ...body };
    }

    saveStoredQuotes(quotes);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `INSERT INTO quotes (id, quotation_no, date, client_name, total, data)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO UPDATE SET
             quotation_no = EXCLUDED.quotation_no,
             date = EXCLUDED.date,
             client_name = EXCLUDED.client_name,
             total = EXCLUDED.total,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP`,
          [id, body.quotation_no, body.date, body.client_name, Number(body.total) || 0, JSON.stringify(body)]
        );
      } catch (dbErr) {
        console.warn("Dev mode PostgreSQL update failed, saved to JSON:", dbErr);
      }
    }

    await syncClientFromQuote(body);
    return NextResponse.json({ success: true, quote: body });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

// DELETE /api/quotes?id=...
export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "quotations.delete" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing quotation ID" }, { status: 400 });
    }

    // Production Mode: Mandatory PostgreSQL delete
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is not configured for production persistence.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const res = await query("DELETE FROM quotes WHERE id = $1 OR quotation_no = $1", [id]);
      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to delete quotation from persistent database.", code: "DELETE_FAILED" },
          { status: 503 }
        );
      }
      return NextResponse.json({ success: true, deleted: id });
    }

    // Development Mode
    const quotes = getStoredQuotes();
    const filtered = quotes.filter((q) => q.id !== id && q.quotation_no !== id);
    saveStoredQuotes(filtered);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query("DELETE FROM quotes WHERE id = $1 OR quotation_no = $1", [id]);
      } catch (dbErr) {
        console.warn("Dev mode PostgreSQL delete failed, updated JSON:", dbErr);
      }
    }

    return NextResponse.json({ success: true, deleted: id });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
