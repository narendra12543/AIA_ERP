"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { CompanyInfo, POItem, PurchaseOrder as POType, Quotation, Vendor } from "../lib/types";
import { handleBulletKeyDown, insertBulletAtCursor } from "../lib/bullet-helper";
import { calculatePOTotals, inr, nextPONumber } from "../lib/vba-engine";
import PurchaseOrderPreview from "./PurchaseOrder";

interface PurchaseOrderFormProps {
  theme: "dark" | "light";
  company: CompanyInfo;
  vendors: Vendor[];
  allQuotations: Quotation[];
  currentQuote: Quotation;
  poData: POType;
  setPoData: React.Dispatch<React.SetStateAction<POType>>;
  canCreatePo?: boolean;
  canExportPdf?: boolean;
  canSendEmail?: boolean;
  onOpenVendorModal?: () => void;
  onPrintPo: (po: POType) => void;
  onEmailPo?: (po: POType) => void;
}

const DEFAULT_PO_TERMS =
  "1. Goods to be delivered strictly in accordance with specifications.\n2. Invoice must state this PO Number.\n3. Payment as per agreed credit terms.";
const DEFAULT_PO_INSTRUCTIONS =
  "Inspect all items before dispatch to avoid quality disputes.\nE-way bill is required for consignments exceeding statutory threshold.";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("aven_tab_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) headers["x-tab-session"] = parsed.token;
      }
    } catch {}
  }
  return headers;
}

export default function PurchaseOrderForm({
  theme,
  company,
  vendors,
  allQuotations,
  currentQuote,
  poData,
  setPoData,
  canCreatePo = true,
  canExportPdf = true,
  canSendEmail = true,
  onOpenVendorModal,
  onPrintPo,
  onEmailPo,
}: PurchaseOrderFormProps) {
  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#111216] border-zinc-800/80" : "bg-white border-zinc-200 shadow-sm";
  const inputBg = isDark
    ? "bg-black border-zinc-700 text-zinc-100 placeholder-zinc-500"
    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400";
  const labelColor = isDark ? "text-zinc-400" : "text-zinc-600";

  const [savedPOs, setSavedPOs] = useState<POType[]>([]);
  const [vendorSearch, setVendorSearch] = useState("");
  const [showPreview, setShowPreview] = useState(true);
  const [showCommercial, setShowCommercial] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tableMissing, setTableMissing] = useState(false);
  const itemTextareaRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  async function loadSavedPOs() {
    try {
      const res = await fetch("/api/purchase-orders", {
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSavedPOs(Array.isArray(data.items) ? data.items : []);
      setTableMissing(Boolean(data.tableMissing));
      // Ensure initial PO number is unique and never hardcoded if untouched
      if (!poData.id && data.nextPoNumber && (!poData.po_number || poData.po_number === "PO-2026-011")) {
        setPoData((prev) => ({ ...prev, po_number: data.nextPoNumber }));
      }
    } catch {}
  }

  useEffect(() => {
    loadSavedPOs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function recompute(next: POType): POType {
    const fin = calculatePOTotals(
      next.items || [],
      next.tax_rate ?? 0.18,
      next.additional_charges ?? 0,
      next.discount ?? 0
    );
    return { ...next, ...fin };
  }

  function handleSelectVendor(vId: string) {
    const v = vendors.find((item) => item.id === vId);
    if (!v) {
      setPoData((prev) => ({ ...prev, vendor_id: "" }));
      return;
    }
    setPoData((prev) =>
      recompute({
        ...prev,
        vendor_id: v.id,
        vendor_code: v.vendor_code || "",
        vendor_name: v.name,
        vendor_address: v.address || "",
        vendor_gstin: v.gstin || "",
        vendor_contact: v.phone || "",
        vendor_phone: v.phone || "",
        vendor_email: v.email || "",
        vendor_state: v.state || "",
        vendor_state_code: v.state_code || "",
        vendor_contact_person: v.contact_person || "",
        payment_terms: v.payment_terms || prev.payment_terms || "Advance",
      })
    );
  }

  function handleNewPO() {
    const nextNo = nextPONumber(savedPOs);
    setPoData(
      recompute({
        po_number: nextNo,
        po_date: new Date().toISOString().slice(0, 10),
        vendor_id: "",
        vendor_code: "",
        vendor_name: "",
        vendor_address: "",
        vendor_gstin: "",
        vendor_contact: "",
        vendor_email: "",
        vendor_state: "",
        vendor_state_code: "",
        vendor_reference: "",
        supplier_quote_ref: "",
        reference_date: "",
        linked_quotation_no: "",
        project_ref: "",
        delivery_date: "Within 4 weeks",
        delivery_location: company.address || "",
        billing_info: `${company.name}${company.address ? `, ${company.address}` : ""}`,
        shipping_info: company.address || "",
        freight: "Extra at actual",
        packaging: "Standard",
        installation: "Not Applicable",
        payment_terms: "Advance",
        items: [{ id: "po_it_" + Date.now(), name: "", hsn: "", size: "", qty: 1, unit: "Nos", rate: 0, amount: 0 }],
        tax_rate: 0.18,
        additional_charges: 0,
        discount: 0,
        terms: DEFAULT_PO_TERMS,
        instructions: DEFAULT_PO_INSTRUCTIONS,
        internal_remarks: "",
        status: "Draft",
      })
    );
    setStatusMsg({ type: "ok", text: `Initialized new Purchase Order ${nextNo}.` });
  }

  function handleSelectExistingPO(poNo: string) {
    if (!poNo) return;
    const found = savedPOs.find((p) => p.po_number === poNo);
    if (found) {
      setPoData(recompute(found));
      setStatusMsg({ type: "ok", text: `Loaded ${found.po_number}.` });
    }
  }

  function handleImportFromQuotation() {
    const qNo = poData.linked_quotation_no || currentQuote.quotation_no;
    const sourceQ = allQuotations.find((q) => q.quotation_no === qNo) || currentQuote;
    if (!sourceQ || !sourceQ.items || sourceQ.items.length === 0) {
      setStatusMsg({ type: "err", text: "No items found in the selected quotation." });
      return;
    }
    const hasExisting = (poData.items || []).some((it) => (it.name || "").trim() !== "" || Number(it.rate || 0) > 0);
    if (hasExisting && !window.confirm("Replace existing Purchase Order items with a copy of the quotation items? (Quotation will not be modified.)")) {
      return;
    }
    const copied: POItem[] = sourceQ.items.map((it, idx) => ({
      id: `po_it_${Date.now()}_${idx}`,
      name: it.name || "",
      hsn: it.hsn || "",
      size: it.size || "",
      qty: Number(it.qty) || 1,
      unit: it.unit || "Nos",
      rate: Number(it.price) || 0,
      price: Number(it.price) || 0,
      amount: (Number(it.qty) || 1) * (Number(it.price) || 0),
    }));
    setPoData((prev) => recompute({ ...prev, linked_quotation_no: sourceQ.quotation_no, items: copied }));
    setStatusMsg({ type: "ok", text: `Imported ${copied.length} independent item copy from ${sourceQ.quotation_no}.` });
  }

  function updatePoItem(index: number, field: keyof POItem, val: any) {
    const nextItems = [...(poData.items || [])];
    const item = { ...nextItems[index], [field]: val };
    if (field === "rate") item.price = Number(val) || 0;
    if (field === "qty" || field === "rate" || field === "price") {
      const q = field === "qty" ? Number(val) : Number(item.qty);
      const r = field === "rate" || field === "price" ? Number(val) : Number(item.rate ?? item.price);
      item.amount = (q || 0) * (r || 0);
    }
    nextItems[index] = item;
    setPoData((prev) => recompute({ ...prev, items: nextItems }));
  }

  function addPoItem() {
    const newItem: POItem = {
      id: "po_it_" + Date.now(),
      name: "",
      hsn: "",
      size: "",
      qty: 1,
      unit: "Nos",
      rate: 0,
      price: 0,
      amount: 0,
    };
    setPoData((prev) => recompute({ ...prev, items: [...(prev.items || []), newItem] }));
  }

  function duplicatePoItem(idx: number) {
    const items = [...(poData.items || [])];
    const copy = { ...items[idx], id: "po_it_" + Date.now() };
    items.splice(idx + 1, 0, copy);
    setPoData((prev) => recompute({ ...prev, items }));
  }

  function movePoItem(idx: number, dir: -1 | 1) {
    const items = [...(poData.items || [])];
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    [items[idx], items[target]] = [items[target], items[idx]];
    setPoData((prev) => recompute({ ...prev, items }));
  }

  function removePoItem(idx: number) {
    if ((poData.items || []).length <= 1) return;
    const items = (poData.items || []).filter((_, i) => i !== idx);
    setPoData((prev) => recompute({ ...prev, items }));
  }

  async function handleSavePO() {
    if (!canCreatePo || saving) return;
    if (!poData.vendor_name?.trim()) {
      setStatusMsg({ type: "err", text: "Please select an approved Vendor before saving." });
      return;
    }
    setSaving(true);
    setStatusMsg(null);
    try {
      const payload = recompute(poData);
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusMsg({ type: "err", text: data.error || "Failed to save Purchase Order." });
      } else {
        setPoData(data.item);
        setSavedPOs((prev) => {
          const rest = prev.filter((p) => p.id !== data.item.id && p.po_number !== data.item.po_number);
          return [data.item, ...rest];
        });
        setStatusMsg({ type: "ok", text: `${data.item.po_number} saved.` });
      }
    } catch {
      setStatusMsg({ type: "err", text: "Network error while saving Purchase Order." });
    } finally {
      setSaving(false);
    }
  }

  function handleResetForm() {
    if (!window.confirm("Reset the Purchase Order form? Unsaved edits will be cleared.")) return;
    handleNewPO();
  }

  const approvedActiveVendors = vendors.filter(
    (v) => (v.approval_status || "Approved") === "Approved" && (v.operational_status || "Active") === "Active"
  );
  const filteredVendors = approvedActiveVendors.filter((v) => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return true;
    return `${v.vendor_code || ""} ${v.name || ""} ${v.gstin || ""} ${v.contact_person || ""} ${v.phone || ""} ${v.email || ""}`
      .toLowerCase()
      .includes(q);
  });

  const fin = calculatePOTotals(
    poData.items || [],
    poData.tax_rate ?? 0.18,
    poData.additional_charges ?? 0,
    poData.discount ?? 0
  );

  return (
    <div className="space-y-4">
      {/* 1. Purchase Order Action Toolbar */}
      <div className={`w-full max-w-[210mm] mx-auto no-print ${cardBg} border rounded-xl p-3 space-y-2.5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-xs font-bold uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>
              Purchase Order
            </span>
            <span className="text-[11px] font-mono px-2 py-0.5 bg-amber-950/80 text-amber-300 border border-amber-800 rounded">
              {poData.po_number || "Unsaved"}
            </span>
            <select
              value={savedPOs.some((p) => p.po_number === poData.po_number) ? poData.po_number : ""}
              onChange={(e) => handleSelectExistingPO(e.target.value)}
              className={`${inputBg} border rounded-lg px-2.5 py-1.5 text-xs font-mono max-w-[240px]`}
              title="Select Existing Purchase Order"
            >
              <option value="">-- Select Saved PO ({savedPOs.length}) --</option>
              {savedPOs.map((p) => (
                <option key={p.id || p.po_number} value={p.po_number}>
                  {p.po_number} | {p.vendor_name || "Vendor"}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canCreatePo && (
              <button
                type="button"
                onClick={handleNewPO}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors duration-150 ${
                  isDark ? "bg-black border-zinc-700 hover:bg-zinc-800 text-white" : "bg-white border-zinc-300 hover:bg-zinc-100 text-zinc-900"
                }`}
              >
                <Plus className="w-3.5 h-3.5" /> New PO
              </button>
            )}
            {canCreatePo && (
              <button
                type="button"
                onClick={handleSavePO}
                disabled={saving}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors duration-150"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{saving ? "Saving..." : poData.id ? "Update PO" : "Save PO"}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer transition-colors duration-150 ${
                isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-200" : "border-zinc-300 hover:bg-zinc-100 text-zinc-800"
              }`}
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? "Hide Preview" : "Preview"}</span>
            </button>
            {canExportPdf && (
              <button
                type="button"
                onClick={() => onPrintPo(recompute(poData))}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg cursor-pointer transition-colors duration-150"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Generate PDF</span>
              </button>
            )}
            {canSendEmail && onEmailPo && (
              <button
                type="button"
                onClick={() => onEmailPo(recompute(poData))}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-colors duration-150"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Email PO</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleResetForm}
              className={`p-1.5 rounded-lg border cursor-pointer transition-colors duration-150 ${
                isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-400" : "border-zinc-300 hover:bg-zinc-100 text-zinc-600"
              }`}
              title="Reset Purchase Order Form"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {tableMissing && (
          <div className="text-[11px] px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400">
            Independent PO database table (migration 006) is pending approval. PDF generation &amp; Email work immediately; saving to DB requires applying migration 006.
          </div>
        )}
        {statusMsg && (
          <div
            className={`text-[11px] px-3 py-1.5 rounded border ${
              statusMsg.type === "ok"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {statusMsg.text}
          </div>
        )}
      </div>

      {/* 2. PO Header & Independent Vendor Master Selection */}
      <div className={`w-full max-w-[210mm] mx-auto p-4 ${cardBg} border rounded-xl no-print space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5 border-zinc-800/60">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
              PO Header &amp; Supplier Details (Vendor Master)
            </span>
          </div>
          {onOpenVendorModal && (
            <button
              type="button"
              onClick={onOpenVendorModal}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Manage / Add Vendors
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>PO Number *</label>
            <input
              type="text"
              value={poData.po_number || ""}
              onChange={(e) => setPoData({ ...poData, po_number: e.target.value })}
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono font-bold`}
            />
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>PO Date *</label>
            <input
              type="date"
              value={poData.po_date || new Date().toISOString().slice(0, 10)}
              onChange={(e) => setPoData({ ...poData, po_date: e.target.value })}
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono`}
            />
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Vendor Reference</label>
            <input
              type="text"
              value={poData.vendor_reference || ""}
              onChange={(e) => setPoData({ ...poData, vendor_reference: e.target.value })}
              placeholder="Optional ref"
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
            />
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Supplier Quote Ref</label>
            <input
              type="text"
              value={poData.supplier_quote_ref || ""}
              onChange={(e) => setPoData({ ...poData, supplier_quote_ref: e.target.value })}
              placeholder="Supplier quote #"
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
            />
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Reference Date</label>
            <input
              type="date"
              value={poData.reference_date || ""}
              onChange={(e) => setPoData({ ...poData, reference_date: e.target.value })}
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono`}
            />
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Linked Quotation (Optional)</label>
            <select
              value={poData.linked_quotation_no || ""}
              onChange={(e) => setPoData({ ...poData, linked_quotation_no: e.target.value })}
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono`}
            >
              <option value="">-- Independent (None) --</option>
              {allQuotations.map((q) => (
                <option key={q.quotation_no} value={q.quotation_no}>
                  {q.quotation_no} — {q.client_name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Project Reference (Optional)</label>
            <input
              type="text"
              value={poData.project_ref || ""}
              onChange={(e) => setPoData({ ...poData, project_ref: e.target.value })}
              placeholder="Project / Job reference"
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
            />
          </div>
        </div>

        {/* Searchable Vendor Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className={`text-[11px] font-semibold ${labelColor}`}>
                Select Approved Active Supplier (Vendor Master) *
              </label>
              <input
                type="text"
                value={vendorSearch}
                onChange={(e) => setVendorSearch(e.target.value)}
                placeholder="Search code, name, GSTIN, phone..."
                className={`${inputBg} border rounded px-2 py-0.5 text-[11px] w-52`}
              />
            </div>
            <select
              value={poData.vendor_id || ""}
              onChange={(e) => handleSelectVendor(e.target.value)}
              className={`w-full ${inputBg} border rounded-lg px-3 py-2 font-medium`}
            >
              <option value="">-- Choose Approved Active Supplier ({filteredVendors.length}) --</option>
              {filteredVendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vendor_code ? `${v.vendor_code} — ` : ""}
                  {v.name} ({v.gstin || "Unregistered"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Status</label>
            <select
              value={poData.status || "Draft"}
              onChange={(e) => setPoData({ ...poData, status: e.target.value as POType["status"] })}
              className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
            >
              <option value="Draft">Draft</option>
              <option value="Issued">Issued</option>
              <option value="Sent">Sent</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {poData.vendor_name && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs flex flex-col sm:flex-row justify-between gap-2">
            <div>
              <div className="font-bold text-amber-400">
                {poData.vendor_code ? `${poData.vendor_code} — ` : ""}
                {poData.vendor_name}
              </div>
              <div className={`text-[11px] mt-0.5 ${labelColor}`}>{poData.vendor_address || "-"}</div>
              <div className={`text-[11px] mt-0.5 ${labelColor}`}>
                State: {poData.vendor_state || "-"} {poData.vendor_state_code ? `(${poData.vendor_state_code})` : ""}
              </div>
            </div>
            <div className={`text-[11px] sm:text-right ${labelColor}`}>
              <div>GSTIN: <span className="font-mono font-bold text-amber-400">{poData.vendor_gstin || "-"}</span></div>
              <div>Contact: {poData.vendor_contact || "-"}</div>
              <div>Email: {poData.vendor_email || "-"}</div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Independent PO Line Items Table */}
      <div className={`w-full max-w-[210mm] mx-auto p-4 ${cardBg} border rounded-xl no-print space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
            Purchase Order Line Items ({(poData.items || []).length})
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleImportFromQuotation}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                isDark ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20" : "border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
              title="Copy items from selected or active Quotation into this PO"
            >
              <Download className="w-3.5 h-3.5" /> Import Items from Quotation
            </button>
            <button
              type="button"
              onClick={addPoItem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Line Item
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className={`border-b text-[10px] uppercase ${labelColor} ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                <th className="py-2 px-2 w-8 text-center">#</th>
                <th className="py-2 px-2 min-w-[240px]">Item Name &amp; Description</th>
                <th className="py-2 px-2 w-24">HSN/SAC</th>
                <th className="py-2 px-2 w-28">Size</th>
                <th className="py-2 px-2 w-16 text-center">Qty</th>
                <th className="py-2 px-2 w-16 text-center">Unit</th>
                <th className="py-2 px-2 w-24 text-right">Purchase Rate</th>
                <th className="py-2 px-2 w-24 text-right">Amount</th>
                <th className="py-2 px-2 w-24 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-zinc-800" : "divide-zinc-200"}`}>
              {(poData.items || []).map((it, idx) => (
                <tr key={it.id || idx}>
                  <td className={`py-2 px-2 text-center font-bold ${labelColor}`}>{idx + 1}</td>
                  <td className="py-2 px-2">
                    <div className="space-y-1">
                      <textarea
                        ref={(el) => {
                          itemTextareaRefs.current[idx] = el;
                        }}
                        rows={2}
                        value={it.name}
                        onChange={(e) => updatePoItem(idx, "name", e.target.value)}
                        onKeyDown={(e) => handleBulletKeyDown(e, it.name || "", (val) => updatePoItem(idx, "name", val))}
                        placeholder="Item Name&#10;• Specification / detail"
                        className={`w-full ${inputBg} border rounded p-2 text-xs`}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          insertBulletAtCursor(itemTextareaRefs.current[idx] || null, it.name || "", (val) =>
                            updatePoItem(idx, "name", val)
                          )
                        }
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border cursor-pointer ${
                          isDark ? "border-zinc-700 text-zinc-300 hover:bg-zinc-800" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                        }`}
                      >
                        + Add Bullet
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={it.hsn || ""}
                      onChange={(e) => updatePoItem(idx, "hsn", e.target.value)}
                      className={`w-full ${inputBg} border rounded px-2 py-1 font-mono`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={it.size || ""}
                      onChange={(e) => updatePoItem(idx, "size", e.target.value)}
                      className={`w-full ${inputBg} border rounded px-2 py-1`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      value={it.qty ?? ""}
                      onChange={(e) => updatePoItem(idx, "qty", e.target.value)}
                      className={`w-full ${inputBg} border rounded px-2 py-1 text-center font-bold`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={it.unit || "Nos"}
                      onChange={(e) => updatePoItem(idx, "unit", e.target.value)}
                      className={`w-full ${inputBg} border rounded px-2 py-1 text-center`}
                    />
                  </td>
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="0"
                      value={(it.rate ?? it.price) || ""}
                      onChange={(e) => updatePoItem(idx, "rate", e.target.value)}
                      className={`w-full ${inputBg} border rounded px-2 py-1 text-right font-mono`}
                    />
                  </td>
                  <td className="py-2 px-2 text-right font-mono font-bold">{inr.format(it.amount || 0)}</td>
                  <td className="py-2 px-2">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={() => movePoItem(idx, -1)} className="p-1 opacity-70 hover:opacity-100 cursor-pointer" title="Move Up">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => movePoItem(idx, 1)} className="p-1 opacity-70 hover:opacity-100 cursor-pointer" title="Move Down">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => duplicatePoItem(idx)} className="p-1 opacity-70 hover:opacity-100 cursor-pointer" title="Duplicate">
                        <Copy className="w-3 h-3" />
                      </button>
                      {(poData.items || []).length > 1 && (
                        <button type="button" onClick={() => removePoItem(idx)} className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer" title="Remove">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Collapsible Commercial, Delivery, Terms & Financial Summary */}
      <div className={`w-full max-w-[210mm] mx-auto p-4 ${cardBg} border rounded-xl no-print space-y-3`}>
        <button
          type="button"
          onClick={() => setShowCommercial((s) => !s)}
          className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider cursor-pointer"
        >
          <span>Commercial, Delivery, Terms &amp; Financial Summary</span>
          {showCommercial ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showCommercial && (
          <div className="space-y-4 pt-2 border-t border-zinc-800/60 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Delivery Period</label>
                <input
                  type="text"
                  value={poData.delivery_date || ""}
                  onChange={(e) => setPoData({ ...poData, delivery_date: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Payment Terms</label>
                <input
                  type="text"
                  value={poData.payment_terms || ""}
                  onChange={(e) => setPoData({ ...poData, payment_terms: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Freight</label>
                <input
                  type="text"
                  value={poData.freight || ""}
                  onChange={(e) => setPoData({ ...poData, freight: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Packaging</label>
                <input
                  type="text"
                  value={poData.packaging || ""}
                  onChange={(e) => setPoData({ ...poData, packaging: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Installation</label>
                <input
                  type="text"
                  value={poData.installation || ""}
                  onChange={(e) => setPoData({ ...poData, installation: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Delivery Location</label>
                <input
                  type="text"
                  value={poData.delivery_location || ""}
                  onChange={(e) => setPoData({ ...poData, delivery_location: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Additional Charges (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={poData.additional_charges ?? 0}
                  onChange={(e) => setPoData((prev) => recompute({ ...prev, additional_charges: Number(e.target.value) || 0 }))}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Discount (₹)</label>
                <input
                  type="number"
                  min="0"
                  value={poData.discount ?? 0}
                  onChange={(e) => setPoData((prev) => recompute({ ...prev, discount: Number(e.target.value) || 0 }))}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2 font-mono`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>GST Rate (%)</label>
                <select
                  value={String(Math.round((poData.tax_rate ?? 0.18) * 100))}
                  onChange={(e) => setPoData((prev) => recompute({ ...prev, tax_rate: Number(e.target.value) / 100 }))}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                >
                  <option value="0">0% (Exempt)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Internal Remarks (Not Printed)</label>
                <input
                  type="text"
                  value={poData.internal_remarks || ""}
                  onChange={(e) => setPoData({ ...poData, internal_remarks: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg px-2.5 py-2`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Purchase Order Terms</label>
                <textarea
                  rows={5}
                  value={poData.terms ?? DEFAULT_PO_TERMS}
                  onChange={(e) => setPoData({ ...poData, terms: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg p-2.5 text-xs`}
                />
              </div>
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${labelColor}`}>Instructions to Vendor</label>
                <textarea
                  rows={5}
                  value={poData.instructions ?? DEFAULT_PO_INSTRUCTIONS}
                  onChange={(e) => setPoData({ ...poData, instructions: e.target.value })}
                  className={`w-full ${inputBg} border rounded-lg p-2.5 text-xs`}
                />
              </div>
              <div className={`p-3 rounded-lg border ${isDark ? "border-zinc-800 bg-black/40" : "border-zinc-200 bg-zinc-50"} space-y-1.5`}>
                <div className="font-bold uppercase text-[11px] mb-2">Financial Summary</div>
                <div className="flex justify-between"><span>Subtotal:</span><span className="font-mono">{inr.format(fin.subtotal)}</span></div>
                <div className="flex justify-between"><span>Additional Charges:</span><span className="font-mono">{inr.format(fin.additional_charges)}</span></div>
                <div className="flex justify-between"><span>Discount:</span><span className="font-mono">-{inr.format(fin.discount)}</span></div>
                <div className="flex justify-between font-semibold border-t border-zinc-800/50 pt-1">
                  <span>Taxable Amount:</span><span className="font-mono">{inr.format(fin.taxable_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST ({Math.round(fin.tax_rate * 100)}%):</span><span className="font-mono">{inr.format(fin.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-black text-sm border-t border-zinc-800/50 pt-1.5">
                  <span>Grand Total:</span><span className="font-mono text-amber-400">{inr.format(fin.total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Approved A4 Purchase Order Live Preview */}
      {showPreview && (
        <div className="w-full overflow-x-auto pb-6">
          <PurchaseOrderPreview po={recompute(poData)} company={company} />
        </div>
      )}
    </div>
  );
}
