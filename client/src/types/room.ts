export type Role = "Host" | "Moderator" | "Participant";

export interface Participant {
  userId: string;
  username: string;
  role: Role;
  socketId: string | null;
  joinedAt?: string;
}

export interface PlaybackState {
  videoId: string;
  isPlaying: boolean;
  currentTime: number;
  updatedAt: string;
}

export interface Room {
  _id?: string;
  roomCode: string;
  hostId: string;
  playbackState: PlaybackState;
  participants: Participant[];
  createdAt: string;
  updatedAt?: string;
}

export interface CurrentUser {
  userId: string;
  username: string;
  role: Role;
}
