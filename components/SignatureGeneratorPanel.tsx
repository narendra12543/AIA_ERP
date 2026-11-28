"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Monitor,
  PenTool,
  Plus,
  RotateCcw,
  Save,
  Smartphone,
  Sun,
  Moon,
  Trash2,
} from "lucide-react";
import {
  generateSignatureHtml,
  resolveSignaturePlaceholders,
  SIGNATURE_TEMPLATE_LIST,
  SignatureConfig,
  SignatureTemplateKey,
} from "../lib/signature-templates";

interface SignatureGeneratorPanelProps {
  theme: "dark" | "light";
  isAdmin: boolean;
  mailboxes: Array<{ id: string; email_address: string; display_name: string }>;
  activeMailboxId: string;
  onSaved: () => void;
}

const DEFAULT_CFG: SignatureConfig = {
  templateKey: "classic_corporate",
  fullName: "",
  designation: "",
  department: "",
  companyName: "Aven Industrial Automation",
  email: "sales@avenautomation.in",
  mobile: "+91 8766918892",
  telephone: "",
  website: "https://avenautomation.in",
  address: "Office No-03, Near Akurdi Railway Station, Tal- Haveli, Dist Pune- 411035",
  logoUrl: "/assets/logo.png",
  profilePhotoUrl: "",
  linkedinUrl: "",
  facebookUrl: "",
  instagramUrl: "",
  whatsappLink: "",
  closingMessage: "Regards,",
  disclaimer: "",
  fontFamily: "Verdana",
  fontSize: "10pt",
  textColor: "#1f2937",
  accentColor: "#d97706",
  logoSize: "md",
  logoAlignment: "left",
  dividerStyle: "solid",
  showSocialIcons: true,
};

export default function SignatureGeneratorPanel({
  theme,
  isAdmin,
  mailboxes,
  activeMailboxId,
  onSaved,
}: SignatureGeneratorPanelProps) {
  const isDark = theme === "dark";
  const [signatures, setSignatures] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>("new");
  const [sigName, setSigName] = useState("AVEN Official Signature");
  const [cfg, setCfg] = useState<SignatureConfig>(DEFAULT_CFG);
  const [assignScope, setAssignScope] = useState<"selected" | "all" | "multiple" | "personal">("selected");
  const [selectedMailboxIds, setSelectedMailboxIds] = useState<string[]>(activeMailboxId ? [activeMailboxId] : []);
  const [assignedRoles, setAssignedRoles] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [lockedBranding, setLockedBranding] = useState(false);

  // Auto-insert preferences
  const [prefs, setPrefs] = useState({
    auto_new: true,
    auto_reply: true,
    auto_reply_all: true,
    auto_forward: true,
  });

  // Preview controls
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewBg, setPreviewBg] = useState<"light" | "dark">("light");
  const [showHtml, setShowHtml] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadData = async () => {
    try {
      const [sigRes, prefRes] = await Promise.all([
        fetch("/api/mail/signatures?withMeta=1", { cache: "no-store" }),
        fetch(`/api/mail/signatures/preferences?mailboxId=${encodeURIComponent(activeMailboxId || "all")}`, { cache: "no-store" }),
      ]);
      if (sigRes.ok) {
        const j = await sigRes.json();
        const list = Array.isArray(j.signatures) ? j.signatures : [];
        setSignatures(list);
        const emp = j.employeeProfile || {};
        const activeMbx = mailboxes.find((m) => m.id === activeMailboxId);
        setCfg((prev) => ({
          ...prev,
          fullName: prev.fullName || emp.name || "",
          designation: prev.designation || emp.designation || "",
          department: prev.department || emp.department || "",
          mobile: prev.mobile || emp.mobile || "+91 8766918892",
          email: activeMbx?.email_address || prev.email,
        }));
      }
      if (prefRes.ok) {
        const p = await prefRes.json();
        setPrefs({
          auto_new: p.auto_new !== false,
          auto_reply: p.auto_reply !== false,
          auto_reply_all: p.auto_reply_all !== false,
          auto_forward: p.auto_forward !== false,
        });
      }
    } catch {}
  };

  useEffect(() => {
    loadData();
  }, [activeMailboxId]);

  const generatedHtml = useMemo(() => {
    const activeMbx = mailboxes.find((m) => m.id === activeMailboxId);
    const raw = generateSignatureHtml(cfg);
    return resolveSignaturePlaceholders(raw, {
      email: cfg.email || activeMbx?.email_address,
      name: cfg.fullName,
      designation: cfg.designation,
      companyName: cfg.companyName,
    });
  }, [cfg, mailboxes, activeMailboxId]);

  const handleSelectSignature = (sig: any) => {
    setSelectedId(sig.id);
    setSigName(sig.name || "Signature");
    setIsDefault(Boolean(sig.is_default));
    setLockedBranding(Boolean(sig.locked_branding));
    if (sig.config_json && Object.keys(sig.config_json).length > 0) {
      setCfg({ ...DEFAULT_CFG, ...sig.config_json });
    }
    const mbxIds = Array.isArray(sig.assigned_mailbox_ids) ? sig.assigned_mailbox_ids : [];
    setSelectedMailboxIds(mbxIds.length > 0 ? mbxIds : activeMailboxId ? [activeMailboxId] : []);
    setAssignedRoles(Array.isArray(sig.assigned_roles) ? sig.assigned_roles : []);
  };

  const handleSave = async () => {
    if (busy) return;
    setNotice(null);
    setBusy(true);
    try {
      const targetMailboxIds =
        assignScope === "all"
          ? mailboxes.map((m) => m.id)
          : assignScope === "selected"
          ? activeMailboxId
            ? [activeMailboxId]
            : []
          : assignScope === "multiple"
          ? selectedMailboxIds
          : [];

      const res = await fetch("/api/mail/signatures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId === "new" ? `sig_${Date.now()}` : selectedId,
          name: sigName.trim() || "Custom Signature",
          html_content: generatedHtml,
          logo_url: cfg.logoUrl,
          font_family: cfg.fontFamily,
          font_size: cfg.fontSize,
          is_default: isDefault,
          auto_insert: true,
          user_specific: assignScope === "personal" || !isAdmin,
          mailbox_id: targetMailboxIds[0] || null,
          assigned_mailbox_ids: targetMailboxIds,
          assigned_roles: assignedRoles,
          template_key: cfg.templateKey,
          config_json: cfg,
          locked_branding: isAdmin ? lockedBranding : false,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to save signature." });
        return;
      }

      await fetch("/api/mail/signatures/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mailbox_id: activeMailboxId || "all",
          ...prefs,
          default_signature_id: json.id,
        }),
      });

      setNotice({ type: "ok", text: "Signature & preferences saved to database." });
      await loadData();
      onSaved();
    } catch {
      setNotice({ type: "err", text: "Failed to save signature." });
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (id === "sig_aven_default") return;
    const res = await fetch(`/api/mail/signatures?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) {
      setSelectedId("new");
      await loadData();
      onSaved();
    }
  };

  const cardCls = isDark ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]" : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCls = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const inputCls = isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900";
  const mutedCls = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Left: Saved Signatures & 5 Templates */}
      <div className={`lg:col-span-3 p-3.5 rounded-xl border space-y-3 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <PenTool className="w-3.5 h-3.5 text-amber-400" />
            <span>Saved Signatures</span>
          </h3>
          <button
            type="button"
            onClick={() => {
              setSelectedId("new");
              setSigName("New AVEN Signature");
              setCfg(DEFAULT_CFG);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-500 text-zinc-950 text-[11px] font-semibold cursor-pointer"
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {signatures.map((s) => (
            <div
              key={s.id}
              onClick={() => handleSelectSignature(s)}
              className={`p-2 rounded-lg border text-xs cursor-pointer flex items-center justify-between gap-2 ${
                selectedId === s.id ? "border-amber-500 bg-amber-500/10" : subCls
              }`}
            >
              <div className="min-w-0">
                <div className="font-medium truncate">{s.name}</div>
                <div className={`text-[10px] ${mutedCls}`}>
                  {s.is_default ? "Default • " : ""}
                  {s.user_email ? "Personal" : "Company"}
                </div>
              </div>
              {s.id !== "sig_aven_default" && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(s.id);
                  }}
                  className="p-1 text-zinc-400 hover:text-rose-400 cursor-pointer"
                  aria-label="Delete signature"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-zinc-800/40 space-y-1.5">
          <p className={`text-[11px] font-semibold ${mutedCls}`}>Templates (5)</p>
          {SIGNATURE_TEMPLATE_LIST.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setCfg((prev) => ({ ...prev, templateKey: t.key as SignatureTemplateKey }))}
              className={`w-full text-left p-2 rounded-lg border text-xs cursor-pointer transition ${
                cfg.templateKey === t.key ? "border-amber-500 bg-amber-500/10" : subCls
              }`}
            >
              <div className="font-semibold">{t.label}</div>
              <div className={`text-[10px] ${mutedCls}`}>{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Center: Configuration Form */}
      <div className={`lg:col-span-5 p-4 rounded-xl border space-y-3 ${cardCls}`}>
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold">Signature Details &amp; Assignments</h3>
          <button
            type="button"
            onClick={() => setCfg(DEFAULT_CFG)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] cursor-pointer ${subCls}`}
          >
            <RotateCcw className="w-3 h-3" /> Reset Default
          </button>
        </div>

        {notice && (
          <div className={`px-3 py-2 rounded-lg border text-xs ${notice.type === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
            {notice.text}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
          <div className="sm:col-span-2">
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Signature Name</label>
            <input value={sigName} onChange={(e) => setSigName(e.target.value)} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Full Name</label>
            <input value={cfg.fullName} onChange={(e) => setCfg({ ...cfg, fullName: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Designation</label>
            <input value={cfg.designation} onChange={(e) => setCfg({ ...cfg, designation: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Department</label>
            <input value={cfg.department} onChange={(e) => setCfg({ ...cfg, department: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Company Name</label>
            <input value={cfg.companyName} disabled={lockedBranding && !isAdmin} onChange={(e) => setCfg({ ...cfg, companyName: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Email Address</label>
            <input value={cfg.email} onChange={(e) => setCfg({ ...cfg, email: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Mobile Number</label>
            <input value={cfg.mobile} onChange={(e) => setCfg({ ...cfg, mobile: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Telephone</label>
            <input value={cfg.telephone} onChange={(e) => setCfg({ ...cfg, telephone: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Website URL</label>
            <input value={cfg.website} onChange={(e) => setCfg({ ...cfg, website: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div className="sm:col-span-2">
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Company Address</label>
            <input value={cfg.address} onChange={(e) => setCfg({ ...cfg, address: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>LinkedIn URL</label>
            <input value={cfg.linkedinUrl || ""} onChange={(e) => setCfg({ ...cfg, linkedinUrl: e.target.value })} placeholder="https://linkedin.com/..." className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>WhatsApp Link</label>
            <input value={cfg.whatsappLink || ""} onChange={(e) => setCfg({ ...cfg, whatsappLink: e.target.value })} placeholder="https://wa.me/91..." className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Font Family</label>
            <select value={cfg.fontFamily} onChange={(e) => setCfg({ ...cfg, fontFamily: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`}>
              <option value="Verdana">Verdana</option>
              <option value="Arial">Arial</option>
              <option value="Calibri">Calibri</option>
              <option value="Segoe UI">Segoe UI</option>
            </select>
          </div>
          <div>
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Accent Colour</label>
            <input type="color" value={cfg.accentColor} onChange={(e) => setCfg({ ...cfg, accentColor: e.target.value })} className="w-full h-8 rounded border border-zinc-700 cursor-pointer" />
          </div>
          <div className="sm:col-span-2">
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Closing Message</label>
            <input value={cfg.closingMessage} onChange={(e) => setCfg({ ...cfg, closingMessage: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
          <div className="sm:col-span-2">
            <label className={`block text-[10px] font-semibold mb-1 ${mutedCls}`}>Confidentiality Disclaimer (Optional)</label>
            <input value={cfg.disclaimer || ""} onChange={(e) => setCfg({ ...cfg, disclaimer: e.target.value })} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`} />
          </div>
        </div>

        {/* Assignment & Auto-Insert Preferences */}
        <div className={`p-3 rounded-lg border space-y-2 text-xs ${subCls}`}>
          <div className="font-semibold">Mailbox Assignment &amp; Auto-Insert</div>
          <select value={assignScope} onChange={(e) => setAssignScope(e.target.value as any)} className={`w-full px-2.5 py-1.5 rounded border ${inputCls}`}>
            <option value="selected">Apply to Selected Mailbox</option>
            {isAdmin && <option value="all">Apply to All Authorized Mailboxes</option>}
            {isAdmin && <option value="multiple">Apply to Selected Multiple Mailboxes</option>}
            <option value="personal">Personal Signature Only</option>
          </select>

          <div className="flex flex-wrap gap-3 pt-1">
            {(
              [
                ["auto_new", "New Emails"],
                ["auto_reply", "Reply"],
                ["auto_reply_all", "Reply All"],
                ["auto_forward", "Forward"],
              ] as const
            ).map(([k, lbl]) => (
              <label key={k} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))}
                />
                <span>{lbl}</span>
              </label>
            ))}
          </div>

          {isAdmin && (
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
                <span>Set as Company Default</span>
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={lockedBranding} onChange={(e) => setLockedBranding(e.target.checked)} />
                <span>Lock Official Branding</span>
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs cursor-pointer disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{busy ? "Saving..." : "Save Signature & Apply"}</span>
        </button>
      </div>

      {/* Right: Live Preview */}
      <div className={`lg:col-span-4 p-4 rounded-xl border space-y-3 ${cardCls}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold">Live Preview</h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPreviewDevice("desktop")}
              className={`p-1.5 rounded border cursor-pointer ${previewDevice === "desktop" ? "border-amber-500 text-amber-400" : subCls}`}
              title="Desktop preview"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewDevice("mobile")}
              className={`p-1.5 rounded border cursor-pointer ${previewDevice === "mobile" ? "border-amber-500 text-amber-400" : subCls}`}
              title="Mobile preview"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewBg(previewBg === "light" ? "dark" : "light")}
              className={`p-1.5 rounded border cursor-pointer ${subCls}`}
              title="Toggle preview background"
            >
              {previewBg === "light" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => setShowHtml(!showHtml)}
              className={`p-1.5 rounded border cursor-pointer ${showHtml ? "border-amber-500 text-amber-400" : subCls}`}
              title="View email-compatible HTML"
            >
              <Code2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          className={`p-4 rounded-lg border overflow-x-auto mx-auto transition-all ${
            previewDevice === "mobile" ? "max-w-[320px]" : "w-full"
          } ${previewBg === "light" ? "bg-white text-zinc-900 border-zinc-200" : "bg-zinc-950 text-zinc-100 border-zinc-800"}`}
        >
          {showHtml ? (
            <pre className="text-[10px] font-mono whitespace-pre-wrap break-all">{generatedHtml}</pre>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: generatedHtml }} />
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(generatedHtml);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium cursor-pointer ${subCls}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied HTML Signature!" : "Copy HTML Signature"}</span>
        </button>
      </div>
    </div>
  );
}
