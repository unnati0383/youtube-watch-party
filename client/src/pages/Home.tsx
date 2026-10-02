import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlusCircle, LogIn, Sparkles, ShieldCheck, Zap, Users, Play } from "lucide-react";

export const Home: React.FC = () => {
  const [roomCodeInput, setRoomCodeInput] = useState<string>("");
  const navigate = useNavigate();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCodeInput.trim()) return;
    navigate(`/join-room?code=${roomCodeInput.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="max-w-3xl w-full text-center relative z-10">
        {/* Hero Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold mb-6 shadow-sm">
          <Sparkles size={14} />
          <span>Real-time YouTube Synchronizer</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-5 leading-tight">
          Watch YouTube Together,{" "}
          <span className="bg-gradient-to-r from-red-500 via-rose-400 to-amber-300 bg-clip-text text-transparent">
            Perfect In-Sync.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed">
          Create a private room, invite your friends, and watch videos with synchronized play, pause, seek, and real-time chat.
        </p>

        {/* Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto mb-14 text-left">
          {/* Card 1: Create Room */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-red-500/40 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4 group-hover:scale-105 transition-transform">
                <PlusCircle size={24} />
              </div>
              <h2 className="text-lg font-bold text-white mb-1.5">Host a New Party</h2>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Generate an instant room code. You will automatically receive full Host playback permissions.
              </p>
            </div>
            <button
              onClick={() => navigate("/create-room")}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-red-600/30 transition-all hover:scale-102 active:scale-98"
            >
              <span>Create Room</span>
              <Play size={15} fill="currentColor" />
            </button>
          </div>

          {/* Card 2: Join Existing Room */}
          <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl shadow-xl hover:border-blue-500/40 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-105 transition-transform">
                <LogIn size={24} />
              </div>
              <h2 className="text-lg font-bold text-white mb-1.5">Join Existing Party</h2>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                Have a 6-character room code from a friend? Enter it below to jump directly into the room.
              </p>
            </div>

            <form onSubmit={handleJoin} className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. X7K92P"
                maxLength={6}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950/90 border border-slate-700/80 focus:border-blue-500 rounded-xl px-3.5 py-2.5 text-sm font-mono uppercase text-white placeholder-slate-500 outline-none text-center tracking-wider"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-sm transition-all hover:scale-102 active:scale-98 shrink-0"
              >
                Join
              </button>
            </form>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-slate-800/80 text-left">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                Sub-Second Sync
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                WebSocket-driven play, pause, and seek keeps all viewers aligned.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                Role-Based RBAC
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Strict backend authorization prevents unauthorized controls.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wide">
                Live Participant Roster
              </h4>
              <p className="text-xs text-slate-400 mt-1">
                Real-time connection tracking, host promotion, and interactive chat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
