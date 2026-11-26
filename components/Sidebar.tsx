"use client";

import React from "react";
import { LayoutDashboard, FileText, HelpCircle, Users, LogOut, X, Building2, Mail, ScrollText, KeyRound, Settings } from "lucide-react";
import { User } from "../lib/types";
import { hasPermission } from "../lib/permissions";

interface SidebarProps {
  currentView: "overview" | "quotation" | "mail" | "settings";
  onSelectView: (view: "overview" | "quotation" | "mail" | "settings") => void;
  currentUser: User | null;
  theme?: "dark" | "light";
  onOpenUserManagement: () => void;
  onOpenVendorManagement?: () => void;
  onOpenAuditLogs?: () => void;
  onOpenChangePassword?: () => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({
  currentView,
  onSelectView,
  currentUser,
  theme = "dark",
  onOpenUserManagement,
  onOpenVendorManagement,
  onOpenAuditLogs,
  onOpenChangePassword,
  onLogout,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const isDark = theme === "dark";
  const canManageUsers = hasPermission(currentUser, "users.manage");
  const canViewAuditLogs = hasPermission(currentUser, "audit_logs.view");
  const canViewVendors = hasPermission(currentUser, "vendors.view");
  const canUseMail =
    hasPermission(currentUser, "mail.send") || hasPermission(currentUser, "mail.view");
  const canOpenSettings = hasPermission(currentUser, "mail.settings");

  const handleNav = (v: "overview" | "quotation" | "mail" | "settings") => {
    onSelectView(v);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`w-64 ${
          isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        } border-r flex flex-col justify-between h-screen fixed left-0 top-0 z-50 md:z-40 select-none transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Brand Header */}
        <div>
          <div className={`p-5 border-b ${isDark ? "border-zinc-800" : "border-zinc-200"} flex items-center justify-between gap-3`}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white border border-zinc-700 flex items-center justify-center font-black text-lg tracking-tighter shadow-md">
                A
              </div>
              <div className="flex-1 min-w-0">
                <h1 className={`text-xs font-black tracking-wider uppercase truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                  AVEN AUTOMATION
                </h1>
                <p className={`text-[10px] font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  Master ERP & Quotations
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg md:hidden ${
                  isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                } transition`}
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Navigation Section */}
          <div className="px-3 py-4 space-y-1">
            <p className={`px-3 text-[10px] font-bold tracking-wider uppercase mb-2 ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
              Workspace
            </p>

            {/* Button 1: Overview */}
            <button
              onClick={() => handleNav("overview")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === "overview"
                  ? isDark
                    ? "bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm"
                    : "bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm"
                  : isDark
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  : "text-zinc-600 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Overview</span>
            </button>

            {/* Button 2: Quotation System */}
            <button
              onClick={() => handleNav("quotation")}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                currentView === "quotation"
                  ? isDark
                    ? "bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm"
                    : "bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm"
                  : isDark
                  ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  : "text-zinc-600 hover:text-black hover:bg-zinc-100"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Quotation System</span>
            </button>

            {/* Button 3: Zoho Mail Center */}
            {canUseMail && (
              <button
                onClick={() => handleNav("mail")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === "mail"
                    ? isDark
                      ? "bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm"
                      : "bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm"
                    : isDark
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                }`}
              >
                <Mail className="w-4 h-4 text-emerald-500" />
                <span>Mail Center</span>
              </button>
            )}

            {/* Button 4: PO Vendors */}
            {onOpenVendorManagement && canViewVendors && (
              <button
                onClick={() => {
                  onOpenVendorManagement();
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isDark
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                }`}
              >
                <Building2 className="w-4 h-4 text-amber-500" />
                <span>PO Vendors</span>
              </button>
            )}

            {/* Button 5: Security Audit Logs (Admin) */}
            {onOpenAuditLogs && canViewAuditLogs && (
              <button
                onClick={() => {
                  onOpenAuditLogs();
                  if (onClose) onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  isDark
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                }`}
              >
                <ScrollText className="w-4 h-4 text-indigo-400" />
                <span>Audit Logs</span>
              </button>
            )}

            {/* Button 6: Admin Integration Settings */}
            {canOpenSettings && (
              <button
                onClick={() => handleNav("settings")}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === "settings"
                    ? isDark
                      ? "bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm"
                      : "bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm"
                    : isDark
                    ? "text-zinc-400 hover:text-white hover:bg-zinc-900"
                    : "text-zinc-600 hover:text-black hover:bg-zinc-100"
                }`}
              >
                <Settings className="w-4 h-4 text-sky-400" />
                <span>Admin Settings</span>
              </button>
            )}
          </div>
        </div>

      {/* Bottom Profile & System Section */}
      <div className={`p-3 border-t ${isDark ? "border-zinc-800" : "border-zinc-200"} space-y-3`}>
        {/* Helpdesk link */}
        <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition cursor-pointer ${isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-900" : "text-zinc-600 hover:text-black hover:bg-zinc-100"}`}>
          <HelpCircle className="w-4 h-4 text-emerald-500" />
          <span>Helpdesk & Docs</span>
        </div>

        {/* User Card */}
        <div className={`p-3 rounded-lg border ${isDark ? "bg-zinc-900 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase ${isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"}`}>
                {currentUser?.name?.slice(0, 2) || "NK"}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                  {currentUser?.name || "Super Admin"}
                </p>
                <p className={`text-[10px] truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                  {currentUser?.email || "info@avenautomation.in"}
                </p>
              </div>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${isDark ? "bg-zinc-800 text-zinc-300 border-zinc-700" : "bg-white text-zinc-700 border-zinc-300"}`}>
              {currentUser?.role || "Admin"}
            </span>
          </div>

          <div className={`flex flex-wrap items-center gap-1.5 pt-2 border-t ${isDark ? "border-zinc-800/80" : "border-zinc-200"}`}>
            {canManageUsers && (
              <button
                onClick={onOpenUserManagement}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1 text-[10px] rounded border transition cursor-pointer ${isDark ? "text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/40" : "text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border-zinc-300"}`}
                title="Manage Users & Roles"
              >
                <Users className="w-3 h-3" />
                <span>Users</span>
              </button>
            )}
            {onOpenChangePassword && (
              <button
                onClick={() => {
                  onOpenChangePassword();
                  if (onClose) onClose();
                }}
                className={`flex items-center justify-center gap-1 py-1 px-2 text-[10px] rounded border transition cursor-pointer ${isDark ? "text-zinc-300 hover:text-white bg-zinc-800/50 hover:bg-zinc-800 border-zinc-700/40" : "text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border-zinc-300"}`}
                title="Change Password"
              >
                <KeyRound className="w-3 h-3" />
                <span>PW</span>
              </button>
            )}
            <button
              onClick={() => onLogout()}
              className="flex items-center justify-center gap-1.5 py-1 px-2.5 text-[10px] text-rose-500 hover:text-rose-600 bg-rose-50 dark:bg-rose-950/20 rounded border border-rose-200 dark:border-rose-900/40 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3 h-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
