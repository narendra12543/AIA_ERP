"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Mail,
  Plus,
  RefreshCw,
  Shield,
  Unlink,
} from "lucide-react";

interface AdminMailAccountsSectionProps {
  theme: "dark" | "light";
}

const ROLES = ["Sales", "Accounts", "Purchase", "Store", "Staff"];

export default function AdminMailAccountsSection({ theme }: AdminMailAccountsSectionProps) {
  const isDark = theme === "dark";
  const [mailboxes, setMailboxes] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [zohoConfig, setZohoConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Add Mailbox form
  const [newEmail, setNewEmail] = useState("");
  const [newDisplay, setNewDisplay] = useState("Aven Industrial Automation");

  // Assign Role/User permission form
  const [permMbxId, setPermMbxId] = useState("mbx_sales");
  const [permSubjectType, setPermSubjectType] = useState<"role" | "user">("role");
  const [permSubjectVal, setPermSubjectVal] = useState("Sales");

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/mail/accounts", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setMailboxes(json.mailboxes || []);
      setPermissions(json.permissions || []);
      setZohoConfig(json.zohoConfig || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleConnectOAuth = async (mailboxId: string) => {
    setNotice(null);
    setBusyId(mailboxId);
    try {
      const res = await fetch("/api/mail/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mailboxId }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to start Zoho OAuth." });
        return;
      }
      if (json.authUrl) {
        window.location.href = json.authUrl;
      }
    } catch {
      setNotice({ type: "err", text: "Failed to initiate OAuth flow." });
    } finally {
      setBusyId(null);
    }
  };

  const handleAccountAction = async (payload: any, okMsg: string) => {
    setNotice(null);
    setBusyId(payload.mailboxId || payload.email_address || "global");
    try {
      const res = await fetch("/api/mail/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Operation failed." });
        return;
      }
      setNotice({ type: "ok", text: okMsg });
      await loadAccounts();
    } catch {
      setNotice({ type: "err", text: "Network error." });
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignPermission = async (revoke: boolean = false, override?: any) => {
    setNotice(null);
    const body = override || {
      mailbox_id: permMbxId,
      subject_type: permSubjectType,
      subject_value: permSubjectVal,
      revoke,
    };
    const res = await fetch("/api/mail/accounts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) {
      setNotice({ type: "err", text: json.error || "Failed to update permissions." });
      return;
    }
    setNotice({ type: "ok", text: revoke ? "Mailbox access revoked." : "Mailbox access assigned." });
    await loadAccounts();
  };

  const cardCls = isDark ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]" : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCls = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const inputCls = isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900";
  const mutedCls = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";

  return (
    <div className={`p-5 rounded-xl border space-y-4 ${cardCls}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Mail className="w-4 h-4 text-amber-400" />
            <span>Zoho Mail OAuth Accounts &amp; Mailbox RBAC</span>
          </h3>
          <p className={`text-xs mt-0.5 ${mutedCls}`}>
            Connect authorized Zoho India mailboxes via OAuth 2.0 and manage role/employee access.
          </p>
        </div>
        <button
          type="button"
          onClick={loadAccounts}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer ${subCls}`}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {zohoConfig && !zohoConfig.configured && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            <span>Zoho OAuth Setup Required (ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET missing)</span>
          </div>
          <p>
            Configure <code>ZOHO_CLIENT_ID</code>, <code>ZOHO_CLIENT_SECRET</code>, and{" "}
            <code>ZOHO_REDIRECT_URI={zohoConfig.redirectUri}</code> in Vercel Environment Variables to connect live Zoho accounts.
          </p>
        </div>
      )}

      {notice && (
        <div className={`px-3 py-2 rounded-lg border text-xs ${notice.type === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"}`}>
          {notice.text}
        </div>
      )}

      {/* Mailbox List */}
      <div className="space-y-2.5">
        {mailboxes.map((mbx) => (
          <div key={mbx.id} className={`p-3 rounded-lg border flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${subCls}`}>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">{mbx.email_address}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                  mbx.connection_status === "Connected"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : mbx.connection_status === "Error" || mbx.connection_status === "Revoked"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                }`}>
                  {mbx.connection_status}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cardCls}`}>{mbx.mailbox_type}</span>
                {mbx.is_default && <span className="text-[10px] text-amber-400 font-semibold">Default</span>}
                {!mbx.is_enabled && <span className="text-[10px] text-rose-400 font-semibold">Disabled</span>}
              </div>
              <div className={`text-[11px] ${mutedCls}`}>
                Display: {mbx.display_name} &bull; Last Sync: {mbx.last_sync_at ? new Date(mbx.last_sync_at).toLocaleString() : "Never"}
              </div>
              {mbx.last_error && <div className="text-[11px] text-rose-400">Error: {mbx.last_error}</div>}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0 text-[11px]">
              <button
                type="button"
                disabled={busyId === mbx.id}
                onClick={() => handleConnectOAuth(mbx.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{mbx.connection_status === "Connected" ? "Reconnect" : "Connect Zoho"}</span>
              </button>
              {mbx.connection_status === "Connected" && (
                <>
                  <button
                    type="button"
                    onClick={() => handleAccountAction({ action: "verify", mailboxId: mbx.id }, `Verified ${mbx.email_address}.`)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border cursor-pointer ${cardCls}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAccountAction({ action: "disconnect", mailboxId: mbx.id }, `Disconnected ${mbx.email_address}.`)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-rose-500/30 text-rose-400 cursor-pointer"
                  >
                    <Unlink className="w-3.5 h-3.5" /> Disconnect
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() =>
                  handleAccountAction(
                    { ...mbx, action: "upsert", is_enabled: !mbx.is_enabled },
                    `${mbx.email_address} ${!mbx.is_enabled ? "enabled" : "disabled"}.`
                  )
                }
                className={`px-2.5 py-1.5 rounded border cursor-pointer ${cardCls}`}
              >
                {mbx.is_enabled ? "Disable" : "Enable"}
              </button>
              {!mbx.is_default && (
                <button
                  type="button"
                  onClick={() =>
                    handleAccountAction(
                      { ...mbx, action: "upsert", is_default: true },
                      `${mbx.email_address} set as default.`
                    )
                  }
                  className={`px-2.5 py-1.5 rounded border cursor-pointer ${cardCls}`}
                >
                  Set Default
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Dynamic Mailbox */}
      <div className={`p-3 rounded-lg border space-y-2 ${subCls}`}>
        <div className="text-xs font-semibold">Add Authorized Company Mailbox</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="accounts@avenautomation.in"
            className={`px-2.5 py-1.5 rounded border ${inputCls}`}
          />
          <input
            type="text"
            value={newDisplay}
            onChange={(e) => setNewDisplay(e.target.value)}
            placeholder="Display Name"
            className={`px-2.5 py-1.5 rounded border ${inputCls}`}
          />
          <button
            type="button"
            onClick={() => {
              if (!newEmail.trim()) return;
              handleAccountAction({ action: "upsert", email_address: newEmail.trim(), display_name: newDisplay.trim() }, "Mailbox added.");
              setNewEmail("");
            }}
            className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-white font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Mailbox
          </button>
        </div>
      </div>

      {/* Role & Employee Mailbox Permissions */}
      <div className={`p-3 rounded-lg border space-y-2.5 ${subCls}`}>
        <div className="text-xs font-semibold flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-amber-400" />
          <span>Mailbox Access Assignments</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <select value={permMbxId} onChange={(e) => setPermMbxId(e.target.value)} className={`px-2.5 py-1.5 rounded border ${inputCls}`}>
            {mailboxes.map((m) => (
              <option key={m.id} value={m.id}>{m.email_address}</option>
            ))}
          </select>
          <select value={permSubjectType} onChange={(e) => setPermSubjectType(e.target.value as any)} className={`px-2.5 py-1.5 rounded border ${inputCls}`}>
            <option value="role">Role</option>
            <option value="user">User Email</option>
          </select>
          {permSubjectType === "role" ? (
            <select value={permSubjectVal} onChange={(e) => setPermSubjectVal(e.target.value)} className={`px-2.5 py-1.5 rounded border ${inputCls}`}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <input
              value={permSubjectVal}
              onChange={(e) => setPermSubjectVal(e.target.value)}
              placeholder="user@avenautomation.in"
              className={`px-2.5 py-1.5 rounded border ${inputCls}`}
            />
          )}
          <button
            type="button"
            onClick={() => handleAssignPermission(false)}
            className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold cursor-pointer"
          >
            Grant Access
          </button>
        </div>

        <div className="space-y-1.5">
          {permissions.map((p) => {
            const mbx = mailboxes.find((m) => m.id === p.mailbox_id);
            return (
              <div key={p.id} className={`px-2.5 py-1.5 rounded border text-[11px] flex items-center justify-between gap-2 ${cardCls}`}>
                <span>
                  <strong>{mbx?.email_address || p.mailbox_id}</strong> &rarr; {p.subject_type}: <strong>{p.subject_value}</strong>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    handleAssignPermission(true, {
                      mailbox_id: p.mailbox_id,
                      subject_type: p.subject_type,
                      subject_value: p.subject_value,
                      revoke: true,
                    })
                  }
                  className="text-rose-400 hover:underline cursor-pointer"
                >
                  Revoke
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
