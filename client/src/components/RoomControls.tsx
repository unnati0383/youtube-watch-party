import React, { useState, useEffect } from "react";
import { useRoom } from "../context/RoomContext";
import { formatTime } from "../utils/youtube";
import { Play, Pause, RotateCcw, Lock, RefreshCw } from "lucide-react";

interface RoomControlsProps {
  currentTime: number;
  duration: number;
}

export const RoomControls: React.FC<RoomControlsProps> = ({ currentTime, duration }) => {
  const {
    playbackState,
    canControlPlayback,
    playVideo,
    pauseVideo,
    seekVideo,
    requestSync,
    requestControl,
  } = useRoom();

  const [sliderValue, setSliderValue] = useState<number>(currentTime);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [controlRequested, setControlRequested] = useState<boolean>(false);

  useEffect(() => {
    if (!isSeeking) {
      setSliderValue(currentTime);
    }
  }, [currentTime, isSeeking]);

  // Handle Play / Pause toggle
  const handleTogglePlay = () => {
    if (!canControlPlayback) return;
    if (playbackState.isPlaying) {
      pauseVideo(currentTime);
    } else {
      playVideo(currentTime);
    }
  };

  // Section 16: Send final seek position when seek action is completed, not hundreds while dragging!
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!canControlPlayback) return;
    setIsSeeking(true);
    setSliderValue(parseFloat(e.target.value));
  };

  const handleSliderCommit = () => {
    if (!canControlPlayback) return;
    setIsSeeking(false);
    seekVideo(sliderValue);
  };

  const handleRequestControlClick = () => {
    requestControl();
    setControlRequested(true);
    setTimeout(() => setControlRequested(false), 5000);
  };

  const safeDuration = duration > 0 ? duration : 100;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl backdrop-blur-md">
      {/* Participant Lock Alert if not Host or Moderator */}
      {!canControlPlayback && (
        <div className="flex items-center justify-between bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 mb-4 text-xs sm:text-sm text-slate-300">
          <div className="flex items-center gap-2">
            <Lock size={15} className="text-amber-400 shrink-0" />
            <span>
              <strong>Watch Mode:</strong> Playback controls are restricted to Host &amp; Moderators.
            </span>
          </div>
          <button
            onClick={handleRequestControlClick}
            disabled={controlRequested}
            className="text-xs px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg transition-colors font-medium"
          >
            {controlRequested ? "Requested!" : "Request Control"}
          </button>
        </div>
      )}

      {/* Seek Timeline Bar */}
      <div className="flex flex-col gap-1.5 mb-3">
        <div className="relative flex items-center group">
          <input
            type="range"
            min={0}
            max={safeDuration}
            step={0.5}
            value={sliderValue}
            disabled={!canControlPlayback}
            onChange={handleSliderChange}
            onMouseUp={handleSliderCommit}
            onTouchEnd={handleSliderCommit}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${
              canControlPlayback
                ? "bg-slate-700 accent-red-500 hover:h-2.5"
                : "bg-slate-800 accent-slate-500 cursor-not-allowed opacity-60"
            }`}
          />
        </div>

        {/* Time display */}
        <div className="flex justify-between items-center text-xs text-slate-400 font-mono">
          <span>{formatTime(sliderValue)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons Bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={handleTogglePlay}
            disabled={!canControlPlayback}
            title={canControlPlayback ? (playbackState.isPlaying ? "Pause" : "Play") : "Controls locked for viewers"}
            className={`flex items-center justify-center w-11 h-11 rounded-xl font-bold shadow-lg transition-all ${
              canControlPlayback
                ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-600/30 hover:scale-105 active:scale-95"
                : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50"
            }`}
          >
            {playbackState.isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          </button>

          {/* Quick jump -10s */}
          <button
            onClick={() => canControlPlayback && seekVideo(Math.max(0, currentTime - 10))}
            disabled={!canControlPlayback}
            title="Rewind 10s"
            className={`p-2.5 rounded-xl border text-sm font-medium transition-all ${
              canControlPlayback
                ? "border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200"
                : "border-slate-800 bg-slate-800/30 text-slate-600 cursor-not-allowed"
            }`}
          >
            <RotateCcw size={17} />
          </button>
        </div>

        {/* Sync Re-align Button */}
        <button
          onClick={requestSync}
          title="Force Re-synchronize with Server"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700/80 bg-slate-800/70 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all hover:text-white"
        >
          <RefreshCw size={14} />
          <span>Resync</span>
        </button>
      </div>
    </div>
  );
};
