"use client";

import React, { useState, useMemo } from "react";
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
  Receipt,
  FileCheck2,
  HelpCircle,
} from "lucide-react";
import { Quotation, Vendor, User } from "../lib/types";
import { inr, formatIsoToDdMmYyyy } from "../lib/vba-engine";

interface OverviewProps {
  quotations: Quotation[];
  theme?: "dark" | "light";
  vendors?: Vendor[];
  currentUser?: User | null;
  onOpenQuotation: (q: Quotation) => void;
  onNewQuotation: () => void;
  onOpenVendorModal?: () => void;
  onPrintQuotation?: (q: Quotation) => void;
  onSendEmail?: (q: Quotation) => void;
  onSendWhatsApp?: (q: Quotation) => void;
}

export default function Overview({
  quotations,
  theme = "dark",
  vendors = [],
  currentUser,
  onOpenQuotation,
  onNewQuotation,
  onOpenVendorModal,
  onPrintQuotation,
  onSendEmail,
  onSendWhatsApp,
}: OverviewProps) {
  const isDark = theme === "dark";
  const [fyFilter, setFyFilter] = useState<string>("all");

  // Theme tokens
  const cardBg = isDark
    ? "bg-[#09090b] border-zinc-800 text-zinc-100"
    : "bg-white border-zinc-200 text-zinc-900 shadow-xs";
  const subCardBg = isDark ? "bg-zinc-900/60 border-zinc-800" : "bg-zinc-50 border-zinc-200";
  const textMuted = isDark ? "text-zinc-400" : "text-zinc-500";
  const textHeader = isDark ? "text-white" : "text-zinc-950";
  const rowHover = isDark ? "hover:bg-zinc-900/80" : "hover:bg-zinc-100/80";

  // Financial Year Filter
  const filteredQuotes = useMemo(() => {
    if (fyFilter === "all") return quotations;
    if (fyFilter === "26-27") {
      return quotations.filter((q) => {
        const d = q.date || "";
        return d.startsWith("2026") || d.startsWith("2027") || (q.quotation_no || "").includes("26-27");
      });
    }
    if (fyFilter === "25-26") {
      return quotations.filter((q) => (q.date || "").startsWith("2025") || (q.quotation_no || "").includes("25-26"));
    }
    return quotations;
  }, [quotations, fyFilter]);

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

  // Recent Real Activity (Quotes & Invoices)
  const recentActivities = useMemo(() => {
    return [...filteredQuotes]
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 6);
  }, [filteredQuotes]);

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
              value={fyFilter}
              onChange={(e) => setFyFilter(e.target.value)}
              className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="all" className="bg-zinc-900 text-white">All Records ({quotations.length})</option>
              <option value="26-27" className="bg-zinc-900 text-white">FY 2026-27</option>
              <option value="25-26" className="bg-zinc-900 text-white">FY 2025-26</option>
            </select>
          </div>

          <button
            onClick={onNewQuotation}
            className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs px-3.5 py-2 rounded-lg transition shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Quotation</span>
          </button>
        </div>
      </div>

      {/* 2. 4-Column Responsive KPI Cards (Total Business Value, Outstanding Payments, Total Invoiced, Active Purchase Orders) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Business Value */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>Total Business Value</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-white">
            {inr.format(metrics.totalBusinessValue).replace(/\.00$/, "")}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1 font-medium">
            <span className="text-emerald-400 font-bold">{metrics.totalCount} Proposals</span>
            <span>in commercial pipeline</span>
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
            {inr.format(metrics.outstandingPayments).replace(/\.00$/, "")}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1.5 flex items-center gap-1 font-medium">
            <span>Collected:</span>
            <span className="text-emerald-400 font-bold font-mono">{inr.format(metrics.totalAdvance)}</span>
          </p>
        </div>

        {/* KPI 3: Total Invoiced */}
        <div className={`p-5 rounded-xl border ${cardBg} transition-all duration-200 relative overflow-hidden group`}>
          <div className="flex items-center justify-between mb-2.5">
            <span className={`text-xs font-semibold ${textMuted}`}>Total Invoiced</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black font-mono tracking-tight text-white">
            {inr.format(metrics.totalInvoiced).replace(/\.00$/, "")}
          </div>
          <p className="text-[11px] text-zinc-400 mt-1.5 font-medium">
            Issued via Official Tax Invoices & PIs
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
          <div className="text-2xl font-black font-mono tracking-tight text-white">
            {metrics.vendorsCount} <span className="text-sm font-normal text-zinc-400">Vendors</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-400 font-medium">Registered PO Suppliers</span>
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

      {/* 4. Recent Real Commercial Activity Table */}
      <div className={`border rounded-xl p-5 ${cardBg} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-zinc-800">
          <div>
            <h2 className={`text-sm font-bold flex items-center gap-2 ${textHeader}`}>
              <Clock className="w-4 h-4 text-blue-400" />
              <span>Recent Commercial Transactions & Proposals</span>
            </h2>
            <p className={`text-[11px] mt-0.5 ${textMuted}`}>
              Latest quotations, revisions, and tax invoices recorded in database
            </p>
          </div>

          <span className="text-xs text-zinc-400 font-mono">
            Showing latest {recentActivities.length} records
          </span>
        </div>

        <div className="border border-zinc-800 rounded-lg overflow-x-auto w-full">
          <table className="w-full min-w-[700px] text-xs text-left">
            <thead className="bg-zinc-950/60 border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-bold">
              <tr>
                <th className="py-2.5 px-3">Quotation No</th>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Client Company</th>
                <th className="py-2.5 px-3">Product Scope</th>
                <th className="py-2.5 px-3 text-right">Amount (₹)</th>
                <th className="py-2.5 px-3 text-center">Linked Invoices</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {recentActivities.map((q) => (
                <tr
                  key={q.id}
                  onClick={() => onOpenQuotation(q)}
                  className={`transition cursor-pointer group ${rowHover}`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-white group-hover:text-amber-400 flex items-center gap-2">
                    <FileText className="w-3.5 h-3.5 text-zinc-400 group-hover:text-amber-400" />
                    <span>{q.quotation_no}</span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-zinc-400">
                    {formatIsoToDdMmYyyy(q.date)}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-zinc-200">
                    <div className="truncate max-w-[200px]">{q.client_name || "-"}</div>
                  </td>
                  <td className="py-2.5 px-3 text-zinc-300 truncate max-w-[180px]">
                    {q.product_type || "Gate Automation"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    {inr.format(q.total || 0)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-[10px]">
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
                  <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onOpenQuotation(q)}
                        className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                        title="View & Edit in Workspace"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      {onPrintQuotation && (
                        <button
                          onClick={() => onPrintQuotation(q)}
                          className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition cursor-pointer"
                          title="Print Quotation PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
