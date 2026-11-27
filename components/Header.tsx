"use client";

import React from "react";
import { Search, Moon, Sun, Bell, Menu, Clock, KeyRound, Users, LogOut } from "lucide-react";
import { User } from "../lib/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  onOpenChangePassword?: () => void;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
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
  onOpenChangePassword,
  onToggleMobileMenu,
  onLogout,
}: HeaderProps) {
  const isDark = theme === "dark";

  return (
    <TooltipProvider delayDuration={150}>
      <header
        className={`h-16 px-3 sm:px-6 lg:px-8 border-b ${
          isDark ? "bg-[#09090b]/95 border-zinc-800 text-white" : "bg-white/95 border-zinc-200 text-zinc-900"
        } backdrop-blur-sm flex items-center justify-between gap-2 sticky top-0 z-30 no-print select-none`}
      >
        {/* Left: Mobile Hamburger + View Title & Subtitle */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className={`p-2 -ml-1 rounded-lg md:hidden transition-all duration-150 active:scale-95 cursor-pointer ${
              isDark
                ? "text-zinc-300 hover:bg-zinc-800 hover:text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
            aria-label="Toggle navigation drawer"
            title="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 truncate">
            <h1
              className={`text-sm sm:text-xl lg:text-2xl font-black tracking-tight leading-none truncate ${
                isDark ? "text-white" : "text-zinc-900"
              }`}
            >
              {title}
            </h1>
            <p className={`text-[10px] sm:text-[11px] mt-1 font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: Search, Sliding Theme Toggle, Notification, Password, Session, Profile Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 lg:gap-3 shrink-0">
          {onSearchChange && (
            <div className="relative hidden md:block">
              <Search
                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDark ? "text-zinc-500" : "text-zinc-400"
                }`}
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search records..."
                className={`${
                  isDark
                    ? "bg-zinc-900 border-zinc-800 text-zinc-200 placeholder-zinc-500 focus:border-amber-500/60"
                    : "bg-zinc-100 border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-blue-500"
                } border rounded-lg pl-8 pr-3 py-1.5 text-xs w-48 lg:w-64 focus:outline-none transition-colors duration-150`}
              />
            </div>
          )}

          {/* Sliding Theme Toggle Pill */}
          <div
            className={`relative flex items-center ${
              isDark ? "bg-zinc-900/90 border-zinc-800" : "bg-zinc-100 border-zinc-300"
            } border rounded-full p-0.5 text-xs`}
          >
            <button
              type="button"
              onClick={() => onToggleTheme("dark")}
              className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full transition-all duration-200 font-medium cursor-pointer ${
                theme === "dark"
                  ? "bg-zinc-800 text-white font-semibold shadow-sm"
                  : isDark
                  ? "text-zinc-400 hover:text-white"
                  : "text-zinc-500 hover:text-black"
              }`}
              title="Dark mode"
            >
              <Moon className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Dark</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleTheme("light")}
              className={`relative z-10 flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 rounded-full transition-all duration-200 font-medium cursor-pointer ${
                theme === "light"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : isDark
                  ? "text-zinc-400 hover:text-white"
                  : "text-zinc-500 hover:text-black"
              }`}
              title="Light mode"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Light</span>
            </button>
          </div>

          {/* Notification Bell */}
          {/* <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`relative p-2 rounded-lg transition-colors duration-150 hidden sm:inline-flex cursor-pointer ${
                  isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-900" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
              </button>
            </TooltipTrigger>
            <TooltipContent>System Alerts Active</TooltipContent>
          </Tooltip> */}

          {/* Voluntary Password Change */}
          {onOpenChangePassword && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className={`hidden sm:inline-flex p-2 rounded-lg border transition-colors duration-150 cursor-pointer ${
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800"
                      : "bg-zinc-100 border-zinc-200 text-zinc-700 hover:text-black hover:bg-zinc-200"
                  }`}
                  aria-label="Change Password"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Change Password</TooltipContent>
            </Tooltip>
          )}

          {/* Session Countdown Timer */}
          {sessionSecondsLeft !== undefined && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[10px] sm:text-[11px] font-mono font-semibold transition-colors ${
                    sessionSecondsLeft <= 300
                      ? "bg-rose-500/10 border-rose-500/40 text-rose-400 animate-pulse"
                      : isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-300"
                      : "bg-zinc-100 border-zinc-200 text-zinc-700"
                  }`}
                >
                  <Clock className={`w-3 h-3 ${sessionSecondsLeft <= 300 ? "text-rose-400" : "text-amber-400"}`} />
                  <span>
                    <span className="hidden md:inline">Session </span>
                    {String(Math.floor(sessionSecondsLeft / 60)).padStart(2, "0")}:
                    {String(sessionSecondsLeft % 60).padStart(2, "0")}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>Fixed session expiry countdown</TooltipContent>
            </Tooltip>
          )}

          {/* User Profile Dropdown */}
          {/* <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex items-center gap-1.5 sm:gap-2 p-1 pl-1.5 sm:pl-2 rounded-lg border transition-all duration-150 active:scale-95 cursor-pointer ${
                  isDark
                    ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-200"
                    : "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800"
                }`}
                aria-label="Account menu"
              >
                <div
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full border flex items-center justify-center font-bold text-[10px] sm:text-xs ${
                    isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
                  }`}
                >
                  {currentUser?.name ? currentUser.name.slice(0, 2).toUpperCase() : "NK"}
                </div>
                <span className="text-xs font-semibold pr-1 hidden sm:inline">
                  {currentUser?.role || "Admin"}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <div className="px-2.5 py-1.5">
                <p className="text-xs font-bold truncate">{currentUser?.name || "AVEN User"}</p>
                <p className="text-[10px] text-zinc-400 truncate">{currentUser?.email || ""}</p>
              </div>
              <DropdownMenuSeparator />
              {onOpenUserModal && (currentUser?.role || "").toUpperCase() === "ADMIN" && (
                <DropdownMenuItem onClick={onOpenUserModal}>
                  <Users className="w-3.5 h-3.5" />
                  <span>Manage Users &amp; Roles</span>
                </DropdownMenuItem>
              )}
              {onOpenChangePassword && (
                <DropdownMenuItem onClick={onOpenChangePassword}>
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Change Password</span>
                </DropdownMenuItem>
              )}
              {onLogout && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-rose-500 focus:text-rose-500">
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu> */}
        </div>
      </header>
    </TooltipProvider>
  );
}
