import { NextRequest, NextResponse } from "next/server";
import { query, initDb, isProduction } from "@/lib/db";
import { defaultUsers } from "@/lib/sample-data";
import { User } from "@/lib/types";
import {
  hashPassword,
  verifyPassword,
  checkRateLimit,
  recordFailedLogin,
  resetLoginAttempts,
  createSession,
  logAudit,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const trimmedEmail = String(email || "").trim().toLowerCase();
    const enteredPassword = String(password || "").trim();

    if (!trimmedEmail || !enteredPassword) {
      return NextResponse.json(
        { error: "Invalid credentials. Please provide work email and password." },
        { status: 400 }
      );
    }

    // Rate Limiting
    const rateCheck = await checkRateLimit(trimmedEmail);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${rateCheck.waitSeconds} seconds.`,
        },
        { status: 429 }
      );
    }

    await initDb();

    // 1. Fetch user from PostgreSQL
    let userRecord: User | null = null;
    let storedPasswordHash: string = "";

    const dbRes = await query(`SELECT * FROM users WHERE LOWER(email) = $1`, [trimmedEmail]);
    if (dbRes && dbRes.rows.length > 0) {
      const row = dbRes.rows[0];
      userRecord = {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role as "Admin" | "User",
        status: row.status as "active" | "inactive",
        created_at: row.created_at,
      };
      storedPasswordHash = row.password;
    } else if (!isProduction) {
      // Development-only offline fallback (strictly disabled in production)
      const fallback = defaultUsers.find((u) => u.email.toLowerCase() === trimmedEmail);
      if (fallback) {
        userRecord = fallback;
        storedPasswordHash = fallback.password || (fallback.role === "Admin" ? "admin123" : "user123");
      }
    }

    if (!userRecord) {
      await recordFailedLogin(trimmedEmail);
      return NextResponse.json(
        { error: "Invalid credentials. Please verify your email and password." },
        { status: 401 }
      );
    }

    if (userRecord.status === "inactive") {
      await logAudit(userRecord.id, "LOGIN_BLOCKED_INACTIVE", { email: trimmedEmail });
      return NextResponse.json(
        { error: "This account has been disabled. Please contact the ERP administrator." },
        { status: 403 }
      );
    }

    // Verify Password with Scrypt / fallback
    const isValid = verifyPassword(enteredPassword, storedPasswordHash);
    if (!isValid) {
      await recordFailedLogin(trimmedEmail);
      await logAudit(userRecord.id, "LOGIN_FAILED_PASSWORD", { email: trimmedEmail });
      return NextResponse.json(
        { error: "Invalid credentials. Please verify your email and password." },
        { status: 401 }
      );
    }

    // Login Succeeded: Reset rate limit
    await resetLoginAttempts(trimmedEmail);

    // Create session (ADMIN 20 mins, USER 15 mins) — throws in production if PostgreSQL persistence fails
    const session = await createSession(userRecord);

    const safeUser = {
      id: userRecord.id,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      status: userRecord.status,
    };

    const res = NextResponse.json({
      success: true,
      user: safeUser,
      session: {
        expiresAt: session.expiresAt.toISOString(),
        token: session.token,
      },
    });

    // Set secure HTTP-only cookie
    res.cookies.set("aven_session", session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: session.expiresAt,
    });

    return res;
  } catch (err: any) {
    console.error("Authentication error:", err);
    return NextResponse.json(
      { error: "An authentication error occurred. Please try again." },
      { status: 500 }
    );
  }
}
