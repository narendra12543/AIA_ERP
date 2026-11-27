"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  TrendingUp,
  Briefcase,
  IndianRupee,
  Receipt,
  BadgeIndianRupee,
  Landmark,
  Users,
  FileSpreadsheet,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  ArrowRightLeft,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Quotation, User } from "../lib/types";
import { inr } from "../lib/vba-engine";
import { useFinancialYear } from "../contexts/FinancialYearContext";
import { formatFYLabel, getCurrentBusinessDate, listAvailableFYs } from "../lib/financial-year";

export type FinanceTab =
  | "dashboard"
  | "orders"
  | "payments"
  | "expenses"
  | "reimbursements"
  | "accounts"
  | "employees"
  | "reports";

interface FinanceOperationsViewProps {
  currentUser: User | null;
  quotations: Quotation[];
  theme?: "dark" | "light";
}

export default function FinanceOperationsView({
  currentUser,
  quotations,
  theme = "dark",
}: FinanceOperationsViewProps) {
  const isDark = theme === "dark";
  const { selectedFY, setSelectedFY, currentFY, resetToCurrentFY } = useFinancialYear();

  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Dashboard data
  const [dash, setDash] = useState<any>(null);
  // Orders & Payments
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  // Expenses & Reimbursements
  const [claims, setClaims] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  // Accounts & Transactions
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  // Employees
  const [employees, setEmployees] = useState<any[]>([]);
  // Reports
  const [reportType, setReportType] = useState("order_register");
  const [reportData, setReportData] = useState<{ headers: string[]; keys: string[]; rows: any[] } | null>(null);

  // Modals / Inline Forms
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [convertDirectCost, setConvertDirectCost] = useState("0");
  const [convertOrderDate, setConvertOrderDate] = useState(getCurrentBusinessDate());

  const [payOrderId, setPayOrderId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(getCurrentBusinessDate());
  const [payMode, setPayMode] = useState("Bank Transfer / NEFT");
  const [payAccountId, setPayAccountId] = useState("");
  const [payRef, setPayRef] = useState("");

  const [expenseFilter, setExpenseFilter] = useState("ALL");
  const [rejectModalClaim, setRejectModalClaim] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reimburseModalClaim, setReimburseModalClaim] = useState<any | null>(null);
  const [reimbAccountId, setReimbAccountId] = useState("");
  const [reimbMode, setReimbMode] = useState("UPI / Bank Transfer");
  const [reimbRef, setReimbRef] = useState("");
  const [reimbDate, setReimbDate] = useState(getCurrentBusinessDate());

  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("Bank");
  const [newAccOpening, setNewAccOpening] = useState("0");

  const [txType, setTxType] = useState("Other Income");
  const [txAccountId, setTxAccountId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(getCurrentBusinessDate());
  const [txDesc, setTxDesc] = useState("");

  const [directExpTitle, setDirectExpTitle] = useState("");
  const [directExpAmount, setDirectExpAmount] = useState("");
  const [directExpCatId, setDirectExpCatId] = useState("");
  const [directExpDate, setDirectExpDate] = useState(getCurrentBusinessDate());

  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  const cardBg = isDark
    ? "bg-[#09090b] border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900 shadow-xs";
  const subCardBg = isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-50 border-zinc-200";
  const inputCls = isDark
    ? "bg-zinc-900 border-zinc-800 text-white placeholder-zinc-500 focus:border-amber-500"
    : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400 focus:border-amber-500";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const textHeader = isDark ? "text-white" : "text-zinc-950";

  const canApprove =
    currentUser?.role === "Admin" ||
    currentUser?.permissions?.includes("expenses.approve") ||
    currentUser?.role === "Accounts";
  const canReimburse =
    currentUser?.role === "Admin" ||
    currentUser?.permissions?.includes("expenses.reimburse") ||
    currentUser?.role === "Accounts";
  const canExport =
    currentUser?.role === "Admin" ||
    currentUser?.permissions?.includes("finance.export") ||
    currentUser?.role === "Accounts";

  const availableFYs = useMemo(() => {
    const dates = quotations.map((q) => q.date || "").filter(Boolean);
    return listAvailableFYs(dates, currentFY);
  }, [quotations, currentFY]);

  const loadFinanceData = useCallback(async () => {
    setLoading(true);
    try {
      const fyQ = encodeURIComponent(selectedFY);
      const [dRes, oRes, pRes, eRes, cRes, rRes, aRes, empRes] = await Promise.all([
        fetch(`/api/finance/dashboard?fy=${fyQ}`, { cache: "no-store" }),
        fetch(`/api/finance/orders?fy=${fyQ}`, { cache: "no-store" }),
        fetch(`/api/finance/payments?fy=${fyQ}`, { cache: "no-store" }),
        fetch(`/api/expenses?fy=${fyQ}&scope=all`, { cache: "no-store" }),
        fetch(`/api/expenses/categories`, { cache: "no-store" }),
        fetch(`/api/expenses/reimbursements?fy=${fyQ}`, { cache: "no-store" }),
        fetch(`/api/finance/accounts?fy=${fyQ}`, { cache: "no-store" }),
        fetch(`/api/employees`, { cache: "no-store" }),
      ]);

      if (dRes.ok) setDash(await dRes.json());
      if (oRes.ok) {
        const od = await oRes.json();
        setOrders(od.orders || []);
      }
      if (pRes.ok) {
        const pd = await pRes.json();
        setPayments(pd.payments || []);
      }
      if (eRes.ok) {
        const ed = await eRes.json();
        setClaims(ed.claims || []);
      }
      if (cRes.ok) {
        const cd = await cRes.json();
        const cats = cd.categories || [];
        setCategories(cats);
        if (!directExpCatId && cats.length > 0) setDirectExpCatId(String(cats[0].id));
      }
      if (rRes.ok) {
        const rd = await rRes.json();
        setReimbursements(rd.reimbursements || []);
      }
      if (aRes.ok) {
        const ad = await aRes.json();
        const accs = ad.accounts || [];
        setAccounts(accs);
        setTransactions(ad.transactions || []);
        if (accs.length > 0) {
          if (!payAccountId) setPayAccountId(String(accs[0].id));
          if (!reimbAccountId) setReimbAccountId(String(accs[0].id));
          if (!txAccountId) setTxAccountId(String(accs[0].id));
        }
      }
      if (empRes.ok) {
        const empd = await empRes.json();
        setEmployees(empd.employees || []);
      }
    } catch {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, [selectedFY, directExpCatId, payAccountId, reimbAccountId, txAccountId]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/finance/reports?type=${encodeURIComponent(reportType)}&fy=${encodeURIComponent(selectedFY)}`,
        { cache: "no-store" }
      );
      if (res.ok) {
        setReportData(await res.json());
      }
    } catch {
      // ignore
    }
  }, [reportType, selectedFY]);

  useEffect(() => {
    if (activeTab === "reports") loadReport();
  }, [activeTab, loadReport]);

  const handleConvertQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuoteId) return;
    setNotice(null);
    try {
      const res = await fetch("/api/finance/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quotationId: Number(selectedQuoteId),
          directCost: Number(convertDirectCost || 0),
          orderDate: convertOrderDate,
          status: "Confirmed",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Conversion failed" });
        return;
      }
      setNotice({ type: "ok", text: `Converted quotation to Finance Order ${json.order?.order_no || ""}` });
      setSelectedQuoteId("");
      setConvertDirectCost("0");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Network error converting quotation" });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payOrderId || !payAmount) return;
    setNotice(null);
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: Number(payOrderId),
          amount: Number(payAmount),
          paymentDate: payDate,
          paymentMode: payMode,
          accountId: payAccountId ? Number(payAccountId) : null,
          referenceNo: payRef.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to record payment" });
        return;
      }
      setNotice({ type: "ok", text: "Customer payment recorded and ledger updated." });
      setPayAmount("");
      setPayRef("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Network error recording payment" });
    }
  };

  const handleApproveClaim = async (claimId: number) => {
    setNotice(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId, action: "approve" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Approval failed" });
        return;
      }
      setNotice({ type: "ok", text: "Expense approved." });
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to approve expense" });
    }
  };

  const handleRejectClaim = async () => {
    if (!rejectModalClaim || !rejectReason.trim()) return;
    setNotice(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rejectModalClaim.id, action: "reject", reason: rejectReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Rejection failed" });
        return;
      }
      setNotice({ type: "ok", text: "Expense rejected and staff notified." });
      setRejectModalClaim(null);
      setRejectReason("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to reject expense" });
    }
  };

  const handleReimburseClaim = async () => {
    if (!reimburseModalClaim) return;
    setNotice(null);
    try {
      const res = await fetch("/api/expenses/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: reimburseModalClaim.id,
          accountId: reimbAccountId ? Number(reimbAccountId) : null,
          paymentMode: reimbMode,
          referenceNo: reimbRef.trim() || null,
          paidDate: reimbDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Reimbursement failed" });
        return;
      }
      setNotice({ type: "ok", text: "Reimbursement recorded and staff notified." });
      setReimburseModalClaim(null);
      setReimbRef("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to process reimbursement" });
    }
  };

  const handleDirectExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directExpTitle.trim() || !directExpAmount) return;
    setNotice(null);
    try {
      const cat = categories.find((c) => String(c.id) === directExpCatId);
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: directExpTitle.trim(),
          amount: Number(directExpAmount),
          categoryId: directExpCatId ? Number(directExpCatId) : null,
          categoryName: cat?.name || "Other",
          expenseDate: directExpDate,
          paymentMode: "Company Bank",
          isCompanyDirect: true,
          action: "submit",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to add company expense" });
        return;
      }
      setNotice({ type: "ok", text: "Direct company expense logged." });
      setDirectExpTitle("");
      setDirectExpAmount("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to log company expense" });
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_account",
          accountName: newAccName.trim(),
          accountType: newAccType,
          openingBalance: Number(newAccOpening || 0),
        }),
      });
      if (res.ok) {
        setNotice({ type: "ok", text: "Account created." });
        setNewAccName("");
        setNewAccOpening("0");
        await loadFinanceData();
      }
    } catch {
      // ignore
    }
  };

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txAccountId) return;
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_transaction",
          txType,
          accountId: Number(txAccountId),
          amount: Number(txAmount),
          txDate,
          description: txDesc.trim() || txType,
        }),
      });
      if (res.ok) {
        setNotice({ type: "ok", text: "Transaction recorded." });
        setTxAmount("");
        setTxDesc("");
        await loadFinanceData();
      }
    } catch {
      // ignore
    }
  };

  const tabs: Array<{ id: FinanceTab; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { id: "orders", label: "Orders", icon: <Briefcase className="w-3.5 h-3.5" /> },
    { id: "payments", label: "Payments", icon: <IndianRupee className="w-3.5 h-3.5" /> },
    { id: "expenses", label: "Expenses", icon: <Receipt className="w-3.5 h-3.5" /> },
    { id: "reimbursements", label: "Reimbursements", icon: <BadgeIndianRupee className="w-3.5 h-3.5" /> },
    { id: "accounts", label: "Accounts", icon: <Landmark className="w-3.5 h-3.5" /> },
    { id: "employees", label: "Employees", icon: <Users className="w-3.5 h-3.5" /> },
    { id: "reports", label: "Reports", icon: <FileSpreadsheet className="w-3.5 h-3.5" /> },
  ];

  const k = dash?.kpis || {};
  const pendingReimburseClaims = claims.filter((c) => c.status === "Approved" && c.reimbursement_status !== "Paid");
  const filteredClaims = claims.filter((c) => (expenseFilter === "ALL" ? true : c.status === expenseFilter));

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header + Global FY Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${textHeader}`}>
              Finance &amp; Operations
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
              {formatFYLabel(selectedFY)}
            </span>
          </div>
          <p className={`text-xs mt-1 ${textMuted}`}>
            Orders, Receivables, Project Costing, Staff Expenses, Reimbursements &amp; Cash Flow
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
              {availableFYs.map((fy) => (
                <option key={fy} value={fy} className="bg-zinc-900 text-white">
                  {fy === currentFY ? `${formatFYLabel(fy)} (Current)` : formatFYLabel(fy)}
                </option>
              ))}
              <option value="ALL" className="bg-zinc-900 text-white">All Financial Years</option>
            </select>
          </div>
          {selectedFY !== currentFY && (
            <button
              onClick={resetToCurrentFY}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 font-semibold cursor-pointer"
            >
              Reset FY
            </button>
          )}
          <button
            onClick={loadFinanceData}
            className={`p-2 rounded-lg border ${subCardBg} cursor-pointer`}
            title="Refresh Finance Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id
                ? "bg-amber-500 text-black"
                : `${subCardBg} ${textMuted} hover:text-white`
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {notice && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium flex items-center justify-between ${
            notice.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {dash?.tableMissing && (
        <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Finance database tables are pending migration (007_finance_and_operations.sql).</span>
        </div>
      )}

      {/* 1. FINANCIAL DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <p className={`text-xs font-semibold ${textMuted}`}>Basic Turnover (Excl. GST)</p>
              <p className={`text-2xl font-black font-mono mt-1 ${textHeader}`}>{inr.format(k.basicTurnover || 0)}</p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>GST Incl: {inr.format(k.gstInclusiveValue || 0)}</p>
            </div>
            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <p className={`text-xs font-semibold ${textMuted}`}>Customer Received</p>
              <p className="text-2xl font-black font-mono mt-1 text-emerald-400">{inr.format(k.customerReceived || 0)}</p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>
                Outstanding: <span className="text-rose-400 font-bold">{inr.format(k.selectedFYOutstanding || 0)}</span>
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <p className={`text-xs font-semibold ${textMuted}`}>Gross Profit</p>
              <p className={`text-2xl font-black font-mono mt-1 ${textHeader}`}>{inr.format(k.grossProfit || 0)}</p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Direct Costs: {inr.format(k.directProjectCosts || 0)}</p>
            </div>
            <div className={`p-4 rounded-xl border ${cardBg}`}>
              <p className={`text-xs font-semibold ${textMuted}`}>Net Profit</p>
              <p className={`text-2xl font-black font-mono mt-1 ${(k.netProfit || 0) < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {inr.format(k.netProfit || 0)}
              </p>
              <p className={`text-[11px] mt-1 ${textMuted}`}>Expenses: {inr.format(k.operatingExpenses || 0)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Monthly Trend Chart */}
            <div className={`lg:col-span-2 p-5 rounded-xl border ${cardBg} space-y-4`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className={`text-sm font-bold ${textHeader}`}>Monthly Turnover vs Expenses</h2>
                  <p className={`text-[11px] ${textMuted}`}>Indian Financial Year (Apr &ndash; Mar)</p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-400">
                  Cash Balance: {inr.format(k.cashBalance || 0)}
                </span>
              </div>
              <div className="h-44 flex items-end justify-between gap-1.5 border-b border-zinc-800 pb-2">
                {(dash?.monthlyTrend || []).map((m: any) => {
                  const maxV = Math.max(
                    1,
                    ...(dash?.monthlyTrend || []).map((x: any) => Math.max(x.turnover || 0, x.expenses || 0))
                  );
                  const hTurn = Math.min(100, Math.round(((m.turnover || 0) / maxV) * 100));
                  const hExp = Math.min(100, Math.round(((m.expenses || 0) / maxV) * 100));
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                      <div className="w-full flex items-end justify-center gap-0.5 h-full">
                        <div
                          style={{ height: `${Math.max(4, hTurn)}%` }}
                          className="w-1/2 max-w-[14px] bg-emerald-500/80 rounded-t-xs"
                          title={`${m.month} Turnover: ${inr.format(m.turnover || 0)}`}
                        />
                        <div
                          style={{ height: `${Math.max(4, hExp)}%` }}
                          className="w-1/2 max-w-[14px] bg-amber-500/80 rounded-t-xs"
                          title={`${m.month} Expenses: ${inr.format(m.expenses || 0)}`}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-400">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Expense Category Breakdown */}
            <div className={`p-5 rounded-xl border ${cardBg} space-y-3`}>
              <h2 className={`text-sm font-bold ${textHeader}`}>Expense Breakdown</h2>
              {(dash?.categoryBreakdown || []).length === 0 ? (
                <p className={`text-xs py-6 text-center ${textMuted}`}>No expenses in selected FY.</p>
              ) : (
                <div className="space-y-2.5">
                  {(dash?.categoryBreakdown || []).slice(0, 6).map((cat: any) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={textHeader}>{cat.category}</span>
                        <span className="font-mono font-bold text-amber-400">{inr.format(cat.total)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPLETED ORDERS */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <form onSubmit={handleConvertQuotation} className={`p-4 rounded-xl border ${cardBg} grid grid-cols-1 sm:grid-cols-4 gap-3 items-end`}>
            <div className="sm:col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Convert Quotation to Order</label>
              <select
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="">Select quotation...</option>
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotation_no} — {q.client_name} ({inr.format(q.total || 0)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Direct Cost (₹)</label>
              <input
                type="number"
                step="0.01"
                value={convertDirectCost}
                onChange={(e) => setConvertDirectCost(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={convertOrderDate}
                onChange={(e) => setConvertOrderDate(e.target.value)}
                className={`w-full px-2 py-2 rounded-lg border text-xs ${inputCls}`}
              />
              <button type="submit" className="px-3.5 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold whitespace-nowrap cursor-pointer">
                Convert
              </button>
            </div>
          </form>

          <div className={`p-4 rounded-xl border ${cardBg} overflow-x-auto`}>
            <table className="w-full text-xs text-left">
              <thead className={`border-b border-zinc-800 ${textMuted}`}>
                <tr>
                  <th className="py-2 pr-3">Order No</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3 text-right">Basic (Excl GST)</th>
                  <th className="py-2 pr-3 text-right">Total (Incl GST)</th>
                  <th className="py-2 pr-3 text-right">Received</th>
                  <th className="py-2 pr-3 text-right">Outstanding</th>
                  <th className="py-2 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2.5 pr-3 font-mono font-bold text-amber-400">{o.order_no}</td>
                    <td className="py-2.5 pr-3">{o.order_date}</td>
                    <td className="py-2.5 pr-3 font-medium">{o.client_name}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{inr.format(o.basic_amount)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono">{inr.format(o.total_order_value)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-emerald-400">{inr.format(o.received_amount)}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-rose-400">{inr.format(o.outstanding_amount)}</td>
                    <td className="py-2.5 text-right font-mono font-bold">{inr.format(o.gross_profit)}</td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} className={`py-8 text-center ${textMuted}`}>No finance orders in {formatFYLabel(selectedFY)}.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CUSTOMER PAYMENTS */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <form onSubmit={handleRecordPayment} className={`p-4 rounded-xl border ${cardBg} grid grid-cols-1 sm:grid-cols-6 gap-3 items-end`}>
            <div className="sm:col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Order *</label>
              <select
                value={payOrderId}
                onChange={(e) => setPayOrderId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="">Select order...</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.order_no} — {o.client_name} (Bal: {inr.format(o.outstanding_amount)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Account</label>
              <select
                value={payAccountId}
                onChange={(e) => setPayAccountId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>UTR / Ref</label>
              <input
                type="text"
                value={payRef}
                onChange={(e) => setPayRef(e.target.value)}
                placeholder="NEFT/UPI Ref"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <button type="submit" className="px-3.5 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer">
              Record Payment
            </button>
          </form>

          <div className={`p-4 rounded-xl border ${cardBg} overflow-x-auto`}>
            <table className="w-full text-xs text-left">
              <thead className={`border-b border-zinc-800 ${textMuted}`}>
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Order No</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3">{p.payment_date}</td>
                    <td className="py-2.5 pr-3 font-mono text-amber-400">{p.order_no}</td>
                    <td className="py-2.5 pr-3">{p.client_name}</td>
                    <td className="py-2.5 pr-3">{p.payment_mode}</td>
                    <td className="py-2.5 pr-3 font-mono">{p.reference_no || "-"}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-emerald-400">{inr.format(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. EXPENSE MANAGEMENT & APPROVALS */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <form onSubmit={handleDirectExpense} className={`p-4 rounded-xl border ${cardBg} grid grid-cols-1 sm:grid-cols-5 gap-3 items-end`}>
            <div className="sm:col-span-2">
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Log Direct Company Expense</label>
              <input
                type="text"
                value={directExpTitle}
                onChange={(e) => setDirectExpTitle(e.target.value)}
                placeholder="e.g. Workshop Electricity Bill"
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Category</label>
              <select
                value={directExpCatId}
                onChange={(e) => setDirectExpCatId(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1 ${textMuted}`}>Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                value={directExpAmount}
                onChange={(e) => setDirectExpAmount(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              />
            </div>
            <button type="submit" className="px-3.5 py-2 rounded-lg bg-amber-500 text-black text-xs font-bold cursor-pointer flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          </form>

          <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className={`text-sm font-bold ${textHeader}`}>All Expense Claims ({filteredClaims.length})</h2>
              <select
                value={expenseFilter}
                onChange={(e) => setExpenseFilter(e.target.value)}
                className={`px-3 py-1.5 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="ALL">All Statuses</option>
                <option value="Submitted">Pending Approval (Submitted)</option>
                <option value="Approved">Approved (Awaiting Reimbursement)</option>
                <option value="Reimbursed">Reimbursed</option>
                <option value="Rejected">Rejected</option>
                <option value="Draft">Draft</option>
              </select>
            </div>

            <div className="space-y-2">
              {filteredClaims.map((c) => (
                <div key={c.id} className={`p-3 rounded-lg border ${subCardBg} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-amber-400">{c.claim_no}</span>
                      <span className="text-xs font-bold">{c.employee_name || "Company"}</span>
                      {c.employee_code && <span className="text-[10px] font-mono text-zinc-400">({c.employee_code})</span>}
                      <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700">{c.status}</span>
                    </div>
                    <p className={`text-xs font-semibold mt-1 ${textHeader}`}>{c.title}</p>
                    <p className={`text-[11px] ${textMuted}`}>{c.expense_date} &bull; {c.category_name} &bull; {c.payment_mode}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-black font-mono">{inr.format(c.amount)}</span>
                    {c.receipt_url && (
                      <button
                        onClick={() => setPreviewReceipt(c.receipt_url)}
                        className="text-[11px] px-2 py-1 rounded border border-zinc-700 cursor-pointer flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Receipt</span>
                      </button>
                    )}
                    {canApprove && c.status === "Submitted" && (
                      <>
                        <button
                          onClick={() => handleApproveClaim(c.id)}
                          className="text-[11px] px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold cursor-pointer flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => setRejectModalClaim(c)}
                          className="text-[11px] px-2.5 py-1 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold cursor-pointer flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                    {canReimburse && c.status === "Approved" && c.reimbursement_status !== "Paid" && (
                      <button
                        onClick={() => setReimburseModalClaim(c)}
                        className="text-[11px] px-2.5 py-1 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold cursor-pointer"
                      >
                        Reimburse
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. REIMBURSEMENTS */}
      {activeTab === "reimbursements" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
            <h2 className={`text-sm font-bold ${textHeader}`}>Approved Claims Awaiting Payout ({pendingReimburseClaims.length})</h2>
            {pendingReimburseClaims.length === 0 ? (
              <p className={`text-xs ${textMuted}`}>No approved claims pending reimbursement.</p>
            ) : (
              <div className="space-y-2">
                {pendingReimburseClaims.map((c) => (
                  <div key={c.id} className={`p-3 rounded-lg border ${subCardBg} flex items-center justify-between gap-3`}>
                    <div>
                      <p className={`text-xs font-bold ${textHeader}`}>
                        {c.claim_no} &bull; {c.employee_name} — {c.title}
                      </p>
                      <p className={`text-[11px] ${textMuted}`}>{c.expense_date} &bull; {c.category_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-amber-400">{inr.format(c.amount)}</span>
                      {canReimburse && (
                        <button
                          onClick={() => setReimburseModalClaim(c)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer"
                        >
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={`p-4 rounded-xl border ${cardBg} overflow-x-auto`}>
            <h2 className={`text-sm font-bold mb-3 ${textHeader}`}>Reimbursement Payout History</h2>
            <table className="w-full text-xs text-left">
              <thead className={`border-b border-zinc-800 ${textMuted}`}>
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Claim</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {reimbursements.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3">{r.paid_date}</td>
                    <td className="py-2 pr-3 font-mono text-amber-400">{r.claim_no || `#${r.claim_id}`}</td>
                    <td className="py-2 pr-3">{r.employee_name || "-"}</td>
                    <td className="py-2 pr-3">{r.payment_mode}</td>
                    <td className="py-2 pr-3 font-mono">{r.reference_no || "-"}</td>
                    <td className="py-2 text-right font-mono font-bold text-emerald-400">{inr.format(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. ACCOUNTS & CASH FLOW */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <div key={a.id} className={`p-4 rounded-xl border ${cardBg}`}>
                <p className={`text-xs ${textMuted}`}>{a.account_type}</p>
                <p className={`text-sm font-bold mt-0.5 ${textHeader}`}>{a.account_name}</p>
                <p className="text-xl font-black font-mono text-emerald-400 mt-2">{inr.format(a.current_balance)}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={handleCreateAccount} className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
              <h3 className={`text-xs font-bold ${textHeader}`}>Add Bank / Cash Account</h3>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="Account Name"
                  className={`px-2.5 py-2 rounded-lg border text-xs ${inputCls}`}
                />
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value)}
                  className={`px-2.5 py-2 rounded-lg border text-xs ${inputCls}`}
                >
                  <option value="Bank">Bank</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
                <input
                  type="number"
                  value={newAccOpening}
                  onChange={(e) => setNewAccOpening(e.target.value)}
                  placeholder="Opening ₹"
                  className={`px-2.5 py-2 rounded-lg border text-xs ${inputCls}`}
                />
              </div>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-amber-500 text-black text-xs font-bold cursor-pointer">
                Create Account
              </button>
            </form>

            <form onSubmit={handleRecordTx} className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
              <h3 className={`text-xs font-bold flex items-center gap-1.5 ${textHeader}`}>
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Record Income / Ledger Entry</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select value={txType} onChange={(e) => setTxType(e.target.value)} className={`px-2 py-2 rounded-lg border text-xs ${inputCls}`}>
                  <option value="Other Income">Other Income</option>
                  <option value="Operating Expense">Operating Expense</option>
                </select>
                <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} className={`px-2 py-2 rounded-lg border text-xs ${inputCls}`}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.account_name}</option>)}
                </select>
                <input type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Amount ₹" className={`px-2 py-2 rounded-lg border text-xs ${inputCls}`} />
                <input type="text" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="Description" className={`px-2 py-2 rounded-lg border text-xs ${inputCls}`} />
              </div>
              <button type="submit" className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer">
                Post Entry
              </button>
            </form>
          </div>

          <div className={`p-4 rounded-xl border ${cardBg} overflow-x-auto`}>
            <h3 className={`text-sm font-bold mb-3 ${textHeader}`}>Finance Ledger ({transactions.length})</h3>
            <table className="w-full text-xs text-left">
              <thead className={`border-b border-zinc-800 ${textMuted}`}>
                <tr>
                  <th className="py-2 pr-3">TX No</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {transactions.slice(0, 50).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-mono text-amber-400">{t.tx_no}</td>
                    <td className="py-2 pr-3">{t.tx_date}</td>
                    <td className="py-2 pr-3">{t.tx_type}</td>
                    <td className="py-2 pr-3">{t.description}</td>
                    <td className="py-2 pr-3">{t.account_name || "-"}</td>
                    <td className={`py-2 text-right font-mono font-bold ${t.tx_type === "Customer Payment" || t.tx_type === "Other Income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {inr.format(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. EMPLOYEES */}
      {activeTab === "employees" && (
        <div className={`p-4 rounded-xl border ${cardBg} overflow-x-auto`}>
          <h2 className={`text-sm font-bold mb-3 ${textHeader}`}>Employee Directory ({employees.length})</h2>
          <table className="w-full text-xs text-left">
            <thead className={`border-b border-zinc-800 ${textMuted}`}>
              <tr>
                <th className="py-2 pr-3">Employee ID</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Role</th>
                <th className="py-2 pr-3">Designation</th>
                <th className="py-2 pr-3">Department</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td className="py-2.5 pr-3 font-mono font-bold text-amber-400">{emp.employee_id}</td>
                  <td className="py-2.5 pr-3 font-semibold">{emp.full_name}</td>
                  <td className="py-2.5 pr-3">{emp.email}</td>
                  <td className="py-2.5 pr-3">{emp.role}</td>
                  <td className="py-2.5 pr-3">{emp.designation || "-"}</td>
                  <td className="py-2.5 pr-3">{emp.department || "-"}</td>
                  <td className="py-2.5">{emp.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 8. FINANCIAL REPORTS */}
      {activeTab === "reports" && (
        <div className={`p-4 rounded-xl border ${cardBg} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className={`px-3 py-2 rounded-lg border text-xs ${inputCls}`}
              >
                <option value="order_register">Order Register</option>
                <option value="client_history">Client Business History</option>
                <option value="receivables">Pending Receivables</option>
                <option value="profitability">Order Profitability</option>
                <option value="expenses">Expense Report</option>
                <option value="cash_flow">Cash Flow Ledger</option>
              </select>
              <button onClick={loadReport} className="px-3 py-2 rounded-lg border border-zinc-700 text-xs font-semibold cursor-pointer">
                Run Report
              </button>
            </div>
            {canExport && (
              <a
                href={`/api/finance/reports?type=${encodeURIComponent(reportType)}&fy=${encodeURIComponent(selectedFY)}&format=csv`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 text-black text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </a>
            )}
          </div>

          {reportData && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className={`border-b border-zinc-800 ${textMuted}`}>
                  <tr>
                    {reportData.headers.map((h) => (
                      <th key={h} className="py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {reportData.rows.map((r, i) => (
                    <tr key={i}>
                      {reportData.keys.map((key) => (
                        <td key={key} className="py-2 pr-3 whitespace-nowrap">
                          {String(r[key] ?? "-")}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {reportData.rows.length === 0 && (
                    <tr>
                      <td colSpan={reportData.headers.length} className={`py-8 text-center ${textMuted}`}>
                        No records for this report in {formatFYLabel(selectedFY)}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">Reject Expense {rejectModalClaim.claim_no}</h3>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter mandatory rejection reason..."
              className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModalClaim(null)} className="px-3 py-1.5 text-xs text-zinc-400 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleRejectClaim} className="px-3.5 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold cursor-pointer">
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reimburse Modal */}
      {reimburseModalClaim && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="text-sm font-bold text-white">
              Reimburse {reimburseModalClaim.claim_no} ({inr.format(reimburseModalClaim.amount)})
            </h3>
            <div className="space-y-2">
              <select value={reimbAccountId} onChange={(e) => setReimbAccountId(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({inr.format(a.current_balance)})</option>
                ))}
              </select>
              <input type="text" value={reimbMode} onChange={(e) => setReimbMode(e.target.value)} placeholder="Payment Mode" className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`} />
              <input type="text" value={reimbRef} onChange={(e) => setReimbRef(e.target.value)} placeholder="UTR / Transaction Reference" className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`} />
              <input type="date" value={reimbDate} onChange={(e) => setReimbDate(e.target.value)} className={`w-full px-3 py-2 rounded-lg border text-xs ${inputCls}`} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReimburseModalClaim(null)} className="px-3 py-1.5 text-xs text-zinc-400 cursor-pointer">
                Cancel
              </button>
              <button onClick={handleReimburseClaim} className="px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-bold cursor-pointer">
                Confirm Payout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setPreviewReceipt(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-2xl w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <span className="text-xs font-bold text-white">Receipt</span>
              <button onClick={() => setPreviewReceipt(null)} className="text-xs text-amber-400 cursor-pointer">Close</button>
            </div>
            {previewReceipt.startsWith("data:application/pdf") || previewReceipt.toLowerCase().endsWith(".pdf") ? (
              <iframe src={previewReceipt} className="w-full h-[65vh] rounded bg-white" />
            ) : (
              <img src={previewReceipt} alt="Receipt" className="max-h-[65vh] mx-auto rounded object-contain" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
