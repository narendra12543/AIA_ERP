import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token =
      req.headers.get("x-tab-session") ||
      req.cookies.get("aven_session")?.value ||
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const session = await verifySession(token);
    if (!session) {
      const res = NextResponse.json({ authenticated: false, message: "Session expired" }, { status: 401 });
      res.cookies.delete("aven_session");
      return res;
    }

    return NextResponse.json({
      authenticated: true,
      mustChangePassword: session.mustChangePassword,
      passwordExpiresAt: session.passwordExpiresAt || null,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
        role: session.role,
        permissions: session.permissions,
        must_change_password: session.mustChangePassword,
        password_expires_at: session.passwordExpiresAt || null,
      },
      expiresAt: session.expiresAt.toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Session validation error" }, { status: 500 });
  }
}
