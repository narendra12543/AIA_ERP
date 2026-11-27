"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Overview from "../components/Overview";
import QuotationSystem from "../components/QuotationSystem";
import UserManagementModal from "../components/UserManagementModal";
import VendorManagementModal from "../components/VendorManagementModal";
import PasswordChangeModal from "../components/PasswordChangeModal";
import AuditLogsModal from "../components/AuditLogsModal";
import MailCenter, { MailComposeSeed } from "../components/MailCenter";
import AdminSettingsView from "../components/AdminSettingsView";
import Page1Technical from "../components/Page1Technical";
import CommercialOffer from "../components/CommercialOffer";
import ProformaInvoice from "../components/ProformaInvoice";
import TaxInvoice from "../components/TaxInvoice";
import PurchaseOrderComponent from "../components/PurchaseOrder";
import LoginScreen from "../components/LoginScreen";
import { CompanyInfo, Quotation, SpecProfile, User, Vendor } from "../lib/types";
import { hasPermission } from "../lib/permissions";
import { initialData } from "../lib/mock-data";
import { initialVendors } from "../lib/sample-data";
import {
  buildQuotationPdfName,
  buildPIPdfName,
  buildTIPdfName,
  buildPOPdfName,
  currentFY,
  nextQuotationNo,
  nextPINumber,
  nextTaxInvoiceNumber,
  createRevision,
} from "../lib/vba-engine";
import { exportElementsToPdf } from "../lib/pdf-export";

export default function Home() {
  const [currentView, setCurrentView] = useState<"overview" | "quotation" | "mail" | "settings">("quotation");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [passwordExpiresAt, setPasswordExpiresAt] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isAuditLogsOpen, setIsAuditLogsOpen] = useState(false);
  const [users, setUsers] = useState<User[]>(initialData.users);
  const [mailSeed, setMailSeed] = useState<MailComposeSeed | null>(null);

  // Business state
  const [company, setCompany] = useState<CompanyInfo>(initialData.company);
  const [quotations, setQuotations] = useState<Quotation[]>(initialData.quotations);
  const [currentQuote, setCurrentQuote] = useState<Quotation>(initialData.quotations[0]);
  const [specProfiles, setSpecProfiles] = useState<SpecProfile[]>(initialData.spec_profiles);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string>("");
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(1200);
  const [showSessionWarning, setShowSessionWarning] = useState<boolean>(false);

  // Dedicated PO Vendors state - strictly separated from customer/client database
  const [vendors, setVendors] = useState<Vendor[]>(initialData.vendors || initialVendors);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);

  // PDF Export Status
  const [exportStatus, setExportStatus] = useState<string>("");

  // Helper to load persistent records from API with tab-scoped token
  async function loadPersistentData(token?: string) {
    const headers: HeadersInit = token ? { "x-tab-session": token } : {};

    try {
      const qRes = await fetch("/api/quotes", { headers });
      if (qRes.ok) {
        const qData = await qRes.json();
        if (Array.isArray(qData) && qData.length > 0) {
          setQuotations(qData);
          setCurrentQuote(qData[0]);
        }
      }
    } catch (e) {
      console.warn("Could not load quotes from API", e);
    }

    try {
      const cRes = await fetch("/api/company", { headers });
      if (cRes.ok) {
        const cData = await cRes.json();
        if (cData && cData.name) setCompany(cData);
      }
    } catch (e) {
      console.warn("Could not load company from API", e);
    }

    try {
      const vRes = await fetch("/api/vendors", { headers });
      if (vRes.ok) {
        const vData = await vRes.json();
        if (Array.isArray(vData) && vData.length > 0) setVendors(vData);
      }
    } catch (e) {
      console.warn("Could not load vendors from API", e);
    }

    try {
      const sRes = await fetch("/api/spec-profiles", { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) setSpecProfiles(sData);
      }
    } catch (e) {
      console.warn("Could not load spec profiles from API", e);
    }

    try {
      const uRes = await fetch("/api/users", { headers });
      if (uRes.ok) {
        const uData = await uRes.json();
        if (Array.isArray(uData) && uData.length > 0) setUsers(uData);
      }
    } catch (e) {
      console.warn("Could not load users from API", e);
    }
  }

  // Strict Tab-Level Authentication Check (Section 6)
  // When a new tab is opened in the browser, sessionStorage is empty by browser architecture.
  // This ensures new tabs strictly require authentication before exposing confidential ERP data.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedTheme = localStorage.getItem("aven_theme");
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }

      // Clear legacy localStorage user token so new tabs cannot bypass login
      localStorage.removeItem("aven_current_user");

      const tabSessionRaw = sessionStorage.getItem("aven_tab_session");
      if (tabSessionRaw) {
        try {
          const tabSession = JSON.parse(tabSessionRaw);
          const expiresMs = new Date(tabSession.expiresAt).getTime();
          const now = Date.now();
          if (expiresMs > now && tabSession.user) {
            // Verify tab session with server
            fetch("/api/auth/session", {
              headers: { "x-tab-session": tabSession.token || "" },
            })
              .then((res) => res.json())
              .then((data) => {
                if (data && data.authenticated && data.user) {
                  setCurrentUser(data.user);
                  setMustChangePassword(Boolean(data.mustChangePassword));
                  setPasswordExpiresAt(data.passwordExpiresAt || data.user.password_expires_at || null);
                  const serverExpiresMs = new Date(data.expiresAt).getTime();
                  setSessionExpiresAt(serverExpiresMs);
                  const left = Math.max(0, Math.floor((serverExpiresMs - Date.now()) / 1000));
                  setSessionSecondsLeft(left);
                  if (!data.mustChangePassword) {
                    loadPersistentData(tabSession.token);
                  }
                } else {
                  sessionStorage.removeItem("aven_tab_session");
                  setCurrentUser(null);
                }
              })
              .catch(() => {
                sessionStorage.removeItem("aven_tab_session");
                setCurrentUser(null);
              })
              .finally(() => {
                setIsAuthChecking(false);
              });
            return;
          } else {
            sessionStorage.removeItem("aven_tab_session");
          }
        } catch (e) {
          sessionStorage.removeItem("aven_tab_session");
        }
      }

      // Genuinely New Tab: No active tab session, prompt login
      setIsAuthChecking(false);
      setCurrentUser(null);
    }
  }, []);

  // Server/Client Fixed Session Expiry from Login (Non-resetting)
  // ADMIN: 20 minutes (1200s), USER: 15 minutes (900s)
  // Per Master Prompt Section 10: Fixed session deadline. Do NOT reset on mouse movement, scrolling, typing or activity.
  useEffect(() => {
    if (!currentUser || !sessionExpiresAt) return;
    let warningFired = false;

    const timer = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((sessionExpiresAt - now) / 1000));
      setSessionSecondsLeft(left);

      // 5-minute warning banner (fires once when <= 300s, auto-dismisses after 5s)
      if (left <= 300 && left > 0 && !warningFired) {
        warningFired = true;
        setShowSessionWarning(true);
        setTimeout(() => setShowSessionWarning(false), 5000);
      }

      // Auto-logout on expiry
      if (left <= 0) {
        clearInterval(timer);
        handleLogout("Your session has expired. For enterprise security, please sign in again.");
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [currentUser, sessionExpiresAt]);

  // Vendor Management CRUD
  async function handleAddVendor(vendorData: Omit<Vendor, "id" | "created_at">) {
    const newVendor: Vendor = {
      ...vendorData,
      id: "ven_" + Date.now(),
      created_at: new Date().toISOString().slice(0, 10),
    };
    const updated = [newVendor, ...vendors];
    setVendors(updated);
    try {
      await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newVendor),
      });
    } catch (e) {
      console.warn("Failed to persist vendor via API", e);
    }
  }

  async function handleUpdateVendor(vendor: Vendor) {
    const updated = vendors.map((v) => (v.id === vendor.id ? vendor : v));
    setVendors(updated);
    try {
      await fetch("/api/vendors", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vendor),
      });
    } catch (e) {
      console.warn("Failed to update vendor via API", e);
    }
  }

  async function handleDeleteVendor(id: string) {
    const updated = vendors.filter((v) => v.id !== id);
    setVendors(updated);
    try {
      await fetch(`/api/vendors?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Failed to delete vendor via API", e);
    }
  }

  function handleToggleTheme(newTheme: "dark" | "light") {
    setTheme(newTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("aven_theme", newTheme);
    }
  }

  // Update & Persist Quotation
  async function handleSaveQuotation(quote: Quotation) {
    const idx = quotations.findIndex(
      (q) => q.id === quote.id || q.quotation_no === quote.quotation_no
    );
    let copy: Quotation[];
    if (idx >= 0) {
      copy = [...quotations];
      copy[idx] = quote;
    } else {
      copy = [quote, ...quotations];
    }
    setQuotations(copy);
    setCurrentQuote(quote);

    try {
      await fetch("/api/quotes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quote),
      });
    } catch (e) {
      console.warn("Failed to persist quote to database", e);
    }
  }

  // Delete Quotation from Database
  async function handleDeleteQuotation(id: string) {
    const updated = quotations.filter((q) => q.id !== id && q.quotation_no !== id);
    setQuotations(updated);
    if (currentQuote.id === id || currentQuote.quotation_no === id) {
      if (updated.length > 0) setCurrentQuote(updated[0]);
    }
    try {
      await fetch(`/api/quotes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Failed to delete quote via API", e);
    }
  }

  // Centralized Company Profile Update
  async function handleUpdateCompany(newCompany: CompanyInfo) {
    setCompany(newCompany);
    try {
      await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCompany),
      });
    } catch (e) {
      console.warn("Failed to persist company via API", e);
    }
  }

  // New Fresh Quotation (Next sequential serial number)
  function handleNewQuotation() {
    const nextNo = nextQuotationNo(quotations);
    const nextPI = nextPINumber(quotations);
    const nextTI = nextTaxInvoiceNumber(quotations);

    const newQ: Quotation = {
      id: "q_" + Date.now(),
      quotation_no: nextNo,
      date: new Date().toISOString().slice(0, 10),
      client_name: "",
      client_address: "",
      client_contact: "",
      client_email: "",
      client_gstin: "",
      client_header: "To, ",
      subject: "",
      product_type: "",
      place_of_supply: "27-Maharashtra",
      state: "27-Maharashtra",
      terms:
        "• Delivery Within 1 weeks from the date of payment confirmation.\n• Payment Terms:\n1. 50% Advance 2. 50% Before Dispatch\n• Payment Retention: NIL\n• Freight and Installation Included.\n• Material unloading, civil work and material handling equipment during installation are in client's scope.\n• Power supply up to panel is in client's scope.\n• Validity: 15 days from the date of quotation.\n• Any additional changes will be charged extra.",
      items: [
        {
          id: "it_1",
          name: "",
          hsn: "",
          size: "",
          qty: 1,
          unit: "Nos",
          price: 0,
          amount: 0,
        },
      ],
      subtotal: 0,
      tax_amount: 0,
      cgst: 0,
      sgst: 0,
      igst: 0,
      round_off: 0,
      total: 0,
      advance_received: 0,
      balance_amount: 0,
      amount_words: "",
      status: "Draft",
      is_maharashtra: true,
      pi_number: nextPI,
      tax_invoice_number: nextTI,
      design_image_path: "",
      technical_specs: {},
      spec_profile_id: "",
    };
    setQuotations([newQ, ...quotations]);
    setCurrentQuote(newQ);
  }

  // Revised Quotation Workflow (Exact VBA CreateRevision macro)
  function handleReviseQuotation() {
    if (!currentQuote) return;
    const revisedQuote = createRevision(currentQuote);
    setQuotations([revisedQuote, ...quotations]);
    setCurrentQuote(revisedQuote);
    setExportStatus(`Created Revision: ${revisedQuote.quotation_no}`);
    setTimeout(() => setExportStatus(""), 4000);
  }

  // ============================================================
  // EXACT UI-TO-PDF EXPORT SYSTEM (100% IDENTICAL APPEARANCE)
  // Direct High-Resolution Vector/Canvas PDF + Native Save As Picker
  // ============================================================

  // 1. Export Official 2-Page Quotation PDF (Page 1 Technical + Page 2 Commercial Offer)
  async function handleExportQuotation() {
    const fileName = buildQuotationPdfName(currentQuote.quotation_no, currentQuote.date);
    const p1 = document.getElementById("export_page1");
    const p2 = document.getElementById("export_table2");
    if (!p1 || !p2) {
      console.error("Quotation elements not found in DOM");
      return;
    }

    setExportStatus(`Preparing ${fileName}...`);
    const success = await exportElementsToPdf({
      fileName,
      elements: [p1, p2],
      onProgress: (msg) => setExportStatus(msg),
    });

    if (success) {
      setExportStatus(`Saved ${fileName} successfully!`);
      setTimeout(() => setExportStatus(""), 4000);
    } else {
      setTimeout(() => setExportStatus(""), 2000);
    }
  }

  // 2. Export Official 1-Page Proforma Invoice (PI) PDF
  async function handleExportProforma() {
    const fileName = buildPIPdfName(currentQuote.pi_number, currentQuote.date);
    const pi = document.getElementById("export_pi");
    if (!pi) {
      console.error("PI element not found in DOM");
      return;
    }

    setExportStatus(`Preparing ${fileName}...`);
    const success = await exportElementsToPdf({
      fileName,
      elements: [pi],
      onProgress: (msg) => setExportStatus(msg),
    });

    if (success) {
      setExportStatus(`Saved ${fileName} successfully!`);
      setTimeout(() => setExportStatus(""), 4000);
    } else {
      setTimeout(() => setExportStatus(""), 2000);
    }
  }

  // 3. Export Official 1-Page Tax Invoice (TI) PDF
  async function handleExportTaxInvoice() {
    // Statutory GST Validation Requirement
    const clientGstin = (currentQuote.client_gstin || "").trim();
    if (!clientGstin) {
      alert(
        "⚠️ Tax Invoice Generation Blocked: Client GSTIN is missing.\n\nA valid 15-digit GSTIN is mandatory by statutory law to issue an official Tax Invoice.\nPlease update the Client GSTIN in the quotation details before generating this Tax Invoice."
      );
      return;
    }

    const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;
    if (!gstinPattern.test(clientGstin)) {
      alert(
        `⚠️ Tax Invoice Generation Blocked: Client GSTIN '${clientGstin}' is invalid.\n\nA standard GSTIN must be exactly 15 alphanumeric characters (e.g. 27ABLCS1425N1ZX).\nPlease enter a valid Client GSTIN before generating this Tax Invoice.`
      );
      return;
    }

    const fileName = buildTIPdfName(currentQuote.tax_invoice_number, currentQuote.date);
    const ti = document.getElementById("export_ti");
    if (!ti) {
      console.error("TI element not found in DOM");
      return;
    }

    setExportStatus(`Preparing ${fileName}...`);
    const success = await exportElementsToPdf({
      fileName,
      elements: [ti],
      onProgress: (msg) => setExportStatus(msg),
    });

    if (success) {
      setExportStatus(`Saved ${fileName} successfully!`);
      setTimeout(() => setExportStatus(""), 4000);
    } else {
      setTimeout(() => setExportStatus(""), 2000);
    }
  }

  // 4. Export Official 1-Page Purchase Order (PO) PDF
  async function handleExportPurchaseOrder() {
    const fileName = buildPOPdfName("PO-2026-011", currentQuote.date);
    const po = document.getElementById("export_po");
    if (!po) {
      console.error("PO element not found in DOM");
      return;
    }

    setExportStatus(`Preparing ${fileName}...`);
    const success = await exportElementsToPdf({
      fileName,
      elements: [po],
      onProgress: (msg) => setExportStatus(msg),
    });

    if (success) {
      setExportStatus(`Saved ${fileName} successfully!`);
      setTimeout(() => setExportStatus(""), 4000);
    } else {
      setTimeout(() => setExportStatus(""), 2000);
    }
  }

  function handleExportSinglePage(tabKey: string) {
    if (tabKey === "pi") handleExportProforma();
    else if (tabKey === "ti") handleExportTaxInvoice();
    else if (tabKey === "po") handleExportPurchaseOrder();
    else handleExportQuotation();
  }

  // User Management with API persistence
  async function handleAddUser(userData: Omit<User, "id">) {
    const newUser: User = {
      ...userData,
      id: "usr_" + Date.now(),
      created_at: new Date().toISOString().slice(0, 10),
    };
    setUsers((prev) => [...prev, newUser]);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });
      if (res.ok) {
        const saved = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === newUser.id ? saved : u)));
      }
    } catch (e) {
      console.warn("Failed to persist user via API", e);
    }
  }

  async function handleDeleteUser(id: string) {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    try {
      await fetch(`/api/users?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      console.warn("Failed to delete user via API", e);
    }
  }

  async function handleUpdateRole(id: string, role: "Admin" | "User") {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
    if (currentUser?.id === id) {
      const updated = { ...currentUser, role };
      setCurrentUser(updated);
      if (typeof window !== "undefined") {
        const raw = sessionStorage.getItem("aven_tab_session");
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            parsed.user = updated;
            sessionStorage.setItem("aven_tab_session", JSON.stringify(parsed));
          } catch (e) {}
        }
      }
    }
    try {
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, role }),
      });
    } catch (e) {
      console.warn("Failed to update user role via API", e);
    }
  }

  async function refreshUsers(tokenOverride?: string) {
    try {
      let token = tokenOverride || "";
      if (!token && typeof window !== "undefined") {
        const raw = sessionStorage.getItem("aven_tab_session");
        if (raw) token = JSON.parse(raw)?.token || "";
      }
      const res = await fetch("/api/users", {
        headers: token ? { "x-tab-session": token } : {},
      });
      if (res.ok) {
        const uData = await res.json();
        if (Array.isArray(uData)) setUsers(uData);
      }
    } catch (e) {
      console.warn("Could not refresh users from API", e);
    }
  }

  function handleLogin(
    user: User,
    sessionInfo?: {
      expiresAt?: string;
      token?: string;
      mustChangePassword?: boolean;
      passwordExpiresAt?: string | null;
    }
  ) {
    setCurrentUser(user);
    const forcedChange = Boolean(sessionInfo?.mustChangePassword || user.must_change_password);
    setMustChangePassword(forcedChange);
    setPasswordExpiresAt(sessionInfo?.passwordExpiresAt || user.password_expires_at || null);
    const token = sessionInfo?.token || "";
    let expiresMs: number;
    if (sessionInfo?.expiresAt) {
      expiresMs = new Date(sessionInfo.expiresAt).getTime();
    } else {
      const isAdmin = (user.role || "").toUpperCase() === "ADMIN";
      expiresMs = Date.now() + (isAdmin ? 20 * 60 : 15 * 60) * 1000;
    }
    setSessionExpiresAt(expiresMs);
    const left = Math.max(0, Math.floor((expiresMs - Date.now()) / 1000));
    setSessionSecondsLeft(left);

    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "aven_tab_session",
        JSON.stringify({ user, expiresAt: new Date(expiresMs).toISOString(), token })
      );
      localStorage.removeItem("aven_current_user");
    }
    if (!forcedChange) {
      loadPersistentData(token);
    }
  }

  async function handleLogout(reason?: string) {
    setCurrentUser(null);
    setSessionExpiresAt(null);
    setMustChangePassword(false);
    setPasswordExpiresAt(null);
    setIsChangePasswordOpen(false);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("aven_tab_session");
      localStorage.removeItem("aven_current_user");
    }
    setMobileMenuOpen(false);
    setSessionExpiredMsg(typeof reason === "string" ? reason : "");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
  }

  // Neutral authorization verification screen (No protected data exposed before authentication)
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-zinc-400 text-xs font-medium tracking-wide">Verifying authorization...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={(u, s) => {
          setSessionExpiredMsg("");
          handleLogin(u, s);
        }}
        availableUsers={users}
        theme={theme}
        sessionMessage={sessionExpiredMsg}
      />
    );
  }

  // Non-bypassable 15-day / forced password change gate
  if (mustChangePassword) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme === "dark" ? "bg-[#09090b] text-white" : "bg-slate-50 text-zinc-900"}`}>
        <PasswordChangeModal
          isOpen={true}
          forced={true}
          userEmail={currentUser.email}
          passwordExpiresAt={passwordExpiresAt}
          theme={theme}
          onLogout={() => handleLogout("Password change required before accessing ERP.")}
          onSuccess={({ token, expiresAt, passwordExpiresAt: nextExp }) => {
            setMustChangePassword(false);
            setPasswordExpiresAt(nextExp || null);
            const updatedUser = { ...currentUser, must_change_password: false, password_expires_at: nextExp || null };
            setCurrentUser(updatedUser);
            const expMs = new Date(expiresAt).getTime();
            setSessionExpiresAt(expMs);
            setSessionSecondsLeft(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
            if (typeof window !== "undefined") {
              sessionStorage.setItem(
                "aven_tab_session",
                JSON.stringify({ user: updatedUser, expiresAt, token })
              );
            }
            loadPersistentData(token);
          }}
        />
      </div>
    );
  }

  const daysUntilPasswordExpiry = passwordExpiresAt
    ? Math.ceil((new Date(passwordExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const showPasswordExpiryBanner =
    daysUntilPasswordExpiry !== null && daysUntilPasswordExpiry <= 5 && daysUntilPasswordExpiry >= 0;

  const canExportPdf = hasPermission(currentUser, "quotations.export");
  const canSendEmail = hasPermission(currentUser, "mail.send");
  const canDeleteQuotation = hasPermission(currentUser, "quotations.delete");

  function openMailForQuotation(
    q: Quotation,
    docKind: "quotation" | "pi" | "ti" | "po" = "quotation"
  ) {
    setCurrentQuote(q);
    const subjectMap = {
      quotation: `Quotation ${q.quotation_no} for ${q.product_type || "Industrial Automation"} - ${company.name}`,
      pi: `Proforma Invoice ${q.pi_number || q.quotation_no} - ${company.name}`,
      ti: `Tax Invoice ${q.tax_invoice_number || q.quotation_no} - ${company.name}`,
      po: `Purchase Order PO-2026-011 - ${company.name}`,
    };
    const docTypeMap = {
      quotation: "Quotation" as const,
      pi: "Proforma Invoice" as const,
      ti: "Tax Invoice" as const,
      po: "Purchase Order" as const,
    };
    setMailSeed({
      to: docKind === "po" ? vendors[0]?.email || "" : q.client_email || "",
      subject: subjectMap[docKind],
      bodyHtml: `<p>Dear ${docKind === "po" ? "Sir/Madam" : q.client_contact || "Sir/Madam"},</p><p>Please find attached our <strong>${docTypeMap[docKind]}</strong> (Ref: <strong>${q.quotation_no}</strong>) for your review.</p>`,
      quotation: q,
      documentType: docTypeMap[docKind],
      autoAttachDoc: docKind,
    });
    setCurrentView("mail");
  }

  return (
    <>
      {/* ============================================================ */}
      {/* 1. INTERACTIVE SCREEN UI ROOT CONTAINER                      */}
      {/* ============================================================ */}
      <div
        id="screen_app_root"
        className={`min-h-screen flex ${
          theme === "dark" ? "bg-[#09090b] text-zinc-100" : "bg-slate-50 text-zinc-900"
        }`}
      >
        {/* Left Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => {
            setCurrentView(v);
            setMobileMenuOpen(false);
          }}
          currentUser={currentUser}
          theme={theme}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          onOpenUserManagement={() => {
            refreshUsers();
            setIsUserModalOpen(true);
            setMobileMenuOpen(false);
          }}
          onOpenAuditLogs={() => {
            setIsAuditLogsOpen(true);
            setMobileMenuOpen(false);
          }}
          onOpenChangePassword={() => {
            setIsChangePasswordOpen(true);
            setMobileMenuOpen(false);
          }}
          onLogout={handleLogout}
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onOpenVendorManagement={() => setIsVendorModalOpen(true)}
        />

        {/* Main App Content */}
        <main
          className={`flex-1 ml-0 ${
            sidebarCollapsed ? "md:ml-[68px]" : "md:ml-64"
          } transition-[margin-left] duration-250 ease-out flex flex-col min-w-0 w-full overflow-x-hidden`}
        >
          <Header
            title={
              currentView === "overview"
                ? "Overview"
                : currentView === "mail"
                ? "Zoho Mail Center"
                : currentView === "settings"
                ? "Admin Settings"
                : "Quotations"
            }
            subtitle={
              currentView === "overview"
                ? "Executive summary & all quotations"
                : currentView === "mail"
                ? "Integrated Zoho SMTP, templates & AI assistant"
                : currentView === "settings"
                ? "Encrypted SMTP, AI Assistant, storage & security"
                : "Proposals and scope estimates"
            }
            theme={theme}
            onToggleTheme={handleToggleTheme}
            searchTerm={searchTerm}
            onSearchChange={(s) => setSearchTerm(s)}
            currentUser={currentUser}
            sessionSecondsLeft={sessionSecondsLeft}
            onOpenUserModal={() => {
              refreshUsers();
              setIsUserModalOpen(true);
            }}
            onOpenChangePassword={() => setIsChangePasswordOpen(true)}
            onToggleMobileMenu={() => setMobileMenuOpen((prev) => !prev)}
            onLogout={handleLogout}
          />

          {/* Password Expiry Reminder Banner (<= 5 days remaining) */}
          {showPasswordExpiryBanner && (
            <div className="mx-3 sm:mx-6 mt-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
              <span>
                <strong>Password Expiry Reminder:</strong> Your password expires in{" "}
                <strong>
                  {daysUntilPasswordExpiry} day{daysUntilPasswordExpiry === 1 ? "" : "s"}
                </strong>
                . Update it early to avoid interruption.
              </span>
              <button
                onClick={() => setIsChangePasswordOpen(true)}
                className="px-3 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] cursor-pointer self-start sm:self-auto"
              >
                Change Password
              </button>
            </div>
          )}

          {/* 5-Minute Inactivity Session Warning Banner */}
          {showSessionWarning && (
            <div className="fixed top-18 right-6 z-50 bg-rose-950/95 border border-rose-500/80 text-rose-200 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md animate-in fade-in slide-in-from-top-2 no-print">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="text-xs font-bold text-white">Session Expiry Warning</p>
                <p className="text-[11px] text-rose-300">Your session will expire in 5 minutes due to inactivity.</p>
              </div>
              <button
                onClick={() => setShowSessionWarning(false)}
                className="text-rose-400 hover:text-white text-xs ml-2 cursor-pointer p-1"
                aria-label="Dismiss warning"
              >
                ✕
              </button>
            </div>
          )}

          {currentView === "overview" ? (
            <div className="w-full flex-1">
              <Overview
                quotations={quotations}
                theme={theme}
                vendors={vendors}
                currentUser={currentUser}
                canExportPdf={canExportPdf}
                canSendEmail={canSendEmail}
                canDeleteQuotation={canDeleteQuotation}
                onOpenQuotation={(q) => {
                  setCurrentQuote(q);
                  setCurrentView("quotation");
                }}
                onNewQuotation={() => {
                  handleNewQuotation();
                  setCurrentView("quotation");
                }}
                onOpenVendorModal={() => setIsVendorModalOpen(true)}
                onPrintQuotation={(q) => {
                  setCurrentQuote(q);
                  setTimeout(() => handleExportQuotation(), 100);
                }}
                onDeleteQuotation={(q) => handleDeleteQuotation(q.id)}
                onSendEmail={(q) => openMailForQuotation(q, "quotation")}
                onSendWhatsApp={(q) => {
                  const rawPhone = (q.client_contact || "").replace(/[^0-9]/g, "");
                  const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                  window.open(`https://web.whatsapp.com/send?phone=${phone}&text=Quotation%20${encodeURIComponent(q.quotation_no)}`, "_blank");
                }}
              />
            </div>
          ) : currentView === "mail" ? (
            <div className="w-full flex-1 flex flex-col">
              <MailCenter
                theme={theme}
                currentUser={currentUser}
                company={company}
                quotations={quotations}
                currentQuote={currentQuote}
                vendors={vendors}
                composeSeed={mailSeed}
                onClearSeed={() => setMailSeed(null)}
                onOpenAdminSettings={
                  (currentUser.role || "").toUpperCase() === "ADMIN"
                    ? () => setCurrentView("settings")
                    : undefined
                }
              />
            </div>
          ) : currentView === "settings" && (currentUser.role || "").toUpperCase() === "ADMIN" ? (
            <div className="w-full flex-1 flex flex-col">
              <AdminSettingsView
                theme={theme}
                currentUser={currentUser}
                company={company}
                onOpenUserManagement={() => {
                  refreshUsers();
                  setIsUserModalOpen(true);
                }}
                onOpenAuditLogs={() => setIsAuditLogsOpen(true)}
              />
            </div>
          ) : (
            <div className="w-full flex-1 flex flex-col">
              <QuotationSystem
                currentQuote={currentQuote}
                company={company}
                allQuotations={quotations}
                specProfiles={specProfiles}
                theme={theme}
                vendors={vendors}
                canExportPdf={canExportPdf}
                canSendEmail={canSendEmail}
                onEmailDocument={(docKind) => openMailForQuotation(currentQuote, docKind)}
                onOpenVendorModal={() => setIsVendorModalOpen(true)}
                onUpdateSpecProfiles={(profs) => setSpecProfiles(profs)}
                onUpdateQuote={(q) => setCurrentQuote(q)}
                onSaveQuote={handleSaveQuotation}
                onNewQuote={handleNewQuotation}
                onReviseQuote={handleReviseQuotation}
                onDeleteQuote={handleDeleteQuotation}
                onUpdateCompany={handleUpdateCompany}
                onPrintBothPages={handleExportQuotation}
                onPrintSinglePage={handleExportSinglePage}
              />
            </div>
          )}

          {/* Toast Notification for Export Progress */}
          {exportStatus && (
            <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-white text-xs px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in no-print">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold">{exportStatus}</span>
            </div>
          )}

          {/* User Management Modal */}
          <UserManagementModal
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            users={users}
            onRefreshUsers={() => refreshUsers()}
            currentUserId={currentUser?.id || "usr_1"}
          />

          {/* Audit Logs Modal (Admin) */}
          <AuditLogsModal
            isOpen={isAuditLogsOpen}
            onClose={() => setIsAuditLogsOpen(false)}
            theme={theme}
          />

          {/* Voluntary Change Password Modal */}
          <PasswordChangeModal
            isOpen={isChangePasswordOpen}
            forced={false}
            userEmail={currentUser.email}
            passwordExpiresAt={passwordExpiresAt}
            theme={theme}
            onClose={() => setIsChangePasswordOpen(false)}
            onLogout={() => handleLogout()}
            onSuccess={({ token, expiresAt, passwordExpiresAt: nextExp }) => {
              setIsChangePasswordOpen(false);
              setPasswordExpiresAt(nextExp || null);
              const updatedUser = { ...currentUser, must_change_password: false, password_expires_at: nextExp || null };
              setCurrentUser(updatedUser);
              const expMs = new Date(expiresAt).getTime();
              setSessionExpiresAt(expMs);
              setSessionSecondsLeft(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));
              if (typeof window !== "undefined") {
                sessionStorage.setItem(
                  "aven_tab_session",
                  JSON.stringify({ user: updatedUser, expiresAt, token })
                );
              }
            }}
          />

          {/* Dedicated Vendor / Supplier Management Modal */}
          <VendorManagementModal
            isOpen={isVendorModalOpen}
            onClose={() => setIsVendorModalOpen(false)}
            vendors={vendors}
            onAddVendor={handleAddVendor}
            onUpdateVendor={handleUpdateVendor}
            onDeleteVendor={handleDeleteVendor}
            canApprove={hasPermission(currentUser, "vendors.approve")}
            canViewBank={hasPermission(currentUser, "vendors.bank_view")}
            theme={theme}
          />
        </main>
      </div>

      {/* ============================================================ */}
      {/* 2. DEDICATED HIGH-FIDELITY PRINT & EXPORT ROOT CONTAINER     */}
      {/* Positioned offscreen in screen mode; sole target in @media print */}
      {/* ============================================================ */}
      <div id="dedicated_print_root" aria-hidden="true">
        {/* 1. Official 2-Page Quotation */}
        <div id="export_page1">
          <Page1Technical quote={currentQuote} company={company} specProfiles={specProfiles} />
        </div>
        <div id="export_table2">
          <CommercialOffer quote={currentQuote} company={company} />
        </div>

        {/* 2. Official 1-Page Proforma Invoice */}
        <div id="export_pi">
          <ProformaInvoice quote={currentQuote} company={company} />
        </div>

        {/* 3. Official 1-Page Tax Invoice */}
        <div id="export_ti">
          <TaxInvoice quote={currentQuote} company={company} />
        </div>

        {/* 4. Official 1-Page Purchase Order */}
        <div id="export_po">
          <PurchaseOrderComponent
            po={{
              po_number: "PO-2026-011",
              po_date: currentQuote.date,
              vendor_name: vendors[0]?.name || "Precision Steels & Tubes LLP",
              vendor_address: vendors[0]?.address || "Plot No. 45, PCNTDA Bhosari, Pune - 411026",
              vendor_gstin: vendors[0]?.gstin || "27AAACP1234F1Z8",
              items: currentQuote.items,
              subtotal: currentQuote.subtotal,
              tax_rate: 0.18,
              tax_amount: currentQuote.tax_amount,
              total: currentQuote.total,
              terms: currentQuote.terms,
            }}
            company={company}
          />
        </div>
      </div>
    </>
  );
}
