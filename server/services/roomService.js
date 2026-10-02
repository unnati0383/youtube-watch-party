const Room = require("../models/Room");
const generateRoomCode = require("../utils/generateRoomCode");
const ExpressError = require("../utils/ExpressError");

/**
 * RoomService handles all database business logic for Rooms.
 * Keeps controllers and socket handlers clean and decoupled from direct database calls.
 */
class RoomService {
  /**
   * Create a new room with a unique room code.
   * Creator is automatically assigned as the Host.
   */
  async createRoom(userId, username) {
    if (!userId || !username) {
      throw new ExpressError(400, "User ID and username are required", "INVALID_INPUT");
    }

    // Generate unique room code (retry if collision occurs)
    let roomCode = "";
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 10) {
      roomCode = generateRoomCode(6);
      const existing = await Room.findOne({ roomCode });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      throw new ExpressError(500, "Could not generate unique room code", "CODE_GENERATION_FAILED");
    }

    const newRoom = new Room({
      roomCode,
      hostId: userId,
      playbackState: {
        videoId: "dQw4w9WgXcQ", // Default video
        isPlaying: false,
        currentTime: 0,
        updatedAt: new Date(),
      },
      participants: [
        {
          userId,
          username,
          role: "Host", // Room creator is guaranteed Host
          socketId: null,
          joinedAt: new Date(),
        },
      ],
    });

    await newRoom.save();
    return newRoom;
  }

  /**
   * Retrieve a room by its code.
   */
  async getRoomByCode(roomCode) {
    if (!roomCode || typeof roomCode !== "string") {
      throw new ExpressError(400, "Room code is required", "INVALID_ROOM_CODE");
    }

    const normalizedCode = roomCode.trim().toUpperCase();
    const room = await Room.findOne({ roomCode: normalizedCode });

    if (!room) {
      throw new ExpressError(404, `Room ${normalizedCode} not found`, "ROOM_NOT_FOUND");
    }

    return room;
  }

  /**
   * Add or reconnect a participant to a room.
   * Role is determined strictly by backend:
   * - If userId === room.hostId -> role is 'Host'
   * - If user already exists in room -> preserve their assigned role
   * - Otherwise -> role is 'Participant'
   */
  async registerOrUpdateParticipant(roomCode, { userId, username, socketId }) {
    const room = await this.getRoomByCode(roomCode);

    const existingIndex = room.participants.findIndex((p) => p.userId === userId);

    let role = "Participant";
    if (room.hostId === userId) {
      role = "Host";
    }

    if (existingIndex !== -1) {
      // Preserve role if already assigned (e.g. Moderator)
      const existingRole = room.participants[existingIndex].role;
      room.participants[existingIndex].socketId = socketId;
      room.participants[existingIndex].username = username;
      // Host always stays Host
      if (room.hostId === userId) {
        room.participants[existingIndex].role = "Host";
      } else if (existingRole === "Moderator") {
        room.participants[existingIndex].role = "Moderator";
      }
    } else {
      // New user joins as Participant (or Host if matching hostId)
      room.participants.push({
        userId,
        username,
        role,
        socketId,
        joinedAt: new Date(),
      });
    }

    await room.save();
    const participant = room.participants.find((p) => p.userId === userId);
    return { room, participant };
  }

  /**
   * Update playback state (play, pause, seek, change_video)
   * Only called on discrete user events, never on every second tick!
   */
  async updatePlaybackState(roomCode, { videoId, isPlaying, currentTime }) {
    const room = await this.getRoomByCode(roomCode);

    if (videoId !== undefined) {
      room.playbackState.videoId = videoId;
    }
    if (isPlaying !== undefined) {
      room.playbackState.isPlaying = isPlaying;
    }
    if (currentTime !== undefined) {
      room.playbackState.currentTime = Math.max(0, currentTime);
    }

    room.playbackState.updatedAt = new Date();
    await room.save();

    return room.playbackState;
  }

  /**
   * Update a participant's role (Host only can do this)
   */
  async updateParticipantRole(roomCode, targetUserId, newRole) {
    const validRoles = ["Moderator", "Participant"];
    if (!validRoles.includes(newRole)) {
      throw new ExpressError(400, "Invalid role assignment", "INVALID_ROLE");
    }

    const room = await this.getRoomByCode(roomCode);

    if (targetUserId === room.hostId) {
      throw new ExpressError(400, "Cannot change the Host's role via assign_role", "INVALID_ACTION");
    }

    const participant = room.participants.find((p) => p.userId === targetUserId);
    if (!participant) {
      throw new ExpressError(404, "Participant not found in room", "PARTICIPANT_NOT_FOUND");
    }

    participant.role = newRole;
    await room.save();

    return { room, participant };
  }

  /**
   * Remove a participant from the room
   */
  async removeParticipant(roomCode, targetUserId) {
    const room = await this.getRoomByCode(roomCode);

    if (targetUserId === room.hostId) {
      throw new ExpressError(400, "Cannot remove the Host from the room", "INVALID_ACTION");
    }

    const removedParticipant = room.participants.find((p) => p.userId === targetUserId);
    if (!removedParticipant) {
      throw new ExpressError(404, "Participant not found in room", "PARTICIPANT_NOT_FOUND");
    }

    room.participants = room.participants.filter((p) => p.userId !== targetUserId);
    await room.save();

    return { room, removedParticipant };
  }

  /**
   * Transfer host ownership to another participant
   */
  async transferHost(roomCode, currentHostId, newHostUserId) {
    const room = await this.getRoomByCode(roomCode);

    if (room.hostId !== currentHostId) {
      throw new ExpressError(403, "Only current host can transfer ownership", "UNAUTHORIZED");
    }

    const newHost = room.participants.find((p) => p.userId === newHostUserId);
    if (!newHost) {
      throw new ExpressError(404, "Target user not found in room", "PARTICIPANT_NOT_FOUND");
    }

    // Demote current host to Participant
    const oldHost = room.participants.find((p) => p.userId === currentHostId);
    if (oldHost) {
      oldHost.role = "Participant";
    }

    // Promote new host
    newHost.role = "Host";
    room.hostId = newHostUserId;

    await room.save();
    return room;
  }

  /**
   * Handle socket disconnection
   */
  async handleSocketDisconnect(socketId) {
    if (!socketId) return null;

    const room = await Room.findOne({ "participants.socketId": socketId });
    if (!room) return null;

    const participant = room.participants.find((p) => p.socketId === socketId);
    if (participant) {
      // Clear socketId so we know they are disconnected
      participant.socketId = null;
      await room.save();
    }

    return { room, participant };
  }

  /**
   * Delete room by code (Host only)
   */
  async deleteRoom(roomCode, userId) {
    const room = await this.getRoomByCode(roomCode);

    if (room.hostId !== userId) {
      throw new ExpressError(403, "Only the Host can delete the room", "FORBIDDEN");
    }

    await Room.deleteOne({ _id: room._id });
    return true;
  }
}

module.exports = new RoomService();
