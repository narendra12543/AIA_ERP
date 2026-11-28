"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import FontFamily from "@tiptap/extension-font-family";
import Highlight from "@tiptap/extension-highlight";
import Image from "@tiptap/extension-image";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
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
  Strikethrough,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  Plus,
  X,
  Check,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Link2,
  Table2,
  Eraser,
  Maximize2,
  Minimize2,
  Eye,
  Download,
  PenTool,
  Upload,
  Star,
  Indent,
  Outdent,
  Minus,
  Quote,
  Smile,
  ImagePlus,
  Unlink,
  Inbox,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useFinancialYear } from "../contexts/FinancialYearContext";
import { matchesReportingFY } from "../lib/financial-year";
import ZohoMailboxWorkspace from "./ZohoMailboxWorkspace";
import SignatureGeneratorPanel from "./SignatureGeneratorPanel";
import { resolveSignaturePlaceholders } from "../lib/signature-templates";

const FontSizeTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.fontSize || null,
        renderHTML: (attributes: Record<string, any>) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

const BLOCKED_ATTACH_EXT = /\.(exe|bat|cmd|sh|js|mjs|vbs|scr|msi|com|pif|dll)$/i;
const ALLOWED_ATTACH_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.ppt,.pptx,.jpg,.jpeg,.png,.webp";

const FALLBACK_AVEN_SIGNATURE: EmailSignature = {
  id: "sig_aven_default",
  name: "AVEN Official Signature",
  html_content: `<div style="font-family: Verdana, Geneva, sans-serif; font-size: 10pt; line-height: 1.5; color: #1f2937;">
  <p style="margin: 0 0 4px 0;">Regards,</p>
  <p style="margin: 0 0 6px 0;"><strong>Aven Industrial Automation</strong></p>
  <p style="margin: 0 0 2px 0;">📞 +91 8766918892</p>
  <p style="margin: 0 0 2px 0;">📧 <a href="mailto:sales@avenautomation.in" style="color: #1d4ed8; text-decoration: none;">sales@avenautomation.in</a></p>
  <p style="margin: 0 0 8px 0;">🌐 <a href="https://avenautomation.in" style="color: #1d4ed8; text-decoration: none;">avenautomation.in</a></p>
  <img src="/assets/logo.png" alt="AVEN Industrial Automation" style="height: 46px; width: auto; display: block;" />
</div>`,
  logo_url: "/assets/logo.png",
  font_family: "Verdana",
  font_size: "10pt",
  is_default: true,
  auto_insert: true,
};
import {
  CompanyInfo,
  EmailDraft,
  EmailHistoryEntry,
  EmailSignature,
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
import { parseEmailList, stripHtmlToText } from "../lib/email-sanitizer";

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
  onOpenAdminSettings?: () => void;
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
  onOpenAdminSettings,
}: MailCenterProps) {
  const isDark = theme === "dark";
  const { selectedFY } = useFinancialYear();
  const fyFilteredQuotations = useMemo(() => {
    if (selectedFY === "ALL") return quotations;
    const filtered = quotations.filter((q) => matchesReportingFY(q.date, q.quotation_no, selectedFY));
    return filtered.length > 0 ? filtered : quotations;
  }, [quotations, selectedFY]);
  const canSend = hasPermission(currentUser, "mail.send");
  const canManageTemplates = hasPermission(currentUser, "mail.templates");
  const canManageSignatures = hasPermission(currentUser, "mail.signatures") || canSend;
  const canUseAi = hasPermission(currentUser, "mail.compose");
  const canEditSettings = hasPermission(currentUser, "mail.settings");

  const [activeTab, setActiveTab] = useState<
    "compose" | "inbox" | "drafts" | "history" | "templates" | "signatures"
  >("compose");
  const [loading, setLoading] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [showCc, setShowCc] = useState(true);
  const [showBcc, setShowBcc] = useState(false);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [dragOverAttach, setDragOverAttach] = useState(false);

  const [zohoStatus, setZohoStatus] = useState<{
    configured: boolean;
    enabled?: boolean;
    host: string;
    port: number;
    senderEmail: string | null;
    fromName: string;
    defaultCc: string | null;
    lastTestResult?: string | null;
    lastTestAt?: string | null;
    lastTestError?: string | null;
    oauthConfigured?: boolean;
  } | null>(null);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [history, setHistory] = useState<EmailHistoryEntry[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([FALLBACK_AVEN_SIGNATURE]);
  const [selectedSigId, setSelectedSigId] = useState<string>("sig_aven_default");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [userTouchedSignature, setUserTouchedSignature] = useState(false);
  const [customSigOverrideHtml, setCustomSigOverrideHtml] = useState<string | null>(null);
  const [editingCurrentSig, setEditingCurrentSig] = useState(false);
  const [lineSpacing, setLineSpacing] = useState("1.5");

  // Composer state
  const [draftId, setDraftId] = useState<string | null>(null);
  const [selectedQuoteNo, setSelectedQuoteNo] = useState<string>(currentQuote?.quotation_no || "");
  const [documentType, setDocumentType] = useState<string>("Quotation");
  const [toChips, setToChips] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [ccEmails, setCcEmails] = useState("");
  const [bccEmails, setBccEmails] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyDirty, setBodyDirty] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [attachingStatus, setAttachingStatus] = useState("");
  const [sending, setSending] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipientPicker, setShowRecipientPicker] = useState(false);

  // AI Assistant state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [lastAiMode, setLastAiMode] = useState<
    | "professional"
    | "grammar"
    | "improve"
    | "formal"
    | "concise"
    | "polite"
    | "clear"
    | "followup"
    | "marathi_en"
    | "hindi_en"
  >("professional");

  // Multi-account Zoho Mailbox state
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [activeMailbox, setActiveMailbox] = useState<any | null>(null);
  const [composeMode, setComposeMode] = useState<"new" | "reply" | "replyAll" | "forward">("new");
  const [replyMeta, setReplyMeta] = useState<{ originalMessageId?: string; inReplyTo?: string }>({});

  useEffect(() => {
    fetch("/api/mail/accounts", { cache: "no-store", headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j && Array.isArray(j.mailboxes)) {
          setMailboxes(j.mailboxes);
          setActiveMailbox((prev: any) =>
            j.mailboxes.find((m: any) => m.id === prev?.id) ||
            j.mailboxes.find((m: any) => m.is_default) ||
            j.mailboxes[0] ||
            null
          );
        }
      })
      .catch(() => {});
  }, []);
  const [aiDiff, setAiDiff] = useState<{
    originalHtml: string;
    originalText: string;
    improvedText: string;
    providerUsed: string;
    mode: string;
    selectionFrom?: number;
    selectionTo?: number;
  } | null>(null);
  const [lastPreAiHtml, setLastPreAiHtml] = useState<string | null>(null);

  // Template & Signature editor state
  const [editingTpl, setEditingTpl] = useState<Partial<EmailTemplate> | null>(null);
  const [editingSig, setEditingSig] = useState<Partial<EmailSignature> | null>(null);
  const [fontFamily, setFontFamily] = useState("Verdana");
  const [fontSize, setFontSize] = useState("10pt");

  const activeSignature = useMemo(() => {
    const list = signatures.length > 0 ? signatures : [FALLBACK_AVEN_SIGNATURE];
    return (
      list.find((s) => s.id === selectedSigId) ||
      list.find((s) => s.is_default) ||
      list[0] ||
      FALLBACK_AVEN_SIGNATURE
    );
  }, [signatures, selectedSigId]);

  const activeSignatureHtml = useMemo(() => {
    if (!includeSignature || !activeSignature) return "";
    const raw = customSigOverrideHtml !== null ? customSigOverrideHtml : activeSignature.html_content || "";
    return resolveSignaturePlaceholders(raw, {
      email: activeMailbox?.email_address || zohoStatus?.senderEmail || "sales@avenautomation.in",
      name: currentUser?.name,
      companyName: company?.name || "Aven Industrial Automation",
    });
  }, [includeSignature, activeSignature, customSigOverrideHtml, activeMailbox?.email_address, zohoStatus?.senderEmail, currentUser?.name, company?.name]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      FontSizeTextStyle,
      Color,
      FontFamily,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: `<p style="font-family: Verdana, sans-serif; font-size: 10pt;">Dear Sir/Madam,</p><p style="font-family: Verdana, sans-serif; font-size: 10pt;">Please find attached the requested document for your review and kind consideration.</p>`,
    immediatelyRender: false,
    onUpdate: () => setBodyDirty(true),
    editorProps: {
      attributes: {
        style: `font-family: ${fontFamily}, Geneva, sans-serif; font-size: ${fontSize}; line-height: 1.5;`,
        class: "min-h-[240px] max-h-[440px] overflow-y-auto p-4 focus:outline-none bg-white text-zinc-900",
      },
    },
  });

  const activeQuoteObj = useMemo(
    () => quotations.find((q) => q.quotation_no === selectedQuoteNo) || currentQuote,
    [quotations, selectedQuoteNo, currentQuote]
  );

  const recipientDirectory = useMemo(() => {
    const list: Array<{ label: string; email: string; type: "Client" | "Vendor" }> = [];
    const seen = new Set<string>();
    for (const q of quotations) {
      const em = (q.client_email || "").trim();
      if (em && em.includes("@") && !seen.has(em.toLowerCase())) {
        seen.add(em.toLowerCase());
        list.push({ label: q.client_name || em, email: em, type: "Client" });
      }
    }
    for (const v of vendors) {
      const em = (v.email || "").trim();
      if (em && em.includes("@") && !seen.has(em.toLowerCase())) {
        seen.add(em.toLowerCase());
        list.push({
          label: `${v.vendor_code ? v.vendor_code + " — " : ""}${v.name}`,
          email: em,
          type: "Vendor",
        });
      }
    }
    return list;
  }, [quotations, vendors]);

  const filteredDirectory = useMemo(() => {
    const q = recipientSearch.trim().toLowerCase();
    if (!q) return recipientDirectory;
    return recipientDirectory.filter(
      (r) => r.label.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
    );
  }, [recipientDirectory, recipientSearch]);

  async function fetchMailData() {
    setLoading(true);
    try {
      const [mailRes, sigRes] = await Promise.all([
        fetch("/api/mail", { credentials: "same-origin", headers: getAuthHeaders() }),
        fetch("/api/mail/signatures", { credentials: "same-origin", headers: getAuthHeaders() }),
      ]);
      const data = await mailRes.json();
      if (mailRes.ok) {
        setZohoStatus(data.zoho);
        setAiEnabled(Boolean(data.aiEnabled));
        setHistory(Array.isArray(data.history) ? data.history : []);
        setDrafts(Array.isArray(data.drafts) ? data.drafts : []);
        setTemplates(Array.isArray(data.templates) ? data.templates : []);
        if (!ccEmails && data.zoho?.defaultCc) setCcEmails(data.zoho.defaultCc);
      }
      if (sigRes.ok) {
        const sigData = await sigRes.json();
        if (Array.isArray(sigData) && sigData.length > 0) {
          setSignatures(sigData);
          const def = sigData.find((s) => s.is_default) || sigData[0];
          if (!selectedSigId || !sigData.some((s) => s.id === selectedSigId)) {
            setSelectedSigId(def.id);
            if (!userTouchedSignature) {
              setIncludeSignature(def.auto_insert !== false);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Could not load Mail Center data", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMailData();
  }, []);

  function addRecipients(raw: string) {
    const parsed = parseEmailList(raw);
    if (parsed.length === 0) return;
    setToChips((prev) => {
      const set = new Set(prev.map((e) => e.toLowerCase()));
      const next = [...prev];
      for (const em of parsed) {
        if (!set.has(em.toLowerCase())) {
          set.add(em.toLowerCase());
          next.push(em);
        }
      }
      return next;
    });
    setToInput("");
  }

  useEffect(() => {
    if (!composeSeed || !editor) return;
    setActiveTab("compose");
    if (composeSeed.quotation) setSelectedQuoteNo(composeSeed.quotation.quotation_no);
    if (composeSeed.documentType) setDocumentType(composeSeed.documentType);
    if (composeSeed.to) setToChips(parseEmailList(composeSeed.to));
    if (composeSeed.cc !== undefined) setCcEmails(composeSeed.cc);
    if (composeSeed.subject !== undefined) setSubject(composeSeed.subject);
    if (composeSeed.bodyHtml !== undefined) {
      editor.commands.setContent(composeSeed.bodyHtml);
      setBodyDirty(false);
    }
    if (composeSeed.autoAttachDoc) {
      void attachErpDocument(composeSeed.autoAttachDoc, composeSeed.quotation || currentQuote);
    }
    if (onClearSeed) onClearSeed();
  }, [composeSeed, editor]);

  function handleLinkedDocumentChange(quoteNo: string, docType: string) {
    setSelectedQuoteNo(quoteNo);
    setDocumentType(docType);
    if (docType === "General") return;

    const q = quotations.find((x) => x.quotation_no === quoteNo) || currentQuote;
    if (docType === "Purchase Order") {
      const vEmail = vendors.find((v) => v.operational_status !== "Blocked")?.email || "";
      if (vEmail) setToChips(parseEmailList(vEmail));
      setSubject(`Purchase Order PO-2026-011 - ${company.name || "AVEN Industrial Automation"}`);
    } else if (q) {
      if (q.client_email && q.client_email.includes("@")) {
        setToChips(parseEmailList(q.client_email));
      } else {
        setToChips([]);
      }
      const subjMap: Record<string, string> = {
        Quotation: `Quotation ${q.quotation_no} for ${q.product_type || "Industrial Automation"} - ${company.name}`,
        "Proforma Invoice": `Proforma Invoice ${q.pi_number || q.quotation_no} - ${company.name}`,
        "Tax Invoice": `Tax Invoice ${q.tax_invoice_number || q.quotation_no} - ${company.name}`,
      };
      if (subjMap[docType]) setSubject(subjMap[docType]);
    }
  }

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
    if (bodyDirty && !window.confirm("Replace current email body with the selected template?")) return;
    setSubject(fillPlaceholders(tpl.subject_template || tpl.subject || "", activeQuoteObj));
    editor.commands.setContent(fillPlaceholders(tpl.body_html, activeQuoteObj));
    setBodyDirty(false);
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

  function processUploadedFiles(files: FileList | File[]) {
    Array.from(files).forEach((file) => {
      if (BLOCKED_ATTACH_EXT.test(file.name)) {
        setStatusBanner({ type: "error", text: `Blocked unsafe file type: ${file.name}` });
        return;
      }
      if (file.size > 3 * 1024 * 1024) {
        setStatusBanner({
          type: "error",
          text: `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds the 3 MB attachment limit (4.5 MB Vercel serverless payload cap with Base64 encoding).`,
        });
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        setAttachments((prev) => [
          ...prev.filter((a) => a.filename !== file.name),
          {
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            base64,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) processUploadedFiles(e.target.files);
    e.target.value = "";
  }

  function handleInlineImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    if (file.size > 1.5 * 1024 * 1024) {
      setStatusBanner({ type: "error", text: "Inline image must be under 1.5 MB." });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = String(reader.result || "");
      if (src.startsWith("data:image/")) {
        editor.chain().focus().setImage({ src }).run();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function downloadAttachment(att: PendingAttachment) {
    const link = document.createElement("a");
    link.href = `data:${att.contentType};base64,${att.base64}`;
    link.download = att.filename;
    link.click();
  }

  function previewAttachment(att: PendingAttachment) {
    const byteChars = atob(att.base64);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: att.contentType });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener");
  }

  function buildFinalEmailHtml(): string {
    const body = editor?.getHTML() || "";
    const wrappedBody = `<div style="font-family: ${fontFamily}, Geneva, sans-serif; font-size: ${fontSize}; line-height: ${lineSpacing}; color: #1f2937;">${body}</div>`;
    const sigNormalized = activeSignatureHtml
      ? activeSignatureHtml.replace(/src=["']\/assets\//gi, 'src="https://erp.avenautomation.in/assets/')
      : "";
    return sigNormalized ? `${wrappedBody}<br/>${sigNormalized}` : wrappedBody;
  }

  async function handleSendEmail() {
    if (!canSend || !editor || sending) return;
    setStatusBanner(null);

    const allRecipients = [...toChips, ...parseEmailList(toInput)];
    if (allRecipients.length === 0) {
      setStatusBanner({ type: "error", text: "Please enter at least one valid recipient email address in To." });
      return;
    }
    if (!subject.trim()) {
      setStatusBanner({ type: "error", text: "Email subject is required." });
      return;
    }
    if (!activeMailbox?.id || activeMailbox?.connection_status !== "Connected") {
      setStatusBanner({
        type: "error",
        text: "No connected Zoho Mail account selected. Connect a Zoho OAuth mailbox in Admin Settings → Mail Accounts.",
      });
      return;
    }

    const totalBytes = attachments.reduce((s, a) => s + a.sizeBytes, 0);
    if (totalBytes > 3 * 1024 * 1024) {
      setStatusBanner({
        type: "error",
        text: "Total attachment size exceeds the 3 MB raw limit (required to stay within Vercel's 4.5 MB serverless request cap after Base64 encoding).",
      });
      return;
    }

    const finalHtml = buildFinalEmailHtml();
    if (/\[REDACTED_[A-Z_]+\]|AVEN_PROT_\d+/i.test(finalHtml + " " + subject)) {
      setStatusBanner({
        type: "error",
        text: "Send blocked: Unresolved redaction placeholders detected. Please restore actual values first.",
      });
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/mail/messages", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          mailboxId: activeMailbox.id,
          mode: composeMode,
          originalMessageId: replyMeta.originalMessageId,
          inReplyTo: replyMeta.inReplyTo,
          quotation_no: documentType === "General" ? null : selectedQuoteNo || null,
          document_type: documentType,
          to: allRecipients,
          cc: ccEmails,
          bcc: bccEmails,
          subject,
          body_html: finalHtml,
          attachments: attachments.map((a) => ({
            filename: a.filename,
            contentType: a.contentType,
            base64: a.base64,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusBanner({ type: "error", text: data.error || "Email delivery failed." });
        return;
      }
      setStatusBanner({
        type: "success",
        text: `Email sent successfully via Zoho Mail API (${activeMailbox.email_address})!`,
      });
      setDraftId(null);
      setComposeMode("new");
      setReplyMeta({});
      setAttachments([]);
      setBodyDirty(false);
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
    const allTo = [...toChips, ...parseEmailList(toInput)].join(", ");
    try {
      const res = await fetch("/api/mail/drafts", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          id: draftId || undefined,
          quotation_no: selectedQuoteNo || null,
          document_type: documentType,
          to_emails: allTo,
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

  function handleDiscardDraft() {
    if (!window.confirm("Discard current draft and reset composer?")) return;
    setDraftId(null);
    setToChips([]);
    setToInput("");
    setSubject("");
    setAttachments([]);
    setBodyDirty(false);
    editor?.commands.setContent(`<p>Dear Sir/Madam,</p><p></p>`);
  }

  async function handleAiAssist(
    mode:
      | "professional"
      | "grammar"
      | "improve"
      | "formal"
      | "concise"
      | "polite"
      | "clear"
      | "followup"
      | "marathi_en"
      | "hindi_en"
  ) {
    if (!canUseAi || !editor || aiLoading) return;
    setAiMenuOpen(false);
    setLastAiMode(mode);

    const { from, to, empty } = editor.state.selection;
    const selectedText = !empty ? editor.state.doc.textBetween(from, to, "\n").trim() : "";
    const originalHtml = editor.getHTML();
    const originalText = selectedText || stripHtmlToText(originalHtml);

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
        setStatusBanner({ type: "error", text: data.error || "AI Polish failed." });
        return;
      }
      setAiDiff({
        originalHtml,
        originalText,
        improvedText: data.improvedText,
        providerUsed: data.providerUsed,
        mode,
        selectionFrom: selectedText ? from : undefined,
        selectionTo: selectedText ? to : undefined,
      });
    } catch {
      setStatusBanner({ type: "error", text: "AI Polish request failed." });
    } finally {
      setAiLoading(false);
    }
  }

  function acceptAiSuggestion() {
    if (!aiDiff || !editor) return;
    setLastPreAiHtml(aiDiff.originalHtml);
    if (typeof aiDiff.selectionFrom === "number" && typeof aiDiff.selectionTo === "number") {
      editor
        .chain()
        .focus()
        .insertContentAt({ from: aiDiff.selectionFrom, to: aiDiff.selectionTo }, aiDiff.improvedText)
        .run();
    } else {
      const paragraphs = aiDiff.improvedText
        .split(/\n{2,}/)
        .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
        .join("");
      editor.commands.setContent(paragraphs);
    }
    setAiDiff(null);
  }

  function undoLastAiChange() {
    if (!lastPreAiHtml || !editor) return;
    editor.commands.setContent(lastPreAiHtml);
    setLastPreAiHtml(null);
  }

  async function saveTemplate() {
    if (!editingTpl || !canManageTemplates) return;
    const res = await fetch("/api/mail/templates", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(editingTpl),
    });
    if (res.ok) {
      setEditingTpl(null);
      await fetchMailData();
    }
  }

  async function deleteTemplate(id: string) {
    const res = await fetch(`/api/mail/templates?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) await fetchMailData();
  }

  async function saveSignature() {
    if (!editingSig || !canManageSignatures) return;
    const res = await fetch("/api/mail/signatures", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(editingSig),
    });
    if (res.ok) {
      setEditingSig(null);
      await fetchMailData();
    } else {
      const err = await res.json().catch(() => ({}));
      setStatusBanner({ type: "error", text: err.error || "Failed to save signature." });
    }
  }

  async function handleSignatureLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingSig) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ fileName: file.name, dataUrl: reader.result }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        const currentHtml = editingSig.html_content || "";
        const updatedHtml = currentHtml.includes("<img")
          ? currentHtml.replace(/src="[^"]*"/, `src="${data.url}"`)
          : `${currentHtml}<br/><img src="${data.url}" alt="Company Logo" style="height:46px;width:auto;" />`;
        setEditingSig({ ...editingSig, logo_url: data.url, html_content: updatedHtml });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  const cardCls = isDark
    ? "bg-[#111113] border border-zinc-800 text-zinc-100"
    : "bg-white border border-slate-200 text-zinc-900 shadow-sm";
  const inputCls = isDark
    ? "bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
    : "bg-slate-50 border-slate-300 text-zinc-900 placeholder-zinc-400";

  return (
    <div
      className={`${
        fullscreen ? "fixed inset-0 z-50 overflow-y-auto bg-[#09090b] p-4" : "p-3 sm:p-6 max-w-[1440px] mx-auto w-full min-w-0"
      } space-y-4`}
    >
      {/* Header Bar */}
      <div className={`${cardCls} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Mail className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">AVEN Mail Center</h2>
            <p className={`text-xs truncate ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
              {activeMailbox?.connection_status === "Connected"
                ? `Active Zoho Mailbox: ${activeMailbox.display_name} <${activeMailbox.email_address}>`
                : "Multi-Account Zoho Mail Workspace · Connect a Zoho OAuth mailbox"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              activeMailbox?.connection_status === "Connected"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-400 border-amber-500/30"
            }`}
          >
            {activeMailbox?.connection_status === "Connected"
              ? "Zoho OAuth Connected"
              : "Mailbox Not Connected"}
          </span>
          {canEditSettings && onOpenAdminSettings && (
            <button
              onClick={onOpenAdminSettings}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
              }`}
            >
              Manage Mail Accounts
            </button>
          )}
          <button
            onClick={() => setFullscreen((f) => !f)}
            className={`p-1.5 rounded-lg border cursor-pointer ${
              isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
            }`}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen Compose"}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
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
            { id: "compose", label: "Compose" },
            { id: "inbox", label: "Zoho Inbox" },
            { id: "drafts", label: `Drafts (ERP) (${drafts.length})` },
            { id: "history", label: `Sent (ERP) (${history.length})` },
            { id: "templates", label: `Templates (${templates.length})` },
            { id: "signatures", label: `Signatures (${signatures.length})` },
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

      {/* COMPOSE WORKSPACE */}
      {activeTab === "compose" && (
        <div className={`${cardCls} rounded-xl overflow-hidden`}>
          {/* Top Action Toolbar (Zoho-style) */}
          <div
            className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 ${
              isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-slate-50 border-slate-200"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              {canSend && (
                <button
                  type="button"
                  disabled={sending}
                  onClick={handleSendEmail}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" /> {sending ? "Sending..." : "Send"}
                </button>
              )}
              {canSend && (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1.5 ${
                    isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-white"
                  }`}
                >
                  <Save className="w-3.5 h-3.5" /> Save Draft
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer"
              >
                Discard
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer flex items-center gap-1.5 ${
                  isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Preview Email
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {/* Compact Linked Document & Template Selector */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">Linked Quotation</label>
                <select
                  value={selectedQuoteNo}
                  onChange={(e) => handleLinkedDocumentChange(e.target.value, documentType)}
                  className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                >
                  {fyFilteredQuotations.map((q) => (
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
                  onChange={(e) => handleLinkedDocumentChange(selectedQuoteNo, e.target.value)}
                  className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                >
                  <option value="Quotation">Quotation</option>
                  <option value="Proforma Invoice">Proforma Invoice</option>
                  <option value="Tax Invoice">Tax Invoice</option>
                  <option value="Purchase Order">Purchase Order</option>
                  <option value="General">General Email</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">Insert Template</label>
                <select
                  value=""
                  onChange={(e) => {
                    const tpl = templates.find((t) => t.id === e.target.value);
                    if (tpl) applyTemplate(tpl);
                  }}
                  className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
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
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">Signature</label>
                <div className="flex items-center gap-2">
                  <select
                    value={includeSignature ? selectedSigId : "__none__"}
                    onChange={(e) => {
                      setUserTouchedSignature(true);
                      if (e.target.value === "__none__") setIncludeSignature(false);
                      else {
                        setIncludeSignature(true);
                        setSelectedSigId(e.target.value);
                      }
                    }}
                    className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`}
                  >
                    <option value="__none__">No Signature</option>
                    {signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Zoho-Style Full-Width Header Rows: From, To, CC, BCC, Subject */}
            <div className={`rounded-lg border divide-y ${isDark ? "border-zinc-800 divide-zinc-800" : "border-slate-200 divide-slate-200"}`}>
              {/* From */}
              <div className="flex items-center px-3 py-2 gap-3 text-xs">
                <span className="w-14 shrink-0 font-semibold opacity-65">From</span>
                {mailboxes.length > 0 ? (
                  <select
                    aria-label="Sending Mailbox"
                    value={activeMailbox?.id || ""}
                    onChange={(e) => {
                      if (bodyDirty && !window.confirm("Switch sending mailbox? Unsaved compose changes will remain in the editor.")) {
                        return;
                      }
                      const found = mailboxes.find((m) => m.id === e.target.value);
                      if (found) setActiveMailbox(found);
                    }}
                    className={`px-2 py-1 rounded border text-xs font-medium ${inputCls}`}
                  >
                    {mailboxes.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} &lt;{m.email_address}&gt; ({m.connection_status})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="truncate font-medium text-amber-400">
                    No Zoho OAuth mailbox connected — ask Admin to connect one in Admin Settings
                  </span>
                )}
              </div>

              {/* To (Chips + Searchable Picker + CC/BCC toggles) */}
              <div className="flex flex-wrap items-center px-3 py-2 gap-2 text-xs relative">
                <span className="w-14 shrink-0 font-semibold opacity-65">To</span>
                <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-[200px]">
                  {toChips.map((em) => (
                    <span
                      key={em}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium"
                    >
                      {em}
                      <button
                        type="button"
                        onClick={() => setToChips((prev) => prev.filter((x) => x !== em))}
                        className="hover:text-white cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={toInput}
                    onChange={(e) => setToInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (["Enter", ",", ";", "Tab"].includes(e.key) && toInput.trim()) {
                        e.preventDefault();
                        addRecipients(toInput);
                      }
                    }}
                    onBlur={() => {
                      if (toInput.trim()) addRecipients(toInput);
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text");
                      if (text.includes(",") || text.includes(";")) {
                        e.preventDefault();
                        addRecipients(text);
                      }
                    }}
                    placeholder="Type email & press Enter, or paste comma/semicolon list"
                    className="flex-1 min-w-[180px] bg-transparent focus:outline-none text-xs py-1"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowRecipientPicker((v) => !v)}
                    className="px-2.5 py-1 rounded border border-zinc-700 text-[11px] font-semibold hover:bg-zinc-800 cursor-pointer"
                  >
                    + Pick Client/Vendor
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCc((v) => !v)}
                    className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    Cc
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBcc((v) => !v)}
                    className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer"
                  >
                    Bcc
                  </button>
                </div>

                {showRecipientPicker && (
                  <div
                    className={`absolute right-3 top-full mt-1 w-80 max-w-full z-30 rounded-xl border shadow-2xl p-2 space-y-2 ${
                      isDark ? "bg-zinc-950 border-zinc-700" : "bg-white border-slate-300"
                    }`}
                  >
                    <input
                      type="text"
                      value={recipientSearch}
                      onChange={(e) => setRecipientSearch(e.target.value)}
                      placeholder="Search client or vendor..."
                      className={`w-full px-2.5 py-1.5 rounded border text-xs ${inputCls}`}
                    />
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredDirectory.map((r) => (
                        <button
                          key={r.email}
                          type="button"
                          onClick={() => {
                            addRecipients(r.email);
                            setShowRecipientPicker(false);
                          }}
                          className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between cursor-pointer ${
                            isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"
                          }`}
                        >
                          <span className="truncate font-medium">{r.label}</span>
                          <span className="text-[10px] opacity-60 ml-2 shrink-0">{r.type}</span>
                        </button>
                      ))}
                      {filteredDirectory.length === 0 && (
                        <div className="text-[11px] opacity-60 p-2 text-center">No matching email addresses</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* CC */}
              {showCc && (
                <div className="flex items-center px-3 py-2 gap-3 text-xs">
                  <span className="w-14 shrink-0 font-semibold opacity-65">Cc</span>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    placeholder="info@avenautomation.in"
                    className="flex-1 bg-transparent focus:outline-none text-xs"
                  />
                </div>
              )}

              {/* BCC */}
              {showBcc && (
                <div className="flex items-center px-3 py-2 gap-3 text-xs">
                  <span className="w-14 shrink-0 font-semibold opacity-65">Bcc</span>
                  <input
                    type="text"
                    value={bccEmails}
                    onChange={(e) => setBccEmails(e.target.value)}
                    placeholder="Optional BCC addresses"
                    className="flex-1 bg-transparent focus:outline-none text-xs"
                  />
                </div>
              )}

              {/* Subject */}
              <div className="flex items-center px-3 py-2 gap-3 text-xs">
                <span className="w-14 shrink-0 font-semibold opacity-65">Subject</span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Enter email subject..."
                  className="flex-1 bg-transparent focus:outline-none text-xs font-medium"
                />
              </div>
            </div>

            {/* Rich-Text Toolbar + AI Toolbar */}
            <div className={`rounded-lg border overflow-hidden ${isDark ? "border-zinc-700" : "border-slate-300"}`}>
              <div
                className={`p-2 border-b flex flex-wrap items-center gap-1 ${
                  isDark ? "bg-zinc-900 border-zinc-800" : "bg-slate-100 border-slate-200"
                }`}
              >
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    setFontFamily(e.target.value);
                    editor?.chain().focus().setFontFamily(e.target.value).run();
                  }}
                  className={`h-7 px-2 rounded border text-[11px] ${inputCls}`}
                  title="Font Family"
                >
                  <option value="Verdana">Verdana</option>
                  <option value="Arial">Arial</option>
                  <option value="Tahoma">Tahoma</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Times New Roman">Times New Roman</option>
                </select>
                <select
                  value={fontSize}
                  onChange={(e) => {
                    const sz = e.target.value;
                    setFontSize(sz);
                    (editor?.chain().focus() as any).setMark("textStyle", { fontSize: sz }).run();
                  }}
                  className={`h-7 px-2 rounded border text-[11px] ${inputCls}`}
                  title="Font Size"
                >
                  <option value="8pt">8 pt</option>
                  <option value="9pt">9 pt</option>
                  <option value="10pt">10 pt</option>
                  <option value="11pt">11 pt</option>
                  <option value="12pt">12 pt</option>
                  <option value="14pt">14 pt</option>
                  <option value="18pt">18 pt</option>
                  <option value="24pt">24 pt</option>
                </select>

                <button type="button" onClick={() => editor?.chain().focus().toggleBold().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("bold") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Bold"><Bold className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleItalic().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("italic") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Italic"><Italic className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("underline") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Underline"><UnderlineIcon className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleStrike().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("strike") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></button>

                <input
                  type="color"
                  onChange={(e) => editor?.chain().focus().setColor(e.target.value).run()}
                  className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
                  title="Text Color"
                />
                <input
                  type="color"
                  defaultValue="#fef08a"
                  onChange={(e) => editor?.chain().focus().toggleHighlight({ color: e.target.value }).run()}
                  className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
                  title="Highlight Color"
                />

                <button type="button" onClick={() => editor?.chain().focus().setTextAlign("left").run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive({ textAlign: "left" }) ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Align Left"><AlignLeft className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().setTextAlign("center").run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive({ textAlign: "center" }) ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Align Center"><AlignCenter className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().setTextAlign("right").run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive({ textAlign: "right" }) ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Align Right"><AlignRight className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().setTextAlign("justify").run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive({ textAlign: "justify" }) ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Justify"><AlignJustify className="w-3.5 h-3.5" /></button>

                <button type="button" onClick={() => editor?.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("bulletList") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Bullet List"><List className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("orderedList") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Numbered List"><ListOrdered className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().sinkListItem("listItem").run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Increase Indent"><Indent className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().liftListItem("listItem").run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Decrease Indent"><Outdent className="w-3.5 h-3.5" /></button>

                <button
                  type="button"
                  onClick={() => {
                    const prev = editor?.getAttributes("link")?.href || "";
                    const url = window.prompt("Enter link URL:", prev);
                    if (url) editor?.chain().focus().setLink({ href: url }).run();
                  }}
                  className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("link") ? "bg-emerald-500/25 text-emerald-400" : ""}`}
                  title="Insert / Edit Link"
                >
                  <Link2 className="w-3.5 h-3.5" />
                </button>
                {editor?.isActive("link") && (
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().unsetLink().run()}
                    className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    title="Remove Link"
                  >
                    <Unlink className="w-3.5 h-3.5" />
                  </button>
                )}
                <label className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Insert Inline Image">
                  <ImagePlus className="w-3.5 h-3.5" />
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleInlineImageUpload} className="hidden" />
                </label>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
                  className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer"
                  title="Insert Table"
                >
                  <Table2 className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => setShowMoreTools((s) => !s)} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title={showMoreTools ? "Collapse Toolbar" : "Expand More Tools"}>
                  {showMoreTools ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                <button type="button" onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Clear Formatting"><Eraser className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().undo().run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Undo"><Undo2 className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => editor?.chain().focus().redo().run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Redo"><Redo2 className="w-3.5 h-3.5" /></button>

                    {showMoreTools && (
                  <div className="w-full flex flex-wrap items-center gap-1 pt-1.5 mt-1 border-t border-zinc-700/40 relative">
                    <select
                      value={lineSpacing}
                      onChange={(e) => {
                        setLineSpacing(e.target.value);
                      }}
                      className={`h-7 px-1.5 rounded border text-[11px] ${inputCls}`}
                      title="Line Spacing"
                    >
                      <option value="1.15">1.15x</option>
                      <option value="1.3">1.3x</option>
                      <option value="1.5">1.5x</option>
                      <option value="1.75">1.75x</option>
                      <option value="2.0">2.0x</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => (editor?.chain().focus() as any).setMark("textStyle", { fontSize: "8pt" }).run()}
                      className="px-1.5 py-1 rounded hover:bg-emerald-500/20 text-[10px] font-bold cursor-pointer"
                      title="Subscript / Small"
                    >
                      X₂
                    </button>
                    <button
                      type="button"
                      onClick={() => (editor?.chain().focus() as any).setMark("textStyle", { fontSize: "9pt" }).run()}
                      className="px-1.5 py-1 rounded hover:bg-emerald-500/20 text-[10px] font-bold cursor-pointer"
                      title="Superscript / Note"
                    >
                      X²
                    </button>
                    <button type="button" onClick={() => editor?.chain().focus().toggleBlockquote().run()} className={`p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer ${editor?.isActive("blockquote") ? "bg-emerald-500/25 text-emerald-400" : ""}`} title="Blockquote"><Quote className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => editor?.chain().focus().setHorizontalRule().run()} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Insert Horizontal Line"><Minus className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => setShowEmojiPicker((p) => !p)} className="p-1.5 rounded hover:bg-emerald-500/20 cursor-pointer" title="Insert Emoji"><Smile className="w-3.5 h-3.5" /></button>
                    {showEmojiPicker && (
                      <div className={`flex items-center gap-1 px-2 py-1 rounded border text-sm ${isDark ? "bg-zinc-950 border-zinc-700" : "bg-white border-slate-300"}`}>
                        {["👍", "🙏", "✅", "📄", "📎", "🤝", "📞", "📧", "⚙️", "🏭"].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => {
                              editor?.chain().focus().insertContent(em).run();
                              setShowEmojiPicker(false);
                            }}
                            className="hover:scale-110 transition-transform cursor-pointer px-0.5"
                          >
                            {em}
                          </button>
                        ))}
                      </div>
                    )}
                    {editor?.isActive("table") && (
                      <>
                        <button type="button" onClick={() => editor?.chain().focus().addRowAfter().run()} className="px-2 py-0.5 rounded text-[10px] border border-zinc-700 hover:bg-zinc-800 cursor-pointer">+ Row</button>
                        <button type="button" onClick={() => editor?.chain().focus().addColumnAfter().run()} className="px-2 py-0.5 rounded text-[10px] border border-zinc-700 hover:bg-zinc-800 cursor-pointer">+ Col</button>
                        <button type="button" onClick={() => editor?.chain().focus().deleteTable().run()} className="px-2 py-0.5 rounded text-[10px] border border-rose-700 text-rose-400 hover:bg-rose-950 cursor-pointer">Delete Table</button>
                      </>
                    )}
                  </div>
                )}

                {canUseAi && aiEnabled && (
                  <div className="relative flex items-center gap-1 ml-auto pl-2 border-l border-zinc-700/50">
                    <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-indigo-500/30">
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={() => handleAiAssist(lastAiMode)}
                        className={`px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer transition-colors disabled:opacity-60 ${
                          isDark
                            ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/35"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                        title="Polish selected text or full email body"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {aiLoading ? "Polishing..." : "AI Polish"}
                      </button>
                      <button
                        type="button"
                        disabled={aiLoading}
                        onClick={() => setAiMenuOpen((v) => !v)}
                        aria-label="Choose AI Polish action"
                        className={`px-1.5 py-1 border-l border-indigo-500/30 cursor-pointer transition-colors disabled:opacity-60 ${
                          isDark
                            ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/35"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        }`}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {aiMenuOpen && (
                      <div
                        className={`absolute right-0 top-full mt-1 z-30 w-56 rounded-lg border shadow-xl py-1 ${
                          isDark ? "bg-zinc-950 border-zinc-700 text-zinc-100" : "bg-white border-slate-200 text-slate-800"
                        }`}
                      >
                        {(
                          [
                            ["professional", "Professional Email"],
                            ["grammar", "Correct Grammar & Spelling"],
                            ["improve", "Improve Writing"],
                            ["formal", "Make Formal"],
                            ["concise", "Make Concise"],
                            ["polite", "Make Polite"],
                            ["clear", "Make More Clear"],
                            ["followup", "Generate Follow-up"],
                            ["marathi_en", "Marathi to English"],
                            ["hindi_en", "Hindi to English"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => handleAiAssist(mode)}
                            className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between cursor-pointer ${
                              isDark ? "hover:bg-zinc-800" : "hover:bg-slate-100"
                            } ${lastAiMode === mode ? "font-semibold text-indigo-400" : ""}`}
                          >
                            <span>{label}</span>
                            {lastAiMode === mode && <Check className="w-3 h-3" />}
                          </button>
                        ))}
                      </div>
                    )}
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

              {/* White B2B Email Compose Canvas (prevents dark-mode bleed into outgoing emails) */}
              <EditorContent editor={editor} />

              {/* Separated Non-AI-Touched Signature Preview Block */}
              {includeSignature && activeSignatureHtml && (
                <div className="bg-white border-t border-slate-200 px-4 py-3 text-zinc-900">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span>Email Signature ({activeSignature?.name})</span>
                    <div className="flex items-center gap-3 normal-case">
                      <button
                        type="button"
                        onClick={() => {
                          if (!editingCurrentSig && customSigOverrideHtml === null) {
                            setCustomSigOverrideHtml(activeSignatureHtml);
                          }
                          setEditingCurrentSig((v) => !v);
                        }}
                        className="text-sky-600 hover:underline cursor-pointer"
                      >
                        {editingCurrentSig ? "Done Editing" : "Edit for This Email"}
                      </button>
                      {customSigOverrideHtml !== null && (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomSigOverrideHtml(null);
                            setEditingCurrentSig(false);
                          }}
                          className="text-amber-600 hover:underline cursor-pointer"
                        >
                          Reset Signature
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setUserTouchedSignature(true);
                          setIncludeSignature(false);
                        }}
                        className="text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("signatures")}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        Manage Signatures
                      </button>
                    </div>
                  </div>
                  {editingCurrentSig ? (
                    <textarea
                      rows={5}
                      value={customSigOverrideHtml ?? activeSignatureHtml}
                      onChange={(e) => setCustomSigOverrideHtml(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded text-xs font-mono text-zinc-900 bg-slate-50"
                    />
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: activeSignatureHtml }} />
                  )}
                </div>
              )}
            </div>

            {/* AI Diff Review Panel */}
            {aiDiff && (
              <div className="p-4 rounded-xl border border-indigo-500/40 bg-indigo-500/10 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Sparkles className="w-4 h-4" />
                    AI Suggestion Review ({aiDiff.mode} · {aiDiff.providerUsed})
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={aiLoading}
                      onClick={() => handleAiAssist(aiDiff.mode as any)}
                      className="px-3 py-1 rounded-lg text-xs border border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/20 cursor-pointer disabled:opacity-50"
                    >
                      {aiLoading ? "Polishing..." : "Retry"}
                    </button>
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

            {/* Enhanced Attachments Toolbar (Drag & Drop + ERP PDFs + Business Files) */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverAttach(true);
              }}
              onDragLeave={() => setDragOverAttach(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverAttach(false);
                if (e.dataTransfer?.files?.length) processUploadedFiles(e.dataTransfer.files);
              }}
              className={`p-3.5 rounded-xl border space-y-3 transition-colors ${
                dragOverAttach
                  ? "border-emerald-500 bg-emerald-500/10"
                  : isDark
                  ? "border-zinc-800 bg-zinc-900/50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold flex items-center gap-1.5 mr-1">
                  <Paperclip className="w-3.5 h-3.5 text-emerald-500" /> Attach ERP Document:
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
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer ${
                      isDark
                        ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                        : "border-slate-300 bg-white hover:bg-slate-100 text-zinc-800"
                    }`}
                  >
                    + {label}
                  </button>
                ))}
                <label
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border cursor-pointer flex items-center gap-1 ${
                    isDark
                      ? "border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                      : "border-slate-300 bg-white hover:bg-slate-100 text-zinc-800"
                  }`}
                >
                  <Upload className="w-3 h-3" /> Upload File (PDF, Office, CSV, Img)
                  <input
                    type="file"
                    accept={ALLOWED_ATTACH_ACCEPT}
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {attachingStatus && <span className="text-[11px] text-emerald-400 font-medium">{attachingStatus}</span>}
              </div>
              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {attachments.map((att) => (
                    <div
                      key={att.filename}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs border ${
                        isDark ? "bg-zinc-950 border-zinc-700" : "bg-white border-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="truncate font-medium" title={att.filename}>{att.filename}</div>
                          <div className="text-[10px] opacity-60">{(att.sizeBytes / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => previewAttachment(att)} className="p-1 hover:text-sky-400 cursor-pointer" title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => downloadAttachment(att)} className="p-1 hover:text-emerald-400 cursor-pointer" title="Download">
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAttachments((prev) => prev.filter((a) => a.filename !== att.filename))}
                          className="p-1 text-rose-400 hover:text-rose-300 cursor-pointer"
                          title="Remove"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ZOHO MULTI-ACCOUNT MAIL WORKSPACE */}
      {activeTab === "inbox" && (
        <ZohoMailboxWorkspace
          theme={theme}
          isAdmin={(currentUser.role || "").toLowerCase() === "admin"}
          mailboxes={mailboxes}
          activeMailbox={activeMailbox}
          onSelectMailbox={(mbx) => {
            if (bodyDirty && !window.confirm("Switch mailbox? You have unsaved compose text.")) return;
            setActiveMailbox(mbx);
          }}
          onOpenAdminSettings={onOpenAdminSettings}
          onComposeAction={(opts) => {
            setComposeMode(opts.mode);
            setReplyMeta({ originalMessageId: opts.originalMessageId, inReplyTo: opts.inReplyTo });
            if (opts.to) setToChips(parseEmailList(opts.to));
            else if (opts.mode === "new") setToChips([]);
            if (opts.cc) setCcEmails(opts.cc);
            if (opts.subject !== undefined) setSubject(opts.subject);
            if (opts.bodyHtml !== undefined && editor) {
              editor.commands.setContent(opts.bodyHtml);
            }
            setActiveTab("compose");
          }}
        />
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
                      setToChips(parseEmailList(d.to_emails || ""));
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
                          h.status === "sent" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"
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
                  placeholder="Category"
                  value={editingTpl.category || ""}
                  onChange={(e) => setEditingTpl({ ...editingTpl, category: e.target.value })}
                  className={`px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <input
                type="text"
                placeholder="Subject Template"
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
                <button onClick={() => setEditingTpl(null)} className="px-3 py-1.5 rounded-lg text-xs border border-zinc-600 cursor-pointer">
                  Cancel
                </button>
                <button onClick={saveTemplate} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white cursor-pointer">
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
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">{t.category}</span>
                  </div>
                  <div className="text-[11px] opacity-70 mt-1 truncate">{t.subject_template || t.subject}</div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button onClick={() => applyTemplate(t)} className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-600 text-white cursor-pointer">
                    Use Template
                  </button>
                  {canManageTemplates && (
                    <button onClick={() => setEditingTpl(t)} className="px-2.5 py-1 rounded text-[11px] border border-zinc-600 cursor-pointer">
                      Edit
                    </button>
                  )}
                  {canManageTemplates && !t.is_default && (
                    <button onClick={() => deleteTemplate(t.id)} className="p-1 text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DYNAMIC SIGNATURE GENERATOR & MANAGEMENT */}
      {activeTab === "signatures" && (
        <SignatureGeneratorPanel
          theme={theme}
          isAdmin={(currentUser.role || "").toLowerCase() === "admin"}
          mailboxes={mailboxes}
          activeMailboxId={activeMailbox?.id || ""}
          onSaved={fetchMailData}
        />
      )}

      {/* Email Preview Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white text-zinc-900 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-50">
              <div>
                <div className="text-xs font-bold">{subject || "(No Subject)"}</div>
                <div className="text-[11px] text-slate-500">
                  To: {[...toChips, ...parseEmailList(toInput)].join(", ") || "-"}
                </div>
              </div>
              <button onClick={() => setPreviewOpen(false)} className="p-1.5 rounded hover:bg-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <div dangerouslySetInnerHTML={{ __html: buildFinalEmailHtml() }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
