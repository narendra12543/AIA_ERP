"use client";

import React, { useState } from "react";
import {
  Search,
  Download,
  Eye,
  Edit,
  Printer,
  Mail,
  Send,
  RotateCcw,
  Trash2,
  FileText,
  AlertTriangle,
  X,
  CheckCircle2,
} from "lucide-react";
import { Quotation } from "../lib/types";
import { formatIsoToDdMmYyyy, inr } from "../lib/vba-engine";

interface DatabaseViewProps {
  quotations: Quotation[];
  theme?: "dark" | "light";
  onSelectQuotation: (q: Quotation) => void;
  onViewQuotation?: (q: Quotation) => void;
  onPrintQuotation?: (q: Quotation) => void;
  onReviseQuotation?: (q: Quotation) => void;
  onDeleteQuotation?: (id: string) => void;
}

export default function DatabaseView({
  quotations,
  theme = "dark",
  onSelectQuotation,
  onViewQuotation,
  onPrintQuotation,
  onReviseQuotation,
  onDeleteQuotation,
}: DatabaseViewProps) {
  const [search, setSearch] = useState("");
  const [filterState, setFilterState] = useState("all");
  const [deleteConfirmQuote, setDeleteConfirmQuote] = useState<Quotation | null>(null);
  const [notification, setNotification] = useState("");

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900 shadow-sm";
  const inputBg = isDark ? "bg-black border-zinc-700 text-white placeholder-zinc-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const textHeader = isDark ? "text-white" : "text-zinc-950";
  const rowHover = isDark ? "hover:bg-zinc-900/60" : "hover:bg-zinc-50";

  function showNotification(msg: string) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 4000);
  }

  const filtered = quotations.filter((q) => {
    const qno = (q.quotation_no || "").toLowerCase();
    const client = (q.client_name || "").toLowerCase();
    const prod = (q.product_type || "").toLowerCase();
    const contact = (q.client_contact || "").toLowerCase();
    const term = search.toLowerCase();
    const matchesSearch = !term || qno.includes(term) || client.includes(term) || prod.includes(term) || contact.includes(term);

    if (filterState === "all") return matchesSearch;
    if (filterState === "mh") return matchesSearch && q.is_maharashtra;
    if (filterState === "interstate") return matchesSearch && !q.is_maharashtra;
    return matchesSearch;
  });

  function exportCSV() {
    const headers = [
      "Quotation No",
      "Date",
      "Client Name",
      "Product Type",
      "Contact",
      "Email",
      "Sub Total",
      "Tax",
      "Total",
      "Place of Supply",
      "PI Number",
      "Tax Invoice Number",
    ];
    const rows = filtered.map((q) => [
      `"${q.quotation_no}"`,
      `"${formatIsoToDdMmYyyy(q.date)}"`,
      `"${(q.client_name || "").replace(/"/g, '""')}"`,
      `"${(q.product_type || "").replace(/"/g, '""')}"`,
      `"${q.client_contact || ""}"`,
      `"${q.client_email || ""}"`,
      q.subtotal || 0,
      q.tax_amount || 0,
      q.total || 0,
      `"${q.place_of_supply || (q.is_maharashtra ? "27-Maharashtra" : "Inter-State")}"`,
      `"${q.pi_number || ""}"`,
      `"${q.tax_invoice_number || ""}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `AIA_Quotations_Master_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("Exported quotations master CSV.");
  }

  function handleEmail(q: Quotation) {
    const email = q.client_email || "sales@avenautomation.in";
    const subject = encodeURIComponent(`Quotation for ${q.product_type || "Gate Automation"} | AVEN INDUSTRIAL AUTOMATION`);
    const body = encodeURIComponent(
      `Dear Sir,\n\nPlease find attached our official quotation ${q.quotation_no} for ${q.product_type || "Industrial Automation System"}.\n\nRegards,\nAven Industrial Automation\nPhone: +91 8766918892`
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_blank");
  }

  function handleWhatsApp(q: Quotation) {
    const rawPhone = (q.client_contact || "").replace(/[^0-9]/g, "");
    const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    if (!phone) {
      alert("No valid phone number found for this client.");
      return;
    }
    const text = encodeURIComponent(
      `Dear Sir,\n\nPlease review quotation ${q.quotation_no} for ${q.product_type || "Industrial Automation System"}.\nTotal: ${inr.format(q.total || 0)}\n\nRegards,\nAven Industrial Automation`
    );
    window.open(`https://web.whatsapp.com/send?phone=${phone}&text=${text}`, "_blank");
  }

  function confirmDelete() {
    if (!deleteConfirmQuote) return;
    if (onDeleteQuotation && deleteConfirmQuote.id) {
      onDeleteQuotation(deleteConfirmQuote.id);
      showNotification(`Quotation ${deleteConfirmQuote.quotation_no} deleted successfully.`);
    }
    setDeleteConfirmQuote(null);
  }

  return (
    <div className={`border rounded-xl p-4 sm:p-6 transition-colors shadow-xs ${cardBg} space-y-4`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-zinc-800">
        <div>
          <h2 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${textHeader}`}>
            <FileText className="w-5 h-5 text-amber-500" />
            <span>AIA ERP Quotation Master Database</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-zinc-800 text-zinc-300">
              {filtered.length} Records
            </span>
          </h2>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            Live synchronized database records from Excel & Cloud Storage &bull; Status column hidden per design guidelines
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="relative flex-1 sm:flex-initial">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quote #, client, contact..."
              className={`w-full rounded-lg pl-8 pr-3 py-1.5 text-xs sm:w-56 focus:outline-none border ${inputBg}`}
            />
          </div>

          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className={`border rounded-lg px-2.5 py-1.5 text-xs focus:outline-none cursor-pointer ${inputBg}`}
          >
            <option value="all">All States</option>
            <option value="mh">Maharashtra (Intra-State: CGST+SGST)</option>
            <option value="interstate">Inter-State (IGST 18%)</option>
          </select>

          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-xs cursor-pointer"
            title="Export filtered records as CSV spreadsheet"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Table (Status column intentionally removed per Section 4 instruction) */}
      <div className="border border-zinc-800 rounded-lg overflow-x-auto w-full">
        <table className="w-full min-w-[850px] text-left text-xs border-collapse">
          <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold">
            <tr>
              <th className="py-2.5 px-3">Quotation No</th>
              <th className="py-2.5 px-3">Date</th>
              <th className="py-2.5 px-3 max-w-[260px]">Client Company / Project</th>
              <th className="py-2.5 px-3">Product Category</th>
              <th className="py-2.5 px-3 text-right">Sub Total</th>
              <th className="py-2.5 px-3 text-right">Tax (GST)</th>
              <th className="py-2.5 px-3 text-right">Grand Total</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className={`py-8 text-center text-xs ${textMuted}`}>
                  No quotation records found matching &quot;{search}&quot;.
                </td>
              </tr>
            ) : (
              filtered.map((q) => (
                <tr
                  key={q.id || q.quotation_no}
                  onClick={() => onSelectQuotation(q)}
                  className={`transition cursor-pointer group ${rowHover}`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-white group-hover:text-amber-400">
                    {q.quotation_no}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-400">
                    {formatIsoToDdMmYyyy(q.date)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-zinc-100 max-w-[260px] break-words">
                    <div className="font-bold text-zinc-100 leading-tight">{q.client_name || "Client Name"}</div>
                    {q.client_contact && (
                      <div className="text-[10px] text-zinc-400 font-mono mt-0.5">Ph: {q.client_contact}</div>
                    )}
                    {q.client_address && (
                      <div className="text-[10px] text-zinc-500 truncate max-w-[240px] leading-tight">
                        {q.client_address}
                      </div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300">
                    {q.product_type || "Gate Automation"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                    {inr.format(q.subtotal || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                    {inr.format(q.tax_amount || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    {inr.format(q.total || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1">
                      {/* 1. View / Preview */}
                      <button
                        onClick={() => {
                          if (onViewQuotation) onViewQuotation(q);
                          else onSelectQuotation(q);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition cursor-pointer"
                        title="View Official Quotation Document"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* 2. Edit in Workspace */}
                      <button
                        onClick={() => onSelectQuotation(q)}
                        className="p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                        title="Edit Quotation in Dashboard"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>

                      {/* 3. Revise (R1/R2) */}
                      {onReviseQuotation && (
                        <button
                          onClick={() => onReviseQuotation(q)}
                          className="p-1.5 text-zinc-400 hover:text-blue-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                          title="Create Revision (-R1)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* 4. Print / PDF */}
                      {onPrintQuotation && (
                        <button
                          onClick={() => {
                            onSelectQuotation(q);
                            setTimeout(() => onPrintQuotation(q), 100);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                          title="Export 2-Page Quotation PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* 5. Zoho Email */}
                      <button
                        onClick={() => handleEmail(q)}
                        className="p-1.5 text-zinc-400 hover:text-purple-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                        title="Send Email via Zoho"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>

                      {/* 6. WhatsApp */}
                      <button
                        onClick={() => handleWhatsApp(q)}
                        className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                        title="Send via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>

                      {/* 7. Delete */}
                      {onDeleteQuotation && (
                        <button
                          onClick={() => setDeleteConfirmQuote(q)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded transition cursor-pointer"
                          title="Delete Quotation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="bg-zinc-950 border border-zinc-800 text-white rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <h3 className="text-sm font-bold">Confirm Quotation Deletion</h3>
              </div>
              <button
                onClick={() => setDeleteConfirmQuote(null)}
                className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently delete quotation{" "}
              <strong className="text-white font-mono">{deleteConfirmQuote.quotation_no}</strong> for{" "}
              <strong className="text-white">{deleteConfirmQuote.client_name}</strong>?
            </p>
            <p className="text-[11px] text-zinc-500">
              This action removes the quotation record from the system database.
            </p>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setDeleteConfirmQuote(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm cursor-pointer"
              >
                Delete Quotation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
