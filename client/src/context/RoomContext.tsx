import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { useSocket } from "../hooks/useSocket";
import { roomApi } from "../services/api";
import type { CurrentUser, Participant, PlaybackState, Role, Room } from "../types/room";
import type {
  ChatMessage,
  PausePayload,
  PlayPayload,
  RoleAssignedPayload,
  RoomStatePayload,
  SeekPayload,
  UserJoinedPayload,
  UserLeftPayload,
  VideoChangedPayload,
} from "../types/socket";
import { getOrCreateUserId, getStoredUsername, saveUsername } from "../utils/user";

interface RoomContextType {
  room: Room | null;
  roomCode: string;
  currentUser: CurrentUser;
  participants: Participant[];
  playbackState: PlaybackState;
  chatMessages: ChatMessage[];
  isConnected: boolean;
  isRoomLoading: boolean;
  error: string | null;
  notification: string | null;
  canControlPlayback: boolean;
  isHost: boolean;
  isModerator: boolean;
  joinRoomSession: (code: string, username: string) => Promise<Room | null>;
  leaveRoomSession: () => void;
  playVideo: (time: number) => void;
  pauseVideo: (time: number) => void;
  seekVideo: (time: number) => void;
  changeVideo: (videoId: string) => void;
  assignRole: (targetUserId: string, newRole: Role) => void;
  removeParticipant: (targetUserId: string) => void;
  transferHost: (targetUserId: string) => void;
  sendChatMessage: (text: string) => void;
  requestSync: () => void;
  requestControl: () => void;
  clearError: () => void;
  clearNotification: () => void;
  // Handler callbacks registered by the YouTubePlayer component
  registerPlayerHandlers: (handlers: PlayerHandlers) => void;
}

export interface PlayerHandlers {
  onRemotePlay: (time?: number) => void;
  onRemotePause: (time?: number) => void;
  onRemoteSeek: (time: number) => void;
  onRemoteVideoChange: (videoId: string, startTime?: number, isPlaying?: boolean) => void;
}

const RoomContext = createContext<RoomContextType | undefined>(undefined);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
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
  } = useSocket();

  const [room, setRoom] = useState<Room | null>(null);
  const [roomCode, setRoomCode] = useState<string>("");
  const [isRoomLoading, setIsRoomLoading] = useState<boolean>(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>({
    videoId: "dQw4w9WgXcQ", // fallback default only for brand new room before load
    isPlaying: false,
    currentTime: 0,
    updatedAt: new Date().toISOString(),
  });
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Persistent user identity
  const [currentUser, setCurrentUser] = useState<CurrentUser>(() => {
    const userId = getOrCreateUserId();
    const username = getStoredUsername() || "Guest";
    return {
      userId,
      username,
      role: "Participant",
    };
  });

  const playerHandlersRef = useRef<PlayerHandlers | null>(null);

  const registerPlayerHandlers = useCallback((handlers: PlayerHandlers) => {
    playerHandlersRef.current = handlers;
  }, []);

  const isHost = currentUser.role === "Host";
  const isModerator = currentUser.role === "Moderator";
  const canControlPlayback = isHost || isModerator;

  // Socket Event Listeners
  useEffect(() => {
    if (!socket) return;

    // 1. Authoritative Room State from Server
    const handleRoomState = (data: RoomStatePayload) => {
      console.log("[Context] Received authoritative room_state from server:", data);
      setRoomCode(data.roomCode);
      setParticipants(data.participants);
      setPlaybackState(data.playbackState);
      setCurrentUser(data.currentUser);

      // Deterministically synchronize the player with server state
      if (playerHandlersRef.current) {
        playerHandlersRef.current.onRemoteVideoChange(
          data.playbackState.videoId,
          data.playbackState.currentTime,
          data.playbackState.isPlaying
        );
        if (data.playbackState.isPlaying) {
          playerHandlersRef.current.onRemotePlay(data.playbackState.currentTime);
        } else {
          playerHandlersRef.current.onRemotePause(data.playbackState.currentTime);
        }
      }
    };

    // 2. User Joined
    const handleUserJoined = (data: UserJoinedPayload) => {
      setParticipants(data.participants);
      setNotification(`${data.participant.username} joined the party!`);
    };

    // 3. User Left / Disconnected
    const handleUserLeft = (data: UserLeftPayload) => {
      setParticipants(data.participants);
      setNotification(`${data.username} left the room`);
    };

    // 4. Play Sync
    const handlePlay = (data: PlayPayload) => {
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: true,
        currentTime: data.currentTime,
        updatedAt: data.updatedAt,
      }));
      if (playerHandlersRef.current) {
        playerHandlersRef.current.onRemotePlay(data.currentTime);
      }
      setNotification(`${data.issuedBy} played the video`);
    };

    // 5. Pause Sync
    const handlePause = (data: PausePayload) => {
      setPlaybackState((prev) => ({
        ...prev,
        isPlaying: false,
        currentTime: data.currentTime,
        updatedAt: data.updatedAt,
      }));
      if (playerHandlersRef.current) {
        playerHandlersRef.current.onRemotePause(data.currentTime);
      }
      setNotification(`${data.issuedBy} paused the video`);
    };

    // 6. Seek Sync
    const handleSeek = (data: SeekPayload) => {
      setPlaybackState((prev) => ({
        ...prev,
        currentTime: data.currentTime,
        updatedAt: data.updatedAt,
      }));
      if (playerHandlersRef.current) {
        playerHandlersRef.current.onRemoteSeek(data.currentTime);
      }
      setNotification(`${data.issuedBy} jumped to ${Math.floor(data.currentTime)}s`);
    };

    // 7. Video Changed
    const handleVideoChanged = (data: VideoChangedPayload) => {
      console.log("[Context] Video changed broadcast received:", data.videoId);
      setPlaybackState((prev) => ({
        ...prev,
        videoId: data.videoId,
        currentTime: 0,
        isPlaying: data.isPlaying,
        updatedAt: data.updatedAt,
      }));
      if (playerHandlersRef.current) {
        playerHandlersRef.current.onRemoteVideoChange(data.videoId, 0, data.isPlaying);
      }
      setNotification(`${data.issuedBy} changed the video`);
    };

    // 8. Role Assigned
    const handleRoleAssigned = (data: RoleAssignedPayload) => {
      setParticipants(data.participants);

      // Check if current user's role changed
      if (data.targetUserId === currentUser.userId) {
        setCurrentUser((prev) => ({ ...prev, role: data.newRole }));
        setNotification(`Your role was updated to ${data.newRole}!`);
      } else {
        const target = data.participants.find((p) => p.userId === data.targetUserId);
        setNotification(`${target ? target.username : "Participant"} is now a ${data.newRole}`);
      }
    };

    // 9. Participant Removed (Kicked)
    const handleParticipantRemoved = (data: { targetUserId: string; reason?: string }) => {
      if (data.targetUserId === currentUser.userId) {
        setError(data.reason || "You have been removed from the room by the Host.");
        setTimeout(() => {
          window.location.href = "/";
        }, 3000);
      }
    };

    // 10. Host Transferred
    const handleHostTransferred = (data: {
      newHostId: string;
      previousHostId: string;
      participants: Participant[];
      issuedBy: string;
    }) => {
      setParticipants(data.participants);
      if (data.newHostId === currentUser.userId) {
        setCurrentUser((prev) => ({ ...prev, role: "Host" }));
        setNotification("👑 You are now the Host of this room!");
      } else if (data.previousHostId === currentUser.userId) {
        setCurrentUser((prev) => ({ ...prev, role: "Participant" }));
        setNotification("You transferred host ownership.");
      } else {
        setNotification(`Host ownership was transferred.`);
      }
    };

    // 11. Chat Message
    const handleReceiveMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    };

    // 12. Socket Error
    const handleError = (err: { code: string; message: string }) => {
      console.warn("[Context] Socket Error:", err);
      setError(err.message || "An unexpected error occurred");
    };

    // Bind event listeners
    socket.on("room_state", handleRoomState);
    socket.on("user_joined", handleUserJoined);
    socket.on("user_left", handleUserLeft);
    socket.on("play", handlePlay);
    socket.on("pause", handlePause);
    socket.on("seek", handleSeek);
    socket.on("video_changed", handleVideoChanged);
    socket.on("role_assigned", handleRoleAssigned);
    socket.on("participant_removed", handleParticipantRemoved);
    socket.on("host_transferred", handleHostTransferred);
    socket.on("receive_message", handleReceiveMessage);
    socket.on("error", handleError);

    return () => {
      socket.off("room_state", handleRoomState);
      socket.off("user_joined", handleUserJoined);
      socket.off("user_left", handleUserLeft);
      socket.off("play", handlePlay);
      socket.off("pause", handlePause);
      socket.off("seek", handleSeek);
      socket.off("video_changed", handleVideoChanged);
      socket.off("role_assigned", handleRoleAssigned);
      socket.off("participant_removed", handleParticipantRemoved);
      socket.off("host_transferred", handleHostTransferred);
      socket.off("receive_message", handleReceiveMessage);
      socket.off("error", handleError);
    };
  }, [socket, currentUser.userId]);

  // Context Action: Join Room Session
  // Loads authoritative database state immediately via REST, then connects WebSocket
  const joinRoomSession = useCallback(
    async (code: string, username: string): Promise<Room | null> => {
      const cleanCode = code.trim().toUpperCase();
      const cleanUsername = username.trim() || "Guest";

      saveUsername(cleanUsername);
      setRoomCode(cleanCode);
      setIsRoomLoading(true);

      try {
        // Step 1: Authoritative REST fetch directly from MongoDB
        const roomData = await roomApi.getRoom(cleanCode);
        setRoom(roomData);
        setParticipants(roomData.participants);

        // Populate authoritative playback state from DB immediately
        if (roomData.playbackState && roomData.playbackState.videoId) {
          console.log("[Context] Initializing room state from database:", roomData.playbackState);
          setPlaybackState(roomData.playbackState);
        }

        // Determine user role from database
        let userRole: Role = "Participant";
        if (roomData.hostId === currentUser.userId) {
          userRole = "Host";
        } else {
          const existing = roomData.participants.find((p) => p.userId === currentUser.userId);
          if (existing) {
            userRole = existing.role;
          }
        }

        setCurrentUser((prev) => ({
          ...prev,
          username: cleanUsername,
          role: userRole,
        }));

        // Step 2: Establish real-time WebSocket room binding
        joinRoom(cleanCode, currentUser.userId, cleanUsername);

        return roomData;
      } catch (err: any) {
        console.error("[Context] Failed to load room from database:", err);
        setError(err.response?.data?.error?.message || "Room not found or server unreachable");
        return null;
      } finally {
        setIsRoomLoading(false);
      }
    },
    [currentUser.userId, joinRoom]
  );

  const leaveRoomSession = useCallback(() => {
    if (roomCode) {
      leaveRoom(roomCode);
      setRoomCode("");
      setRoom(null);
      setParticipants([]);
    }
  }, [roomCode, leaveRoom]);

  const playVideo = useCallback(
    (time: number) => {
      if (roomCode && canControlPlayback) {
        emitPlay(roomCode, time);
      }
    },
    [roomCode, canControlPlayback, emitPlay]
  );

  const pauseVideo = useCallback(
    (time: number) => {
      if (roomCode && canControlPlayback) {
        emitPause(roomCode, time);
      }
    },
    [roomCode, canControlPlayback, emitPause]
  );

  const seekVideo = useCallback(
    (time: number) => {
      if (roomCode && canControlPlayback) {
        emitSeek(roomCode, time);
      }
    },
    [roomCode, canControlPlayback, emitSeek]
  );

  const changeVideo = useCallback(
    (videoId: string) => {
      if (roomCode && canControlPlayback) {
        emitChangeVideo(roomCode, videoId);
      }
    },
    [roomCode, canControlPlayback, emitChangeVideo]
  );

  const assignRole = useCallback(
    (targetUserId: string, newRole: Role) => {
      if (roomCode && isHost) {
        emitAssignRole(roomCode, targetUserId, newRole);
      }
    },
    [roomCode, isHost, emitAssignRole]
  );

  const removeParticipant = useCallback(
    (targetUserId: string) => {
      if (roomCode && isHost) {
        emitRemoveParticipant(roomCode, targetUserId);
      }
    },
    [roomCode, isHost, emitRemoveParticipant]
  );

  const transferHost = useCallback(
    (targetUserId: string) => {
      if (roomCode && isHost) {
        emitTransferHost(roomCode, targetUserId);
      }
    },
    [roomCode, isHost, emitTransferHost]
  );

  const sendChatMessage = useCallback(
    (text: string) => {
      if (roomCode && text.trim()) {
        emitSendMessage(roomCode, text.trim());
      }
    },
    [roomCode, emitSendMessage]
  );

  const requestSync = useCallback(() => {
    if (roomCode) {
      emitRequestSync(roomCode);
    }
  }, [roomCode, emitRequestSync]);

  const requestControl = useCallback(() => {
    if (roomCode) {
      emitRequestControl(roomCode);
    }
  }, [roomCode, emitRequestControl]);

  const clearError = () => setError(null);
  const clearNotification = () => setNotification(null);

  return (
    <RoomContext.Provider
      value={{
        room,
        roomCode,
        currentUser,
        participants,
        playbackState,
        chatMessages,
        isConnected,
        isRoomLoading,
        error,
        notification,
        canControlPlayback,
        isHost,
        isModerator,
        joinRoomSession,
        leaveRoomSession,
        playVideo,
        pauseVideo,
        seekVideo,
        changeVideo,
        assignRole,
        removeParticipant,
        transferHost,
        sendChatMessage,
        requestSync,
        requestControl,
        clearError,
        clearNotification,
        registerPlayerHandlers,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};

export const useRoom = () => {
  const context = useContext(RoomContext);
  if (!context) {
    throw new Error("useRoom must be used within a RoomProvider");
  }
  return context;
};
