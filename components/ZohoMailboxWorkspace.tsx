"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FolderPlus,
  Forward,
  Inbox,
  Link2,
  Mail,
  MailOpen,
  Menu,
  Paperclip,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  Star,
  Trash2,
  UserCheck,
} from "lucide-react";

interface ZohoMailboxWorkspaceProps {
  theme: "dark" | "light";
  isAdmin: boolean;
  mailboxes: any[];
  activeMailbox: any | null;
  onSelectMailbox: (mbx: any) => void;
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
  onSelectMailbox,
  onOpenAdminSettings,
  onComposeAction,
}: ZohoMailboxWorkspaceProps) {
  const isDark = theme === "dark";
  const [folders, setFolders] = useState<any[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string>("");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMessage, setActiveMessage] = useState<any | null>(null);
  const [allowRemoteImages, setAllowRemoteImages] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileFoldersOpen, setMobileFoldersOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Client Email History integration
  const [clientMode, setClientMode] = useState(false);
  const [clientEmailInput, setClientEmailInput] = useState("");
  const [clientEmails, setClientEmails] = useState<{ incoming: any[]; outgoing: any[] }>({ incoming: [], outgoing: [] });

  // Mailbox-scoped cache & AbortController for fast, race-free switching
  const folderCacheRef = useRef<Map<string, any[]>>(new Map());
  const messageCacheRef = useRef<Map<string, any[]>>(new Map());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset reading panel & stale requests immediately on mailbox switch
  const loadFolders = useCallback(async (mailboxId: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setActiveMessage(null);
    setSelectedIds(new Set());
    setErrorMsg(null);
    setPage(0);

    const cached = folderCacheRef.current.get(mailboxId);
    if (cached) {
      setFolders(cached);
      const inbox = cached.find((f) => String(f.folderType || f.folderName).toLowerCase() === "inbox") || cached[0];
      if (inbox) setActiveFolderId(inbox.folderId);
    } else {
      setFolders([]);
      setActiveFolderId("");
    }

    setLoadingFolders(true);
    try {
      const res = await fetch(`/api/mail/folders?mailboxId=${encodeURIComponent(mailboxId)}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to load mailbox folders.");
        return;
      }
      const list = Array.isArray(json.folders) ? json.folders : [];
      folderCacheRef.current.set(mailboxId, list);
      setFolders(list);
      const inbox = list.find((f: any) => String(f.folderType || f.folderName).toLowerCase() === "inbox") || list[0];
      if (inbox) setActiveFolderId(inbox.folderId);
    } catch (err: any) {
      if (err?.name !== "AbortError") setErrorMsg("Network error loading folders.");
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  useEffect(() => {
    if (activeMailbox?.id) {
      loadFolders(activeMailbox.id);
    }
    return () => abortRef.current?.abort();
  }, [activeMailbox?.id, loadFolders]);

  const loadMessages = useCallback(async () => {
    if (!activeMailbox?.id || !activeFolderId) return;
    const cacheKey = `${activeMailbox.id}:${activeFolderId}:${page}:${debouncedSearch}`;
    const cached = messageCacheRef.current.get(cacheKey);
    if (cached) setMessages(cached);

    setLoadingMessages(true);
    setErrorMsg(null);
    const ctrl = new AbortController();
    try {
      const qs = new URLSearchParams({
        mailboxId: activeMailbox.id,
        folderId: activeFolderId,
        start: String(page * 25),
        limit: "25",
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const res = await fetch(`/api/mail/messages?${qs.toString()}`, {
        signal: ctrl.signal,
        cache: "no-store",
      });
      const json = await res.json();
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
      setLoadingMessages(false);
    }
  }, [activeMailbox?.id, activeFolderId, page, debouncedSearch]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const openMessage = async (msg: any, remoteImgs: boolean = false) => {
    if (!activeMailbox?.id) return;
    setLoadingBody(true);
    setAllowRemoteImages(remoteImgs);
    try {
      const qs = new URLSearchParams({
        mailboxId: activeMailbox.id,
        folderId: msg.folderId || activeFolderId,
        messageId: String(msg.messageId),
        allowRemoteImages: remoteImgs ? "1" : "0",
      });
      const res = await fetch(`/api/mail/messages?${qs.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error || "Failed to load email content.");
        return;
      }
      setActiveMessage(json.message);
      if (!msg.isRead) {
        await fetch("/api/mail/messages", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
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
      headers: { "Content-Type": "application/json" },
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
  };

  const handleLoadClientEmails = async () => {
    if (!clientEmailInput.trim()) return;
    const res = await fetch(`/api/mail/client-history?clientEmail=${encodeURIComponent(clientEmailInput.trim())}`);
    if (res.ok) {
      const json = await res.json();
      setClientEmails({ incoming: json.incoming || [], outgoing: json.outgoing || [] });
    }
  };

  const cardCls = isDark ? "bg-[#17181B] border-[#2A2C30] text-[#F4F4F5]" : "bg-white border-[#E2E4E8] text-[#18181B]";
  const subCls = isDark ? "bg-[#1D1F23] border-[#2A2C30]" : "bg-[#F7F8FA] border-[#E2E4E8]";
  const inputCls = isDark ? "bg-black border-zinc-700 text-white" : "bg-white border-zinc-300 text-zinc-900";
  const mutedCls = isDark ? "text-[#A1A1AA]" : "text-[#71717A]";

  if (mailboxes.length === 0) {
    return (
      <div className={`p-8 rounded-xl border text-center space-y-2 ${cardCls}`}>
        <Mail className="w-8 h-8 mx-auto text-zinc-500" />
        <h3 className="text-sm font-semibold">No Mailbox Assigned</h3>
        <p className={`text-xs max-w-md mx-auto ${mutedCls}`}>
          Your account currently has no assigned company mailboxes. Contact your Administrator to grant mailbox access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Multi-Account Selector & Toolbar */}
      <div className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${cardCls}`}>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMobileFoldersOpen((v) => !v)}
            className={`lg:hidden p-2 rounded-lg border cursor-pointer ${subCls}`}
            aria-label="Toggle folders"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div className="relative">
            <select
              aria-label="Select Authorized Mailbox"
              value={activeMailbox?.id || ""}
              onChange={(e) => {
                const found = mailboxes.find((m) => m.id === e.target.value);
                if (found) onSelectMailbox(found);
              }}
              className={`pl-3 pr-8 py-2 min-h-[38px] rounded-lg border text-xs font-semibold cursor-pointer ${inputCls}`}
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email_address} ({m.connection_status})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setClientMode((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-lg border text-xs font-medium cursor-pointer ${
              clientMode ? "border-amber-500 text-amber-400 bg-amber-500/10" : subCls
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Client Emails</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value);
                setPage(0);
              }}
              placeholder="Search sender, subject, content..."
              className={`w-full pl-8 pr-3 py-1.5 min-h-[38px] rounded-lg border text-xs ${inputCls}`}
            />
          </div>
          <button
            type="button"
            onClick={() => activeMailbox?.id && loadFolders(activeMailbox.id)}
            className={`p-2 min-h-[38px] rounded-lg border cursor-pointer ${subCls}`}
            title="Refresh mailbox"
          >
            <RefreshCw className={`w-4 h-4 ${loadingFolders || loadingMessages ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => onComposeAction({ mode: "new" })}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" /> Compose
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {clientMode && (
        <div className={`p-4 rounded-xl border space-y-3 ${cardCls}`}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="email"
              value={clientEmailInput}
              onChange={(e) => setClientEmailInput(e.target.value)}
              placeholder="Enter exact client email (e.g. sales@client.com)..."
              className={`flex-1 px-3 py-2 rounded-lg border text-xs ${inputCls}`}
            />
            <button
              type="button"
              onClick={handleLoadClientEmails}
              className="px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 text-xs font-semibold cursor-pointer"
            >
              Find Client Correspondence
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className={`p-3 rounded-lg border ${subCls}`}>
              <div className="font-semibold mb-2">Incoming ({clientEmails.incoming.length})</div>
              {clientEmails.incoming.map((e, i) => (
                <div key={i} className="py-1.5 border-b border-zinc-800/40 last:border-0">
                  <div className="font-medium truncate">{e.subject}</div>
                  <div className={`text-[10px] ${mutedCls}`}>{e.from_address} &bull; {e.mailbox_id}</div>
                </div>
              ))}
            </div>
            <div className={`p-3 rounded-lg border ${subCls}`}>
              <div className="font-semibold mb-2">Outgoing ({clientEmails.outgoing.length})</div>
              {clientEmails.outgoing.map((e, i) => (
                <div key={i} className="py-1.5 border-b border-zinc-800/40 last:border-0">
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
        <div className={`p-8 rounded-xl border text-center space-y-3 ${cardCls}`}>
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
        /* Three-Panel Workspace */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-[540px]">
          {/* Panel 1: Folders */}
          <div className={`${mobileFoldersOpen ? "block" : "hidden"} lg:block lg:col-span-2 p-2.5 rounded-xl border space-y-1 ${cardCls}`}>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${mutedCls}`}>Folders</span>
              {activeMailbox?.capabilities?.manage_folders && (
                <button
                  type="button"
                  onClick={() => setShowNewFolder((v) => !v)}
                  className="p-1 text-zinc-400 hover:text-amber-400 cursor-pointer"
                  title="New folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {showNewFolder && (
              <div className="p-1.5 space-y-1">
                <input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name"
                  className={`w-full px-2 py-1 rounded border text-xs ${inputCls}`}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!newFolderName.trim()) return;
                    await fetch("/api/mail/folders", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ mailboxId: activeMailbox.id, folderName: newFolderName.trim() }),
                    });
                    setNewFolderName("");
                    setShowNewFolder(false);
                    loadFolders(activeMailbox.id);
                  }}
                  className="w-full py-1 rounded bg-amber-500 text-zinc-950 text-[11px] font-semibold cursor-pointer"
                >
                  Create
                </button>
              </div>
            )}

            {folders.map((f) => (
              <button
                key={f.folderId}
                type="button"
                onClick={() => {
                  setActiveFolderId(f.folderId);
                  setActiveMessage(null);
                  setPage(0);
                  setMobileFoldersOpen(false);
                }}
                className={`w-full px-2.5 py-2 rounded-lg text-xs flex items-center justify-between cursor-pointer transition ${
                  activeFolderId === f.folderId ? "bg-amber-500/15 text-amber-400 font-semibold" : `hover:bg-zinc-800/40 ${mutedCls}`
                }`}
              >
                <span className="truncate">{f.folderName}</span>
                {f.unreadCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 font-bold">
                    {f.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel 2: Message List */}
          <div className={`${activeMessage ? "hidden lg:flex" : "flex"} lg:col-span-4 flex-col rounded-xl border overflow-hidden ${cardCls}`}>
            {/* Bulk Toolbar */}
            <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 text-xs ${subCls}`}>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={messages.length > 0 && selectedIds.size === messages.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(messages.map((m) => String(m.messageId))));
                    else setSelectedIds(new Set());
                  }}
                />
                <span className={`text-[11px] ${mutedCls}`}>{selectedIds.size > 0 ? `${selectedIds.size} selected` : `${messages.length} emails`}</span>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => runOperation("markRead", Array.from(selectedIds))} className="p-1.5 rounded hover:bg-zinc-800 cursor-pointer" title="Mark Read"><MailOpen className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => runOperation("archive", Array.from(selectedIds))} className="p-1.5 rounded hover:bg-zinc-800 cursor-pointer" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => runOperation("trash", Array.from(selectedIds))} className="p-1.5 rounded hover:bg-zinc-800 text-rose-400 cursor-pointer" title="Trash"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
              {messages.length === 0 ? (
                <div className={`p-8 text-center text-xs ${mutedCls}`}>
                  {loadingMessages ? "Loading emails..." : "No messages in this folder."}
                </div>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.messageId}
                    onClick={() => openMessage(m)}
                    className={`p-3 cursor-pointer flex items-start gap-2.5 transition ${
                      activeMessage?.messageId === m.messageId ? "bg-amber-500/10" : "hover:bg-zinc-800/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(String(m.messageId))}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(String(m.messageId));
                        else next.delete(String(m.messageId));
                        setSelectedIds(next);
                      }}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs truncate ${!m.isRead ? "font-bold" : "font-medium"}`}>
                          {m.fromName || m.fromAddress}
                        </span>
                        <span className={`text-[10px] shrink-0 ${mutedCls}`}>
                          {m.receivedTime ? new Date(m.receivedTime).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <div className={`text-xs truncate mt-0.5 ${!m.isRead ? "font-semibold" : ""}`}>{m.subject}</div>
                      <div className={`text-[11px] truncate mt-0.5 ${mutedCls}`}>{m.summary}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {m.hasAttachment && <Paperclip className="w-3 h-3 text-zinc-400" />}
                        {m.isStarred && <Star className="w-3 h-3 text-amber-400 fill-amber-400" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className={`px-3 py-2 border-t flex items-center justify-between text-xs ${subCls}`}>
              <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} className="p-1 disabled:opacity-40 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
              <span className={mutedCls}>Page {page + 1}</span>
              <button type="button" disabled={messages.length < 25} onClick={() => setPage((p) => p + 1)} className="p-1 disabled:opacity-40 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Panel 3: Reading Panel */}
          <div className={`${activeMessage ? "flex" : "hidden lg:flex"} lg:col-span-6 flex-col rounded-xl border overflow-hidden ${cardCls}`}>
            {!activeMessage ? (
              <div className={`flex-1 flex flex-col items-center justify-center p-8 text-center text-xs ${mutedCls}`}>
                <Inbox className="w-8 h-8 mb-2 opacity-50" />
                <p>Select an email to read, reply, or manage attachments.</p>
              </div>
            ) : (
              <>
                <div className={`p-3 border-b space-y-2 ${subCls}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveMessage(null)}
                      className="lg:hidden inline-flex items-center gap-1 text-xs font-semibold text-amber-400 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          onComposeAction({
                            mode: "reply",
                            to: activeMessage.fromAddress,
                            subject: activeMessage.subject?.startsWith("Re:") ? activeMessage.subject : `Re: ${activeMessage.subject}`,
                            bodyHtml: `<br/><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">${activeMessage.htmlContent || ""}</blockquote>`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
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
                            subject: activeMessage.subject?.startsWith("Re:") ? activeMessage.subject : `Re: ${activeMessage.subject}`,
                            bodyHtml: `<br/><blockquote style="border-left:2px solid #cbd5e1;padding-left:10px;color:#64748b;">${activeMessage.htmlContent || ""}</blockquote>`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
                      >
                        <ReplyAll className="w-3.5 h-3.5" /> Reply All
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onComposeAction({
                            mode: "forward",
                            subject: activeMessage.subject?.startsWith("Fwd:") ? activeMessage.subject : `Fwd: ${activeMessage.subject}`,
                            bodyHtml: `<br/><p>---------- Forwarded message ---------</p>${activeMessage.htmlContent || ""}`,
                            originalMessageId: activeMessage.messageId,
                          })
                        }
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs font-medium cursor-pointer ${cardCls}`}
                      >
                        <Forward className="w-3.5 h-3.5" /> Forward
                      </button>
                      <button type="button" onClick={() => runOperation("archive", [String(activeMessage.messageId)])} className={`p-1.5 rounded border cursor-pointer ${cardCls}`} title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                      <button type="button" onClick={() => runOperation("trash", [String(activeMessage.messageId)])} className={`p-1.5 rounded border text-rose-400 cursor-pointer ${cardCls}`} title="Trash"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">{activeMessage.subject}</h3>
                    <div className={`text-[11px] mt-1 ${mutedCls}`}>
                      From: <strong>{activeMessage.fromName}</strong> &lt;{activeMessage.fromAddress}&gt;
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
