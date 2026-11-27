"use client";

import React from "react";
import { CompanyInfo, PurchaseOrder as POType } from "../lib/types";
import { formatIsoToDdMmYyyy, inr } from "../lib/vba-engine";
import { formatLegalBranding } from "../lib/branding";

export type POData = POType;

interface PurchaseOrderProps {
  po: POType;
  company: CompanyInfo;
}

export default function PurchaseOrderComponent({ po, company }: PurchaseOrderProps) {
  const items = po.items || [];
  const subtotal = items.reduce(
    (acc, it) => acc + (Number(it.amount) || (Number(it.qty || 0) * Number(it.rate || it.price || 0)) || 0),
    0
  );
  const additionalCharges = Math.max(0, Number(po.additional_charges) || 0);
  const discount = Math.max(0, Number(po.discount) || 0);
  const taxableAmount = Math.max(0, subtotal + additionalCharges - discount);
  const taxRate = po.tax_rate !== undefined && po.tax_rate >= 0 ? Number(po.tax_rate) : 0.18;
  const taxAmount = taxableAmount * taxRate;
  const total = Math.round(taxableAmount + taxAmount);

  function renderInstructions(instructionsText?: string) {
    if (!instructionsText || !instructionsText.trim()) {
      return (
        <>
          <div>• Inspect all items before dispatch to avoid quality disputes.</div>
          <div>• E-way bill is required for consignments exceeding statutory threshold.</div>
        </>
      );
    }
    const lines = instructionsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return (
      <>
        {lines.map((l, idx) => (
          <div key={idx}>• {l.replace(/^[•\-\*]\s*/, "")}</div>
        ))}
      </>
    );
  }

  function renderTerms(termsText?: string) {
    if (!termsText) return null;
    const lines = termsText.split(/\r?\n|•/).map((l) => l.trim()).filter(Boolean);
    return (
      <div style={{ fontSize: "7.5px", lineHeight: 1.3, color: "#111" }}>
        {lines.map((l, idx) => (
          <p key={idx}>• {l.replace(/^•\s*/, "")}</p>
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
      {/* Main Document Title - Above Box matching Commercial Offer & Invoices */}
      <div
        style={{
          textAlign: "center",
          fontWeight: 900,
          fontSize: "14px",
          letterSpacing: "1px",
          color: "#000000",
          textTransform: "uppercase",
          marginBottom: "6px",
        }}
      >
        PURCHASE ORDER
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
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", fontSize: "8.5px", lineHeight: 1.3 }}>
            <span style={{ fontSize: "7.5px", fontWeight: "bold", textTransform: "uppercase", color: "#444", display: "block" }}>
              ISSUED BY:
            </span>
            <div style={{ fontWeight: 900, fontSize: "11px", textTransform: "uppercase" }}>{company.name}</div>
            {formatLegalBranding(company.tagline) && (
              <div style={{ fontWeight: 700, fontSize: "8.5px", color: "#222" }}>
                {formatLegalBranding(company.tagline)}
              </div>
            )}
            <div>{company.address}</div>
            <div>Phone: {company.phone} | Email: {company.email}</div>
            <div>
              GSTIN: <span style={{ fontFamily: "monospace" }}>{company.gstin}</span> | PAN: <span style={{ fontFamily: "monospace" }}>{company.pan}</span> | State: {company.state}
            </div>
          </div>

          <div style={{ width: "185px", fontSize: "8.5px", fontWeight: 600 }}>
            <div style={{ padding: "5px 8px", borderBottom: "1px solid #000000" }}>
              <span style={{ fontSize: "7.5px", display: "block", color: "#444" }}>PO NUMBER</span>
              <strong style={{ fontSize: "10px", fontFamily: "monospace" }}>{po.po_number || "PO-AIA-001"}</strong>
            </div>
            <div style={{ padding: "5px 8px" }}>
              <span style={{ fontSize: "7.5px", display: "block", color: "#444" }}>PO Date</span>
              <strong style={{ fontSize: "10px", fontFamily: "monospace" }}>
                {formatIsoToDdMmYyyy(po.po_date || new Date().toISOString().slice(0, 10))}
              </strong>
            </div>
          </div>
        </div>

        {/* Vendor Details - Automatic Natural Spacing */}
        <div style={{ padding: "7px 12px", borderBottom: "1px solid #000000", fontSize: "9px", lineHeight: 1.4, background: "#ffffff" }}>
          <span style={{ fontSize: "8.5px", fontWeight: "bold", textTransform: "uppercase", color: "#111111", letterSpacing: "0.2px", display: "block" }}>
            PURCHASE ORDER TO (VENDOR):
          </span>
          <div style={{ fontWeight: 800, fontSize: "10px", marginTop: "2px", color: "#000000" }}>Vendor: {po.vendor_name || po.client_name || "Vendor Name"}</div>
          <div style={{ color: "#111111", marginTop: "1.5px" }}>Add: {po.vendor_address || po.client_address || "Vendor Address"}</div>
          <div style={{ color: "#111111", marginTop: "1.5px" }}>
            Contact: {po.vendor_contact || po.vendor_phone || po.client_contact || "-"} | GSTIN: {po.vendor_gstin || po.client_gstin || "-"}
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
                <div style={{ display: "flex", alignItems: "center", minHeight: "22px", padding: "0 8px", color: "#ffffff", fontWeight: "bold" }}>Item Description</div>
              </th>
              <th style={{ width: "72px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>HSN/ SAC</div>
              </th>
              <th style={{ width: "90px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Size(Mtr)</div>
              </th>
              <th style={{ width: "48px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Qty</div>
              </th>
              <th style={{ width: "42px", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "22px", color: "#ffffff", fontWeight: "bold" }}>Unit</div>
              </th>
              <th style={{ width: "80px", textAlign: "right", padding: 0, borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle", height: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "22px", padding: "0 6px", color: "#ffffff", fontWeight: "bold" }}>Rate</div>
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
                  <div style={{ display: "flex", alignItems: "center", minHeight: "26px", fontWeight: "bold", fontSize: "9px", lineHeight: 1.3 }}>{it.name?.split(/\r?\n/)[0]}</div>
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "26px" }}>{it.unit || "Nos"}</div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 6px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "26px" }}>{inr.format(it.rate || it.price || 0)}</div>
                </td>
                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "bold", padding: "4px 8px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", minHeight: "26px" }}>{inr.format(it.amount || 0)}</div>
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: "bold", background: "#ffffff" }}>
              <td colSpan={6} style={{ textAlign: "left", padding: "4.5px 8px", borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>Subtotal</td>
              <td style={{ borderRight: "1px solid #000000", borderBottom: "1px solid #000000", verticalAlign: "middle" }}></td>
              <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4.5px 8px", borderBottom: "1px solid #000000", verticalAlign: "middle" }}>
                {inr.format(subtotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* PO Terms & Totals */}
        <div style={{ display: "flex", flexDirection: "row", borderBottom: "1px solid #000000", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "6px 10px", borderRight: "1px solid #000000", fontSize: "8.5px", lineHeight: 1.35 }}>
            <strong style={{ fontSize: "8px", textTransform: "uppercase", color: "#333", display: "block", marginBottom: "3px" }}>
              PURCHASE ORDER TERMS:
            </strong>
            {renderTerms(po.terms || "1. Goods to be delivered strictly in accordance with specifications.\n2. Invoice must state this PO Number.\n3. Payment as per agreed credit terms.")}
          </div>
          <div style={{ width: "250px", fontSize: "8.5px" }}>
            <table style={{ width: "100%", fontSize: "8.5px", borderCollapse: "collapse" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid #000000" }}>
                  <td style={{ padding: "4px 8px" }}>Taxable Amount</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px" }}>{inr.format(taxableAmount)}</td>
                </tr>
                <tr style={{ borderBottom: "1px solid #000000" }}>
                  <td style={{ padding: "4px 8px" }}>GST ({Math.round(taxRate * 100)}%)</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px" }}>{inr.format(taxAmount)}</td>
                </tr>
                <tr style={{ fontWeight: "bold" }}>
                  <td style={{ padding: "4px 8px", fontSize: "9.5px" }}>Grand Total</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace", padding: "4px 8px", fontSize: "9.5px" }}>
                    {inr.format(total)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Section: Instructions to Vendor | Signatory */}
        {/* Sits naturally directly beneath the totals box sharing a single boundary */}
        <div style={{ display: "flex", flexDirection: "row", fontSize: "8.5px", boxSizing: "border-box" }}>
          <div style={{ flex: 1, padding: "6px 10px", lineHeight: 1.4 }}>
            <div style={{ fontWeight: 900, fontSize: "9px", marginBottom: "2px" }}>INSTRUCTIONS TO VENDOR</div>
            {renderInstructions(po.instructions)}
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
