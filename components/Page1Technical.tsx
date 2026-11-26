"use client";

import React from "react";
import { CompanyInfo, Quotation, SpecProfile } from "../lib/types";
import { formatIsoToDdMmYyyy, resolveTechnicalProfileName } from "../lib/vba-engine";
import { formatLegalBranding } from "../lib/branding";

interface Page1TechnicalProps {
  quote: Quotation;
  company: CompanyInfo;
  specProfiles?: SpecProfile[];
}

export default function Page1Technical({
  quote,
  company,
  specProfiles = [],
}: Page1TechnicalProps) {
  const profileProductName = resolveTechnicalProfileName(quote, specProfiles);

  // Find technical specifications matching product_type or saved specs
  let specsObj: { [key: string]: string } = {};

  if (quote.technical_specs && Object.keys(quote.technical_specs).length > 0) {
    specsObj = quote.technical_specs;
  } else {
    const matched = specProfiles.find(
      (p) =>
        p.id === quote.spec_profile_id ||
        p.name === profileProductName ||
        p.product === profileProductName ||
        p.name === quote.product_type ||
        p.product === quote.product_type
    );
    if (matched && matched.specs) {
      specsObj = matched.specs;
    } else {
      // Standard specifications matching Quotation_System.xlsm & attached PDF
      specsObj = {
        "Product": quote.product_type || "Motorised Sliding Gate",
        "Motor Specification": "Power:400W, Voltage:230VAC",
        "Opening/Closing Speed": "12 m/Min",
        "Drive Unit": "Direct drive",
        "Motor Power": "230VAC",
        "Limit Switch": "Magnetic",
        "Mounting Surface": "Concrete / Wall, Steel construction",
        "Opening Direction": "Horizontal",
        "Design": "Standard and as per client requirement",
        "Frame Material": "Mild Steel (MS)",
        "Drive": "Single Phase",
        "Usage Type": "Industrial",
        "Limit Switch Type": "Precise",
        "Remote Control": "Included",
        "Emergency / Power Failure": "Manual release by key",
        "Protection": "IP54",
        "Opening Frequency": "100 Cycles/day",
        "3 Way Push Button": "Included",
        "Safety Features": "Safety photocell, Precise limit switch, Flashing lamp with alarm",
        "AGO70 Photocell Sensor": "Included",
      };
    }
  }

  const entries = Object.entries(specsObj).filter(
    ([k, v]) => k !== "Profile Name" && k !== "name" && v && String(v).trim()
  );

  // Extract first item bullets for description intro
  const firstItem = quote.items && quote.items[0];
  const bulletLines = firstItem?.name && firstItem.name.trim()
    ? firstItem.name.split(/\r?\n/).slice(1).map((l) => l.trim()).filter(Boolean)
    : [];

  const clientHeader =
    quote.client_header ||
    `To, ${quote.client_name}${quote.client_address ? `, ${quote.client_address}` : ""}`;

  return (
    <div
      className="a4-sheet bg-white text-black mx-auto shadow-md"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "8mm 10mm",
        boxSizing: "border-box",
        background: "#ffffff",
      }}
    >
      {/* Complete Uniform Outer Border Box - Exact Match to Excel Sheet Page 1 (Range $A$1:$O$68) */}
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
        {/* Top Header Section with Single Bottom Divider Line (Exact Image 6 / Excel Reference) */}
        <div
          style={{
            borderBottom: "1px solid #000000",
            background: "#ffffff",
            padding: "8px 10px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            boxSizing: "border-box",
          }}
        >
          {/* Left: Company Details & GSTIN */}
          <div style={{ lineHeight: 1.35 }}>
            <h1
              style={{
                fontSize: "13.5px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.2px",
                color: "#000000",
                margin: 0,
              }}
            >
              {company.name}
            </h1>
            {formatLegalBranding(company.tagline) && (
              <p style={{ fontSize: "9.5px", fontWeight: 800, color: "#000000", margin: "2px 0 0 0" }}>
                {formatLegalBranding(company.tagline)}
              </p>
            )}
            <p style={{ fontSize: "8.5px", color: "#222222", margin: "2px 0 0 0" }}>
              {company.address}
            </p>
            <p style={{ fontSize: "8.5px", color: "#222222", margin: "1.5px 0 0 0" }}>
              Phone: {company.phone} | Email: {company.email}
            </p>
            <p style={{ fontSize: "8.5px", fontWeight: 800, color: "#000000", margin: "3px 0 0 0" }}>
              GSTIN: <span style={{ fontFamily: "monospace" }}>{company.gstin}</span> | PAN No:{" "}
              <span style={{ fontFamily: "monospace" }}>{company.pan}</span> | State: {company.state}
            </p>
          </div>

          {/* Right: Logo, Quotation No & Date */}
          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", paddingRight: "4px" }}>
            <img
              src="/assets/logo.png"
              alt="AVEN Logo"
              style={{ height: "62px", objectFit: "contain", marginBottom: "8px" }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
            <p style={{ fontSize: "10px", fontWeight: 800, color: "#000000", margin: "0 0 3px 0", lineHeight: 1.3 }}>
              Quotation No: <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{quote.quotation_no}</span>
            </p>
            <p style={{ fontSize: "10px", fontWeight: 800, color: "#000000", margin: 0, lineHeight: 1.3 }}>
              Date: <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{formatIsoToDdMmYyyy(quote.date)}</span>
            </p>
          </div>
        </div>

        {/* Customer Header, Subject & Greeting */}
        <div
          style={{
            padding: "8px 10px",
            fontSize: "9px",
            lineHeight: 1.4,
          }}
        >
          {quote.client_header ? (
            <p style={{ fontWeight: 800, fontSize: "9.5px", color: "#000000", margin: 0, whiteSpace: "pre-line" }}>
              {quote.client_header.trim().startsWith("To,") ? quote.client_header : `To, ${quote.client_header}`}
            </p>
          ) : (
            <div>
              <p style={{ fontWeight: 800, fontSize: "10px", color: "#000000", margin: 0 }}>To,</p>
              <p style={{ fontWeight: 800, fontSize: "9.5px", color: "#000000", margin: 0 }}>
                {quote.client_name || "Client Name"}
              </p>
              {quote.client_contact && (
                <p style={{ margin: "1px 0", color: "#000000" }}>
                  <strong>Attn:</strong> {quote.client_contact}
                </p>
              )}
              {quote.client_address && (
                <p style={{ margin: "1px 0", color: "#000000" }}>{quote.client_address}</p>
              )}
              {quote.client_gstin && (
                <p style={{ margin: "1px 0", color: "#000000" }}>
                  <strong>GSTIN:</strong> <span style={{ fontFamily: "monospace" }}>{quote.client_gstin}</span>
                </p>
              )}
            </div>
          )}
          <p style={{ fontWeight: 800, fontSize: "9.5px", color: "#000000", margin: "3px 0 0 0" }}>
            Sub: {quote.subject || `Quotation for ${quote.product_type || "Motorised Sliding Gate"}.`}
          </p>
          <p style={{ margin: "5px 0 0 0" }}>Dear Sir,</p>
          <p style={{ margin: "2px 0 0 0" }}>
            This is with reference to your requirement for the above-mentioned product for your
            project. We are pleased to share our quotation for our{" "}
            <strong>{quote.product_type || "Motorised Sliding Folding Gate"}</strong>:
          </p>
          {bulletLines.length > 0 && (
            <div style={{ paddingLeft: "10px", marginTop: "4px", fontSize: "8.5px", lineHeight: 1.35 }}>
              {bulletLines.map((line, idx) => (
                <p key={idx} style={{ margin: "1px 0" }}>
                  {line.startsWith("•") ? line : `• ${line}`}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Gate / Product Drawing Image Container (Centered) */}
        <div
          style={{
            padding: "4px 10px 8px 10px",
            textAlign: "center",
          }}
        >
          <img
            src={quote.design_image_path || "/assets/default_gate.png"}
            alt="Technical Drawing / Product Gate Design"
            style={{
              maxHeight: "165px",
              width: "100%",
              maxWidth: "100%",
              display: "block",
              objectFit: "contain",
              margin: "0 auto",
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (!target.src.includes("default_gate.png")) {
                target.src = "/assets/default_gate.png";
              }
            }}
          />
        </div>

        {/* Technical Data Specification Section - Edge-to-Edge Matching Excel Sheet Page 1 */}
        <div style={{ marginTop: "4px" }}>
          <div style={{ padding: "0 10px 6px 10px" }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "10.5px",
                borderBottom: "1px solid #000000",
                display: "inline-block",
                paddingBottom: "1px",
                color: "#000000",
              }}
            >
              Technical Data{profileProductName ? ` - ${profileProductName}` : ""}
            </div>
          </div>

          <table
            style={{
              borderCollapse: "collapse",
              width: "100%",
              fontSize: "8.5px",
              border: "none",
              boxSizing: "border-box",
            }}
          >
            <thead>
              <tr style={{ background: "#162f56", color: "#ffffff", textAlign: "left", height: "26px" }}>
                <th
                  style={{
                    width: "45%",
                    padding: "0 10px",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "9px",
                    verticalAlign: "middle",
                    height: "26px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", minHeight: "26px", height: "100%", color: "#ffffff", fontWeight: 700 }}>
                    Technical Specification
                  </div>
                </th>
                <th
                  style={{
                    width: "55%",
                    padding: "0 10px",
                    border: "none",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "9px",
                    verticalAlign: "middle",
                    height: "26px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", minHeight: "26px", height: "100%", color: "#ffffff", fontWeight: 700 }}>
                    Description
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([specName, specVal], idx) => (
                <tr
                  key={idx}
                  style={{
                    border: "none",
                  }}
                >
                  <td
                    style={{
                      fontWeight: 700,
                      padding: "3.5px 10px",
                      border: "none",
                      color: "#000000",
                      lineHeight: 1.35,
                      verticalAlign: "middle",
                    }}
                  >
                    {specName}
                  </td>
                  <td
                    style={{
                      fontWeight: 400,
                      padding: "3.5px 10px",
                      border: "none",
                      color: "#000000",
                      lineHeight: 1.35,
                      verticalAlign: "middle",
                    }}
                  >
                    {String(specVal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
