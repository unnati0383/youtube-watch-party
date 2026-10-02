const mongoose = require("mongoose");

/**
 * Participant Sub-Schema
 * Stores each connected or registered user in the room.
 */
const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required for participant"],
      trim: true,
    },
    username: {
      type: String,
      required: [true, "username is required for participant"],
      trim: true,
      maxlength: [30, "Username cannot exceed 30 characters"],
    },
    role: {
      type: String,
      enum: {
        values: ["Host", "Moderator", "Participant"],
        message: "{VALUE} is not a valid role. Allowed: Host, Moderator, Participant",
      },
      default: "Participant",
      required: true,
    },
    socketId: {
      type: String,
      default: null,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Playback State Sub-Schema
 * Represents current YouTube video and playback status.
 * Note: currentTime and updatedAt are used together to compensate for latency.
 */
const playbackStateSchema = new mongoose.Schema(
  {
    videoId: {
      type: String,
      default: "dQw4w9WgXcQ", // Default video (Rick Astley) for immediate playback test
      trim: true,
    },
    isPlaying: {
      type: Boolean,
      default: false,
    },
    currentTime: {
      type: Number,
      default: 0,
      min: [0, "Current playback time cannot be negative"],
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Main Room Schema
 */
const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: [true, "Room code is required"],
      unique: true,
      uppercase: true,
      trim: true,
      minlength: [4, "Room code must be at least 4 characters"],
      maxlength: [10, "Room code cannot exceed 10 characters"],
    },
    hostId: {
      type: String,
      required: [true, "hostId is required"],
      trim: true,
    },
    playbackState: {
      type: playbackStateSchema,
      default: () => ({}),
    },
    participants: [participantSchema],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index automatically created by unique: true on roomCode
const Room = mongoose.model("Room", roomSchema);

module.exports = Room;
