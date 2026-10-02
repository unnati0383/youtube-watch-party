import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { roomApi } from "../services/api";
import { getOrCreateUserId, getStoredUsername, saveUsername } from "../utils/user";
import { Sparkles, ArrowRight, AlertCircle, Loader2 } from "lucide-react";

export const CreateRoom: React.FC = () => {
  const [username, setUsername] = useState<string>(getStoredUsername() || "");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userId = getOrCreateUserId();
      saveUsername(username.trim());

      const createdRoom = await roomApi.createRoom(userId, username.trim());
      navigate(`/room/${createdRoom.roomCode}`);
    } catch (err: any) {
      console.error("Create room failed:", err);
      const msg = err.response?.data?.error?.message || "Failed to create room. Please try again.";
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 blur-3xl rounded-full" />

        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-red-600 to-rose-600 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-red-600/30">
            <Sparkles size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Create a Watch Party</h1>
          <p className="text-xs text-slate-400">
            You will be assigned as the <strong className="text-amber-400">Host</strong> with full playback controls.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Your Display Name
            </label>
            <input
              type="text"
              placeholder="e.g. Unnati"
              maxLength={25}
              required
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError(null);
              }}
              className="w-full bg-slate-950/80 border border-slate-700/80 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition-all"
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
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm shadow-xl shadow-red-600/30 transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating Room...</span>
              </>
            ) : (
              <>
                <span>Launch Watch Party</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
