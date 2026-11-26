import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { initialSpecProfiles } from "../../../lib/sample-data";
import { SpecProfile } from "../../../lib/types";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest } from "../../../lib/auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "spec_profiles.json");

function getStoredProfiles(): SpecProfile[] {
  try {
    if (fs.existsSync(dataFilePath)) {
      const raw = fs.readFileSync(dataFilePath, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Error reading spec_profiles.json:", err);
  }
  return initialSpecProfiles;
}

function saveStoredProfiles(profiles: SpecProfile[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dataFilePath, JSON.stringify(profiles, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving spec_profiles.json:", err);
  }
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "spec_profiles.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
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
      const res = await query("SELECT data FROM spec_profiles ORDER BY name ASC");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows.map((r: any) => r.data));
      }
      return NextResponse.json([]);
    } catch (err: any) {
      console.error("PostgreSQL spec_profiles read failed in production:", err);
      return NextResponse.json(
        { error: "DATABASE_UNAVAILABLE: Failed to read specification profiles.", details: err.message },
        { status: 503 }
      );
    }
  }

  // Development Mode: Try PostgreSQL first if configured, else safe local JSON fallback
  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      const res = await query("SELECT data FROM spec_profiles ORDER BY name ASC");
      if (res && res.rows.length > 0) {
        return NextResponse.json(res.rows.map((r: any) => r.data));
      }
    } catch (err) {
      console.warn("Dev mode PostgreSQL spec_profiles read failed:", err);
    }
  }

  const profiles = getStoredProfiles();
  return NextResponse.json(profiles);
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "spec_profiles.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
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

      if (body.action === "create_profile") {
        const { name, product, specs } = body;
        const newProfile: SpecProfile = {
          name,
          product: product || name,
          specs: specs || {},
        };
        const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");

        const res = await query(
          `INSERT INTO spec_profiles (id, name, product, data)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name,
             product = EXCLUDED.product,
             data = EXCLUDED.data,
             updated_at = CURRENT_TIMESTAMP
           RETURNING id`,
          [id, name, newProfile.product, JSON.stringify(newProfile)]
        );

        if (!res) {
          return NextResponse.json(
            { error: "DATABASE_UNAVAILABLE: Failed to persist spec profile to database.", code: "WRITE_FAILED" },
            { status: 503 }
          );
        }

        return NextResponse.json({ success: true, profile: newProfile });
      }

      if (body.action === "add_spec") {
        const { profileName, specKey, specVal } = body;
        const id = profileName.toLowerCase().replace(/[^a-z0-9]/g, "_");
        const existing = await query("SELECT data FROM spec_profiles WHERE id = $1 LIMIT 1", [id]);
        if (!existing || existing.rows.length === 0) {
          return NextResponse.json({ success: false, error: "Profile not found in database" }, { status: 404 });
        }
        const profile = existing.rows[0].data;
        if (!profile.specs) profile.specs = {};
        profile.specs[specKey] = specVal;

        await query(
          `UPDATE spec_profiles SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [JSON.stringify(profile), id]
        );

        return NextResponse.json({ success: true, profile });
      }

      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
    }

    // Development Mode
    const profiles = getStoredProfiles();

    if (body.action === "add_spec") {
      const { profileName, specKey, specVal } = body;
      const profile = profiles.find((p) => p.name === profileName);
      if (!profile) {
        return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
      }
      if (!profile.specs) profile.specs = {};
      profile.specs[specKey] = specVal;
      saveStoredProfiles(profiles);
      return NextResponse.json({ success: true, profile, profiles });
    }

    if (body.action === "create_profile") {
      const { name, product, specs } = body;
      const newProfile: SpecProfile = {
        name,
        product: product || name,
        specs: specs || {},
      };
      profiles.push(newProfile);
      saveStoredProfiles(profiles);
      return NextResponse.json({ success: true, profile: newProfile, profiles });
    }

    if (Array.isArray(body)) {
      saveStoredProfiles(body);
      return NextResponse.json({ success: true, profiles: body });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "spec_profiles.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { profileName, oldKey, newKey, newVal } = body;
    const id = profileName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    // Production Mode: Mandatory PostgreSQL update
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      const existing = await query("SELECT data FROM spec_profiles WHERE id = $1 LIMIT 1", [id]);
      if (!existing || existing.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Profile not found in database" }, { status: 404 });
      }
      const profile = existing.rows[0].data;
      if (!profile.specs) profile.specs = {};

      if (oldKey !== newKey) {
        delete profile.specs[oldKey];
      }
      profile.specs[newKey] = newVal;

      await query(
        `UPDATE spec_profiles SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [JSON.stringify(profile), id]
      );

      return NextResponse.json({ success: true, profile });
    }

    // Development Mode
    const profiles = getStoredProfiles();
    const profile = profiles.find((p) => p.name === profileName);
    if (!profile || !profile.specs) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    if (oldKey !== newKey) {
      delete profile.specs[oldKey];
    }
    profile.specs[newKey] = newVal;
    saveStoredProfiles(profiles);

    return NextResponse.json({ success: true, profile, profiles });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "spec_profiles.manage" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const profileName = searchParams.get("profileName");
    const specKey = searchParams.get("specKey");

    if (!profileName) {
      return NextResponse.json({ success: false, error: "Missing profileName" }, { status: 400 });
    }

    const id = profileName.toLowerCase().replace(/[^a-z0-9]/g, "_");

    // Production Mode: Mandatory PostgreSQL delete
    if (isProduction) {
      if (!process.env.DATABASE_URL) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
          { status: 503 }
        );
      }

      await initDb();
      if (specKey) {
        const existing = await query("SELECT data FROM spec_profiles WHERE id = $1 LIMIT 1", [id]);
        if (existing && existing.rows.length > 0) {
          const profile = existing.rows[0].data;
          if (profile.specs) {
            delete profile.specs[specKey];
            await query("UPDATE spec_profiles SET data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [JSON.stringify(profile), id]);
          }
        }
      } else {
        await query("DELETE FROM spec_profiles WHERE id = $1", [id]);
      }
      return NextResponse.json({ success: true });
    }

    // Development Mode
    let profiles = getStoredProfiles();
    const profile = profiles.find((p) => p.name === profileName);

    if (!profile) {
      return NextResponse.json({ success: false, error: "Profile not found" }, { status: 404 });
    }

    if (specKey) {
      if (profile.specs) {
        delete profile.specs[specKey];
      }
    } else {
      profiles = profiles.filter((p) => p.name !== profileName);
    }

    saveStoredProfiles(profiles);
    return NextResponse.json({ success: true, profiles });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
