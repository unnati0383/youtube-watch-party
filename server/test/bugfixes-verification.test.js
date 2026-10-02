const http = require("http");
const { io: Client } = require("socket.io-client");
const mongoose = require("mongoose");
const app = require("../app");
const initSocketServer = require("../sockets/socketHandler");
const connectDB = require("../config/db");
const Room = require("../models/Room");

async function runBugfixesVerification() {
  console.log("==================================================================");
  console.log("  VERIFYING BUG FIXES 1, 2, 3, AND 4 (SYNCHRONIZATION & RECONNECT)");
  console.log("==================================================================");

  await connectDB();

  const PORT = 5077;
  const server = http.createServer(app);
  initSocketServer(server, `http://localhost:${PORT}`);

  await new Promise((res) => server.listen(PORT, res));
  console.log(` Test server listening on http://localhost:${PORT}`);

  let roomCode = "";
  const hostUser = { userId: "user-host-fix-1", username: "HostAlice" };
  const participantUser = { userId: "user-part-fix-2", username: "ParticipantBob" };

  let hostSocket, partSocket;

  try {
    // ----------------------------------------------------
    // TEST BUG 1: Selected video persistence & participant sync
    // ----------------------------------------------------
    console.log("\n[TEST BUG 1] Step 1: Host creates room...");
    const createRes = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(hostUser),
    });
    const createData = await createRes.json();
    roomCode = createData.room.roomCode;
    console.log(` Room created with code: ${roomCode}`);

    // Connect Host socket
    hostSocket = Client(`http://localhost:${PORT}`);
    await new Promise((res) => hostSocket.on("connect", res));

    const hostJoinedPromise = new Promise((res) => hostSocket.once("room_state", res));
    hostSocket.emit("join_room", { roomCode, userId: hostUser.userId, username: hostUser.username });
    await hostJoinedPromise;
    console.log(" Host joined room.");

    // Host changes video from default ('dQw4w9WgXcQ') to 'M7lc1UVf-VE'
    console.log("[TEST BUG 1] Step 2: Host changes video to 'M7lc1UVf-VE'...");
    const videoChangedPromise = new Promise((res) => hostSocket.once("video_changed", res));
    hostSocket.emit("change_video", { roomCode, videoId: "M7lc1UVf-VE" });
    const changedData = await videoChangedPromise;
    console.log(` Video changed event confirmed on server: ${changedData.videoId}`);

    // Verify MongoDB actually persisted the changed video
    const dbRoom = await Room.findOne({ roomCode });
    if (!dbRoom || dbRoom.playbackState.videoId !== "M7lc1UVf-VE") {
      throw new Error(`MongoDB failed to persist selected video. Found: ${dbRoom?.playbackState?.videoId}`);
    }
    console.log(` Verified in MongoDB: playbackState.videoId = '${dbRoom.playbackState.videoId}'`);

    // Step 3: Now open second session (Participant Bob joins AFTER video was changed)
    console.log("[TEST BUG 1] Step 3: Participant Bob joins existing room...");
    // 3a: Verify REST GET /api/rooms/:roomCode returns the selected video
    const getRoomRes = await fetch(`http://localhost:${PORT}/api/rooms/${roomCode}`);
    const getRoomData = await getRoomRes.json();
    if (getRoomData.room.playbackState.videoId !== "M7lc1UVf-VE") {
      throw new Error(`REST API returned wrong video for existing room: ${getRoomData.room.playbackState.videoId}`);
    }
    console.log(` REST API returned selected video: ${getRoomData.room.playbackState.videoId}`);

    // 3b: Verify Socket.IO join_room returns the selected video in room_state
    partSocket = Client(`http://localhost:${PORT}`);
    await new Promise((res) => partSocket.on("connect", res));

    const partJoinedPromise = new Promise((res) => partSocket.once("room_state", res));
    partSocket.emit("join_room", { roomCode, userId: participantUser.userId, username: participantUser.username });
    const partState = await partJoinedPromise;

    if (partState.playbackState.videoId !== "M7lc1UVf-VE") {
      throw new Error(`Participant received DEFAULT video instead of Host selected video! Received: ${partState.playbackState.videoId}`);
    }
    console.log(` PASS: Participant immediately received authoritative video '${partState.playbackState.videoId}', NOT the default video!`);

    // ----------------------------------------------------
    // TEST BUG 2: Page Refresh & Reconnect State Recovery
    // ----------------------------------------------------
    console.log("\n[TEST BUG 2] Step 1: Simulate Participant Bob refreshing the browser...");
    // Disconnect Bob's socket (simulating page unload)
    partSocket.disconnect();
    console.log(" Bob's socket disconnected (browser refreshed).");
    await new Promise((res) => setTimeout(res, 300));

    // Reconnect Bob with existing identity from localStorage
    console.log("[TEST BUG 2] Step 2: Bob reloads page, recovers session and rejoins...");
    partSocket = Client(`http://localhost:${PORT}`);
    await new Promise((res) => partSocket.on("connect", res));

    const bobRejoinPromise = new Promise((res) => partSocket.once("room_state", res));
    partSocket.emit("join_room", { roomCode, userId: participantUser.userId, username: participantUser.username });
    const bobRejoinState = await bobRejoinPromise;

    if (bobRejoinState.playbackState.videoId !== "M7lc1UVf-VE") {
      throw new Error(`After refresh, Bob lost video state! Received: ${bobRejoinState.playbackState.videoId}`);
    }
    console.log(` Bob successfully recovered room state: video '${bobRejoinState.playbackState.videoId}'`);

    // Verify Bob is not duplicated in participant list
    const bobOccurrences = bobRejoinState.participants.filter((p) => p.userId === participantUser.userId);
    if (bobOccurrences.length !== 1) {
      throw new Error(`Duplicate participant detected after reconnect! Count: ${bobOccurrences.length}`);
    }
    console.log(` PASS: No duplicate participants created on reconnect. Participant count: ${bobRejoinState.participants.length}`);

    // Simulate Host refreshing the browser
    console.log("\n[TEST BUG 2] Step 3: Simulate Host Alice refreshing the browser...");
    hostSocket.disconnect();
    await new Promise((res) => setTimeout(res, 300));

    hostSocket = Client(`http://localhost:${PORT}`);
    await new Promise((res) => hostSocket.on("connect", res));

    const hostRejoinPromise = new Promise((res) => hostSocket.once("room_state", res));
    hostSocket.emit("join_room", { roomCode, userId: hostUser.userId, username: hostUser.username });
    const hostRejoinState = await hostRejoinPromise;

    if (hostRejoinState.currentUser.role !== "Host") {
      throw new Error(`Host role lost on page refresh! Received: ${hostRejoinState.currentUser.role}`);
    }
    console.log(` PASS: Host role preserved upon reconnect: '${hostRejoinState.currentUser.role}'`);

    // ----------------------------------------------------
    // TEST BUG 3: Participant Control Restrictions
    // ----------------------------------------------------
    console.log("\n[TEST BUG 3] Verifying Participant direct controls are strictly blocked...");
    const playBlockPromise = new Promise((res) => partSocket.once("error", res));
    partSocket.emit("play", { roomCode, currentTime: 30 });
    const playErr = await playBlockPromise;
    if (playErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN, got: ${JSON.stringify(playErr)}`);
    }
    console.log(` PASS: Participant play blocked with FORBIDDEN: "${playErr.message}"`);

    const seekBlockPromise = new Promise((res) => partSocket.once("error", res));
    partSocket.emit("seek", { roomCode, currentTime: 90 });
    const seekErr = await seekBlockPromise;
    if (seekErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN, got: ${JSON.stringify(seekErr)}`);
    }
    console.log(` PASS: Participant seek blocked with FORBIDDEN: "${seekErr.message}"`);

    const changeVidBlockPromise = new Promise((res) => partSocket.once("error", res));
    partSocket.emit("change_video", { roomCode, videoId: "hacked_vid" });
    const vidErr = await changeVidBlockPromise;
    if (vidErr.code !== "FORBIDDEN") {
      throw new Error(`Expected FORBIDDEN, got: ${JSON.stringify(vidErr)}`);
    }
    console.log(` PASS: Participant change_video blocked with FORBIDDEN: "${vidErr.message}"`);

    // ----------------------------------------------------
    // TEST BUG 4: Playback Synchronization Flow
    // ----------------------------------------------------
    console.log("\n[TEST BUG 4] Verifying Host Play, Pause, Seek synchronization...");
    // Play
    const partPlayPromise = new Promise((res) => partSocket.once("play", res));
    hostSocket.emit("play", { roomCode, currentTime: 40 });
    const playData = await partPlayPromise;
    console.log(` PASS: Play synchronized to Participant at ${playData.currentTime}s`);

    // Pause
    const partPausePromise = new Promise((res) => partSocket.once("pause", res));
    hostSocket.emit("pause", { roomCode, currentTime: 45 });
    const pauseData = await partPausePromise;
    console.log(` PASS: Pause synchronized to Participant at ${pauseData.currentTime}s`);

    // Seek
    const partSeekPromise = new Promise((res) => partSocket.once("seek", res));
    hostSocket.emit("seek", { roomCode, currentTime: 110 });
    const seekData = await partSeekPromise;
    console.log(` PASS: Seek synchronized to Participant at ${seekData.currentTime}s`);

    // Teardown
    hostSocket.disconnect();
    partSocket.disconnect();
    await new Promise((res) => setTimeout(res, 200));
    await new Promise((res) => server.close(res));
    await Room.deleteOne({ roomCode });
    await mongoose.connection.close();

    console.log("\n==================================================================");
    console.log(" ALL BUG FIX TESTS (1, 2, 3, 4) PASSED COMPLETELY! 100% SUCCESS!  ");
    console.log("==================================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed:", err);
    if (roomCode) {
      await Room.deleteOne({ roomCode }).catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

runBugfixesVerification();
