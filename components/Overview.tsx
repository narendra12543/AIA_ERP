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
  onOpenPurchaseOrders?: () => void;
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
  onOpenPurchaseOrders,
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
      pendingPoApprovalsCount?: number;
      purchaseOrdersCount?: number;
    };
    monthlySeries?: Array<{ month: string; turnover: number; order_total_incl_gst: number; expenses: number }>;
    outstandingOrders?: Array<{ id: string; order_no: string; client_name: string; order_date: string; total_order_value: number; paid_amount: number; outstanding: number }>;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const loadFinance = async () => {
      try {
        const res = await fetch(`/api/finance/dashboard?fy=${encodeURIComponent(selectedFY)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = await res.json();
        setFinanceData(json);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          // Non-fatal: Overview falls back to quotation metrics
        }
      }
    };
    loadFinance();
    return () => {
      controller.abort();
    };
  }, [selectedFY]);

  // Theme tokens (Enterprise Neutral Design System)
  const cardBg = isDark
    ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]"
    : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCardBg = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const textMuted = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";
  const textHeader = isDark ? "text-[#F4F4F5]" : "text-[#18181B]";
  const rowHover = isDark ? "hover:bg-[#1D1F23]" : "hover:bg-zinc-100/80";

  const availableFYs = useMemo(() => {
    const dates = quotations.map((q) => q.date || "").filter(Boolean);
    return listAvailableFYs(dates, currentFY);
  }, [quotations, currentFY]);

  // Financial Year Filter
  const filteredQuotes = useMemo(() => {
    if (selectedFY === "ALL") return quotations;
    return quotations.filter((q) => matchesReportingFY(q.date, q.quotation_no, selectedFY));
  }, [quotations, selectedFY]);

  // Deduplicate logical quotations by base quotation number (latest revision only, excluding deleted/cancelled)
  const deduplicatedQuotes = useMemo(() => {
    const map = new Map<string, Quotation>();
    for (const q of filteredQuotes) {
      const st = String(q.status || "").trim().toLowerCase();
      if (st === "cancelled" || st === "deleted") continue;
      const rawNo = String(q.quotation_no || q.id || "").trim();
      const baseNo = rawNo.replace(/-R\d+$/i, "").toLowerCase();
      const existing = map.get(baseNo);
      if (!existing) {
        map.set(baseNo, q);
        continue;
      }
      const curRev = Number(q.revision_index || 0);
      const prevRev = Number(existing.revision_index || 0);
      if (curRev > prevRev) {
        map.set(baseNo, q);
      } else if (curRev === prevRev) {
        const curTs = new Date((q as any).updated_at || q.date || 0).getTime() || 0;
        const prevTs = new Date((existing as any).updated_at || existing.date || 0).getTime() || 0;
        if (curTs >= prevTs) map.set(baseNo, q);
      }
    }
    return Array.from(map.values());
  }, [filteredQuotes]);

  // Real Database Business Metrics (No duplicate counting)
  const metrics = useMemo(() => {
    let totalQuotationValue = 0; // Total commercial quotation value (Incl. GST), deduplicated by revision

    deduplicatedQuotes.forEach((q) => {
      totalQuotationValue += Number(q.total || 0);
    });

    return {
      totalQuotationValue,
      totalCount: deduplicatedQuotes.length,
      vendorsCount: vendors.length,
    };
  }, [deduplicatedQuotes, vendors]);

  // Monthly Performance Trend (Quotation Value Incl. GST vs. Confirmed Order Value Incl. GST)
  const monthlyData = useMemo(() => {
    const monthNames = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
    const monthTotals: { [key: string]: { quotes: number; orders: number; count: number } } = {};

    monthNames.forEach((m) => {
      monthTotals[m] = { quotes: 0, orders: 0, count: 0 };
    });

    const parseMonthIndex = (raw?: string): number | null => {
      const s = String(raw || "").trim();
      if (!s) return null;
      const ddmmyyyy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
      if (ddmmyyyy) return Number(ddmmyyyy[2]) - 1;
      const yyyymm = s.match(/^(\d{4})-(\d{2})/);
      if (yyyymm) return Number(yyyymm[2]) - 1;
      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt.getMonth();
    };

    deduplicatedQuotes.forEach((q) => {
      const mIdx = parseMonthIndex(q.date);
      if (mIdx === null) return;
      const fyMonthIndex = (mIdx + 9) % 12;
      const mName = monthNames[fyMonthIndex];
      if (monthTotals[mName]) {
        monthTotals[mName].quotes += Number(q.total || 0);
        monthTotals[mName].count += 1;
      }
    });

    (financeData?.monthlySeries || []).forEach((row) => {
      const mIdx = parseMonthIndex(row.month);
      if (mIdx === null) return;
      const fyMonthIndex = (mIdx + 9) % 12;
      const mName = monthNames[fyMonthIndex];
      if (monthTotals[mName]) {
        monthTotals[mName].orders += Number(row.order_total_incl_gst || 0);
      }
    });

    const maxVal = Math.max(
      0,
      ...Object.values(monthTotals).map((m) => Math.max(m.quotes, m.orders))
    );
    const scaleMax = maxVal > 0 ? maxVal : 1;

    return {
      items: monthNames.map((name) => ({
        month: name,
        ...monthTotals[name],
        heightQuotesPct: monthTotals[name].quotes > 0 ? Math.min(100, Math.round((monthTotals[name].quotes / scaleMax) * 100)) : 0,
        heightOrdersPct: monthTotals[name].orders > 0 ? Math.min(100, Math.round((monthTotals[name].orders / scaleMax) * 100)) : 0,
      })),
      maxVal,
    };
  }, [deduplicatedQuotes, financeData?.monthlySeries]);

  // All Quotations (Search, Filter, Sort, Paginate)
  const searchedAndSortedQuotes = useMemo(() => {
    const qLower = searchQuery.trim().toLowerCase();
    const list = filteredQuotes.filter((q) => {
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
  }, [filteredQuotes, searchQuery, revisionFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(searchedAndSortedQuotes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedQuotes = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return searchedAndSortedQuotes.slice(start, start + pageSize);
  }, [searchedAndSortedQuotes, safePage, pageSize]);

  // Action Items (Real Finance & Operations receivables, invoice GSTIN alerts, and Admin PO approvals)
  const actionItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      client: string;
      desc: string;
      amount?: number;
      type: "payment" | "gstin" | "po_approval";
      quote?: Quotation;
      actionTarget?: "finance" | "po";
    }> = [];

    if (currentUser?.role === "Admin" && (financeData?.kpis?.pendingPoApprovalsCount || 0) > 0) {
      items.push({
        id: "po_pending_approvals",
        title: `Pending PO Approvals (${financeData?.kpis?.pendingPoApprovalsCount})`,
        client: "Purchase Orders",
        desc: "Submitted supplier Purchase Orders awaiting Admin review",
        type: "po_approval",
        actionTarget: "po",
      });
    }

    (financeData?.outstandingOrders || []).forEach((ord) => {
      if (items.length >= 4) return;
      const bal = Number(ord.outstanding || 0);
      if (bal > 0) {
        items.push({
          id: `fin_ord_${ord.id}`,
          title: `Pending Balance: ${ord.order_no}`,
          client: ord.client_name,
          desc: `${ord.client_name} • Paid: ${inr.format(Number(ord.paid_amount || 0))} / ${inr.format(Number(ord.total_order_value || 0))}`,
          amount: bal,
          type: "payment",
          actionTarget: "finance",
        });
      }
    });

    filteredQuotes.forEach((q) => {
      if (items.length >= 4) return;
      const hasInvoiceWorkflow = Boolean(q.tax_invoice_number && q.tax_invoice_number.trim() !== "");
      if (hasInvoiceWorkflow && (!q.client_gstin || q.client_gstin.trim() === "")) {
        items.push({
          id: `gst_${q.id}`,
          title: `Missing GSTIN: ${q.client_name}`,
          client: q.quotation_no,
          desc: `Required for Tax Invoice ${q.tax_invoice_number}`,
          type: "gstin",
          quote: q,
        });
      }
    });

    return items.slice(0, 4);
  }, [currentUser?.role, financeData?.kpis?.pendingPoApprovalsCount, financeData?.outstandingOrders, filteredQuotes]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* 1. Compact Page Heading & Contextual FY Filter */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${isDark ? "border-[#2A2C30]" : "border-[#E2E4E8]"}`}>
        <div>
          <h2 className={`text-[22px] font-semibold tracking-tight ${textHeader}`}>
            Overview
          </h2>
          <p className={`text-[13px] mt-0.5 ${textMuted}`}>
            Business performance and operational summary.
          </p>
        </div>

        {/* Filter & Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 border rounded-md px-2.5 h-9 text-[13px] ${subCardBg} ${textHeader}`}>
            <Calendar className={`w-3.5 h-3.5 ${textMuted}`} />
            <select
              aria-label="Global Financial Year"
              value={selectedFY}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-[13px] focus:outline-none cursor-pointer"
            >
              {availableFYs.map((fy) => (
                <option key={fy} value={fy} className={isDark ? "bg-[#17181B] text-[#F4F4F5]" : "bg-white text-[#18181B]"}>
                  {fy === currentFY ? `${formatFYLabel(fy)} (Current)` : formatFYLabel(fy)}
                </option>
              ))}
              <option value="ALL" className={isDark ? "bg-[#17181B] text-[#F4F4F5]" : "bg-white text-[#18181B]"}>
                All Financial Years ({quotations.length})
              </option>
            </select>
          </div>
          {selectedFY !== currentFY && (
            <button
              onClick={resetToCurrentFY}
              className={`h-9 px-3 rounded-md border text-[12px] font-medium transition-colors duration-150 cursor-pointer ${subCardBg} ${textHeader}`}
            >
              Reset to {formatFYLabel(currentFY)}
            </button>
          )}

          <button
            onClick={onNewQuotation}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-medium text-[13px] h-9 px-3.5 rounded-md transition-colors duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Column Enterprise KPI Cards (Exact Required Order) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* KPI 1: Total Quotation Value (Incl. GST, deduplicated by latest revision) */}
        <div className={`p-4 rounded-lg border min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[12px] font-medium ${textMuted}`}>Total Quotation Value</span>
            <FileText className={`w-4 h-4 shrink-0 ${textMuted}`} />
          </div>
          <div className={`text-[20px] sm:text-[22px] font-semibold tabular-nums tracking-tight break-words ${textHeader}`}>
            {inr.format(metrics.totalQuotationValue).replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 tabular-nums`}>
            {metrics.totalCount} Quotations &bull; Incl. GST
          </p>
        </div>

        {/* KPI 2: Total Turnover (Excl. GST) */}
        <div className={`p-4 rounded-lg border min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[12px] font-medium ${textMuted}`}>Total Turnover (Excl. GST)</span>
            <TrendingUp className={`w-4 h-4 shrink-0 ${textMuted}`} />
          </div>
          <div className={`text-[20px] sm:text-[22px] font-semibold tabular-nums tracking-tight break-words ${textHeader}`}>
            {inr.format(financeData?.kpis ? financeData.kpis.basicTurnover : 0).replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 tabular-nums`}>
            {financeData?.kpis
              ? `${financeData.kpis.convertedOrders} Confirmed Orders`
              : "Finance & Operations Turnover"}
          </p>
        </div>

        {/* KPI 3: Outstanding Receivables */}
        <div className={`p-4 rounded-lg border min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[12px] font-medium ${textMuted}`}>Outstanding Receivables</span>
            <AlertCircle className={`w-4 h-4 shrink-0 ${textMuted}`} />
          </div>
          <div className={`text-[20px] sm:text-[22px] font-semibold tabular-nums tracking-tight break-words ${(financeData?.kpis?.selectedFYOutstanding || 0) > 0 ? "text-rose-500" : textHeader}`}>
            {inr.format(financeData?.kpis ? financeData.kpis.selectedFYOutstanding : 0).replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 tabular-nums`}>
            Received: {inr.format(financeData?.kpis ? financeData.kpis.customerReceived : 0).replace(/\.00$/, "")}
            {financeData?.kpis && selectedFY !== "ALL"
              ? ` • Lifetime: ${inr.format(financeData.kpis.lifetimeOutstanding).replace(/\.00$/, "")}`
              : ""}
          </p>
        </div>

        {/* KPI 4: Net Profit */}
        <div className={`p-4 rounded-lg border min-w-0 ${cardBg}`}>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[12px] font-medium ${textMuted}`}>Net Profit</span>
            <Wallet className={`w-4 h-4 shrink-0 ${textMuted}`} />
          </div>
          <div className={`text-[20px] sm:text-[22px] font-semibold tabular-nums tracking-tight break-words ${financeData?.kpis && financeData.kpis.netProfit < 0 ? "text-rose-500" : textHeader}`}>
            {inr.format(financeData?.kpis ? financeData.kpis.netProfit : 0).replace(/\.00$/, "")}
          </div>
          <p className={`text-[11px] ${textMuted} mt-1.5 tabular-nums`}>
            Expenses: {inr.format(financeData?.kpis ? financeData.kpis.operatingExpenses : 0).replace(/\.00$/, "")}
          </p>
        </div>
      </div>

      {/* Compact Secondary Finance Strip when Finance & Operations data is active */}
      {financeData?.kpis && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`px-4 py-3 rounded-lg border ${cardBg} flex items-center justify-between`}>
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Customer Received ({formatFYLabel(selectedFY)})</p>
              <p className={`text-[14px] font-semibold tabular-nums mt-0.5 ${textHeader}`}>{inr.format(financeData.kpis.customerReceived)}</p>
            </div>
            <CheckCircle2 className={`w-4 h-4 ${textMuted}`} />
          </div>
          <div className={`px-4 py-3 rounded-lg border ${cardBg} flex items-center justify-between`}>
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Approved Expenses ({formatFYLabel(selectedFY)})</p>
              <p className={`text-[14px] font-semibold tabular-nums mt-0.5 ${textHeader}`}>{inr.format(financeData.kpis.operatingExpenses)}</p>
            </div>
            <Receipt className={`w-4 h-4 ${textMuted}`} />
          </div>
          <div
            onClick={onNavigateFinance}
            className={`px-4 py-3 rounded-lg border ${cardBg} flex items-center justify-between ${onNavigateFinance ? "cursor-pointer hover:border-amber-500/50" : ""}`}
          >
            <div>
              <p className={`text-[11px] font-medium ${textMuted}`}>Pending Expense Approvals</p>
              <p className={`text-[14px] font-semibold tabular-nums mt-0.5 ${textHeader}`}>
                {financeData.kpis.pendingApprovalsCount || 0} Claims ({inr.format(financeData.kpis.pendingApprovalsAmount || 0)})
              </p>
            </div>
            <ArrowUpRight className={`w-4 h-4 ${textMuted}`} />
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
                Quotation Value (Incl. GST) vs. Confirmed Order Value (Incl. GST)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>Quotation Value (₹)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                <span className={isDark ? "text-zinc-300" : "text-zinc-700"}>Confirmed Order Value (₹)</span>
              </div>
            </div>
          </div>

          {/* Dynamic SVG / Bar Visualizer */}
          <div className="pt-2">
            <div className="h-48 flex items-end justify-between gap-1 sm:gap-2 px-1 border-b border-zinc-800 pb-2">
              {monthlyData.items.map((m, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                    {/* Quotation Value Bar */}
                    <div
                      style={{ height: `${m.heightQuotesPct}%` }}
                      className="w-1/2 max-w-[18px] bg-amber-500/80 hover:bg-amber-400 rounded-t-xs transition-all relative group"
                      title={`${m.month} Quotations: ${inr.format(m.quotes)} (${m.count} quotes)`}
                    ></div>
                    {/* Confirmed Order Value Bar */}
                    <div
                      style={{ height: `${m.heightOrdersPct}%` }}
                      className="w-1/2 max-w-[18px] bg-emerald-500/80 hover:bg-emerald-400 rounded-t-xs transition-all"
                      title={`${m.month} Confirmed Orders: ${inr.format(m.orders)}`}
                    ></div>
                  </div>
                  <span className="text-[10px] font-semibold text-zinc-400 mt-1 uppercase">
                    {m.month}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-400 pt-3">
              <span>Peak Monthly Volume: <strong className={`${textHeader} font-mono`}>{inr.format(monthlyData.maxVal)}</strong></span>
              <span className={textMuted}>Issued Tax Invoice series omitted (no separate issued invoice table)</span>
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
                  <p className={`text-xs font-medium ${textHeader}`}>All accounts reconciled</p>
                  <p className="text-[10px] text-zinc-500">No overdue receivables, PO approvals, or missing invoice GSTINs</p>
                </div>
              ) : (
                actionItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (item.actionTarget === "po" && onOpenPurchaseOrders) onOpenPurchaseOrders();
                      else if (item.actionTarget === "finance" && onNavigateFinance) onNavigateFinance();
                      else if (item.quote) onOpenQuotation(item.quote);
                    }}
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
                        {item.type === "po_approval" ? "Review" : "Fix"}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
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
              className={`w-full pl-8 pr-3 py-2 rounded-lg border min-h-[40px] ${
                isDark ? "bg-black border-zinc-700 text-white placeholder-zinc-500" : "bg-white border-zinc-300 text-zinc-900 placeholder-zinc-400"
              }`}
            />
          </div>

          <select
            value={revisionFilter}
            onChange={(e) => {
              setRevisionFilter(e.target.value);
              setCurrentPage(1);
            }}
            className={`px-2.5 py-2 rounded-lg border min-h-[40px] ${
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
            className={`px-2.5 py-2 rounded-lg border min-h-[40px] ${
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
          <table className="w-full min-w-[720px] text-xs text-left">
            <thead className={`${isDark ? "bg-zinc-950/60 border-zinc-800 text-zinc-400" : "bg-zinc-100 border-zinc-200 text-zinc-600"} border-b uppercase text-[10px] font-bold`}>
              <tr>
                <th className="py-2.5 px-3 whitespace-nowrap">Quotation No</th>
                <th className="py-2.5 px-3 whitespace-nowrap">Date</th>
                <th className="py-2.5 px-3">Client Company</th>
                <th className="py-2.5 px-3">Product / Subject</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Amount (₹)</th>
                <th className="py-2.5 px-3 text-center">Docs</th>
                <th className={`py-2.5 px-3 text-right sticky right-0 z-10 ${isDark ? "bg-zinc-950" : "bg-zinc-100"} shadow-[-8px_0_12px_-6px_rgba(0,0,0,0.35)]`}>Actions</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isDark ? "divide-zinc-800/70" : "divide-zinc-200"}`}>
              {paginatedQuotes.length === 0 ? (
                <tr>
                  <td colSpan={7} className={`py-8 text-center ${textMuted}`}>
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
                <div className="flex items-center justify-end pt-2 border-t border-zinc-800/50" onClick={(e) => e.stopPropagation()}>
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
