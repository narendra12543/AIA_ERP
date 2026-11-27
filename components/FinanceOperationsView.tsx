"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
  Search,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  UserPlus,
  X,
} from "lucide-react";
import { Client, Quotation, User } from "../lib/types";
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
  onOpenAddEmployee?: () => void;
}

interface OrderItemDraft {
  product_name: string;
  category: string;
  qty: number;
  selling_price: number;
  manufacturing_cost: number;
  installation_cost: number;
  other_cost: number;
}

export default function FinanceOperationsView({
  currentUser,
  quotations,
  theme = "dark",
  onOpenAddEmployee,
}: FinanceOperationsViewProps) {
  const isDark = theme === "dark";
  const { selectedFY, setSelectedFY, currentFY, resetToCurrentFY } = useFinancialYear();

  const [activeTab, setActiveTab] = useState<FinanceTab>("dashboard");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const reqSeqRef = useRef(0);

  // Data States
  const [dash, setDash] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [reimbursements, setReimbursements] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  // Orders Filter & Pagination
  const [orderSearch, setOrderSearch] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("ALL");
  const [orderSort, setOrderSort] = useState<"date_desc" | "date_asc" | "value_desc" | "outstanding_desc">("date_desc");
  const [orderPage, setOrderPage] = useState(1);
  const orderPageSize = 25;

  // Add / Edit Order Modal
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [orderMode, setOrderMode] = useState<"quotation" | "manual">("quotation");
  const [quoteSearch, setQuoteSearch] = useState("");
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [selectedQuoteSnapshot, setSelectedQuoteSnapshot] = useState<any>(null);

  const [ordClientId, setOrdClientId] = useState("");
  const [ordClientName, setOrdClientName] = useState("");
  const [ordClientContact, setOrdClientContact] = useState("");
  const [ordClientEmail, setOrdClientEmail] = useState("");
  const [ordClientGstin, setOrdClientGstin] = useState("");
  const [ordClientAddress, setOrdClientAddress] = useState("");
  const [ordClientState, setOrdClientState] = useState("27-Maharashtra");

  const [ordQuotationNo, setOrdQuotationNo] = useState("");
  const [ordDate, setOrdDate] = useState(getCurrentBusinessDate());
  const [ordProjectName, setOrdProjectName] = useState("");
  const [ordProjectDesc, setOrdProjectDesc] = useState("");
  const [ordCustPoNo, setOrdCustPoNo] = useState("");
  const [ordCustPoDate, setOrdCustPoDate] = useState("");
  const [ordDueDate, setOrdDueDate] = useState("");
  const [ordCompletionDate, setOrdCompletionDate] = useState("");
  const [ordStatus, setOrdStatus] = useState("Confirmed");
  const [ordRemarks, setOrdRemarks] = useState("");

  const [ordGstRate, setOrdGstRate] = useState(18);
  const [ordPiNo, setOrdPiNo] = useState("");
  const [ordTiNo, setOrdTiNo] = useState("");
  const [ordInvoiceStatus, setOrdInvoiceStatus] = useState("Not Generated");
  const [ordItems, setOrdItems] = useState<OrderItemDraft[]>([
    { product_name: "", category: "Automation", qty: 1, selling_price: 0, manufacturing_cost: 0, installation_cost: 0, other_cost: 0 },
  ]);

  const [showMaintenance, setShowMaintenance] = useState(false);
  const [maintRequired, setMaintRequired] = useState(false);
  const [maintType, setMaintType] = useState("AMC");
  const [maintStart, setMaintStart] = useState("");
  const [maintEnd, setMaintEnd] = useState("");
  const [maintRevenue, setMaintRevenue] = useState("0");
  const [maintCost, setMaintCost] = useState("0");
  const [savingOrder, setSavingOrder] = useState(false);

  // Payment Form
  const [payOrderId, setPayOrderId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(getCurrentBusinessDate());
  const [payMode, setPayMode] = useState("NEFT");
  const [payType, setPayType] = useState("Progress Payment");
  const [payAccountId, setPayAccountId] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Expense Filters & Modals
  const [expenseFilter, setExpenseFilter] = useState("ALL");
  const [expenseSearch, setExpenseSearch] = useState("");
  const [rejectModalClaim, setRejectModalClaim] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reimburseModalClaim, setReimburseModalClaim] = useState<any | null>(null);
  const [reimbAccountId, setReimbAccountId] = useState("");
  const [reimbMode, setReimbMode] = useState("UPI");
  const [reimbAmount, setReimbAmount] = useState("");
  const [reimbRef, setReimbRef] = useState("");
  const [reimbDate, setReimbDate] = useState(getCurrentBusinessDate());

  const [directExpTitle, setDirectExpTitle] = useState("");
  const [directExpPaidTo, setDirectExpPaidTo] = useState("");
  const [directExpAmount, setDirectExpAmount] = useState("");
  const [directExpCatName, setDirectExpCatName] = useState("Material");
  const [directExpDate, setDirectExpDate] = useState(getCurrentBusinessDate());

  // Accounts & Ledger
  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState("Bank");
  const [newAccOpening, setNewAccOpening] = useState("0");
  const [txType, setTxType] = useState("Income");
  const [txAccountId, setTxAccountId] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txDate, setTxDate] = useState(getCurrentBusinessDate());
  const [txDesc, setTxDesc] = useState("");

  // Employee Edit Modal
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [empDesignation, setEmpDesignation] = useState("");
  const [empDepartment, setEmpDepartment] = useState("");
  const [empMobile, setEmpMobile] = useState("");
  const [empStatus, setEmpStatus] = useState("Active");

  // Reports
  const [reportType, setReportType] = useState("order_register");
  const [reportData, setReportData] = useState<{ headers: string[]; keys: string[]; rows: any[] } | null>(null);

  const [previewReceipt, setPreviewReceipt] = useState<string | null>(null);

  // Enterprise Neutral Design Tokens
  const cardBg = isDark
    ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]"
    : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCardBg = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const inputCls = isDark
    ? "bg-[#101113] border-[#2A2C30] text-[#F4F4F5] placeholder-[#71717A] focus:border-amber-500 focus:outline-none"
    : "bg-white border-[#E2E4E8] text-[#18181B] placeholder-[#A1A1AA] focus:border-amber-500 focus:outline-none";
  const textMuted = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";
  const textHeader = isDark ? "text-[#F4F4F5]" : "text-[#18181B]";
  const borderCol = isDark ? "border-[#2A2C30]" : "border-[#E2E4E8]";

  const canApprove =
    currentUser?.role === "Admin" || currentUser?.permissions?.includes("expenses.approve");
  const canReimburse =
    currentUser?.role === "Admin" ||
    currentUser?.permissions?.includes("expenses.reimburse") ||
    currentUser?.role === "Accounts";
  const canExport =
    currentUser?.role === "Admin" ||
    currentUser?.permissions?.includes("finance.export") ||
    currentUser?.role === "Accounts";

  const availableFYs = useMemo(() => {
    const dates = [
      ...quotations.map((q) => q.date || ""),
      ...orders.map((o) => String(o.order_date || "").slice(0, 10)),
    ].filter(Boolean);
    return listAvailableFYs(dates, currentFY);
  }, [quotations, orders, currentFY]);

  const loadFinanceData = useCallback(async () => {
    const seq = ++reqSeqRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const fyQ = encodeURIComponent(selectedFY);
      const dRes = await fetch(`/api/finance/dashboard?fy=${fyQ}`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (!dRes.ok && dRes.status !== 403) {
        const err = await dRes.json().catch(() => ({}));
        setLoadError(err.error || `Dashboard request failed (${dRes.status})`);
      }
      if (dRes.ok) setDash(await dRes.json());

      const oRes = await fetch(`/api/finance/orders?fy=${fyQ}`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (oRes.ok) {
        const od = await oRes.json();
        setOrders(od.items || od.orders || []);
      } else if (oRes.status !== 403) {
        setLoadError(`Orders request failed (${oRes.status})`);
      }

      const pRes = await fetch(`/api/finance/payments?fy=${fyQ}`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (pRes.ok) {
        const pd = await pRes.json();
        setPayments(pd.items || pd.payments || []);
      }

      const eRes = await fetch(`/api/expenses?fy=${fyQ}&scope=all`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (eRes.ok) {
        const ed = await eRes.json();
        setClaims(ed.items || ed.claims || []);
      }

      const cRes = await fetch(`/api/expenses/categories`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (cRes.ok) {
        const cd = await cRes.json();
        const cats = cd.items || cd.categories || [];
        setCategories(cats);
        if (cats.length > 0) {
          setDirectExpCatName((prev) => prev || cats[0].name);
        }
      }

      const rRes = await fetch(`/api/expenses/reimbursements?fy=${fyQ}`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (rRes.ok) {
        const rd = await rRes.json();
        setReimbursements(rd.items || rd.reimbursements || []);
      }

      const aRes = await fetch(`/api/finance/accounts?fy=${fyQ}`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (aRes.ok) {
        const ad = await aRes.json();
        const accs = ad.accounts || [];
        setAccounts(accs);
        setTransactions(ad.items || ad.transactions || []);
        if (accs.length > 0) {
          const firstAcc = String(accs[0].id);
          setPayAccountId((prev) => prev || firstAcc);
          setReimbAccountId((prev) => prev || firstAcc);
          setTxAccountId((prev) => prev || firstAcc);
        }
      }

      const empRes = await fetch(`/api/employees`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (empRes.ok) {
        const empd = await empRes.json();
        setEmployees(empd.items || empd.employees || []);
      }

      const cliRes = await fetch(`/api/clients`, { cache: "no-store" });
      if (seq !== reqSeqRef.current) return;
      if (cliRes.ok) {
        const clid = await cliRes.json();
        setClients(Array.isArray(clid) ? clid : clid.items || []);
      }
    } catch {
      if (seq === reqSeqRef.current) {
        setLoadError("Unable to reach Finance APIs. Please retry.");
      }
    } finally {
      if (seq === reqSeqRef.current) {
        setLoading(false);
      }
    }
  }, [selectedFY]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/finance/reports?type=${encodeURIComponent(reportType)}&fy=${encodeURIComponent(selectedFY)}`,
        { cache: "no-store" }
      );
      if (res.ok) setReportData(await res.json());
    } catch {
      // ignore
    }
  }, [reportType, selectedFY]);

  useEffect(() => {
    if (activeTab === "reports") loadReport();
  }, [activeTab, loadReport]);

  // Sorted & searchable quotations for "From Existing Quotation"
  const sortedQuotations = useMemo(() => {
    const q = quoteSearch.trim().toLowerCase();
    return [...quotations]
      .filter((item) => {
        if (!q) return true;
        return `${item.quotation_no || ""} ${item.client_name || ""} ${item.subject || ""}`
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => String(b.quotation_no || "").localeCompare(String(a.quotation_no || ""), undefined, { numeric: true }));
  }, [quotations, quoteSearch]);

  const openNewOrderModal = (mode: "quotation" | "manual") => {
    setEditingOrderId(null);
    setOrderMode(mode);
    setQuoteSearch("");
    setSelectedQuoteId("");
    setSelectedQuoteSnapshot(null);
    setOrdClientId("");
    setOrdClientName("");
    setOrdClientContact("");
    setOrdClientEmail("");
    setOrdClientGstin("");
    setOrdClientAddress("");
    setOrdClientState("27-Maharashtra");
    setOrdQuotationNo("");
    setOrdDate(getCurrentBusinessDate());
    setOrdProjectName("");
    setOrdProjectDesc("");
    setOrdCustPoNo("");
    setOrdCustPoDate("");
    setOrdDueDate("");
    setOrdCompletionDate("");
    setOrdStatus("Confirmed");
    setOrdRemarks("");
    setOrdGstRate(18);
    setOrdPiNo("");
    setOrdTiNo("");
    setOrdInvoiceStatus("Not Generated");
    setOrdItems([
      { product_name: "", category: "Automation", qty: 1, selling_price: 0, manufacturing_cost: 0, installation_cost: 0, other_cost: 0 },
    ]);
    setShowMaintenance(false);
    setMaintRequired(false);
    setMaintRevenue("0");
    setMaintCost("0");
    setOrderModalOpen(true);
  };

  const openEditOrderModal = (o: any) => {
    setEditingOrderId(o.id);
    setOrderMode(o.quotation_no ? "quotation" : "manual");
    setOrdClientId(o.client_id || "");
    setOrdClientName(o.client_name || "");
    setOrdQuotationNo(o.quotation_no || "");
    setOrdDate(String(o.order_date || "").slice(0, 10) || getCurrentBusinessDate());
    setOrdProjectName(o.project_name || "");
    setOrdProjectDesc(o.project_description || "");
    setOrdCustPoNo(o.customer_po_no || "");
    setOrdCustPoDate(o.customer_po_date ? String(o.customer_po_date).slice(0, 10) : "");
    setOrdDueDate(o.payment_due_date ? String(o.payment_due_date).slice(0, 10) : "");
    setOrdCompletionDate(o.completion_date ? String(o.completion_date).slice(0, 10) : "");
    setOrdStatus(o.order_status || "Confirmed");
    setOrdRemarks(o.remarks || "");
    setOrdGstRate(Number(o.gst_rate ?? 18));
    setOrdPiNo(o.pi_number || "");
    setOrdTiNo(o.tax_invoice_number || "");
    setOrdInvoiceStatus(o.invoice_status || "Not Generated");
    const mappedItems: OrderItemDraft[] = (o.items || []).map((it: any) => ({
      product_name: it.product_name || "",
      category: it.category || "Automation",
      qty: Number(it.qty || 1),
      selling_price: Number(it.selling_price || 0),
      manufacturing_cost: Number(it.manufacturing_cost || 0),
      installation_cost: Number(it.installation_cost || 0),
      other_cost: Number(it.other_cost || 0),
    }));
    setOrdItems(
      mappedItems.length > 0
        ? mappedItems
        : [{ product_name: o.project_name || "", category: "Automation", qty: 1, selling_price: Number(o.basic_value || 0), manufacturing_cost: 0, installation_cost: 0, other_cost: 0 }]
    );
    setMaintRequired(Boolean(o.maintenance?.required));
    setShowMaintenance(Boolean(o.maintenance?.required));
    setMaintType(o.maintenance?.maintenance_type || "AMC");
    setMaintStart(o.maintenance?.start_date ? String(o.maintenance.start_date).slice(0, 10) : "");
    setMaintEnd(o.maintenance?.end_date ? String(o.maintenance.end_date).slice(0, 10) : "");
    setMaintRevenue(String(o.maintenance?.revenue ?? 0));
    setMaintCost(String(o.maintenance?.cost ?? 0));
    setOrderModalOpen(true);
  };

  const handleSelectQuotation = (qId: string) => {
    setSelectedQuoteId(qId);
    const q = quotations.find((x) => String(x.id) === qId || x.quotation_no === qId);
    if (!q) return;
    setSelectedQuoteSnapshot(q);
    setOrdQuotationNo(q.quotation_no || "");
    setOrdClientName(q.client_name || "");
    setOrdClientContact(q.client_contact || "");
    setOrdClientEmail(q.client_email || "");
    setOrdClientGstin(q.client_gstin || "");
    setOrdClientAddress(q.client_address || "");
    setOrdProjectName(q.product_type || q.subject || q.items?.[0]?.name?.split(/\r?\n/)[0] || "");
    setOrdProjectDesc(q.subject || "");
    setOrdCustPoNo(q.client_po_no || "");
    setOrdCustPoDate(q.client_po_date || "");
    setOrdPiNo(q.pi_number || "");
    setOrdTiNo(q.tax_invoice_number || "");
    setOrdInvoiceStatus(q.tax_invoice_number ? "Tax Invoice Issued" : q.pi_number ? "PI Issued" : "Not Generated");

    // Match existing client ID without creating duplicates
    const matchedClient = clients.find(
      (c) => c.name.trim().toLowerCase() === (q.client_name || "").trim().toLowerCase()
    );
    setOrdClientId(matchedClient?.id || "");

    const qItems: OrderItemDraft[] = (q.items || []).map((it) => ({
      product_name: String(it.name || "").split(/\r?\n/)[0].trim() || "Product",
      category: q.product_type || "Automation",
      qty: Number(it.qty || 1),
      selling_price: Number(it.price || 0),
      manufacturing_cost: 0,
      installation_cost: 0,
      other_cost: 0,
    }));
    if (qItems.length > 0) setOrdItems(qItems);
  };

  const handleSelectManualClient = (cId: string) => {
    setOrdClientId(cId);
    const c = clients.find((x) => x.id === cId);
    if (!c) return;
    setOrdClientName(c.name || "");
    setOrdClientContact(c.contact || "");
    setOrdClientEmail(c.email || "");
    setOrdClientGstin(c.gstin || "");
    setOrdClientAddress(c.address || "");
    setOrdClientState(c.place_of_supply || "27-Maharashtra");
  };

  const orderPreviewTotals = useMemo(() => {
    const basic = ordItems.reduce((s, it) => s + Number(it.qty || 0) * Number(it.selling_price || 0), 0);
    const cost = ordItems.reduce(
      (s, it) => s + Number(it.manufacturing_cost || 0) + Number(it.installation_cost || 0) + Number(it.other_cost || 0),
      0
    );
    const gst = Number(((basic * Number(ordGstRate || 0)) / 100).toFixed(2));
    const total = Number((basic + gst).toFixed(2));
    const profit = Number((basic - cost).toFixed(2));
    return { basic, cost, gst, total, profit };
  }, [ordItems, ordGstRate]);

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordClientName.trim() || !ordProjectName.trim()) {
      setNotice({ type: "err", text: "Client Name and Project Name are required." });
      return;
    }
    setSavingOrder(true);
    setNotice(null);
    try {
      const payload = {
        id: editingOrderId || undefined,
        client_id: ordClientId || null,
        client_name: ordClientName.trim(),
        quotation_no: ordQuotationNo.trim() || null,
        quotation_snapshot: selectedQuoteSnapshot || null,
        order_date: ordDate,
        project_name: ordProjectName.trim(),
        project_description: ordProjectDesc.trim() || null,
        customer_po_no: ordCustPoNo.trim() || null,
        customer_po_date: ordCustPoDate || null,
        payment_due_date: ordDueDate || null,
        completion_date: ordCompletionDate || null,
        order_status: ordStatus,
        remarks: ordRemarks.trim() || null,
        basic_value: orderPreviewTotals.basic,
        gst_rate: Number(ordGstRate || 0),
        pi_number: ordPiNo.trim() || null,
        tax_invoice_number: ordTiNo.trim() || null,
        invoice_status: ordInvoiceStatus,
        items: ordItems,
        maintenance: maintRequired
          ? {
              required: true,
              maintenance_type: maintType,
              start_date: maintStart || null,
              end_date: maintEnd || null,
              revenue: Number(maintRevenue || 0),
              cost: Number(maintCost || 0),
            }
          : { required: false },
      };

      const res = await fetch("/api/finance/orders", {
        method: editingOrderId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to save order." });
        return;
      }
      setNotice({
        type: "ok",
        text: editingOrderId ? "Order updated." : `Confirmed order ${json.order_no || ""} created.`,
      });
      setOrderModalOpen(false);
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Network error saving order." });
    } finally {
      setSavingOrder(false);
    }
  };

  const handleQuickOrderStatus = async (orderId: string, nextStatus: string) => {
    setNotice(null);
    try {
      const res = await fetch("/api/finance/orders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          order_status: nextStatus,
          completion_date: nextStatus === "Completed" ? getCurrentBusinessDate() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Status update failed." });
        return;
      }
      setNotice({ type: "ok", text: `Order marked ${nextStatus}.` });
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to update order status." });
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
          order_id: payOrderId,
          amount: Number(payAmount),
          payment_date: payDate,
          payment_mode: payMode,
          payment_type: payType,
          account_id: payAccountId || "acc_bank_main",
          transaction_ref: payRef.trim() || null,
          notes: payNotes.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to record payment." });
        return;
      }
      setNotice({ type: "ok", text: "Customer payment recorded and ledger updated." });
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Network error recording payment." });
    }
  };

  const handleReversePayment = async (paymentId: string) => {
    setNotice(null);
    try {
      const res = await fetch("/api/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reverse", payment_id: paymentId, reason: "Authorized payment reversal" }),
      });
      if (res.ok) {
        setNotice({ type: "ok", text: "Payment reversed with audit entry." });
        await loadFinanceData();
      }
    } catch {
      // ignore
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    setNotice(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: claimId, action: "approve" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Approval failed." });
        return;
      }
      setNotice({ type: "ok", text: "Expense approved and posted." });
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to approve expense." });
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
        setNotice({ type: "err", text: json.error || "Rejection failed." });
        return;
      }
      setNotice({ type: "ok", text: "Expense rejected and employee notified." });
      setRejectModalClaim(null);
      setRejectReason("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to reject expense." });
    }
  };

  const handleReimburseClaim = async () => {
    if (!reimburseModalClaim) return;
    setNotice(null);
    const amt = Number(reimbAmount || reimburseModalClaim.approved_amount || reimburseModalClaim.amount);
    try {
      const res = await fetch("/api/expenses/reimbursements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claim_id: reimburseModalClaim.id,
          amount: amt,
          account_id: reimbAccountId || "acc_bank_main",
          payment_mode: reimbMode,
          reference_no: reimbRef.trim() || null,
          payment_date: reimbDate,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Reimbursement failed." });
        return;
      }
      setNotice({ type: "ok", text: "Reimbursement recorded and employee notified." });
      setReimburseModalClaim(null);
      setReimbRef("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to process reimbursement." });
    }
  };

  const handleDirectExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directExpTitle.trim() || !directExpAmount) return;
    setNotice(null);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: directExpTitle.trim(),
          paid_to: directExpPaidTo.trim() || "Company Vendor",
          amount: Number(directExpAmount),
          category_name: directExpCatName || "Other",
          expense_date: directExpDate,
          payment_mode: "Bank Transfer",
          paid_by: "Company",
          ownerDirectPost: currentUser?.role === "Admin",
          isCompanyDirect: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to add expense." });
        return;
      }
      setNotice({ type: "ok", text: "Company expense recorded." });
      setDirectExpTitle("");
      setDirectExpPaidTo("");
      setDirectExpAmount("");
      await loadFinanceData();
    } catch {
      setNotice({ type: "err", text: "Failed to record company expense." });
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return;
    const res = await fetch("/api/finance/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_account",
        name: newAccName.trim(),
        account_type: newAccType,
        opening_balance: Number(newAccOpening || 0),
      }),
    });
    if (res.ok) {
      setNotice({ type: "ok", text: "Account created." });
      setNewAccName("");
      setNewAccOpening("0");
      await loadFinanceData();
    }
  };

  const handleRecordTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || !txAccountId) return;
    const res = await fetch("/api/finance/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tx_type: txType,
        account_id: txAccountId,
        amount: Number(txAmount),
        tx_date: txDate,
        description: txDesc.trim() || txType,
        category: txType,
      }),
    });
    if (res.ok) {
      setNotice({ type: "ok", text: "Ledger transaction recorded." });
      setTxAmount("");
      setTxDesc("");
      await loadFinanceData();
    }
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const res = await fetch("/api/employees", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingEmployee.id,
        designation: empDesignation,
        department: empDepartment,
        mobile: empMobile,
        employment_status: empStatus,
      }),
    });
    if (res.ok) {
      setNotice({ type: "ok", text: `Updated ${editingEmployee.full_name}.` });
      setEditingEmployee(null);
      await loadFinanceData();
    }
  };

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    const list = orders.filter((o) => {
      if (orderStatusFilter !== "ALL" && o.order_status !== orderStatusFilter) return false;
      if (paymentStatusFilter !== "ALL" && o.payment_status !== paymentStatusFilter) return false;
      if (q) {
        const hay = `${o.order_no} ${o.client_name} ${o.project_name} ${o.quotation_no || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    return [...list].sort((a, b) => {
      if (orderSort === "date_asc") return String(a.order_date).localeCompare(String(b.order_date));
      if (orderSort === "value_desc") return Number(b.total_order_value || 0) - Number(a.total_order_value || 0);
      if (orderSort === "outstanding_desc") return Number(b.outstanding_amount || 0) - Number(a.outstanding_amount || 0);
      return String(b.order_date).localeCompare(String(a.order_date));
    });
  }, [orders, orderSearch, orderStatusFilter, paymentStatusFilter, orderSort]);

  const totalOrderPages = Math.max(1, Math.ceil(filteredOrders.length / orderPageSize));
  const pagedOrders = filteredOrders.slice((orderPage - 1) * orderPageSize, orderPage * orderPageSize);

  const selectedPayOrder = orders.find((o) => o.id === payOrderId);

  const filteredClaims = useMemo(() => {
    const q = expenseSearch.trim().toLowerCase();
    return claims.filter((c) => {
      if (expenseFilter !== "ALL" && c.status !== expenseFilter) return false;
      if (q) {
        const hay = `${c.claim_no} ${c.description || ""} ${c.paid_to || ""} ${c.category_name || ""} ${c.emp_name || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [claims, expenseFilter, expenseSearch]);

  const pendingReimburseClaims = claims.filter(
    (c) => c.status === "Approved" && c.paid_by === "Self" && c.reimbursement_status !== "Reimbursed"
  );

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
  const monthlySeries = dash?.monthlySeries || [];
  const expenseByCategory = dash?.expenseByCategory || [];
  const maxMonthVal = Math.max(1, ...monthlySeries.map((x: any) => Math.max(Number(x.turnover || 0), Number(x.expenses || 0))));

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Compact Page Heading + Global FY Selector */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 ${borderCol}`}>
        <div>
          <h2 className={`text-[22px] font-semibold tracking-tight ${textHeader}`}>
            Finance &amp; Operations
          </h2>
          <p className={`text-[13px] mt-0.5 ${textMuted}`}>
            Confirmed orders, receivables, project costing, expenses and financial reporting &bull; {formatFYLabel(selectedFY)}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 border rounded-md px-2.5 h-9 text-[13px] ${subCardBg} ${textHeader}`}>
            <Calendar className={`w-3.5 h-3.5 ${textMuted}`} />
            <select
              aria-label="Finance Financial Year"
              value={selectedFY}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setOrderPage(1);
              }}
              className="bg-transparent text-[13px] focus:outline-none cursor-pointer"
            >
              {availableFYs.map((fy) => (
                <option key={fy} value={fy} className={isDark ? "bg-[#17181B] text-[#F4F4F5]" : "bg-white text-[#18181B]"}>
                  {fy === currentFY ? `${formatFYLabel(fy)} (Current)` : formatFYLabel(fy)}
                </option>
              ))}
              <option value="ALL" className={isDark ? "bg-[#17181B] text-[#F4F4F5]" : "bg-white text-[#18181B]"}>
                All Financial Years
              </option>
            </select>
          </div>
          {selectedFY !== currentFY && (
            <button
              onClick={resetToCurrentFY}
              className={`h-9 px-3 rounded-md border text-[12px] font-medium cursor-pointer ${subCardBg} ${textHeader}`}
            >
              Reset FY
            </button>
          )}
          <button
            onClick={loadFinanceData}
            className={`h-9 w-9 flex items-center justify-center rounded-md border cursor-pointer ${subCardBg} ${textMuted}`}
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
            className={`h-8 px-3 rounded-md text-[13px] font-medium whitespace-nowrap transition-colors duration-150 cursor-pointer flex items-center gap-1.5 ${
              activeTab === t.id
                ? "bg-amber-500 text-zinc-950"
                : `${subCardBg} border ${textMuted} hover:${textHeader}`
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {loadError && (
        <div className="p-3 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-400 text-[13px] flex items-center justify-between">
          <span>{loadError}</span>
          <button onClick={loadFinanceData} className="underline cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {notice && (
        <div
          className={`p-3 rounded-md border text-[13px] flex items-center justify-between ${
            notice.type === "ok"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
              : "bg-rose-500/10 border-rose-500/30 text-rose-500"
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} className="text-[12px] underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* 1. FINANCIAL DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg border ${cardBg}`}>
              <p className={`text-[12px] font-medium ${textMuted}`}>Basic Turnover (Excl. GST)</p>
              <p className={`text-[22px] font-semibold tabular-nums mt-1 ${textHeader}`}>{inr.format(k.basicTurnover || 0)}</p>
              <p className={`text-[11px] mt-1 tabular-nums ${textMuted}`}>
                GST Incl: {inr.format(k.gstInclusiveValue || 0)} &bull; {k.convertedOrders || 0} Orders
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${cardBg}`}>
              <p className={`text-[12px] font-medium ${textMuted}`}>Customer Received</p>
              <p className={`text-[22px] font-semibold tabular-nums mt-1 ${textHeader}`}>{inr.format(k.customerReceived || 0)}</p>
              <p className={`text-[11px] mt-1 tabular-nums ${textMuted}`}>
                Outstanding:{" "}
                <span className={(k.selectedFYOutstanding || 0) > 0 ? "text-rose-500 font-medium" : ""}>
                  {inr.format(k.selectedFYOutstanding || 0)}
                </span>
              </p>
            </div>
            <div className={`p-4 rounded-lg border ${cardBg}`}>
              <p className={`text-[12px] font-medium ${textMuted}`}>Gross Profit</p>
              <p className={`text-[22px] font-semibold tabular-nums mt-1 ${(k.grossProfit || 0) < 0 ? "text-rose-500" : textHeader}`}>
                {inr.format(k.grossProfit || 0)}
              </p>
              <p className={`text-[11px] mt-1 tabular-nums ${textMuted}`}>Direct Costs: {inr.format(k.directProjectCosts || 0)}</p>
            </div>
            <div className={`p-4 rounded-lg border ${cardBg}`}>
              <p className={`text-[12px] font-medium ${textMuted}`}>Net Profit</p>
              <p className={`text-[22px] font-semibold tabular-nums mt-1 ${(k.netProfit || 0) < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                {inr.format(k.netProfit || 0)}
              </p>
              <p className={`text-[11px] mt-1 tabular-nums ${textMuted}`}>
                Approved Expenses: {inr.format(k.operatingExpenses || 0)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Monthly Turnover vs Expenses Chart */}
            <div className={`lg:col-span-2 p-5 rounded-lg border ${cardBg} space-y-4`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className={`text-[15px] font-semibold ${textHeader}`}>Monthly Turnover vs Approved Expenses</h3>
                  <p className={`text-[12px] ${textMuted}`}>Indian Financial Year (Apr &ndash; Mar)</p>
                </div>
                <div className="text-right">
                  <span className={`text-[11px] block ${textMuted}`}>Recorded Net Cash Movement (Unreconciled)</span>
                  <span className={`text-[13px] font-semibold tabular-nums ${textHeader}`}>{inr.format(k.cashBalance || 0)}</span>
                </div>
              </div>
              {monthlySeries.length === 0 ? (
                <p className={`text-[13px] py-12 text-center ${textMuted}`}>No monthly activity in {formatFYLabel(selectedFY)}.</p>
              ) : (
                <div className={`h-44 flex items-end justify-between gap-2 border-b ${borderCol} pb-2`}>
                  {monthlySeries.map((m: any) => {
                    const tVal = Number(m.turnover || 0);
                    const eVal = Number(m.expenses || 0);
                    const hTurn = Math.min(100, Math.round((tVal / maxMonthVal) * 100));
                    const hExp = Math.min(100, Math.round((eVal / maxMonthVal) * 100));
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                        <div className="w-full flex items-end justify-center gap-1 h-full">
                          <div
                            style={{ height: `${tVal > 0 ? Math.max(6, hTurn) : 2}%` }}
                            className="w-1/2 max-w-[18px] bg-emerald-600/85 rounded-t-sm"
                            title={`${m.month} Turnover: ${inr.format(tVal)}`}
                          />
                          <div
                            style={{ height: `${eVal > 0 ? Math.max(6, hExp) : 2}%` }}
                            className="w-1/2 max-w-[18px] bg-amber-500/85 rounded-t-sm"
                            title={`${m.month} Expenses: ${inr.format(eVal)}`}
                          />
                        </div>
                        <span className={`text-[11px] tabular-nums ${textMuted}`}>{m.month}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={`flex items-center gap-4 text-[11px] ${textMuted}`}>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600/85 inline-block" /> Turnover (Excl. GST)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/85 inline-block" /> Approved Expenses
                </span>
              </div>
            </div>

            {/* Expense Category Breakdown */}
            <div className={`p-5 rounded-lg border ${cardBg} space-y-3`}>
              <h3 className={`text-[15px] font-semibold ${textHeader}`}>Expense Breakdown</h3>
              {expenseByCategory.length === 0 ? (
                <p className={`text-[13px] py-8 text-center ${textMuted}`}>No approved expenses in {formatFYLabel(selectedFY)}.</p>
              ) : (
                <div className="space-y-2.5">
                  {expenseByCategory.slice(0, 8).map((cat: any) => (
                    <div key={cat.category} className="flex items-center justify-between text-[13px]">
                      <span className={textHeader}>
                        {cat.category} <span className={`text-[11px] ${textMuted}`}>({cat.count})</span>
                      </span>
                      <span className={`font-medium tabular-nums ${textHeader}`}>{inr.format(cat.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. ORDERS WORKSPACE */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${cardBg} flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
            <div className="flex items-center gap-2 flex-wrap flex-1">
              <div className="relative min-w-[200px] flex-1 max-w-xs">
                <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${textMuted}`} />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => {
                    setOrderSearch(e.target.value);
                    setOrderPage(1);
                  }}
                  placeholder="Search order no, client, project..."
                  className={`w-full h-9 pl-8 pr-3 rounded-md border text-[13px] ${inputCls}`}
                />
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => {
                  setOrderStatusFilter(e.target.value);
                  setOrderPage(1);
                }}
                className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}
              >
                <option value="ALL">All Order Statuses</option>
                <option value="Confirmed">Confirmed</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Financially Closed">Financially Closed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setOrderPage(1);
                }}
                className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}
              >
                <option value="ALL">All Payment Statuses</option>
                <option value="Pending Payment">Pending Payment</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Fully Paid">Fully Paid</option>
                <option value="Financially Closed">Financially Closed</option>
              </select>
              <select
                value={orderSort}
                onChange={(e) => setOrderSort(e.target.value as any)}
                className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="value_desc">Highest Value</option>
                <option value="outstanding_desc">Highest Outstanding</option>
              </select>
            </div>

            <button
              onClick={() => openNewOrderModal("quotation")}
              className="h-9 px-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[13px] font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Order</span>
            </button>
          </div>

          <div className={`rounded-lg border ${cardBg} overflow-x-auto`}>
            <table className="w-full text-[13px] text-left">
              <thead className={`border-b ${borderCol} ${subCardBg} ${textMuted} text-[12px] font-medium sticky top-0`}>
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Order No</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Order Date</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Client</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Project</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Basic Value</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Total Value</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Received</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Outstanding</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Gross Profit</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Order Status</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Payment Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderCol}`}>
                {pagedOrders.map((o) => (
                  <tr key={o.id} className={isDark ? "hover:bg-[#1D1F23]" : "hover:bg-[#F7F8FA]"}>
                    <td className="py-2.5 px-3 font-mono text-[12px] font-medium whitespace-nowrap" title={o.legacy_ref ? `Legacy: ${o.legacy_ref}` : o.order_no}>
                      {o.order_no}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">{String(o.order_date || "").slice(0, 10)}</td>
                    <td className="py-2.5 px-3 font-medium max-w-[180px] truncate" title={o.client_name}>{o.client_name}</td>
                    <td className="py-2.5 px-3 max-w-[200px] truncate" title={o.project_name}>{o.project_name}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inr.format(o.basic_value || 0)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{inr.format(o.total_order_value || 0)}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap text-emerald-500">{inr.format(o.received_amount || 0)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${Number(o.outstanding_amount || 0) > 0 ? "text-rose-500 font-medium" : ""}`}>
                      {inr.format(o.outstanding_amount || 0)}
                    </td>
                    <td className={`py-2.5 px-3 text-right tabular-nums whitespace-nowrap ${Number(o.gross_profit || 0) < 0 ? "text-rose-500" : ""}`}>
                      {inr.format(o.gross_profit || 0)}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-[12px]">{o.order_status}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap text-[12px]">{o.payment_status}</td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => openEditOrderModal(o)}
                          className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${subCardBg}`}
                          title="View / Edit Order & Costs"
                        >
                          Edit
                        </button>
                        {Number(o.outstanding_amount || 0) > 0 && (
                          <button
                            onClick={() => {
                              setPayOrderId(o.id);
                              setPayAmount(String(o.outstanding_amount || ""));
                              setActiveTab("payments");
                            }}
                            className="px-2 py-1 rounded border border-amber-500/40 text-amber-500 text-[11px] cursor-pointer"
                          >
                            Pay
                          </button>
                        )}
                        {o.order_status !== "Completed" && o.order_status !== "Financially Closed" && (
                          <button
                            onClick={() => handleQuickOrderStatus(o.id, "Completed")}
                            className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${subCardBg}`}
                          >
                            Complete
                          </button>
                        )}
                        {o.order_status === "Completed" && Number(o.outstanding_amount || 0) <= 0.01 && (
                          <button
                            onClick={() => handleQuickOrderStatus(o.id, "Financially Closed")}
                            className="px-2 py-1 rounded border border-emerald-500/40 text-emerald-500 text-[11px] cursor-pointer"
                          >
                            Close
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {pagedOrders.length === 0 && (
                  <tr>
                    <td colSpan={12} className={`py-8 text-center ${textMuted}`}>
                      No confirmed orders match the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {totalOrderPages > 1 && (
              <div className={`px-4 py-2.5 border-t ${borderCol} flex items-center justify-between text-[12px] ${textMuted}`}>
                <span>
                  Page {orderPage} of {totalOrderPages} ({filteredOrders.length} orders)
                </span>
                <div className="flex gap-2">
                  <button disabled={orderPage <= 1} onClick={() => setOrderPage((p) => p - 1)} className="px-2 py-1 border rounded cursor-pointer disabled:opacity-40">
                    Prev
                  </button>
                  <button disabled={orderPage >= totalOrderPages} onClick={() => setOrderPage((p) => p + 1)} className="px-2 py-1 border rounded cursor-pointer disabled:opacity-40">
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. CUSTOMER PAYMENTS */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <form onSubmit={handleRecordPayment} className={`p-4 rounded-lg border ${cardBg} space-y-3`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-[15px] font-semibold ${textHeader}`}>Record Payment</h3>
              {selectedPayOrder && (
                <div className={`text-[12px] tabular-nums ${textMuted}`}>
                  Client: <strong className={textHeader}>{selectedPayOrder.client_name}</strong> &bull; Total:{" "}
                  {inr.format(selectedPayOrder.total_order_value)} &bull; Received:{" "}
                  {inr.format(selectedPayOrder.received_amount)} &bull;{" "}
                  <span className="text-rose-500 font-medium">
                    Outstanding: {inr.format(selectedPayOrder.outstanding_amount)}
                  </span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
              <div className="lg:col-span-2">
                <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Order *</label>
                <select value={payOrderId} onChange={(e) => setPayOrderId(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                  <option value="">Select order...</option>
                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.order_no} — {o.client_name} (Bal: {inr.format(o.outstanding_amount || 0)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Payment Date *</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Amount (₹) *</label>
                <input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] tabular-nums ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Mode &amp; Account</label>
                <div className="flex gap-1.5">
                  <select value={payMode} onChange={(e) => setPayMode(e.target.value)} className={`w-1/2 h-9 px-2 rounded-md border text-[12px] ${inputCls}`}>
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                  </select>
                  <select value={payAccountId} onChange={(e) => setPayAccountId(e.target.value)} className={`w-1/2 h-9 px-2 rounded-md border text-[12px] ${inputCls}`}>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <input type="text" value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="UTR / Ref" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                <button type="submit" className="h-9 px-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[13px] font-medium whitespace-nowrap cursor-pointer">
                  Save
                </button>
              </div>
            </div>
          </form>

          <div className={`rounded-lg border ${cardBg} overflow-x-auto`}>
            <table className="w-full text-[13px] text-left">
              <thead className={`border-b ${borderCol} ${subCardBg} ${textMuted} text-[12px] font-medium`}>
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Order No</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Reference</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderCol}`}>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 whitespace-nowrap tabular-nums">
                      {p.payment_date ? String(p.payment_date).slice(0, 10) : <span className="text-amber-500 text-[11px]">Date Missing (Historical)</span>}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[12px]">{p.order_no}</td>
                    <td className="py-2.5 px-3">{p.client_name}</td>
                    <td className="py-2.5 px-3 text-[12px]">{p.payment_type}</td>
                    <td className="py-2.5 px-3 text-[12px]">{p.payment_mode}</td>
                    <td className="py-2.5 px-3 font-mono text-[12px]">{p.transaction_ref || "-"}</td>
                    <td className="py-2.5 px-3 text-[12px]">{p.status}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${Number(p.amount) < 0 ? "text-rose-500" : "text-emerald-500"}`}>
                      {inr.format(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {p.status === "Posted" && Number(p.amount) > 0 && (
                        <button
                          onClick={() => handleReversePayment(p.id)}
                          className="text-[11px] text-rose-500 hover:underline cursor-pointer"
                        >
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`py-8 text-center ${textMuted}`}>
                      No customer payments recorded in {formatFYLabel(selectedFY)}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. EXPENSE MANAGEMENT & APPROVALS */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          <form onSubmit={handleDirectExpense} className={`p-4 rounded-lg border ${cardBg} grid grid-cols-1 sm:grid-cols-6 gap-2.5 items-end`}>
            <div className="sm:col-span-2">
              <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Direct Company Expense Purpose *</label>
              <input type="text" value={directExpTitle} onChange={(e) => setDirectExpTitle(e.target.value)} placeholder="e.g. Workshop Electricity" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Paid To</label>
              <input type="text" value={directExpPaidTo} onChange={(e) => setDirectExpPaidTo(e.target.value)} placeholder="Vendor / Payee" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            </div>
            <div>
              <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Category</label>
              <select value={directExpCatName} onChange={(e) => setDirectExpCatName(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={`block text-[12px] font-medium mb-1 ${textMuted}`}>Amount (₹) *</label>
              <input type="number" step="0.01" value={directExpAmount} onChange={(e) => setDirectExpAmount(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] tabular-nums ${inputCls}`} />
            </div>
            <button type="submit" className="h-9 px-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[13px] font-medium cursor-pointer flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </button>
          </form>

          <div className={`p-4 rounded-lg border ${cardBg} space-y-3`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className={`text-[15px] font-semibold ${textHeader}`}>Expense Register ({filteredClaims.length})</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search claim, payee, category..."
                  className={`h-8 px-2.5 rounded-md border text-[12px] ${inputCls}`}
                />
                <select value={expenseFilter} onChange={(e) => setExpenseFilter(e.target.value)} className={`h-8 px-2.5 rounded-md border text-[12px] ${inputCls}`}>
                  <option value="ALL">All Statuses</option>
                  <option value="Submitted">Pending Approval (Submitted)</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className={`border-b ${borderCol} ${subCardBg} ${textMuted} text-[12px] font-medium`}>
                  <tr>
                    <th className="py-2 px-3">Claim No</th>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Employee / Source</th>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Paid To &amp; Purpose</th>
                    <th className="py-2 px-3">Paid By</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderCol}`}>
                  {filteredClaims.map((c) => (
                    <tr key={c.id}>
                      <td className="py-2 px-3 font-mono text-[12px] whitespace-nowrap">{c.claim_no}</td>
                      <td className="py-2 px-3 whitespace-nowrap tabular-nums">{String(c.expense_date || "").slice(0, 10)}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{c.emp_name || (c.is_historical ? "Historical" : "Company")}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{c.category_name}</td>
                      <td className="py-2 px-3 max-w-[260px] truncate" title={`${c.paid_to} — ${c.description}`}>
                        {c.paid_to} &bull; {c.description}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap text-[12px]">{c.paid_by}</td>
                      <td className="py-2 px-3 whitespace-nowrap text-[12px]">
                        {c.status}
                        {c.zero_amount_flag && <span className={`ml-1 text-[10px] ${textMuted}`}>(Zero Flag)</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums whitespace-nowrap">{inr.format(c.amount)}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {c.receipt_url && (
                            <button onClick={() => setPreviewReceipt(c.receipt_url)} className="text-[11px] px-2 py-1 border rounded cursor-pointer">
                              Receipt
                            </button>
                          )}
                          {canApprove && c.status === "Submitted" && (
                            <>
                              <button onClick={() => handleApproveClaim(c.id)} className="text-[11px] px-2 py-1 rounded border border-emerald-500/40 text-emerald-500 cursor-pointer">
                                Approve
                              </button>
                              <button onClick={() => setRejectModalClaim(c)} className="text-[11px] px-2 py-1 rounded border border-rose-500/40 text-rose-500 cursor-pointer">
                                Reject
                              </button>
                            </>
                          )}
                          {canReimburse && c.status === "Approved" && c.paid_by === "Self" && c.reimbursement_status !== "Reimbursed" && (
                            <button
                              onClick={() => {
                                setReimburseModalClaim(c);
                                setReimbAmount(String(Number(c.approved_amount ?? c.amount) - Number(c.reimbursed_amount || 0)));
                              }}
                              className="text-[11px] px-2 py-1 rounded border border-amber-500/40 text-amber-500 cursor-pointer"
                            >
                              Reimburse
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
      )}

      {/* 5. REIMBURSEMENTS */}
      {activeTab === "reimbursements" && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border ${cardBg} space-y-3`}>
            <h3 className={`text-[15px] font-semibold ${textHeader}`}>
              Pending Employee Reimbursements ({pendingReimburseClaims.length})
            </h3>
            {pendingReimburseClaims.length === 0 ? (
              <p className={`text-[13px] ${textMuted}`}>No approved self-paid claims pending reimbursement.</p>
            ) : (
              <div className="space-y-2">
                {pendingReimburseClaims.map((c) => {
                  const remaining = Math.max(0, Number(c.approved_amount ?? c.amount) - Number(c.reimbursed_amount || 0));
                  return (
                    <div key={c.id} className={`p-3 rounded-md border ${subCardBg} flex items-center justify-between gap-3`}>
                      <div>
                        <p className={`text-[13px] font-medium ${textHeader}`}>
                          {c.claim_no} &bull; {c.emp_name || "Employee"} &mdash; {c.description}
                        </p>
                        <p className={`text-[12px] ${textMuted}`}>{String(c.expense_date || "").slice(0, 10)} &bull; {c.category_name}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-semibold">{inr.format(remaining)}</span>
                        {canReimburse && (
                          <button
                            onClick={() => {
                              setReimburseModalClaim(c);
                              setReimbAmount(String(remaining));
                            }}
                            className="h-8 px-3 rounded-md bg-amber-500 text-zinc-950 text-[12px] font-medium cursor-pointer"
                          >
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`p-4 rounded-lg border ${cardBg} overflow-x-auto`}>
            <h3 className={`text-[15px] font-semibold mb-3 ${textHeader}`}>Reimbursement History</h3>
            <table className="w-full text-[13px] text-left">
              <thead className={`border-b ${borderCol} ${textMuted} text-[12px] font-medium`}>
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Claim</th>
                  <th className="py-2 pr-3">Employee</th>
                  <th className="py-2 pr-3">Mode</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderCol}`}>
                {reimbursements.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 tabular-nums">{String(r.payment_date || "").slice(0, 10)}</td>
                    <td className="py-2 pr-3 font-mono text-[12px]">{r.claim_no || r.claim_id}</td>
                    <td className="py-2 pr-3">{r.emp_name || "-"}</td>
                    <td className="py-2 pr-3">{r.payment_mode}</td>
                    <td className="py-2 pr-3 font-mono text-[12px]">{r.reference_no || "-"}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-emerald-500">{inr.format(r.amount)}</td>
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
          <div className={`p-3 rounded-md border ${subCardBg} text-[12px] ${textMuted}`}>
            Note: Balances reflect recorded opening balances and posted ERP ledger entries (Recorded Net Cash Movement). Reconcile opening bank statements before treating as final bank balance.
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {accounts.map((a) => (
              <div key={a.id} className={`p-4 rounded-lg border ${cardBg}`}>
                <p className={`text-[12px] ${textMuted}`}>{a.account_type}</p>
                <p className={`text-[14px] font-semibold mt-0.5 ${textHeader}`}>{a.name}</p>
                <p className={`text-[18px] font-semibold tabular-nums mt-2 ${textHeader}`}>
                  Opening: {inr.format(a.opening_balance || 0)}
                </p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <form onSubmit={handleCreateAccount} className={`p-4 rounded-lg border ${cardBg} space-y-3`}>
              <h3 className={`text-[14px] font-semibold ${textHeader}`}>Add Bank / Cash Account</h3>
              <div className="grid grid-cols-3 gap-2">
                <input type="text" value={newAccName} onChange={(e) => setNewAccName(e.target.value)} placeholder="Account Name" className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                <select value={newAccType} onChange={(e) => setNewAccType(e.target.value)} className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                  <option value="Bank">Bank</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                </select>
                <input type="number" value={newAccOpening} onChange={(e) => setNewAccOpening(e.target.value)} placeholder="Opening ₹" className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              </div>
              <button type="submit" className="h-9 px-3.5 rounded-md bg-amber-500 text-zinc-950 text-[13px] font-medium cursor-pointer">
                Create Account
              </button>
            </form>

            <form onSubmit={handleRecordTx} className={`p-4 rounded-lg border ${cardBg} space-y-3`}>
              <h3 className={`text-[14px] font-semibold flex items-center gap-1.5 ${textHeader}`}>
                <ArrowRightLeft className="w-4 h-4" />
                <span>Record Income / Ledger Entry</span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <select value={txType} onChange={(e) => setTxType(e.target.value)} className={`h-9 px-2 rounded-md border text-[12px] ${inputCls}`}>
                  <option value="Income">Other Income</option>
                  <option value="Expense">Direct Expense</option>
                  <option value="Supplier Payment">Supplier Payment</option>
                  <option value="Refund">Refund</option>
                </select>
                <select value={txAccountId} onChange={(e) => setTxAccountId(e.target.value)} className={`h-9 px-2 rounded-md border text-[12px] ${inputCls}`}>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="number" step="0.01" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} placeholder="Amount ₹" className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                <input type="text" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} placeholder="Description" className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              </div>
              <button type="submit" className="h-9 px-3.5 rounded-md bg-amber-500 text-zinc-950 text-[13px] font-medium cursor-pointer">
                Post Entry
              </button>
            </form>
          </div>

          <div className={`p-4 rounded-lg border ${cardBg} overflow-x-auto`}>
            <h3 className={`text-[15px] font-semibold mb-3 ${textHeader}`}>Cash Flow Ledger ({transactions.length})</h3>
            <table className="w-full text-[13px] text-left">
              <thead className={`border-b ${borderCol} ${textMuted} text-[12px] font-medium`}>
                <tr>
                  <th className="py-2 pr-3">TX No</th>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Description</th>
                  <th className="py-2 pr-3">Account</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${borderCol}`}>
                {transactions.slice(0, 60).map((t) => (
                  <tr key={t.id}>
                    <td className="py-2 pr-3 font-mono text-[12px]">{t.tx_no}</td>
                    <td className="py-2 pr-3 tabular-nums">{String(t.tx_date || "").slice(0, 10)}</td>
                    <td className="py-2 pr-3">{t.tx_type}</td>
                    <td className="py-2 pr-3">{t.description}</td>
                    <td className="py-2 pr-3">{t.account_name || "-"}</td>
                    <td className={`py-2 text-right tabular-nums font-medium ${t.tx_type === "Customer Receipt" || t.tx_type === "Income" ? "text-emerald-500" : "text-rose-500"}`}>
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
        <div className={`p-4 rounded-lg border ${cardBg} space-y-4`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className={`text-[15px] font-semibold ${textHeader}`}>Employee Directory ({employees.length})</h3>
              <p className={`text-[12px] ${textMuted}`}>
                Employees reuse the secure ERP account and permission workflow with permanent YYYY-YY-AIA_NNNN IDs.
              </p>
            </div>
            {onOpenAddEmployee && (
              <button
                onClick={onOpenAddEmployee}
                className="h-9 px-3.5 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Add Employee</span>
              </button>
            )}
          </div>

          {employees.length === 0 ? (
            <div className={`py-8 text-center border rounded-md ${subCardBg}`}>
              <p className={`text-[13px] ${textMuted}`}>No employees registered yet.</p>
              {onOpenAddEmployee && (
                <button
                  onClick={onOpenAddEmployee}
                  className="mt-3 h-8 px-3 rounded-md bg-amber-500 text-zinc-950 text-[12px] font-medium cursor-pointer"
                >
                  Add Employee
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className={`border-b ${borderCol} ${textMuted} text-[12px] font-medium`}>
                  <tr>
                    <th className="py-2 pr-3">Employee ID</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2 pr-3">Designation</th>
                    <th className="py-2 pr-3">Department</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderCol}`}>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="py-2.5 pr-3 font-mono text-[12px] font-medium">{emp.employee_id}</td>
                      <td className="py-2.5 pr-3 font-medium">{emp.full_name}</td>
                      <td className="py-2.5 pr-3">{emp.email}</td>
                      <td className="py-2.5 pr-3">{emp.role}</td>
                      <td className="py-2.5 pr-3">{emp.designation || "-"}</td>
                      <td className="py-2.5 pr-3">{emp.department || "-"}</td>
                      <td className="py-2.5 pr-3">{emp.employment_status || emp.account_status}</td>
                      <td className="py-2.5 text-right">
                        <button
                          onClick={() => {
                            setEditingEmployee(emp);
                            setEmpDesignation(emp.designation || "");
                            setEmpDepartment(emp.department || "");
                            setEmpMobile(emp.mobile || "");
                            setEmpStatus(emp.employment_status || "Active");
                          }}
                          className={`px-2 py-1 rounded border text-[11px] cursor-pointer ${subCardBg}`}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 8. FINANCIAL REPORTS */}
      {activeTab === "reports" && (
        <div className={`p-4 rounded-lg border ${cardBg} space-y-4`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className={`h-9 px-3 rounded-md border text-[13px] ${inputCls}`}>
                <option value="order_register">Order Register</option>
                <option value="client_history">Client-Wise Orders</option>
                <option value="receivables">Outstanding Receivables</option>
                <option value="profitability">Order-Wise Profit</option>
                <option value="expenses">Expense Report</option>
                <option value="cash_flow">Cash Flow Ledger</option>
              </select>
              <button onClick={loadReport} className={`h-9 px-3 rounded-md border text-[13px] font-medium cursor-pointer ${subCardBg}`}>
                Run Report
              </button>
            </div>
            {canExport && (
              <a
                href={`/api/finance/reports?type=${encodeURIComponent(reportType)}&fy=${encodeURIComponent(selectedFY)}&format=csv`}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-md bg-amber-500 text-zinc-950 text-[13px] font-medium"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </a>
            )}
          </div>

          {reportData && (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] text-left">
                <thead className={`border-b ${borderCol} ${textMuted} text-[12px] font-medium`}>
                  <tr>
                    {reportData.headers.map((h) => (
                      <th key={h} className="py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className={`divide-y ${borderCol}`}>
                  {reportData.rows.map((r, i) => (
                    <tr key={i}>
                      {reportData.keys.map((key) => (
                        <td key={key} className="py-2 pr-3 whitespace-nowrap tabular-nums">
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

      {/* ADD / EDIT ORDER MODAL */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className={`border rounded-lg max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 space-y-4 ${cardBg}`}>
            <div className={`flex items-center justify-between border-b pb-3 ${borderCol}`}>
              <h3 className={`text-[16px] font-semibold ${textHeader}`}>
                {editingOrderId ? "Edit Confirmed Order & Project Costs" : "Add Confirmed Business Order"}
              </h3>
              <button onClick={() => setOrderModalOpen(false)} className={`p-1 cursor-pointer ${textMuted}`}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {!editingOrderId && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOrderMode("quotation")}
                  className={`h-8 px-3 rounded-md text-[12px] font-medium cursor-pointer ${
                    orderMode === "quotation" ? "bg-amber-500 text-zinc-950" : `${subCardBg} border ${textMuted}`
                  }`}
                >
                  From Existing Quotation
                </button>
                <button
                  type="button"
                  onClick={() => setOrderMode("manual")}
                  className={`h-8 px-3 rounded-md text-[12px] font-medium cursor-pointer ${
                    orderMode === "manual" ? "bg-amber-500 text-zinc-950" : `${subCardBg} border ${textMuted}`
                  }`}
                >
                  Manual Order Entry
                </button>
              </div>
            )}

            <form onSubmit={handleSaveOrder} className="space-y-4">
              {!editingOrderId && orderMode === "quotation" && (
                <div className={`p-3 rounded-md border ${subCardBg} space-y-2`}>
                  <label className={`block text-[12px] font-medium ${textMuted}`}>
                    Search &amp; Select Quotation (Auto-fills details; order is saved only when you click Save Order)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={quoteSearch}
                      onChange={(e) => setQuoteSearch(e.target.value)}
                      placeholder="Filter by quotation no or client..."
                      className={`h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}
                    />
                    <select
                      value={selectedQuoteId}
                      onChange={(e) => handleSelectQuotation(e.target.value)}
                      className={`sm:col-span-2 h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}
                    >
                      <option value="">Select quotation...</option>
                      {sortedQuotations.map((q) => (
                        <option key={q.id || q.quotation_no} value={q.id || q.quotation_no}>
                          {q.quotation_no} ({q.date}) — {q.client_name} — {inr.format(q.total || 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Section 1: Client Information */}
              <div className="space-y-2">
                <h4 className={`text-[13px] font-semibold ${textHeader}`}>Client Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Select Existing Client</label>
                    <select value={ordClientId} onChange={(e) => handleSelectManualClient(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                      <option value="">-- Optional Client Lookup --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Company Name *</label>
                    <input type="text" required value={ordClientName} onChange={(e) => setOrdClientName(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>GSTIN</label>
                    <input type="text" value={ordClientGstin} onChange={(e) => setOrdClientGstin(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                </div>
              </div>

              {/* Section 2: Order Information */}
              <div className="space-y-2">
                <h4 className={`text-[13px] font-semibold ${textHeader}`}>Order Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Project / Order Name *</label>
                    <input type="text" required value={ordProjectName} onChange={(e) => setOrdProjectName(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Order Date *</label>
                    <input type="date" required value={ordDate} onChange={(e) => setOrdDate(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Order Status</label>
                    <select value={ordStatus} onChange={(e) => setOrdStatus(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                      <option value="Confirmed">Confirmed</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Financially Closed">Financially Closed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Customer PO No</label>
                    <input type="text" value={ordCustPoNo} onChange={(e) => setOrdCustPoNo(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Customer PO Date</label>
                    <input type="date" value={ordCustPoDate} onChange={(e) => setOrdCustPoDate(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>PI Number</label>
                    <input type="text" value={ordPiNo} onChange={(e) => setOrdPiNo(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                  <div>
                    <label className={`block text-[12px] mb-1 ${textMuted}`}>Tax Invoice No</label>
                    <input type="text" value={ordTiNo} onChange={(e) => setOrdTiNo(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
                  </div>
                </div>
              </div>

              {/* Section 3: Product & Project Costing */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className={`text-[13px] font-semibold ${textHeader}`}>Product &amp; Project Costing</h4>
                  <button
                    type="button"
                    onClick={() =>
                      setOrdItems((prev) => [
                        ...prev,
                        { product_name: "", category: "Automation", qty: 1, selling_price: 0, manufacturing_cost: 0, installation_cost: 0, other_cost: 0 },
                      ])
                    }
                    className="text-[12px] text-amber-500 font-medium cursor-pointer"
                  >
                    + Add Product Row
                  </button>
                </div>
                <div className="space-y-2">
                  {ordItems.map((it, idx) => (
                    <div key={idx} className={`p-2.5 rounded-md border ${subCardBg} grid grid-cols-2 sm:grid-cols-7 gap-2 items-end`}>
                      <div className="col-span-2">
                        <label className={`block text-[11px] ${textMuted}`}>Product Name</label>
                        <input
                          type="text"
                          value={it.product_name}
                          onChange={(e) => setOrdItems((prev) => prev.map((x, i) => (i === idx ? { ...x, product_name: e.target.value } : x)))}
                          className={`w-full h-8 px-2 rounded border text-[12px] ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] ${textMuted}`}>Qty</label>
                        <input
                          type="number"
                          value={it.qty}
                          onChange={(e) => setOrdItems((prev) => prev.map((x, i) => (i === idx ? { ...x, qty: Number(e.target.value) } : x)))}
                          className={`w-full h-8 px-2 rounded border text-[12px] tabular-nums ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] ${textMuted}`}>Selling Price</label>
                        <input
                          type="number"
                          value={it.selling_price}
                          onChange={(e) => setOrdItems((prev) => prev.map((x, i) => (i === idx ? { ...x, selling_price: Number(e.target.value) } : x)))}
                          className={`w-full h-8 px-2 rounded border text-[12px] tabular-nums ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] ${textMuted}`}>Mfg Cost</label>
                        <input
                          type="number"
                          value={it.manufacturing_cost}
                          onChange={(e) => setOrdItems((prev) => prev.map((x, i) => (i === idx ? { ...x, manufacturing_cost: Number(e.target.value) } : x)))}
                          className={`w-full h-8 px-2 rounded border text-[12px] tabular-nums ${inputCls}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-[11px] ${textMuted}`}>Install + Other</label>
                        <input
                          type="number"
                          value={it.installation_cost + it.other_cost}
                          onChange={(e) => setOrdItems((prev) => prev.map((x, i) => (i === idx ? { ...x, installation_cost: Number(e.target.value), other_cost: 0 } : x)))}
                          className={`w-full h-8 px-2 rounded border text-[12px] tabular-nums ${inputCls}`}
                        />
                      </div>
                      <div className="flex justify-end">
                        {ordItems.length > 1 && (
                          <button type="button" onClick={() => setOrdItems((prev) => prev.filter((_, i) => i !== idx))} className="text-rose-500 p-1 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className={`p-3 rounded-md border ${subCardBg} flex flex-wrap gap-4 text-[12px] tabular-nums`}>
                  <span>Basic: <strong>{inr.format(orderPreviewTotals.basic)}</strong></span>
                  <span>GST ({ordGstRate}%): <strong>{inr.format(orderPreviewTotals.gst)}</strong></span>
                  <span>Total: <strong>{inr.format(orderPreviewTotals.total)}</strong></span>
                  <span>Direct Cost: <strong>{inr.format(orderPreviewTotals.cost)}</strong></span>
                  <span className={orderPreviewTotals.profit < 0 ? "text-rose-500" : "text-emerald-500"}>
                    Gross Profit: <strong>{inr.format(orderPreviewTotals.profit)}</strong>
                  </span>
                </div>
              </div>

              {/* Optional Maintenance */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowMaintenance(!showMaintenance)}
                  className={`flex items-center gap-1 text-[12px] font-medium ${textMuted} cursor-pointer`}
                >
                  {showMaintenance ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Optional Maintenance Details</span>
                </button>
                {showMaintenance && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                    <label className="flex items-center gap-2 text-[12px]">
                      <input type="checkbox" checked={maintRequired} onChange={(e) => setMaintRequired(e.target.checked)} />
                      <span>Maintenance Required</span>
                    </label>
                    <input type="text" value={maintType} onChange={(e) => setMaintType(e.target.value)} placeholder="Type (AMC)" className={`h-8 px-2 rounded border text-[12px] ${inputCls}`} />
                    <input type="number" value={maintRevenue} onChange={(e) => setMaintRevenue(e.target.value)} placeholder="Income ₹" className={`h-8 px-2 rounded border text-[12px] ${inputCls}`} />
                    <input type="number" value={maintCost} onChange={(e) => setMaintCost(e.target.value)} placeholder="Cost ₹" className={`h-8 px-2 rounded border text-[12px] ${inputCls}`} />
                  </div>
                )}
              </div>

              <div className={`flex justify-end gap-2 pt-3 border-t ${borderCol}`}>
                <button type="button" onClick={() => setOrderModalOpen(false)} className={`h-9 px-4 rounded-md border text-[13px] cursor-pointer ${subCardBg}`}>
                  Cancel
                </button>
                <button type="submit" disabled={savingOrder} className="h-9 px-4 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[13px] font-medium cursor-pointer">
                  {savingOrder ? "Saving..." : "Save Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Edit Modal */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateEmployee} className={`border rounded-lg max-w-md w-full p-5 space-y-3 ${cardBg}`}>
            <h3 className={`text-[15px] font-semibold ${textHeader}`}>
              Edit Employee &mdash; {editingEmployee.full_name} ({editingEmployee.employee_id})
            </h3>
            <input type="text" value={empDesignation} onChange={(e) => setEmpDesignation(e.target.value)} placeholder="Designation" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            <input type="text" value={empDepartment} onChange={(e) => setEmpDepartment(e.target.value)} placeholder="Department" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            <input type="text" value={empMobile} onChange={(e) => setEmpMobile(e.target.value)} placeholder="Mobile" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            <select value={empStatus} onChange={(e) => setEmpStatus(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditingEmployee(null)} className={`h-8 px-3 rounded-md border text-[12px] cursor-pointer ${subCardBg}`}>Cancel</button>
              <button type="submit" className="h-8 px-3 rounded-md bg-amber-500 text-zinc-950 text-[12px] font-medium cursor-pointer">Save</button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalClaim && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className={`border rounded-lg max-w-md w-full p-5 space-y-3 ${cardBg}`}>
            <h3 className={`text-[15px] font-semibold ${textHeader}`}>Reject Expense {rejectModalClaim.claim_no}</h3>
            <textarea rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Enter mandatory rejection reason..." className={`w-full p-2.5 rounded-md border text-[13px] ${inputCls}`} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRejectModalClaim(null)} className={`h-8 px-3 rounded-md border text-[12px] cursor-pointer ${subCardBg}`}>Cancel</button>
              <button onClick={handleRejectClaim} className="h-8 px-3 rounded-md bg-rose-600 text-white text-[12px] font-medium cursor-pointer">Confirm Reject</button>
            </div>
          </div>
        </div>
      )}

      {/* Reimburse Modal */}
      {reimburseModalClaim && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className={`border rounded-lg max-w-md w-full p-5 space-y-3 ${cardBg}`}>
            <h3 className={`text-[15px] font-semibold ${textHeader}`}>Reimburse {reimburseModalClaim.claim_no}</h3>
            <div className="space-y-2">
              <input type="number" step="0.01" value={reimbAmount} onChange={(e) => setReimbAmount(e.target.value)} placeholder="Amount ₹" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              <select value={reimbAccountId} onChange={(e) => setReimbAccountId(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`}>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <input type="text" value={reimbMode} onChange={(e) => setReimbMode(e.target.value)} placeholder="Payment Mode" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              <input type="text" value={reimbRef} onChange={(e) => setReimbRef(e.target.value)} placeholder="UTR / Reference" className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
              <input type="date" value={reimbDate} onChange={(e) => setReimbDate(e.target.value)} className={`w-full h-9 px-2.5 rounded-md border text-[13px] ${inputCls}`} />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setReimburseModalClaim(null)} className={`h-8 px-3 rounded-md border text-[12px] cursor-pointer ${subCardBg}`}>Cancel</button>
              <button onClick={handleReimburseClaim} className="h-8 px-3 rounded-md bg-amber-500 text-zinc-950 text-[12px] font-medium cursor-pointer">Confirm Payout</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={() => setPreviewReceipt(null)}>
          <div className={`border rounded-lg max-w-2xl w-full p-4 space-y-3 ${cardBg}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between">
              <span className={`text-[13px] font-semibold ${textHeader}`}>Receipt Preview</span>
              <button onClick={() => setPreviewReceipt(null)} className="text-[12px] text-amber-500 cursor-pointer">Close</button>
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
