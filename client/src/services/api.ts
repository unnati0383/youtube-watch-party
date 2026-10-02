import axios from "axios";
import type { Room } from "../types/room";

const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

/**
 * REST API client functions for room management
 */
export const roomApi = {
  /**
   * Create a new room with current user as host
   */
  async createRoom(userId: string, username: string): Promise<Room> {
    const response = await apiClient.post<{ success: boolean; room: Room }>("/rooms", {
      userId,
      username,
    });
    return response.data.room;
  },

  /**
   * Retrieve room details by room code
   */
  async getRoom(roomCode: string): Promise<Room> {
    const response = await apiClient.get<{ success: boolean; room: Room }>(
      `/rooms/${roomCode.trim().toUpperCase()}`
    );
    return response.data.room;
  },

  /**
   * Delete a room (Host only)
   */
  async deleteRoom(roomCode: string, userId: string): Promise<void> {
    await apiClient.delete(`/rooms/${roomCode.trim().toUpperCase()}`, {
      headers: {
        "x-user-id": userId,
      },
    });
  },
};

export default apiClient;
