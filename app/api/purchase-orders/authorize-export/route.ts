import { NextRequest, NextResponse } from "next/server";
import { query, initDb } from "@/lib/db";
import { authenticateRequest, logAudit } from "@/lib/auth";
import { hasPermission, normalizeRole } from "@/lib/permissions";
import { inr } from "@/lib/vba-engine";

export const dynamic = "force-dynamic";

function htmlToPlainText(html: string): string {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canonRole = normalizeRole(auth.user.role);
  if (canonRole === "Admin") {
    return NextResponse.json({ authorized: true });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid PDF export payload." }, { status: 400 });
  }

  const html = String(body.html || "");
  const fileName = String(body.fileName || body.title || "");
  const explicitPoId = String(body.poId || "").trim();
  const explicitPoNo = String(body.poNumber || "").trim();
  const plainText = htmlToPlainText(html);

  const isPoPayload =
    /PURCHASE\s+ORDER/i.test(plainText) ||
    /PO\s+NUMBER/i.test(plainText) ||
    /PURCHASE\s+ORDER\s+TO\s+\(VENDOR\)/i.test(plainText) ||
    /^PO[-_]/i.test(fileName) ||
    Boolean(explicitPoId) ||
    Boolean(explicitPoNo);

  // Deny roles without any PDF export authority
  if (canonRole === "Staff" || canonRole === "Store" || canonRole === "Accounts") {
    await logAudit(
      auth.user.userId,
      "PDF_EXPORT_BLOCKED_ROLE",
      { role: canonRole, fileName },
      { actorName: auth.user.name, module: "export_pdf", outcome: "BLOCKED" }
    );
    return NextResponse.json(
      { error: "Forbidden: Your role is not authorized to export ERP PDFs.", code: "FORBIDDEN" },
      { status: 403 }
    );
  }

  if (canonRole === "Sales") {
    if (isPoPayload) {
      await logAudit(
        auth.user.userId,
        "PO_PDF_EXPORT_BLOCKED_SALES",
        { fileName },
        { actorName: auth.user.name, module: "purchase_order", outcome: "BLOCKED" }
      );
      return NextResponse.json(
        { error: "Forbidden: Sales users are not authorized to export Purchase Orders.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }
    const canExportDoc =
      hasPermission(auth.user, "quotations.export") ||
      hasPermission(auth.user, "proforma.create") ||
      hasPermission(auth.user, "tax_invoice.create");
    if (!canExportDoc) {
      return NextResponse.json({ error: "Forbidden: Missing PDF export permission.", code: "FORBIDDEN" }, { status: 403 });
    }
    return NextResponse.json({ authorized: true });
  }

  // Purchase role: strictly bound to persisted, Admin-approved PO data
  if (canonRole === "Purchase") {
    if (!isPoPayload) {
      await logAudit(
        auth.user.userId,
        "NON_PO_PDF_BLOCKED_PURCHASE",
        { fileName },
        { actorName: auth.user.name, module: "export_pdf", outcome: "BLOCKED" }
      );
      return NextResponse.json(
        { error: "Forbidden: Purchase users may only export approved Purchase Orders.", code: "FORBIDDEN" },
        { status: 403 }
      );
    }

    const poNoMatch = plainText.match(/PO\s+NUMBER\s+([A-Z0-9\-_/]+)/i);
    const filePoMatch = fileName.match(/^(PO[-_][A-Z0-9\-]+)/i);
    const lookupKey = explicitPoId || explicitPoNo || poNoMatch?.[1] || filePoMatch?.[1] || "";

    if (!lookupKey) {
      return NextResponse.json(
        { error: "Admin approval required. Purchase Order identifier could not be verified.", code: "PO_APPROVAL_REQUIRED" },
        { status: 403 }
      );
    }

    await initDb();
    const res = await query(
      `SELECT id, po_number, vendor_name, total, approval_status, approved_version, current_version, created_by, data
       FROM purchase_orders
       WHERE id = $1 OR po_number = $1
       LIMIT 1`,
      [lookupKey]
    );

    if (!res || res.rows.length === 0) {
      await logAudit(
        auth.user.userId,
        "PO_PDF_BLOCKED_UNPERSISTED",
        { lookupKey, fileName },
        { actorName: auth.user.name, module: "purchase_order", recordRef: lookupKey, outcome: "BLOCKED" }
      );
      return NextResponse.json(
        { error: "Admin approval required. Purchase Order must be saved and approved before PDF export.", code: "PO_APPROVAL_REQUIRED" },
        { status: 403 }
      );
    }

    const po = res.rows[0];
    const approvalStatus = String(po.approval_status || po.data?.approval_status || "Draft");
    const approvedVersion = Number(po.approved_version ?? po.data?.approved_version ?? 0);
    const currentVersion = Number(po.current_version ?? po.data?.current_version ?? 1);

    if (approvalStatus !== "Approved" || approvedVersion < 1 || approvedVersion !== currentVersion) {
      await logAudit(
        auth.user.userId,
        "PO_PDF_BLOCKED_UNAPPROVED",
        { po_number: po.po_number, approvalStatus, approvedVersion, currentVersion },
        { actorName: auth.user.name, module: "purchase_order", recordRef: po.po_number, outcome: "BLOCKED" }
      );
      return NextResponse.json(
        { error: "Admin approval required. Unapproved or modified Purchase Orders cannot be exported.", code: "PO_APPROVAL_REQUIRED" },
        { status: 403 }
      );
    }

    // Bind HTML payload to approved server-side PO document fields
    const dbPoNo = String(po.po_number || po.data?.po_number || "").trim();
    const dbVendor = String(po.vendor_name || po.data?.vendor_name || "").trim();
    const dbTotalRounded = Math.round(Number(po.total ?? po.data?.total ?? 0));
    const expectedTotalFormatted = inr.format(dbTotalRounded);
    const expectedTotalRaw = inr.format(Number(po.total ?? po.data?.total ?? 0));
    const dbItems: any[] = Array.isArray(po.data?.items) ? po.data.items : [];

    const hasPoNo = dbPoNo ? plainText.includes(dbPoNo) : false;
    const hasVendor = dbVendor ? plainText.includes(dbVendor) : true;
    const hasTotal =
      plainText.includes(expectedTotalFormatted) || plainText.includes(expectedTotalRaw);
    const hasAllItems = dbItems.every((it) => {
      const firstLine = String(it?.name || "").split(/\r?\n/)[0]?.trim();
      return !firstLine || plainText.includes(firstLine);
    });

    if (!hasPoNo || !hasVendor || !hasTotal || !hasAllItems) {
      await logAudit(
        auth.user.userId,
        "PO_PDF_BLOCKED_PAYLOAD_MISMATCH",
        { po_number: dbPoNo, hasPoNo, hasVendor, hasTotal, hasAllItems },
        { actorName: auth.user.name, module: "purchase_order", recordRef: dbPoNo, outcome: "BLOCKED" }
      );
      return NextResponse.json(
        { error: "Forbidden: Export payload does not match the approved server-side Purchase Order.", code: "PO_PAYLOAD_MISMATCH" },
        { status: 403 }
      );
    }

    return NextResponse.json({ authorized: true, po_number: dbPoNo, approved_version: approvedVersion });
  }

  return NextResponse.json({ error: "Forbidden", code: "FORBIDDEN" }, { status: 403 });
}
