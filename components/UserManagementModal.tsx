"use client";

import React, { useState } from "react";
import {
  X,
  UserPlus,
  Shield,
  Trash2,
  Key,
  Check,
  Lock,
  Unlock,
  RefreshCw,
  LogOut,
  Sliders,
  UserCheck,
  UserX,
} from "lucide-react";
import { User } from "../lib/types";
import {
  DEFAULT_STAFF_PERMISSIONS,
  PERMISSION_GROUPS,
  PermissionKey,
  normalizeRole,
} from "../lib/permissions";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onRefreshUsers: () => void;
  currentUserId?: string;
}

export default function UserManagementModal({
  isOpen,
  onClose,
  users,
  onRefreshUsers,
  currentUserId,
}: UserManagementModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "Staff">("Staff");
  const [mustChangeOnFirst, setMustChangeOnFirst] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPermUser, setEditingPermUser] = useState<User | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<Set<PermissionKey>>(new Set());
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [tempPassword, setTempPassword] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  function getAuthHeaders(): HeadersInit {
    let token = "";
    try {
      const raw = sessionStorage.getItem("aven_tab_session");
      if (raw) token = JSON.parse(raw).token || "";
    } catch {}
    return {
      "Content-Type": "application/json",
      ...(token ? { "x-tab-session": token } : {}),
    };
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setActionSuccess("");
    if (password.length < 12) {
      setActionError("Password must be at least 12 characters long.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          mustChangePassword: mustChangeOnFirst,
          permissions: role === "Staff" ? DEFAULT_STAFF_PERMISSIONS : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Failed to create user.");
      } else {
        setActionSuccess(`User ${email} created.`);
        setName("");
        setEmail("");
        setPassword("");
        setShowAddForm(false);
        onRefreshUsers();
      }
    } catch {
      setActionError("Network error while creating user.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUserAction(id: string, payload: Record<string, any>, successMessage: string) {
    setActionError("");
    setActionSuccess("");
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        credentials: "same-origin",
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, ...payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Operation failed.");
      } else {
        setActionSuccess(successMessage);
        onRefreshUsers();
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(id: string) {
    setActionError("");
    setActionSuccess("");
    setBusy(true);
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "Failed to delete user.");
      } else {
        setActionSuccess("User deleted.");
        onRefreshUsers();
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  function openPermEditor(u: User) {
    const initial =
      Array.isArray(u.permissions) && u.permissions.length > 0
        ? (u.permissions as PermissionKey[])
        : DEFAULT_STAFF_PERMISSIONS;
    setSelectedPerms(new Set(initial));
    setEditingPermUser(u);
  }

  async function savePermissions() {
    if (!editingPermUser) return;
    await handleUserAction(
      editingPermUser.id,
      { permissions: Array.from(selectedPerms) },
      `Permissions updated for ${editingPermUser.name}.`
    );
    setEditingPermUser(null);
  }

  async function submitTempPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTargetUser) return;
    if (tempPassword.length < 12) {
      setActionError("Temporary password must be at least 12 characters.");
      return;
    }
    await handleUserAction(
      resetTargetUser.id,
      { password: tempPassword },
      `Temporary password set for ${resetTargetUser.name}. User must change it on next login.`
    );
    setTempPassword("");
    setResetTargetUser(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl max-w-4xl w-full p-4 sm:p-6 text-zinc-100 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sm:pb-4 mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Shield className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                User Management &amp; RBAC Permissions
              </h2>
              <p className="text-[10px] sm:text-xs text-zinc-400">
                Manage Admin &amp; Staff accounts, granular permissions, password expiry, and active sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {actionError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
            {actionSuccess}
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-300">System Accounts ({users.length})</span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "Cancel" : "Add User"}</span>
            </button>
          </div>

          {showAddForm && (
            <form onSubmit={handleCreateUser} className="p-3 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Create New Account</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sales Executive"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="staff@avenautomation.in"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Temporary Password (Min 12 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 12 characters"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "Admin" | "Staff")}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-2 text-white"
                  >
                    <option value="Staff">Staff (Permission-Scoped)</option>
                    <option value="Admin">Admin (Full Access)</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mustChangeOnFirst}
                  onChange={(e) => setMustChangeOnFirst(e.target.checked)}
                />
                <span>Require password change on first login</span>
              </label>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          )}

          {/* Reset Temp Password Inline Box */}
          {resetTargetUser && (
            <form onSubmit={submitTempPassword} className="p-3 bg-amber-950/20 border border-amber-700/40 rounded-lg space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-300">
                  Admin Password Recovery for {resetTargetUser.name} ({resetTargetUser.email})
                </span>
                <button type="button" onClick={() => setResetTargetUser(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  placeholder="Enter temporary password (min 12 chars)"
                  className="flex-1 bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-4 py-1.5 rounded cursor-pointer"
                >
                  Set &amp; Force Change
                </button>
              </div>
            </form>
          )}

          {/* Staff Permission Matrix Editor */}
          {editingPermUser && (
            <div className="p-3 sm:p-4 bg-zinc-900 border border-indigo-500/40 rounded-lg space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div>
                  <h3 className="text-xs font-bold text-white">
                    Configure Staff Permissions — {editingPermUser.name}
                  </h3>
                  <p className="text-[10px] text-zinc-400">{editingPermUser.email}</p>
                </div>
                <button onClick={() => setEditingPermUser(null)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                {PERMISSION_GROUPS.map((group) => {
                  const groupKeys = group.items.map((i) => i.key);
                  return (
                    <div key={group.category} className="p-2.5 rounded-lg bg-black/50 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/70 pb-1.5">
                        <span className="text-[11px] font-bold text-amber-400">{group.category}</span>
                        <div className="flex items-center gap-2 text-[10px]">
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedPerms);
                              groupKeys.forEach((k) => next.add(k));
                              setSelectedPerms(next);
                            }}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = new Set(selectedPerms);
                              groupKeys.forEach((k) => next.delete(k));
                              setSelectedPerms(next);
                            }}
                            className="text-zinc-400 hover:text-rose-400 hover:underline cursor-pointer"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {group.items.map((item) => (
                          <label key={item.key} className="flex items-start gap-2 text-[11px] text-zinc-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPerms.has(item.key)}
                              onChange={(e) => {
                                const next = new Set(selectedPerms);
                                if (e.target.checked) next.add(item.key);
                                else next.delete(item.key);
                                setSelectedPerms(next);
                              }}
                              className="mt-0.5"
                            />
                            <span>
                              <strong className="font-medium text-white">{item.label}</strong>
                              <span className="block text-[10px] text-zinc-500">{item.description}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingPermUser(null)}
                  className="px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={savePermissions}
                  disabled={busy}
                  className="px-4 py-1.5 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  Save Staff Permissions
                </button>
              </div>
            </div>
          )}

          {/* Users List */}
          <div className="space-y-2.5">
            {users.map((u) => {
              const canonRole = normalizeRole(u.role);
              const isSelf = u.id === currentUserId;
              const isInactive = u.status === "inactive";
              const isLocked = Boolean(u.locked_until && u.locked_until > Date.now());
              return (
                <div
                  key={u.id}
                  className="p-3 bg-zinc-900/60 border border-zinc-800 rounded-lg space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-white shrink-0">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{u.name}</span>
                          {isSelf && (
                            <span className="text-[9px] bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 rounded">
                              You
                            </span>
                          )}
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded border ${
                              isInactive
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            }`}
                          >
                            {isInactive ? "Inactive" : "Active"}
                          </span>
                          {isLocked && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                              Locked
                            </span>
                          )}
                          {u.must_change_password && (
                            <span className="text-[9px] bg-purple-500/10 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                              PW Reset Req
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 truncate">{u.email}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <select
                        value={canonRole}
                        disabled={busy || isSelf}
                        onChange={(e) => handleUserAction(u.id, { role: e.target.value }, `Role updated to ${e.target.value}.`)}
                        className="bg-black border border-zinc-700 rounded px-2 py-1 text-[11px] font-semibold text-white cursor-pointer"
                      >
                        <option value="Admin">Admin</option>
                        <option value="Staff">Staff</option>
                      </select>

                      {canonRole === "Staff" && (
                        <button
                          type="button"
                          onClick={() => openPermEditor(u)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-[10px] font-semibold cursor-pointer"
                          title="Configure Staff Permissions"
                        >
                          <Sliders className="w-3 h-3" />
                          <span>Permissions</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata & Admin Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80 text-[10px] text-zinc-400">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        Last Login:{" "}
                        <strong className="text-zinc-300">
                          {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : "Never"}
                        </strong>
                      </span>
                      <span>
                        PW Expiry:{" "}
                        <strong className="text-zinc-300">
                          {u.password_expires_at ? new Date(u.password_expires_at).toLocaleDateString() : "Baseline on login"}
                        </strong>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {isLocked && (
                        <button
                          type="button"
                          onClick={() => handleUserAction(u.id, { unlockAccount: true }, `Unlocked ${u.name}.`)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 cursor-pointer"
                        >
                          <Unlock className="w-3 h-3" />
                          <span>Unlock</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setResetTargetUser(u)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                        title="Admin Password Recovery"
                      >
                        <Key className="w-3 h-3" />
                        <span>Reset PW</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUserAction(u.id, { forcePasswordChange: true }, `Forced password change on ${u.name}.`)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                        title="Force Password Change & Revoke Sessions"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Force PW</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUserAction(u.id, { revokeSessions: true }, `Sessions revoked for ${u.name}.`)}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                        title="Revoke All Active Sessions"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                      {!isSelf && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleUserAction(
                                u.id,
                                { status: isInactive ? "active" : "inactive" },
                                `${u.name} ${isInactive ? "activated" : "deactivated"}.`
                              )
                            }
                            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer"
                          >
                            {isInactive ? <UserCheck className="w-3 h-3 text-emerald-400" /> : <UserX className="w-3 h-3 text-amber-400" />}
                            <span>{isInactive ? "Activate" : "Deactivate"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 rounded cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
