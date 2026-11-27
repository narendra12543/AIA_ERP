"use client";

import React from "react";
import {
  LayoutDashboard,
  FileText,
  HelpCircle,
  Users,
  LogOut,
  Building2,
  Mail,
  ScrollText,
  KeyRound,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Wallet,
  PlusCircle,
  Receipt,
  BadgeIndianRupee,
  Bell,
  UserCircle,
} from "lucide-react";
import { User } from "../lib/types";
import { hasPermission, normalizeRole } from "../lib/permissions";
import type { StaffPortalTab } from "./StaffPortalView";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Sheet, SheetContent } from "./ui/sheet";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";

export type AppView = "overview" | "quotation" | "mail" | "settings" | "finance" | "staff_portal";

interface SidebarProps {
  currentView: AppView;
  onSelectView: (view: AppView) => void;
  staffTab?: StaffPortalTab;
  onSelectStaffTab?: (tab: StaffPortalTab) => void;
  currentUser: User | null;
  theme?: "dark" | "light";
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  staffTab = "dashboard",
  onSelectStaffTab,
  currentUser,
  theme = "dark",
  collapsed = false,
  onToggleCollapse,
  onOpenUserManagement,
  onOpenVendorManagement,
  onOpenAuditLogs,
  onOpenChangePassword,
  onLogout,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const isDark = theme === "dark";
  const canonicalRole = normalizeRole(currentUser?.role);
  const isStaffOnly = canonicalRole === "Staff";
  const canManageUsers = hasPermission(currentUser, "users.manage");
  const canViewAuditLogs = hasPermission(currentUser, "audit_logs.view");
  const canViewVendors = hasPermission(currentUser, "vendors.view");
  const canViewOverview = hasPermission(currentUser, "overview.view");
  const canViewQuotations =
    hasPermission(currentUser, "quotations.view_all") ||
    hasPermission(currentUser, "quotations.view_own");
  const canUseMail =
    hasPermission(currentUser, "mail.send") || hasPermission(currentUser, "mail.view");
  const canViewFinance =
    hasPermission(currentUser, "finance.dashboard") ||
    hasPermission(currentUser, "finance.orders") ||
    hasPermission(currentUser, "expenses.view");
  const canViewOwnExpenses =
    hasPermission(currentUser, "expenses.view_own") || hasPermission(currentUser, "expenses.create");
  const canOpenSettings = hasPermission(currentUser, "mail.settings");

  const handleNav = (v: AppView) => {
    onSelectView(v);
    if (onClose) onClose();
  };

  const handleStaffNav = (t: StaffPortalTab) => {
    onSelectView("staff_portal");
    if (onSelectStaffTab) onSelectStaffTab(t);
    if (onClose) onClose();
  };

  function NavItem({
    label,
    icon,
    active,
    onClick,
    isCollapsed,
  }: {
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    onClick: () => void;
    isCollapsed: boolean;
  }) {
    const btn = (
      <button
        type="button"
        onClick={onClick}
        className={`group relative w-full flex items-center ${
          isCollapsed ? "justify-center px-2" : "gap-3 px-3"
        } py-2.5 min-h-[40px] rounded-lg text-xs font-medium transition-all duration-150 ease-in-out cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/70 ${
          active
            ? isDark
              ? "bg-zinc-800/95 text-white font-semibold border border-zinc-700/70 shadow-sm"
              : "bg-blue-50 text-blue-700 font-bold border border-blue-200 shadow-sm"
            : isDark
            ? "text-zinc-400 hover:text-white hover:bg-zinc-900/90 border border-transparent"
            : "text-zinc-600 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent"
        }`}
      >
        <span
          className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all duration-200 ${
            active ? (isDark ? "bg-amber-500 opacity-100 scale-y-100" : "bg-blue-600 opacity-100 scale-y-100") : "opacity-0 scale-y-50"
          }`}
          aria-hidden="true"
        />
        <span className="shrink-0 transition-transform duration-150 ease-in-out group-hover:scale-105 group-active:scale-95">
          {icon}
        </span>
        {!isCollapsed && <span className="truncate">{label}</span>}
      </button>
    );

    if (isCollapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{btn}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return btn;
  }

  function renderSidebarBody(isCollapsed: boolean, isMobileSheet = false) {
    return (
      <div className="flex flex-col justify-between h-full">
        <div>
          {/* Brand Header */}
          <div
            className={`h-16 ${
              isCollapsed ? "px-2 justify-center" : "px-4 justify-between"
            } border-b ${isDark ? "border-zinc-800" : "border-zinc-200"} flex items-center gap-2.5`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white border border-zinc-700 flex items-center justify-center font-black text-base tracking-tighter shadow-sm shrink-0">
                A
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <h1 className={`text-xs font-black tracking-wider uppercase truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                    AVEN AUTOMATION
                  </h1>
                  {/* <p className={`text-[10px] font-medium truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                    Master ERP &amp; Quotations
                  </p> */}
                </div>
              )}
            </div>

            {!isMobileSheet && onToggleCollapse && !isCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className={`hidden md:inline-flex p-1.5 rounded-lg transition-colors duration-150 cursor-pointer ${
                      isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                    aria-label="Collapse sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Collapse Sidebar</TooltipContent>
              </Tooltip>
            )}
          </div>

          {!isMobileSheet && onToggleCollapse && isCollapsed && (
            <div className="hidden md:flex justify-center pt-2.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    className={`p-2 rounded-lg transition-colors duration-150 cursor-pointer ${
                      isDark ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100"
                    }`}
                    aria-label="Expand sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expand Sidebar</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Navigation Section */}
          <nav className="px-2.5 py-4 space-y-1" aria-label="Primary Workspace Navigation">
            {!isCollapsed && (
              <p className={`px-3 text-[10px] font-bold tracking-wider uppercase mb-2 ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                {isStaffOnly ? "Staff Portal" : "Workspace"}
              </p>
            )}

            {isStaffOnly ? (
              <>
                <NavItem
                  label="My Dashboard"
                  icon={<LayoutDashboard className="w-4 h-4" />}
                  active={currentView === "staff_portal" && staffTab === "dashboard"}
                  onClick={() => handleStaffNav("dashboard")}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  label="Add Expense"
                  icon={<PlusCircle className="w-4 h-4 text-amber-400" />}
                  active={currentView === "staff_portal" && staffTab === "add_expense"}
                  onClick={() => handleStaffNav("add_expense")}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  label="My Expenses"
                  icon={<Receipt className="w-4 h-4" />}
                  active={currentView === "staff_portal" && staffTab === "my_expenses"}
                  onClick={() => handleStaffNav("my_expenses")}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  label="Reimbursements"
                  icon={<BadgeIndianRupee className="w-4 h-4 text-emerald-400" />}
                  active={currentView === "staff_portal" && staffTab === "reimbursements"}
                  onClick={() => handleStaffNav("reimbursements")}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  label="Notifications"
                  icon={<Bell className="w-4 h-4" />}
                  active={currentView === "staff_portal" && staffTab === "notifications"}
                  onClick={() => handleStaffNav("notifications")}
                  isCollapsed={isCollapsed}
                />
                <NavItem
                  label="My Profile"
                  icon={<UserCircle className="w-4 h-4" />}
                  active={currentView === "staff_portal" && staffTab === "profile"}
                  onClick={() => handleStaffNav("profile")}
                  isCollapsed={isCollapsed}
                />
              </>
            ) : (
              <>
                {canViewOverview && (
                  <NavItem
                    label="Overview"
                    icon={<LayoutDashboard className="w-4 h-4" />}
                    active={currentView === "overview"}
                    onClick={() => handleNav("overview")}
                    isCollapsed={isCollapsed}
                  />
                )}

                {canViewQuotations && (
                  <NavItem
                    label="Quotation System"
                    icon={<FileText className="w-4 h-4" />}
                    active={currentView === "quotation"}
                    onClick={() => handleNav("quotation")}
                    isCollapsed={isCollapsed}
                  />
                )}

                {canUseMail && (
                  <NavItem
                    label="Mail Center"
                    icon={<Mail className="w-4 h-4 text-emerald-500" />}
                    active={currentView === "mail"}
                    onClick={() => handleNav("mail")}
                    isCollapsed={isCollapsed}
                  />
                )}

                {canViewFinance && (
                  <NavItem
                    label="Finance & Operations"
                    icon={<Wallet className="w-4 h-4 text-amber-400" />}
                    active={currentView === "finance"}
                    onClick={() => handleNav("finance")}
                    isCollapsed={isCollapsed}
                  />
                )}

                {canViewOwnExpenses && (
                  <NavItem
                    label="My Expenses"
                    icon={<Receipt className="w-4 h-4 text-cyan-400" />}
                    active={currentView === "staff_portal"}
                    onClick={() => handleStaffNav("dashboard")}
                    isCollapsed={isCollapsed}
                  />
                )}

                {canOpenSettings && (
                  <NavItem
                    label="Admin Settings"
                    icon={<Settings className="w-4 h-4 text-sky-400" />}
                    active={currentView === "settings"}
                    onClick={() => handleNav("settings")}
                    isCollapsed={isCollapsed}
                  />
                )}
              </>
            )}
          </nav>
        </div>

        {/* Bottom Profile & System Section */}
        <div className={`p-2.5 border-t ${isDark ? "border-zinc-800" : "border-zinc-200"} space-y-2.5`}>
          <NavItem
            label="Helpdesk & Docs"
            icon={<HelpCircle className="w-4 h-4 text-emerald-500" />}
            onClick={() => handleNav("overview")}
            isCollapsed={isCollapsed}
          />

          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1.5 pt-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onLogout()}
                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                    aria-label="Sign Out"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Logout ({currentUser?.name || "User"})</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className={`p-3 rounded-xl border ${isDark ? "bg-zinc-900/80 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
                      isDark ? "bg-zinc-800 border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
                    }`}
                  >
                    {currentUser?.name?.slice(0, 2) || "NK"}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {currentUser?.name || "Super Admin"}
                    </p>
                    <p className={`text-[10px] truncate ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>
                      {currentUser?.email || "sales@avenautomation.in"}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 text-[9px] px-1.5 py-0.5 rounded">
                  {currentUser?.role || "Admin"}
                </Badge>
              </div>

              <Separator className="my-2" />

              <div className="flex flex-wrap items-center gap-1.5">
                {canManageUsers && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenUserManagement();
                      if (onClose) onClose();
                    }}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
                      isDark
                        ? "text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border-zinc-700/50"
                        : "text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border-zinc-300"
                    }`}
                    title="Manage Users & Roles"
                  >
                    <Users className="w-3 h-3" />
                    <span>Users</span>
                  </button>
                )}
                {onOpenChangePassword && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChangePassword();
                      if (onClose) onClose();
                    }}
                    className={`flex items-center justify-center gap-1 py-1.5 px-2 text-[10px] font-medium rounded-md border transition-colors cursor-pointer ${
                      isDark
                        ? "text-zinc-300 hover:text-white bg-zinc-800/60 hover:bg-zinc-800 border-zinc-700/50"
                        : "text-zinc-700 hover:text-black bg-white hover:bg-zinc-100 border-zinc-300"
                    }`}
                    title="Change Password"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>PW</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onLogout()}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-[10px] font-semibold text-rose-500 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 rounded-md border border-rose-500/30 transition-colors cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      {/* Desktop Persistent Collapsible Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen fixed left-0 top-0 z-40 select-none border-r transition-[width] duration-250 ease-out overflow-hidden no-print ${
          collapsed ? "w-[68px]" : "w-64"
        } ${isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"}`}
      >
        {renderSidebarBody(collapsed, false)}
      </aside>

      {/* Mobile Accessible Shadcn Sheet Drawer */}
      <Sheet open={isOpen} onOpenChange={(open) => { if (!open && onClose) onClose(); }}>
        <SheetContent
          side="left"
          className={`p-0 md:hidden ${
            isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
          }`}
        >
          {renderSidebarBody(false, true)}
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}
