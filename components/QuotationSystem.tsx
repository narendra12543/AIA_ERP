"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText,
  Settings,
  Layers,
  FileCheck,
  Receipt,
  ShoppingCart,
  Database,
  FileCode2,
  Printer,
  Save,
  Plus,
  Trash2,
  Download,
  Share2,
  Image as ImageIcon,
  RotateCcw,
  Upload,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Search,
  Check,
  X,
  ChevronsUpDown,
  Loader2,
  Mail,
} from "lucide-react";
import { Client, CompanyInfo, Quotation, QuotationItem, SpecProfile, Vendor } from "../lib/types";
import { handleBulletKeyDown, insertBulletAtCursor } from "../lib/bullet-helper";
import {
  calculateTotals,
  formatIsoToDdMmYyyy,
  inr,
  isIntraState,
  nextPONumber,
  nextQuotationNo,
  numberToWordsINR,
  resolveTechnicalProfileName,
} from "../lib/vba-engine";
import CommercialOffer from "./CommercialOffer";
import Page1Technical from "./Page1Technical";
import ProformaInvoice from "./ProformaInvoice";
import TaxInvoice from "./TaxInvoice";
import PurchaseOrder, { POData } from "./PurchaseOrder";
import PurchaseOrderForm from "./PurchaseOrderForm";
import DatabaseView from "./DatabaseView";
import SpecProfilesView from "./SpecProfilesView";

interface QuotationSystemProps {
  currentQuote: Quotation;
  company: CompanyInfo;
  allQuotations: Quotation[];
  specProfiles: SpecProfile[];
  theme?: "dark" | "light";
  vendors?: Vendor[];
  onOpenVendorModal?: () => void;
  onUpdateSpecProfiles?: (profiles: SpecProfile[]) => void;
  onUpdateQuote: (quote: Quotation) => void;
  onSaveQuote: (quote: Quotation) => void;
  onNewQuote: () => void;
  onReviseQuote?: () => void;
  onDeleteQuote?: (id: string) => void;
  onUpdateCompany?: (company: CompanyInfo) => void;
  onPrintBothPages: () => void;
  onPrintSinglePage: (tabKey: string) => void;
  onEmailDocument?: (docKind: "quotation" | "pi" | "ti" | "po") => void;
  canSendEmail?: boolean;
  canExportPdf?: boolean;
}

export type SheetTab =
  | "dashboard"
  | "page1"
  | "table2"
  | "pi"
  | "ti"
  | "po"
  | "database"
  | "spec_profiles";

const INDIAN_STATES = [
  "27-Maharashtra",
  "24-Gujarat",
  "29-Karnataka",
  "07-Delhi",
  "09-Uttar Pradesh",
  "08-Rajasthan",
  "19-West Bengal",
  "33-Tamil Nadu",
  "36-Telangana",
  "37-Andhra Pradesh",
  "23-Madhya Pradesh",
  "03-Punjab",
  "06-Haryana",
  "10-Bihar",
  "21-Odisha",
  "20-Jharkhand",
  "22-Chhattisgarh",
  "05-Uttarakhand",
  "02-Himachal Pradesh",
  "01-Jammu and Kashmir",
  "32-Kerala",
  "30-Goa",
];

function parseQuotationSortParts(quotationNo: string): { fy: number; serial: number; rev: number; raw: string } {
  const raw = (quotationNo || "").trim();
  const match = raw.match(/^(\d{2})-(\d{2})\/[^/]+\/(\d+)(?:-R(\d+))?/i);
  if (match) {
    return {
      fy: parseInt(match[1], 10) * 100 + parseInt(match[2], 10),
      serial: parseInt(match[3], 10),
      rev: match[4] ? parseInt(match[4], 10) : 0,
      raw,
    };
  }
  const numMatch = raw.match(/(\d+)(?:-R(\d+))?$/i);
  return {
    fy: 0,
    serial: numMatch ? parseInt(numMatch[1], 10) : 0,
    rev: numMatch && numMatch[2] ? parseInt(numMatch[2], 10) : 0,
    raw,
  };
}

function sortQuotationsDesc(a: Quotation, b: Quotation): number {
  const pa = parseQuotationSortParts(a.quotation_no);
  const pb = parseQuotationSortParts(b.quotation_no);
  if (pb.fy !== pa.fy) return pb.fy - pa.fy;
  if (pb.serial !== pa.serial) return pb.serial - pa.serial;
  if (pb.rev !== pa.rev) return pb.rev - pa.rev;
  return pb.raw.localeCompare(pa.raw);
}

export default function QuotationSystem({
  currentQuote,
  company,
  allQuotations,
  specProfiles,
  theme = "dark",
  vendors = [],
  onOpenVendorModal,
  onUpdateSpecProfiles,
  onUpdateQuote,
  onSaveQuote,
  onNewQuote,
  onReviseQuote,
  onDeleteQuote,
  onUpdateCompany,
  onPrintBothPages,
  onPrintSinglePage,
  onEmailDocument,
  canSendEmail = true,
  canExportPdf = true,
}: QuotationSystemProps) {
  const isDark = theme === "dark";
  const [activeTab, setActiveTab] = useState<SheetTab>("dashboard");
  const [selectedProfileName, setSelectedProfileName] = useState<string>(
    resolveTechnicalProfileName(currentQuote, specProfiles) || ""
  );
  const [poVendorSearch, setPoVendorSearch] = useState<string>("");

  useEffect(() => {
    const profName = resolveTechnicalProfileName(currentQuote, specProfiles);
    setSelectedProfileName(profName || "");
  }, [currentQuote.quotation_no, currentQuote.product_type, currentQuote.spec_profile_id, specProfiles]);

  // Existing Client Combobox & Search States
  const [availableClients, setAvailableClients] = useState<Client[]>([]);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [isClientLoading, setIsClientLoading] = useState(false);
  const [highlightedClientIdx, setHighlightedClientIdx] = useState(0);
  const clientDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch Clients from authoritative API
  useEffect(() => {
    let isMounted = true;
    setIsClientLoading(true);
    fetch("/api/clients")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Client[]) => {
        if (isMounted && Array.isArray(data)) {
          setAvailableClients(data);
        }
      })
      .catch((err) => console.warn("Failed to load clients:", err))
      .finally(() => {
        if (isMounted) setIsClientLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        clientDropdownRef.current &&
        !clientDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClientDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredClients = useMemo(() => {
    const q = (currentQuote.client_name || "").trim().toLowerCase();
    if (!q) return availableClients.slice(0, 10);
    return availableClients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.contact && c.contact.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q))
      )
      .slice(0, 10);
  }, [availableClients, currentQuote.client_name]);

  function handleSelectClient(client: Client) {
    const pos = client.place_of_supply || "27-Maharashtra";
    const isIntra = isIntraState(pos);

    const updated: Quotation = {
      ...currentQuote,
      client_name: client.name,
      client_header: client.header || `To, ${client.name}${client.address ? `, ${client.address}` : ""}`,
      client_contact: client.contact || "",
      client_email: client.email || "",
      client_gstin: client.gstin || "",
      client_address: client.address || "",
      place_of_supply: pos,
      state: pos,
      is_maharashtra: isIntra,
    };

    const fin = calculateTotals(updated.items, isIntra);
    updated.subtotal = fin.subtotal;
    updated.tax_amount = fin.tax_amount;
    updated.cgst = fin.cgst;
    updated.sgst = fin.sgst;
    updated.igst = fin.igst;
    updated.round_off = fin.round_off;
    updated.total = fin.total;
    updated.amount_words = fin.amount_words;

    onUpdateQuote(updated);
    setIsClientDropdownOpen(false);
  }

  function handleClearClient() {
    updateField("client_name", "");
    updateField("client_contact", "");
    updateField("client_email", "");
    updateField("client_gstin", "");
    updateField("client_address", "");
    updateField("client_header", "To, ");
  }
  const [statusMessage, setStatusMessage] = useState<string>(
    `Status: Loaded - ${currentQuote.quotation_no}`
  );
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(company);
  const [companySaveStatus, setCompanySaveStatus] = useState("");

  useEffect(() => {
    if (company) {
      setCompanyInfo(company);
    }
  }, [company]);

  function updateCompanyField<K extends keyof CompanyInfo>(key: K, val: CompanyInfo[K]) {
    const updated = { ...companyInfo, [key]: val };
    setCompanyInfo(updated);
    onUpdateCompany?.(updated);
  }

  async function handleSaveCompany() {
    try {
      await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(companyInfo),
      });
      onUpdateCompany?.(companyInfo);
      setCompanySaveStatus("Saved to database");
      setTimeout(() => setCompanySaveStatus(""), 4000);
    } catch (e) {
      console.warn("Failed to persist company", e);
    }
  }

  // Dedicated PO Vendor State - Strictly separate from Client/Customer data
  const defaultVendor =
    vendors && vendors.length > 0
      ? vendors.find((v) => (v.approval_status || "Approved") === "Approved" && (v.operational_status || "Active") === "Active") || null
      : null;

  const [poData, setPoData] = useState<POData>({
    po_number: nextPONumber([]),
    po_date: new Date().toISOString().slice(0, 10),
    delivery_date: "Within 4 weeks",
    payment_terms: defaultVendor?.payment_terms || "Advance",
    project_ref: "",
    vendor_id: defaultVendor?.id || "",
    vendor_code: defaultVendor?.vendor_code || "",
    vendor_name: defaultVendor?.name || "",
    vendor_address: defaultVendor?.address || "",
    vendor_gstin: defaultVendor?.gstin || "",
    vendor_contact: defaultVendor?.phone || "",
    vendor_email: defaultVendor?.email || "",
    vendor_state: defaultVendor?.state || "",
    vendor_state_code: defaultVendor?.state_code || "",
    items: [{ id: "po_it_init", name: "", hsn: "", size: "", qty: 1, unit: "Nos", rate: 0, amount: 0 }],
    subtotal: 0,
    tax_rate: 0.18,
    tax_amount: 0,
    total: 0,
    terms: "1. Goods to be delivered strictly in accordance with specifications.\n2. Invoice must state this PO Number.\n3. Payment as per agreed credit terms.",
    instructions: "Inspect all items before dispatch to avoid quality disputes.\nE-way bill is required for consignments exceeding statutory threshold.",
    status: "Draft",
  });

  const [isSavingQuote, setIsSavingQuote] = useState(false);
  const [isPrintingPdf, setIsPrintingPdf] = useState(false);
  const commercialItemRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  // Handle direct field updates with VBA auto-sync logic
  function updateField<K extends keyof Quotation>(key: K, val: Quotation[K]) {
    const updated = { ...currentQuote, [key]: val };

    // Auto-generate Client Header Line & Subject if client name or address changes
    if (key === "client_name" || key === "client_address") {
      const cName = key === "client_name" ? String(val) : updated.client_name;
      const cAddr = key === "client_address" ? String(val) : updated.client_address;
      updated.client_header = `To, ${cName}${cAddr ? `, ${cAddr}` : ""}`;
    }

    if (key === "product_type") {
      updated.subject = `Quotation for ${val}.`;
    }

    // Auto-sync Payment Terms across PI and quote description terms
    if (key === "payment_terms" || key === "pi_payment_terms") {
      const termVal = String(val).toLowerCase().includes("immediate") ? "Immediate" : "Advance";
      updated.payment_terms = termVal;
      updated.pi_payment_terms = termVal;
      if (updated.terms && /payment\s*terms/i.test(updated.terms)) {
        updated.terms = updated.terms.replace(/(•\s*Payment Terms:\s*)([^\r\n]+)/i, `$1${termVal}`);
      }
    }

    // Recalculate intra-state vs inter-state atomically
    if (key === "state" || key === "place_of_supply") {
      const stateStr = String(val || "27-Maharashtra");
      updated.place_of_supply = stateStr;
      updated.state = stateStr;
      updated.is_maharashtra = isIntraState(stateStr);
    } else if (key === "client_address" && !updated.place_of_supply && !updated.state) {
      const stateStr = String(val);
      updated.is_maharashtra = isIntraState(stateStr);
    }

    // Recalculate financial totals with authoritative intra-state check
    const isIntra = isIntraState(updated.place_of_supply || updated.state || "27-Maharashtra");
    updated.is_maharashtra = isIntra;
    const fin = calculateTotals(updated.items, isIntra);
    updated.subtotal = fin.subtotal;
    updated.tax_amount = fin.tax_amount;
    updated.cgst = fin.cgst;
    updated.sgst = fin.sgst;
    updated.igst = fin.igst;
    updated.round_off = fin.round_off;
    updated.total = fin.total;
    updated.amount_words = fin.amount_words;

    onUpdateQuote(updated);
  }

  // Handle item change
  function handleItemChange(index: number, field: keyof QuotationItem, val: any) {
    const newItems = [...currentQuote.items];
    const item = { ...newItems[index], [field]: val };

    if (field === "qty" || field === "price") {
      const q = field === "qty" ? Number(val) : Number(item.qty);
      const p = field === "price" ? Number(val) : Number(item.price);
      item.amount = (q || 0) * (p || 0);
    }
    newItems[index] = item;

    const fin = calculateTotals(newItems, currentQuote.is_maharashtra);
    const updated: Quotation = {
      ...currentQuote,
      items: newItems,
      ...fin,
    };
    onUpdateQuote(updated);
  }

  // Add Item
  function addItem() {
    const newItem: QuotationItem = {
      id: "it_" + Date.now(),
      name: "",
      hsn: "",
      size: "",
      qty: 1,
      unit: "Nos",
      price: 0,
      amount: 0,
    };
    const newItems = [...currentQuote.items, newItem];
    const fin = calculateTotals(newItems, currentQuote.is_maharashtra);
    onUpdateQuote({
      ...currentQuote,
      items: newItems,
      ...fin,
    });
  }

  // Delete Item
  function deleteItem(index: number) {
    if (currentQuote.items.length <= 1) return;
    const newItems = currentQuote.items.filter((_, i) => i !== index);
    const fin = calculateTotals(newItems, currentQuote.is_maharashtra);
    onUpdateQuote({
      ...currentQuote,
      items: newItems,
      ...fin,
    });
  }

  // Apply Spec Profile to Quote
  function applyProfile(profile: SpecProfile) {
    updateField("spec_profile_id", profile.id || profile.name);
    updateField("product_type", profile.name);
    updateField("technical_specs", profile.specs);
    setSelectedProfileName(profile.name);
    setActiveTab("page1");
  }

  // Save / Update Quotation (VBA SaveQuotationToDB equivalent)
  function handleSave() {
    onSaveQuote(currentQuote);

    // If client is new or updated, ensure it is available in local client directory
    if (currentQuote.client_name && currentQuote.client_name.trim()) {
      const cName = currentQuote.client_name.trim();
      setAvailableClients((prev) => {
        const idx = prev.findIndex((c) => c.name.toLowerCase() === cName.toLowerCase());
        const clientData: Client = {
          id: idx >= 0 ? prev[idx].id : `cli_${Date.now()}`,
          name: cName,
          header: currentQuote.client_header,
          contact: currentQuote.client_contact,
          email: currentQuote.client_email,
          gstin: currentQuote.client_gstin,
          address: currentQuote.client_address,
          place_of_supply: currentQuote.place_of_supply || currentQuote.state || "27-Maharashtra",
          updated_at: new Date().toISOString(),
        };
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], ...clientData };
          return copy;
        } else {
          return [...prev, clientData].sort((a, b) => a.name.localeCompare(b.name));
        }
      });
    }

    setStatusMessage(`Status: Saved - ${currentQuote.quotation_no}`);
    setTimeout(() => {
      setStatusMessage(`Status: Ready - ${currentQuote.quotation_no}`);
    }, 3000);
  }

  // Load quote from dropdown
  function handleSelectQuoteNo(qNo: string) {
    const found = allQuotations.find((q) => q.quotation_no === qNo);
    if (found) {
      onUpdateQuote(found);
      setStatusMessage(`Status: Loaded - ${found.quotation_no}`);
    }
  }

  // Image Upload Handler
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      updateField("design_image_path", dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // UI Theme Styling Helpers
  const cardBg = isDark
    ? "bg-zinc-900/70 border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900 shadow-sm";
  const inputBg = isDark
    ? "bg-black border-zinc-700 text-white placeholder-zinc-500 focus:border-zinc-500"
    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500";
  const labelColor = isDark ? "text-zinc-200 font-semibold" : "text-zinc-800 font-bold";
  const navBg = isDark ? "bg-[#09090b] border-zinc-800" : "bg-white border-zinc-200";

  return (
    <div className="w-full flex-1 flex flex-col space-y-4">
      {/* ============================================================ */}
      {/* SUB-TABS NAVIGATION BAR                                      */}
      {/* ============================================================ */}
      <div className={`${navBg} border-b px-3 sm:px-6 pt-2 sticky top-16 z-20 flex items-center justify-between no-print overflow-x-auto gap-4`}>
        <div className="flex items-center gap-1 text-xs font-semibold whitespace-nowrap">
          {/* Tab 1: Dashboard */}
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "dashboard"
                ? isDark
                  ? "border-emerald-500 text-emerald-400 bg-zinc-900/70"
                  : "border-blue-600 text-blue-600 bg-blue-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Dashboard</span>
          </button>

          {/* Tab 2: Page 1 (Technical) */}
          <button
            onClick={() => setActiveTab("page1")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "page1"
                ? isDark
                  ? "border-blue-500 text-blue-400 bg-zinc-900/70"
                  : "border-blue-600 text-blue-600 bg-blue-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Page 1 (Technical)</span>
          </button>

          {/* Tab 3: Table 2 (Commercial Offer) */}
          <button
            onClick={() => setActiveTab("table2")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "table2"
                ? isDark
                  ? "border-emerald-500 text-emerald-400 bg-zinc-900/70"
                  : "border-emerald-600 text-emerald-600 bg-emerald-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Commercial Offer</span>
          </button>

          {/* Tab 4: Proforma Invoice */}
          <button
            onClick={() => setActiveTab("pi")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "pi"
                ? isDark
                  ? "border-purple-500 text-purple-400 bg-zinc-900/70"
                  : "border-purple-600 text-purple-600 bg-purple-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Proforma Invoice</span>
          </button>

          {/* Tab 5: Tax Invoice */}
          <button
            onClick={() => setActiveTab("ti")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "ti"
                ? isDark
                  ? "border-emerald-500 text-emerald-400 bg-zinc-900/70"
                  : "border-emerald-600 text-emerald-600 bg-emerald-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Tax Invoice</span>
          </button>

          {/* Tab 6: Purchase Order */}
          <button
            onClick={() => setActiveTab("po")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "po"
                ? isDark
                  ? "border-amber-500 text-amber-400 bg-zinc-900/70"
                  : "border-amber-600 text-amber-600 bg-amber-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Purchase Order</span>
          </button>

          {/* Tab 7: Database */}
          <button
            onClick={() => setActiveTab("database")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "database"
                ? isDark
                  ? "border-indigo-500 text-indigo-400 bg-zinc-900/70"
                  : "border-indigo-600 text-indigo-600 bg-indigo-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Database</span>
          </button>

          {/* Tab 8: Spec Profiles */}
          <button
            onClick={() => setActiveTab("spec_profiles")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg transition border-b-2 font-bold cursor-pointer ${
              activeTab === "spec_profiles"
                ? isDark
                  ? "border-cyan-500 text-cyan-400 bg-zinc-900/70"
                  : "border-cyan-600 text-cyan-600 bg-cyan-50/50"
                : isDark
                ? "border-transparent text-zinc-400 hover:text-white"
                : "border-transparent text-zinc-600 hover:text-black"
            }`}
          >
            <FileCode2 className="w-4 h-4" />
            <span>Spec Profiles</span>
          </button>
        </div>

        {/* Right Tab PDF Quick Action */}
        <div className="flex items-center gap-2 pb-2">
          {activeTab === "pi" ? (
            <button
              onClick={() => onPrintSinglePage("pi")}
              className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
              title="Save Official Proforma Invoice PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save PI (PDF)</span>
            </button>
          ) : activeTab === "ti" ? (
            <button
              onClick={() => onPrintSinglePage("ti")}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
              title="Save Official Tax Invoice PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save Tax Invoice (PDF)</span>
            </button>
          ) : activeTab === "po" ? (
            <button
              onClick={() => onPrintSinglePage("po")}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
              title="Save Official Purchase Order PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save PO (PDF)</span>
            </button>
          ) : (
            <button
              onClick={onPrintBothPages}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
              title="Save Official 2-Page Quotation PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Save Quotation (PDF)</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MAIN VIEW CONTENT                                            */}
      {/* ============================================================ */}
      <div className="w-full px-3 sm:px-6 py-4 flex-1">
        {/* ============================================================ */}
        {/* TAB 1: DASHBOARD INPUT CONTROL SHEET                         */}
        {/* ============================================================ */}
        {activeTab === "dashboard" && (
          <div className="w-full space-y-6">
            {/* Top Status & Action Bar */}
            <div className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 ${cardBg} border rounded-xl`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-bold ${labelColor} uppercase tracking-wider`}>
                  STATUS:
                </span>
                <span className="px-3 py-1 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/80 font-mono text-xs font-bold">
                  {statusMessage}
                </span>

                {/* SELECT EXISTING QUOTATION */}
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-xs ${labelColor} font-semibold uppercase`}>
                    Select Existing:
                  </span>
                  <select
                    value={currentQuote.quotation_no}
                    onChange={(e) => handleSelectQuoteNo(e.target.value)}
                    className={`${inputBg} border rounded px-3 py-1.5 text-xs font-mono max-w-xs truncate`}
                  >
                    {[...allQuotations].sort(sortQuotationsDesc).map((q) => (
                      <option key={q.quotation_no} value={q.quotation_no}>
                        {q.client_name ? `${q.client_name} | ` : ""}{q.quotation_no}
                        {q.quotation_no.includes("-R") ? ` [Rev ${q.quotation_no.split("-R")[1]}]` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action Buttons: New, Revise, Save, Generate PDF */}
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={onNewQuote}
                  className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] ${isDark ? "bg-black hover:bg-zinc-800 active:bg-zinc-900 text-white border-zinc-700" : "bg-white hover:bg-zinc-100 active:bg-zinc-200 text-zinc-900 border-zinc-300 shadow-sm"} border font-bold text-xs px-3.5 py-2 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 cursor-pointer`}
                  title="Create a new fresh quotation with next serial number"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">+ NEW QUOTATION</span>
                </button>

                {onReviseQuote && (
                  <button
                    type="button"
                    onClick={onReviseQuote}
                    className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                    title="Create a new revision of this quotation (e.g. -R1, -R2)"
                  >
                    <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">REVISE QUOTATION</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSavingQuote}
                  onClick={async () => {
                    if (isSavingQuote) return;
                    setIsSavingQuote(true);
                    try {
                      await Promise.resolve(handleSave());
                    } finally {
                      setTimeout(() => setIsSavingQuote(false), 350);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
                >
                  <Save className={`w-3.5 h-3.5 shrink-0 ${isSavingQuote ? "animate-pulse" : ""}`} />
                  <span className="truncate">{isSavingQuote ? "Saving..." : "SAVE / UPDATE"}</span>
                </button>

                <button
                  type="button"
                  disabled={isPrintingPdf}
                  onClick={async () => {
                    if (isPrintingPdf) return;
                    setIsPrintingPdf(true);
                    try {
                      await Promise.resolve(onPrintBothPages());
                    } finally {
                      setTimeout(() => setIsPrintingPdf(false), 800);
                    }
                  }}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:min-h-[38px] bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-lg shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <Printer className={`w-3.5 h-3.5 shrink-0 ${isPrintingPdf ? "animate-pulse" : ""}`} />
                  <span className="truncate">{isPrintingPdf ? "Generating PDF..." : "GENERATE PDF"}</span>
                </button>
              </div>
            </div>

            {/* Section 1: Quotation Header & Client Information */}
            <div className={`${cardBg} border rounded-xl p-5 space-y-4`}>
              <div className="border-b pb-2 flex items-center justify-between">
                <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                  QUOTATION HEADER & CLIENT INFORMATION
                </h3>
                {currentQuote.quotation_no.includes("-R") && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                    REVISED VERSION ({currentQuote.quotation_no})
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Quotation No
                  </label>
                  <input
                    type="text"
                    value={currentQuote.quotation_no}
                    onChange={(e) => updateField("quotation_no", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-bold`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Date
                  </label>
                  <input
                    type="date"
                    value={currentQuote.date}
                    onChange={(e) => updateField("date", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client Header Line (Page 1 "To,")
                  </label>
                  <input
                    type="text"
                    value={currentQuote.client_header || ""}
                    onChange={(e) => updateField("client_header", e.target.value)}
                    placeholder="To, Mr. Rahul Patil, Metalmind Engineering, Kolhapur."
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-semibold`}
                  />
                </div>

                <div ref={clientDropdownRef} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[11px] font-semibold ${labelColor}`}>
                      Client Company Name *
                    </label>
                    {currentQuote.client_name && (
                      <button
                        type="button"
                        onClick={handleClearClient}
                        className="text-[10px] text-zinc-400 hover:text-rose-400 transition cursor-pointer flex items-center gap-0.5"
                        title="Clear client fields"
                      >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="text"
                      value={currentQuote.client_name}
                      onFocus={() => setIsClientDropdownOpen(true)}
                      onChange={(e) => {
                        updateField("client_name", e.target.value);
                        setIsClientDropdownOpen(true);
                      }}
                      onKeyDown={(e) => {
                        if (!isClientDropdownOpen) {
                          if (e.key === "ArrowDown") setIsClientDropdownOpen(true);
                          return;
                        }
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setHighlightedClientIdx((prev) => (prev + 1) % Math.max(1, filteredClients.length));
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setHighlightedClientIdx((prev) => (prev - 1 + filteredClients.length) % Math.max(1, filteredClients.length));
                        } else if (e.key === "Enter") {
                          if (filteredClients[highlightedClientIdx]) {
                            e.preventDefault();
                            handleSelectClient(filteredClients[highlightedClientIdx]);
                          }
                        } else if (e.key === "Escape") {
                          setIsClientDropdownOpen(false);
                        }
                      }}
                      placeholder="Search existing client or type new..."
                      className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-bold pr-8`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none text-zinc-400">
                      {isClientLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                      ) : (
                        <ChevronsUpDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </div>

                  {/* Searchable Combobox Popover Dropdown */}
                  {isClientDropdownOpen && (
                    <div
                      className={`absolute left-0 right-0 top-full mt-1 z-50 rounded-lg shadow-xl border overflow-hidden ${
                        isDark ? "bg-zinc-900 border-zinc-700 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
                      } max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1`}
                    >
                      <div className={`p-1.5 border-b text-[10px] font-semibold flex items-center justify-between ${
                        isDark ? "bg-zinc-950/80 border-zinc-800 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-500"
                      }`}>
                        <span>Existing Client Directory ({availableClients.length})</span>
                        <span className="text-[9px]">Select to auto-fetch details</span>
                      </div>

                      {filteredClients.length > 0 ? (
                        filteredClients.map((client, idx) => {
                          const isHighlighted = idx === highlightedClientIdx;
                          const isSelected = client.name.toLowerCase() === (currentQuote.client_name || "").toLowerCase();

                          return (
                            <div
                              key={client.id || idx}
                              onMouseEnter={() => setHighlightedClientIdx(idx)}
                              onClick={() => handleSelectClient(client)}
                              className={`px-3 py-2 text-xs cursor-pointer border-b last:border-b-0 transition flex items-start justify-between gap-2 ${
                                isHighlighted
                                  ? isDark ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900"
                                  : isDark ? "hover:bg-zinc-800/60 border-zinc-800/50" : "hover:bg-zinc-50 border-zinc-100"
                              } ${isSelected ? "font-bold" : ""}`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                  <span className="truncate font-semibold text-xs">{client.name}</span>
                                  {isSelected && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                </div>
                                {(client.address || client.contact) && (
                                  <p className={`text-[10px] mt-0.5 truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                                    {client.address}{client.address && client.contact ? " • " : ""}{client.contact}
                                  </p>
                                )}
                              </div>
                              {client.place_of_supply && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                  isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-100 text-zinc-600"
                                }`}>
                                  {client.place_of_supply.split("-")[1] || client.place_of_supply}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-3 text-center text-xs text-zinc-400">
                          <p>No existing client matches "{currentQuote.client_name}"</p>
                          <p className="text-[10px] text-zinc-500 mt-1">Keep typing to use as new client company</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client Contact No.
                  </label>
                  <input
                    type="text"
                    value={currentQuote.client_contact}
                    onChange={(e) => updateField("client_contact", e.target.value)}
                    placeholder="98765 43210"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client Email
                  </label>
                  <input
                    type="email"
                    value={currentQuote.client_email}
                    onChange={(e) => updateField("client_email", e.target.value)}
                    placeholder="client@example.com"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client GSTIN
                  </label>
                  <input
                    type="text"
                    value={currentQuote.client_gstin || ""}
                    onChange={(e) => updateField("client_gstin", e.target.value)}
                    placeholder="27XXXXXXXXXXXXX"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client Address
                  </label>
                  <input
                    type="text"
                    value={currentQuote.client_address}
                    onChange={(e) => updateField("client_address", e.target.value)}
                    placeholder="Kolhapur, Maharashtra"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Place of Supply / State
                  </label>
                  <div className="space-y-1">
                    <select
                      value={currentQuote.place_of_supply || currentQuote.state || "27-Maharashtra"}
                      onChange={(e) => {
                        updateField("place_of_supply", e.target.value);
                      }}
                      className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-medium`}
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <div className="pt-0.5">
                      {isIntraState(currentQuote.place_of_supply || currentQuote.state || "27-Maharashtra") ? (
                        <span className="text-[10px] font-bold text-emerald-500">
                          ✓ INTRA-STATE: CGST (9%) + SGST (9%)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-blue-500">
                          ✓ INTER-STATE: IGST (18%)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Subject Line
                  </label>
                  <input
                    type="text"
                    value={currentQuote.subject}
                    onChange={(e) => updateField("subject", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-medium`}
                  />
                </div>

                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Technical Spec Profile
                  </label>
                  <select
                    value={selectedProfileName}
                    onChange={(e) => {
                      const prof = specProfiles.find((p) => p.name === e.target.value);
                      if (prof) applyProfile(prof);
                    }}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  >
                    <option value="" className={isDark ? "bg-zinc-900 text-zinc-400" : "bg-white text-zinc-500"}>
                      Select Technical Profile...
                    </option>
                    {specProfiles.map((p) => (
                      <option
                        key={p.name}
                        value={p.name}
                        className={isDark ? "bg-zinc-900 text-white" : "bg-white text-zinc-900"}
                      >
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 1b: Product Image Management for Page 1 */}
            <div className={`${cardBg} border rounded-xl p-5 space-y-3`}>
              <div className="border-b pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-emerald-500" />
                  <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                    PRODUCT / SYSTEM DESIGN IMAGE (PAGE 1)
                  </h3>
                </div>
                {/* <span className="text-[11px] text-zinc-400">
                  Each quotation stores its own unique design image
                </span> */}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="w-48 h-28 border border-zinc-700 rounded-lg p-1.5 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  <img
                    src={currentQuote.design_image_path || "/assets/default_gate.png"}
                    alt="Quotation Gate Design"
                    className="max-h-full max-w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/default_gate.png";
                    }}
                  />
                </div>

                <div className="flex-1 space-y-2 text-xs">
                  <p className={labelColor}>
                    Upload a high-resolution photo, architectural drawing, or CAD design for this quotation. The image preserves its aspect ratio and scales crisply across Page 1.
                  </p>
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <label className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition shadow-sm">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Product Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                      />
                    </label>

                    <button
                      onClick={() => updateField("design_image_path", "/assets/default_gate.png")}
                      className={`flex items-center gap-1.5 ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-300" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-300"} font-medium text-xs px-3 py-1.5 rounded-lg transition cursor-pointer`}
                      title="Reset to default Aven motorised gate drawing"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset to Default</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 1c: ORDER, PROFORMA & TAX INVOICE DETAILS (AUTO-LINKED TO ACTIVE QUOTATION) */}
            <div className={`${cardBg} border rounded-xl p-5 space-y-4`}>
              <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-purple-400" />
                  <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                    ORDER, PROFORMA & TAX INVOICE DETAILS (AUTO-LINKED)
                  </h3>
                </div>
                {/* <span className="text-[10px] text-zinc-400">
                  Excel Columns 58–71 &bull; Auto-links to active quote {currentQuote.quotation_no}
                </span> */}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* 1. PI Number */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Proforma Invoice (PI) No.
                  </label>
                  <input
                    type="text"
                    value={currentQuote.pi_number || ""}
                    onChange={(e) => updateField("pi_number", e.target.value)}
                    placeholder="Sale_Order_2627-01"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-semibold`}
                  />
                </div>

                {/* 2. PI Date */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    PI Date
                  </label>
                  <input
                    type="date"
                    value={currentQuote.pi_date || currentQuote.date || ""}
                    onChange={(e) => updateField("pi_date", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                {/* 3. Tax Invoice Number */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Tax Invoice No.
                  </label>
                  <input
                    type="text"
                    value={currentQuote.tax_invoice_number || ""}
                    onChange={(e) => updateField("tax_invoice_number", e.target.value)}
                    placeholder="2026-27-AIA-001"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-semibold`}
                  />
                </div>

                {/* 4. Tax Invoice Date */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Tax Invoice Date
                  </label>
                  <input
                    type="date"
                    value={currentQuote.tax_invoice_date || currentQuote.date || ""}
                    onChange={(e) => updateField("tax_invoice_date", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                {/* 5. Client PO Number */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client PO Number
                  </label>
                  <input
                    type="text"
                    value={currentQuote.client_po_number || currentQuote.client_po_no || ""}
                    onChange={(e) => {
                      updateField("client_po_number", e.target.value);
                      updateField("client_po_no", e.target.value);
                    }}
                    placeholder="PO-2026-XXXX"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                {/* 6. Client PO Date */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Client PO Date
                  </label>
                  <input
                    type="date"
                    value={currentQuote.client_po_date || ""}
                    onChange={(e) => updateField("client_po_date", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>

                {/* 7. Transport Name */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Transport Name
                  </label>
                  <input
                    type="text"
                    value={currentQuote.transport_name || ""}
                    onChange={(e) => updateField("transport_name", e.target.value)}
                    placeholder="VRL / SafeX / Direct"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>

                {/* 8. Vehicle Number */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={currentQuote.vehicle_no || currentQuote.vehicle_number || ""}
                    onChange={(e) => {
                      updateField("vehicle_no", e.target.value);
                      updateField("vehicle_number", e.target.value);
                    }}
                    placeholder="MH-12-XX-0000"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono uppercase`}
                  />
                </div>

                {/* 9. Due / Delivery Date */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Due / Delivery Date
                  </label>
                  <input
                    type="text"
                    value={currentQuote.delivery_date || currentQuote.due_date || ""}
                    onChange={(e) => {
                      updateField("delivery_date", e.target.value);
                      updateField("due_date", e.target.value);
                    }}
                    placeholder="e.g. 4 Weeks / 15-12-2026"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>

                {/* 10. Advance Received (₹) */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Advance Received (₹)
                  </label>
                  <input
                    type="number"
                    value={currentQuote.advance_received !== undefined ? currentQuote.advance_received : ""}
                    onChange={(e) => updateField("advance_received", Number(e.target.value) || 0)}
                    placeholder="0"
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-bold text-emerald-400`}
                  />
                </div>

                {/* 11. Calculated Balance (₹) */}
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Calculated Balance (₹)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={inr.format(Math.max(0, (currentQuote.total || 0) - (Number(currentQuote.advance_received) || 0)))}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-bold text-amber-400 cursor-not-allowed opacity-90`}
                  />
                </div>

                {/* 11. Payment Terms (Only Advance and Immediate) */}
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className={`block text-[11px] font-semibold ${labelColor}`}>
                      Payment Terms
                    </label>
                    <span className="text-[10px] text-zinc-400">Advance / Immediate</span>
                  </div>
                  <select
                    value={
                      (currentQuote.pi_payment_terms || currentQuote.payment_terms || "").toLowerCase().includes("immediate")
                        ? "Immediate"
                        : "Advance"
                    }
                    onChange={(e) => {
                      updateField("pi_payment_terms", e.target.value);
                      updateField("payment_terms", e.target.value);
                    }}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 cursor-pointer font-medium`}
                  >
                    <option value="Advance">Advance</option>
                    <option value="Immediate">Immediate</option>
                  </select>
                </div>

                {/* 12. Ship To Address */}
                <div className="sm:col-span-4">
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>
                    Ship To / Consignee Delivery Address
                  </label>
                  <input
                    type="text"
                    value={currentQuote.ship_to_address || currentQuote.client_address || ""}
                    onChange={(e) => updateField("ship_to_address", e.target.value)}
                    placeholder="Delivery site address if different from billing..."
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>
              </div>
            </div>

            {/* Section 1d: COMPANY BRANDING & BANKING PROFILE (AUTOMATICALLY UPDATES ALL 4 PAGES) */}
            <div className={`${cardBg} border rounded-xl p-5 space-y-4`}>
              <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                    COMPANY BRANDING & BANKING PROFILE (ALL 4 DOCUMENTS)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {companySaveStatus && (
                    <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>{companySaveStatus}</span>
                    </span>
                  )}
                  <button
                    onClick={handleSaveCompany}
                    className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs px-3 py-1.5 rounded-lg border border-zinc-700 transition cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 text-amber-400" />
                    <span>Save Company Profile</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Legal Company Entity</label>
                  <input
                    type="text"
                    value={companyInfo.tagline}
                    onChange={(e) => updateCompanyField("tagline", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-bold`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Brand Operating Trade Name</label>
                  <input
                    type="text"
                    value={companyInfo.name}
                    onChange={(e) => updateCompanyField("name", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-bold`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Company GSTIN</label>
                  <input
                    type="text"
                    value={companyInfo.gstin}
                    onChange={(e) => updateCompanyField("gstin", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Company PAN</label>
                  <input
                    type="text"
                    value={companyInfo.pan}
                    onChange={(e) => updateCompanyField("pan", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Bank Name</label>
                  <input
                    type="text"
                    value={companyInfo.bank_name}
                    onChange={(e) => updateCompanyField("bank_name", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Bank Account Name</label>
                  <input
                    type="text"
                    value={companyInfo.account_name}
                    onChange={(e) => updateCompanyField("account_name", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Bank Account Number</label>
                  <input
                    type="text"
                    value={companyInfo.account_no}
                    onChange={(e) => updateCompanyField("account_no", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono font-bold`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>IFSC Code</label>
                  <input
                    type="text"
                    value={companyInfo.ifsc}
                    onChange={(e) => updateCompanyField("ifsc", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5 font-mono`}
                  />
                </div>
                <div>
                  <label className={`block text-[11px] font-semibold ${labelColor} mb-1`}>Branch Location</label>
                  <input
                    type="text"
                    value={companyInfo.branch !== undefined ? companyInfo.branch : (company.branch || "")}
                    onChange={(e) => updateCompanyField("branch", e.target.value)}
                    className={`w-full ${inputBg} border rounded px-2.5 py-1.5`}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Items Table Editor */}
            <div className={`${cardBg} border rounded-xl p-5 space-y-4`}>
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className={`text-xs font-black uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                  COMMERCIAL LINE ITEMS ({currentQuote.items.length})
                </h3>
                <button
                  onClick={addItem}
                  className={`flex items-center gap-1.5 ${isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300 shadow-sm"} font-bold text-xs px-3 py-1.5 rounded-lg border transition cursor-pointer`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Line Item</span>
                </button>
              </div>

              <div className={`border ${isDark ? "border-zinc-800" : "border-zinc-300"} rounded-lg overflow-x-auto w-full shadow-sm`}>
                <table className="w-full min-w-[920px] text-xs text-left">
                  <thead className={`${isDark ? "bg-zinc-900 text-zinc-400 border-zinc-800" : "bg-zinc-100 text-zinc-600 border-zinc-300"} font-bold uppercase text-[10px] border-b`}>
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[340px]">Item Name & Multiline Bullets</th>
                      <th className="py-2.5 px-3 w-28">HSN/SAC</th>
                      <th className="py-2.5 px-3 w-36">Size(Mtr)</th>
                      <th className="py-2.5 px-3 w-20 text-center">Quantity</th>
                      <th className="py-2.5 px-3 w-20 text-center">Unit</th>
                      <th className="py-2.5 px-3 w-32 text-right">Price/Unit (₹)</th>
                      <th className="py-2.5 px-3 w-36 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-2 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? "divide-zinc-800" : "divide-zinc-200"}`}>
                    {currentQuote.items.map((it, idx) => (
                      <tr key={it.id || idx} className={isDark ? "hover:bg-zinc-900/40" : "hover:bg-zinc-50"}>
                        <td className={`py-2 px-3 text-center font-bold ${labelColor}`}>
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 min-w-[340px]">
                          <div className="space-y-1.5">
                            <textarea
                              ref={(el) => {
                                commercialItemRefs.current[idx] = el;
                              }}
                              rows={4}
                              value={it.name}
                              onChange={(e) => handleItemChange(idx, "name", e.target.value)}
                              onKeyDown={(e) => handleBulletKeyDown(e, it.name, (val) => handleItemChange(idx, "name", val))}
                              placeholder="Motorised Sliding Folding Gate&#10;• Outer Frame: MS Square Tube - 72 x 72 mm&#10;• Intermediate Tubes: MS Square Tube"
                              className={`w-full min-w-[320px] ${inputBg} border rounded p-2.5 text-xs leading-relaxed focus:ring-1 focus:ring-emerald-500`}
                            />
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  insertBulletAtCursor(
                                    commercialItemRefs.current[idx] || null,
                                    it.name || "",
                                    (val) => handleItemChange(idx, "name", val)
                                  )
                                }
                                className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors duration-150 cursor-pointer ${
                                  isDark
                                    ? "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                                    : "border-zinc-300 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
                                }`}
                                title="Insert a bullet point at cursor (Line 1 stays Item Name)"
                              >
                                <Plus className="w-2.5 h-2.5" /> Add Bullet
                              </button>
                              <span className={`text-[10px] ${labelColor}`}>Line 1 = Product Name</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.hsn || ""}
                            onChange={(e) => handleItemChange(idx, "hsn", e.target.value)}
                            className={`w-full ${inputBg} border rounded px-2 py-1 font-mono text-xs`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.size || ""}
                            onChange={(e) => handleItemChange(idx, "size", e.target.value)}
                            placeholder="l(5.5) mtr x h(1.8) mtr"
                            className={`w-full ${inputBg} border rounded px-2 py-1 text-xs`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            value={it.qty === 0 ? "" : it.qty}
                            placeholder="1"
                            onChange={(e) => handleItemChange(idx, "qty", e.target.value)}
                            className={`w-full ${inputBg} border rounded px-2 py-1 text-center font-bold text-xs`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={it.unit || "Nos"}
                            placeholder="Nos"
                            onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            className={`w-full ${inputBg} border rounded px-2 py-1 text-center text-xs`}
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            value={it.price === 0 ? "" : it.price}
                            placeholder="0"
                            onChange={(e) => handleItemChange(idx, "price", e.target.value)}
                            className={`w-full ${inputBg} border rounded px-2 py-1 text-right font-mono text-xs`}
                          />
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold text-xs ${isDark ? "text-white" : "text-zinc-900"}`}>
                          {inr.format(it.amount || 0)}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {currentQuote.items.length > 1 && (
                            <button
                              onClick={() => deleteItem(idx)}
                              className="text-zinc-500 hover:text-red-500 p-1 transition cursor-pointer"
                              title="Delete Item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Terms & Financial Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              <div className={`${cardBg} border rounded-xl p-5 space-y-2`}>
                <div className="flex items-center justify-between">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? "text-white" : "text-zinc-900"}`}>
                    TERMS TEXT (EACH BULLET ON A NEW LINE)
                  </label>
                  <span className="text-[10px] text-zinc-400 font-normal">Auto-adds bullets on Enter</span>
                </div>
                <textarea
                  rows={8}
                  value={currentQuote.terms}
                  onChange={(e) => updateField("terms", e.target.value)}
                  onKeyDown={(e) => handleBulletKeyDown(e, currentQuote.terms || "", (val) => updateField("terms", val))}
                  className={`w-full ${inputBg} border rounded-lg p-3 text-xs leading-relaxed focus:ring-1 focus:ring-emerald-500`}
                />
              </div>

              {/* Financial Box */}
              <div className={`${cardBg} border rounded-xl p-5 space-y-3 text-xs`}>
                <h4 className={`font-bold uppercase tracking-wider text-xs border-b pb-2 ${isDark ? "text-white border-zinc-800" : "text-zinc-900 border-zinc-200"}`}>
                  FINANCIAL TOTALS & TAX BREAKDOWN
                </h4>
                <div className={`flex justify-between ${labelColor}`}>
                  <span>Sub Total:</span>
                  <span className={`font-mono font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>{inr.format(currentQuote.subtotal || 0)}</span>
                </div>
                {currentQuote.is_maharashtra ? (
                  <>
                    <div className={`flex justify-between ${labelColor}`}>
                      <span>CGST (9.0%):</span>
                      <span className="font-mono">{inr.format(currentQuote.cgst || 0)}</span>
                    </div>
                    <div className={`flex justify-between ${labelColor}`}>
                      <span>SGST (9.0%):</span>
                      <span className="font-mono">{inr.format(currentQuote.sgst || 0)}</span>
                    </div>
                  </>
                ) : (
                  <div className={`flex justify-between ${labelColor}`}>
                    <span>IGST (18.0%):</span>
                    <span className="font-mono font-bold text-blue-500">{inr.format(currentQuote.igst || 0)}</span>
                  </div>
                )}
                <div className={`flex justify-between ${labelColor}`}>
                  <span>Round off:</span>
                  <span className="font-mono">
                    {currentQuote.round_off !== undefined
                      ? (currentQuote.round_off >= 0 ? "+₹ " : "₹ ") + currentQuote.round_off.toFixed(2)
                      : "₹ 0.00"}
                  </span>
                </div>
                <div className={`flex justify-between font-black text-sm pt-2 border-t ${isDark ? "border-zinc-800 text-white" : "border-zinc-200 text-zinc-900"}`}>
                  <span>Grand Total:</span>
                  <span className="font-mono text-emerald-500">
                    {inr.format(currentQuote.total || 0)}
                  </span>
                </div>
                <p className={`text-[11px] ${labelColor} italic pt-1 leading-tight`}>
                  In Words: {currentQuote.amount_words}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PAGE 1 (TECHNICAL SPECIFICATION PROPOSAL)             */}
        {/* ============================================================ */}
        {activeTab === "page1" && (
          <div className="space-y-4">
            <div className={`w-full max-w-[210mm] mx-auto flex items-center justify-between no-print px-3 py-2 ${cardBg} border rounded-lg`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>Quotation Page 1 (Technical)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-800 rounded">
                  {currentQuote.quotation_no}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSendEmail && onEmailDocument && (
                  <button
                    onClick={() => onEmailDocument("quotation")}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Email 2-Page Quotation PDF via Zoho Mail"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Quotation</span>
                  </button>
                )}
                {canExportPdf && (
                  <button
                    onClick={onPrintBothPages}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Save 2-Page Quotation PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Save 2-Page Quotation (PDF)</span>
                  </button>
                )}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-6">
              <Page1Technical
                quote={currentQuote}
                company={companyInfo || company}
                specProfiles={specProfiles}
              />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: COMMERCIAL OFFER (PAGE 2 TABLE 2 STRICT SINGLE PAGE)  */}
        {/* ============================================================ */}
        {activeTab === "table2" && (
          <div className="space-y-4">
            <div className={`w-full max-w-[210mm] mx-auto flex items-center justify-between no-print px-3 py-2 ${cardBg} border rounded-lg`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>Commercial Offer (Page 2)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                  {currentQuote.quotation_no}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSendEmail && onEmailDocument && (
                  <button
                    onClick={() => onEmailDocument("quotation")}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Email 2-Page Quotation PDF via Zoho Mail"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email Quotation</span>
                  </button>
                )}
                {canExportPdf && (
                  <button
                    onClick={onPrintBothPages}
                    className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Save 2-Page Quotation PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Save 2-Page Quotation (PDF)</span>
                  </button>
                )}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-6">
              <CommercialOffer quote={currentQuote} company={companyInfo || company} />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: PROFORMA INVOICE (PI)                                 */}
        {/* ============================================================ */}
        {activeTab === "pi" && (
          <div className="space-y-4">
            <div className={`w-full max-w-[210mm] mx-auto flex items-center justify-between no-print px-3 py-2 ${cardBg} border rounded-lg`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>Proforma Invoice (PI)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded">
                  {currentQuote.pi_number}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canSendEmail && onEmailDocument && (
                  <button
                    onClick={() => onEmailDocument("pi")}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Email Proforma Invoice PDF via Zoho Mail"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>Email PI</span>
                  </button>
                )}
                {canExportPdf && (
                  <button
                    onClick={() => onPrintSinglePage("pi")}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs px-3 py-1 rounded shadow-sm transition cursor-pointer"
                    title="Save Official Proforma Invoice PDF"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Save Proforma Invoice (PDF)</span>
                  </button>
                )}
              </div>
            </div>
            <div className="w-full overflow-x-auto pb-6">
              <ProformaInvoice quote={currentQuote} company={companyInfo || company} />
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 5: TAX INVOICE                                           */}
        {/* ============================================================ */}
        {activeTab === "ti" && (() => {
          const isGstinValid = Boolean(
            currentQuote.client_gstin &&
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i.test(currentQuote.client_gstin.trim())
          );

          return (
            <div className="space-y-4">
              <div className={`w-full max-w-[210mm] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print px-3 py-2.5 ${cardBg} border rounded-lg`}>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold uppercase ${isDark ? "text-white" : "text-zinc-900"}`}>Tax Invoice (Official GST)</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded">
                    {currentQuote.tax_invoice_number}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {canSendEmail && onEmailDocument && (
                    <button
                      onClick={() => onEmailDocument("ti")}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow-sm transition cursor-pointer"
                      title="Email Tax Invoice PDF via Zoho Mail"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Email Tax Invoice</span>
                    </button>
                  )}
                  {canExportPdf && (
                    <button
                      onClick={() => {
                        if (!isGstinValid) {
                          alert(
                            "⚠️ Tax Invoice Generation Blocked: Client GSTIN is missing or invalid.\n\nA valid 15-digit GSTIN is mandatory by statutory law to issue an official Tax Invoice.\nPlease update the Client GSTIN in the quotation details before generating this Tax Invoice."
                          );
                          return;
                        }
                        onPrintSinglePage("ti");
                      }}
                      className={`flex items-center gap-1.5 font-bold text-xs px-3.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer ${
                        isGstinValid
                          ? "bg-emerald-700 hover:bg-emerald-600 text-white"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                      title={isGstinValid ? "Save Official Tax Invoice PDF" : "Client GSTIN required to generate Tax Invoice"}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Save Tax Invoice (PDF)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* GSTIN Statutory Validation Status Banner */}
              <div className="w-full max-w-[210mm] mx-auto no-print">
                {isGstinValid ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2 rounded-lg flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>
                      GSTIN Verified: <strong className="font-mono">{currentQuote.client_gstin}</strong> (Statutory registration requirement satisfied)
                    </span>
                  </div>
                ) : (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs px-3.5 py-2.5 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>
                        <strong>Statutory GSTIN Required:</strong> Tax Invoice cannot be generated without a valid 15-digit Client GSTIN.
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab("dashboard")}
                      className="text-amber-400 hover:underline font-bold text-xs shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      Enter GSTIN in Dashboard &rarr;
                    </button>
                  </div>
                )}
              </div>

              <div className="w-full overflow-x-auto pb-6">
                <TaxInvoice quote={currentQuote} company={companyInfo || company} />
              </div>
            </div>
          );
        })()}

        {/* ============================================================ */}
        {/* TAB 6: INDEPENDENT PURCHASE ORDER (PO)                       */}
        {/* ============================================================ */}
        {activeTab === "po" && (
          <PurchaseOrderForm
            theme={theme}
            company={companyInfo || company}
            vendors={vendors}
            allQuotations={allQuotations}
            currentQuote={currentQuote}
            poData={poData}
            setPoData={setPoData}
            canCreatePo={true}
            canExportPdf={canExportPdf}
            canSendEmail={canSendEmail}
            onOpenVendorModal={onOpenVendorModal}
            onPrintPo={() => onPrintSinglePage("po")}
            onEmailPo={onEmailDocument ? () => onEmailDocument("po") : undefined}
          />
        )}

        {/* ============================================================ */}
        {/* TAB 7: DATABASE MASTER VIEW                                  */}
        {/* ============================================================ */}
        {activeTab === "database" && (
          <DatabaseView
            quotations={allQuotations}
            theme={theme}
            onSelectQuotation={(q) => {
              onUpdateQuote(q);
              setActiveTab("dashboard");
            }}
            onViewQuotation={(q) => {
              onUpdateQuote(q);
              setActiveTab("table2");
            }}
            onPrintQuotation={onPrintBothPages}
            onReviseQuotation={onReviseQuote}
            onDeleteQuotation={onDeleteQuote}
          />
        )}

        {/* ============================================================ */}
        {/* TAB 8: SPEC PROFILES MASTER VIEW                             */}
        {/* ============================================================ */}
        {activeTab === "spec_profiles" && (
          <SpecProfilesView
            profiles={specProfiles}
            onApplyProfile={applyProfile}
            theme={theme}
            onUpdateProfiles={onUpdateSpecProfiles}
          />
        )}
      </div>
    </div>
  );
}
