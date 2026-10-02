import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRoom } from "../context/RoomContext";
import { Copy, Check, Tv, Crown, Shield, User, LogOut, Radio } from "lucide-react";

export const Navbar: React.FC = () => {
  const { roomCode, currentUser, isConnected, leaveRoomSession } = useRoom();
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCopyLink = () => {
    if (!roomCode) return;
    const url = `${window.location.origin}/room/${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    leaveRoomSession();
    navigate("/");
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Host":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Crown size={12} className="text-amber-400" /> Host
          </span>
        );
      case "Moderator":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Shield size={12} className="text-blue-400" /> Mod
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/60 text-slate-300 border border-slate-600/50">
            <User size={12} className="text-slate-400" /> Viewer
          </span>
        );
    }
  };

  return (
    <nav className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-50 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-rose-500 flex items-center justify-center shadow-lg shadow-red-600/30 group-hover:scale-105 transition-transform">
            <Tv className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              Watch Party
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  isConnected ? "bg-emerald-500 shadow-sm shadow-emerald-500/80 animate-pulse" : "bg-red-500"
                }`}
              />
              {isConnected ? "Real-time Synced" : "Connecting..."}
            </div>
          </div>
        </Link>

        {/* Room & User Status */}
        <div className="flex items-center gap-3">
          {roomCode && (
            <>
              {/* Room Code Badge */}
              <div className="hidden sm:flex items-center gap-2 bg-slate-800/80 border border-slate-700/70 px-3 py-1.5 rounded-lg text-sm">
                <Radio size={14} className="text-red-500 animate-pulse" />
                <span className="text-slate-400 text-xs">ROOM:</span>
                <span className="font-mono font-bold tracking-wider text-white">
                  {roomCode}
                </span>
                <button
                  onClick={handleCopyLink}
                  title="Copy room invite link"
                  className="ml-1 text-slate-400 hover:text-white transition-colors p-1 hover:bg-slate-700 rounded"
                >
                  {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
              </div>

              {/* User Identity Badge */}
              <div className="flex items-center gap-2 bg-slate-800/50 border border-slate-700/50 px-3 py-1 rounded-lg">
                <span className="text-sm font-medium text-slate-200">
                  {currentUser.username}
                </span>
                {getRoleBadge(currentUser.role)}
              </div>

              {/* Leave Room Button */}
              <button
                onClick={handleLeave}
                title="Leave Room"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Leave</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
