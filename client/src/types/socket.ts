import type { CurrentUser, Participant, PlaybackState, Role } from "./room";

export interface JoinRoomPayload {
  roomCode: string;
  userId: string;
  username: string;
}

export interface PlayPayload {
  currentTime: number;
  updatedAt: string;
  issuedBy: string;
}

export interface PausePayload {
  currentTime: number;
  updatedAt: string;
  issuedBy: string;
}

export interface SeekPayload {
  currentTime: number;
  updatedAt: string;
  issuedBy: string;
}

export interface VideoChangedPayload {
  videoId: string;
  currentTime: number;
  isPlaying: boolean;
  issuedBy: string;
  updatedAt: string;
}

export interface RoleAssignedPayload {
  targetUserId: string;
  newRole: Role;
  participant?: Participant;
  participants: Participant[];
  issuedBy: string;
}

export interface UserLeftPayload {
  userId: string;
  username: string;
  participants: Participant[];
  reason?: string;
}

export interface UserJoinedPayload {
  participant: Participant;
  participants: Participant[];
}

export interface RoomStatePayload {
  roomCode: string;
  hostId: string;
  playbackState: PlaybackState;
  participants: Participant[];
  currentUser: CurrentUser;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  role: Role;
  message: string;
  timestamp: string;
}

export interface SocketErrorPayload {
  code: string;
  message: string;
}
