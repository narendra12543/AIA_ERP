"use client";

import React, { useState } from "react";
import { Shield, KeyRound, UserCheck, Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { User } from "../lib/types";

interface LoginScreenProps {
  onLogin: (user: User, session?: { expiresAt: string; token: string }) => void;
  availableUsers: User[];
  theme?: "dark" | "light";
  sessionMessage?: string;
}

export default function LoginScreen({
  onLogin,
  availableUsers,
  theme = "dark",
  sessionMessage,
}: LoginScreenProps) {
  const [email, setEmail] = useState("sales@avenautomation.in");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState(sessionMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const isDark = theme === "dark";

  async function handleStandardLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    const enteredPassword = password.trim();

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmedEmail, password: enteredPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Authentication failed. Please check credentials.");
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      onLogin(data.user, data.session);
    } catch (netErr) {
      // Offline fallback
      const matched = availableUsers.find(
        (u) => u.email.toLowerCase() === trimmedEmail
      );
      if (matched) {
        const expectedPassword = matched.password || (matched.role === "Admin" ? "admin123" : "user123");
        if (enteredPassword !== expectedPassword) {
          setError("Invalid password. Please check your credentials and try again.");
          setIsLoading(false);
          return;
        }
        setIsLoading(false);
        onLogin(matched);
      } else {
        setIsLoading(false);
        setError("Account not found. Please contact the ERP administrator for access.");
      }
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
              className={`block font-semibold mb-1.5 ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              Work Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@avenautomation.in"
                className={`w-full rounded-lg px-3.5 py-2.5 border text-xs font-medium focus:outline-none transition ${
                  isDark
                    ? "bg-black border-zinc-700 text-white placeholder-zinc-500 focus:border-amber-500"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"
                }`}
              />
            </div>
          </div>

          <div>
            <label
              className={`block font-semibold mb-1.5 ${
                isDark ? "text-zinc-300" : "text-zinc-700"
              }`}
            >
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={`w-full rounded-lg px-3.5 py-2.5 border text-xs font-medium focus:outline-none transition ${
                  isDark
                    ? "bg-black border-zinc-700 text-white placeholder-zinc-500 focus:border-amber-500"
                    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"
                }`}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 px-4 rounded-lg transition shadow-md cursor-pointer mt-2"
          >
            <Lock className="w-4 h-4" />
            <span>Sign In to ERP</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* System Access Information */}
        <div className="mt-6 pt-4 border-t border-zinc-800 text-center">
          <p
            className={`text-[11px] font-semibold mb-1 ${
              isDark ? "text-zinc-400" : "text-zinc-600"
            }`}
          >
            Authorized Personnel Only
          </p>
          <p
            className={`text-[10px] ${
              isDark ? "text-zinc-500" : "text-zinc-400"
            }`}
          >
            Access is restricted to active AVEN ERP Administrators and Users.
          </p>
        </div>

        <div className="mt-5 text-center">
          <p
            className={`text-[10px] ${
              isDark ? "text-zinc-500" : "text-zinc-400"
            }`}
          >
            Protected ERP System &bull; Active GSTIN 27ABLCS1425N1ZX
          </p>
        </div>
      </div>
    </div>
  );
}
