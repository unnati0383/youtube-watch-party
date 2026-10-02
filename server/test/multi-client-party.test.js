const http = require("http");
const { io: Client } = require("socket.io-client");
const mongoose = require("mongoose");
const app = require("../app");
const initSocketServer = require("../sockets/socketHandler");
const connectDB = require("../config/db");
const Room = require("../models/Room");

async function runMultiClientPartyTest() {
  console.log("==================================================================");
  console.log("  SIMULATING 3 BROWSER SESSIONS (Host, Moderator, Participant)  ");
  console.log("==================================================================");

  await connectDB();

  const PORT = 5088;
  const server = http.createServer(app);
  initSocketServer(server, `http://localhost:${PORT}`);

  await new Promise((res) => server.listen(PORT, res));
  console.log(` Test server listening on http://localhost:${PORT}`);

  let roomCode = "";

  const browser1 = { userId: "session-host-1", username: "Unnati (Host)" };
  const browser2 = { userId: "session-mod-2", username: "Rahul (Moderator)" };
  const browser3 = { userId: "session-part-3", username: "Aman (Participant)" };

  let client1, client2, client3;

  try {
    // Step 1: Create room via REST
    console.log("\n[Step 1] Browser 1 creates room via POST /api/rooms...");
    const createRes = await fetch(`http://localhost:${PORT}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(browser1),
    });
    const createData = await createRes.json();
    roomCode = createData.room.roomCode;
    console.log(` Room created! Code: ${roomCode}`);

    // Step 2: Connect all 3 sockets (representing 3 distinct browser tabs)
    console.log("\n[Step 2] Connecting 3 browser sessions via Socket.IO...");
    client1 = Client(`http://localhost:${PORT}`);
    client2 = Client(`http://localhost:${PORT}`);
    client3 = Client(`http://localhost:${PORT}`);

    await Promise.all([
      new Promise((res) => client1.on("connect", res)),
      new Promise((res) => client2.on("connect", res)),
      new Promise((res) => client3.on("connect", res)),
    ]);
    console.log(" All 3 browser sessions connected to WebSocket server.");

    // Step 3: Browser 1 joins as Host
    const b1StatePromise = new Promise((res) => client1.once("room_state", res));
    client1.emit("join_room", { roomCode, userId: browser1.userId, username: browser1.username });
    const b1State = await b1StatePromise;
    console.log(` Browser 1 joined. Verified Role: ${b1State.currentUser.role}`);

    // Step 4: Browser 2 & 3 join as Participants
    const b2StatePromise = new Promise((res) => client2.once("room_state", res));
    client2.emit("join_room", { roomCode, userId: browser2.userId, username: browser2.username });
    const b2State = await b2StatePromise;
    console.log(` Browser 2 joined. Verified Role: ${b2State.currentUser.role}`);

    const b3StatePromise = new Promise((res) => client3.once("room_state", res));
    client3.emit("join_room", { roomCode, userId: browser3.userId, username: browser3.username });
    const b3State = await b3StatePromise;
    console.log(` Browser 3 joined. Verified Role: ${b3State.currentUser.role}`);

    // Step 5: Browser 1 (Host) promotes Browser 2 to Moderator
    console.log("\n[Step 5] Host (Browser 1) promotes Browser 2 to Moderator...");
    const b2PromotedPromise = new Promise((res) => client2.once("role_assigned", res));
    client1.emit("assign_role", {
      roomCode,
      targetUserId: browser2.userId,
      newRole: "Moderator",
    });
    const promoData = await b2PromotedPromise;
    console.log(` Browser 2 received promotion confirmation to: ${promoData.newRole}`);

    // Step 6: Host plays video at 25 seconds
    console.log("\n[Step 6] Host plays video at 25s...");
    const playPromises = Promise.all([
      new Promise((res) => client2.once("play", res)),
      new Promise((res) => client3.once("play", res)),
    ]);
    client1.emit("play", { roomCode, currentTime: 25 });
    const [b2Play, b3Play] = await playPromises;
    console.log(` Both Browser 2 and Browser 3 received PLAY sync! (Time: ${b2Play.currentTime}s, By: ${b2Play.issuedBy})`);

    // Step 7: Moderator (Browser 2) seeks video to 75s
    console.log("\n[Step 7] Moderator (Browser 2) seeks video to 75s...");
    const seekPromises = Promise.all([
      new Promise((res) => client1.once("seek", res)),
      new Promise((res) => client3.once("seek", res)),
    ]);
    client2.emit("seek", { roomCode, currentTime: 75 });
    const [b1Seek, b3Seek] = await seekPromises;
    console.log(` Both Host and Participant received SEEK sync to: ${b3Seek.currentTime}s by ${b1Seek.issuedBy}`);

    // Step 8: Participant (Browser 3) attempts unauthorized pause and change_video
    console.log("\n[Step 8] Testing Participant (Browser 3) unauthorized control attempts...");
    const b3PauseErrPromise = new Promise((res) => client3.once("error", res));
    client3.emit("pause", { roomCode, currentTime: 75 });
    const b3PauseErr = await b3PauseErrPromise;
    console.log(` Participant pause blocked by backend: [${b3PauseErr.code}] ${b3PauseErr.message}`);

    const b3ChangeVidErrPromise = new Promise((res) => client3.once("error", res));
    client3.emit("change_video", { roomCode, videoId: "unauthorized" });
    const b3ChangeVidErr = await b3ChangeVidErrPromise;
    console.log(` Participant change_video blocked by backend: [${b3ChangeVidErr.code}] ${b3ChangeVidErr.message}`);

    // Step 9: Moderator changes video to Rick Astley
    console.log("\n[Step 9] Moderator changes video to official trailer...");
    const changeVidPromises = Promise.all([
      new Promise((res) => client1.once("video_changed", res)),
      new Promise((res) => client3.once("video_changed", res)),
    ]);
    client2.emit("change_video", { roomCode, videoId: "jfKfPfyJRdk" });
    const [b1Vid, b3Vid] = await changeVidPromises;
    console.log(` Both Host and Participant synchronized to new video: ${b3Vid.videoId} by ${b1Vid.issuedBy}`);

    // Step 10: Participant sends a chat message
    console.log("\n[Step 10] Participant sends chat message...");
    const chatPromises = Promise.all([
      new Promise((res) => client1.once("receive_message", res)),
      new Promise((res) => client2.once("receive_message", res)),
    ]);
    client3.emit("send_message", { roomCode, message: "Hello party! Looks great!" });
    const [b1Msg, b2Msg] = await chatPromises;
    console.log(` Chat received by Host & Moderator: "${b1Msg.message}" from ${b1Msg.username}`);

    // Step 11: Host transfers ownership to Browser 2 (Rahul)
    console.log("\n[Step 11] Host transfers room ownership to Browser 2...");
    const transferPromise = new Promise((res) => client2.once("host_transferred", res));
    client1.emit("transfer_host", { roomCode, targetUserId: browser2.userId });
    const transferData = await transferPromise;
    console.log(` Ownership transferred! New Host: ${transferData.newHostId}`);

    // Step 12: New Host removes Participant (Browser 3)
    console.log("\n[Step 12] New Host removes Browser 3 from the party...");
    const kickPromise = new Promise((res) => client3.once("participant_removed", res));
    client2.emit("remove_participant", { roomCode, targetUserId: browser3.userId });
    const kickData = await kickPromise;
    console.log(` Browser 3 was removed: "${kickData.reason}"`);

    // Teardown
    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    await new Promise((res) => setTimeout(res, 200));
    await new Promise((res) => server.close(res));
    await Room.deleteOne({ roomCode });
    await mongoose.connection.close();

    console.log("\n==================================================================");
    console.log(" MULTI-BROWSER SIMULATION COMPLETED SUCCESSFULLY WITH 100% PASS! ");
    console.log("==================================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("❌ Simulation Failed:", err);
    if (roomCode) {
      await Room.deleteOne({ roomCode }).catch(() => {});
    }
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

runMultiClientPartyTest();
