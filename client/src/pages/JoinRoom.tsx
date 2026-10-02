import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { roomApi } from "../services/api";
import { getStoredUsername, saveUsername } from "../utils/user";
import { LogIn, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

export const JoinRoom: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialCode = searchParams.get("code") || "";

  const [roomCode, setRoomCode] = useState<string>(initialCode.toUpperCase());
  const [username, setUsername] = useState<string>(getStoredUsername() || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (initialCode) {
      setRoomCode(initialCode.toUpperCase());
    }
  }, [initialCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError("Please enter a 6-character room code.");
      return;
    }
    if (!username.trim()) {
      setError("Please enter your display name.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanCode = roomCode.trim().toUpperCase();
      // Verify room exists via REST API before navigating
      await roomApi.getRoom(cleanCode);

      saveUsername(username.trim());
      navigate(`/room/${cleanCode}`);
    } catch (err: any) {
      console.error("Room lookup failed:", err);
      const msg = err.response?.data?.error?.message || "Room not found. Please check the code and try again.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 blur-3xl rounded-full" />

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-blue-600/30">
            <LogIn size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Join a Watch Party</h1>
          <p className="text-xs text-slate-400">
            Enter the party room code and your name to join the sync session.
          </p>
        </div>

        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Room Code
            </label>
            <input
              type="text"
              placeholder="e.g. X7K92P"
              maxLength={10}
              required
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.toUpperCase());
                if (error) setError(null);
              }}
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-xl px-4 py-3 text-sm font-mono uppercase tracking-widest text-white placeholder-slate-500 outline-none transition-all text-center font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Your Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Aman"
              maxLength={25}
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm shadow-xl shadow-blue-600/30 transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Checking Room...</span>
              </>
            ) : (
              <>
                <span>Enter Room</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
