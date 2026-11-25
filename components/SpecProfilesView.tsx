"use client";

import React, { useState } from "react";
import { Search, CheckCircle2, FileCode2, Plus, Edit2, Trash2, X, Save, AlertCircle } from "lucide-react";
import { SpecProfile } from "../lib/types";

interface SpecProfilesViewProps {
  profiles: SpecProfile[];
  onApplyProfile: (profile: SpecProfile) => void;
  theme?: "dark" | "light";
  onUpdateProfiles?: (profiles: SpecProfile[]) => void;
}

export default function SpecProfilesView({
  profiles: initialProfiles,
  onApplyProfile,
  theme = "dark",
  onUpdateProfiles,
}: SpecProfilesViewProps) {
  const [profiles, setProfiles] = useState<SpecProfile[]>(initialProfiles);
  const [selectedProfileName, setSelectedProfileName] = useState(
    initialProfiles[0]?.name || "Motorised Sliding Gate"
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Modal / Form state for Add/Edit Spec
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [specKey, setSpecKey] = useState("");
  const [specVal, setSpecVal] = useState("");

  // Modal for New Profile
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileProduct, setNewProfileProduct] = useState("");

  const isDark = theme === "dark";
  const cardBg = isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-300 text-zinc-950";
  const subCardBg = isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-zinc-50 border-zinc-300";
  const inputBg = isDark ? "bg-black border-zinc-700 text-white placeholder-zinc-400" : "bg-white border-zinc-400 text-zinc-950 placeholder-zinc-500";
  const textMuted = isDark ? "text-zinc-300" : "text-zinc-700";
  const textHeader = isDark ? "text-white" : "text-zinc-950";
  const rowHover = isDark ? "hover:bg-zinc-800/80" : "hover:bg-zinc-200/70";
  const tableHeaderBg = isDark ? "bg-zinc-900 text-zinc-200 border-zinc-700" : "bg-zinc-200/80 text-zinc-900 border-zinc-300";

  const filtered = profiles.filter((p) =>
    (p.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const activeProfile = profiles.find((p) => p.name === selectedProfileName) || profiles[0];

  function showNotification(msg: string) {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(""), 4000);
  }

  // Open Add Spec Modal
  function handleOpenAddSpec() {
    setEditingKey(null);
    setSpecKey("");
    setSpecVal("");
    setIsSpecModalOpen(true);
  }

  // Open Edit Spec Modal
  function handleOpenEditSpec(key: string, val: string) {
    setEditingKey(key);
    setSpecKey(key);
    setSpecVal(val);
    setIsSpecModalOpen(true);
  }

  // Save Spec (Add or Edit)
  async function handleSaveSpec(e: React.FormEvent) {
    e.preventDefault();
    if (!specKey.trim() || !activeProfile) return;

    setLoading(true);
    try {
      const updatedProfiles = profiles.map((p) => {
        if (p.name === activeProfile.name) {
          const specs = { ...(p.specs || {}) };
          if (editingKey && editingKey !== specKey) {
            delete specs[editingKey];
          }
          specs[specKey.trim()] = specVal.trim();
          return { ...p, specs };
        }
        return p;
      });

      setProfiles(updatedProfiles);
      onUpdateProfiles?.(updatedProfiles);

      // Persist to API
      await fetch("/api/spec-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_spec",
          profileName: activeProfile.name,
          specKey: specKey.trim(),
          specVal: specVal.trim(),
        }),
      });

      setIsSpecModalOpen(false);
      showNotification(`Specification "${specKey.trim()}" saved successfully.`);
    } catch (err) {
      console.error("Failed to save spec to API", err);
      showNotification("Saved locally (API connection fallback)");
      setIsSpecModalOpen(false);
    } finally {
      setLoading(false);
    }
  }

  // Delete Spec
  async function handleDeleteSpec(keyToDelete: string) {
    if (!confirm(`Are you sure you want to delete specification: "${keyToDelete}"?`)) return;
    if (!activeProfile) return;

    setLoading(true);
    try {
      const updatedProfiles = profiles.map((p) => {
        if (p.name === activeProfile.name) {
          const specs = { ...(p.specs || {}) };
          delete specs[keyToDelete];
          return { ...p, specs };
        }
        return p;
      });

      setProfiles(updatedProfiles);
      onUpdateProfiles?.(updatedProfiles);

      // Persist to API
      await fetch(
        `/api/spec-profiles?profileName=${encodeURIComponent(activeProfile.name || "")}&specKey=${encodeURIComponent(keyToDelete)}`,
        { method: "DELETE" }
      );

      showNotification(`Specification "${keyToDelete}" removed.`);
    } catch (err) {
      console.error("Failed to delete spec", err);
    } finally {
      setLoading(false);
    }
  }

  // Create New Profile
  async function handleCreateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!newProfileName.trim()) return;

    setLoading(true);
    try {
      const newProf: SpecProfile = {
        name: newProfileName.trim(),
        product: newProfileProduct.trim() || newProfileName.trim(),
        specs: {
          "Profile Name": newProfileName.trim(),
          "Product Type": newProfileProduct.trim() || newProfileName.trim(),
        },
      };

      const updatedProfiles = [...profiles, newProf];
      setProfiles(updatedProfiles);
      setSelectedProfileName(newProf.name || "");
      onUpdateProfiles?.(updatedProfiles);

      await fetch("/api/spec-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_profile",
          name: newProf.name,
          product: newProf.product,
          specs: newProf.specs,
        }),
      });

      setIsProfileModalOpen(false);
      setNewProfileName("");
      setNewProfileProduct("");
      showNotification(`Profile "${newProf.name}" created successfully.`);
    } catch (err) {
      console.error("Failed to create profile", err);
      setIsProfileModalOpen(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`border rounded-xl p-4 sm:p-6 transition-colors shadow-sm ${cardBg} space-y-4`}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b pb-4">
        <div>
          <h2 className={`text-base sm:text-lg font-bold flex items-center gap-2 ${textHeader}`}>
            <FileCode2 className="w-5 h-5 text-amber-500" />
            <span>Technical Specification Profiles</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${isDark ? "bg-zinc-800 text-zinc-300" : "bg-zinc-200 text-zinc-700"}`}>
              {profiles.length} Standards
            </span>
          </h2>
          <p className={`text-xs mt-0.5 ${textMuted}`}>
            Engineering spec parameters used in Page 1 Technical Proposals & Documents
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            className={`flex items-center gap-1.5 font-bold text-xs px-3 py-2 rounded-lg border transition shadow-sm cursor-pointer ${
              isDark ? "bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700" : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300"
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-amber-500" />
            <span>New Profile</span>
          </button>

          {activeProfile && (
            <button
              onClick={() => onApplyProfile(activeProfile)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 sm:px-4 py-2 rounded-lg transition shadow-sm cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Apply to Current Quote</span>
            </button>
          )}
        </div>
      </div>

      {statusMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: List of profiles */}
        <div className={`border rounded-lg p-3 space-y-2.5 ${subCardBg}`}>
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${textMuted}`} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search profile..."
              className={`w-full rounded pl-8 pr-2 py-1.5 text-xs focus:outline-none border ${inputBg}`}
            />
          </div>

          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {filtered.map((p) => {
              const isSelected = p.name === selectedProfileName;
              return (
                <button
                  key={p.name}
                  onClick={() => setSelectedProfileName(p.name || "")}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? isDark
                        ? "bg-zinc-800 text-white font-bold border border-zinc-700 shadow-sm"
                        : "bg-white text-zinc-900 font-bold border border-zinc-300 shadow-sm"
                      : isDark
                      ? "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                  }`}
                >
                  <span className="truncate">{p.name}</span>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></div>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Specifications Table with Add/Edit/Delete */}
        <div className={`md:col-span-2 border rounded-lg p-4 space-y-3 ${subCardBg}`}>
          {activeProfile ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2.5 border-zinc-700/50">
                <div>
                  <h3 className={`text-sm font-bold ${textHeader}`}>{activeProfile.name}</h3>
                  <p className={`text-[11px] ${textMuted}`}>
                    Product: <span className="font-medium text-amber-500">{activeProfile.product || activeProfile.name}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleOpenAddSpec}
                    className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3 py-1.5 rounded-lg transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New Spec</span>
                  </button>
                  <button
                    onClick={() => onApplyProfile(activeProfile)}
                    className="text-xs text-amber-500 hover:text-amber-400 font-bold px-2 py-1"
                  >
                    Use in Quote &rarr;
                  </button>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden max-h-[460px] overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className={`uppercase text-[10px] font-bold border-b ${tableHeaderBg}`}>
                    <tr>
                      <th className="py-2.5 px-3 w-2/5">Technical Specification</th>
                      <th className="py-2.5 px-3">Standard Description</th>
                      <th className="py-2.5 px-2 w-20 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${isDark ? "divide-zinc-800" : "divide-zinc-200"}`}>
                    {activeProfile.specs && Object.keys(activeProfile.specs).length > 0 ? (
                      Object.entries(activeProfile.specs).map(([sKey, sVal], idx) => (
                        <tr key={idx} className={`transition ${rowHover}`}>
                          <td className={`py-2 px-3 font-semibold ${isDark ? "text-white" : "text-zinc-950"}`}>
                            {sKey}
                          </td>
                          <td className={`py-2 px-3 ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>
                            {sVal || "-"}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleOpenEditSpec(sKey, sVal)}
                                className={`p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer ${textMuted} hover:text-amber-400`}
                                title="Edit specification"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteSpec(sKey)}
                                className="p-1 rounded hover:bg-zinc-700/50 transition cursor-pointer text-zinc-500 hover:text-red-400"
                                title="Delete specification"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className={`py-8 text-center text-xs ${textMuted}`}>
                          No specifications defined for this profile. Click &quot;Add New Spec&quot; above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className={`text-xs text-center py-10 ${textMuted}`}>No profile selected</p>
          )}
        </div>
      </div>

      {/* Add / Edit Specification Modal */}
      {isSpecModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-xl border p-5 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className={`text-sm font-bold ${textHeader}`}>
                {editingKey ? "Edit Technical Specification" : "Add New Technical Specification"}
              </h3>
              <button
                onClick={() => setIsSpecModalOpen(false)}
                className={`p-1 rounded hover:bg-zinc-800 cursor-pointer ${textMuted}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSpec} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${textHeader}`}>Specification Title / Parameter</label>
                <input
                  type="text"
                  required
                  value={specKey}
                  onChange={(e) => setSpecKey(e.target.value)}
                  placeholder="e.g. Motor Power, Opening Speed, Material"
                  className={`w-full rounded px-3 py-2 border ${inputBg}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${textHeader}`}>Specification Value / Standard Description</label>
                <textarea
                  rows={3}
                  required
                  value={specVal}
                  onChange={(e) => setSpecVal(e.target.value)}
                  placeholder="e.g. 230VAC Single Phase, 12 m/Min, Mild Steel (MS)"
                  className={`w-full rounded px-3 py-2 border ${inputBg}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSpecModalOpen(false)}
                  className={`px-3 py-1.5 rounded border cursor-pointer font-semibold ${
                    isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-300" : "border-zinc-300 hover:bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-black font-bold cursor-pointer transition flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{loading ? "Saving..." : "Save Specification"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-xl border p-5 shadow-2xl ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <h3 className={`text-sm font-bold ${textHeader}`}>Create New Spec Profile</h3>
              <button
                onClick={() => setIsProfileModalOpen(false)}
                className={`p-1 rounded hover:bg-zinc-800 cursor-pointer ${textMuted}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProfile} className="space-y-3 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${textHeader}`}>Profile Name</label>
                <input
                  type="text"
                  required
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  placeholder="e.g. Automatic Boom Barrier System"
                  className={`w-full rounded px-3 py-2 border ${inputBg}`}
                />
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${textHeader}`}>Product Classification</label>
                <input
                  type="text"
                  value={newProfileProduct}
                  onChange={(e) => setNewProfileProduct(e.target.value)}
                  placeholder="e.g. Boom Barrier"
                  className={`w-full rounded px-3 py-2 border ${inputBg}`}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsProfileModalOpen(false)}
                  className={`px-3 py-1.5 rounded border cursor-pointer font-semibold ${
                    isDark ? "border-zinc-700 hover:bg-zinc-800 text-zinc-300" : "border-zinc-300 hover:bg-zinc-100 text-zinc-700"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{loading ? "Creating..." : "Create Profile"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
