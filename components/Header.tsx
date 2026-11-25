"use client";

import React from "react";
import { Search, Moon, Sun, Bell, User as UserIcon, Menu, Clock } from "lucide-react";
import { User } from "../lib/types";

interface HeaderProps {
  title: string;
  subtitle: string;
  theme: "dark" | "light";
  onToggleTheme: (theme: "dark" | "light") => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  currentUser?: User | null;
  sessionSecondsLeft?: number;
  onOpenUserModal?: () => void;
  onToggleMobileMenu?: () => void;
}

export default function Header({
  title,
  subtitle,
  theme,
  onToggleTheme,
  searchTerm = "",
  onSearchChange,
  currentUser,
  sessionSecondsLeft,
  onOpenUserModal,
  onToggleMobileMenu,
}: HeaderProps) {
  const isDark = theme === "dark";

  return (
    <header className={`h-16 px-3 sm:px-6 lg:px-8 border-b ${isDark ? "bg-[#09090b] border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"} flex items-center justify-between sticky top-0 z-30 no-print select-none`}>
      {/* Left: View Title & Subtitle + Mobile Hamburger Menu */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className={`p-2 -ml-1 rounded-lg md:hidden transition cursor-pointer ${
            isDark ? "text-zinc-300 hover:bg-zinc-800 hover:text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
          aria-label="Toggle navigation drawer"
          title="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="min-w-0 truncate">
          <h1 className={`text-base sm:text-xl lg:text-2xl font-black tracking-tight leading-none truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
            {title}
          </h1>
          <p className={`text-[10px] sm:text-[11px] mt-1 font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>{subtitle}</p>
        </div>
      </div>

      {/* Right: Search, Dark/Light Toggle, Notification, User Pill */}
      <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 shrink-0">
        {/* Search records */}
        {onSearchChange && (
          <div className="relative hidden md:block">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-zinc-500" : "text-zinc-400"}`} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search records..."
              className={`${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:border-zinc-700" : "bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"} border rounded-lg pl-8 pr-3 py-1.5 text-xs w-52 lg:w-64 focus:outline-none transition`}
            />
          </div>
        )}

        {/* Theme Toggle Pill */}
        <div className={`flex items-center ${isDark ? "bg-zinc-900/90 border-zinc-800" : "bg-zinc-100 border-zinc-300"} border rounded-full p-0.5 text-xs`}>
          <button
            onClick={() => onToggleTheme("dark")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full transition font-medium cursor-pointer ${
              theme === "dark"
                ? "bg-zinc-800 text-white font-semibold shadow-sm"
                : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-black"
            }`}
            title="Dark mode"
          >
            <Moon className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Dark</span>
          </button>
          <button
            onClick={() => onToggleTheme("light")}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full transition font-medium cursor-pointer ${
              theme === "light"
                ? "bg-white text-black font-semibold shadow-sm"
                : isDark ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-black"
            }`}
            title="Light mode"
          >
            <Sun className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">Light</span>
          </button>
        </div>

        {/* Notification Bell with Badge 8 */}
        <div className="relative cursor-pointer p-1.5 sm:p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition">
          <Bell className="w-4 h-4" />
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-red-500 text-white text-[8px] sm:text-[9px] font-bold flex items-center justify-center leading-none ring-2 ring-[#09090b]">
            8
          </span>
        </div>

        {/* Session Countdown Timer */}
        {sessionSecondsLeft !== undefined && (
          <div
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border text-[10px] sm:text-[11px] font-mono font-semibold transition ${
              sessionSecondsLeft <= 300
                ? "bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse"
                : isDark
                ? "bg-zinc-900 border-zinc-800 text-zinc-300"
                : "bg-zinc-100 border-zinc-200 text-zinc-700"
            }`}
            title="Fixed session expiry countdown"
          >
            <Clock className={`w-3 h-3 ${sessionSecondsLeft <= 300 ? "text-rose-400" : "text-amber-400"}`} />
            <span>
              <span className="hidden md:inline">Session </span>{String(Math.floor(sessionSecondsLeft / 60)).padStart(2, "0")}:{String(sessionSecondsLeft % 60).padStart(2, "0")}
            </span>
          </div>
        )}

        {/* User Pill NK */}
        <button
          onClick={onOpenUserModal}
          className="flex items-center gap-1.5 sm:gap-2 p-1 pl-1.5 sm:pl-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg transition cursor-pointer"
          title="Account & Roles"
        >
          <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-[10px] sm:text-xs text-white">
            {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "NK"}
          </div>
          <span className="text-xs font-semibold text-zinc-300 pr-1 hidden sm:inline">
            {currentUser?.role || "Admin"}
          </span>
        </button>
      </div>
    </header>
  );
}
