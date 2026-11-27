"use client";

import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Smartphone,
  Users,
  AlertTriangle,
  KeyRound,
  CheckCircle2,
  Ban,
  Trash2,
  RefreshCw,
  LogOut,
} from "lucide-react";

interface SecurityCenterSectionProps {
  theme: "dark" | "light";
  onOpenUserManagement: () => void;
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

export default function SecurityCenterSection({ theme, onOpenUserManagement }: SecurityCenterSectionProps) {
  const isDark = theme === "dark";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // MFA Enrollment state
  const [mfaSetup, setMfaSetup] = useState<{
    challengeToken: string;
    qrDataUrl: string;
    manualKey: string;
  } | null>(null);
  const [mfaCurrentPw, setMfaCurrentPw] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);

  async function loadSecurityData() {
    setLoading(true);
    try {
      const res = await fetch("/api/security", { headers: getAuthHeaders() });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadSecurityData();
  }, []);

  async function startMfaEnrollment() {
    setBanner(null);
    const res = await fetch("/api/auth/mfa", { headers: getAuthHeaders() });
    const json = await res.json();
    if (res.ok && !json.mfaEnabled) {
      setMfaSetup(json);
    } else if (json.mfaEnabled) {
      setBanner({ type: "success", text: "MFA is already enabled on your account." });
    } else {
      setBanner({ type: "error", text: json.error || "Could not start MFA enrollment." });
    }
  }

  async function confirmMfaEnrollment(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaSetup) return;
    const res = await fetch("/api/auth/mfa", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        action: "enroll_confirm",
        challengeToken: mfaSetup.challengeToken,
        currentPassword: mfaCurrentPw,
        code: mfaCode,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "MFA activation failed." });
      return;
    }
    setRecoveryCodes(json.recoveryCodes || []);
    setMfaSetup(null);
    setMfaCurrentPw("");
    setMfaCode("");
    setBanner({ type: "success", text: "Two-Factor Authentication activated!" });
    await loadSecurityData();
  }

  async function handleSecurityAction(payload: any) {
    setBanner(null);
    const res = await fetch("/api/security", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "Action failed." });
    } else {
      setBanner({ type: "success", text: "Security action completed." });
      await loadSecurityData();
    }
  }

  async function handleUserApproval(userId: string, approvalAction: string) {
    const res = await fetch("/api/users", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: userId, approvalAction }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBanner({ type: "error", text: json.error || "User action failed." });
    } else {
      setBanner({ type: "success", text: `User ${approvalAction} completed.` });
      await loadSecurityData();
    }
  }

  const cardCls = isDark
    ? "bg-[#111113] border border-zinc-800 text-zinc-100"
    : "bg-white border border-slate-200 text-zinc-900 shadow-sm";
  const inputCls = isDark ? "bg-zinc-900 border-zinc-700 text-white" : "bg-slate-50 border-slate-300 text-zinc-900";

  const users = data?.users || [];
  const pendingUsers = users.filter((u: any) => (u.approval_status || "Approved") === "Pending Approval");
  const devices = data?.devices || [];
  const sessions = data?.sessions || [];
  const alerts = data?.alerts || [];

  return (
    <div className="space-y-4">
      {banner && (
        <div className={`p-3 rounded-lg text-xs border flex items-center gap-2 ${
          banner.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          {banner.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* 1. MFA Enrollment & Recovery Codes */}
      <div className={`${cardCls} rounded-xl p-5 space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" /> Two-Factor Authentication (TOTP MFA)
            </h3>
            <p className="text-[11px] opacity-70">
              Status: <strong>{data?.currentUserMfaEnabled ? "Enabled & Active" : "Not Enrolled"}</strong> · Compatible with Google &amp; Microsoft Authenticator
            </p>
          </div>
          <div className="flex gap-2">
            {!data?.currentUserMfaEnabled && !mfaSetup && (
              <button onClick={startMfaEnrollment} className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                Enroll Authenticator (2FA)
              </button>
            )}
            <button onClick={loadSecurityData} className="p-1.5 rounded-lg border border-zinc-700 cursor-pointer" title="Refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {mfaSetup && (
          <form onSubmit={confirmMfaEnrollment} className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="flex flex-col items-center gap-2">
              <img src={mfaSetup.qrDataUrl} alt="MFA QR Code" className="w-44 h-44 rounded-lg bg-white p-2" />
              <div className="text-[11px] font-mono break-all opacity-80">Manual Key: {mfaSetup.manualKey}</div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold mb-1">Confirm Current Password</label>
                <input type="password" required value={mfaCurrentPw} onChange={(e) => setMfaCurrentPw(e.target.value)} className={`w-full h-9 px-3 rounded-lg border text-xs ${inputCls}`} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold mb-1">6-Digit Authenticator Code</label>
                <input type="text" required maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="123456" className={`w-full h-9 px-3 rounded-lg border text-xs font-mono ${inputCls}`} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setMfaSetup(null)} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-xs cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer">Verify &amp; Activate MFA</button>
              </div>
            </div>
          </form>
        )}

        {recoveryCodes && (
          <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-2">
            <div className="text-xs font-bold text-amber-300">Single-Use MFA Recovery Codes (Shown Once — Save Securely Now)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
              {recoveryCodes.map((c) => (
                <div key={c} className="px-2 py-1 rounded bg-zinc-950 border border-zinc-800 text-center">{c}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Pending Account Approvals */}
      <div className={`${cardCls} rounded-xl p-5 space-y-3`}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" /> User Access &amp; Pending Approvals ({pendingUsers.length} Pending)
          </h3>
          <button onClick={onOpenUserManagement} className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold cursor-pointer">
            Open Full User Management
          </button>
        </div>
        {pendingUsers.length === 0 ? (
          <p className="text-xs opacity-60">No users currently awaiting Admin approval.</p>
        ) : (
          <div className="space-y-2">
            {pendingUsers.map((u: any) => (
              <div key={u.id} className="p-3 rounded-lg border border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <span className="font-bold">{u.name}</span> ({u.email}) · Role: {u.role}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleUserApproval(u.id, "approve")} className="px-3 py-1 rounded bg-emerald-600 text-white font-semibold cursor-pointer">Approve &amp; Activate</button>
                  <button onClick={() => handleUserApproval(u.id, "reject")} className="px-3 py-1 rounded bg-rose-600/20 text-rose-400 border border-rose-500/30 cursor-pointer">Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Device Management */}
      <div className={`${cardCls} rounded-xl p-5 space-y-3 overflow-x-auto`}>
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-sky-400" /> Trusted &amp; Pending Devices ({devices.length})
        </h3>
        {devices.length === 0 ? (
          <p className="text-xs opacity-60">No device records recorded yet.</p>
        ) : (
          <table className="w-full text-xs text-left min-w-[680px]">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase opacity-60">
                <th className="py-2">User</th>
                <th className="py-2">Device</th>
                <th className="py-2">IP</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {devices.map((d: any) => (
                <tr key={d.id}>
                  <td className="py-2">{d.email}</td>
                  <td className="py-2">{d.device_name}</td>
                  <td className="py-2 font-mono">{d.ip_approx || "-"}</td>
                  <td className="py-2">{d.approval_status}</td>
                  <td className="py-2 text-right space-x-1">
                    {d.approval_status !== "Approved" && (
                      <button onClick={() => handleSecurityAction({ action: "approve_device", deviceId: d.id })} className="px-2 py-1 rounded bg-emerald-600 text-white text-[11px] cursor-pointer">Approve</button>
                    )}
                    {d.approval_status === "Approved" && (
                      <button onClick={() => handleSecurityAction({ action: "revoke_device", deviceId: d.id })} className="px-2 py-1 rounded bg-amber-600/20 text-amber-400 text-[11px] cursor-pointer">Revoke</button>
                    )}
                    <button onClick={() => handleSecurityAction({ action: "block_device", deviceId: d.id })} className="px-2 py-1 rounded bg-rose-600/20 text-rose-400 text-[11px] cursor-pointer">Block</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 4. Active Sessions & Security Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${cardCls} rounded-xl p-5 space-y-3`}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" /> Active Sessions ({sessions.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {sessions.map((s: any) => (
              <div key={s.id} className="p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.email} ({s.role})</div>
                  <div className="text-[11px] opacity-65 truncate">IP: {s.ip_approx || "-"} · Expires: {new Date(s.expires_at).toLocaleTimeString()}</div>
                </div>
                <button
                  onClick={() => handleSecurityAction({ action: "revoke_session", sessionId: s.id })}
                  className="px-2.5 py-1 rounded bg-rose-600/20 text-rose-400 text-[11px] cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <LogOut className="w-3 h-3" /> Revoke
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={`${cardCls} rounded-xl p-5 space-y-3`}>
          <h3 className="text-sm font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" /> Security Alerts ({alerts.filter((a: any) => !a.acknowledged).length} Unread)
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="text-xs opacity-60">No security alerts recorded.</p>
            ) : (
              alerts.map((a: any) => (
                <div key={a.id} className="p-2.5 rounded-lg border border-zinc-800 flex items-start justify-between gap-2 text-xs">
                  <div>
                    <div className="font-bold">{a.title}</div>
                    <div className="text-[11px] opacity-75">{a.message}</div>
                  </div>
                  {!a.acknowledged && (
                    <button
                      onClick={() => handleSecurityAction({ action: "acknowledge_alert", alertId: a.id })}
                      className="px-2 py-1 rounded border border-zinc-700 text-[10px] cursor-pointer shrink-0"
                    >
                      Ack
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
