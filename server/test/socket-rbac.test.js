const http = require("http");
const { io: Client } = require("socket.io-client");
const mongoose = require("mongoose");
const app = require("../app");
const initSocketServer = require("../sockets/socketHandler");
const connectDB = require("../config/db");
const Room = require("../models/Room");

async function runTests() {
  console.log("=== STARTING COMPREHENSIVE BACKEND & RBAC TEST ===");

  await connectDB();

  // Spin up temporary test HTTP server on port 5099
  const TEST_PORT = 5099;
  const httpServer = http.createServer(app);
  const ioServer = initSocketServer(httpServer, `http://localhost:${TEST_PORT}`);

  await new Promise((resolve) => httpServer.listen(TEST_PORT, resolve));
  console.log(` Test server running on http://localhost:${TEST_PORT}`);

  let testRoomCode = "";
  const hostUser = { userId: "user-host-1", username: "HostAlice" };
  const participantUser = { userId: "user-part-2", username: "ParticipantBob" };

  try {
    // ----------------------------------------------------
    // TEST 1: REST API - Create Room
    // ----------------------------------------------------
    console.log("\n[TEST 1] Testing REST POST /api/rooms...");
    const createRes = await fetch(`http://localhost:${TEST_PORT}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hostUser),
    });

    const createData = await createRes.json();
    if (!createData.success || !createData.room || !createData.room.roomCode) {
      throw new Error(`Failed to create room: ${JSON.stringify(createData)}`);
    }

    testRoomCode = createData.room.roomCode;
    console.log(` Room created successfully! Code: ${testRoomCode}`);
    console.log(` HostId: ${createData.room.hostId} (expected: ${hostUser.userId})`);

    // Verify creator is Host
    const creatorRole = createData.room.participants[0].role;
    if (creatorRole !== "Host") {
      throw new Error(`Expected creator role to be 'Host', got: ${creatorRole}`);
    }
    console.log(` Creator role is correctly Host.`);

    // ----------------------------------------------------
    // TEST 2: REST API - Get Room
    // ----------------------------------------------------
    console.log("\n[TEST 2] Testing REST GET /api/rooms/:roomCode...");
    const getRes = await fetch(`http://localhost:${TEST_PORT}/api/rooms/${testRoomCode}`);
    const getData = await getRes.json();
    if (!getData.success || getData.room.roomCode !== testRoomCode) {
      throw new Error(`Failed to get room: ${JSON.stringify(getData)}`);
    }
    console.log(` Room retrieved successfully via REST.`);

    // ----------------------------------------------------
    // TEST 3: REST API - Invalid Room Code
    // ----------------------------------------------------
    console.log("\n[TEST 3] Testing REST GET /api/rooms/NONEXISTENT...");
    const notFoundRes = await fetch(`http://localhost:${TEST_PORT}/api/rooms/NONEXISTENT`);
    const notFoundData = await notFoundRes.json();
    if (notFoundRes.status !== 404 || notFoundData.error.code !== "ROOM_NOT_FOUND") {
      throw new Error(`Expected 404 ROOM_NOT_FOUND, got: ${JSON.stringify(notFoundData)}`);
    }
    console.log(` 404 properly handled with code ROOM_NOT_FOUND.`);

    // ----------------------------------------------------
    // TEST 4: Socket.IO - Connect Host and Participant
    // ----------------------------------------------------
    console.log("\n[TEST 4] Connecting Host and Participant via Socket.IO...");
    const hostSocket = Client(`http://localhost:${TEST_PORT}`);
    const partSocket = Client(`http://localhost:${TEST_PORT}`);

    await new Promise((res) => hostSocket.on("connect", res));
    await new Promise((res) => partSocket.on("connect", res));
    console.log(` Both sockets connected!`);

    // Join Host
    const hostJoinedPromise = new Promise((resolve) => {
      hostSocket.on("room_state", (state) => {
        resolve(state);
      });
    });
    hostSocket.emit("join_room", {
      roomCode: testRoomCode,
      userId: hostUser.userId,
      username: hostUser.username,
    });
    const hostState = await hostJoinedPromise;
    console.log(` Host joined room! Role: ${hostState.currentUser.role}`);
    if (hostState.currentUser.role !== "Host") {
      throw new Error(`Expected Host role, got: ${hostState.currentUser.role}`);
    }

    // Join Participant
    const partJoinedPromise = new Promise((resolve) => {
      partSocket.on("room_state", (state) => {
        resolve(state);
      });
    });
    partSocket.emit("join_room", {
      roomCode: testRoomCode,
      userId: participantUser.userId,
      username: participantUser.username,
    });
    const partState = await partJoinedPromise;
    console.log(` Participant joined room! Role: ${partState.currentUser.role}`);
    if (partState.currentUser.role !== "Participant") {
      throw new Error(`Expected Participant role, got: ${partState.currentUser.role}`);
    }

    // ----------------------------------------------------
    // TEST 5: Playback Control Sync - Host Controls
    // ----------------------------------------------------
    console.log("\n[TEST 5] Host Play / Pause / Seek / Change Video...");

    // 5a. Play
    const partPlayPromise = new Promise((resolve) => {
      partSocket.on("play", (data) => resolve(data));
    });
    hostSocket.emit("play", { roomCode: testRoomCode, currentTime: 45 });
    const playData = await partPlayPromise;
    console.log(` Play event received by Participant! Time: ${playData.currentTime}s, By: ${playData.issuedBy}`);

    // 5b. Pause
    const partPausePromise = new Promise((resolve) => {
      partSocket.on("pause", (data) => resolve(data));
    });
    hostSocket.emit("pause", { roomCode: testRoomCode, currentTime: 50 });
    const pauseData = await partPausePromise;
    console.log(` Pause event received by Participant! Time: ${pauseData.currentTime}s`);

    // 5c. Seek
    const partSeekPromise = new Promise((resolve) => {
      partSocket.on("seek", (data) => resolve(data));
    });
    hostSocket.emit("seek", { roomCode: testRoomCode, currentTime: 120 });
    const seekData = await partSeekPromise;
    console.log(` Seek event received by Participant! Target: ${seekData.currentTime}s`);

    // 5d. Change Video
    const partChangePromise = new Promise((resolve) => {
      partSocket.on("video_changed", (data) => resolve(data));
    });
    hostSocket.emit("change_video", { roomCode: testRoomCode, videoId: "M7lc1UVf-VE" });
    const changeData = await partChangePromise;
    console.log(` Video change received by Participant! Video: ${changeData.videoId}`);

    // ----------------------------------------------------
    // TEST 6: RBAC Verification - Participant Actions MUST be Rejected!
    // ----------------------------------------------------
    console.log("\n[TEST 6] Verifying Backend RBAC Blocks Participant Unauthorized Actions...");

    // 6a. Participant tries to Play
    const partPlayErrPromise = new Promise((resolve) => {
      partSocket.once("error", (err) => resolve(err));
    });
    partSocket.emit("play", { roomCode: testRoomCode, currentTime: 60 });
    const playErr = await partPlayErrPromise;
    if (playErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN on participant play, got: ${JSON.stringify(playErr)}`);
    }
    console.log(` Participant play correctly rejected with FORBIDDEN: "${playErr.message}"`);

    // 6b. Participant tries to Seek
    const partSeekErrPromise = new Promise((resolve) => {
      partSocket.once("error", (err) => resolve(err));
    });
    partSocket.emit("seek", { roomCode: testRoomCode, currentTime: 10 });
    const seekErr = await partSeekErrPromise;
    if (seekErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN on participant seek, got: ${JSON.stringify(seekErr)}`);
    }
    console.log(` Participant seek correctly rejected with FORBIDDEN.`);

    // 6c. Participant tries to Change Video
    const partVidErrPromise = new Promise((resolve) => {
      partSocket.once("error", (err) => resolve(err));
    });
    partSocket.emit("change_video", { roomCode: testRoomCode, videoId: "hacked" });
    const vidErr = await partVidErrPromise;
    if (vidErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN on participant change_video, got: ${JSON.stringify(vidErr)}`);
    }
    console.log(` Participant change_video correctly rejected with FORBIDDEN.`);

    // 6d. Participant tries to Assign Role
    const partRoleErrPromise = new Promise((resolve) => {
      partSocket.once("error", (err) => resolve(err));
    });
    partSocket.emit("assign_role", {
      roomCode: testRoomCode,
      targetUserId: participantUser.userId,
      newRole: "Moderator",
    });
    const roleErr = await partRoleErrPromise;
    if (roleErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN on participant assign_role, got: ${JSON.stringify(roleErr)}`);
    }
    console.log(` Participant assign_role correctly rejected with FORBIDDEN.`);

    // ----------------------------------------------------
    // TEST 7: Role Promotion: Host -> Moderator
    // ----------------------------------------------------
    console.log("\n[TEST 7] Host promotes Participant to Moderator...");
    const roleAssignedPromise = new Promise((resolve) => {
      partSocket.on("role_assigned", (data) => resolve(data));
    });
    hostSocket.emit("assign_role", {
      roomCode: testRoomCode,
      targetUserId: participantUser.userId,
      newRole: "Moderator",
    });
    const assignedData = await roleAssignedPromise;
    if (assignedData.newRole !== "Moderator") {
      throw new Error(`Expected role to be Moderator, got: ${assignedData.newRole}`);
    }
    console.log(` Role promotion successful! Bob is now a Moderator.`);

    // ----------------------------------------------------
    // TEST 8: Moderator CAN now control playback
    // ----------------------------------------------------
    console.log("\n[TEST 8] Bob (now Moderator) controls playback...");
    const hostPlayFromModPromise = new Promise((resolve) => {
      hostSocket.on("play", (data) => resolve(data));
    });
    partSocket.emit("play", { roomCode: testRoomCode, currentTime: 90 });
    const modPlayData = await hostPlayFromModPromise;
    console.log(` Moderator play received by Host! Time: ${modPlayData.currentTime}s, By: ${modPlayData.issuedBy}`);

    // But Moderator CANNOT assign roles
    const modAssignErrPromise = new Promise((resolve) => {
      partSocket.once("error", (err) => resolve(err));
    });
    partSocket.emit("assign_role", {
      roomCode: testRoomCode,
      targetUserId: hostUser.userId,
      newRole: "Participant",
    });
    const modAssignErr = await modAssignErrPromise;
    if (modAssignErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN on moderator assign_role, got: ${JSON.stringify(modAssignErr)}`);
    }
    console.log(` Moderator assign_role correctly rejected with FORBIDDEN.`);

    // ----------------------------------------------------
    // TEST 9: Chat Feature (Bonus)
    // ----------------------------------------------------
    console.log("\n[TEST 9] Testing Chat Box messages...");
    const chatPromise = new Promise((resolve) => {
      hostSocket.on("receive_message", (msg) => resolve(msg));
    });
    partSocket.emit("send_message", {
      roomCode: testRoomCode,
      message: "Hey everyone! Great video!",
    });
    const chatMsg = await chatPromise;
    console.log(` Chat message received! Sender: ${chatMsg.username}, Message: "${chatMsg.message}"`);

    // ----------------------------------------------------
    // TEST 10: Host removes participant
    // ----------------------------------------------------
    console.log("\n[TEST 10] Host removes participant...");
    const kickPromise = new Promise((resolve) => {
      partSocket.on("participant_removed", (data) => resolve(data));
    });
    hostSocket.emit("remove_participant", {
      roomCode: testRoomCode,
      targetUserId: participantUser.userId,
    });
    const kickData = await kickPromise;
    console.log(` Participant received kick notice: "${kickData.reason}"`);

    // Cleanup sockets and server
    hostSocket.disconnect();
    partSocket.disconnect();
    await new Promise((res) => httpServer.close(res));
    // Clean up test room from DB
    await Room.deleteOne({ roomCode: testRoomCode });
    await mongoose.connection.close();

    console.log("\n========================================================");
    console.log(" ALL 10 TESTS PASSED! BACKEND & RBAC ARE PRODUCTION READY!");
    console.log("========================================================\n");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ TEST FAILED:", error);
    if (testRoomCode) {
      await Room.deleteOne({ roomCode: testRoomCode }).catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

runTests();
