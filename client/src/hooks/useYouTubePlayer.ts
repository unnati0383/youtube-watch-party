import { useEffect, useRef, useState, useCallback } from "react";

// Minimal YouTube IFrame API TypeScript declarations
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

/**
 * Singleton API Loader for YouTube IFrame API.
 * Guarantees that:
 * 1. The script tag is inserted only once across the entire application lifecycle.
 * 2. React 19 StrictMode double-mounting cannot cause lost callbacks or hung promises.
 * 3. Both window.onYouTubeIframeAPIReady and polling fallbacks are utilized.
 */
let apiPromise: Promise<void> | null = null;

export function loadYouTubeIframeAPI(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Window is undefined"));
  }

  // Already loaded and available
  if (window.YT && window.YT.Player) {
    return Promise.resolve();
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise<void>((resolve) => {
    // 1. Polling interval: checks every 60ms in case the script is already cached/executing
    const pollInterval = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(pollInterval);
        resolve();
      }
    }, 60);

    // 2. Safety timeout fallback: stop polling after 12s
    setTimeout(() => {
      clearInterval(pollInterval);
      if (window.YT && window.YT.Player) {
        resolve();
      }
    }, 12000);

    // 3. YouTube standard ready callback
    const prevOnReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prevOnReady === "function") {
        try {
          prevOnReady();
        } catch (e) {
          console.warn("[YouTube API] Previous onYouTubeIframeAPIReady handler error:", e);
        }
      }
      clearInterval(pollInterval);
      resolve();
    };

    // 4. Inject script tag into DOM
    if (!document.getElementById("youtube-iframe-api-script")) {
      const tag = document.createElement("script");
      tag.id = "youtube-iframe-api-script";
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      } else {
        document.head.appendChild(tag);
      }
    }
  });

  return apiPromise;
}

interface UseYouTubePlayerProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  videoId: string;
  onLocalPlay?: (time: number) => void;
  onLocalPause?: (time: number) => void;
  canControl: boolean;
  targetTime?: number;
  shouldPlay?: boolean;
}

interface PendingSyncState {
  videoId?: string;
  currentTime?: number;
  isPlaying?: boolean;
}

export function useYouTubePlayer({
  containerRef,
  videoId,
  onLocalPlay,
  onLocalPause,
  canControl,
  targetTime = 0,
  shouldPlay = false,
}: UseYouTubePlayerProps) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [volume, setVolumeState] = useState<number>(100);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  /**
   * Pending Sync Buffer:
   * If a remote state arrives before the YouTube iframe is ready,
   * we store it in pendingSyncRef and apply it deterministically in onReady.
   */
  const pendingSyncRef = useRef<PendingSyncState | null>(null);

  /**
   * isApplyingRemoteUpdate:
   * When remote events arrive from Socket.IO, player.playVideo() or player.seekTo()
   * triggers YouTube's onStateChange. We suppress re-emitting socket events during
   * remote updates to eliminate infinite loops.
   */
  const isApplyingRemoteUpdate = useRef<boolean>(false);
  const currentVideoLoadedRef = useRef<string>(videoId);

  // Keep latest props in refs for onReady closure
  const targetVideoIdRef = useRef<string>(videoId);
  targetVideoIdRef.current = videoId;

  const targetTimeRef = useRef<number>(targetTime);
  targetTimeRef.current = targetTime;

  const shouldPlayRef = useRef<boolean>(shouldPlay);
  shouldPlayRef.current = shouldPlay;

  const canControlRef = useRef<boolean>(canControl);
  canControlRef.current = canControl;

  // Initialize YouTube Player
  useEffect(() => {
    let isCancelled = false;
    let watchdogTimer: any = null;

    loadYouTubeIframeAPI()
      .then(() => {
        if (isCancelled || !containerRef.current) return;

        // Reset container DOM to prevent duplicate or detached iframes
        containerRef.current.innerHTML = "";

        // Create an inner DOM anchor for YouTube IFrame replacement
        const mountTarget = document.createElement("div");
        mountTarget.id = `yt-player-target-${Math.random().toString(36).substring(2, 9)}`;
        mountTarget.style.width = "100%";
        mountTarget.style.height = "100%";
        containerRef.current.appendChild(mountTarget);

        const initialVid = targetVideoIdRef.current || "dQw4w9WgXcQ";

        try {
          playerRef.current = new window.YT.Player(mountTarget, {
            width: "100%",
            height: "100%",
            videoId: initialVid,
            playerVars: {
              autoplay: shouldPlayRef.current ? 1 : 0,
              controls: canControlRef.current ? 1 : 0, // Role-aware controls
              disablekb: canControlRef.current ? 0 : 1, // Role-aware keyboard shortcuts
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              playsinline: 1,
              fs: 1,
            },
            events: {
              onReady: (event: any) => {
                if (isCancelled) return;
                console.log("[YouTube Player] onReady fired for video:", initialVid);
                setIsReady(true);
                currentVideoLoadedRef.current = initialVid;
                setDuration(event.target.getDuration ? event.target.getDuration() : 0);

                // Apply pending sync state or latest room state
                applyInitialSync(event.target, initialVid);
              },
              onStateChange: handleStateChange,
              onError: (err: any) => {
                if (isCancelled) return;
                console.warn("[YouTube Player] Player error code:", err.data);
                setIsReady(true); // Ensure loading spinner is dismissed

                let msg = "An error occurred with this video.";
                if (err.data === 2) msg = "Invalid YouTube video ID or URL.";
                if (err.data === 5) msg = "HTML5 player error. Please try again.";
                if (err.data === 100) msg = "Video not found or has been removed.";
                if (err.data === 101 || err.data === 150) {
                  msg =
                    "The video owner has disabled playback in embedded players. Please enter a different YouTube video URL.";
                }
                setErrorMessage(msg);
              },
            },
          });

          // Watchdog timer: If onReady doesn't fire within 3.5s, verify and release UI
          watchdogTimer = setTimeout(() => {
            if (isCancelled) return;
            console.log("[YouTube Player] Watchdog checking player status...");
            if (playerRef.current) {
              setIsReady(true);
              if (shouldPlayRef.current) {
                tryPlay(playerRef.current);
              }
            }
          }, 3500);
        } catch (err) {
          console.error("[YouTube Player] Initialization exception:", err);
          if (!isCancelled) setIsReady(true);
        }
      })
      .catch((err) => {
        console.error("[YouTube Player] Failed to load YouTube API:", err);
        if (!isCancelled) setIsReady(true);
      });

    return () => {
      isCancelled = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (playerRef.current) {
        try {
          if (typeof playerRef.current.destroy === "function") {
            playerRef.current.destroy();
          }
        } catch (e) {
          console.warn("[YouTube Player] Clean destroy error:", e);
        }
        playerRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      setIsReady(false);
    };
  }, [containerRef]);

  /**
   * Applies buffered sync or current room properties once player onReady has completed
   */
  function applyInitialSync(player: any, initialLoadedVid: string) {
    if (pendingSyncRef.current) {
      const pending = pendingSyncRef.current;
      pendingSyncRef.current = null;
      console.log("[YouTube Player] Applying buffered pending state:", pending);

      if (pending.videoId && pending.videoId !== initialLoadedVid) {
        currentVideoLoadedRef.current = pending.videoId;
        isApplyingRemoteUpdate.current = true;
        player.loadVideoById({
          videoId: pending.videoId,
          startSeconds: pending.currentTime || 0,
        });
      } else if (pending.currentTime !== undefined && pending.currentTime > 0) {
        player.seekTo(pending.currentTime, true);
      }

      if (pending.isPlaying) {
        tryPlay(player);
      } else {
        try {
          player.pauseVideo();
        } catch (e) {}
      }

      setTimeout(() => {
        isApplyingRemoteUpdate.current = false;
      }, 800);
    } else {
      // Check if target video changed while player was loading
      const currentTargetVid = targetVideoIdRef.current;
      if (currentTargetVid && currentTargetVid !== initialLoadedVid) {
        currentVideoLoadedRef.current = currentTargetVid;
        isApplyingRemoteUpdate.current = true;
        player.loadVideoById({
          videoId: currentTargetVid,
          startSeconds: targetTimeRef.current || 0,
        });
        if (shouldPlayRef.current) {
          tryPlay(player);
        } else {
          try {
            player.pauseVideo();
          } catch (e) {}
        }
        setTimeout(() => {
          isApplyingRemoteUpdate.current = false;
        }, 800);
      } else {
        if (targetTimeRef.current > 0) {
          player.seekTo(targetTimeRef.current, true);
        }
        if (shouldPlayRef.current) {
          tryPlay(player);
        }
      }
    }
  }

  function tryPlay(player: any) {
    if (!player || typeof player.playVideo !== "function") return;
    try {
      player.playVideo();
      setIsPlaying(true);

      // Verify playback started (browser autoplay policy detection)
      setTimeout(() => {
        if (player && typeof player.getPlayerState === "function") {
          const state = player.getPlayerState();
          // States: -1 = unstarted, 2 = paused, 5 = cued
          if (state === -1 || state === 2 || state === 5) {
            console.warn("[YouTube] Autoplay prevented by browser policy (state: " + state + ")");
            setAutoplayBlocked(true);
          }
        }
      }, 700);
    } catch (e) {
      console.warn("[YouTube] tryPlay exception:", e);
      setAutoplayBlocked(true);
    }
  }

  // Effect: Deterministically handle videoId prop changes when player is ready
  useEffect(() => {
    if (!isReady || !playerRef.current || !videoId) return;

    if (currentVideoLoadedRef.current !== videoId) {
      console.log(`[YouTube Player] Video changed from ${currentVideoLoadedRef.current} to ${videoId}`);
      currentVideoLoadedRef.current = videoId;
      isApplyingRemoteUpdate.current = true;
      setErrorMessage(null); // Clear any previous error on video change

      try {
        if (typeof playerRef.current.loadVideoById === "function") {
          if (shouldPlay) {
            playerRef.current.loadVideoById({
              videoId,
              startSeconds: targetTime || 0,
            });
            tryPlay(playerRef.current);
          } else {
            playerRef.current.cueVideoById({
              videoId,
              startSeconds: targetTime || 0,
            });
            setIsPlaying(false);
          }
        }
      } catch (err) {
        console.error("[YouTube Player] Failed to switch video:", err);
      } finally {
        setTimeout(() => {
          isApplyingRemoteUpdate.current = false;
        }, 1000);
      }
    }
  }, [videoId, isReady, targetTime, shouldPlay]);

  // Handle YouTube state changes (PLAYING = 1, PAUSED = 2, BUFFERING = 3, CUED = 5, ENDED = 0)
  const handleStateChange = (event: any) => {
    const state = event.data;
    const player = event.target;
    const time = player.getCurrentTime ? player.getCurrentTime() : 0;
    setCurrentTime(time);

    // Suppress loop if triggered programmatically by incoming socket event
    if (isApplyingRemoteUpdate.current) {
      if (state === 1) setIsPlaying(true);
      if (state === 2) setIsPlaying(false);
      return;
    }

    // Role check: Only Host/Moderator emit room-wide events from local iframe interactions
    if (!canControl) {
      // Revert participant's accidental local pause/play if room is in different state
      if (state === 1) setIsPlaying(true);
      if (state === 2) setIsPlaying(false);
      return;
    }

    if (state === 1) {
      setIsPlaying(true);
      if (onLocalPlay) onLocalPlay(time);
    } else if (state === 2) {
      setIsPlaying(false);
      if (onLocalPause) onLocalPause(time);
    }
  };

  // Periodic polling for current time and duration
  useEffect(() => {
    const interval = setInterval(() => {
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        try {
          const time = playerRef.current.getCurrentTime();
          const dur = playerRef.current.getDuration ? playerRef.current.getDuration() : 0;
          if (time !== undefined && !isNaN(time)) {
            setCurrentTime(time);
          }
          if (dur !== undefined && dur > 0 && !isNaN(dur)) {
            setDuration(dur);
          }
        } catch (e) {
          // ignore transient cross-origin iframe polling errors
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  /**
   * Apply remote Play event without triggering an infinite socket loop
   */
  const applyRemotePlay = useCallback((targetPlayTime?: number) => {
    if (!playerRef.current || !isReady || typeof playerRef.current.playVideo !== "function") {
      pendingSyncRef.current = {
        ...pendingSyncRef.current,
        isPlaying: true,
        currentTime: targetPlayTime,
      };
      return;
    }

    isApplyingRemoteUpdate.current = true;

    try {
      if (targetPlayTime !== undefined) {
        const curTime = playerRef.current.getCurrentTime ? playerRef.current.getCurrentTime() : 0;
        if (Math.abs(curTime - targetPlayTime) > 1.5) {
          playerRef.current.seekTo(targetPlayTime, true);
        }
      }

      tryPlay(playerRef.current);
      setAutoplayBlocked(false);
    } finally {
      setTimeout(() => {
        isApplyingRemoteUpdate.current = false;
      }, 700);
    }
  }, [isReady]);

  /**
   * Apply remote Pause event without triggering an infinite socket loop
   */
  const applyRemotePause = useCallback((targetPauseTime?: number) => {
    if (!playerRef.current || !isReady || typeof playerRef.current.pauseVideo !== "function") {
      pendingSyncRef.current = {
        ...pendingSyncRef.current,
        isPlaying: false,
        currentTime: targetPauseTime,
      };
      return;
    }

    isApplyingRemoteUpdate.current = true;

    try {
      if (targetPauseTime !== undefined) {
        playerRef.current.seekTo(targetPauseTime, true);
      }
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } finally {
      setTimeout(() => {
        isApplyingRemoteUpdate.current = false;
      }, 700);
    }
  }, [isReady]);

  /**
   * Apply remote Seek event without triggering an infinite socket loop
   */
  const applyRemoteSeek = useCallback((seekTime: number) => {
    if (!playerRef.current || !isReady || typeof playerRef.current.seekTo !== "function") {
      pendingSyncRef.current = {
        ...pendingSyncRef.current,
        currentTime: seekTime,
      };
      return;
    }

    isApplyingRemoteUpdate.current = true;

    try {
      playerRef.current.seekTo(seekTime, true);
      setCurrentTime(seekTime);
    } finally {
      setTimeout(() => {
        isApplyingRemoteUpdate.current = false;
      }, 700);
    }
  }, [isReady]);

  /**
   * Apply remote video change
   */
  const applyRemoteVideoChange = useCallback(
    (newVideoId: string, startTime: number = 0, startPlaying: boolean = true) => {
      currentVideoLoadedRef.current = newVideoId;
      setErrorMessage(null);

      if (!playerRef.current || !isReady || typeof playerRef.current.loadVideoById !== "function") {
        pendingSyncRef.current = {
          videoId: newVideoId,
          currentTime: startTime,
          isPlaying: startPlaying,
        };
        return;
      }

      isApplyingRemoteUpdate.current = true;

      try {
        if (startPlaying) {
          playerRef.current.loadVideoById({
            videoId: newVideoId,
            startSeconds: startTime,
          });
          setIsPlaying(true);
        } else {
          playerRef.current.cueVideoById({
            videoId: newVideoId,
            startSeconds: startTime,
          });
          setIsPlaying(false);
        }
      } catch (err) {
        console.error("[YouTube] Failed to load new video:", err);
      } finally {
        setTimeout(() => {
          isApplyingRemoteUpdate.current = false;
        }, 1000);
      }
    },
    [isReady]
  );

  /**
   * User interaction helper to unlock audio/autoplay when browser policy requires it
   */
  const handleAutoplayUnlock = useCallback(() => {
    if (playerRef.current && typeof playerRef.current.playVideo === "function") {
      playerRef.current.playVideo();
      setAutoplayBlocked(false);
      setIsPlaying(true);
    }
  }, []);

  // Local audio volume controls (Independent of room sync)
  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(100, newVol));
    setVolumeState(clamped);
    if (playerRef.current && typeof playerRef.current.setVolume === "function") {
      playerRef.current.setVolume(clamped);
      if (clamped > 0 && isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  const toggleMute = useCallback(() => {
    if (playerRef.current) {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    }
  }, [isMuted]);

  const clearPlayerError = useCallback(() => {
    setErrorMessage(null);
  }, []);

  return {
    player: playerRef.current,
    isReady,
    isPlaying,
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
    isApplyingRemoteUpdate,
  };
}
