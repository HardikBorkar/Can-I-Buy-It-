"use client";

import React, { useState } from "react";
import {
  Shield,
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
      <div className="p-3 border-b border-zinc-850/60 space-y-2.5">
        {/* Workspace Branding */}
        <div
          className={`flex items-center justify-between ${
            isCollapsed ? "justify-center" : "px-1"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-violet-600 via-indigo-600 to-emerald-500 p-[1px] shrink-0 shadow-sm shadow-violet-500/20">
              <div className="w-full h-full bg-[#0E0E12] rounded-[7px] flex items-center justify-center">
                <Shield className="w-3.5 h-3.5 text-violet-400" />
              </div>
            </div>

            {!isCollapsed && (
              <div className="truncate">
                <span className="font-semibold text-xs text-zinc-100 tracking-tight block truncate">
                  Guardian Copilot
                </span>
                <span className="text-[10px] text-zinc-500 font-mono block">
                  v2.4
                </span>
              </div>
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
      <div className="p-2 border-t border-zinc-850/60 flex items-center justify-between gap-1">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs min-w-0">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center font-bold text-xs text-white shrink-0">
                A
              </div>
              <span className="font-medium text-zinc-200 text-xs truncate">
                Alex Parik
              </span>
            </div>

            <div className="flex items-center gap-0.5">
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
          <button
            type="button"
            onClick={onToggleCollapse}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
            title="Expand sidebar (Ctrl+B)"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
