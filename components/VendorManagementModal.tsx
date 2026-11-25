"use client";

import React, { useState } from "react";
import { X, Plus, Edit2, Trash2, Search, Building2, Phone, Mail, FileText, CheckCircle2 } from "lucide-react";
import { Vendor } from "../lib/types";

interface VendorManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendors: Vendor[];
  onAddVendor: (vendor: Omit<Vendor, "id" | "created_at">) => void;
  onUpdateVendor: (vendor: Vendor) => void;
  onDeleteVendor: (id: string) => void;
  onSelectVendor?: (vendor: Vendor) => void;
  theme?: "dark" | "light";
}

export default function VendorManagementModal({
  isOpen,
  onClose,
  vendors,
  onAddVendor,
  onUpdateVendor,
  onDeleteVendor,
  onSelectVendor,
  theme = "dark",
}: VendorManagementModalProps) {
  const [search, setSearch] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gstin, setGstin] = useState("");
  const [pan, setPan] = useState("");
  const [address, setAddress] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [state, setState] = useState("27-Maharashtra");
  const [city, setCity] = useState("Pune");
  const [pincode, setPincode] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("30 Days Credit");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const isDark = theme === "dark";
  const modalBg = isDark ? "bg-[#09090b] text-white border-zinc-800" : "bg-white text-zinc-900 border-zinc-200";
  const cardBg = isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-50 border-zinc-200";
  const inputBg = isDark ? "bg-black border-zinc-700 text-white placeholder-zinc-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const rowHover = isDark ? "hover:bg-zinc-900/80" : "hover:bg-zinc-100";

  const filtered = vendors.filter((v) =>
    (v.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.contact_person || "").toLowerCase().includes(search.toLowerCase()) ||
    (v.gstin || "").toLowerCase().includes(search.toLowerCase())
  );

  function resetForm() {
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setGstin("");
    setPan("");
    setAddress("");
    setShippingAddress("");
    setState("27-Maharashtra");
    setCity("Pune");
    setPincode("");
    setPaymentTerms("30 Days Credit");
    setNotes("");
    setIsEditing(false);
    setEditingId(null);
  }

  function handleStartAdd() {
    resetForm();
    setIsEditing(true);
  }

  function handleStartEdit(v: Vendor) {
    setEditingId(v.id);
    setName(v.name);
    setContactPerson(v.contact_person || "");
    setPhone(v.phone || "");
    setEmail(v.email || "");
    setGstin(v.gstin || "");
    setPan(v.pan || "");
    setAddress(v.address || "");
    setShippingAddress(v.shipping_address || v.address || "");
    setState(v.state || "27-Maharashtra");
    setCity(v.city || "Pune");
    setPincode(v.pincode || "");
    setPaymentTerms(v.payment_terms || "30 Days Credit");
    setNotes(v.notes || "");
    setIsEditing(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      onUpdateVendor({
        id: editingId,
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        address: address.trim(),
        shipping_address: shippingAddress.trim() || address.trim(),
        state: state.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        payment_terms: paymentTerms.trim(),
        notes: notes.trim(),
      });
    } else {
      onAddVendor({
        name: name.trim(),
        contact_person: contactPerson.trim(),
        phone: phone.trim(),
        email: email.trim(),
        gstin: gstin.trim().toUpperCase(),
        pan: pan.trim().toUpperCase(),
        address: address.trim(),
        shipping_address: shippingAddress.trim() || address.trim(),
        state: state.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        payment_terms: paymentTerms.trim(),
        notes: notes.trim(),
      });
    }

    resetForm();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto">
      <div className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${modalBg}`}>
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">PO Vendor / Supplier Management</h2>
              <p className={`text-xs ${textMuted}`}>
                Dedicated supplier database for Purchase Orders (strictly separated from Client/Customer data)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-zinc-800 cursor-pointer ${textMuted} hover:text-white transition`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Action Row */}
          {!isEditing && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search vendors by company, contact person or GSTIN..."
                  className={`w-full rounded-xl pl-9 pr-3 py-2 text-xs border ${inputBg} focus:outline-none focus:ring-1 focus:ring-amber-500`}
                />
              </div>

              <button
                onClick={handleStartAdd}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Vendor</span>
              </button>
            </div>
          )}

          {/* Form for Add/Edit */}
          {isEditing ? (
            <form onSubmit={handleSubmit} className={`border rounded-xl p-4 sm:p-5 space-y-4 ${cardBg}`}>
              <div className="flex items-center justify-between border-b pb-3 border-zinc-700/50">
                <h3 className="text-sm font-bold flex items-center gap-2 text-amber-500">
                  <Building2 className="w-4 h-4" />
                  <span>{editingId ? "Edit Vendor Details" : "Register New Vendor / Supplier"}</span>
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  className={`text-xs font-semibold hover:underline ${textMuted}`}
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Vendor / Company Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Precision Steels & Tubes LLP"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Phone / Mobile *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9822014589"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. sales@precisionsteels.in"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">GSTIN *</label>
                  <input
                    type="text"
                    required
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value)}
                    placeholder="e.g. 27AAACP1234F1Z8"
                    className={`w-full rounded-lg px-3 py-2 font-mono uppercase border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={pan}
                    onChange={(e) => setPan(e.target.value)}
                    placeholder="e.g. AAACP1234F"
                    className={`w-full rounded-lg px-3 py-2 font-mono uppercase border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="e.g. 27-Maharashtra"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">City & Pincode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="City (Pune)"
                      className={`w-full rounded-lg px-2.5 py-2 border ${inputBg}`}
                    />
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      placeholder="Pincode"
                      className={`w-full rounded-lg px-2.5 py-2 border ${inputBg}`}
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold mb-1">Billing / Plant Address *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Plot / Street / MIDC area address"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Terms</label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    placeholder="e.g. 30 Days Credit / 50% Adv"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-semibold mb-1">Notes / Supplier Details</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Primary supplier for MS square tubes and heavy-duty gearboxes"
                    className={`w-full rounded-lg px-3 py-2 border ${inputBg}`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-700/50">
                <button
                  type="button"
                  onClick={resetForm}
                  className={`px-4 py-2 rounded-xl border font-semibold cursor-pointer ${
                    isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-300" : "border-zinc-300 hover:bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer transition shadow-md"
                >
                  {editingId ? "Update Vendor" : "Save Vendor"}
                </button>
              </div>
            </form>
          ) : (
            /* Vendors List */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-semibold px-1">
                <span className={textMuted}>{filtered.length} Vendors Registered</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filtered.map((v) => (
                  <div
                    key={v.id}
                    className={`border rounded-xl p-4 transition flex flex-col justify-between gap-3 ${cardBg} ${rowHover}`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold flex items-center gap-1.5">
                            <span>{v.name}</span>
                          </h4>
                          {v.contact_person && (
                            <p className={`text-xs ${textMuted} mt-0.5`}>Attn: {v.contact_person}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleStartEdit(v)}
                            className={`p-1.5 rounded-lg border hover:bg-zinc-700/50 cursor-pointer ${textMuted} hover:text-amber-400`}
                            title="Edit Vendor"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete vendor "${v.name}"?`)) onDeleteVendor(v.id);
                            }}
                            className={`p-1.5 rounded-lg border hover:bg-zinc-700/50 cursor-pointer ${textMuted} hover:text-red-400`}
                            title="Delete Vendor"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`w-14 shrink-0 font-semibold ${textMuted}`}>GSTIN:</span>
                          <span className="font-mono font-bold text-amber-500">{v.gstin || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`w-14 shrink-0 font-semibold ${textMuted}`}>Phone:</span>
                          <span>{v.phone || "-"}</span>
                        </div>
                        {v.email && (
                          <div className="flex items-center gap-2">
                            <span className={`w-14 shrink-0 font-semibold ${textMuted}`}>Email:</span>
                            <span className="truncate">{v.email}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <span className={`w-14 shrink-0 font-semibold ${textMuted}`}>Address:</span>
                          <span className={`line-clamp-2 ${textMuted}`}>{v.address || "-"}</span>
                        </div>
                      </div>
                    </div>

                    {onSelectVendor && (
                      <button
                        onClick={() => {
                          onSelectVendor(v);
                          onClose();
                        }}
                        className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition cursor-pointer mt-2"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Select this Vendor for PO</span>
                      </button>
                    )}
                  </div>
                ))}

                {filtered.length === 0 && (
                  <div className={`col-span-full text-center py-12 border border-dashed rounded-xl ${textMuted}`}>
                    <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No vendors found matching &quot;{search}&quot;</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
