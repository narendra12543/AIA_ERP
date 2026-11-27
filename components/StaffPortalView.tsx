"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
  Wallet,
  Bell,
  User as UserIcon,
  Upload,
  ChevronDown,
  ChevronUp,
  Send,
  Save,
  Trash2,
  RefreshCw,
  FileText,
  BadgeIndianRupee,
  Calendar,
} from "lucide-react";
import { User } from "../lib/types";
import { inr } from "../lib/vba-engine";
import { useFinancialYear } from "../contexts/FinancialYearContext";
import { formatFYLabel, getCurrentBusinessDate } from "../lib/financial-year";

export type StaffPortalTab =
  | "dashboard"
  | "add_expense"
  | "my_expenses"
  | "reimbursements"
  | "notifications"
  | "profile";

interface StaffPortalViewProps {
  currentUser: User | null;
  theme?: "dark" | "light";
  activeTab: StaffPortalTab;
  onTabChange: (tab: StaffPortalTab) => void;
}

interface ExpenseCategory {
  id: number;
  name: string;
  code: string;
}

interface ExpenseClaim {
  id: number;
  claim_no: string;
  expense_date: string;
  financial_year: string;
  category_id: number | null;
  category_name: string;
  title: string;
  description?: string;
  vendor_or_payee?: string;
  bill_no?: string;
  payment_mode: string;
  amount: number;
  receipt_url?: string;
  status: string;
  reimbursement_status: string;
  rejection_reason?: string;
  reimbursement_ref?: string;
  reimbursed_at?: string;
  created_at: string;
}

interface ReimbursementRow {
  id: number;
  reimbursement_no?: string;
  claim_id: number;
  claim_no?: string;
  amount: number;
  payment_mode: string;
  reference_no?: string;
  paid_date: string;
  notes?: string;
}

interface NotificationRow {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

interface EmployeeProfile {
  employee_id: string;
  full_name: string;
  email: string;
  role: string;
  designation?: string;
  department?: string;
  phone?: string;
  joining_date?: string;
  status: string;
}

export default function StaffPortalView({
  currentUser,
  theme = "dark",
  activeTab,
  onTabChange,
}: StaffPortalViewProps) {
  const isDark = theme === "dark";
  const { selectedFY, setSelectedFY, currentFY } = useFinancialYear();

  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [reimbursements, setReimbursements] = useState<ReimbursementRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [profile, setProfile] = useState<EmployeeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Quick Expense Form State (<60s workflow)
  const [editingClaimId, setEditingClaimId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState(getCurrentBusinessDate());
  const [paymentMode, setPaymentMode] = useState("Personal UPI");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const [vendorOrPayee, setVendorOrPayee] = useState("");
  const [billNo, setBillNo] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [claimStatusFilter, setClaimStatusFilter] = useState("ALL");
  const [claimSearch, setClaimSearch] = useState("");
  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  const cardBg = isDark
    ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]"
    : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCardBg = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const inputCls = isDark
    ? "bg-[#101113] border-[#2A2C30] text-[#F4F4F5] placeholder-[#71717A] focus:border-amber-500"
    : "bg-white border-[#E2E4E8] text-[#18181B] placeholder-[#A1A1AA] focus:border-amber-500";
  const textMuted = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";
  const textHeader = isDark ? "text-[#F4F4F5]" : "text-[#18181B]";

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [expRes, catRes, reimbRes, notifRes, empRes] = await Promise.all([
        fetch(`/api/expenses?fy=${encodeURIComponent(selectedFY)}&scope=mine`, { cache: "no-store" }),
        fetch(`/api/expenses/categories`, { cache: "no-store" }),
        fetch(`/api/expenses/reimbursements?fy=${encodeURIComponent(selectedFY)}`, { cache: "no-store" }),
        fetch(`/api/notifications`, { cache: "no-store" }),
        fetch(`/api/employees`, { cache: "no-store" }),
      ]);

      if (expRes.ok) {
        const d = await expRes.json();
        setClaims(d.items || d.claims || []);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        const cats = d.items || d.categories || [];
        setCategories(cats);
        if (!categoryId && cats.length > 0) {
          setCategoryId(String(cats[0].id));
        }
      }
      if (reimbRes.ok) {
        const d = await reimbRes.json();
        setReimbursements(d.items || d.reimbursements || []);
      }
      if (notifRes.ok) {
        const d = await notifRes.json();
        setNotifications(d.items || d.notifications || []);
      }
      if (empRes.ok) {
        const d = await empRes.json();
        const mine = (d.items || d.employees || []).find(
          (e: EmployeeProfile & { user_id?: string | number }) =>
            String(e.user_id) === String(currentUser?.id) || e.email === currentUser?.email
        );
        if (mine) setProfile(mine);
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoading(false);
    }
  }, [selectedFY, currentUser?.id, currentUser?.email, categoryId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const kpis = useMemo(() => {
    let total = 0;
    let approved = 0;
    let pending = 0;
    let reimbursed = 0;
    let pendingReimburse = 0;
    claims.forEach((c) => {
      const amt = Number(c.amount || 0);
      total += amt;
      if (c.status === "Submitted") pending += amt;
      if (c.status === "Approved" || c.status === "Reimbursed") approved += amt;
      if (c.status === "Reimbursed" || c.reimbursement_status === "Paid") {
        reimbursed += amt;
      } else if (c.status === "Approved") {
        pendingReimburse += amt;
      }
    });
    return { total, approved, pending, reimbursed, pendingReimburse };
  }, [claims]);

  const resetForm = () => {
    setEditingClaimId(null);
    setAmount("");
    setTitle("");
    setExpenseDate(getCurrentBusinessDate());
    setPaymentMode("Personal UPI");
    setReceiptUrl("");
    setVendorOrPayee("");
    setBillNo("");
    setDescription("");
    setShowOptional(false);
  };

  const handleReceiptUpload = async (file: File) => {
    if (!file) return;
    setUploadingReceipt(true);
    setStatusMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const d = await res.json();
        if (d.url) {
          setReceiptUrl(d.url);
          setStatusMessage({ type: "ok", text: "Receipt uploaded successfully." });
          return;
        }
      }
      // Fallback: compact data URL for images under 1.5 MB
      if (file.size <= 1_500_000) {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            setReceiptUrl(reader.result);
            setStatusMessage({ type: "ok", text: "Receipt attached locally." });
          }
        };
        reader.readAsDataURL(file);
      } else {
        setStatusMessage({ type: "err", text: "Receipt too large (max 1.5 MB when offline)." });
      }
    } catch {
      setStatusMessage({ type: "err", text: "Failed to upload receipt." });
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveClaim = async (submitAction: "draft" | "submit") => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setStatusMessage({ type: "err", text: "Enter a valid expense amount greater than 0." });
      return;
    }
    if (!title.trim()) {
      setStatusMessage({ type: "err", text: "Enter a short title / purpose for this expense." });
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);
    try {
      const catObj = categories.find((c) => String(c.id) === categoryId);
      const payload = {
        id: editingClaimId,
        amount: numAmount,
        categoryId: categoryId ? Number(categoryId) : null,
        categoryName: catObj?.name || "Other",
        title: title.trim(),
        expenseDate,
        paymentMode,
        receiptUrl: receiptUrl || null,
        vendorOrPayee: vendorOrPayee.trim() || null,
        billNo: billNo.trim() || null,
        description: description.trim() || null,
        action: editingClaimId ? (submitAction === "submit" ? "resubmit" : "update") : submitAction,
      };

      const res = await fetch("/api/expenses", {
        method: editingClaimId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "err", text: json.error || "Could not save expense." });
        return;
      }

      setStatusMessage({
        type: "ok",
        text: submitAction === "submit" ? "Expense submitted for approval!" : "Saved as draft.",
      });
      resetForm();
      await loadAll();
      onTabChange("my_expenses");
    } catch {
      setStatusMessage({ type: "err", text: "Network error while saving expense." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClaimAction = async (claimId: number, action: "submit" | "cancel") => {
    try {
      const res = await fetch("/api/expenses", {
        method: action === "cancel" ? "DELETE" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId, action }),
      });
      if (res.ok) {
        setStatusMessage({
          type: "ok",
          text: action === "cancel" ? "Draft deleted." : "Expense submitted for approval.",
        });
        await loadAll();
      }
    } catch {
      // ignore
    }
  };

  const handleMarkNotifRead = async (id?: number) => {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { markAll: true }),
      });
      await loadAll();
    } catch {
      // ignore
    }
  };

  const filteredClaims = useMemo(() => {
    const q = claimSearch.trim().toLowerCase();
    return claims.filter((c) => {
      if (claimStatusFilter !== "ALL" && c.status !== claimStatusFilter) return false;
      if (q) {
        const hay = `${c.claim_no} ${c.title} ${c.category_name} ${c.vendor_or_payee || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [claims, claimStatusFilter, claimSearch]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const tabs: Array<{ id: StaffPortalTab; label: string; badge?: number }> = [
    { id: "dashboard", label: "Dashboard" },
    { id: "add_expense", label: "Add Expense" },
    { id: "my_expenses", label: "My Expenses", badge: claims.length },
    { id: "reimbursements", label: "Reimbursements" },
    { id: "notifications", label: "Notifications", badge: unreadCount },
    { id: "profile", label: "My Profile" },
  ];

  const statusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
      case "Reimbursed":
        return "bg-blue-500/15 text-blue-400 border-blue-500/30";
      case "Rejected":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30";
      case "Submitted":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30";
      default:
        return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30";
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${textHeader}`}>
              Staff Expense Portal
            </h1>
            {profile?.employee_id && (
              <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {profile.employee_id}
              </span>
            )}
          </div>
          <p className={`text-xs mt-1 ${textMuted}`}>
            {currentUser?.name} &bull; {formatFYLabel(selectedFY)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 text-xs ${subCardBg}`}>
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="bg-transparent text-xs focus:outline-none cursor-pointer"
            >
              <option value={currentFY} className="bg-zinc-900 text-white">
                {formatFYLabel(currentFY)} (Current)
              </option>
              <option value="2025-26" className="bg-zinc-900 text-white">FY 2025-26</option>
              <option value="ALL" className="bg-zinc-900 text-white">All Financial Years</option>
            </select>
          </div>

          <button
            onClick={() => {
              resetForm();
              onTabChange("add_expense");
            }}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3.5 py-2 rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quick Expense</span>
          </button>
        </div>
      </div>

      {/* Mobile-friendly Sub-Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onTabChange(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id
                ? "bg-amber-500 text-black"
                : `${subCardBg} ${textMuted} hover:text-white`
            }`}
          >
            <span>{t.label}</span>
            {typeof t.badge === "number" && t.badge > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === t.id ? "bg-black/20 text-black" : "bg-amber-500/20 text-amber-400"
                }`}
              >
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {statusMessage && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
            statusMessage.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-xs underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${textMuted}`}>My Total Expenses</span>
                <Receipt className="w-4 h-4 text-blue-400" />
              </div>
              <div className={`text-2xl font-black font-mono ${textHeader}`}>{inr.format(kpis.total)}</div>
              <p className={`text-[11px] mt-1 ${textMuted}`}>{claims.length} claims in {formatFYLabel(selectedFY)}</p>
            </div>

            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${textMuted}`}>Pending Approval</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black font-mono text-amber-400">{inr.format(kpis.pending)}</div>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Awaiting Accounts / Admin review</p>
            </div>

            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${textMuted}`}>Approved</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black font-mono text-emerald-400">{inr.format(kpis.approved)}</div>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Pending payout: {inr.format(kpis.pendingReimburse)}</p>
            </div>

            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${textMuted}`}>Reimbursed</span>
                <Wallet className="w-4 h-4 text-blue-400" />
              </div>
              <div className={`text-2xl font-black font-mono ${textHeader}`}>{inr.format(kpis.reimbursed)}</div>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Settled to your account</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={`p-5 rounded-xl border ${cardBg} space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold ${textHeader}`}>Recent Expense Claims</h2>
                <button
                  onClick={() => onTabChange("my_expenses")}
                  className="text-xs text-amber-400 hover:underline cursor-pointer"
                >
                  View all &rarr;
                </button>
              </div>
              {claims.length === 0 ? (
                <p className={`text-xs py-6 text-center ${textMuted}`}>
                  No expenses submitted yet. Tap &ldquo;Quick Expense&rdquo; to submit in under 60 seconds.
                </p>
              ) : (
                <div className="space-y-2">
                  {claims.slice(0, 5).map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg border ${subCardBg} flex items-center justify-between gap-2`}
                    >
                      <div className="min-w-0">
                        <p className={`text-xs font-bold truncate ${textHeader}`}>{c.title}</p>
                        <p className={`text-[11px] ${textMuted}`}>
                          {c.claim_no} &bull; {c.expense_date} &bull; {c.category_name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold font-mono ${textHeader}`}>{inr.format(c.amount)}</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge(c.status)}`}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className={`p-5 rounded-xl border ${cardBg} space-y-3`}>
              <div className="flex items-center justify-between">
                <h2 className={`text-sm font-bold flex items-center gap-1.5 ${textHeader}`}>
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span>Recent Notifications</span>
                </h2>
                {unreadCount > 0 && (
                  <button
                    onClick={() => handleMarkNotifRead()}
                    className="text-xs text-amber-400 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p className={`text-xs py-6 text-center ${textMuted}`}>No notifications yet.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.slice(0, 5).map((n) => (
                    <div
                      key={n.id}
                      onClick={() => !n.is_read && handleMarkNotifRead(n.id)}
                      className={`p-3 rounded-lg border ${subCardBg} ${
                        !n.is_read ? "border-amber-500/40" : ""
                      } cursor-pointer`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${textHeader}`}>{n.title}</p>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                      </div>
                      <p className={`text-[11px] mt-0.5 ${textMuted}`}>{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: QUICK EXPENSE FORM (<60s) */}
      {activeTab === "add_expense" && (
        <div className={`p-5 sm:p-6 rounded-xl border ${cardBg} max-w-2xl mx-auto space-y-4`}>
          <div className="flex items-center justify-between border-b pb-3 border-zinc-800">
            <div>
              <h2 className={`text-base font-bold ${textHeader}`}>
                {editingClaimId ? "Edit Expense Claim" : "Quick Expense Entry (< 60 Seconds)"}
              </h2>
              <p className={`text-xs ${textMuted}`}>Enter amount, category, purpose, and optional receipt.</p>
            </div>
            {editingClaimId && (
              <button onClick={resetForm} className="text-xs text-amber-400 hover:underline cursor-pointer">
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 450"
                className={`w-full px-3 py-2.5 rounded-lg border text-sm font-mono font-bold ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Category *</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm ${inputCls}`}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Purpose / Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Site Visit Petrol / Client Lunch / Hardware Material"
              className={`w-full px-3 py-2.5 rounded-lg border text-sm ${inputCls}`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Expense Date *</label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm ${inputCls}`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Payment Method *</label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm ${inputCls}`}
              >
                <option value="Personal UPI">Personal UPI (Reimbursable)</option>
                <option value="Personal Cash">Personal Cash (Reimbursable)</option>
                <option value="Personal Card">Personal Card (Reimbursable)</option>
                <option value="Company Card">Company Card</option>
                <option value="Company Bank">Company Bank</option>
              </select>
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Receipt / Bill Photo</label>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 text-amber-400 text-xs font-semibold cursor-pointer hover:bg-amber-500/10">
                <Upload className="w-4 h-4" />
                <span>{uploadingReceipt ? "Uploading..." : receiptUrl ? "Replace Receipt" : "Upload / Capture Receipt"}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleReceiptUpload(f);
                  }}
                />
              </label>
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(receiptUrl)}
                  className="text-xs text-emerald-400 underline cursor-pointer"
                >
                  View Attached Receipt
                </button>
              )}
            </div>
          </div>

          {/* Collapsible Optional Details */}
          <button
            type="button"
            onClick={() => setShowOptional(!showOptional)}
            className={`flex items-center gap-1.5 text-xs font-semibold ${textMuted} hover:text-amber-400 cursor-pointer`}
          >
            {showOptional ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Optional Details (Vendor, Bill No, Notes)</span>
          </button>

          {showOptional && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Vendor / Payee</label>
                <input
                  type="text"
                  value={vendorOrPayee}
                  onChange={(e) => setVendorOrPayee(e.target.value)}
                  placeholder="e.g. HP Petrol Pump"
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Bill / Invoice No</label>
                <input
                  type="text"
                  value={billNo}
                  onChange={(e) => setBillNo(e.target.value)}
                  placeholder="Optional bill number"
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Notes</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Additional context for Accounts..."
                  className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-800">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveClaim("draft")}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-bold cursor-pointer ${subCardBg} ${textHeader}`}
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSaveClaim("submit")}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? "Submitting..." : "Submit for Approval"}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: MY EXPENSES */}
      {activeTab === "my_expenses" && (
        <div className={`p-5 rounded-xl border ${cardBg} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className={`text-sm font-bold ${textHeader}`}>My Expense Claims ({filteredClaims.length})</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={claimSearch}
                onChange={(e) => setClaimSearch(e.target.value)}
                placeholder="Search claims..."
                className={`px-3 py-1.5 rounded-lg border text-xs ${inputCls}`}
              />
              <select
                value={claimStatusFilter}
                onChange={(e) => setClaimStatusFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="ALL">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Submitted">Submitted</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Reimbursed">Reimbursed</option>
              </select>
              <button
                onClick={loadAll}
                className={`p-1.5 rounded-lg border ${subCardBg} cursor-pointer`}
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {filteredClaims.length === 0 ? (
            <p className={`text-xs py-8 text-center ${textMuted}`}>No matching expense claims found.</p>
          ) : (
            <div className="space-y-2.5">
              {filteredClaims.map((c) => (
                <div key={c.id} className={`p-3.5 rounded-xl border ${subCardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono font-bold text-amber-400">{c.claim_no}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusBadge(c.status)}`}>
                        {c.status}
                      </span>
                      <span className={`text-[11px] ${textMuted}`}>{c.expense_date}</span>
                    </div>
                    <p className={`text-sm font-bold ${textHeader}`}>{c.title}</p>
                    <p className={`text-xs ${textMuted}`}>
                      {c.category_name} &bull; {c.payment_mode}
                      {c.vendor_or_payee ? ` • ${c.vendor_or_payee}` : ""}
                    </p>
                    {c.status === "Rejected" && c.rejection_reason && (
                      <p className="text-xs text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Rejected: {c.rejection_reason}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 sm:flex-col sm:items-end justify-between shrink-0">
                    <span className={`text-base font-black font-mono ${textHeader}`}>{inr.format(c.amount)}</span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {c.receipt_url && (
                        <button
                          onClick={() => setPreviewReceipt(c.receipt_url!)}
                          className="text-[11px] px-2 py-1 rounded border border-zinc-700 hover:border-amber-500 text-zinc-300 cursor-pointer flex items-center gap-1"
                        >
                          <FileText className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      )}
                      {(c.status === "Draft" || c.status === "Rejected") && (
                        <button
                          onClick={() => {
                            setEditingClaimId(c.id);
                            setAmount(String(c.amount));
                            setCategoryId(c.category_id ? String(c.category_id) : "");
                            setTitle(c.title);
                            setExpenseDate(c.expense_date);
                            setPaymentMode(c.payment_mode);
                            setReceiptUrl(c.receipt_url || "");
                            setVendorOrPayee(c.vendor_or_payee || "");
                            setBillNo(c.bill_no || "");
                            setDescription(c.description || "");
                            onTabChange("add_expense");
                          }}
                          className="text-[11px] px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold cursor-pointer"
                        >
                          {c.status === "Rejected" ? "Edit & Resubmit" : "Edit"}
                        </button>
                      )}
                      {c.status === "Draft" && (
                        <>
                          <button
                            onClick={() => handleClaimAction(c.id, "submit")}
                            className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold cursor-pointer"
                          >
                            Submit
                          </button>
                          <button
                            onClick={() => handleClaimAction(c.id, "cancel")}
                            className="text-[11px] p-1 rounded bg-rose-500/15 text-rose-400 border border-rose-500/30 cursor-pointer"
                            title="Delete Draft"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REIMBURSEMENTS */}
      {activeTab === "reimbursements" && (
        <div className={`p-5 rounded-xl border ${cardBg} space-y-4`}>
          <h2 className={`text-sm font-bold flex items-center gap-2 ${textHeader}`}>
            <BadgeIndianRupee className="w-4 h-4 text-emerald-400" />
            <span>Reimbursement History</span>
          </h2>
          {reimbursements.length === 0 ? (
            <p className={`text-xs py-8 text-center ${textMuted}`}>No reimbursement payouts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className={`border-b border-zinc-800 ${textMuted}`}>
                  <tr>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Claim No</th>
                    <th className="py-2 pr-3">Mode</th>
                    <th className="py-2 pr-3">UTR / Reference</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {reimbursements.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-3">{r.paid_date}</td>
                      <td className="py-2.5 pr-3 font-mono text-amber-400">{r.claim_no || `#${r.claim_id}`}</td>
                      <td className="py-2.5 pr-3">{r.payment_mode}</td>
                      <td className="py-2.5 pr-3 font-mono">{r.reference_no || "-"}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{inr.format(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: NOTIFICATIONS */}
      {activeTab === "notifications" && (
        <div className={`p-5 rounded-xl border ${cardBg} space-y-4`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-sm font-bold ${textHeader}`}>Notifications ({notifications.length})</h2>
            {unreadCount > 0 && (
              <button
                onClick={() => handleMarkNotifRead()}
                className="text-xs px-3 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className={`text-xs py-8 text-center ${textMuted}`}>You have no notifications.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && handleMarkNotifRead(n.id)}
                  className={`p-3.5 rounded-lg border ${subCardBg} ${!n.is_read ? "border-amber-500/40" : ""} cursor-pointer`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${textHeader}`}>{n.title}</span>
                    <span className={`text-[10px] ${textMuted}`}>{new Date(n.created_at).toLocaleString()}</span>
                  </div>
                  <p className={`text-xs mt-1 ${textMuted}`}>{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MY PROFILE */}
      {activeTab === "profile" && (
        <div className={`p-5 sm:p-6 rounded-xl border ${cardBg} max-w-xl space-y-4`}>
          <div className="flex items-center gap-3 border-b pb-4 border-zinc-800">
            <div className="w-12 h-12 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <UserIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className={`text-base font-bold ${textHeader}`}>{profile?.full_name || currentUser?.name}</h2>
              <p className={`text-xs ${textMuted}`}>{profile?.email || currentUser?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Permanent Employee ID</p>
              <p className="font-mono font-bold text-amber-400 mt-0.5">{profile?.employee_id || "Pending Assignment"}</p>
            </div>
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Role</p>
              <p className={`font-bold mt-0.5 ${textHeader}`}>{profile?.role || currentUser?.role}</p>
            </div>
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Designation</p>
              <p className={`font-bold mt-0.5 ${textHeader}`}>{profile?.designation || "-"}</p>
            </div>
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Department</p>
              <p className={`font-bold mt-0.5 ${textHeader}`}>{profile?.department || "-"}</p>
            </div>
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Joining Date</p>
              <p className={`font-bold mt-0.5 ${textHeader}`}>{profile?.joining_date || "-"}</p>
            </div>
            <div className={`p-3 rounded-lg border ${subCardBg}`}>
              <p className={textMuted}>Phone</p>
              <p className={`font-bold mt-0.5 ${textHeader}`}>{profile?.phone || "-"}</p>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceipt && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewReceipt(null)}
        >
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Receipt Preview</span>
              <button onClick={() => setPreviewReceipt(null)} className="text-xs text-amber-400 cursor-pointer">
                Close
              </button>
            </div>
            {previewReceipt.startsWith("data:application/pdf") || previewReceipt.toLowerCase().endsWith(".pdf") ? (
              <iframe src={previewReceipt} className="w-full h-[65vh] rounded border border-zinc-800 bg-white" />
            ) : (
              <img src={previewReceipt} alt="Receipt" className="max-h-[65vh] mx-auto rounded object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
