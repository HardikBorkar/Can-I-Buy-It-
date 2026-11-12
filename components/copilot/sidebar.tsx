"use client";

import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  Pencil,
  Trash2,
  Check,
  X,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { HistorySession } from "./types";
import { ConnectedAccount } from "./modals";

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  sessions: HistorySession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onRenameSession?: (id: string, newTitle: string) => void;
  onDeleteSession?: (id: string) => void;
  onOpenSettings?: () => void;
  activeAccount?: ConnectedAccount | null;
  onOpenAccountModal?: () => void;
}

export function CopilotSidebar({
  isCollapsed,
  onToggleCollapse,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  activeAccount,
  onOpenAccountModal,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const handleStartRename = (e: React.MouseEvent, session: HistorySession) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (e: React.MouseEvent | React.FormEvent, id: string) => {
    e.stopPropagation();
    if (editTitle.trim() && onRenameSession) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onDeleteSession) {
      onDeleteSession(id);
    }
  };

  // Group sessions by date
  const todaySessions = sessions.filter((s) => s.dateGroup === "today" || !s.dateGroup);
  const olderSessions = sessions.filter((s) => s.dateGroup === "previous7Days");

  return (
    <aside
      className={`relative flex flex-col bg-[#0B0B0E] border-r border-zinc-800/60 transition-all duration-300 select-none z-30 shrink-0 h-full ${
        isCollapsed ? "w-16" : "w-64"
      }`}
    >
      {/* 1. Top Branding & New Chat Button */}
      <div className="p-3 space-y-2.5">
        {/* Workspace Branding */}
        <div
          className={`flex items-center justify-between ${
            isCollapsed ? "justify-center" : "px-1"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <img
              src="/guardian-shield-icon.png"
              alt="Guardian"
              className="w-5 h-5 rounded object-cover border border-zinc-700/60 shadow-sm shrink-0"
            />
            {!isCollapsed && (
              <span className="font-semibold text-xs text-zinc-100 tracking-tight block truncate">
                Guardian Copilot
              </span>
            )}
          </div>

          {!isCollapsed && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sandbox
            </span>
          )}
        </div>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={onNewChat}
          className={`w-full flex items-center justify-between py-2 px-3 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-200 text-xs font-medium transition shadow-sm group ${
            isCollapsed ? "justify-center px-1" : ""
          }`}
          title="Start a new chat (Ctrl+K)"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-violet-400 group-hover:rotate-90 transition-transform duration-200" />
            {!isCollapsed && <span>New Chat</span>}
          </div>
          {!isCollapsed && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/60">
              Ctrl+K
            </span>
          )}
        </button>
      </div>

      {/* 2. Chat History (Center Stage) */}
      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4 scrollbar-none">
        {/* Today's Threads */}
        {todaySessions.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Today
              </div>
            )}
            {todaySessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? "bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60"
                  } ${isCollapsed ? "justify-center px-1" : ""}`}
                  title={session.title}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-200 transition-colors" />

                  {!isCollapsed && (
                    <>
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(e, session.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(e, session.id)}
                            className="p-1 hover:text-emerald-400"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 hover:text-rose-400"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 truncate text-left">{session.title}</span>

                          {/* Hover Action Buttons: Rename & Delete */}
                          <div className="hidden group-hover:flex items-center gap-1 text-zinc-500">
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(e, session)}
                              className="p-1 hover:text-zinc-200 transition"
                              title="Rename chat"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, session.id)}
                              className="p-1 hover:text-rose-400 transition"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Previous 7 Days */}
        {olderSessions.length > 0 && (
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Previous 7 Days
              </div>
            )}
            {olderSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              const isEditing = editingId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`group relative w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                    isActive
                      ? "bg-zinc-800/80 text-zinc-100 border border-zinc-700/60 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60"
                  } ${isCollapsed ? "justify-center px-1" : ""}`}
                  title={session.title}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-zinc-400 group-hover:text-zinc-200 transition-colors" />

                  {!isCollapsed && (
                    <>
                      {isEditing ? (
                        <div
                          className="flex items-center gap-1 w-full"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveRename(e, session.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="flex-1 px-1.5 py-0.5 text-xs bg-zinc-900 border border-zinc-700 rounded text-zinc-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveRename(e, session.id)}
                            className="p-1 hover:text-emerald-400"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelRename}
                            className="p-1 hover:text-rose-400"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="flex-1 truncate text-left">{session.title}</span>

                          {/* Hover Action Buttons: Rename & Delete */}
                          <div className="hidden group-hover:flex items-center gap-1 text-zinc-500">
                            <button
                              type="button"
                              onClick={(e) => handleStartRename(e, session)}
                              className="p-1 hover:text-zinc-200 transition"
                              title="Rename chat"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(e, session.id)}
                              className="p-1 hover:text-rose-400 transition"
                              title="Delete chat"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Bottom Footer: Minimal User Profile & Collapse Toggle */}
      <div className="p-2 flex items-center justify-between gap-1 border-t border-zinc-900/60">
        {!isCollapsed ? (
          <>
            <button
              type="button"
              onClick={onOpenAccountModal}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs min-w-0 hover:bg-zinc-800/70 transition group text-left cursor-pointer flex-1"
              title="Switch PayPal Persona or Connect Account"
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                {activeAccount?.name ? activeAccount.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-200 text-xs truncate block group-hover:text-blue-400 transition">
                  {activeAccount?.name || "Alex Parik"}
                </span>
                <span className="text-[10px] text-zinc-400 font-mono block truncate">
                  ${(activeAccount?.balance ?? 3500).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </span>
              </div>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAccountModal}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-blue-400 transition"
              title={`Active Account: ${activeAccount?.name || "Alex Parik"} ($${(activeAccount?.balance ?? 3500).toFixed(2)})`}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                {activeAccount?.name ? activeAccount.name.charAt(0).toUpperCase() : "A"}
              </div>
            </button>

            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title="Expand sidebar (Ctrl+B)"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
