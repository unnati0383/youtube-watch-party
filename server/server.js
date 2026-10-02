if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const http = require("http");
const app = require("./app");
const connectDB = require("./config/db");
const initSocketServer = require("./sockets/socketHandler");

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Attach Socket.IO real-time server
const io = initSocketServer(server, CLIENT_URL);

// Start server after connecting to database
async function startServer() {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 YouTube Watch Party Server is live!`);
    console.log(`📡 HTTP Server Port: ${PORT}`);
    console.log(`⚡ WebSocket Server attached via Socket.IO`);
    console.log(`🌐 Allowed Client URL: ${CLIENT_URL}`);
    console.log(`===============================================`);
  });
}

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

startServer();
