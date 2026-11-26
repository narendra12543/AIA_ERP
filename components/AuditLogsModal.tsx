"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Search, RefreshCw, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AuditLogEntry } from "../lib/types";

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

export default function AuditLogsModal({ isOpen, onClose, theme = "dark" }: AuditLogsModalProps) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const isDark = theme === "dark";

  async function fetchLogs(targetPage = page) {
    setLoading(true);
    try {
      let token = "";
      try {
        const raw = sessionStorage.getItem("aven_tab_session");
        if (raw) token = JSON.parse(raw).token || "";
      } catch {}

      const params = new URLSearchParams({ page: String(targetPage), limit: "25" });
      if (search.trim()) params.set("q", search.trim());
      if (actionFilter) params.set("action", actionFilter);

      const res = await fetch(`/api/audit-logs?${params.toString()}`, {
        credentials: "same-origin",
        headers: token ? { "x-tab-session": token } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setTotal(data.total || 0);
        setPage(data.page || 1);
        setTotalPages(data.totalPages || 1);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchLogs(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, actionFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div
        className={`rounded-xl max-w-5xl w-full p-4 sm:p-6 shadow-2xl border max-h-[92vh] flex flex-col ${
          isDark ? "bg-[#09090b] border-zinc-800 text-zinc-100" : "bg-white border-zinc-200 text-zinc-900"
        }`}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold">Security &amp; Activity Audit Logs</h2>
              <p className="text-[11px] text-zinc-400">
                Total Events: {total} &bull; Passwords, tokens, and secrets are never logged
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-3 shrink-0 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchLogs(1)}
              placeholder="Search actor, action, record ref..."
              className={`w-full pl-8 pr-3 py-1.5 rounded-lg border ${
                isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
              }`}
            />
          </div>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className={`px-2.5 py-1.5 rounded-lg border ${
              isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900"
            }`}
          >
            <option value="">All Actions</option>
            <option value="LOGIN_SUCCESS">Login Success</option>
            <option value="LOGIN_FAILED_PASSWORD">Failed Password</option>
            <option value="PASSWORD_CHANGED">Password Changed</option>
            <option value="FORCED_PASSWORD_CHANGED">Forced Password Change</option>
            <option value="USER_CREATED">User Created</option>
            <option value="PERMISSIONS_UPDATED">Permissions Updated</option>
            <option value="COMPANY_PROFILE_UPDATED">Company Profile Updated</option>
            <option value="EMAIL_SENT">Email Sent</option>
          </select>
          <button
            onClick={() => fetchLogs(1)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto border border-zinc-800 rounded-lg">
          <table className="w-full text-left border-collapse text-xs">
            <thead className={isDark ? "bg-zinc-900 text-zinc-300" : "bg-zinc-100 text-zinc-700"}>
              <tr>
                <th className="p-2.5 font-bold">Timestamp</th>
                <th className="p-2.5 font-bold">Actor</th>
                <th className="p-2.5 font-bold">Action</th>
                <th className="p-2.5 font-bold">Module / Ref</th>
                <th className="p-2.5 font-bold">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/70">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-zinc-400">
                    {loading ? "Loading audit logs..." : "No audit events found."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className={isDark ? "hover:bg-zinc-900/50" : "hover:bg-zinc-50"}>
                    <td className="p-2.5 font-mono text-[11px] whitespace-nowrap text-zinc-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="p-2.5">
                      <span className="font-semibold">{log.actor_name || log.user_id || "System"}</span>
                    </td>
                    <td className="p-2.5 font-mono text-[11px] text-amber-400">{log.action}</td>
                    <td className="p-2.5 text-[11px]">
                      {log.module || "-"} {log.record_ref ? `(${log.record_ref})` : ""}
                    </td>
                    <td className="p-2.5">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          log.outcome === "FAILURE" || log.outcome === "BLOCKED"
                            ? "bg-rose-500/10 text-rose-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {log.outcome || "SUCCESS"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-3 text-xs text-zinc-400 shrink-0">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => fetchLogs(page - 1)}
              className="p-1.5 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => fetchLogs(page + 1)}
              className="p-1.5 rounded border border-zinc-700 disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
