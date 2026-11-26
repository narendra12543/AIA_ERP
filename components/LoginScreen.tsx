"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { User } from "../lib/types";

interface LoginScreenProps {
  onLogin: (
    user: User,
    session?: { expiresAt: string; token: string; mustChangePassword?: boolean; passwordExpiresAt?: string | null }
  ) => void;
  availableUsers?: User[];
  theme?: "dark" | "light";
  sessionMessage?: string;
}

export default function LoginScreen({
  onLogin,
  theme = "dark",
  sessionMessage,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(sessionMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const isDark = theme === "dark";

  async function handleStandardLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const enteredPassword = password;

    if (!trimmedEmail) {
      setError("Please enter your work email address.");
      return;
    }

    if (!enteredPassword) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: enteredPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Authentication failed. Please check credentials.");
        setIsLoading(false);
        return;
      }

      // Clear sensitive local form state immediately after login
      setPassword("");
      setIsLoading(false);
      onLogin(data.user, data.session);
    } catch {
      setIsLoading(false);
      setError("Unable to reach authentication server. Please verify your network connection and try again.");
    }
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center p-4 ${
        isDark ? "bg-[#09090b] text-zinc-100" : "bg-zinc-100 text-zinc-900"
      }`}
    >
      <div
        className={`w-full max-w-md rounded-2xl border p-6 sm:p-8 shadow-2xl transition-all ${
          isDark ? "bg-zinc-900/90 border-zinc-800" : "bg-white border-zinc-200"
        }`}
      >
        {/* Header / Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800 text-amber-500 mb-3 shadow-lg">
            <span className="text-2xl font-black">A</span>
          </div>
          <h1 className="text-lg font-black tracking-wider uppercase">
            AVEN INDUSTRIAL AUTOMATION
          </h1>
          <p
            className={`text-xs font-medium mt-1 ${
              isDark ? "text-zinc-400" : "text-zinc-500"
            }`}
          >
            A brand of SPARECONN SOLUTIONS PVT. LTD
          </p>
          <div className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            Enterprise ERP & Quotation System
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleStandardLogin} className="space-y-4 text-xs">
          <div>
            <label
              htmlFor="erp-login-email"
              className={`block font-semibold mb-1.5 ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              Work Email Address
            </label>
            <input
              id="erp-login-email"
              name="username"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@avenautomation.in"
              className={`w-full rounded-lg px-3.5 py-2.5 border text-xs font-medium focus:outline-none transition min-h-[42px] ${
                isDark
                  ? "bg-black border-zinc-700 text-white placeholder-zinc-500 focus:border-amber-500"
                  : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"
              }`}
            />
          </div>

          <div>
            <label
              htmlFor="erp-login-password"
              className={`block font-semibold mb-1.5 ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              Password
            </label>
            <div className="relative">
              <input
                id="erp-login-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className={`w-full rounded-lg pl-3.5 pr-10 py-2.5 border text-xs font-medium focus:outline-none transition min-h-[42px] ${
                  isDark
                    ? "bg-black border-zinc-700 text-white placeholder-zinc-500 focus:border-amber-500"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition cursor-pointer ${
                  isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-bold py-2.5 px-4 rounded-lg transition shadow-md cursor-pointer mt-2 min-h-[44px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>Sign In to ERP</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* System Access Information */}
        <div className={`mt-6 pt-4 border-t text-center ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
          <p className={`text-[11px] font-semibold mb-1 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Authorized Personnel Only
          </p>
          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Access is restricted to active AVEN ERP Administrators and Staff.
          </p>
        </div>

        <div className="mt-5 text-center">
          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-400"}`}>
            Protected ERP System &bull; Active GSTIN 27ABLCS1425N1ZX
          </p>
        </div>
      </div>
    </div>
  );
}
