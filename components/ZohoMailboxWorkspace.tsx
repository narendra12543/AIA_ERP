"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ChevronLeft,
  ChevronRight,
  Download,
  Forward,
  Inbox,
  Link2,
  Mail,
  MailOpen,
  Paperclip,
  Reply,
  ReplyAll,
  Star,
  Trash2,
} from "lucide-react";

function getTabHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem("aven_tab_session");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.token) headers["x-tab-session"] = parsed.token;
      }
    } catch {}
  }
  return headers;
}

function decodeHtmlEntities(input?: string): string {
  if (!input) return "";
  return String(input)
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ZohoMailboxWorkspaceProps {
  theme: "dark" | "light";
  isAdmin: boolean;
  mailboxes: any[];
  activeMailbox: any | null;
  folders: any[];
  activeFolderId: string;
  loadingFolders: boolean;
  searchQuery: string;
  clientMode: boolean;
  refreshNonce: number;
  onRefreshFolders: () => void;
  onOpenAdminSettings?: () => void;
  onComposeAction: (opts: {
    mode: "new" | "reply" | "replyAll" | "forward";
    to?: string;
    cc?: string;
    subject?: string;
    bodyHtml?: string;
    originalMessageId?: string;
    inReplyTo?: string;
  }) => void;
}

export default function ZohoMailboxWorkspace({
  theme,
  isAdmin,
  mailboxes,
  activeMailbox,
  folders,
  activeFolderId,
  loadingFolders,
  searchQuery,
  clientMode,
  refreshNonce,
  onRefreshFolders,
  onOpenAdminSettings,
  onComposeAction,
}: ZohoMailboxWorkspaceProps) {
  const isDark = theme === "dark";
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMessage, setActiveMessage] = useState<any | null>(null);
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Client Email History integration
  const [clientEmailInput, setClientEmailInput] = useState("");
  const [clientEmails, setClientEmails] = useState<{ incoming: any[]; outgoing: any[] }>({
    incoming: [],
    outgoing: [],
  });

  // Mailbox-scoped cache & AbortController for race-free switching
  const messageCacheRef = useRef<Map<string, any[]>>(new Map());
  const listAbortRef = useRef<AbortController | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const savedScrollTopRef = useRef<number>(0);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset selected message & selections when switching mailbox or folder
  useEffect(() => {
    setActiveMessage(null);
    setSelectedIds(new Set());
    setErrorMsg(null);
    setPage(0);
    savedScrollTopRef.current = 0;
  }, [activeMailbox?.id, activeFolderId]);

  const loadMessages = useCallback(async () => {
    if (!activeMailbox?.id || !activeFolderId) return;
    listAbortRef.current?.abort();
    const ctrl = new AbortController();
    listAbortRef.current = ctrl;

    const targetMailboxId = activeMailbox.id;
    const targetFolderId = activeFolderId;
    const cacheKey = `${targetMailboxId}:${targetFolderId}:${page}:${debouncedSearch}`;
    const cached = messageCacheRef.current.get(cacheKey);
    if (cached) setMessages(cached);

    setLoadingMessages(true);
    setErrorMsg(null);
    try {
      const qs = new URLSearchParams({
        mailboxId: targetMailboxId,
        folderId: targetFolderId,
        start: String(page * 25),
        limit: "25",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`/api/mail/messages?${qs.toString()}`, {
        signal: ctrl.signal,
        cache: "no-store",
        headers: getTabHeaders(),
      });
      const json = await res.json();
      if (ctrl.signal.aborted) return;
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to load messages.");
        return;
      }
      const list = Array.isArray(json.messages) ? json.messages : [];
      messageCacheRef.current.set(cacheKey, list);
      setMessages(list);
    } catch (err: any) {
      if (err?.name !== "AbortError") setErrorMsg("Failed to fetch messages.");
    } finally {
      if (!ctrl.signal.aborted) setLoadingMessages(false);
    }
  }, [activeMailbox?.id, activeFolderId, page, debouncedSearch]);

  useEffect(() => {
    loadMessages();
    return () => listAbortRef.current?.abort();
  }, [loadMessages, refreshNonce]);

  const openMessage = async (msg: any, remoteImgs: boolean = false) => {
    if (!activeMailbox?.id) return;
    if (listScrollRef.current) {
      savedScrollTopRef.current = listScrollRef.current.scrollTop;
    }
    setLoadingBody(true);
    setAllowRemoteImages(remoteImgs);
    try {
      const qs = new URLSearchParams({
        mailboxId: activeMailbox.id,
        folderId: msg.folderId || activeFolderId,
        messageId: String(msg.messageId),
        allowRemoteImages: remoteImgs ? "1" : "0",
      });
      const res = await fetch(`/api/mail/messages?${qs.toString()}`, {
        cache: "no-store",
        headers: getTabHeaders(),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to load email content.");
        return;
      }
      setActiveMessage(json.message);
      if (!msg.isRead) {
        await fetch("/api/mail/messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json", ...getTabHeaders() },
          body: JSON.stringify({
            mailboxId: activeMailbox.id,
            folderId: msg.folderId || activeFolderId,
            messageIds: [String(msg.messageId)],
            operation: "markRead",
          }),
        });
        setMessages((prev) =>
          prev.map((m) => (m.messageId === msg.messageId ? { ...m, isRead: true } : m))
        );
      }
    } catch {
      setErrorMsg("Failed to read message.");
    } finally {
      setLoadingBody(false);
    }
  };

  const handleBackToList = () => {
    setActiveMessage(null);
    setTimeout(() => {
      if (listScrollRef.current) {
        listScrollRef.current.scrollTop = savedScrollTopRef.current;
      }
    }, 0);
  };

  const runOperation = async (operation: string, ids: string[]) => {
    if (!activeMailbox?.id || ids.length === 0) return;
    if (operation === "trash" && !window.confirm(`Move ${ids.length} message(s) to Trash?`)) return;
    setErrorMsg(null);
    const destFolder =
      operation === "archive"
        ? folders.find((f) => String(f.folderType || f.folderName).toLowerCase() === "archive")?.folderId
        : operation === "trash"
        ? folders.find((f) => String(f.folderType || f.folderName).toLowerCase() === "trash")?.folderId
        : undefined;

    const res = await fetch("/api/mail/messages", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getTabHeaders() },
      body: JSON.stringify({
        mailboxId: activeMailbox.id,
        folderId: activeFolderId,
        messageIds: ids,
        operation,
        destFolderId: destFolder,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setErrorMsg(json.error || `Operation ${operation} failed.`);
      return;
    }
    if (activeMessage && ids.includes(String(activeMessage.messageId)) && ["trash", "archive"].includes(operation)) {
      setActiveMessage(null);
    }
    setSelectedIds(new Set());
    await loadMessages();
    onRefreshFolders();
  };

  const handleLoadClientEmails = async () => {
    if (!clientEmailInput.trim()) return;
    const res = await fetch(
      `/api/mail/client-history?clientEmail=${encodeURIComponent(clientEmailInput.trim())}`,
      { headers: getTabHeaders() }
    );
    if (res.ok) {
      const json = await res.json();
      setClientEmails({ incoming: json.incoming || [], outgoing: json.outgoing || [] });
    }
  };

  const activeFolderObj = folders.find((f) => f.folderId === activeFolderId);
  const activeFolderName = activeFolderObj?.folderName || "Inbox";

  const cardCls = isDark
    ? "bg-[#111113] border-[#27272A] text-[#F4F4F5]"
    : "bg-white border-slate-200 text-[#18181B]";
  const subCls = isDark
    ? "bg-[#18181B] border-[#27272A]"
    : "bg-slate-50 border-slate-200";
  const inputCls = isDark
    ? "bg-[#09090B] border-zinc-700 text-white"
    : "bg-white border-slate-300 text-zinc-900";
  const mutedCls = isDark ? "text-[#A1A1AA]" : "text-slate-500";
  const dividerCls = isDark ? "divide-[#27272A]/70" : "divide-slate-200";

  if (mailboxes.length === 0) {
    return (
      <div className={`p-8 rounded-lg border text-center space-y-2 ${cardCls}`}>
        <Mail className="w-8 h-8 mx-auto text-zinc-500" />
        <h3 className="text-sm font-semibold">No Mailbox Assigned</h3>
        <p className={`text-xs max-w-md mx-auto ${mutedCls}`}>
          Your account currently has no assigned company mailboxes. Contact your Administrator to grant mailbox access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 space-y-2">
      {errorMsg && (
        <div className="px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {clientMode && (
        <div className={`p-3 rounded-lg border space-y-2.5 ${cardCls}`}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={clientEmailInput}
              onChange={(e) => setClientEmailInput(e.target.value)}
              placeholder="Enter exact client email (e.g. sales@client.com)..."
              className={`flex-1 px-3 py-1.5 rounded-lg border text-xs ${inputCls}`}
            />
            <button
              type="button"
              onClick={handleLoadClientEmails}
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Find Client Correspondence
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            <div className={`p-2.5 rounded-lg border ${subCls}`}>
              <div className="font-semibold mb-1.5">Incoming ({clientEmails.incoming.length})</div>
              {clientEmails.incoming.map((e, i) => (
                <div key={i} className="py-1 border-b border-zinc-800/40 last:border-0">
                  <div className="font-medium truncate">{e.subject}</div>
                  <div className={`text-[10px] ${mutedCls}`}>{e.from_address} &bull; {e.mailbox_id}</div>
                </div>
              ))}
            </div>
            <div className={`p-2.5 rounded-lg border ${subCls}`}>
              <div className="font-semibold mb-1.5">Outgoing ({clientEmails.outgoing.length})</div>
              {clientEmails.outgoing.map((e, i) => (
                <div key={i} className="py-1 border-b border-zinc-800/40 last:border-0">
                  <div className="font-medium truncate">{e.subject}</div>
                  <div className={`text-[10px] ${mutedCls}`}>{e.from_email} &rarr; {e.to_emails}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disconnected State */}
      {activeMailbox && activeMailbox.connection_status !== "Connected" ? (
        <div className={`p-8 rounded-lg border text-center space-y-3 ${cardCls}`}>
          <Link2 className="w-8 h-8 mx-auto text-amber-400" />
          <h3 className="text-sm font-semibold">{activeMailbox.email_address} is {activeMailbox.connection_status}</h3>
          <p className={`text-xs max-w-md mx-auto ${mutedCls}`}>
            {isAdmin
              ? "Connect this Zoho Mail account via OAuth 2.0 in Admin Settings to synchronize folders, messages, and drafts."
              : "This mailbox is not connected to Zoho yet. Ask your Administrator to authorize the connection."}
          </p>
          {isAdmin && onOpenAdminSettings && (
            <button
              type="button"
              onClick={onOpenAdminSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Open Mail Accounts Settings
            </button>
          )}
        </div>
      ) : (
        /* Split Workspace: Email List | Email Reading Panel */
        <div className={`flex flex-1 min-h-[540px] lg:h-[calc(100vh-148px)] rounded-lg border overflow-hidden ${cardCls}`}>
          {/* Panel 1: Email Message List */}
          <div
            className={`${
              activeMessage ? "hidden lg:flex" : "flex"
            } w-full lg:w-[340px] xl:w-[380px] shrink-0 flex-col border-r ${
              isDark ? "border-[#27272A]" : "border-slate-200"
            }`}
          >
            {/* List Top Bar */}
            <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 text-xs ${subCls}`}>
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="checkbox"
                  aria-label="Select all messages"
                  checked={messages.length > 0 && selectedIds.size === messages.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(messages.map((m) => String(m.messageId))));
                    else setSelectedIds(new Set());
                  }}
                />
                <span className="font-semibold truncate">{activeFolderName}</span>
                <span className={`text-[11px] shrink-0 ${mutedCls}`}>
                  {selectedIds.size > 0 ? `(${selectedIds.size} sel)` : `(${messages.length})`}
                </span>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => runOperation("markRead", Array.from(selectedIds))} className="p-1 rounded hover:bg-zinc-800/50 cursor-pointer" title="Mark Read"><MailOpen className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => runOperation("archive", Array.from(selectedIds))} className="p-1 rounded hover:bg-zinc-800/50 cursor-pointer" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => runOperation("trash", Array.from(selectedIds))} className="p-1 rounded hover:bg-zinc-800/50 text-rose-400 cursor-pointer" title="Trash"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            {/* Scrollable Message Rows */}
            <div ref={listScrollRef} className={`flex-1 overflow-y-auto divide-y ${dividerCls}`}>
              {messages.length === 0 ? (
                <div className={`p-8 text-center text-xs ${mutedCls}`}>
                  {loadingFolders || loadingMessages ? "Loading emails..." : "No messages in this folder."}
                </div>
              ) : (
                messages.map((m) => {
                  const preview = decodeHtmlEntities(m.summary);
                  const isActive = activeMessage?.messageId === m.messageId;
                  return (
                    <div
                      key={m.messageId}
                      onClick={() => openMessage(m)}
                      className={`px-3 py-2.5 cursor-pointer flex items-start gap-2.5 transition-colors ${
                        isActive
                          ? isDark
                            ? "bg-amber-500/12"
                            : "bg-amber-50"
                          : isDark
                          ? "hover:bg-zinc-900/70"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${m.subject || "message"}`}
                        checked={selectedIds.has(String(m.messageId))}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(String(m.messageId));
                          else next.delete(String(m.messageId));
                          setSelectedIds(next);
                        }}
                        className="mt-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {!m.isRead && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                            <span
                              className={`text-xs truncate ${
                                !m.isRead
                                  ? "font-semibold"
                                  : isDark
                                  ? "font-medium text-zinc-300"
                                  : "font-medium text-zinc-700"
                              }`}
                            >
                              {decodeHtmlEntities(m.fromName || m.fromAddress)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {m.hasAttachment && <Paperclip className="w-3 h-3 text-zinc-400" />}
                            {m.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                            <span className={`text-[10px] ${mutedCls}`}>
                              {m.receivedTime
                                ? new Date(m.receivedTime).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                        </div>
                        <div
                          className={`text-xs truncate mt-0.5 ${
                            !m.isRead ? "font-semibold" : "font-normal"
                          }`}
                        >
                          {decodeHtmlEntities(m.subject || "(No Subject)")}
                        </div>
                        {preview && (
                          <div className={`text-[11px] truncate mt-0.5 ${mutedCls}`}>{preview}</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Footer */}
            <div className={`px-3 py-1.5 border-t flex items-center justify-between text-xs ${subCls}`}>
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="p-1 disabled:opacity-40 cursor-pointer"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className={`text-[11px] ${mutedCls}`}>Page {page + 1}</span>
              <button
                type="button"
                disabled={messages.length < 25}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 disabled:opacity-40 cursor-pointer"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Panel 2: Email Reading Panel */}
          <div className={`${activeMessage ? "flex" : "hidden lg:flex"} flex-1 min-w-0 flex-col`}>
            {!activeMessage ? (
              <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center text-xs ${mutedCls}`}>
                <Inbox className="w-8 h-8 mb-2 opacity-50" />
                <p>Select an email to read, reply, or manage attachments.</p>
              </div>
            ) : (
              <>
                <div className={`p-3 border-b space-y-2 ${subCls}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleBackToList}
                      className="lg:hidden inline-flex items-center gap-1 text-xs font-semibold text-amber-400 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back to {activeFolderName}
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onComposeAction({
                            mode: "reply",
                            to: activeMessage.fromAddress,
                            subject: activeMessage.subject?.startsWith("Re:")
                              ? activeMessage.subject
                              : `Re: ${activeMessage.subject}`,
                            bodyHtml: `<br/><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">${activeMessage.htmlContent || ""}</blockquote>`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
                      >
                        <Reply className="w-3.5 h-3.5" /> Reply
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onComposeAction({
                            mode: "replyAll",
                            to: activeMessage.fromAddress,
                            cc: activeMessage.ccAddress,
                            subject: activeMessage.subject?.startsWith("Re:")
                              ? activeMessage.subject
                              : `Re: ${activeMessage.subject}`,
                            bodyHtml: `<br/><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">${activeMessage.htmlContent || ""}</blockquote>`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
                      >
                        <ReplyAll className="w-3.5 h-3.5" /> Reply All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onComposeAction({
                            mode: "forward",
                            subject: activeMessage.subject?.startsWith("Fwd:")
                              ? activeMessage.subject
                              : `Fwd: ${activeMessage.subject}`,
                            bodyHtml: `<br/><p>---------- Forwarded message ---------</p>${activeMessage.htmlContent || ""}`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
                      >
                        <Forward className="w-3.5 h-3.5" /> Forward
                      </button>
                      <button
                        type="button"
                        onClick={() => runOperation("archive", [String(activeMessage.messageId)])}
                        className={`p-1.5 rounded border cursor-pointer ${cardCls}`}
                        title="Archive"
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => runOperation("trash", [String(activeMessage.messageId)])}
                        className={`p-1.5 rounded border text-rose-400 cursor-pointer ${cardCls}`}
                        title="Trash"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold break-words">
                      {decodeHtmlEntities(activeMessage.subject)}
                    </h3>
                    <div className={`text-[11px] mt-1 break-words ${mutedCls}`}>
                      From: <strong>{decodeHtmlEntities(activeMessage.fromName)}</strong> &lt;{activeMessage.fromAddress}&gt;
                      {activeMessage.toAddress ? ` • To: ${activeMessage.toAddress}` : ""}
                      {activeMessage.ccAddress ? ` • CC: ${activeMessage.ccAddress}` : ""}
                    </div>
                  </div>

                  {activeMessage.hasBlockedRemoteImages && !allowRemoteImages && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px]">
                      <span>Remote images blocked to protect privacy.</span>
                      <button
                        type="button"
                        onClick={() => openMessage(activeMessage, true)}
                        className="font-semibold underline cursor-pointer"
                      >
                        Load Remote Images
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 overflow-y-auto bg-white text-zinc-900">
                  {loadingBody ? (
                    <p className="text-xs text-zinc-500">Loading message body...</p>
                  ) : (
                    <div
                      className="prose prose-sm max-w-none break-words"
                      dangerouslySetInnerHTML={{ __html: activeMessage.htmlContent || "" }}
                    />
                  )}
                </div>

                {Array.isArray(activeMessage.attachments) && activeMessage.attachments.length > 0 && (
                  <div className={`p-3 border-t flex flex-wrap gap-2 ${subCls}`}>
                    {activeMessage.attachments.map((att: any) => (
                      <a
                        key={att.attachmentId}
                        href={`/api/mail/messages?mailboxId=${encodeURIComponent(activeMailbox.id)}&folderId=${encodeURIComponent(activeMessage.folderId)}&messageId=${encodeURIComponent(activeMessage.messageId)}&attachmentId=${encodeURIComponent(att.attachmentId)}&name=${encodeURIComponent(att.attachmentName)}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs ${cardCls}`}
                      >
                        <Download className="w-3.5 h-3.5 text-amber-400" />
                        <span>{att.attachmentName}</span>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
