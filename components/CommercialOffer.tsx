"use client";

import React from "react";
import { CompanyInfo, Quotation } from "../lib/types";
import { computeHsnSummary, formatIsoToDdMmYyyy, inr, isIntraState } from "../lib/vba-engine";
import { formatLegalBranding } from "../lib/branding";

interface CommercialOfferProps {
  quote: Quotation;
  company: CompanyInfo;
}

export default function CommercialOffer({ quote, company }: CommercialOfferProps) {
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
        <p style={{ fontWeight: "bold", fontSize: "9px", color: "#000000", margin: 0 }}>{title}</p>
        {bullets.length > 0 && (
          <div style={{ fontSize: "8px", color: "#111111", paddingLeft: "6px", marginTop: "2px" }}>
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

  function renderTerms(termsText: string) {
    if (!termsText) return null;
    const lines = termsText.split(/\r?\n|•/).map((l) => l.trim()).filter(Boolean);
    return (
      <div style={{ fontSize: "8px", lineHeight: 1.35, color: "#111111" }}>
        {lines.map((l, idx) => (
          <p key={idx} style={{ margin: "1.5px 0" }}>• {l.replace(/^•\s*/, "")}</p>
        ))}
      </div>
    );
  }

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
      {/* Main Document Title - Above Box matching Reference Page 2 */}
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
        COMMERCIAL OFFER
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
              padding: "6px 12px",
              display: "flex",
              gap: "12px",
              alignItems: "center",
              borderRight: "1px solid #000000",
            }}
          >
            <img
              src="/assets/logo.png"
              alt="AVEN Logo"
              style={{ height: "56px", objectFit: "contain" }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <div style={{ fontSize: "8.5px", lineHeight: 1.3 }}>
              <div style={{ fontWeight: 900, fontSize: "11px", textTransform: "uppercase" }}>{company.name}</div>
              {formatLegalBranding(company.tagline) && (
                <div style={{ fontWeight: 700, fontSize: "8.5px", color: "#222" }}>
                  {formatLegalBranding(company.tagline)}
                </div>
              )}
              <div>Office Address:- {company.address}</div>
              <div>Phone: {company.phone} | Email: {company.email}</div>
              <div>GSTIN: <span style={{ fontFamily: "monospace" }}>{company.gstin}</span></div>
              <div>PAN No: <span style={{ fontFamily: "monospace" }}>{company.pan}</span></div>
              <div>State: {company.state}</div>
            </div>
          </div>

          <div style={{ width: "175px", fontSize: "9px", fontWeight: 600 }}>
            <div style={{ padding: "5px 8px", borderBottom: "1px solid #000000" }}>
              <span style={{ fontSize: "8px", display: "block", color: "#444" }}>Estimate No.</span>
              <strong style={{ fontSize: "10.5px", fontFamily: "monospace" }}>{quote.quotation_no}</strong>
            </div>
            <div style={{ padding: "5px 8px" }}>
              <span style={{ fontSize: "8px", display: "block", color: "#444" }}>Date</span>
              <strong style={{ fontSize: "10.5px", fontFamily: "monospace" }}>
                {formatIsoToDdMmYyyy(quote.date)}
              </strong>
            </div>
          </div>
        </div>

        {/* Estimate For Box - Exact Match to Reference Page 2 */}
        <div
          style={{
            padding: "6px 12px",
            borderBottom: "1px solid #000000",
            fontSize: "8.5px",
            lineHeight: 1.35,
            background: "#ffffff",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "8.5px", color: "#333" }}>Estimate For</div>
          <div style={{ fontWeight: 800, fontSize: "9.5px", marginTop: "1px", color: "#000000" }}>
            Company Name: {quote.client_name}
          </div>
          <div style={{ color: "#111111", marginTop: "1px" }}>Add: {quote.client_address}</div>
          <div style={{ color: "#111111", marginTop: "1px" }}>Mail: {quote.client_email || "-"}</div>
          <div style={{ color: "#111111", marginTop: "1px" }}>
            Contact No.: {quote.client_contact || "-"}
            {quote.client_gstin && quote.client_gstin.trim() ? ` | GSTIN: ${quote.client_gstin}` : ""}
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Size(Mtr)</div>
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

        {/* Description & Amounts Box */}
        <div style={{ display: "flex", flexDirection: "row", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", fontSize: "8.5px", lineHeight: 1.35 }}>
            <div style={{ marginBottom: "4px" }}>
              <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "8px", color: "#333", display: "block" }}>ESTIMATE AMOUNT IN WORDS</span>
              <span style={{ fontWeight: 700, fontStyle: "italic", fontSize: "9px" }}>{quote.amount_words}</span>
            </div>
            <div style={{ marginTop: "4px" }}>
              <span style={{ fontWeight: 800, textTransform: "uppercase", fontSize: "8px", color: "#333", display: "block", marginBottom: "2px" }}>DESCRIPTION:</span>
              {renderTerms(quote.terms || "")}
            </div>
          </div>

          <div style={{ width: "250px", fontSize: "8.5px" }}>
            <div style={{ background: "#000000", color: "#ffffff", fontWeight: "bold", textAlign: "center", height: "22px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8.5px" }}>
              Amounts
            </div>
            <table style={{ width: "100%", fontSize: "8.5px", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000000" }}>
                  <td style={{ padding: "4.5px 8px", verticalAlign: "middle" }}>Sub Total</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", verticalAlign: "middle" }}>{inr.format(quote.subtotal || 0)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000000" }}>
                  <td style={{ padding: "4.5px 8px", verticalAlign: "middle" }}>
                    {isIntra ? "Tax (CGST 9% + SGST 9%)" : "Tax (IGST 18.0%)"}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", verticalAlign: "middle" }}>{inr.format(quote.tax_amount || 0)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000000" }}>
                  <td style={{ padding: "4.5px 8px", verticalAlign: "middle" }}>Round off</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", verticalAlign: "middle" }}>
                    ₹ {Number(quote.round_off || 0).toFixed(2)}
                  </td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td style={{ padding: "4.5px 8px", fontSize: "9.5px", verticalAlign: "middle" }}>Total</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", fontSize: "9.5px", verticalAlign: "middle" }}>
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
                  <th rowSpan={2} style={{ width: "15%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    HSN/ SAC
                  </th>
                  <th rowSpan={2} style={{ width: "21%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Taxable amount
                  </th>
                  <th colSpan={2} style={{ width: "22%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    CGST
                  </th>
                  <th colSpan={2} style={{ width: "22%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    SGST
                  </th>
                  <th rowSpan={2} style={{ width: "20%", background: "#ffffff", borderTop: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
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
                  <th rowSpan={2} style={{ width: "16%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    HSN/ SAC
                  </th>
                  <th rowSpan={2} style={{ width: "24%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    Taxable amount
                  </th>
                  <th colSpan={2} style={{ width: "36%", background: "#ffffff", borderTop: "1px solid #000000", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", padding: "4px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
                    IGST
                  </th>
                  <th rowSpan={2} style={{ width: "24%", background: "#ffffff", borderTop: "1px solid #000000", borderBottom: "1px solid #000000", padding: "6px 2px", verticalAlign: "middle", textAlign: "center", color: "#000000", fontWeight: "bold", fontSize: "9px" }}>
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

        {/* Bottom Section: Bank Details & Authorized Signatory - Single Boundary with HSN Table */}
        <div style={{ display: "flex", flexDirection: "row", fontSize: "8.5px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "8px 12px", lineHeight: 1.45 }}>
            <div style={{ fontWeight: 900, fontSize: "9.5px", marginBottom: "3px" }}>Bank Details</div>
            <div><strong>Account Name:</strong> {company.account_name}</div>
            <div><strong>Account No.:</strong> <span style={{ fontFamily: "monospace" }}>{company.account_no}</span></div>
            <div><strong>Branch Name:</strong> {company.bank_name}</div>
            <div><strong>IFSC code:</strong> <span style={{ fontFamily: "monospace" }}>{company.ifsc}</span></div>
            <div><strong>Branch:</strong> {company.branch || ""}</div>
          </div>
          <div style={{ width: "240px", padding: "8px 12px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "9.5px" }}>AVEN INDUSTRIAL AUTOMATION</div>
            <div style={{ height: "48px" }}></div>
            <div style={{ fontWeight: "bold", fontSize: "9px" }}>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );
}
