"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import {
  Mail,
  Send,
  Save,
  Paperclip,
  Trash2,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
  RefreshCw,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Plus,
  X,
  Check,
  ShieldCheck,
} from "lucide-react";
import {
  CompanyInfo,
  EmailDraft,
  EmailHistoryEntry,
  EmailTemplate,
  Quotation,
  User,
  Vendor,
} from "../lib/types";
import { hasPermission } from "../lib/permissions";
import { exportElementsToPdfBase64 } from "../lib/pdf-export";
import {
  buildPOPdfName,
  buildPIPdfName,
  buildQuotationPdfName,
  buildTIPdfName,
} from "../lib/vba-engine";
import { stripHtmlToText } from "../lib/email-sanitizer";

export interface MailComposeSeed {
  to?: string;
  cc?: string;
  subject?: string;
  bodyHtml?: string;
  quotation?: Quotation;
  documentType?: "Quotation" | "Proforma Invoice" | "Tax Invoice" | "Purchase Order" | "General";
  autoAttachDoc?: "quotation" | "pi" | "ti" | "po";
}

interface MailCenterProps {
  theme: "dark" | "light";
  currentUser: User;
  company: CompanyInfo;
  quotations: Quotation[];
  currentQuote: Quotation;
  vendors: Vendor[];
  composeSeed?: MailComposeSeed | null;
  onClearSeed?: () => void;
}

interface PendingAttachment {
  filename: string;
  contentType: string;
  base64: string;
  sizeBytes: number;
}

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

export default function MailCenter({
  theme,
  currentUser,
  company,
  quotations,
  currentQuote,
  vendors,
  composeSeed,
  onClearSeed,
}: MailCenterProps) {
  const isDark = theme === "dark";
  const canSend = hasPermission(currentUser, "mail.send");
  const canManageTemplates = hasPermission(currentUser, "mail.templates");
  const canUseAi = hasPermission(currentUser, "mail.compose");
  const canEditSettings = hasPermission(currentUser, "mail.settings");

  const [activeTab, setActiveTab] = useState<"compose" | "drafts" | "history" | "templates">("compose");
  const [loading, setLoading] = useState(false);
  const [zohoStatus, setZohoStatus] = useState<{
    configured: boolean;
    host: string;
    port: number;
    senderEmail: string | null;
    fromName: string;
    defaultCc: string | null;
    oauthConfigured: boolean;
  } | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);

  // Composer state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [selectedQuoteNo, setSelectedQuoteNo] = useState<string>(currentQuote?.quotation_no || "");
  const [documentType, setDocumentType] = useState<string>("Quotation");
  const [toEmails, setToEmails] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachingStatus, setAttachingStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // AI Assistant state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiDiff, setAiDiff] = useState<{
    originalHtml: string;
    originalText: string;
    improvedText: string;
    providerUsed: string;
    mode: string;
    redactedCount: number;
  } | null>(null);
  const [lastPreAiHtml, setLastPreAiHtml] = useState<string | null>(null);

  // Template editor state
  const [editingTpl, setEditingTpl] = useState<Partial<EmailTemplate> | null>(null);

  const signatureHtml = useMemo(() => {
    return `<p><br/></p><p><strong>Regards,</strong><br/><strong>${company.name || "AVEN Industrial Automation"}</strong><br/>${
      company.address ? `${company.address}<br/>` : ""
    }${company.phone ? `Phone: ${company.phone}` : ""}${
      company.email ? ` | Email: ${company.email}` : ""
    }${company.website ? `<br/>Web: ${company.website}` : ""}</p>`;
  }, [company]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: `<p>Dear Sir/Madam,</p><p>Please find attached the requested document for your review.</p>${signatureHtml}`,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: `min-h-[200px] max-h-[380px] overflow-y-auto p-3 text-sm focus:outline-none ${
          isDark ? "text-zinc-100" : "text-zinc-900"
        }`,
      },
    },
  });

  const activeQuoteObj = useMemo(
    () => quotations.find((q) => q.quotation_no === selectedQuoteNo) || currentQuote,
    [quotations, selectedQuoteNo, currentQuote]
  );

  // Unique recipient directory from quotations & vendors
  const recipientSuggestions = useMemo(() => {
    const map = new Map<string, { label: string; email: string; type: "Client" | "Vendor" }>();
    for (const q of quotations) {
      if (q.client_email && q.client_email.includes("@")) {
        map.set(q.client_email.toLowerCase(), {
          label: `${q.client_name} (${q.client_email})`,
          email: q.client_email,
          type: "Client",
        });
      }
    }
    for (const v of vendors) {
      if (v.email && v.email.includes("@")) {
        map.set(v.email.toLowerCase(), {
          label: `${v.name} (${v.email})`,
          email: v.email,
          type: "Vendor",
        });
      }
    }
    return Array.from(map.values());
  }, [quotations, vendors]);

  async function fetchMailData() {
    setLoading(true);
    try {
      const res = await fetch("/api/mail", { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setZohoStatus(data.zoho);
        setAiEnabled(Boolean(data.aiEnabled));
        setHistory(Array.isArray(data.history) ? data.history : []);
        setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
        if (!ccEmails && data.zoho?.defaultCc) {
          setCcEmails(data.zoho.defaultCc);
        }
      }
    } catch (e) {
      console.warn("Could not load mail center data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMailData();
  }, []);

  // Apply incoming compose seed from QuotationSystem or Overview
  useEffect(() => {
    if (!composeSeed || !editor) return;
    setActiveTab("compose");
    if (composeSeed.quotation) {
      setSelectedQuoteNo(composeSeed.quotation.quotation_no);
    }
    if (composeSeed.documentType) {
      setDocumentType(composeSeed.documentType);
    }
    if (composeSeed.to !== undefined) setToEmails(composeSeed.to);
    if (composeSeed.cc !== undefined) setCcEmails(composeSeed.cc);
    if (composeSeed.subject !== undefined) setSubject(composeSeed.subject);
    if (composeSeed.bodyHtml !== undefined) {
      editor.commands.setContent(`${composeSeed.bodyHtml}${signatureHtml}`);
    }
    if (composeSeed.autoAttachDoc) {
      void attachErpDocument(composeSeed.autoAttachDoc, composeSeed.quotation || currentQuote);
    }
    if (onClearSeed) onClearSeed();
  }, [composeSeed, editor]);

  function fillPlaceholders(raw: string, q: Quotation | undefined): string {
    if (!q) return raw;
    const totalFormatted = `₹${Number(q.total || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    return raw
      .replace(/\{\{quotation_no\}\}/g, q.quotation_no || "")
      .replace(/\{\{pi_no\}\}/g, q.pi_number || `PI-${q.quotation_no || ""}`)
      .replace(/\{\{ti_no\}\}/g, q.tax_invoice_number || `TI-${q.quotation_no || ""}`)
      .replace(/\{\{po_no\}\}/g, "PO-2026-011")
      .replace(/\{\{client_name\}\}/g, q.client_name || "")
      .replace(/\{\{client_contact\}\}/g, q.client_contact || "Sir/Madam")
      .replace(/\{\{product_type\}\}/g, q.product_type || "Industrial Automation System")
      .replace(/\{\{date\}\}/g, q.date || "")
      .replace(/\{\{total_amount\}\}/g, totalFormatted)
      .replace(/\{\{company_name\}\}/g, company.name || "AVEN Industrial Automation");
  }

  function applyTemplate(tpl: EmailTemplate) {
    if (!editor) return;
    setSubject(fillPlaceholders(tpl.subject_template || tpl.subject || "", activeQuoteObj));
    const filledBody = fillPlaceholders(tpl.body_html, activeQuoteObj);
    editor.commands.setContent(`${filledBody}${signatureHtml}`);
    setActiveTab("compose");
  }

  async function attachErpDocument(
    docKind: "quotation" | "pi" | "ti" | "po",
    quoteForName?: Quotation
  ) {
    const q = quoteForName || activeQuoteObj;
    let elements: (HTMLElement | null)[] = [];
    let fileName = "Document.pdf";

    if (docKind === "quotation") {
      elements = [document.getElementById("export_page1"), document.getElementById("export_table2")];
      fileName = buildQuotationPdfName(q.quotation_no, q.date);
    } else if (docKind === "pi") {
      elements = [document.getElementById("export_pi")];
      fileName = buildPIPdfName(q.pi_number || "PI-2627-001", q.date);
    } else if (docKind === "ti") {
      elements = [document.getElementById("export_ti")];
      fileName = buildTIPdfName(q.tax_invoice_number || "TI-2627-001", q.date);
    } else if (docKind === "po") {
      elements = [document.getElementById("export_po")];
      fileName = buildPOPdfName("PO-2026-011", q.date);
    }

    setAttachingStatus(`Generating ${fileName}...`);
    const result = await exportElementsToPdfBase64({
      fileName,
      elements,
      onProgress: (msg) => setAttachingStatus(msg),
    });
    setAttachingStatus("");

    if (!result) return;
    setAttachments((prev) => {
      const filtered = prev.filter((a) => a.filename !== result.fileName);
      return [
        ...filtered,
        {
          filename: result.fileName,
          contentType: "application/pdf",
          base64: result.base64,
          sizeBytes: result.sizeBytes,
        },
      ];
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setStatusBanner({ type: "error", text: `${file.name} exceeds 10 MB limit.` });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            contentType: file.type || "application/pdf",
            base64,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  }

  async function handleSendEmail() {
    if (!canSend || !editor) return;
    setStatusBanner(null);
    setSending(true);
    try {
      const res = await fetch("/api/mail", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          draft_id: draftId,
          quotation_no: selectedQuoteNo || null,
          document_type: documentType,
          to: toEmails,
          cc: ccEmails,
          bcc: bccEmails,
          subject,
          body_html: editor.getHTML(),
          attachments: attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            base64: a.base64,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusBanner({ type: "error", text: data.error || "Failed to send email." });
        return;
      }
      setStatusBanner({ type: "success", text: "Email sent successfully via Zoho Mail!" });
      setDraftId(null);
      setAttachments([]);
      await fetchMailData();
    } catch {
      setStatusBanner({ type: "error", text: "Network error while sending email." });
    } finally {
      setSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!canSend || !editor) return;
    setStatusBanner(null);
    try {
      const res = await fetch("/api/mail/drafts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: draftId || undefined,
          quotation_no: selectedQuoteNo || null,
          document_type: documentType,
          to_emails: toEmails,
          cc_emails: ccEmails,
          bcc_emails: bccEmails,
          subject,
          body_html: editor.getHTML(),
          attachments: attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            sizeBytes: a.sizeBytes,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setDraftId(data.id);
        setStatusBanner({ type: "success", text: "Draft saved to PostgreSQL." });
        await fetchMailData();
      } else {
        setStatusBanner({ type: "error", text: data.error || "Failed to save draft." });
      }
    } catch {
      setStatusBanner({ type: "error", text: "Failed to save draft." });
    }
  }

  async function handleAiAssist(
    mode: "grammar" | "professional" | "formal" | "concise" | "polite" | "followup" | "translate_en"
  ) {
    if (!canUseAi || !editor) return;
    const originalHtml = editor.getHTML();
    const originalText = stripHtmlToText(originalHtml);
    setAiLoading(true);
    setStatusBanner(null);
    try {
      const res = await fetch("/api/ai/email-assist", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ mode, text: originalText, subject }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusBanner({ type: "error", text: data.error || "AI assist failed." });
        return;
      }
      setAiDiff({
        originalHtml,
        originalText,
        improvedText: data.improvedText,
        providerUsed: data.providerUsed,
        mode,
        redactedCount: data.redactedCount || 0,
      });
    } catch {
      setStatusBanner({ type: "error", text: "AI Assistant request failed." });
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAiSuggestion() {
    if (!aiDiff || !editor) return;
    setLastPreAiHtml(aiDiff.originalHtml);
    const paragraphs = aiDiff.improvedText
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join("");
    editor.commands.setContent(paragraphs);
    setAiDiff(null);
  }

  function undoLastAiChange() {
    if (!lastPreAiHtml || !editor) return;
    editor.commands.setContent(lastPreAiHtml);
    setLastPreAiHtml(null);
  }

  async function toggleAiEnabled() {
    if (!canEditSettings) return;
    const next = !aiEnabled;
    try {
      const res = await fetch("/api/ai/email-assist", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) setAiEnabled(next);
    } catch {}
  }

  async function saveTemplate() {
    if (!editingTpl || !canManageTemplates) return;
    try {
      const res = await fetch("/api/mail/templates", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(editingTpl),
      });
      if (res.ok) {
        setEditingTpl(null);
        await fetchMailData();
      }
    } catch {}
  }

  async function deleteTemplate(id: string) {
    try {
      const res = await fetch(`/api/mail/templates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) await fetchMailData();
    } catch {}
  }

  const cardCls = isDark
    ? "bg-[#111113] border border-zinc-800 text-zinc-100"
    : "bg-white border border-slate-200 text-zinc-900 shadow-sm";
  const inputCls = isDark
    ? "bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
    : "bg-slate-50 border-slate-300 text-zinc-900 placeholder-zinc-400";

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-[1400px] mx-auto w-full min-w-0">
      {/* Top Status Bar */}
      <div className={`${cardCls} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">Zoho Mail Center</h2>
            <p className={`text-xs truncate ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
              {zohoStatus?.configured
                ? `Connected: ${zohoStatus.senderEmail} (${zohoStatus.host}:${zohoStatus.port})`
                : "SMTP pending configuration (set ZOHO_EMAIL & ZOHO_APP_PASSWORD in environment)"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              zohoStatus?.configured
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
            }`}
          >
            {zohoStatus?.configured ? "Zoho SMTP Ready" : "SMTP Not Configured"}
          </span>
          {canEditSettings && (
            <button
              onClick={toggleAiEnabled}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border cursor-pointer ${
                aiEnabled
                  ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30"
                  : "bg-zinc-800 text-zinc-400 border-zinc-700"
              }`}
            >
              AI Assistant: {aiEnabled ? "ON" : "OFF"}
            </button>
          )}
          <button
            onClick={fetchMailData}
            disabled={loading}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
            }`}
            title="Refresh Mail Center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "compose", label: "Compose Email" },
            { id: "drafts", label: `Drafts (${drafts.length})` },
            { id: "history", label: `Sent History (${history.length})` },
            { id: "templates", label: `Templates (${templates.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-600 text-white"
                : isDark
                ? "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                : "bg-white text-slate-600 hover:text-zinc-900 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {statusBanner && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            statusBanner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {statusBanner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{statusBanner.text}</span>
        </div>
      )}

      {/* COMPOSE TAB */}
      {activeTab === "compose" && (
        <div className={`${cardCls} rounded-xl p-4 sm:p-5 space-y-4`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Linked Quotation</label>
              <select
                value={selectedQuoteNo}
                onChange={(e) => setSelectedQuoteNo(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                {quotations.map((q) => (
                  <option key={q.id || q.quotation_no} value={q.quotation_no}>
                    {q.quotation_no} — {q.client_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="Quotation">Quotation</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Purchase Order">Purchase Order</option>
                <option value="General">General</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Load Template</label>
              <select
                defaultValue=""
                onChange={(e) => {
                  const tpl = templates.find((t) => t.id === e.target.value);
                  if (tpl) applyTemplate(tpl);
                }}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="" disabled>
                  Choose B2B template...
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.category}] {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recipients */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold opacity-75">To (comma separated)</label>
                <select
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setToEmails((prev) => (prev ? `${prev}, ${e.target.value}` : e.target.value));
                  }}
                  className={`text-[11px] px-2 py-0.5 rounded border ${inputCls}`}
                >
                  <option value="">+ Pick Client/Vendor</option>
                  {recipientSuggestions.map((r) => (
                    <option key={r.email} value={r.email}>
                      [{r.type}] {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="text"
                value={toEmails}
                onChange={(e) => setToEmails(e.target.value)}
                placeholder="client@company.com"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">CC</label>
                <input
                  type="text"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  placeholder="info@avenautomation.in"
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">BCC</label>
                <input
                  type="text"
                  value={bccEmails}
                  onChange={(e) => setBccEmails(e.target.value)}
                  placeholder="Optional BCC"
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold mb-1 opacity-75">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Quotation 26-27/AIA/... - AVEN Industrial Automation"
              className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
            />
          </div>

          {/* Tiptap Formatting + AI Assistant Toolbar */}
          <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-700" : "border-slate-300"}`}>
            <div
              className={`p-2 border-b flex flex-wrap items-center gap-1.5 ${
                isDark ? "bg-zinc-900 border-zinc-800" : "bg-slate-100 border-slate-200"
              }`}
            >
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBold().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Bold"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleItalic().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Italic"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleUnderline().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Underline"
              >
                <UnderlineIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleBulletList().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Bullet List"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Numbered List"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().undo().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Undo"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => editor?.chain().focus().redo().run()}
                className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                title="Redo"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              {canUseAi && aiEnabled && (
                <div className="flex flex-wrap items-center gap-1 ml-auto pl-2 border-l border-zinc-700/50">
                  <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1 mr-1">
                    <Sparkles className="w-3 h-3" /> AI:
                  </span>
                  {(
                    [
                      ["grammar", "Grammar"],
                      ["professional", "Professional"],
                      ["formal", "Formal"],
                      ["concise", "Concise"],
                      ["polite", "Polite"],
                      ["followup", "Follow-Up"],
                      ["translate_en", "MR/HI → EN"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleAiAssist(mode)}
                      className={`px-2 py-1 rounded text-[11px] font-medium cursor-pointer transition-colors ${
                        isDark
                          ? "bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/30"
                          : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  {lastPreAiHtml && (
                    <button
                      type="button"
                      onClick={undoLastAiChange}
                      className="px-2 py-1 rounded text-[11px] bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 cursor-pointer"
                    >
                      Undo AI
                    </button>
                  )}
                </div>
              )}
            </div>
            <EditorContent editor={editor} />
          </div>

          {/* AI Diff Review Panel */}
          {aiDiff && (
            <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                  <Sparkles className="w-4 h-4" />
                  AI Suggestion Review ({aiDiff.mode} · {aiDiff.providerUsed})
                  {aiDiff.redactedCount > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> {aiDiff.redactedCount} sensitive tokens redacted
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAiDiff(null)}
                    className="px-3 py-1 rounded-lg text-xs border border-zinc-600 hover:bg-zinc-800 cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Reject
                  </button>
                  <button
                    type="button"
                    onClick={acceptAiSuggestion}
                    className="px-3 py-1 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Accept
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className={`p-3 rounded-lg border ${isDark ? "bg-zinc-950 border-zinc-800" : "bg-white border-slate-200"}`}>
                  <div className="text-[10px] font-bold uppercase opacity-60 mb-1">Original</div>
                  <div className="whitespace-pre-wrap">{aiDiff.originalText}</div>
                </div>
                <div className={`p-3 rounded-lg border ${isDark ? "bg-zinc-950 border-indigo-500/40" : "bg-white border-indigo-300"}`}>
                  <div className="text-[10px] font-bold uppercase text-indigo-400 mb-1">AI Improved</div>
                  <div className="whitespace-pre-wrap">{aiDiff.improvedText}</div>
                </div>
              </div>
            </div>
          )}

          {/* Attachments */}
          <div className={`p-3 rounded-lg border space-y-2 ${isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold flex items-center gap-1.5 mr-1">
                <Paperclip className="w-3.5 h-3.5 text-emerald-500" /> Attach ERP PDF:
              </span>
              {(
                [
                  ["quotation", "Quotation (2 Pages)"],
                  ["pi", "Proforma Invoice"],
                  ["ti", "Tax Invoice"],
                  ["po", "Purchase Order"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => attachErpDocument(kind)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                    isDark
                      ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                      : "border-slate-300 bg-white hover:bg-slate-100 text-zinc-800"
                  }`}
                >
                  + {label}
                </button>
              ))}
              <label
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium border cursor-pointer ${
                  isDark
                    ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                    : "border-slate-300 bg-white hover:bg-slate-100 text-zinc-800"
                }`}
              >
                + Upload File
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {attachingStatus && <span className="text-[11px] text-emerald-400">{attachingStatus}</span>}
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((att) => (
                  <div
                    key={att.filename}
                    className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs border ${
                      isDark ? "bg-zinc-950 border-zinc-700" : "bg-white border-slate-300"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="truncate max-w-[200px]">{att.filename}</span>
                    <span className="text-[10px] opacity-60">{Math.round(att.sizeBytes / 1024)} KB</span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.filename !== att.filename))}
                      className="text-rose-400 hover:text-rose-300 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            {canSend && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1.5 ${
                    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" /> Save Draft
                </button>
                <button
                  type="button"
                  disabled={sending}
                  onClick={handleSendEmail}
                  className="px-5 py-2 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {sending ? "Sending via Zoho..." : "Send Email"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* DRAFTS TAB */}
      {activeTab === "drafts" && (
        <div className={`${cardCls} rounded-xl p-4 space-y-3`}>
          {drafts.length === 0 ? (
            <p className="text-xs opacity-60 py-6 text-center">No saved email drafts.</p>
          ) : (
            drafts.map((d) => (
              <div
                key={d.id}
                className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark ? "border-zinc-800 bg-zinc-900/50" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{d.subject || "(No subject)"}</div>
                  <div className="text-[11px] opacity-70 truncate">
                    To: {d.to_emails || "Unspecified"} · {d.document_type || "General"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setDraftId(d.id);
                      setToEmails(d.to_emails || "");
                      setCcEmails(d.cc_emails || "");
                      setBccEmails(d.bcc_emails || "");
                      setSubject(d.subject || "");
                      setSelectedQuoteNo(d.quotation_no || selectedQuoteNo);
                      setDocumentType(d.document_type || "General");
                      editor?.commands.setContent(d.body_html || "");
                      setActiveTab("compose");
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white cursor-pointer"
                  >
                    Resume
                  </button>
                  <button
                    onClick={async () => {
                      await fetch(`/api/mail/drafts?id=${encodeURIComponent(d.id)}`, {
                        method: "DELETE",
                        headers: getAuthHeaders(),
                      });
                      await fetchMailData();
                    }}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "history" && (
        <div className={`${cardCls} rounded-xl p-4 space-y-2 overflow-x-auto`}>
          {history.length === 0 ? (
            <p className="text-xs opacity-60 py-6 text-center">No sent email history recorded yet.</p>
          ) : (
            <table className="w-full text-left text-xs min-w-[680px]">
              <thead>
                <tr className={`border-b ${isDark ? "border-zinc-800 text-zinc-400" : "border-slate-200 text-slate-500"}`}>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">To</th>
                  <th className="py-2 pr-3">Subject</th>
                  <th className="py-2 pr-3">Document</th>
                  <th className="py-2 pr-3">Sent By</th>
                  <th className="py-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className={`border-b ${isDark ? "border-zinc-800/70" : "border-slate-100"}`}>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          h.status === "sent"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-rose-500/15 text-rose-400"
                        }`}
                      >
                        {h.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 max-w-[180px] truncate">{h.to_emails}</td>
                    <td className="py-2.5 pr-3 max-w-[260px] truncate font-medium">{h.subject}</td>
                    <td className="py-2.5 pr-3">{h.quotation_no || h.document_type || "-"}</td>
                    <td className="py-2.5 pr-3">{h.sent_by}</td>
                    <td className="py-2.5 opacity-70 whitespace-nowrap">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {h.sent_at ? new Date(h.sent_at).toLocaleString() : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {activeTab === "templates" && (
        <div className={`${cardCls} rounded-xl p-4 space-y-4`}>
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-75">
              B2B Email Templates ({templates.length})
            </h3>
            {canManageTemplates && (
              <button
                onClick={() =>
                  setEditingTpl({
                    name: "",
                    category: "General",
                    subject_template: "",
                    body_html: "<p>Dear {{client_contact}},</p><p></p>",
                  })
                }
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> New Template
              </button>
            )}
          </div>

          {editingTpl && (
            <div className={`p-4 rounded-xl border space-y-3 ${isDark ? "border-zinc-700 bg-zinc-900" : "border-slate-300 bg-slate-50"}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Template Name"
                  value={editingTpl.name || ""}
                  onChange={(e) => setEditingTpl({ ...editingTpl, name: e.target.value })}
                  className={`px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
                <input
                  type="text"
                  placeholder="Category (e.g. Quotation, Follow-up)"
                  value={editingTpl.category || ""}
                  onChange={(e) => setEditingTpl({ ...editingTpl, category: e.target.value })}
                  className={`px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <input
                type="text"
                placeholder="Subject Template (supports {{quotation_no}}, {{client_name}}, {{company_name}})"
                value={editingTpl.subject_template || ""}
                onChange={(e) => setEditingTpl({ ...editingTpl, subject_template: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
              <textarea
                rows={4}
                placeholder="HTML Body"
                value={editingTpl.body_html || ""}
                onChange={(e) => setEditingTpl({ ...editingTpl, body_html: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-mono ${inputCls}`}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setEditingTpl(null)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-zinc-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={saveTemplate}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white cursor-pointer"
                >
                  Save Template
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {templates.map((t) => (
              <div
                key={t.id}
                className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                  isDark ? "border-zinc-800 bg-zinc-900/40" : "border-slate-200 bg-slate-50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold">{t.name}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                      {t.category}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-70 mt-1 truncate">{t.subject_template}</div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => applyTemplate(t)}
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600 text-white cursor-pointer"
                  >
                    Use Template
                  </button>
                  {canManageTemplates && (
                    <button
                      onClick={() => setEditingTpl(t)}
                      className="px-2.5 py-1 rounded text-[11px] border border-zinc-600 cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                  {canManageTemplates && !t.is_default && (
                    <button
                      onClick={() => deleteTemplate(t.id)}
                      className="p-1 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
