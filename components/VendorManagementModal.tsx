"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  Plus,
  Edit2,
  Trash2,
  Search,
  Building2,
  CheckCircle2,
  ShieldCheck,
  Ban,
  Upload,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Vendor } from "../lib/types";

interface VendorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onAddVendor: (vendor: Omit<Vendor, "id" | "created_at">) => void;
  onUpdateVendor: (vendor: Vendor) => void;
  onDeleteVendor: (id: string) => void;
  onSelectVendor?: (vendor: Vendor) => void;
  canApprove?: boolean;
  canViewBank?: boolean;
  theme?: "dark" | "light";
}

const VENDOR_CATEGORIES = [
  "Raw Material Supplier",
  "Steel and Metal Supplier",
  "Fabrication Vendor",
  "Electrical Supplier",
  "Automation Components Supplier",
  "Mechanical Components Supplier",
  "Industrial Equipment Supplier",
  "Transportation and Logistics",
  "Installation Contractor",
  "Service Provider",
  "Other",
];

export default function VendorManagementModal({
  isOpen,
  onClose,
  vendors,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onSelectVendor,
  canApprove = true,
  canViewBank = true,
  theme = "dark",
}: VendorManagementModalProps) {
  const isDark = theme === "dark";
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [vendorCode, setVendorCode] = useState("");

  // 1. Basic Info
  const [name, setName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [vendorType, setVendorType] = useState("Supplier");
  const [category, setCategory] = useState("Automation Components Supplier");
  const [constitution, setConstitution] = useState("Proprietorship");
  const [contactPerson, setContactPerson] = useState("");
  const [designation, setDesignation] = useState("");
  const [phone, setPhone] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [email, setEmail] = useState("");
  const [altEmail, setAltEmail] = useState("");
  const [website, setWebsite] = useState("");

  // 2. Registered Address
  const [address, setAddress] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("Pune");
  const [district, setDistrict] = useState("Pune");
  const [state, setState] = useState("27-Maharashtra");
  const [pincode, setPincode] = useState("");
  const [country, setCountry] = useState("India");

  // 3. Tax & Registration
  const [gstType, setGstType] = useState("Regular");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [udyamNo, setUdyamNo] = useState("");
  const [cin, setCin] = useState("");

  // 4. Commercial Info
  const [paymentTerms, setPaymentTerms] = useState("30 Days Credit");
  const [creditPeriod, setCreditPeriod] = useState("30 Days");
  const [currency, setCurrency] = useState("INR");
  const [leadTime, setLeadTime] = useState("");
  const [freightTerms, setFreightTerms] = useState("Ex-Works");
  const [preferred, setPreferred] = useState(false);
  const [remarks, setRemarks] = useState("");

  // 5. Bank Info
  const [bankHolder, setBankHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAcct, setBankAcct] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");

  // 6. Documents & Status
  const [documents, setDocuments] = useState<Array<{ name: string; type: string; url: string }>>([]);
  const [approvalStatus, setApprovalStatus] = useState<"Pending Approval" | "Approved" | "Rejected">("Approved");
  const [operationalStatus, setOperationalStatus] = useState<"Active" | "Inactive" | "Blocked">("Active");

  const filteredVendors = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vendors.filter((v) => {
      if (catFilter !== "all" && (v.category || "Other") !== catFilter) return false;
      if (approvalFilter !== "all" && (v.approval_status || "Approved") !== approvalFilter) return false;
      if (statusFilter !== "all" && (v.operational_status || "Active") !== statusFilter) return false;
      if (!q) return true;
      const hay = `${v.vendor_code || ""} ${v.name || ""} ${v.trade_name || ""} ${v.gstin || ""} ${v.contact_person || ""} ${v.phone || ""} ${v.email || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [vendors, search, catFilter, approvalFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredVendors.length / pageSize));
  const paginated = filteredVendors.slice((page - 1) * pageSize, page * pageSize);

  if (!isOpen) return null;

  function resetForm() {
    setEditingId(null);
    setVendorCode("");
    setName("");
    setTradeName("");
    setVendorType("Supplier");
    setCategory("Automation Components Supplier");
    setConstitution("Proprietorship");
    setContactPerson("");
    setDesignation("");
    setPhone("");
    setAltPhone("");
    setEmail("");
    setAltEmail("");
    setWebsite("");
    setAddress("");
    setAddressLine2("");
    setCity("Pune");
    setDistrict("Pune");
    setState("27-Maharashtra");
    setPincode("");
    setCountry("India");
    setGstType("Regular");
    setGstin("");
    setPan("");
    setUdyamNo("");
    setCin("");
    setPaymentTerms("30 Days Credit");
    setCreditPeriod("30 Days");
    setCurrency("INR");
    setLeadTime("");
    setFreightTerms("Ex-Works");
    setPreferred(false);
    setRemarks("");
    setBankHolder("");
    setBankName("");
    setBankBranch("");
    setBankAcct("");
    setBankIfsc("");
    setDocuments([]);
    setApprovalStatus("Approved");
    setOperationalStatus("Active");
  }

  function startEdit(v: Vendor) {
    setEditingId(v.id);
    setVendorCode(v.vendor_code || "");
    setName(v.name || "");
    setTradeName(v.trade_name || "");
    setVendorType(v.vendor_type || "Supplier");
    setCategory(v.category || "Automation Components Supplier");
    setConstitution(v.constitution || "Proprietorship");
    setContactPerson(v.contact_person || "");
    setDesignation(v.designation || "");
    setPhone(v.phone || "");
    setAltPhone(v.alt_phone || "");
    setEmail(v.email || "");
    setAltEmail(v.alt_email || "");
    setWebsite(v.website || "");
    setAddress(v.address || "");
    setAddressLine2(v.address_line2 || "");
    setCity(v.city || "");
    setDistrict(v.district || "");
    setState(v.state || "27-Maharashtra");
    setPincode(v.pincode || "");
    setCountry(v.country || "India");
    setGstType(v.gst_type || "Regular");
    setGstin(v.gstin || "");
    setPan(v.pan || "");
    setUdyamNo(v.udyam_no || "");
    setCin(v.cin || "");
    setPaymentTerms(v.payment_terms || "30 Days Credit");
    setCreditPeriod(v.credit_period || "30 Days");
    setCurrency(v.currency || "INR");
    setLeadTime(v.lead_time || "");
    setFreightTerms(v.freight_terms || "Ex-Works");
    setPreferred(Boolean(v.preferred));
    setRemarks(v.remarks || v.notes || "");
    setBankHolder(v.bank_account_holder || "");
    setBankName(v.bank_name || "");
    setBankBranch(v.bank_branch || "");
    setBankAcct(v.bank_account_no_masked || "");
    setBankIfsc(v.bank_ifsc || "");
    setDocuments(v.documents || []);
    setApprovalStatus(v.approval_status || "Approved");
    setOperationalStatus(v.operational_status || "Active");
    setIsEditing(true);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const payload: any = {
      name: name.trim(),
      trade_name: tradeName,
      vendor_type: vendorType,
      category,
      constitution,
      contact_person: contactPerson,
      designation,
      phone,
      alt_phone: altPhone,
      email,
      alt_email: altEmail,
      website,
      address,
      address_line2: addressLine2,
      shipping_address: address,
      city,
      district,
      state,
      state_code: state.slice(0, 2),
      pincode,
      country,
      gst_type: gstType,
      gstin: gstin.toUpperCase(),
      pan: pan.toUpperCase(),
      udyam_no: udyamNo,
      cin,
      payment_terms: paymentTerms,
      credit_period: creditPeriod,
      currency,
      lead_time: leadTime,
      freight_terms: freightTerms,
      preferred,
      remarks,
      notes: remarks,
      bank_account_holder: bankHolder,
      bank_name: bankName,
      bank_branch: bankBranch,
      bank_account_no: bankAcct,
      bank_ifsc: bankIfsc.toUpperCase(),
      documents,
      approval_status: approvalStatus,
      operational_status: operationalStatus,
    };

    if (editingId) {
      onUpdateVendor({ id: editingId, vendor_code: vendorCode, ...payload });
    } else {
      onAddVendor(payload);
    }
    setIsEditing(false);
    resetForm();
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      let token = "";
      try {
        token = JSON.parse(sessionStorage.getItem("aven_tab_session") || "{}")?.token || "";
      } catch {}
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { "x-tab-session": token } : {}) },
        body: JSON.stringify({ fileName: file.name, dataUrl: reader.result }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setDocuments((prev) => [...prev, { name: file.name, type: docType, url: data.url }]);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const modalBg = isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-slate-200 text-zinc-900";
  const cardBg = isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-slate-50 border-slate-200";
  const inputCls = isDark
    ? "bg-zinc-950 border-zinc-700 text-white placeholder-zinc-500"
    : "bg-white border-slate-300 text-zinc-900 placeholder-zinc-400";

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className={`${modalBg} border rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl`}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Enterprise Vendor Master Management (PO Suppliers)</h2>
              <p className="text-[11px] opacity-65">Strictly separated from Quotation Clients · Sequence: AIA-VND-XXXXXX</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={() => {
                  resetForm();
                  setIsEditing(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Vendor
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isEditing ? (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  {editingId ? `Edit Vendor ${vendorCode || ""}` : "Register New Enterprise Vendor (Auto-generates AIA-VND-XXXXXX)"}
                </h3>
                <button type="button" onClick={() => setIsEditing(false)} className="text-xs opacity-70 hover:opacity-100 cursor-pointer">
                  &larr; Back to Vendor Directory
                </button>
              </div>

              {/* Section 1: Basic Vendor Info */}
              <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                <div className="text-xs font-bold">1. Basic Vendor Information</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Legal Company Name *</label>
                    <input required value={name} onChange={(e) => setName(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Trade Name</label>
                    <input value={tradeName} onChange={(e) => setTradeName(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Vendor Category</label>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}>
                      {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Vendor Type</label>
                    <select value={vendorType} onChange={(e) => setVendorType(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}>
                      <option value="Supplier">Material Supplier</option>
                      <option value="Manufacturer">Manufacturer / OEM</option>
                      <option value="Contractor">Contractor / Fabricator</option>
                      <option value="Service">Service / Logistics</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Business Constitution</label>
                    <select value={constitution} onChange={(e) => setConstitution(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}>
                      <option value="Proprietorship">Proprietorship</option>
                      <option value="Partnership">Partnership</option>
                      <option value="LLP">LLP</option>
                      <option value="Private Limited">Private Limited</option>
                      <option value="Public Limited">Public Limited</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Contact Person</label>
                    <input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Designation</label>
                    <input value={designation} onChange={(e) => setDesignation(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Mobile Number</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold mb-1 opacity-75">Email Address</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                  </div>
                </div>
              </div>

              {/* Section 2 & 3: Address & Tax */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                  <div className="text-xs font-bold">2. Registered Address</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">Address Line 1</label>
                      <input value={address} onChange={(e) => setAddress(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">City</label>
                      <input value={city} onChange={(e) => setCity(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">State & Code</label>
                      <input value={state} onChange={(e) => setState(e.target.value)} placeholder="27-Maharashtra" className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">PIN Code</label>
                      <input value={pincode} onChange={(e) => setPincode(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">Country</label>
                      <input value={country} onChange={(e) => setCountry(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                  </div>
                </div>

                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                  <div className="text-xs font-bold">3. Tax, Registration & Commercial Terms</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">GST Type</label>
                      <select value={gstType} onChange={(e) => setGstType(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}>
                        <option value="Regular">Regular</option>
                        <option value="Composition">Composition</option>
                        <option value="Unregistered">Unregistered</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">GSTIN (Optional for Unregistered)</label>
                      <input value={gstin} onChange={(e) => setGstin(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs font-mono uppercase ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">PAN</label>
                      <input value={pan} onChange={(e) => setPan(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs font-mono uppercase ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">MSME / Udyam No.</label>
                      <input value={udyamNo} onChange={(e) => setUdyamNo(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">Payment Terms</label>
                      <input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold mb-1 opacity-75">Delivery Lead Time</label>
                      <input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} placeholder="e.g. 7-10 Days" className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 4 & 5: Bank & Supporting Documents (Permission-Gated) */}
              {canViewBank && (
                <div className={`p-4 rounded-xl border space-y-3 ${cardBg}`}>
                  <div className="text-xs font-bold">4. Bank Details & Supporting KYC Documents (Encrypted & Permission-Protected)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <input placeholder="Account Holder Name" value={bankHolder} onChange={(e) => setBankHolder(e.target.value)} className={`h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    <input placeholder="Bank Name" value={bankName} onChange={(e) => setBankName(e.target.value)} className={`h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    <input placeholder="Branch" value={bankBranch} onChange={(e) => setBankBranch(e.target.value)} className={`h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
                    <input placeholder="Account Number" value={bankAcct} onChange={(e) => setBankAcct(e.target.value)} className={`h-9 px-3 rounded-lg border text-xs font-mono ${inputCls}`} />
                    <input placeholder="IFSC Code" value={bankIfsc} onChange={(e) => setBankIfsc(e.target.value)} className={`h-9 px-3 rounded-lg border text-xs font-mono uppercase ${inputCls}`} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {["GST Certificate", "PAN Document", "Udyam Certificate", "Cancelled Cheque"].map((dt) => (
                      <label key={dt} className="px-2.5 py-1 rounded-lg border border-zinc-700 text-[11px] cursor-pointer flex items-center gap-1">
                        <Upload className="w-3 h-3" /> {dt}
                        <input type="file" accept=".pdf,image/*" onChange={(e) => handleDocUpload(e, dt)} className="hidden" />
                      </label>
                    ))}
                    {documents.map((d, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 text-[11px] flex items-center gap-1">
                        <FileText className="w-3 h-3" /> {d.type}: {d.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg border border-zinc-700 text-xs font-semibold cursor-pointer">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                  {editingId ? "Update Vendor" : "Register Vendor"}
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Search & Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search vendor code, name, GSTIN, contact, phone, email..."
                    className={`w-full h-9 pl-8 pr-3 rounded-lg border text-xs ${inputCls}`}
                  />
                </div>
                <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} className={`h-9 px-2.5 rounded-lg border text-xs ${inputCls}`}>
                  <option value="all">All Categories</option>
                  {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={approvalFilter} onChange={(e) => { setApprovalFilter(e.target.value); setPage(1); }} className={`h-9 px-2.5 rounded-lg border text-xs ${inputCls}`}>
                  <option value="all">All Approvals</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending Approval">Pending Approval</option>
                  <option value="Rejected">Rejected</option>
                </select>
                <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={`h-9 px-2.5 rounded-lg border text-xs ${inputCls}`}>
                  <option value="all">All Status</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Blocked">Blocked</option>
                </select>
              </div>

              {/* Vendor Master Table */}
              <div className="border border-zinc-800 rounded-xl overflow-x-auto">
                <table className="w-full min-w-[920px] text-xs text-left">
                  <thead className="bg-zinc-950/60 border-b border-zinc-800 text-[10px] uppercase text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-3">Vendor Code</th>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3">Contact & Phone</th>
                      <th className="py-2.5 px-3">GSTIN</th>
                      <th className="py-2.5 px-3 text-center">Approval</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right sticky right-0 bg-zinc-950">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {paginated.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center opacity-60">No vendors found.</td>
                      </tr>
                    ) : (
                      paginated.map((v) => (
                        <tr key={v.id} className="hover:bg-zinc-900/40">
                          <td className="py-2.5 px-3 font-mono font-bold text-amber-400 whitespace-nowrap">
                            {v.vendor_code || "AIA-VND-LEGACY"}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">{v.name}</td>
                          <td className="py-2.5 px-3 opacity-80">{v.category || "Supplier"}</td>
                          <td className="py-2.5 px-3">
                            <div>{v.contact_person || "-"}</div>
                            <div className="text-[11px] opacity-60">{v.phone} · {v.email}</div>
                          </td>
                          <td className="py-2.5 px-3 font-mono">{v.gstin || "Unregistered"}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (v.approval_status || "Approved") === "Approved"
                                ? "bg-emerald-500/15 text-emerald-400"
                                : v.approval_status === "Rejected"
                                ? "bg-rose-500/15 text-rose-400"
                                : "bg-amber-500/15 text-amber-400"
                            }`}>
                              {v.approval_status || "Approved"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              (v.operational_status || "Active") === "Active"
                                ? "bg-sky-500/15 text-sky-400"
                                : "bg-zinc-700/40 text-zinc-400"
                            }`}>
                              {v.operational_status || "Active"}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right sticky right-0 whitespace-nowrap ${isDark ? "bg-[#09090b]" : "bg-white"}`}>
                            <div className="flex items-center justify-end gap-1">
                              {onSelectVendor && (v.approval_status || "Approved") === "Approved" && (v.operational_status || "Active") === "Active" && (
                                <button
                                  onClick={() => { onSelectVendor(v); onClose(); }}
                                  className="px-2 py-1 rounded bg-amber-500 text-black font-bold text-[10px] cursor-pointer"
                                  title="Select for Purchase Order"
                                >
                                  Select
                                </button>
                              )}
                              {canApprove && (v.approval_status || "Approved") !== "Approved" && (
                                <button
                                  onClick={() => onUpdateVendor({ ...v, approval_status: "Approved" })}
                                  className="p-1.5 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 cursor-pointer"
                                  title="Approve Vendor"
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canApprove && (v.operational_status || "Active") === "Active" && (
                                <button
                                  onClick={() => onUpdateVendor({ ...v, operational_status: "Inactive" })}
                                  className="p-1.5 rounded bg-zinc-800 text-zinc-400 hover:text-amber-400 cursor-pointer"
                                  title="Deactivate Vendor"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canApprove && v.operational_status === "Inactive" && (
                                <button
                                  onClick={() => onUpdateVendor({ ...v, operational_status: "Active" })}
                                  className="p-1.5 rounded bg-zinc-800 text-emerald-400 cursor-pointer"
                                  title="Activate Vendor"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button onClick={() => startEdit(v)} className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer" title="Edit Vendor">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => onDeleteVendor(v.id)} className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-rose-400 cursor-pointer" title="Delete Vendor">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between text-xs opacity-75">
                <span>Showing {paginated.length} of {filteredVendors.length} vendors</span>
                <div className="flex items-center gap-2">
                  <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span>Page {page} / {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
