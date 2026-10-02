const roomService = require("../services/roomService");

/**
 * RoomController handles incoming HTTP requests for room resources.
 * Follows the MVC pattern by delegating business logic to roomService.
 */
class RoomController {
  /**
   * POST /api/rooms
   * Create a new room. User becomes Host.
   */
  async createRoom(req, res) {
    const { userId, username } = req.user;
    const room = await roomService.createRoom(userId, username);

    res.status(201).json({
      success: true,
      message: "Room created successfully",
      room,
    });
  }

  /**
   * GET /api/rooms/:roomCode
   * Retrieve room details and verify room existence.
   */
  async getRoom(req, res) {
    const { roomCode } = req.params;
    const room = await roomService.getRoomByCode(roomCode);

    res.status(200).json({
      success: true,
      room,
    });
  }

  /**
   * DELETE /api/rooms/:roomCode
   * Delete a room (Host only).
   */
  async deleteRoom(req, res) {
    const { roomCode } = req.params;
    const { userId } = req.user;

    await roomService.deleteRoom(roomCode, userId);

    res.status(200).json({
      success: true,
      message: "Room deleted successfully",
    });
  }
}

module.exports = new RoomController();
