"use client";

import React, { useState } from "react";
import { Lock, ArrowRight, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { User } from "../lib/types";
import { Card, CardContent, CardFooter, CardHeader } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Alert } from "./ui/alert";
import { Separator } from "./ui/separator";

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
  const [mfaChallengeToken, setMfaChallengeToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState(sessionMessage || "");
  const [isLoading, setIsLoading] = useState(false);
  const isDark = theme === "dark";

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
      className={`min-h-screen flex items-center justify-center p-4 sm:p-6 ${
        isDark ? "bg-[#09090b] text-zinc-100" : "bg-zinc-100 text-zinc-900"
      }`}
    >
      <Card
        className={`w-full max-w-[420px] rounded-2xl shadow-2xl aven-fade-up ${
          isDark ? "bg-[#111216] border-zinc-800" : "bg-white border-zinc-200"
        }`}
      >
        <CardHeader className="text-center items-center pb-4 pt-7 px-6 sm:px-7">
          <div
            className={`inline-flex items-center justify-center w-14 h-14 rounded-xl border mb-2.5 overflow-hidden shadow-sm ${
              isDark ? "bg-white border-zinc-700" : "bg-zinc-50 border-zinc-200"
            }`}
          >
            <img
              src="/assets/logo.png"
              alt="AVEN Industrial Automation"
              className="w-11 h-11 object-contain"
            />
          </div>
          <h1 className="text-base sm:text-lg font-black tracking-wider uppercase">
            AVEN INDUSTRIAL AUTOMATION
          </h1>
          <Badge variant="success" className="mt-1.5 uppercase tracking-wider">
            Enterprise ERP
          </Badge>
        </CardHeader>

        <CardContent className="px-6 sm:px-7 pb-5 space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </Alert>
          )}

          {mfaChallengeToken ? (
            <form onSubmit={handleMfaVerify} className="space-y-4 text-xs">
              <Alert variant="warning">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold mb-0.5">Two-Factor Authentication Required</div>
                  <div className="text-[11px] opacity-90">
                    {useRecovery
                      ? "Enter one of your single-use backup recovery codes."
                      : "Enter the 6-digit verification code from your authenticator app."}
                  </div>
                </div>
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="erp-mfa-code" className={isDark ? "text-zinc-300" : "text-zinc-700"}>
                  {useRecovery ? "Backup Recovery Code" : "6-Digit Authenticator Code"}
                </Label>
                <Input
                  id="erp-mfa-code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode={useRecovery ? "text" : "numeric"}
                  required
                  autoFocus
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder={useRecovery ? "XXXX-XXXX" : "000000"}
                  className={`h-11 font-mono tracking-widest text-center text-base ${
                    isDark
                      ? "bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-600"
                      : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400"
                  }`}
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !mfaCode.trim()}
                size="lg"
                className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Code...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Verify &amp; Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUseRecovery((prev) => !prev);
                    setMfaCode("");
                    setError("");
                  }}
                  className={`text-[11px] font-semibold underline cursor-pointer transition-colors ${
                    isDark ? "text-zinc-400 hover:text-zinc-200" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  {useRecovery ? "Use 6-digit authenticator code" : "Use backup recovery code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMfaChallengeToken(null);
                    setMfaCode("");
                    setUseRecovery(false);
                    setError("");
                  }}
                  className={`text-[11px] font-semibold cursor-pointer transition-colors ${
                    isDark ? "text-zinc-400 hover:text-white" : "text-zinc-600 hover:text-zinc-900"
                  }`}
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleStandardLogin} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="erp-login-email" className={isDark ? "text-zinc-300" : "text-zinc-700"}>
                  Work Email Address
                </Label>
                <Input
                  id="erp-login-email"
                  name="username"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@avenautomation.in"
                  className={`h-11 ${
                    isDark
                      ? "bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-500 aven-autofill-dark"
                      : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 aven-autofill-light"
                  }`}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="erp-login-password" className={isDark ? "text-zinc-300" : "text-zinc-700"}>
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="erp-login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className={`h-11 pr-10 ${
                      isDark
                        ? "bg-zinc-950 border-zinc-700 text-white placeholder:text-zinc-500 aven-autofill-dark"
                        : "bg-white border-zinc-300 text-zinc-900 placeholder:text-zinc-400 aven-autofill-light"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-colors cursor-pointer ${
                      isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900"
                    }`}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                size="lg"
                className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold shadow-md mt-1"
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
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex-col px-6 sm:px-7 pb-6 pt-0 text-center">
          <Separator className={`mb-4 ${isDark ? "bg-zinc-800" : "bg-zinc-200"}`} />
          <p className={`text-[11px] font-semibold mb-0.5 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Authorized Personnel Only
          </p>
          <p className={`text-[10px] ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
            Access is restricted to active AVEN ERP Administrators and Staff.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
