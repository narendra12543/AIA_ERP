"use client";

import React from "react";
import { CompanyInfo, Quotation } from "../lib/types";
import { computeHsnSummary, formatIsoToDdMmYyyy, inr, isIntraState } from "../lib/vba-engine";
import { formatLegalBranding } from "../lib/branding";

interface TaxInvoiceProps {
  quote: Quotation;
  company: CompanyInfo;
}

export default function TaxInvoice({ quote, company }: TaxInvoiceProps) {
  const items = quote.items || [];
  const totalQty = items.reduce((acc, it) => acc + (Number(it.qty) || 0), 0);
  const effectivePlaceOfSupply = quote.place_of_supply || quote.state || "27-Maharashtra";
  const isIntra = isIntraState(effectivePlaceOfSupply);
  const hsnData = computeHsnSummary(items, isIntra);

  function renderItemName(rawName: string) {
    if (!rawName) return null;
    const lines = rawName.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    const title = lines[0].replace(/^[•\-\*]\s*/, "").trim();
    const bullets = lines.slice(1);

    return (
      <div style={{ lineHeight: 1.35 }}>
        <p style={{ fontWeight: "bold", fontSize: "9px", color: "#000", margin: 0 }}>{title}</p>
        {bullets.length > 0 && (
          <div style={{ fontSize: "8px", color: "#111", paddingLeft: "6px", marginTop: "2px" }}>
            {bullets.map((b, idx) => (
              <p key={idx} style={{ margin: "1px 0", lineHeight: 1.3 }}>
                {b.startsWith("•") ? b : `• ${b}`}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  const canonicalPaymentTerms = (quote.pi_payment_terms || quote.payment_terms || "Advance")
    .toLowerCase()
    .includes("immediate")
    ? "Immediate"
    : "Advance";

  return (
    <div
      className="a4-sheet bg-white text-black mx-auto shadow-md"
      style={{
        width: "210mm",
        height: "297mm",
        minHeight: "297mm",
        padding: "8mm 10mm",
        boxSizing: "border-box",
        background: "#ffffff",
      }}
    >
      {/* Main Document Title - Bold Heading */}
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          fontSize: "14px",
          letterSpacing: "1px",
          color: "#000000",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        TAX INVOICE
      </div>

      <div
        style={{
          border: "1px solid #000000",
          width: "100%",
          boxSizing: "border-box",
          background: "#ffffff",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header Row */}
        <div style={{ display: "flex", flexDirection: "row", borderBottom: "1px solid #000000" }}>
          <div
            style={{
              flex: 1,
              padding: "10px 12px",
              display: "flex",
              gap: "14px",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              borderRight: "1px solid #000000",
              boxSizing: "border-box",
              textAlign: "left",
            }}
          >
            <div style={{ width: "80px", flexShrink: 0, alignSelf: "flex-start", display: "flex", alignItems: "flex-start", justifyContent: "flex-start" }}>
              <img
                src="/assets/logo.png"
                alt="AVEN Logo"
                style={{ width: "80px", height: "auto", maxHeight: "75px", objectFit: "contain", display: "block" }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-start",
                alignItems: "flex-start",
                textAlign: "left",
                gap: "3px",
                lineHeight: 1.45,
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.3px", color: "#000000", lineHeight: 1.2 }}>
                {company.name}
              </div>
              {formatLegalBranding(company.tagline) && (
                <div style={{ fontWeight: 700, fontSize: "9px", color: "#222222", lineHeight: 1.25 }}>
                  {formatLegalBranding(company.tagline)}
                </div>
              )}
              <div style={{ fontSize: "9px", color: "#222222" }}>
                Office Address:- {company.address}
              </div>
              <div style={{ fontSize: "9px", color: "#222222" }}>
                Phone: {company.phone} &nbsp;|&nbsp; Email: {company.email}
              </div>
              <div style={{ fontSize: "9px", color: "#222222", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                <div>GSTIN: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{company.gstin}</span></div>
                <div style={{ color: "#888888" }}>|</div>
                <div>PAN No: <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{company.pan}</span></div>
                <div style={{ color: "#888888" }}>|</div>
                <div>State: {company.state}</div>
              </div>
            </div>
          </div>

          <table
            style={{
              width: "230px",
              fontSize: "8px",
              fontWeight: 600,
              borderCollapse: "collapse",
              border: "none",
            }}
          >
            <tbody>
              {/* Row 1: Invoice No. | Date */}
              <tr>
                <td style={{ width: "55%", padding: "3.5px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Invoice No.</span>
                  <strong style={{ fontSize: "9px", fontFamily: "monospace", lineHeight: 1.25, display: "block" }}>
                    {quote.tax_invoice_number || quote.tax_invoice_no || "2026-27-AIA-001"}
                  </strong>
                </td>
                <td style={{ width: "45%", padding: "3.5px 6px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Date</span>
                  <strong style={{ fontSize: "9px", fontFamily: "monospace", lineHeight: 1.25, display: "block" }}>
                    {formatIsoToDdMmYyyy(quote.tax_invoice_date || quote.date)}
                  </strong>
                </td>
              </tr>

              {/* Row 2: Place of Supply | Due Date */}
              <tr>
                <td style={{ padding: "3.5px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Place of Supply</span>
                  <span style={{ fontSize: "8px", lineHeight: 1.25, display: "block" }}>{effectivePlaceOfSupply}</span>
                </td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Due Date</span>
                  <span style={{ fontSize: "8px", lineHeight: 1.25, display: "block" }}>{quote.due_date || quote.delivery_date || "-"}</span>
                </td>
              </tr>

              {/* Row 3: PO Date | PO Number */}
              <tr>
                <td style={{ padding: "3.5px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>PO Date</span>
                  <span style={{ fontSize: "8px", lineHeight: 1.25, display: "block" }}>
                    {quote.client_po_date ? formatIsoToDdMmYyyy(quote.client_po_date) : (quote.po_date || "-")}
                  </span>
                </td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>PO Number</span>
                  <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 700, lineHeight: 1.25, display: "block" }}>
                    {quote.client_po_number || quote.client_po_no || quote.po_number || "-"}
                  </span>
                </td>
              </tr>

              {/* Row 4: Transport Name | Vehicle Number */}
              <tr>
                <td style={{ padding: "3.5px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Transport Name</span>
                  <span style={{ fontSize: "8px", lineHeight: 1.25, display: "block" }}>{quote.transport_name || "-"}</span>
                </td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Vehicle Number</span>
                  <span style={{ fontSize: "8px", fontFamily: "monospace", lineHeight: 1.25, display: "block" }}>
                    {quote.vehicle_no || quote.vehicle_number || "-"}
                  </span>
                </td>
              </tr>

              {/* Row 5: Delivery Date | Payment Terms */}
              <tr>
                <td style={{ padding: "3.5px 6px", borderRight: "1px solid #000000", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Delivery Date</span>
                  <span style={{ fontSize: "8px", lineHeight: 1.25, display: "block" }}>{quote.delivery_date || quote.due_date || "-"}</span>
                </td>
                <td style={{ padding: "3.5px 6px", verticalAlign: "middle" }}>
                  <span style={{ fontSize: "7px", display: "block", color: "#444", lineHeight: 1.2 }}>Payment Terms</span>
                  <strong style={{ fontSize: "8px", color: "#000000", display: "block", lineHeight: 1.25 }}>
                    {canonicalPaymentTerms}
                  </strong>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Bill To & Ship To - Automatic Natural Spacing */}
        <div style={{ display: "flex", flexDirection: "row", borderBottom: "1px solid #000000", fontSize: "8.5px", lineHeight: 1.4, background: "#ffffff" }}>
          <div style={{ flex: 1, padding: "7px 12px", borderRight: "1px solid #000000" }}>
            <strong style={{ fontSize: "8.5px", textTransform: "uppercase", display: "block", marginBottom: "2px", color: "#111111", letterSpacing: "0.2px" }}>BILL TO :</strong>
            <div style={{ fontWeight: 800, fontSize: "10px", color: "#000000" }}>Company Name: {quote.client_name}</div>
            <div style={{ marginTop: "1.5px", color: "#111111" }}>Address: {quote.client_address}</div>
            <div style={{ marginTop: "1.5px", color: "#111111" }}>GSTIN: {quote.client_gstin || "-"}</div>
            <div style={{ marginTop: "1.5px", color: "#111111" }}>Contact No.: {quote.client_contact || "-"} | Email: {quote.client_email || "-"}</div>
          </div>
          <div style={{ width: "230px", padding: "7px 10px" }}>
            <strong style={{ fontSize: "8.5px", textTransform: "uppercase", display: "block", marginBottom: "2px", color: "#111111", letterSpacing: "0.2px" }}>SHIP TO :</strong>
            <div style={{ color: "#111111", lineHeight: 1.35 }}>{quote.ship_to_address || quote.client_address}</div>
          </div>
        </div>

        {/* Items Table */}
        <table
          style={{
            fontSize: "8.5px",
            borderCollapse: "collapse",
            width: "100%",
            boxSizing: "border-box",
            border: "none",
          }}
        >
          <thead>
            <tr style={{ background: "#000000", color: "#ffffff", fontWeight: "bold", textAlign: "center", fontSize: "8px", height: "22px" }}>
              <th style={{ width: "28px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>#</div>
              </th>
              <th style={{ textAlign: "left", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", minHeight: "22px", padding: "0 8px", color: "#ffffff", fontWeight: "bold" }}>Item name</div>
              </th>
              <th style={{ width: "72px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>HSN/ SAC</div>
              </th>
              <th style={{ width: "90px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Size(mm)</div>
              </th>
              <th style={{ width: "48px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Quantity</div>
              </th>
              <th style={{ width: "42px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Unit</div>
              </th>
              <th style={{ width: "80px", textAlign: "right", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", padding: "0 6px", color: "#ffffff", fontWeight: "bold" }}>Price/ Unit</div>
              </th>
              <th style={{ width: "95px", textAlign: "right", padding: 0, borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", padding: "0 8px", color: "#ffffff", fontWeight: "bold" }}>Amount</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ textAlign: "center", fontWeight: "bold", padding: "4px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{idx + 1}</div>
                </td>
                <td style={{ textAlign: "left", padding: "4px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", minHeight: "26px" }}>{renderItemName(it.name)}</div>
                </td>
                <td style={{ textAlign: "center", fontFamily: "monospace", padding: "4px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{it.hsn || "-"}</div>
                </td>
                <td style={{ textAlign: "center", padding: "4px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{it.size || "-"}</div>
                </td>
                <td style={{ textAlign: "center", fontWeight: "bold", padding: "4px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{it.qty}</div>
                </td>
                <td style={{ textAlign: "center", padding: "4px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{it.unit || "NOS"}</div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "26px" }}>{inr.format(it.price || 0)}</div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "bold", padding: "4px 8px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "26px" }}>{inr.format(it.amount || 0)}</div>
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: "bold", background: "#ffffff" }}>
              <td colSpan={4} style={{ textAlign: "left", padding: "4.5px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                Total
              </td>
              <td style={{ textAlign: "center", padding: "4.5px 2px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                {totalQty}
              </td>
              <td style={{ borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}></td>
              <td style={{ borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}></td>
              <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                {inr.format(quote.subtotal || 0)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount in words & Totals Box */}
        <div style={{ display: "flex", flexDirection: "row", borderBottom: "1px solid #000000", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", fontSize: "8.5px", lineHeight: 1.35 }}>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "8px", color: "#333", display: "block" }}>INVOICE AMOUNT IN WORDS</span>
              <span style={{ fontWeight: 700, fontStyle: "italic", fontSize: "9px" }}>{quote.amount_words}</span>
            </div>
            <div style={{ marginTop: "6px", fontSize: "8px", color: "#444" }}>
              <span style={{ fontWeight: "bold", color: "#000" }}>TERMS & CONDITIONS:</span>
              <p style={{ margin: "2px 0" }}>• Goods once sold will not be taken back or exchanged.</p>
              <p style={{ margin: "2px 0" }}>• Interest @18% p.a. will be charged if payment is not made within due date.</p>
              <p style={{ margin: "2px 0" }}>• Subject to Pune jurisdiction only.</p>
            </div>
          </div>

          <div style={{ width: "250px", fontSize: "8.5px" }}>
            <div style={{ background: "#000000", color: "#ffffff", fontWeight: "bold", textAlign: "center", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8.5px" }}>
              Amounts
            </div>
            <table style={{ width: "100%", fontSize: "8.5px", borderCollapse: "collapse", border: "none" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #000000" }}>Sub Total</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px", borderBottom: "1px solid #000000" }}>{inr.format(quote.subtotal || 0)}</td>
                </tr>
                {isIntra ? (
                  <>
                    <tr>
                      <td style={{ padding: "3.5px 8px", borderBottom: "1px solid #000000" }}>CGST (9.0%)</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", padding: "3.5px 8px", borderBottom: "1px solid #000000" }}>{inr.format(quote.cgst || (quote.tax_amount / 2))}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: "3.5px 8px", borderBottom: "1px solid #000000" }}>SGST (9.0%)</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", padding: "3.5px 8px", borderBottom: "1px solid #000000" }}>{inr.format(quote.sgst || (quote.tax_amount / 2))}</td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #000000" }}>IGST (18.0%)</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px", borderBottom: "1px solid #000000" }}>{inr.format(quote.igst || quote.tax_amount)}</td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: "4px 8px", borderBottom: "1px solid #000000" }}>Round off</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px", borderBottom: "1px solid #000000" }}>
                    {(quote.round_off || 0) >= 0 ? "+₹ " : "-₹ "}
                    {Math.abs(Number(quote.round_off || 0)).toFixed(2)}
                  </td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td style={{ padding: "4px 8px", fontSize: "9.5px", borderBottom: "none" }}>Total</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px", fontSize: "9.5px", borderBottom: "none" }}>
                    {inr.format(quote.total || 0)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dynamic HSN Tax Breakdown Table - Exact Match to Excel Table 2 & Image 5 */}
        <table
          style={{
            fontSize: "8.5px",
            borderCollapse: "collapse",
            width: "100%",
            boxSizing: "border-box",
            border: "none",
            background: "#ffffff",
          }}
        >
          <thead>
            {isIntra ? (
              <>
                <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: "bold" }}>
                  <th rowSpan={2} style={{ width: "15%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    HSN/ SAC
                  </th>
                  <th rowSpan={2} style={{ width: "21%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Taxable amount
                  </th>
                  <th colSpan={2} style={{ width: "22%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    CGST
                  </th>
                  <th colSpan={2} style={{ width: "22%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    SGST
                  </th>
                  <th rowSpan={2} style={{ width: "20%", background: "#ffffff", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Total Tax Amount
                  </th>
                </tr>
                <tr style={{ background: "#ffffff", textAlign: "center", fontSize: "8.5px" }}>
                  <th style={{ width: "7%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Rate
                  </th>
                  <th style={{ width: "15%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Amount
                  </th>
                  <th style={{ width: "7%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Rate
                  </th>
                  <th style={{ width: "15%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Amount
                  </th>
                </tr>
              </>
            ) : (
              <>
                <tr style={{ background: "#ffffff", textAlign: "center", fontWeight: "bold" }}>
                  <th rowSpan={2} style={{ width: "16%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    HSN/ SAC
                  </th>
                  <th rowSpan={2} style={{ width: "24%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Taxable amount
                  </th>
                  <th colSpan={2} style={{ width: "36%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    IGST
                  </th>
                  <th rowSpan={2} style={{ width: "24%", background: "#ffffff", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Total Tax Amount
                  </th>
                </tr>
                <tr style={{ background: "#ffffff", textAlign: "center", fontSize: "8.5px" }}>
                  <th style={{ width: "10%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Rate
                  </th>
                  <th style={{ width: "26%", background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold" }}>
                    Amount
                  </th>
                </tr>
              </>
            )}
          </thead>
          <tbody>
            {hsnData.rows.map((r, idx) => (
              <tr key={idx} style={{ textAlign: "center", fontSize: "8.5px", background: "#ffffff" }}>
                <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px" }}>
                    {r.hsn}
                  </div>
                </td>
                <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", fontFamily: "monospace" }}>
                    {inr.format(r.taxable)}
                  </div>
                </td>
                {isIntra ? (
                  <>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px" }}>
                        9.0%
                      </div>
                    </td>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", fontFamily: "monospace" }}>
                        {inr.format(r.cgstAmount)}
                      </div>
                    </td>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px" }}>
                        9.0%
                      </div>
                    </td>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", fontFamily: "monospace" }}>
                        {inr.format(r.sgstAmount)}
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px" }}>
                        18.0%
                      </div>
                    </td>
                    <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", fontFamily: "monospace" }}>
                        {inr.format(r.igstAmount)}
                      </div>
                    </td>
                  </>
                )}
                <td style={{ background: "#ffffff", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", fontFamily: "monospace", fontWeight: "bold" }}>
                    {inr.format(r.totalTax)}
                  </div>
                </td>
              </tr>
            ))}
            <tr style={{ textAlign: "center", fontWeight: "bold", background: "#ffffff", fontSize: "8.5px" }}>
              <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "24px", fontWeight: "bold" }}>
                  Total
                </div>
              </td>
              <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "24px", fontFamily: "monospace", fontWeight: "bold" }}>
                  {inr.format(hsnData.totalTaxable)}
                </div>
              </td>
              {isIntra ? (
                <>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}></td>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "24px", fontFamily: "monospace", fontWeight: "bold" }}>
                      {inr.format(hsnData.totalCgst)}
                    </div>
                  </td>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}></td>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "24px", fontFamily: "monospace", fontWeight: "bold" }}>
                      {inr.format(hsnData.totalSgst)}
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle" }}></td>
                  <td style={{ background: "#ffffff", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "24px", fontFamily: "monospace", fontWeight: "bold" }}>
                      {inr.format(hsnData.totalIgst)}
                    </div>
                  </td>
                </>
              )}
              <td style={{ background: "#ffffff", borderBottom: "1px solid #000000", padding: "4px 6px", verticalAlign: "middle", textAlign: "right" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "24px", fontFamily: "monospace", fontWeight: "bold" }}>
                  {inr.format(hsnData.totalTaxAmount)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Bottom Section: Bank Details | Material Spec / Declaration | Signatory */}
        {/* Sits naturally directly beneath the HSN table sharing a single boundary */}
        <div style={{ display: "flex", flexDirection: "row", fontSize: "8.5px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 900, fontSize: "9px", marginBottom: "2px" }}>BANK DETAILS</div>
            <div><strong>Account Name:</strong> {company.account_name}</div>
            <div><strong>Account No.:</strong> <span style={{ fontFamily: "monospace" }}>{company.account_no}</span></div>
            <div><strong>Branch Name:</strong> {company.bank_name}</div>
            <div><strong>IFSC code:</strong> <span style={{ fontFamily: "monospace" }}>{company.ifsc}</span></div>
            <div><strong>Branch:</strong> {company.branch || ""}</div>
          </div>
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 900, fontSize: "9px", marginBottom: "2px" }}>MATERIAL SPECIFICATION & DECLARATION:</div>
            <div style={{ fontSize: "8px", lineHeight: 1.35 }}>
              • Warranty: 1 Year against manufacturing defects. No warranty for damage due to unstable power supply.
            </div>
            <div style={{ fontSize: "7.5px", color: "#333", marginTop: "3px", lineHeight: 1.25 }}>
              We declare that this invoice shows actual price of the goods described and all particulars are true and correct.
            </div>
          </div>
          <div style={{ width: "185px", padding: "6px 10px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "9px" }}>AVEN INDUSTRIAL AUTOMATION</div>
            <div style={{ height: "46px" }}></div>
            <div style={{ fontWeight: "bold", fontSize: "8.5px" }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
