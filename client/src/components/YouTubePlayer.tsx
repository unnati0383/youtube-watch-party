import React, { useEffect, useRef } from "react";
import { useRoom } from "../context/RoomContext";
import { useYouTubePlayer } from "../hooks/useYouTubePlayer";
import { Volume2, VolumeX, Play, ShieldAlert, Maximize, AlertCircle } from "lucide-react";

interface YouTubePlayerProps {
  onProgress?: (currentTime: number, duration: number) => void;
}

export const YouTubePlayer: React.FC<YouTubePlayerProps> = ({ onProgress }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const outerWrapperRef = useRef<HTMLDivElement>(null);
  const {
    playbackState,
    canControlPlayback,
    playVideo,
    pauseVideo,
    registerPlayerHandlers,
  } = useRoom();

  const {
    isReady,
    currentTime,
    duration,
    autoplayBlocked,
    errorMessage,
    volume,
    isMuted,
    setVolume,
    toggleMute,
    applyRemotePlay,
    applyRemotePause,
    applyRemoteSeek,
    applyRemoteVideoChange,
    handleAutoplayUnlock,
    clearPlayerError,
  } = useYouTubePlayer({
    containerRef,
    videoId: playbackState.videoId || "dQw4w9WgXcQ",
    targetTime: playbackState.currentTime || 0,
    shouldPlay: playbackState.isPlaying,
    canControl: canControlPlayback,
    onLocalPlay: (time) => {
      // Local authorized user hit play directly on iframe
      playVideo(time);
    },
    onLocalPause: (time) => {
      // Local authorized user hit pause directly on iframe
      pauseVideo(time);
    },
  });

  // Register remote handler bridges with context
  useEffect(() => {
    registerPlayerHandlers({
      onRemotePlay: (time) => applyRemotePlay(time),
      onRemotePause: (time) => applyRemotePause(time),
      onRemoteSeek: (time) => applyRemoteSeek(time),
      onRemoteVideoChange: (vid, startTime, isPlay) =>
        applyRemoteVideoChange(vid, startTime, isPlay),
    });
  }, [
    registerPlayerHandlers,
    applyRemotePlay,
    applyRemotePause,
    applyRemoteSeek,
    applyRemoteVideoChange,
  ]);

  // Report time updates up to parent controls
  useEffect(() => {
    if (onProgress) {
      onProgress(currentTime, duration);
    }
  }, [currentTime, duration, onProgress]);

  const handleFullscreen = () => {
    if (outerWrapperRef.current) {
      if (!document.fullscreenElement) {
        outerWrapperRef.current.requestFullscreen().catch((err) => {
          console.warn("Fullscreen request failed:", err);
        });
      } else {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div
      ref={outerWrapperRef}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-slate-800 select-none group"
    >
      {/* 
        Container Ref for YouTube IFrame Mounting
        The useYouTubePlayer hook dynamically mounts an inner target node inside this container.
      */}
      <div
        ref={containerRef}
        className={`w-full h-full ${
          canControlPlayback ? "pointer-events-auto" : "pointer-events-none"
        }`}
      />

      {/* 
        BUG 3 FIX: Participant Interaction Barrier
        When the user is a Participant (canControlPlayback === false), this transparent
        overlay intercepts all clicks, double-clicks, touches, and drags over the YouTube video.
        This prevents participants from directly playing, pausing, seeking, or changing
        the video via the YouTube player interface.
      */}
      {!canControlPlayback && (
        <div
          className="absolute inset-0 z-10 cursor-default select-none"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title="Playback is synchronized by Host & Moderators"
        />
      )}

      {/* Loading Placeholder before IFrame API is ready */}
      {!isReady && (
        <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-20">
          <div className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full animate-spin" />
          <p className="text-slate-300 text-sm font-medium">Connecting to YouTube Player...</p>
          <p className="text-slate-500 text-xs">Synchronizing stream with room session</p>
        </div>
      )}

      {/* Error Message if YouTube reports unplayable / embed blocked video */}
      {errorMessage && (
        <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-30 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center mb-3 text-red-400">
            <AlertCircle size={28} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Video Playback Notice</h3>
          <p className="text-slate-300 text-sm max-w-md mb-4">{errorMessage}</p>
          <button
            onClick={clearPlayerError}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition-colors"
          >
            Dismiss Notice
          </button>
        </div>
      )}

      {/* Autoplay Policy Limitation Banner */}
      {autoplayBlocked && (
        <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-30 animate-fadeIn">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3">
            <Volume2 className="w-7 h-7 text-amber-400 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            Browser Autoplay Limitation
          </h3>
          <p className="text-slate-300 text-sm max-w-md mb-4">
            Your browser requires an explicit user interaction before playing audio in a synced session.
          </p>
          <button
            onClick={handleAutoplayUnlock}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold shadow-lg shadow-red-600/40 transition-transform active:scale-95 pointer-events-auto"
          >
            <Play size={18} fill="currentColor" /> Click to Start Synchronized Playback
          </button>
        </div>
      )}

      {/* Participant Read-Only Lock Badge Overlay */}
      {!canControlPlayback && (
        <div className="absolute top-3 left-3 z-20 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-full text-xs text-slate-300 flex items-center gap-1.5 shadow-lg pointer-events-none">
          <ShieldAlert size={14} className="text-blue-400" />
          <span>Synced with Host &amp; Moderators (Controls Locked)</span>
        </div>
      )}

      {/* Bottom Viewer Controls (Local Volume & Fullscreen - Independent of sync) */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Local Mute/Unmute */}
        <button
          onClick={toggleMute}
          title={isMuted ? "Unmute local audio" : "Mute local audio"}
          className="text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>

        {/* Local Volume Slider */}
        <input
          type="range"
          min={0}
          max={100}
          value={isMuted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-16 h-1 bg-slate-700 accent-red-500 rounded-lg cursor-pointer"
          title={`Volume: ${isMuted ? 0 : volume}%`}
        />

        {/* Fullscreen Toggle */}
        <button
          onClick={handleFullscreen}
          title="Toggle Fullscreen"
          className="text-slate-300 hover:text-white transition-colors ml-1 cursor-pointer"
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
};
