const roomService = require("../services/roomService");
const {
  canControlPlayback,
  canAssignRole,
  canRemoveParticipant,
  canTransferHost,
} = require("./permissions");

/**
 * Attaches room-related real-time Socket.IO event listeners.
 * 
 * DESIGN PRINCIPLES:
 * 1. Strict Backend Authorization: Every playback or admin action verifies caller role.
 * 2. Non-blocking error handling: Permission denials emit an 'error' event to the sender only.
 * 3. Latency Compensation: Playback state includes updatedAt timestamp and calculated drift.
 * 4. Clean socket state: Socket metadata is attached to socket.data for fast session retrieval.
 */
function registerRoomSocket(io, socket) {
  /**
   * Helper: Retrieve room and verify the caller is an active participant in it.
   */
  async function getAuthenticatedCaller(roomCode) {
    const userId = socket.data.userId;
    if (!userId || !roomCode) {
      socket.emit("error", {
        code: "UNAUTHORIZED",
        message: "You must join the room before performing this action.",
      });
      return null;
    }

    try {
      const room = await roomService.getRoomByCode(roomCode);
      const participant = room.participants.find((p) => p.userId === userId);

      if (!participant) {
        socket.emit("error", {
          code: "NOT_IN_ROOM",
          message: "You are not registered as a participant in this room.",
        });
        return null;
      }

      return { room, participant, userId, username: participant.username, role: participant.role };
    } catch (err) {
      socket.emit("error", {
        code: err.code || "ROOM_ERROR",
        message: err.message || "Failed to find room.",
      });
      return null;
    }
  }

  // ==========================================
  // 1. JOIN ROOM
  // ==========================================
  socket.on("join_room", async ({ roomCode, userId, username }) => {
    try {
      if (!roomCode || !userId || !username) {
        return socket.emit("error", {
          code: "INVALID_JOIN_PAYLOAD",
          message: "roomCode, userId, and username are all required to join.",
        });
      }

      const normalizedCode = roomCode.trim().toUpperCase();

      // Register or update participant in DB (determines role securely)
      const { room, participant } = await roomService.registerOrUpdateParticipant(
        normalizedCode,
        {
          userId: userId.trim(),
          username: username.trim(),
          socketId: socket.id,
        }
      );

      // Attach session info to socket
      socket.data.roomCode = normalizedCode;
      socket.data.userId = userId.trim();
      socket.data.username = username.trim();

      // Join Socket.IO room channel
      socket.join(normalizedCode);

      // Calculate latency-compensated current time if video is playing
      let adjustedTime = room.playbackState.currentTime || 0;
      if (room.playbackState.isPlaying && room.playbackState.updatedAt) {
        const elapsedSeconds =
          (Date.now() - new Date(room.playbackState.updatedAt).getTime()) / 1000;
        adjustedTime += Math.max(0, elapsedSeconds);
      }

      // Send initial room state to the newly joined client
      socket.emit("room_state", {
        roomCode: room.roomCode,
        hostId: room.hostId,
        playbackState: {
          videoId: room.playbackState.videoId,
          isPlaying: room.playbackState.isPlaying,
          currentTime: adjustedTime,
          updatedAt: room.playbackState.updatedAt,
        },
        participants: room.participants,
        currentUser: {
          userId: participant.userId,
          username: participant.username,
          role: participant.role,
        },
      });

      // Broadcast to other users in the room that a new participant joined
      socket.to(normalizedCode).emit("user_joined", {
        participant,
        participants: room.participants,
      });

      console.log(`[Socket] ${username} (${participant.role}) joined room ${normalizedCode}`);
    } catch (err) {
      console.error("[Socket] join_room error:", err);
      socket.emit("error", {
        code: err.code || "JOIN_ERROR",
        message: err.message || "Failed to join room.",
      });
    }
  });

  // ==========================================
  // 2. PLAY SYNCHRONIZATION
  // ==========================================
  socket.on("play", async ({ roomCode, currentTime }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host & Moderator can trigger playback
    if (!canControlPlayback(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Participants do not have permission to play video. Only Host or Moderator can control playback.",
      });
    }

    try {
      const now = new Date();
      await roomService.updatePlaybackState(caller.room.roomCode, {
        isPlaying: true,
        currentTime: currentTime || 0,
      });

      // Broadcast play event to EVERYONE in the room including sender for confirmed timestamp
      io.to(caller.room.roomCode).emit("play", {
        currentTime: currentTime || 0,
        updatedAt: now,
        issuedBy: caller.username,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: PLAY by ${caller.username} at ${currentTime}s`);
    } catch (err) {
      socket.emit("error", { code: "PLAYBACK_ERROR", message: "Failed to sync play state" });
    }
  });

  // ==========================================
  // 3. PAUSE SYNCHRONIZATION
  // ==========================================
  socket.on("pause", async ({ roomCode, currentTime }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host & Moderator can pause
    if (!canControlPlayback(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Participants do not have permission to pause video. Only Host or Moderator can control playback.",
      });
    }

    try {
      const now = new Date();
      await roomService.updatePlaybackState(caller.room.roomCode, {
        isPlaying: false,
        currentTime: currentTime || 0,
      });

      io.to(caller.room.roomCode).emit("pause", {
        currentTime: currentTime || 0,
        updatedAt: now,
        issuedBy: caller.username,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: PAUSE by ${caller.username} at ${currentTime}s`);
    } catch (err) {
      socket.emit("error", { code: "PLAYBACK_ERROR", message: "Failed to sync pause state" });
    }
  });

  // ==========================================
  // 4. SEEK SYNCHRONIZATION
  // ==========================================
  socket.on("seek", async ({ roomCode, currentTime }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host & Moderator can seek
    if (!canControlPlayback(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Participants do not have permission to seek video.",
      });
    }

    try {
      const now = new Date();
      await roomService.updatePlaybackState(caller.room.roomCode, {
        currentTime: Math.max(0, currentTime),
      });

      io.to(caller.room.roomCode).emit("seek", {
        currentTime: Math.max(0, currentTime),
        updatedAt: now,
        issuedBy: caller.username,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: SEEK by ${caller.username} to ${currentTime}s`);
    } catch (err) {
      socket.emit("error", { code: "PLAYBACK_ERROR", message: "Failed to sync seek state" });
    }
  });

  // ==========================================
  // 5. CHANGE VIDEO SYNCHRONIZATION
  // ==========================================
  socket.on("change_video", async ({ roomCode, videoId }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host & Moderator can change video
    if (!canControlPlayback(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Participants do not have permission to change the video.",
      });
    }

    if (!videoId || typeof videoId !== "string" || !videoId.trim()) {
      return socket.emit("error", {
        code: "INVALID_VIDEO",
        message: "A valid YouTube video ID must be provided.",
      });
    }

    try {
      const cleanVideoId = videoId.trim();
      const now = new Date();

      await roomService.updatePlaybackState(caller.room.roomCode, {
        videoId: cleanVideoId,
        currentTime: 0,
        isPlaying: true, // auto-play new video
      });

      io.to(caller.room.roomCode).emit("video_changed", {
        videoId: cleanVideoId,
        currentTime: 0,
        isPlaying: true,
        issuedBy: caller.username,
        updatedAt: now,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: VIDEO CHANGED to ${cleanVideoId} by ${caller.username}`);
    } catch (err) {
      socket.emit("error", { code: "VIDEO_CHANGE_ERROR", message: "Failed to change video" });
    }
  });

  // ==========================================
  // 6. ROLE ASSIGNMENT (Host Only)
  // ==========================================
  socket.on("assign_role", async ({ roomCode, targetUserId, newRole }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host can assign roles
    if (!canAssignRole(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Only the Host can promote or demote participants.",
      });
    }

    try {
      const { room, participant: updatedParticipant } =
        await roomService.updateParticipantRole(caller.room.roomCode, targetUserId, newRole);

      io.to(caller.room.roomCode).emit("role_assigned", {
        targetUserId,
        newRole,
        participant: updatedParticipant,
        participants: room.participants,
        issuedBy: caller.username,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: ROLE ${newRole} assigned to ${targetUserId} by ${caller.username}`);
    } catch (err) {
      socket.emit("error", {
        code: err.code || "ROLE_ASSIGN_ERROR",
        message: err.message || "Failed to assign role",
      });
    }
  });

  // ==========================================
  // 7. REMOVE PARTICIPANT (Host Only)
  // ==========================================
  socket.on("remove_participant", async ({ roomCode, targetUserId }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only Host can remove participants
    if (!canRemoveParticipant(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Only the Host can remove participants from the room.",
      });
    }

    try {
      const targetUser = caller.room.participants.find((p) => p.userId === targetUserId);
      const targetSocketId = targetUser ? targetUser.socketId : null;

      const { room, removedParticipant } = await roomService.removeParticipant(
        caller.room.roomCode,
        targetUserId
      );

      // If the removed participant is currently connected, notify and disconnect them from room
      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit("participant_removed", {
            targetUserId,
            reason: "You were removed from the room by the Host.",
          });
          targetSocket.leave(caller.room.roomCode);
          targetSocket.data.roomCode = null;
        }
      }

      // Broadcast updated participant list to everyone else in the room
      io.to(caller.room.roomCode).emit("user_left", {
        userId: targetUserId,
        username: removedParticipant ? removedParticipant.username : "Participant",
        participants: room.participants,
        reason: "Removed by Host",
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: User ${targetUserId} removed by Host ${caller.username}`);
    } catch (err) {
      socket.emit("error", {
        code: err.code || "REMOVE_ERROR",
        message: err.message || "Failed to remove participant",
      });
    }
  });

  // ==========================================
  // 8. HOST TRANSFER (Optional Host Bonus)
  // ==========================================
  socket.on("transfer_host", async ({ roomCode, targetUserId }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // RBAC: Only current Host can transfer host
    if (!canTransferHost(caller.role)) {
      return socket.emit("error", {
        code: "FORBIDDEN",
        message: "Only the current Host can transfer room ownership.",
      });
    }

    try {
      const updatedRoom = await roomService.transferHost(
        caller.room.roomCode,
        caller.userId,
        targetUserId
      );

      io.to(caller.room.roomCode).emit("host_transferred", {
        newHostId: targetUserId,
        previousHostId: caller.userId,
        participants: updatedRoom.participants,
        issuedBy: caller.username,
      });

      console.log(`[Socket] Room ${caller.room.roomCode}: Host ownership transferred to ${targetUserId}`);
    } catch (err) {
      socket.emit("error", {
        code: err.code || "TRANSFER_ERROR",
        message: err.message || "Failed to transfer host",
      });
    }
  });

  // ==========================================
  // 9. REQUEST SYNC (Re-synchronize client)
  // ==========================================
  socket.on("request_sync", async ({ roomCode }) => {
    try {
      const normalizedCode = (roomCode || socket.data.roomCode || "").toUpperCase();
      if (!normalizedCode) return;

      const room = await roomService.getRoomByCode(normalizedCode);

      let adjustedTime = room.playbackState.currentTime || 0;
      if (room.playbackState.isPlaying && room.playbackState.updatedAt) {
        const elapsed = (Date.now() - new Date(room.playbackState.updatedAt).getTime()) / 1000;
        adjustedTime += Math.max(0, elapsed);
      }

      socket.emit("sync_state", {
        playbackState: {
          videoId: room.playbackState.videoId,
          isPlaying: room.playbackState.isPlaying,
          currentTime: adjustedTime,
          updatedAt: room.playbackState.updatedAt,
        },
      });
    } catch (err) {
      // silent catch for sync request
    }
  });

  // ==========================================
  // 10. BASIC ROOM CHAT (Bonus Feature)
  // ==========================================
  socket.on("send_message", async ({ roomCode, message }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    if (!message || typeof message !== "string" || !message.trim()) return;

    const chatPayload = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: caller.userId,
      username: caller.username,
      role: caller.role,
      message: message.trim().substring(0, 500), // sanitize length
      timestamp: new Date().toISOString(),
    };

    io.to(caller.room.roomCode).emit("receive_message", chatPayload);
  });

  // ==========================================
  // 11. REQUEST CONTROL (Bonus Feature)
  // ==========================================
  socket.on("request_control", async ({ roomCode }) => {
    const caller = await getAuthenticatedCaller(roomCode);
    if (!caller) return;

    // Forward control request to Host and Moderators in room
    io.to(caller.room.roomCode).emit("control_requested", {
      userId: caller.userId,
      username: caller.username,
      role: caller.role,
    });
  });

  // ==========================================
  // 12. LEAVE ROOM & DISCONNECT
  // ==========================================
  const handleLeaveOrDisconnect = async () => {
    const roomCode = socket.data.roomCode;
    const userId = socket.data.userId;
    const username = socket.data.username;

    if (!roomCode || !userId) return;

    try {
      const result = await roomService.handleSocketDisconnect(socket.id);
      if (result && result.room) {
        // Broadcast participant left / disconnected
        socket.to(roomCode).emit("user_left", {
          userId,
          username: username || "Participant",
          participants: result.room.participants,
        });
      }
    } catch (err) {
      console.error("[Socket] Disconnect cleanup error:", err);
    }
  };

  socket.on("leave_room", async ({ roomCode }) => {
    socket.leave(roomCode || socket.data.roomCode);
    await handleLeaveOrDisconnect();
    socket.data.roomCode = null;
  });

  socket.on("disconnect", async () => {
    await handleLeaveOrDisconnect();
  });
}

module.exports = registerRoomSocket;
