"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { CompanyInfo, PurchaseOrder as POType, Quotation, User, Vendor } from "../lib/types";
import { hasPermission, normalizeRole } from "../lib/permissions";
import { inr } from "../lib/vba-engine";
import PurchaseOrderForm from "./PurchaseOrderForm";

interface PurchaseOrdersWorkspaceProps {
  theme: "dark" | "light";
  company: CompanyInfo;
  vendors: Vendor[];
  allQuotations: Quotation[];
  currentQuote: Quotation;
  poData: POType;
  setPoData: React.Dispatch<React.SetStateAction<POType>>;
  currentUser: User | null;
  onOpenVendorModal?: () => void;
  onPrintPo: (po: POType) => void;
  onEmailPo?: (po: POType) => void;
}

export default function PurchaseOrdersWorkspace({
  theme,
  company,
  vendors,
  allQuotations,
  currentQuote,
  poData,
  setPoData,
  currentUser,
  onOpenVendorModal,
  onPrintPo,
  onEmailPo,
}: PurchaseOrdersWorkspaceProps) {
  const isDark = theme === "dark";
  const canonRole = normalizeRole(currentUser?.role);
  const isAdmin = canonRole === "Admin" || hasPermission(currentUser, "purchase_order.approve");
  const canCreatePo = isAdmin || hasPermission(currentUser, "purchase_order.create");
  const canSubmitPo = hasPermission(currentUser, "purchase_order.submit");
  const canSendMailPerm = hasPermission(currentUser, "mail.send");

  const [poList, setPoList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState(false);
  const [remarks, setRemarks] = useState("");
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadPos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase-orders", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      if (Array.isArray(json.items)) {
        setPoList(json.items);
      }
    } catch {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPos();
    const onFocus = () => loadPos();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadPos]);

  const activeDbPo = useMemo(() => {
    return (
      poList.find(
        (p) =>
          (poData.id && p.id === poData.id) ||
          (poData.po_number && p.po_number === poData.po_number)
      ) || null
    );
  }, [poList, poData.id, poData.po_number]);

  const approvalStatus: string = String(
    activeDbPo?.approval_status || (poData as any)?.approval_status || "Draft"
  );
  const isApproved = isAdmin || approvalStatus === "Approved";
  const pendingApprovalList = useMemo(
    () => poList.filter((p) => String(p.approval_status || "") === "Pending Approval"),
    [poList]
  );

  const cardBg = isDark
    ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]"
    : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCardBg = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const textMuted = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";

  const handleSubmitForApproval = async () => {
    if (busyAction) return;
    setNotice(null);
    if (!poData.vendor_id && !poData.vendor_name) {
      setNotice({ type: "err", text: "Select an approved vendor before submitting for approval." });
      return;
    }
    setBusyAction(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...poData, submitForApproval: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to submit Purchase Order for approval." });
        return;
      }
      if (json.item) setPoData(json.item);
      setNotice({ type: "ok", text: `Purchase Order ${poData.po_number} submitted for Admin approval.` });
      await loadPos();
    } catch {
      setNotice({ type: "err", text: "Failed to submit Purchase Order." });
    } finally {
      setBusyAction(false);
    }
  };

  const handleAdminDecision = async (poId: string, action: "approve" | "reject" | "request_changes") => {
    if (busyAction) return;
    setNotice(null);
    setBusyAction(true);
    try {
      const res = await fetch("/api/purchase-orders/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: poId, action, remarks }),
      });
      const json = await res.json();
      if (!res.ok) {
        setNotice({ type: "err", text: json.error || "Failed to update approval." });
        return;
      }
      if (json.item && poData.id === json.item.id) {
        setPoData(json.item);
      }
      setRemarks("");
      setNotice({ type: "ok", text: `Purchase Order updated: ${json.item?.approval_status || action}.` });
      await loadPos();
    } catch {
      setNotice({ type: "err", text: "Failed to process approval decision." });
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4">
      {/* Approval Status & Action Bar */}
      <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Purchase Order Workflow</h2>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  approvalStatus === "Approved"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : approvalStatus === "Pending Approval"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : approvalStatus === "Rejected"
                    ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    : approvalStatus === "Changes Requested"
                    ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                    : "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
                }`}
              >
                {isAdmin && approvalStatus === "Draft" ? "Admin Direct Authority" : approvalStatus}
              </span>
            </div>
            <p className={`text-xs mt-1 ${textMuted}`}>
              {!isApproved
                ? "Admin approval required. Official PO generation, PDF download, printing, and email attachment are blocked until approved."
                : "Approved for official PO generation, PDF download, and email dispatch."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadPos}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border text-xs font-medium cursor-pointer ${subCardBg}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {!isAdmin && canSubmitPo && approvalStatus !== "Approved" && approvalStatus !== "Pending Approval" && (
              <button
                type="button"
                onClick={handleSubmitForApproval}
                disabled={busyAction}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{busyAction ? "Submitting..." : "Submit for Approval"}</span>
              </button>
            )}
          </div>
        </div>

        {activeDbPo?.approval_remarks && (
          <div className={`p-2.5 rounded-lg border text-xs ${subCardBg}`}>
            <span className="font-semibold">Admin Remarks: </span>
            <span>{activeDbPo.approval_remarks}</span>
          </div>
        )}

        {notice && (
          <div
            className={`px-3 py-2 rounded-lg border text-xs ${
              notice.type === "ok"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400"
            }`}
          >
            {notice.text}
          </div>
        )}

        {/* Admin PO Approval Queue */}
        {isAdmin && pendingApprovalList.length > 0 && (
          <div className={`p-3 rounded-lg border space-y-2.5 ${subCardBg}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <span>Pending Purchase Order Approvals ({pendingApprovalList.length})</span>
              </div>
              <input
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional approval / rejection remarks..."
                className={`px-2.5 py-1.5 rounded border text-xs w-64 ${
                  isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
                }`}
              />
            </div>

            <div className="space-y-2">
              {pendingApprovalList.map((po) => (
                <div
                  key={po.id || po.po_number}
                  className={`p-2.5 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${cardBg}`}
                >
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold">
                      {po.po_number} &bull; {po.vendor_name || "Vendor"} &bull;{" "}
                      <span className="font-mono">{inr.format(Number(po.total || 0))}</span>
                    </div>
                    <div className={`text-[11px] ${textMuted}`}>
                      Submitted by {po.submitted_by || po.created_by || "Purchase"} &bull;{" "}
                      {po.submitted_at ? new Date(po.submitted_at).toLocaleString() : po.po_date}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPoData(po)}
                      className={`px-2.5 py-1.5 rounded border text-[11px] font-semibold cursor-pointer ${subCardBg}`}
                    >
                      Open PO
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleAdminDecision(po.id || po.po_number, "approve")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleAdminDecision(po.id || po.po_number, "request_changes")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5" /> Request Changes
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleAdminDecision(po.id || po.po_number, "reject")}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Unapproved PO Warning Banner */}
      {!isApproved && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Admin approval required.</span>
        </div>
      )}

      {/* Existing Protected Purchase Order Form & Preview (Unmodified) */}
      <PurchaseOrderForm
        theme={theme}
        company={company}
        vendors={vendors}
        allQuotations={allQuotations}
        currentQuote={currentQuote}
        poData={poData}
        setPoData={setPoData}
        canCreatePo={canCreatePo}
        canExportPdf={isApproved}
        canSendEmail={isApproved && canSendMailPerm}
        onOpenVendorModal={onOpenVendorModal}
        onPrintPo={(po) => {
          if (!isApproved) {
            setNotice({ type: "err", text: "Admin approval required before generating official PO PDF." });
            return;
          }
          onPrintPo(po);
        }}
        onEmailPo={(po) => {
          if (!isApproved) {
            setNotice({ type: "err", text: "Admin approval required before emailing official PO." });
            return;
          }
          if (onEmailPo) onEmailPo(po);
        }}
      />
    </div>
  );
}
