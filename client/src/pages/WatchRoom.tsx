import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useRoom } from "../context/RoomContext";
import { YouTubePlayer } from "../components/YouTubePlayer";
import { RoomControls } from "../components/RoomControls";
import { VideoInput } from "../components/VideoInput";
import { ParticipantList } from "../components/ParticipantList";
import { ChatBox } from "../components/ChatBox";
import { getStoredUsername, saveUsername } from "../utils/user";
import { AlertCircle, Bell, ArrowRight, Loader2 } from "lucide-react";

export const WatchRoom: React.FC = () => {
  const { roomCode: paramCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();

  const {
    room,
    joinRoomSession,
    isRoomLoading,
    error,
    notification,
    clearError,
    clearNotification,
    isConnected,
  } = useRoom();

  const [usernamePrompt, setUsernamePrompt] = useState<boolean>(false);
  const [tempUsername, setTempUsername] = useState<string>(getStoredUsername() || "");
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  const targetRoomCode = (paramCode || "").trim().toUpperCase();

  // Load room on mount or URL change
  useEffect(() => {
    if (!targetRoomCode) {
      navigate("/");
      return;
    }

    const savedName = getStoredUsername();
    if (!savedName) {
      setUsernamePrompt(true);
    } else {
      // Connect to room using authoritative state from DB + Socket
      joinRoomSession(targetRoomCode, savedName);
    }
  }, [targetRoomCode, joinRoomSession, navigate]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUsername.trim()) return;

    saveUsername(tempUsername.trim());
    setUsernamePrompt(false);
    joinRoomSession(targetRoomCode, tempUsername.trim());
  };

  // Auto-dismiss notification after 4 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        clearNotification();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [notification, clearNotification]);

  // Username Prompt Modal for Direct Link visitors
  if (usernamePrompt) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-xl text-center">
          <h2 className="text-xl font-bold text-white mb-2">Joining Party {targetRoomCode}</h2>
          <p className="text-xs text-slate-400 mb-6">
            Please enter your display name to enter the synchronized room.
          </p>

          <form onSubmit={handleNameSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Your display name..."
              maxLength={25}
              required
              value={tempUsername}
              onChange={(e) => setTempUsername(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 focus:border-red-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 outline-none"
            />
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 text-white font-semibold text-sm shadow-lg shadow-red-600/30 transition-transform active:scale-98"
            >
              <span>Join Room</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Initial Room Loading State (Before DB response)
  if (isRoomLoading && !room) {
    return (
      <div className="min-h-[calc(100vh-65px)] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
        <h3 className="text-lg font-bold text-white">Loading Party Room {targetRoomCode}...</h3>
        <p className="text-xs text-slate-400">Fetching authoritative state from database.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Floating System Notifications */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2.5 bg-slate-900/95 border border-slate-700/80 text-slate-200 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-slideIn">
          <Bell size={16} className="text-amber-400 shrink-0 animate-bounce" />
          <span className="text-xs font-medium">{notification}</span>
          <button
            onClick={clearNotification}
            className="ml-2 text-slate-400 hover:text-white text-xs"
          >
            ×
          </button>
        </div>
      )}

      {/* Floating Error Alert */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-rose-950/90 border border-rose-500/50 text-rose-200 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-slideIn">
          <AlertCircle size={17} className="text-rose-400 shrink-0" />
          <span className="text-xs font-semibold">{error}</span>
          <button onClick={clearError} className="ml-3 text-rose-400 hover:text-white text-xs">
            ×
          </button>
        </div>
      )}

      {/* Connection Notice if Reconnecting */}
      {!isConnected && (
        <div className="flex items-center justify-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-2 rounded-xl text-xs">
          <Loader2 size={14} className="animate-spin" />
          <span>Reconnecting to party room... Synchronizing real-time state.</span>
        </div>
      )}

      {/* Main Grid: Player on Left, Side Panel on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Player, Controls, Video URL Input */}
        <div className="lg:col-span-8 flex flex-col gap-5">
          <YouTubePlayer
            onProgress={(time, dur) => {
              setCurrentTime(time);
              setDuration(dur);
            }}
          />

          <RoomControls currentTime={currentTime} duration={duration} />

          <VideoInput />
        </div>

        {/* Right Column: Participant List & Chat Box */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          <ParticipantList />
          <ChatBox />
        </div>
      </div>
    </div>
  );
};
