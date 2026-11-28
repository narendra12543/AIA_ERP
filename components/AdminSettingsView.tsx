"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Mail,
  Sparkles,
  Database,
  Cloud,
  ShieldCheck,
  Users,
  ScrollText,
  Save,
  RotateCcw,
  Send,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
} from "lucide-react";
import { CompanyInfo, User } from "../lib/types";
import SecurityCenterSection from "./SecurityCenterSection";
import AdminMailAccountsSection from "./AdminMailAccountsSection";

interface AdminSettingsViewProps {
  theme: "dark" | "light";
  currentUser: User;
  company: CompanyInfo;
  onOpenUserManagement: () => void;
  onOpenAuditLogs: () => void;
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

export default function AdminSettingsView({
  theme,
  currentUser,
  company,
  onOpenUserManagement,
  onOpenAuditLogs,
}: AdminSettingsViewProps) {
  const isDark = theme === "dark";
  const [activeSection, setActiveSection] = useState<
    "smtp" | "ai" | "infra" | "company" | "security"
  >("smtp");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [testRecipient, setTestRecipient] = useState("");

  const [smtp, setSmtp] = useState({
    enabled: true,
    provider: "Zoho Mail",
    host: "smtp.zoho.in",
    port: 465,
    encryption: "SSL" as "SSL" | "TLS" | "STARTTLS",
    displayName: "AVEN Industrial Automation",
    senderEmail: "",
    replyTo: "",
    username: "",
    password: "",
    hasPassword: false,
    defaultCc: "",
    defaultBcc: "",
    signatureHtml: "",
    lastTestResult: null as string | null,
    lastTestAt: null as string | null,
    lastTestError: null as string | null,
    source: "environment",
    configured: false,
  });

  const [ai, setAi] = useState({
    enabled: true,
    allowExternalAi: false,
    provider: "auto",
    geminiKey: "",
    hasGeminiKey: false,
    geminiModel: "gemini-2.0-flash",
    languageToolEnabled: true,
    localFallbackEnabled: true,
    defaultTone: "professional",
    dailyLimit: 50,
  });

  const [infra, setInfra] = useState<{
    database: { configured: boolean; connected: boolean; sslMode: string };
    cloudinary: { configured: boolean; cloudName: string | null; folder: string };
    security: {
      passwordExpiryDays: number;
      enablePasswordExpiry: boolean;
      enableRbacEnforcement: boolean;
      encryptionKeyExplicit: boolean;
    };
  } | null>(null);

  async function loadSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setSmtp((prev) => ({
          ...prev,
          ...data.smtp,
          password: data.smtp?.hasPassword ? "••••••••" : "",
        }));
        setAi((prev) => ({
          ...prev,
          ...data.ai,
          geminiKey: data.ai?.hasGeminiKey ? "••••••••" : "",
        }));
        setInfra({
          database: data.database,
          cloudinary: data.cloudinary,
          security: data.security,
        });
      } else {
        setBanner({ type: "error", text: data.error || "Failed to load settings." });
      }
    } catch {
      setBanner({ type: "error", text: "Network error loading Admin Settings." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettings();
  }, []);

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ section: "smtp", data: smtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Failed to save SMTP configuration." });
      } else {
        setBanner({ type: "success", text: "Email & SMTP configuration saved securely (encrypted)." });
        await loadSettings();
      }
    } catch {
      setBanner({ type: "error", text: "Error saving SMTP settings." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSmtpAction(action: "test_smtp" | "send_test_email" | "reset_smtp") {
    setTesting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action, testRecipient }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "SMTP action failed." });
      } else {
        setBanner({
          type: "success",
          text:
            action === "reset_smtp"
              ? "SMTP settings reset to environment defaults."
              : data.message || "SMTP check succeeded.",
        });
      }
      await loadSettings();
    } catch {
      setBanner({ type: "error", text: "Network error during SMTP test." });
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveAi(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ section: "ai", data: ai }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "Failed to save AI settings." });
      } else {
        setBanner({ type: "success", text: "AI Assistant configuration saved securely." });
        await loadSettings();
      }
    } catch {
      setBanner({ type: "error", text: "Error saving AI settings." });
    } finally {
      setSaving(false);
    }
  }

  async function handleTestAi() {
    setTesting(true);
    setBanner(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ action: "test_ai" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBanner({ type: "error", text: data.error || "AI test failed." });
      } else {
        setBanner({
          type: "success",
          text: `AI Assistant Ready (${data.providerMode})`,
        });
      }
    } catch {
      setBanner({ type: "error", text: "Network error testing AI." });
    } finally {
      setTesting(false);
    }
  }

  const cardCls = isDark
    ? "bg-[#111113] border border-zinc-800 text-zinc-100"
    : "bg-white border border-slate-200 text-zinc-900 shadow-sm";
  const inputCls = isDark
    ? "bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500"
    : "bg-slate-50 border-slate-300 text-zinc-900 placeholder-zinc-400";

  return (
    <div className="p-3 sm:p-6 space-y-4 max-w-[1400px] mx-auto w-full min-w-0">
      {/* Header */}
      <div className={`${cardCls} rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Settings className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold truncate">Admin Integration & Security Settings</h2>
            <p className={`text-xs truncate ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
              Signed in as {currentUser.email} · Encrypted server-side configuration
            </p>
          </div>
        </div>
        <button
          onClick={loadSettings}
          disabled={loading}
          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer self-start sm:self-auto ${
            isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "smtp", label: "Email & SMTP", icon: Mail },
            { id: "ai", label: "AI Assistant", icon: Sparkles },
            { id: "infra", label: "Database & Cloudinary", icon: Database },
            { id: "company", label: "Company Profile", icon: Building2 },
            { id: "security", label: "Security & Access", icon: ShieldCheck },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${
                activeSection === tab.id
                  ? "bg-indigo-600 text-white"
                  : isDark
                  ? "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"
                  : "bg-white text-slate-600 hover:text-zinc-900 border border-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {banner && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
            banner.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          {banner.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{banner.text}</span>
        </div>
      )}

      {/* 1. ZOHO MAIL OAUTH ACCOUNTS & SMTP CONFIGURATION */}
      {activeSection === "smtp" && (
        <div className="space-y-4">
          <AdminMailAccountsSection theme={theme} />
          <form onSubmit={handleSaveSmtp} className={`${cardCls} rounded-xl p-4 sm:p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
            <div>
              <h3 className="text-sm font-bold">Email & SMTP Configuration</h3>
              <p className="text-[11px] opacity-70">
                Source: {smtp.source} · Status: {smtp.configured ? "Configured" : "Pending Credentials"}
                {smtp.lastTestResult && ` · Last Test: ${smtp.lastTestResult.toUpperCase()}`}
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={smtp.enabled}
                onChange={(e) => setSmtp({ ...smtp, enabled: e.target.checked })}
                className="accent-emerald-500"
              />
              Email Integration Enabled
            </label>
          </div>

          {smtp.lastTestError && (
            <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              Last SMTP Error: {smtp.lastTestError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">SMTP Provider</label>
              <select
                value={smtp.provider}
                onChange={(e) => {
                  const p = e.target.value;
                  setSmtp({
                    ...smtp,
                    provider: p,
                    host: p === "Zoho Mail" ? "smtp.zoho.in" : p === "Gmail" ? "smtp.gmail.com" : smtp.host,
                    port: p === "Zoho Mail" ? 465 : p === "Gmail" ? 465 : smtp.port,
                  });
                }}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="Zoho Mail">Zoho Mail</option>
                <option value="Gmail">Google Workspace / Gmail</option>
                <option value="Microsoft 365">Microsoft 365</option>
                <option value="Custom SMTP">Custom SMTP</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Sender Display Name</label>
              <input
                type="text"
                value={smtp.displayName}
                onChange={(e) => setSmtp({ ...smtp, displayName: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Sender Email Address</label>
              <input
                type="email"
                value={smtp.senderEmail}
                onChange={(e) => setSmtp({ ...smtp, senderEmail: e.target.value })}
                placeholder="sales@avenautomation.in"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Reply-To Email</label>
              <input
                type="email"
                value={smtp.replyTo}
                onChange={(e) => setSmtp({ ...smtp, replyTo: e.target.value })}
                placeholder="sales@avenautomation.in"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">SMTP Host</label>
              <input
                type="text"
                value={smtp.host}
                onChange={(e) => setSmtp({ ...smtp, host: e.target.value })}
                placeholder="smtp.zoho.in"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">Port</label>
                <input
                  type="number"
                  value={smtp.port}
                  onChange={(e) => setSmtp({ ...smtp, port: Number(e.target.value) })}
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1 opacity-75">Encryption</label>
                <select
                  value={smtp.encryption}
                  onChange={(e) => setSmtp({ ...smtp, encryption: e.target.value as any })}
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                >
                  <option value="SSL">SSL (465)</option>
                  <option value="TLS">TLS</option>
                  <option value="STARTTLS">STARTTLS (587)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">SMTP Username</label>
              <input
                type="text"
                value={smtp.username}
                onChange={(e) => setSmtp({ ...smtp, username: e.target.value })}
                placeholder="sales@avenautomation.in"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">
                SMTP Password / App Password {smtp.hasPassword ? "(Stored Encrypted)" : ""}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={smtp.password}
                onChange={(e) => setSmtp({ ...smtp, password: e.target.value })}
                placeholder="Enter new App Password to update"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Default CC</label>
              <input
                type="text"
                value={smtp.defaultCc}
                onChange={(e) => setSmtp({ ...smtp, defaultCc: e.target.value })}
                placeholder="info@avenautomation.in"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Default BCC</label>
              <input
                type="text"
                value={smtp.defaultBcc}
                onChange={(e) => setSmtp({ ...smtp, defaultBcc: e.target.value })}
                placeholder="Optional BCC"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Custom Email Signature (HTML)</label>
              <input
                type="text"
                value={smtp.signatureHtml}
                onChange={(e) => setSmtp({ ...smtp, signatureHtml: e.target.value })}
                placeholder="Leave blank to use automatic Company Profile signature"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/60">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="Approved test recipient email"
                className={`px-3 py-1.5 rounded-lg border text-xs w-56 ${inputCls}`}
              />
              <button
                type="button"
                disabled={testing}
                onClick={() => handleSmtpAction("send_test_email")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Send Test Email
              </button>
              <button
                type="button"
                disabled={testing}
                onClick={() => handleSmtpAction("test_smtp")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                  isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
                }`}
              >
                Test SMTP Connection
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleSmtpAction("reset_smtp")}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save SMTP Settings"}
              </button>
            </div>
          </div>
        </form>
        </div>
      )}

      {/* 2. AI ASSISTANT CONFIGURATION */}
      {activeSection === "ai" && (
        <form onSubmit={handleSaveAi} className={`${cardCls} rounded-xl p-4 sm:p-5 space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-800/60">
            <div>
              <h3 className="text-sm font-bold">AI Email Assistant Configuration</h3>
              <p className="text-[11px] opacity-70">
                Free-tier provider chain with automatic sensitive data redaction (GSTIN/PAN/IFSC/Bank)
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={ai.enabled}
                onChange={(e) => setAi({ ...ai, enabled: e.target.checked })}
                className="accent-indigo-500"
              />
              AI Assistant Enabled
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Provider Priority</label>
              <select
                value={ai.provider}
                onChange={(e) => setAi({ ...ai, provider: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="auto">Auto (Gemini Free → LanguageTool → Local)</option>
                <option value="gemini">Gemini Free Tier Primary</option>
                <option value="languagetool">LanguageTool Primary</option>
                <option value="local">Local B2B Engine Only (Offline)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">
                Gemini API Key {ai.hasGeminiKey ? "(Stored Encrypted)" : "(Optional Free Tier)"}
              </label>
              <input
                type="password"
                autoComplete="new-password"
                value={ai.geminiKey}
                onChange={(e) => setAi({ ...ai, geminiKey: e.target.value })}
                placeholder="Paste free-tier Gemini API key"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Default Writing Tone</label>
              <select
                value={ai.defaultTone}
                onChange={(e) => setAi({ ...ai, defaultTone: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="professional">Professional</option>
                <option value="formal">Formal</option>
                <option value="concise">Concise</option>
                <option value="polite">Polite</option>
                <option value="grammar">Grammar Only</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold mb-1 opacity-75">Daily Quota Per User</label>
              <input
                type="number"
                min={5}
                max={200}
                value={ai.dailyLimit}
                onChange={(e) => setAi({ ...ai, dailyLimit: Number(e.target.value) })}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div className="flex flex-wrap items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={ai.allowExternalAi}
                  onChange={(e) => setAi({ ...ai, allowExternalAi: e.target.checked })}
                />
                Allow External AI APIs (Opt-In)
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={ai.languageToolEnabled}
                  onChange={(e) => setAi({ ...ai, languageToolEnabled: e.target.checked })}
                />
                LanguageTool Fallback
              </label>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={ai.localFallbackEnabled}
                  onChange={(e) => setAi({ ...ai, localFallbackEnabled: e.target.checked })}
                />
                Local Engine Fallback
              </label>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-zinc-800/60">
            <button
              type="button"
              onClick={handleTestAi}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                isDark ? "border-zinc-700 hover:bg-zinc-800" : "border-slate-300 hover:bg-slate-100"
              }`}
            >
              Test AI Connection
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save AI Settings
            </button>
          </div>
        </form>
      )}

      {/* 3. DATABASE & CLOUDINARY STATUS (READ-ONLY) */}
      {activeSection === "infra" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`${cardCls} rounded-xl p-5 space-y-2`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              <Database className="w-4 h-4 text-emerald-500" /> Neon PostgreSQL Connection
            </div>
            <p className="text-xs opacity-75">Read-only environment status (credentials never exposed in UI).</p>
            <div className="text-xs space-y-1 pt-2">
              <div>DATABASE_URL: <strong>{infra?.database.configured ? "Configured" : "Not Set"}</strong></div>
              <div>Live Connection: <strong>{infra?.database.connected ? "Connected" : "Unavailable"}</strong></div>
              <div>Transport Security: <strong>{infra?.database.sslMode || "-"}</strong></div>
            </div>
          </div>
          <div className={`${cardCls} rounded-xl p-5 space-y-2`}>
            <div className="flex items-center gap-2 font-bold text-sm">
              <Cloud className="w-4 h-4 text-sky-400" /> Cloudinary Image Storage
            </div>
            <p className="text-xs opacity-75">Read-only environment status (API secrets remain server-side).</p>
            <div className="text-xs space-y-1 pt-2">
              <div>Integration Status: <strong>{infra?.cloudinary.configured ? "Configured" : "Not Set"}</strong></div>
              <div>Cloud Name: <strong>{infra?.cloudinary.cloudName || "-"}</strong></div>
              <div>Target Folder: <strong>{infra?.cloudinary.folder || "new_erp"}</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* 4. COMPANY PROFILE SUMMARY */}
      {activeSection === "company" && (
        <div className={`${cardCls} rounded-xl p-5 space-y-2 text-xs`}>
          <h3 className="text-sm font-bold mb-2">Active Company Profile</h3>
          <div><strong>Name:</strong> {company.name}</div>
          <div><strong>GSTIN:</strong> {company.gstin}</div>
          <div><strong>Email:</strong> {company.email}</div>
          <div><strong>Phone:</strong> {company.phone}</div>
          <div><strong>Address:</strong> {company.address}</div>
          <p className="opacity-70 pt-2">
            To update company letterhead, bank details, or GSTIN, edit directly inside Quotation System → Dashboard → Company Settings.
          </p>
        </div>
      )}

      {/* 5. SECURITY & ACCESS */}
      {activeSection === "security" && (
        <div className="space-y-4">
          <div className={`${cardCls} rounded-xl p-5 space-y-4`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg border border-zinc-800">
                <div className="opacity-65">Password Expiry Policy</div>
                <div className="font-bold mt-1">
                  {infra?.security.enablePasswordExpiry
                    ? `${infra.security.passwordExpiryDays} Days Mandatory`
                    : "Disabled"}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-zinc-800">
                <div className="opacity-65">RBAC Enforcement</div>
                <div className="font-bold mt-1">
                  {infra?.security.enableRbacEnforcement ? "Active (Default-Deny)" : "Disabled"}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-zinc-800">
                <div className="opacity-65">Encryption Key Mode</div>
                <div className="font-bold mt-1">
                  {infra?.security.encryptionKeyExplicit ? "SETTINGS_ENCRYPTION_KEY" : "Derived Server Key"}
                </div>
              </div>
              <div className="p-3 rounded-lg border border-zinc-800">
                <div className="opacity-65">Session Timeout</div>
                <div className="font-bold mt-1">Admin 20m / Staff 15m</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={onOpenUserManagement}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer flex items-center gap-1.5"
              >
                <Users className="w-4 h-4" /> Manage Users &amp; Role Permissions
              </button>
              <button
                onClick={onOpenAuditLogs}
                className="px-4 py-2 rounded-lg text-xs font-semibold border border-zinc-700 hover:bg-zinc-800 cursor-pointer flex items-center gap-1.5"
              >
                <ScrollText className="w-4 h-4" /> View Security Audit Logs
              </button>
            </div>
          </div>
          <SecurityCenterSection theme={theme} onOpenUserManagement={onOpenUserManagement} />
        </div>
      )}
    </div>
  );
}
