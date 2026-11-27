"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  TrendingUp,
  FileText,
  DollarSign,
  AlertCircle,
  Building2,
  Calendar,
  ArrowUpRight,
  Plus,
  Printer,
  Mail,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Receipt,
  FileCheck2,
  HelpCircle,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { Quotation, Vendor, User } from "../lib/types";
import { inr, formatIsoToDdMmYyyy } from "../lib/vba-engine";
import { Badge } from "./ui/badge";
import { useFinancialYear } from "../contexts/FinancialYearContext";
import { listAvailableFYs, matchesReportingFY, formatFYLabel } from "../lib/financial-year";

interface OverviewProps {
  quotations: Quotation[];
  theme?: "dark" | "light";
  vendors?: Vendor[];
  currentUser?: User | null;
  onOpenQuotation: (q: Quotation) => void;
  onNewQuotation: () => void;
  onOpenVendorModal?: () => void;
  onNavigateFinance?: () => void;
  onPrintQuotation?: (q: Quotation) => void;
  onSendEmail?: (q: Quotation) => void;
  onSendWhatsApp?: (q: Quotation) => void;
  onDeleteQuotation?: (q: Quotation) => void;
  canExportPdf?: boolean;
  canSendEmail?: boolean;
  canDeleteQuotation?: boolean;
}

export default function Overview({
  quotations,
  theme = "dark",
  vendors = [],
  currentUser,
  onOpenQuotation,
  onNewQuotation,
  onOpenVendorModal,
  onNavigateFinance,
  onPrintQuotation,
  onSendEmail,
  onSendWhatsApp,
  onDeleteQuotation,
  canExportPdf = true,
  canSendEmail = true,
  canDeleteQuotation = false,
}: OverviewProps) {
  const isDark = theme === "dark";
  const { selectedFY, setSelectedFY, currentFY, resetToCurrentFY } = useFinancialYear();
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [revisionFilter, setRevisionFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc" | "amount_desc" | "amount_asc">("date_desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [financeData, setFinanceData] = useState<{
    tableMissing?: boolean;
    kpis?: {
      uniqueClients: number;
      convertedOrders: number;
      confirmedOrders: number;
      completedOrders: number;
      basicTurnover: number;
      gstInclusiveValue: number;
      customerReceived: number;
      selectedFYOutstanding: number;
      lifetimeOutstanding: number;
      grossProfit: number;
      operatingExpenses: number;
      otherIncome: number;
      netProfit: number;
      cashBalance: number;
      pendingApprovalsCount?: number;
      pendingApprovalsAmount?: number;
      purchaseOrdersCount?: number;
    };
  } | null>(null);

  useEffect(() => {
    let active = true;
    const loadFinance = async () => {
      try {
        const res = await fetch(`/api/finance/dashboard?fy=${encodeURIComponent(selectedFY)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = await res.json();
        if (active) setFinanceData(json);
      } catch {
        // Non-fatal: Overview falls back to quotation metrics
      }
    };
    loadFinance();
    return () => {
      active = false;
    };
  }, [selectedFY]);

  // Theme tokens
  const cardBg = isDark
    ? "bg-[#09090b] border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900 shadow-xs";
  const subCardBg = isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-50 border-zinc-200";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const textHeader = isDark ? "text-white" : "text-zinc-950";
  const rowHover = isDark ? "hover:bg-zinc-900/80" : "hover:bg-zinc-100/80";

  const availableFYs = useMemo(() => {
    const dates = quotations.map((q) => q.date || "").filter(Boolean);
    return listAvailableFYs(dates, currentFY);
  }, [quotations, currentFY]);

  // Financial Year Filter
  const filteredQuotes = useMemo(() => {
    if (selectedFY === "ALL") return quotations;
    return quotations.filter((q) => matchesReportingFY(q.date, q.quotation_no, selectedFY));
  }, [quotations, selectedFY]);

  // Real Database Business Metrics (No duplicate counting)
  const metrics = useMemo(() => {
    let totalBusinessValue = 0; // Total value of commercial proposals
    let totalInvoiced = 0;      // Value of issued tax invoices & confirmed PIs
    let totalAdvance = 0;       // Advance payments received
    let draftCount = 0;
    let missingGstinCount = 0;

    filteredQuotes.forEach((q) => {
      const val = Number(q.total || 0);
      totalBusinessValue += val;

      // Invoiced: has Tax Invoice Number or PI Number
      if (q.tax_invoice_number || q.pi_number) {
        totalInvoiced += val;
      }

      const adv = Number(q.advance_received || 0);
      totalAdvance += adv;

      if ((q.status || "Draft").toLowerCase() === "draft") {
        draftCount++;
      }

      if (!q.client_gstin || q.client_gstin.trim() === "") {
        missingGstinCount++;
      }
    });

    const outstandingPayments = Math.max(0, totalInvoiced - totalAdvance);

    return {
      totalBusinessValue,
      totalInvoiced,
      totalAdvance,
      outstandingPayments,
      draftCount,
      missingGstinCount,
      totalCount: filteredQuotes.length,
      vendorsCount: vendors.length,
    };
  }, [filteredQuotes, vendors]);

  // Monthly Performance Trend (Aggregated dynamically from real DB records)
  const monthlyData = useMemo(() => {
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const monthTotals: { [key: string]: { quotes: number; invoiced: number; count: number } } = {};

    monthNames.forEach((m) => {
      monthTotals[m] = { quotes: 0, invoiced: 0, count: 0 };
    });

    filteredQuotes.forEach((q) => {
      if (!q.date) return;
      const dateObj = new Date(q.date);
      if (isNaN(dateObj.getTime())) return;

      const mIdx = dateObj.getMonth(); // 0 = Jan, 8 = Sep, 10 = Nov
      // FY Month mapping (Apr = 0 to Mar = 11)
      const fyMonthIndex = (mIdx + 9) % 12;
      const mName = monthNames[fyMonthIndex];

      if (monthTotals[mName]) {
        const val = Number(q.total || 0);
        monthTotals[mName].quotes += val;
        monthTotals[mName].count += 1;
        if (q.tax_invoice_number || q.pi_number) {
          monthTotals[mName].invoiced += val;
        }
      }
    });

    // Find max for scaling
    const maxVal = Math.max(
      1,
      ...Object.values(monthTotals).map((m) => Math.max(m.quotes, m.invoiced))
    );

    return {
      items: monthNames.map((name) => ({
        month: name,
        ...monthTotals[name],
        heightQuotesPct: Math.min(100, Math.round((monthTotals[name].quotes / maxVal) * 100)),
        heightInvoicedPct: Math.min(100, Math.round((monthTotals[name].invoiced / maxVal) * 100)),
      })),
      maxVal,
    };
  }, [filteredQuotes]);

  // All Quotations (Search, Filter, Sort, Paginate — no 6-record limit)
  const searchedAndSortedQuotes = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const list = filteredQuotes.filter((q) => {
      if (statusFilter !== "all" && (q.status || "Draft") !== statusFilter) return false;
      const isRev = (q.revision_index && q.revision_index > 0) || /-R\d+$/i.test(q.quotation_no || "");
      if (revisionFilter === "revised" && !isRev) return false;
      if (revisionFilter === "original" && isRev) return false;
      if (qLower) {
        const hay = `${q.quotation_no || ""} ${q.client_name || ""} ${q.product_type || ""} ${q.subject || ""}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
      return true;
    });

    const parseFlexibleDateMs = (raw?: string): number => {
  const s = (raw || "").trim();
  if (!s) return 0;
  const ddmmyyyy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (ddmmyyyy) {
    return new Date(`${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}T00:00:00Z`).getTime() || 0;
  }
  const iso = new Date(s).getTime();
  return Number.isFinite(iso) ? iso : 0;
}

    return [...list].sort((a, b) => {
      if (sortBy === "date_asc") return parseFlexibleDateMs(a.date) - parseFlexibleDateMs(b.date);
      if (sortBy === "amount_desc") return Number(b.total || 0) - Number(a.total || 0);
      if (sortBy === "amount_asc") return Number(a.total || 0) - Number(b.total || 0);
      return parseFlexibleDateMs(b.date) - parseFlexibleDateMs(a.date);
    });
  }, [filteredQuotes, searchQuery, statusFilter, revisionFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(searchedAndSortedQuotes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuotes = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return searchedAndSortedQuotes.slice(start, start + pageSize);
  }, [searchedAndSortedQuotes, safePage, pageSize]);

  // Action Items (Real outstanding balances & missing GSTINs)
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      client: string;
      desc: string;
      amount?: number;
      type: "payment" | "gstin" | "draft";
      quote: Quotation;
    }> = [];

    filteredQuotes.forEach((q) => {
      const total = Number(q.total || 0);
      const adv = Number(q.advance_received || 0);
      const bal = total - adv;

      if ((q.tax_invoice_number || q.pi_number) && bal > 0) {
        items.push({
          id: `pay_${q.id}`,
          title: `Pending Balance: ${q.quotation_no}`,
          client: q.client_name,
          desc: `Adv: ${inr.format(adv)} / Total: ${inr.format(total)}`,
          amount: bal,
          type: "payment",
          quote: q,
        });
      }

      if ((!q.client_gstin || q.client_gstin.trim() === "") && items.length < 5) {
        items.push({
          id: `gst_${q.id}`,
          title: `Missing GSTIN: ${q.client_name}`,
          client: q.quotation_no,
          desc: "Required for statutory Tax Invoice export",
          type: "gstin",
          quote: q,
        });
      }
    });

    return items.slice(0, 4);
  }, [filteredQuotes]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* 1. Header: Command Center Title & Contextual Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4 border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${textHeader}`}>
              Business Command Center
            </h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Live Production
            </span>
          </div>
          <p className={`text-xs mt-1 ${textMuted}`}>
            Aven Industrial Automation &bull; Executive financial metrics & commercial operations
          </p>
        </div>

        {/* Filter & Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 border rounded-lg px-2.5 py-1.5 bg-zinc-900 border-zinc-800 text-xs text-zinc-300">
            <Calendar className="w-3.5 h-3.5 text-amber-500" />
            <select
              aria-label="Global Financial Year"
              value={selectedFY}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              {availableFYs.map((fy) => (
                <option key={fy} value={fy} className="bg-zinc-900 text-white">
                  {fy === currentFY ? `${formatFYLabel(fy)} (Current)` : formatFYLabel(fy)}
                </option>
              ))}
              <option value="ALL" className="bg-zinc-900 text-white">All Financial Years ({quotations.length})</option>
            </select>
          </div>
          {selectedFY !== currentFY && (
            <button
              onClick={resetToCurrentFY}
              className="text-[11px] px-2.5 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition cursor-pointer font-semibold"
            >
              Reset to {formatFYLabel(currentFY)}
            </button>
          )}

          <button
            onClick={onNewQuotation}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3.5 py-2 rounded-lg transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Column Responsive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Turnover (Excl. GST) / Pipeline */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>
              {financeData?.kpis ? "Total Turnover (Excl. GST)" : "Total Business Value"}
            </span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${textHeader}`}>
            {inr
              .format(financeData?.kpis ? financeData.kpis.basicTurnover : metrics.totalBusinessValue)
              .replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 flex items-center gap-1 font-medium`}>
            {financeData?.kpis ? (
              <>
                <span className="text-emerald-400 font-bold">{financeData.kpis.convertedOrders} Orders</span>
                <span>&bull; Pipeline: {inr.format(metrics.totalBusinessValue).replace(/\.00$/, "")}</span>
              </>
            ) : (
              <>
                <span className="text-emerald-400 font-bold">{metrics.totalCount} Proposals</span>
                <span>in commercial pipeline</span>
              </>
            )}
          </p>
        </div>

        {/* KPI 2: Outstanding Payments */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>Outstanding Payments</span>
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-rose-400">
            {inr
              .format(financeData?.kpis ? financeData.kpis.selectedFYOutstanding : metrics.outstandingPayments)
              .replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 flex items-center gap-1 font-medium flex-wrap`}>
            <span>Received:</span>
            <span className="text-emerald-400 font-bold font-mono">
              {inr.format(financeData?.kpis ? financeData.kpis.customerReceived : metrics.totalAdvance).replace(/\.00$/, "")}
            </span>
            {financeData?.kpis && selectedFY !== "ALL" && (
              <span>&bull; Lifetime: {inr.format(financeData.kpis.lifetimeOutstanding).replace(/\.00$/, "")}</span>
            )}
          </p>
        </div>

        {/* KPI 3: Net Profit & Expenses (or Total Invoiced) */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>
              {financeData?.kpis ? "Net Profit" : "Total Invoiced"}
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {financeData?.kpis ? <Wallet className="w-4 h-4" /> : <Receipt className="w-4 h-4" />}
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${financeData?.kpis && financeData.kpis.netProfit < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {inr
              .format(financeData?.kpis ? financeData.kpis.netProfit : metrics.totalInvoiced)
              .replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 font-medium`}>
            {financeData?.kpis
              ? `Expenses: ${inr.format(financeData.kpis.operatingExpenses).replace(/\.00$/, "")} • Cash: ${inr.format(financeData.kpis.cashBalance).replace(/\.00$/, "")}`
              : "Issued via Official Tax Invoices & PIs"}
          </p>
        </div>

        {/* KPI 4: Active Purchase Orders & Vendors */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>Active Purchase Orders</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black font-mono tracking-tight ${textHeader}`}>
            {metrics.vendorsCount} <span className="text-sm font-normal text-zinc-400">Vendors</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className={`text-[11px] ${textMuted} font-medium`}>
              {financeData?.kpis?.pendingApprovalsCount
                ? `${financeData.kpis.pendingApprovalsCount} Expense Approvals`
                : "Registered PO Suppliers"}
            </span>
            {onOpenVendorModal && (
              <button
                onClick={onOpenVendorModal}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-0.5 cursor-pointer"
              >
                Manage &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Compact Secondary Finance Strip when Finance & Operations data is active */}
      {financeData?.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`px-4 py-3 rounded-xl border ${subCardBg} flex items-center justify-between`}>
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Customer Received ({formatFYLabel(selectedFY)})</p>
              <p className={`text-sm font-bold font-mono ${textHeader}`}>{inr.format(financeData.kpis.customerReceived)}</p>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className={`px-4 py-3 rounded-xl border ${subCardBg} flex items-center justify-between`}>
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Total Expenses ({formatFYLabel(selectedFY)})</p>
              <p className={`text-sm font-bold font-mono ${textHeader}`}>{inr.format(financeData.kpis.operatingExpenses)}</p>
            </div>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <div
            onClick={onNavigateFinance}
            className={`px-4 py-3 rounded-xl border ${subCardBg} flex items-center justify-between ${onNavigateFinance ? "cursor-pointer hover:border-amber-500/40" : ""}`}
          >
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Pending Expense Approvals</p>
              <p className={`text-sm font-bold font-mono ${financeData.kpis.pendingApprovalsCount ? "text-amber-400" : textHeader}`}>
                {financeData.kpis.pendingApprovalsCount || 0} Claims ({inr.format(financeData.kpis.pendingApprovalsAmount || 0)})
              </p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-amber-400" />
          </div>
        </div>
      )}

      {/* 3. Balanced Two-Column Row: Business Performance Chart & Action Required */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3 width): Business Performance Monthly Trend Chart */}
        <div className={`lg:col-span-2 border rounded-xl p-5 ${cardBg} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-zinc-800">
            <div>
              <h2 className={`text-sm font-bold flex items-center gap-2 ${textHeader}`}>
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <span>Monthly Business Performance</span>
              </h2>
              <p className={`text-[11px] mt-0.5 ${textMuted}`}>
                Proposals pipeline vs. Invoiced billing based on stored database records
              </p>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span className="text-zinc-300">Proposals (₹)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                <span className="text-zinc-300">Invoiced (₹)</span>
              </div>
            </div>
          </div>

          {/* Dynamic SVG / Bar Visualizer */}
          <div className="pt-2">
            <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 px-1 border-b border-zinc-800 pb-2">
              {monthlyData.items.map((m, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                    {/* Proposal Bar */}
                    <div
                      style={{ height: `${Math.max(4, m.heightQuotesPct)}%` }}
                      className="w-1/2 max-w-[18px] bg-amber-500/80 hover:bg-amber-400 rounded-t-xs transition-all relative group"
                      title={`${m.month}: ${inr.format(m.quotes)} (${m.count} quotes)`}
                    ></div>
                    {/* Invoiced Bar */}
                    <div
                      style={{ height: `${Math.max(4, m.heightInvoicedPct)}%` }}
                      className="w-1/2 max-w-[18px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t-xs transition-all"
                      title={`${m.month} Invoiced: ${inr.format(m.invoiced)}`}
                    ></div>
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400 mt-1 uppercase">
                    {m.month}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-3">
              <span>Peak Monthly Volume: <strong className="text-white font-mono">{inr.format(monthlyData.maxVal)}</strong></span>
              <span className="text-emerald-400 font-semibold">&bull; Active Intra/Inter-state GST Billing</span>
            </div>
          </div>
        </div>

        {/* Right Column (1/3 width): Action Required Panel */}
        <div className={`border rounded-xl p-5 ${cardBg} space-y-3 flex flex-col justify-between`}>
          <div>
            <div className="border-b pb-3 mb-3 border-zinc-800 flex items-center justify-between">
              <h2 className={`text-sm font-bold flex items-center gap-2 ${textHeader}`}>
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span>Action Required</span>
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 font-bold">
                {actionItems.length} Pending
              </span>
            </div>

            <div className="space-y-2.5">
              {actionItems.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5 opacity-80" />
                  <p className="text-xs text-zinc-300 font-medium">All accounts reconciled</p>
                  <p className="text-[10px] text-zinc-500">No overdue payments or missing statutory fields</p>
                </div>
              ) : (
                actionItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onOpenQuotation(item.quote)}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2.5 ${subCardBg} ${rowHover}`}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold truncate ${textHeader}`}>
                        {item.title}
                      </p>
                      <p className={`text-[10px] truncate ${textMuted}`}>
                        {item.desc}
                      </p>
                    </div>
                    {item.amount !== undefined ? (
                      <span className="text-xs font-mono font-bold text-rose-400 shrink-0">
                        {inr.format(item.amount)}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-amber-400 border border-zinc-700 shrink-0">
                        Fix
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-800">
            <button
              onClick={onNewQuotation}
              className="w-full flex items-center justify-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs py-2 rounded-lg transition shadow-xs cursor-pointer"
            >
              <span>Create New Proposal</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 4. All Quotations & Commercial Transactions */}
      <div className={`border rounded-xl p-4 sm:p-5 ${cardBg} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-zinc-800/70">
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${textHeader}`}>
              <Clock className="w-4 h-4 text-blue-400" />
              <span>All Quotations &amp; Commercial Proposals</span>
            </h2>
            <p className={`text-[11px] mt-0.5 ${textMuted}`}>
              Complete searchable archive of all authorized quotations, revisions, and invoices
            </p>
          </div>

          <span className="text-xs text-zinc-400 font-mono">
            Total Quotations: {searchedAndSortedQuotes.length}
          </span>
        </div>

        {/* Search, Filter & Sort Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
          <div className="relative lg:col-span-2">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search quote no, client, product, subject..."
              className={`w-full pl-8 pr-3 py-2 rounded-lg border min-h-[38px] ${
                isDark ? "bg-black border-zinc-700 text-white placeholder-zinc-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400"
              }`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-2 rounded-lg border min-h-[38px] ${
              isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
            }`}
          >
            <option value="all">All Statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Rejected">Rejected</option>
          </select>

          <select
            value={revisionFilter}
            onChange={(e) => {
              setRevisionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-2 rounded-lg border min-h-[38px] ${
              isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
            }`}
          >
            <option value="all">All Revisions</option>
            <option value="original">Originals Only</option>
            <option value="revised">Revisions Only</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={`px-2.5 py-2 rounded-lg border min-h-[38px] ${
              isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
            }`}
          >
            <option value="date_desc">Newest Date First</option>
            <option value="date_asc">Oldest Date First</option>
            <option value="amount_desc">Highest Amount</option>
            <option value="amount_asc">Lowest Amount</option>
          </select>
        </div>

        {/* Desktop Table */}
        <div className={`hidden md:block border rounded-lg overflow-x-auto w-full ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
          <table className="w-full min-w-[780px] text-xs text-left">
            <thead className={`${isDark ? "bg-zinc-950/60 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"} border-b uppercase text-[10px] font-bold`}>
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Quotation No</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3">Client Company</th>
                <th className="py-2.5 px-3">Product / Subject</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount (₹)</th>
                <th className="py-2.5 px-3 text-center">Docs</th>
                <th className={`py-2.5 px-3 text-right sticky right-0 z-10 ${isDark ? "bg-zinc-950" : "bg-zinc-100"} shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.35)]`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-zinc-800/70" : "divide-zinc-200"}`}>
              {paginatedQuotes.length === 0 ? (
                <tr>
                  <td colSpan={8} className={`py-8 text-center ${textMuted}`}>
                    No quotations match your current search or filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedQuotes.map((q) => (
                  <tr
                    key={q.id || q.quotation_no}
                    onClick={() => onOpenQuotation(q)}
                    className={`transition cursor-pointer group ${rowHover}`}
                  >
                    <td className={`py-2.5 px-3 font-mono font-bold whitespace-nowrap group-hover:text-amber-400 ${isDark ? "text-white" : "text-zinc-900"}`}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <FileText className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400 shrink-0" />
                        <span className="whitespace-nowrap">{q.quotation_no}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 whitespace-nowrap">
                      {formatIsoToDdMmYyyy(q.date)}
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${isDark ? "text-zinc-200" : "text-zinc-800"}`}>
                      <div className="truncate max-w-[190px]">{q.client_name || "-"}</div>
                    </td>
                    <td className={`py-2.5 px-3 truncate max-w-[190px] ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>
                      {q.product_type || q.subject || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border border-zinc-700/60 bg-zinc-800/40 text-zinc-300">
                        {q.status || "Draft"}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {inr.format(q.total || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-[10px]">
                        {q.pi_number && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-950/70 text-purple-300 border border-purple-800 font-mono">
                            PI
                          </span>
                        )}
                        {q.tax_invoice_number && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-mono">
                            TI
                          </span>
                        )}
                        {!q.pi_number && !q.tax_invoice_number && (
                          <span className="text-zinc-500">-</span>
                        )}
                      </div>
                    </td>
                    <td className={`py-2.5 px-3 text-right sticky right-0 z-10 whitespace-nowrap ${isDark ? "bg-[#111113]" : "bg-white"} shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.35)]`} onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onOpenQuotation(q)}
                          className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                          title="Open in Quotation System"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {canExportPdf && onPrintQuotation && (
                          <button
                            onClick={() => onPrintQuotation(q)}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                            title="Generate PDF"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canSendEmail && onSendEmail && (
                          <button
                            onClick={() => onSendEmail(q)}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-sky-400 hover:text-sky-300 transition cursor-pointer"
                            title="Email Quotation"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canDeleteQuotation && onDeleteQuotation && (
                          <button
                            onClick={() => onDeleteQuotation(q)}
                            className="p-1.5 rounded bg-zinc-800 hover:bg-rose-950 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                            title="Delete Quotation"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Quotation Cards */}
        <div className="md:hidden space-y-2.5">
          {paginatedQuotes.length === 0 ? (
            <div className={`p-6 text-center text-xs border rounded-lg ${isDark ? "border-zinc-800 text-zinc-400" : "border-zinc-200 text-zinc-500"}`}>
              No quotations found.
            </div>
          ) : (
            paginatedQuotes.map((q) => (
              <div
                key={q.id || q.quotation_no}
                onClick={() => onOpenQuotation(q)}
                className={`p-3 rounded-lg border space-y-2 cursor-pointer ${isDark ? "bg-zinc-900/50 border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className={`text-xs font-mono font-bold ${isDark ? "text-amber-400" : "text-blue-700"}`}>
                      {q.quotation_no}
                    </div>
                    <div className={`text-xs font-semibold truncate ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {q.client_name || "-"}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-bold ${isDark ? "text-white" : "text-zinc-900"}`}>
                      {inr.format(q.total || 0)}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono">{formatIsoToDdMmYyyy(q.date)}</div>
                  </div>
                </div>
                <div className={`text-[11px] truncate ${textMuted}`}>
                  {q.product_type || q.subject || "-"}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50" onClick={(e) => e.stopPropagation()}>
                  <Badge variant={q.status === "Accepted" ? "success" : q.status === "Sent" ? "info" : "secondary"}>
                    {q.status || "Draft"}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onOpenQuotation(q)}
                      className="px-2.5 py-1.5 min-h-[36px] rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-semibold transition-colors cursor-pointer"
                    >
                      Open
                    </button>
                    {canExportPdf && onPrintQuotation && (
                      <button
                        onClick={() => onPrintQuotation(q)}
                        className="px-2.5 py-1.5 min-h-[36px] rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        PDF
                      </button>
                    )}
                    {canSendEmail && onSendEmail && (
                      <button
                        onClick={() => onSendEmail(q)}
                        className="px-2.5 py-1.5 min-h-[36px] rounded-md bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        Email
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className={`px-2 py-1 rounded border ${isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"}`}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>
              Page {safePage} of {totalPages}
            </span>
            <button
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
