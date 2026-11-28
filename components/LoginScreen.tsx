"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from "lucide-react";
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
  sessionMessage,
}: LoginScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState(sessionMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  async function handleMfaVerify(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading || !mfaChallengeToken) return;
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/mfa", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_login",
          challengeToken: mfaChallengeToken,
          code: useRecovery ? undefined : mfaCode.trim(),
          recoveryCode: useRecovery ? mfaCode.trim() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "MFA verification failed.");
        setIsLoading(false);
        return;
      }
      setMfaChallengeToken(null);
      setMfaCode("");
      setIsLoading(false);
      onLogin(data.user, data.session);
    } catch {
      setIsLoading(false);
      setError("Unable to verify MFA code.");
    }
  }

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
      if (data.mfaRequired && data.challengeToken) {
        setMfaChallengeToken(data.challengeToken);
        setMfaCode("");
        return;
      }
      onLogin(data.user, data.session);
    } catch {
      setIsLoading(false);
      setError("Unable to reach authentication server. Please verify your network connection and try again.");
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] w-full overflow-x-hidden overflow-y-auto flex flex-col items-center justify-center px-3 py-6 sm:px-6 sm:py-10 bg-[#09090B] text-white"
      style={{
        backgroundImage: 'url("/assets/login-brick-wall.webp")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Ambient Dark Vignette & Soft Edge Falloff */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 50% 34%, rgba(9,9,11,0.18) 0%, rgba(9,9,11,0.72) 58%, rgba(9,9,11,0.95) 100%)",
        }}
      />

      {/* Downward Warm Golden Light Projection Cone onto Brick Wall */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 overflow-hidden flex justify-center"
      >
        <div
          className="w-[620px] max-w-[140vw] h-[720px] -mt-6 opacity-90"
          style={{
            background:
              "radial-gradient(ellipse 52% 48% at 50% 20%, rgba(251,191,36,0.34) 0%, rgba(245,158,11,0.18) 32%, rgba(245,158,11,0.05) 58%, transparent 78%)",
          }}
        />
      </div>

      {/* Main Centered Architectural Column: Industrial Lamp + Glass Card */}
      <div className="relative z-10 w-full max-w-[430px] flex flex-col items-center">
        {/* Wall-Mounted Industrial Lamp */}
        <div className="relative flex flex-col items-center -mb-2 sm:-mb-3 select-none" aria-hidden="true">
          <svg
            viewBox="0 0 180 96"
            className="w-32 h-auto sm:w-40 drop-shadow-[0_12px_20px_rgba(0,0,0,0.9)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Wall mounting plate */}
            <rect x="78" y="4" width="24" height="10" rx="3" fill="#18181B" stroke="#3F3F46" strokeWidth="1.2" />
            {/* Vertical & curved industrial arm */}
            <path d="M90 14 V34" stroke="#27272A" strokeWidth="5" strokeLinecap="round" />
            <path d="M90 14 V34" stroke="#52525B" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
            {/* Socket collar */}
            <rect x="81" y="31" width="18" height="10" rx="2.5" fill="#111113" stroke="#3F3F46" strokeWidth="1" />
            {/* Industrial dome shade */}
            <path
              d="M36 70 C40 44, 62 39, 90 39 C118 39, 140 44, 144 70 Z"
              fill="url(#lampShadeGrad)"
              stroke="#3F3F46"
              strokeWidth="1.2"
            />
            {/* Warm golden rim inside bottom of lamp */}
            <ellipse cx="90" cy="70" rx="54" ry="8" fill="#111113" stroke="#F59E0B" strokeOpacity="0.45" strokeWidth="1.2" />
            {/* Glowing filament bulb */}
            <ellipse cx="90" cy="71" rx="22" ry="6" fill="#FBBF24" fillOpacity="0.95" />
            <ellipse cx="90" cy="71" rx="34" ry="7.5" fill="#F59E0B" fillOpacity="0.42" />
            <defs>
              <linearGradient id="lampShadeGrad" x1="90" y1="39" x2="90" y2="70" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#27272A" />
                <stop offset="60%" stopColor="#111113" />
                <stop offset="100%" stopColor="#09090B" />
              </linearGradient>
            </defs>
          </svg>

          {/* Soft golden pool right under lamp mouth */}
          <div
            className="w-44 sm:w-56 h-8 -mt-3 rounded-full blur-xl pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(251,191,36,0.55) 0%, rgba(245,158,11,0.18) 60%, transparent 100%)",
            }}
          />
        </div>

        {/* Translucent Glassmorphism Login Card */}
        <div
          className="relative w-full rounded-3xl px-5 py-7 sm:px-8 sm:py-9 backdrop-blur-xl border border-amber-500/35"
          style={{
            background: "linear-gradient(180deg, rgba(24,24,27,0.78) 0%, rgba(17,17,19,0.84) 100%)",
            boxShadow:
              "0 24px 60px rgba(0, 0, 0, 0.78), 0 0 38px rgba(245, 158, 11, 0.14), inset 0 1px 0 rgba(251, 191, 36, 0.38)",
          }}
        >
          {/* Warm top-edge light reflection */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-0 h-px"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.85), transparent)",
            }}
          />

          {/* Centered Login Heading */}
          <h1 className="text-center text-2xl sm:text-3xl font-bold tracking-tight mb-6 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-500 bg-clip-text text-transparent">
            Login
          </h1>

          {error && (
            <div
              role="alert"
              className="mb-5 flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/12 px-3.5 py-2.5 text-xs text-rose-200"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          {mfaChallengeToken ? (
            <form onSubmit={handleMfaVerify} className="space-y-4 text-xs">
              <div className="flex items-start gap-2.5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-amber-200">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <div className="font-semibold mb-0.5">Two-Factor Authentication Required</div>
                  <div className="text-[11px] text-amber-200/80">
                    {useRecovery
                      ? "Enter one of your single-use backup recovery codes."
                      : "Enter the 6-digit verification code from your authenticator app."}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="erp-mfa-code" className="sr-only">
                  {useRecovery ? "Backup Recovery Code" : "6-Digit Authenticator Code"}
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="erp-mfa-code"
                    type="text"
                    autoComplete="one-time-code"
                    inputMode={useRecovery ? "text" : "numeric"}
                    required
                    autoFocus
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
                    className="w-full h-11 sm:h-12 rounded-full bg-[#09090B]/65 border border-zinc-700/80 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 pl-11 pr-4 font-mono tracking-widest text-center text-sm text-white placeholder:text-zinc-500 transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || !mfaCode.trim()}
                className="w-full h-11 sm:h-12 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.99] disabled:opacity-55 text-[#09090B] font-semibold text-sm shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <span>Verify &amp; Sign In</span>
                )}
              </button>

              <div className="flex items-center justify-between pt-1 px-1">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((prev) => !prev);
                    setMfaCode("");
                    setError("");
                  }}
                  className="text-[11px] font-medium text-zinc-400 hover:text-amber-300 underline cursor-pointer transition-colors"
                >
                  {useRecovery ? "Use authenticator code" : "Use recovery code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaChallengeToken(null);
                    setMfaCode("");
                    setUseRecovery(false);
                    setError("");
                  }}
                  className="text-[11px] font-medium text-zinc-400 hover:text-white cursor-pointer transition-colors"
                >
                  Back to Login
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStandardLogin} className="space-y-4">
              <div>
                <label htmlFor="erp-login-email" className="sr-only">
                  Work Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="erp-login-email"
                    name="username"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@avenautomation.in"
                    className="w-full h-11 sm:h-12 rounded-full bg-[#09090B]/65 border border-zinc-700/80 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 pl-11 pr-4 text-sm text-white placeholder:text-zinc-400 aven-autofill-dark transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="erp-login-password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="erp-login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full h-11 sm:h-12 rounded-full bg-[#09090B]/65 border border-zinc-700/80 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 pl-11 pr-11 text-sm text-white placeholder:text-zinc-400 aven-autofill-dark transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-zinc-400 hover:text-amber-300 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-11 sm:h-12 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 active:scale-[0.99] disabled:opacity-55 text-[#09090B] font-semibold text-sm shadow-[0_0_24px_rgba(245,158,11,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <span>Login</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
