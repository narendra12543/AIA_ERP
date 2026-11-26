import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Client } from "../../../lib/types";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "clients.json");

function getStoredClients(): Client[] {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading clients.json:", err);
  }
  return [];
}

function saveStoredClients(clients: Client[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(clients, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving clients.json:", err);
  }
}

// GET /api/clients
export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "clients.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  // Production requirement: PostgreSQL is mandatory, no fallback to local JSON
  if (isProduction) {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
        { status: 503 }
      );
    }

    try {
      await initDb();
      const res = await query("SELECT * FROM clients ORDER BY name ASC");
      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to read clients from persistent database.", code: "QUERY_FAILED" },
          { status: 503 }
        );
      }

      let clients: Client[] = res.rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        header: r.header || "",
        contact: r.contact || "",
        email: r.email || "",
        gstin: r.gstin || "",
        address: r.address || "",
        place_of_supply: r.place_of_supply || "27-Maharashtra",
        updated_at: r.updated_at,
        ...(r.data || {}),
      }));

      if (q) {
        clients = clients.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.contact && c.contact.toLowerCase().includes(q)) ||
            (c.email && c.email.toLowerCase().includes(q)) ||
            (c.address && c.address.toLowerCase().includes(q))
        );
      }
      return NextResponse.json(clients);
    } catch (dbErr: any) {
      console.error("PostgreSQL client fetch failed in production:", dbErr.message);
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
      const res = await query("SELECT * FROM clients ORDER BY name ASC");
      if (res && res.rows.length > 0) {
        let clients: Client[] = res.rows.map((r: any) => ({
          id: r.id,
          name: r.name,
          header: r.header || "",
          contact: r.contact || "",
          email: r.email || "",
          gstin: r.gstin || "",
          address: r.address || "",
          place_of_supply: r.place_of_supply || "27-Maharashtra",
          updated_at: r.updated_at,
          ...(r.data || {}),
        }));

        if (q) {
          clients = clients.filter(
            (c) =>
              c.name.toLowerCase().includes(q) ||
              (c.contact && c.contact.toLowerCase().includes(q)) ||
              (c.email && c.email.toLowerCase().includes(q)) ||
              (c.address && c.address.toLowerCase().includes(q))
          );
        }
        return NextResponse.json(clients);
      }
    } catch (dbErr) {
      console.warn("Dev mode PostgreSQL client read failed, falling back to JSON:", dbErr);
    }
  }

  // Fallback: Local JSON database (Development only)
  let clients = getStoredClients();
  if (q) {
    clients = clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact && c.contact.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
    );
  }
  return NextResponse.json(clients);
}

// POST /api/clients
export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "clients.add" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const name = (body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Client company name is required" }, { status: 400 });
    }

    const clientData: Client = {
      id: body.id || `cli_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      name: name,
      header: body.header || `To, ${name}${body.address ? `, ${body.address}` : ""}`,
      contact: body.contact || "",
      email: body.email || "",
      gstin: body.gstin || "",
      address: body.address || "",
      place_of_supply: body.place_of_supply || "27-Maharashtra",
      updated_at: new Date().toISOString(),
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
        `INSERT INTO clients (id, name, header, contact, email, gstin, address, place_of_supply, data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (name) DO UPDATE SET
           header = EXCLUDED.header,
           contact = EXCLUDED.contact,
           email = EXCLUDED.email,
           gstin = EXCLUDED.gstin,
           address = EXCLUDED.address,
           place_of_supply = EXCLUDED.place_of_supply,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id`,
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

      if (!res) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to persist client to database.", code: "WRITE_FAILED" },
          { status: 503 }
        );
      }

      return NextResponse.json({ success: true, client: clientData });
    }

    // Development Mode
    const clients = getStoredClients();
    const existingIdx = clients.findIndex((c) => c.name.toLowerCase() === name.toLowerCase());

    if (existingIdx >= 0) {
      clients[existingIdx] = { ...clients[existingIdx], ...clientData, id: clients[existingIdx].id };
    } else {
      clients.push(clientData);
    }

    clients.sort((a, b) => a.name.localeCompare(b.name));
    saveStoredClients(clients);

    if (process.env.DATABASE_URL) {
      try {
        await initDb();
        await query(
          `INSERT INTO clients (id, name, header, contact, email, gstin, address, place_of_supply, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (name) DO UPDATE SET
             header = EXCLUDED.header,
             contact = EXCLUDED.contact,
             email = EXCLUDED.email,
             gstin = EXCLUDED.gstin,
             address = EXCLUDED.address,
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
      } catch (dbErr) {
        console.warn("Dev mode PostgreSQL client save failed, stored in JSON:", dbErr);
      }
    }

    return NextResponse.json({ success: true, client: clientData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
