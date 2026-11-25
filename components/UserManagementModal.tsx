"use client";

import React, { useState } from "react";
import { X, UserPlus, Shield, Trash2, Key, Check } from "lucide-react";
import { User } from "../lib/types";

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onAddUser: (user: Omit<User, "id">) => void;
  onDeleteUser: (id: string) => void;
  onUpdateRole: (id: string, role: "Admin" | "User") => void;
  currentUserId?: string;
}

export default function UserManagementModal({
  isOpen,
  onClose,
  users,
  onAddUser,
  onDeleteUser,
  onUpdateRole,
}: UserManagementModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"Admin" | "User">("User");
  const [showAddForm, setShowAddForm] = useState(false);

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !password) return;
    onAddUser({ name, email, role, active: true });
    setName("");
    setEmail("");
    setPassword("");
    setShowAddForm(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl max-w-2xl w-full p-4 sm:p-6 text-zinc-100 shadow-2xl relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 sm:pb-4 mb-3 sm:mb-4 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-zinc-900 border border-zinc-800 rounded-lg">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                User Roles & Access Control
              </h2>
              <p className="text-[10px] sm:text-xs text-zinc-400">
                Manage system users, permission roles (Admin, User), and credentials
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

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Add User Toggle */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-semibold text-zinc-300">
              System Users ({users.length})
            </span>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 text-xs font-bold bg-white text-black px-3 py-1.5 rounded-lg hover:bg-zinc-200 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{showAddForm ? "Cancel" : "Add New User"}</span>
            </button>
          </div>

          {/* Add User Form */}
          {showAddForm && (
            <form
              onSubmit={handleSubmit}
              className="p-3 sm:p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3"
            >
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Create New Account
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Narendra Khamkar"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@avenautomation.in"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Initial Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white placeholder-zinc-500 focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Assigned Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as "Admin" | "User")}
                    className="w-full bg-black border border-zinc-700 rounded px-2.5 py-1.5 text-white focus:outline-none focus:border-white"
                  >
                    <option value="Admin">Admin (Full Control, DB, Users)</option>
                    <option value="User">User (Create & Edit Quotes)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="bg-white text-black font-bold text-xs px-4 py-1.5 rounded hover:bg-zinc-200 transition cursor-pointer"
                >
                  Save User
                </button>
              </div>
            </form>
          )}

          {/* Users Table */}
          <div className="border border-zinc-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[460px]">
              <thead className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Role</th>
                  <th className="py-2 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-900/50">
                    <td className="py-2.5 px-3 font-medium text-white flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-[10px]">
                        {u.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[120px]">{u.name}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-zinc-400 text-[11px] truncate max-w-[140px]">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={u.role}
                        onChange={(e) => onUpdateRole(u.id, e.target.value as "Admin" | "User")}
                        className="bg-black border border-zinc-700 rounded px-2 py-0.5 text-xs text-white"
                      >
                        <option value="Admin">Admin</option>
                        <option value="User">User</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {u.role !== "Admin" && (
                        <button
                          onClick={() => onDeleteUser(u.id)}
                          className="text-zinc-500 hover:text-red-400 p-1 transition cursor-pointer"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end pt-3 sm:pt-4 mt-3 sm:mt-4 border-t border-zinc-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs rounded-lg transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
