import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { Role } from "../types/room";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

interface ActiveRoomSession {
  roomCode: string;
  userId: string;
  username: string;
}

/**
 * Custom React hook managing the Socket.IO lifecycle, auto-reconnection,
 * and reliable room event transmissions.
 */
export function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const activeRoomRef = useRef<ActiveRoomSession | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const s = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => {
      console.log(`[Socket] Connected to server (${s.id})`);
      setIsConnected(true);

      // Auto-rejoin room on reconnect or page refresh (Deterministic recovery)
      if (activeRoomRef.current) {
        const { roomCode, userId, username } = activeRoomRef.current;
        console.log(`[Socket] Re-emitting join_room for ${roomCode} on connect...`);
        s.emit("join_room", { roomCode, userId, username });
      }
    });

    s.on("disconnect", (reason) => {
      console.log(`[Socket] Disconnected from server: ${reason}`);
      setIsConnected(false);
    });

    s.on("connect_error", (error) => {
      console.warn("[Socket] Connection error:", error.message);
      setIsConnected(false);
    });

    return () => {
      console.log("[Socket] Cleaning up socket connection...");
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  // Action: Join Room (Tracks active room so reconnections never drop room state)
  const joinRoom = useCallback((roomCode: string, userId: string, username: string) => {
    const session: ActiveRoomSession = {
      roomCode: roomCode.trim().toUpperCase(),
      userId: userId.trim(),
      username: username.trim(),
    };
    activeRoomRef.current = session;

    if (socketRef.current) {
      socketRef.current.emit("join_room", session);
    }
  }, []);

  // Action: Leave Room
  const leaveRoom = useCallback((roomCode: string) => {
    activeRoomRef.current = null;
    if (socketRef.current) {
      socketRef.current.emit("leave_room", { roomCode: roomCode.trim().toUpperCase() });
    }
  }, []);

  // Action: Play
  const emitPlay = useCallback((roomCode: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit("play", { roomCode: roomCode.trim().toUpperCase(), currentTime });
    }
  }, []);

  // Action: Pause
  const emitPause = useCallback((roomCode: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit("pause", { roomCode: roomCode.trim().toUpperCase(), currentTime });
    }
  }, []);

  // Action: Seek
  const emitSeek = useCallback((roomCode: string, currentTime: number) => {
    if (socketRef.current) {
      socketRef.current.emit("seek", { roomCode: roomCode.trim().toUpperCase(), currentTime });
    }
  }, []);

  // Action: Change Video
  const emitChangeVideo = useCallback((roomCode: string, videoId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("change_video", { roomCode: roomCode.trim().toUpperCase(), videoId });
    }
  }, []);

  // Action: Assign Role (Host only)
  const emitAssignRole = useCallback((roomCode: string, targetUserId: string, newRole: Role) => {
    if (socketRef.current) {
      socketRef.current.emit("assign_role", {
        roomCode: roomCode.trim().toUpperCase(),
        targetUserId,
        newRole,
      });
    }
  }, []);

  // Action: Remove Participant (Host only)
  const emitRemoveParticipant = useCallback((roomCode: string, targetUserId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("remove_participant", {
        roomCode: roomCode.trim().toUpperCase(),
        targetUserId,
      });
    }
  }, []);

  // Action: Transfer Host (Host only)
  const emitTransferHost = useCallback((roomCode: string, targetUserId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("transfer_host", {
        roomCode: roomCode.trim().toUpperCase(),
        targetUserId,
      });
    }
  }, []);

  // Action: Send Chat Message
  const emitSendMessage = useCallback((roomCode: string, message: string) => {
    if (socketRef.current) {
      socketRef.current.emit("send_message", {
        roomCode: roomCode.trim().toUpperCase(),
        message,
      });
    }
  }, []);

  // Action: Request Sync
  const emitRequestSync = useCallback((roomCode: string) => {
    if (socketRef.current) {
      socketRef.current.emit("request_sync", { roomCode: roomCode.trim().toUpperCase() });
    }
  }, []);

  // Action: Request Control
  const emitRequestControl = useCallback((roomCode: string) => {
    if (socketRef.current) {
      socketRef.current.emit("request_control", { roomCode: roomCode.trim().toUpperCase() });
    }
  }, []);

  return {
    socket,
    isConnected,
    joinRoom,
    leaveRoom,
    emitPlay,
    emitPause,
    emitSeek,
    emitChangeVideo,
    emitAssignRole,
    emitRemoveParticipant,
    emitTransferHost,
    emitSendMessage,
    emitRequestSync,
    emitRequestControl,
  };
}
