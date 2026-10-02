import React, { useState } from "react";
import { useRoom } from "../context/RoomContext";
import { extractYouTubeVideoId } from "../utils/youtube";
import { Video, ArrowRight, AlertTriangle } from "lucide-react";

export const VideoInput: React.FC = () => {
  const { canControlPlayback, changeVideo } = useRoom();
  const [urlInput, setUrlInput] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!canControlPlayback) {
      setValidationError("Only Host and Moderators can change the video.");
      return;
    }

    if (!urlInput.trim()) {
      setValidationError("Please paste a YouTube URL or Video ID.");
      return;
    }

    const videoId = extractYouTubeVideoId(urlInput);
    if (!videoId) {
      setValidationError("Invalid YouTube URL. Please provide a standard watch link or video ID.");
      return;
    }

    changeVideo(videoId);
    setUrlInput("");
  };

  if (!canControlPlayback) {
    return null;
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
          <Video size={15} className="text-red-500" />
          <span>Change Video (Host &amp; Moderators)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Paste YouTube link (e.g. https://www.youtube.com/watch?v=...)"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (validationError) setValidationError(null);
            }}
            className="flex-1 bg-slate-950/80 border border-slate-700/80 focus:border-red-500/80 focus:ring-1 focus:ring-red-500/50 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 outline-none transition-all"
          />
          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium text-sm rounded-xl shadow-md shadow-red-600/20 transition-all hover:scale-105 active:scale-95 shrink-0"
          >
            <span>Load</span>
            <ArrowRight size={15} />
          </button>
        </div>

        {validationError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg mt-1">
            <AlertTriangle size={13} className="shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </form>
    </div>
  );
};
