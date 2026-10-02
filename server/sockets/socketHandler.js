const { Server } = require("socket.io");
const registerRoomSocket = require("./roomSocket");

/**
 * Initialize Socket.IO server with CORS configuration and room event handlers.
 * 
 * @param {import("http").Server} httpServer - Node.js HTTP server instance
 * @param {string} clientUrl - Allowed client origin for CORS
 * @returns {Server} Configured Socket.IO instance
 */
function initSocketServer(httpServer, clientUrl) {
  const allowedOrigins = [
    clientUrl,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`[Socket.IO] New client connected: ${socket.id}`);

    // Register room-specific socket handlers
    registerRoomSocket(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

module.exports = initSocketServer;
