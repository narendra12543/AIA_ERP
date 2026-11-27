import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { initialVendors } from "../../../lib/sample-data";
import { Vendor } from "../../../lib/types";
import { query, initDb, isProduction } from "../../../lib/db";
import { authenticateRequest, logAudit } from "../../../lib/auth";
import { hasPermission } from "../../../lib/permissions";
import { decryptSecret, encryptSecret } from "../../../lib/crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const dataFilePath = path.join(process.cwd(), "data", "vendors.json");

function getStoredVendors(): Vendor[] {
  try {
    if (fs.existsSync(dataFilePath)) {
      return JSON.parse(fs.readFileSync(dataFilePath, "utf-8"));
    }
  } catch {}
  return initialVendors;
}

function saveStoredVendors(vendors: Vendor[]): void {
  try {
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dataFilePath, JSON.stringify(vendors, null, 2), "utf-8");
  } catch {}
}

function maskAccountNo(plain: string): string {
  if (!plain) return "";
  if (plain.length <= 4) return "****";
  return "*".repeat(Math.max(4, plain.length - 4)) + plain.slice(-4);
}

function sanitizeVendorForResponse(row: any, canViewBank: boolean): Vendor {
  const base: Vendor = { ...(row.data || row) };
  if (row.vendor_code) base.vendor_code = row.vendor_code;
  if (row.approval_status) base.approval_status = row.approval_status;
  if (row.operational_status) base.operational_status = row.operational_status;
  if (row.registered_at) base.registered_at = row.registered_at;

  const decryptedAcct = row.bank_account_no_enc ? decryptSecret(row.bank_account_no_enc) : "";
  delete base.bank_account_no;
  if (canViewBank) {
    base.bank_account_no_masked = decryptedAcct ? maskAccountNo(decryptedAcct) : base.bank_account_no_masked || "";
    base.bank_account_holder = row.bank_account_holder || base.bank_account_holder || "";
    base.bank_name = row.bank_name || base.bank_name || "";
    base.bank_branch = row.bank_branch || base.bank_branch || "";
    base.bank_ifsc = row.bank_ifsc || base.bank_ifsc || "";
    base.documents = row.documents || base.documents || [];
  } else {
    base.bank_account_no_masked = decryptedAcct ? maskAccountNo(decryptedAcct) : "";
    delete base.documents;
  }
  return base;
}

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "vendors.view" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  const canViewBank = hasPermission(auth.user, "vendors.bank_view");

  if (isProduction && !process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_UNAVAILABLE: DATABASE_URL is required in production.", code: "DATABASE_UNAVAILABLE" },
      { status: 503 }
    );
  }

  if (process.env.DATABASE_URL) {
    try {
      await initDb();
      const res = await query(
        `SELECT vendor_code, approval_status, operational_status, registered_at,
                bank_account_holder, bank_name, bank_branch, bank_account_no_enc, bank_ifsc, documents, data
         FROM vendors
         ORDER BY updated_at DESC`
      );
      if (res) {
        return NextResponse.json(res.rows.map((r: any) => sanitizeVendorForResponse(r, canViewBank)));
      }
    } catch (err: any) {
      if (isProduction) {
        return NextResponse.json(
          { error: "DATABASE_UNAVAILABLE: Failed to read vendors.", details: err.message },
          { status: 503 }
        );
      }
    }
  }

  return NextResponse.json(getStoredVendors());
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "vendors.add" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const canApprove = hasPermission(auth.user, "vendors.approve");
    const bankAccountPlain = String(body.bank_account_no || "").trim();
    const bankAccountEnc = bankAccountPlain ? encryptSecret(bankAccountPlain) : "";

    let vendorCode = body.vendor_code ? String(body.vendor_code).trim() : "";
    if (process.env.DATABASE_URL) {
      await initDb();
      if (!vendorCode) {
        const seqRes = await query(`SELECT 'AIA-VND-' || LPAD(nextval('vendor_code_seq')::text, 6, '0') AS code`);
        vendorCode = seqRes?.rows[0]?.code || `AIA-VND-${Date.now().toString().slice(-6)}`;
      }
    } else if (!vendorCode) {
      vendorCode = `AIA-VND-${Date.now().toString().slice(-6)}`;
    }

    const newVendor: Vendor = {
      id: body.id || `ven_${Date.now()}`,
      vendor_code: vendorCode,
      name: String(body.name || "New Vendor").trim(),
      trade_name: String(body.trade_name || "").trim(),
      vendor_type: String(body.vendor_type || "Supplier").trim(),
      category: String(body.category || "Automation Components Supplier").trim(),
      constitution: String(body.constitution || "").trim(),
      contact_person: String(body.contact_person || "").trim(),
      designation: String(body.designation || "").trim(),
      phone: String(body.phone || "").trim(),
      alt_phone: String(body.alt_phone || "").trim(),
      email: String(body.email || "").trim(),
      alt_email: String(body.alt_email || "").trim(),
      website: String(body.website || "").trim(),
      gst_type: String(body.gst_type || "Regular").trim(),
      gstin: String(body.gstin || "").trim().toUpperCase(),
      pan: String(body.pan || "").trim().toUpperCase(),
      udyam_no: String(body.udyam_no || "").trim(),
      cin: String(body.cin || "").trim(),
      address: String(body.address || "").trim(),
      address_line2: String(body.address_line2 || "").trim(),
      shipping_address: String(body.shipping_address || body.address || "").trim(),
      state: String(body.state || "27-Maharashtra").trim(),
      state_code: String(body.state_code || (body.state || "27-Maharashtra").slice(0, 2)).trim(),
      city: String(body.city || "Pune").trim(),
      district: String(body.district || "").trim(),
      pincode: String(body.pincode || "").trim(),
      country: String(body.country || "India").trim(),
      payment_terms: String(body.payment_terms || "30 Days Credit").trim(),
      credit_period: String(body.credit_period || "30 Days").trim(),
      currency: String(body.currency || "INR").trim(),
      lead_time: String(body.lead_time || "").trim(),
      freight_terms: String(body.freight_terms || "").trim(),
      preferred: Boolean(body.preferred),
      remarks: String(body.remarks || body.notes || "").trim(),
      bank_account_holder: String(body.bank_account_holder || "").trim(),
      bank_name: String(body.bank_name || "").trim(),
      bank_branch: String(body.bank_branch || "").trim(),
      bank_account_no_masked: bankAccountPlain ? maskAccountNo(bankAccountPlain) : "",
      bank_ifsc: String(body.bank_ifsc || "").trim().toUpperCase(),
      documents: Array.isArray(body.documents) ? body.documents : [],
      approval_status: canApprove ? (body.approval_status || "Approved") : "Pending Approval",
      operational_status: body.operational_status || "Active",
      notes: String(body.notes || body.remarks || "").trim(),
      registered_at: new Date().toISOString(),
      created_at: new Date().toISOString().slice(0, 10),
    };

    if (process.env.DATABASE_URL) {
      const res = await query(
        `INSERT INTO vendors (
           id, vendor_code, name, trade_name, vendor_type, category, constitution,
           contact_person, designation, phone, alt_phone, email, alt_email, website,
           gst_type, gstin, pan, udyam_no, cin, address, address_line2, city, district,
           state, state_code, pincode, country, payment_terms, credit_period, currency,
           lead_time, freight_terms, preferred, remarks,
           bank_account_holder, bank_name, bank_branch, bank_account_no_enc, bank_ifsc,
           documents, approval_status, operational_status, data
         ) VALUES (
           $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
           $21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,$37,$38,$39,$40,$41,$42,$43
         )
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           phone = EXCLUDED.phone,
           email = EXCLUDED.email,
           gstin = EXCLUDED.gstin,
           address = EXCLUDED.address,
           state = EXCLUDED.state,
           data = EXCLUDED.data,
           updated_at = CURRENT_TIMESTAMP
         RETURNING id, vendor_code`,
        [
          newVendor.id, newVendor.vendor_code, newVendor.name, newVendor.trade_name, newVendor.vendor_type,
          newVendor.category, newVendor.constitution, newVendor.contact_person, newVendor.designation,
          newVendor.phone, newVendor.alt_phone, newVendor.email, newVendor.alt_email, newVendor.website,
          newVendor.gst_type, newVendor.gstin, newVendor.pan, newVendor.udyam_no, newVendor.cin,
          newVendor.address, newVendor.address_line2, newVendor.city, newVendor.district,
          newVendor.state, newVendor.state_code, newVendor.pincode, newVendor.country,
          newVendor.payment_terms, newVendor.credit_period, newVendor.currency,
          newVendor.lead_time, newVendor.freight_terms, newVendor.preferred, newVendor.remarks,
          newVendor.bank_account_holder, newVendor.bank_name, newVendor.bank_branch, bankAccountEnc, newVendor.bank_ifsc,
          JSON.stringify(newVendor.documents || []), newVendor.approval_status, newVendor.operational_status,
          JSON.stringify(newVendor),
        ]
      );

      if (!res) {
        return NextResponse.json({ error: "DATABASE_UNAVAILABLE: Failed to persist vendor." }, { status: 503 });
      }

      await logAudit("VENDOR_CREATED", auth.user.email, `Registered vendor ${newVendor.vendor_code} (${newVendor.name})`, {
        actorName: auth.user.name,
        module: "vendors",
        recordRef: newVendor.vendor_code,
        outcome: "success",
      });
      return NextResponse.json({ success: true, vendor: newVendor });
    }

    const vendors = getStoredVendors();
    vendors.unshift(newVendor);
    saveStoredVendors(vendors);
    return NextResponse.json({ success: true, vendor: newVendor, vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "vendors.edit" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const canApprove = hasPermission(auth.user, "vendors.approve");

    if (process.env.DATABASE_URL) {
      await initDb();
      const existingRes = await query(`SELECT vendor_code, approval_status, operational_status, bank_account_no_enc, data FROM vendors WHERE id = $1`, [body.id]);
      if (!existingRes || existingRes.rows.length === 0) {
        return NextResponse.json({ success: false, error: "Vendor not found in database" }, { status: 404 });
      }
      const existing = existingRes.rows[0];
      // Immutable vendor_code
      const vendorCode = existing.vendor_code;
      const nextApproval =
        body.approval_status && body.approval_status !== existing.approval_status
          ? canApprove
            ? body.approval_status
            : existing.approval_status
          : existing.approval_status;
      const nextOperational =
        body.operational_status && body.operational_status !== existing.operational_status
          ? canApprove
            ? body.operational_status
            : existing.operational_status
          : existing.operational_status;

      const bankAccountPlain = typeof body.bank_account_no === "string" ? body.bank_account_no.trim() : "";
      const bankAccountEnc = bankAccountPlain && !bankAccountPlain.includes("*")
        ? encryptSecret(bankAccountPlain)
        : existing.bank_account_no_enc || "";

      const merged: Vendor = {
        ...(existing.data || {}),
        ...body,
        vendor_code: vendorCode,
        approval_status: nextApproval,
        operational_status: nextOperational,
        bank_account_no_masked: bankAccountPlain ? maskAccountNo(bankAccountPlain) : (existing.data?.bank_account_no_masked || ""),
      };
      delete merged.bank_account_no;

      await query(
        `UPDATE vendors SET
           name = $1, trade_name = $2, vendor_type = $3, category = $4, constitution = $5,
           contact_person = $6, designation = $7, phone = $8, alt_phone = $9, email = $10, alt_email = $11, website = $12,
           gst_type = $13, gstin = $14, pan = $15, udyam_no = $16, cin = $17,
           address = $18, address_line2 = $19, city = $20, district = $21, state = $22, state_code = $23, pincode = $24, country = $25,
           payment_terms = $26, credit_period = $27, currency = $28, lead_time = $29, freight_terms = $30, preferred = $31, remarks = $32,
           bank_account_holder = $33, bank_name = $34, bank_branch = $35, bank_account_no_enc = $36, bank_ifsc = $37,
           documents = $38, approval_status = $39, operational_status = $40, data = $41, updated_at = CURRENT_TIMESTAMP
         WHERE id = $42`,
        [
          merged.name, merged.trade_name || "", merged.vendor_type || "", merged.category || "", merged.constitution || "",
          merged.contact_person || "", merged.designation || "", merged.phone || "", merged.alt_phone || "", merged.email || "", merged.alt_email || "", merged.website || "",
          merged.gst_type || "", merged.gstin || "", merged.pan || "", merged.udyam_no || "", merged.cin || "",
          merged.address || "", merged.address_line2 || "", merged.city || "", merged.district || "", merged.state || "", merged.state_code || "", merged.pincode || "", merged.country || "India",
          merged.payment_terms || "", merged.credit_period || "", merged.currency || "INR", merged.lead_time || "", merged.freight_terms || "", Boolean(merged.preferred), merged.remarks || "",
          merged.bank_account_holder || "", merged.bank_name || "", merged.bank_branch || "", bankAccountEnc, merged.bank_ifsc || "",
          JSON.stringify(merged.documents || []), nextApproval, nextOperational, JSON.stringify(merged), body.id,
        ]
      );

      await logAudit("VENDOR_UPDATED", auth.user.email, `Updated vendor ${vendorCode} (${merged.name})`, {
        actorName: auth.user.name,
        module: "vendors",
        recordRef: vendorCode,
        outcome: "success",
      });

      return NextResponse.json({ success: true, vendor: merged });
    }

    const vendors = getStoredVendors();
    const idx = vendors.findIndex((v) => v.id === body.id);
    if (idx === -1) return NextResponse.json({ success: false, error: "Vendor not found" }, { status: 404 });
    vendors[idx] = { ...vendors[idx], ...body, vendor_code: vendors[idx].vendor_code };
    saveStoredVendors(vendors);
    return NextResponse.json({ success: true, vendor: vendors[idx], vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticateRequest(req, { requiredPermission: "vendors.delete" });
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ success: false, error: "Vendor ID is required" }, { status: 400 });

    if (process.env.DATABASE_URL) {
      await initDb();
      await query("DELETE FROM vendors WHERE id = $1", [id]);
      await logAudit("VENDOR_DELETED", auth.user.email, `Deleted vendor ${id}`, {
        actorName: auth.user.name,
        module: "vendors",
        recordRef: id,
        outcome: "success",
      });
      return NextResponse.json({ success: true });
    }

    const vendors = getStoredVendors().filter((v) => v.id !== id);
    saveStoredVendors(vendors);
    return NextResponse.json({ success: true, vendors });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
