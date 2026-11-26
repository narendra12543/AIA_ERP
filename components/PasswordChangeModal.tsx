"use client";

import React, { useState, useMemo } from "react";
import { KeyRound, Eye, EyeOff, ShieldCheck, AlertCircle, CheckCircle2, LogOut, X, Loader2 } from "lucide-react";

interface PasswordChangeModalProps {
  isOpen: boolean;
  forced?: boolean;
  userEmail?: string;
  passwordExpiresAt?: string | null;
  theme?: "dark" | "light";
  onSuccess: (newSession: { token: string; expiresAt: string; passwordExpiresAt: string }) => void;
  onClose?: () => void;
  onLogout: () => void;
}

export default function PasswordChangeModal({
  isOpen,
  forced = false,
  userEmail,
  passwordExpiresAt,
  theme = "dark",
  onSuccess,
  onClose,
  onLogout,
}: PasswordChangeModalProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDark = theme === "dark";

  const strength = useMemo(() => {
    if (!newPassword) return { score: 0, label: "Enter password", color: "bg-zinc-700" };
    let score = 1;
    if (newPassword.length >= 12) score++;
    if (newPassword.length >= 16) score++;
    if (/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)) score++;
    if (/[0-9]/.test(newPassword) || /[^a-zA-Z0-9\s]/.test(newPassword) || (newPassword.includes(" ") && newPassword.length >= 14)) score++;

    if (newPassword.length < 12) return { score: 1, label: "Too short (min 12 chars)", color: "bg-rose-500" };
    if (score <= 2) return { score: 2, label: "Fair", color: "bg-amber-500" };
    if (score === 3) return { score: 3, label: "Good", color: "bg-sky-500" };
    if (score === 4) return { score: 4, label: "Strong", color: "bg-emerald-500" };
    return { score: 5, label: "Very Strong", color: "bg-emerald-400" };
  }, [newPassword]);

  if (!isOpen) return null;

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setSuccessMsg("");

    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters long (passphrases supported).");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      let token = "";
      try {
        const raw = sessionStorage.getItem("aven_tab_session");
        if (raw) token = JSON.parse(raw).token || "";
      } catch {}

      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "x-tab-session": token } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to update password.");
        setIsSubmitting(false);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMsg("Password updated! Issuing fresh secure session...");
      setIsSubmitting(false);

      setTimeout(() => {
        onSuccess(data.session);
      }, 600);
    } catch {
      setError("Network error while updating password. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-4">
      <div
        className={`w-full max-w-md rounded-2xl border p-5 sm:p-6 shadow-2xl ${
          isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-zinc-800/60 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">
                {forced ? "Mandatory Password Update Required" : "Change Password"}
              </h2>
              <p className={`text-[11px] mt-0.5 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                {forced
                  ? "Your 15-day password validity has expired or an Admin reset was requested."
                  : `Account: ${userEmail || ""}`}
              </p>
            </div>
          </div>
          {!forced && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {passwordExpiresAt && !forced && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-[11px] border ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-50 border-zinc-200 text-zinc-700"}`}>
            Current password expires: <strong>{new Date(passwordExpiresAt).toLocaleDateString()}</strong>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold mb-1">Existing Password</label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={`w-full rounded-lg pl-3 pr-10 py-2 border text-xs min-h-[40px] focus:outline-none ${
                  isDark ? "bg-black border-zinc-700 text-white focus:border-amber-500" : "bg-white border-zinc-300 text-zinc-900 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowCurrent((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Toggle current password"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">New Password (Min 12 characters / passphrase)</label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={`w-full rounded-lg pl-3 pr-10 py-2 border text-xs min-h-[40px] focus:outline-none ${
                  isDark ? "bg-black border-zinc-700 text-white focus:border-amber-500" : "bg-white border-zinc-300 text-zinc-900 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowNew((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Toggle new password"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {/* Strength Meter */}
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${strength.color}`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-zinc-400">{strength.label}</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Confirm New Password</label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={12}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-lg pl-3 pr-10 py-2 border text-xs min-h-[40px] focus:outline-none ${
                  isDark ? "bg-black border-zinc-700 text-white focus:border-amber-500" : "bg-white border-zinc-300 text-zinc-900 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                aria-label="Toggle confirm password"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && (
              <p className={`text-[10px] mt-1 ${passwordsMatch ? "text-emerald-400" : "text-rose-400"}`}>
                {passwordsMatch ? "Passwords match" : "Passwords do not match"}
              </p>
            )}
          </div>

          <div className={`text-[10px] p-2.5 rounded-lg border ${isDark ? "bg-zinc-900/60 border-zinc-800 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-600"}`}>
            Policy: Minimum 12 characters (passphrases supported). Cannot reuse your current or last 5 passwords. Valid for 15 days.
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition cursor-pointer min-h-[42px]"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !passwordsMatch || newPassword.length < 12}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-2.5 px-4 rounded-lg transition cursor-pointer min-h-[42px]"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>{isSubmitting ? "Updating..." : "Update Password & Continue"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
