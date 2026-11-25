import { NextRequest, NextResponse } from "next/server";
import { revokeSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const token =
      req.cookies.get("aven_session")?.value ||
      req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");

    if (token) {
      await revokeSession(token);
    }

    const res = NextResponse.json({ success: true, message: "Logged out successfully" });
    res.cookies.delete("aven_session");
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: "Logout error" }, { status: 500 });
  }
}
