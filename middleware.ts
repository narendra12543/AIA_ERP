import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/api/export-pdf"],
};

export async function middleware(req: NextRequest) {
  if (req.method !== "POST" || req.nextUrl.pathname !== "/api/export-pdf") {
    return NextResponse.next();
  }

  let bodyText = "";
  try {
    bodyText = await req.clone().text();
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const guardHeaders = new Headers();
  guardHeaders.set("Content-Type", "application/json");
  const cookie = req.headers.get("cookie");
  if (cookie) guardHeaders.set("cookie", cookie);
  const tabSession = req.headers.get("x-tab-session");
  if (tabSession) guardHeaders.set("x-tab-session", tabSession);

  try {
    const guardUrl = new URL("/api/purchase-orders/authorize-export", req.nextUrl.origin);
    const guardRes = await fetch(guardUrl, {
      method: "POST",
      headers: guardHeaders,
      body: bodyText,
    });

    if (!guardRes.ok) {
      const errBody = await guardRes.text();
      return new NextResponse(errBody || JSON.stringify({ error: "Forbidden" }), {
        status: guardRes.status,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch {
    return NextResponse.json(
      { error: "Authorization guard unavailable." },
      { status: 503 }
    );
  }

  return NextResponse.next();
}
