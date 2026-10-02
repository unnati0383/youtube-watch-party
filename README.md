# YouTube Watch Party — Full Stack MERN Application

A production-quality, real-time collaborative YouTube Watch Party application built using the MERN stack (MongoDB, Express, React, Node.js) and WebSockets via Socket.IO. Multiple users can join a shared room and watch YouTube videos synchronized in real time with Role-Based Access Control (RBAC).

---

## Architecture Overview

```
                      +---------------------------------------+
                      |             React Client              |
                      | (TypeScript + Vite + YouTube IFrame)  |
                      +-------------------+-------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                HTTP REST API                          Socket.IO
                        |                                   |
                        v                                   v
             +--------------------+               +--------------------+
             |   Express Server   |               |  Socket.IO Server  |
             +---------+----------+               +---------+----------+
                       |                                    |
                       v                                    v
             +--------------------+               +--------------------+
             |  Room Controller   |               |  Permissions Check |
             +---------+----------+               |  (permissions.js)  |
                       |                          +---------+----------+
                       v                                    |
             +--------------------+                         v
             |    Room Service    |<------------------------+
             +---------+----------+
                       |
                       v
             +--------------------+
             |      MongoDB       |
             |   (Room Model)     |
             +--------------------+
```

### Why Both REST and WebSockets Are Used
- **REST API (`POST /api/rooms`, `GET /api/rooms/:roomCode`)**:
  Used for standard request-response operations like room creation, room validation, and initial metadata lookup.
- **WebSockets via Socket.IO (`play`, `pause`, `seek`, `change_video`, `role_assigned`)**:
  Used for low-latency, bidirectional real-time synchronization where state changes must be broadcast immediately to all connected clients without polling.

---

## Features

- **Instant Room Creation**: Generates a unique 6-character room code (e.g., `HS49UP`).
- **Automatic Host Assignment**: The room creator is automatically authenticated as the **Host**.
- **Role-Based Access Control (RBAC)**:
  - 👑 **Host**: Full control — play, pause, seek, change video, promote/demote moderators, kick participants, transfer host ownership.
  - 🛡️ **Moderator**: Playback control — play, pause, seek, change video.
  - 👤 **Participant**: Watch-only — receives real-time synced events, view participant roster, send chat messages.
- **Strict Backend Authorization**: Every protected WebSocket event checks the sender's verified role on the server before executing.
- **YouTube IFrame Player API Integration**: Official YouTube player supporting URL input, timeline seeking, and state changes.
- **Loop Prevention (`isApplyingRemoteUpdate`)**: Prevents infinite echo loops between clients when applying remote updates.
- **Autoplay Limitation Fallback**: Clear UI prompt enabling users to unlock audio/playback according to modern browser autoplay policies.
- **Network Latency Compensation**: Compares `currentTime` and `updatedAt` timestamps to minimize drift across clients.
- **Live Room Chat**: Real-time room chat with user badges and timestamps.
- **Efficient MongoDB Updates**: Database writes only occur on discrete events (play, pause, seek, video change), avoiding unnecessary writes every second.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite, React Router v7, Axios, Socket.IO Client, Tailwind CSS v4, Lucide Icons |
| **Backend** | Node.js, Express 4, MongoDB, Mongoose 8, Socket.IO 4, CORS, Dotenv |
| **Testing** | Node.js test runner, Socket.IO client automated integration suite |
| **Deployment** | Render (Backend / WebSocket server), Render / Vercel (Frontend), MongoDB Atlas |

---

## Folder Structure

```
youtube-watch-party/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx
│   │   │   ├── YouTubePlayer.tsx
│   │   │   ├── ParticipantList.tsx
│   │   │   ├── ParticipantItem.tsx
│   │   │   ├── RoomControls.tsx
│   │   │   ├── VideoInput.tsx
│   │   │   └── ChatBox.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── CreateRoom.tsx
│   │   │   ├── JoinRoom.tsx
│   │   │   └── WatchRoom.tsx
│   │   ├── hooks/
│   │   │   ├── useSocket.ts
│   │   │   └── useYouTubePlayer.ts
│   │   ├── context/
│   │   │   └── RoomContext.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── types/
│   │   │   ├── room.ts
│   │   │   └── socket.ts
│   │   ├── utils/
│   │   │   ├── youtube.ts
│   │   │   └── user.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── .env.example
│
├── server/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   └── roomController.js
│   ├── models/
│   │   └── Room.js
│   ├── routes/
│   │   └── roomRoutes.js
│   ├── middleware/
│   │   ├── errorMiddleware.js
│   │   └── authMiddleware.js
│   ├── services/
│   │   └── roomService.js
│   ├── sockets/
│   │   ├── socketHandler.js
│   │   ├── roomSocket.js
│   │   └── permissions.js
│   ├── utils/
│   │   ├── generateRoomCode.js
│   │   ├── ExpressError.js
│   │   └── wrapAsync.js
│   ├── test/
│   │   ├── socket-rbac.test.js
│   │   └── multi-client-party.test.js
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── README.md
├── LEARNING.md
├── INTERVIEW.md
├── .gitignore
├── .env.example
└── package.json
```

---

## How WebSockets Work in this App

1. When a client visits `/room/:roomCode`, `useSocket` establishes a persistent WebSocket connection to the server.
2. The client emits `join_room` with `{ roomCode, userId, username }`.
3. The server validates the room, checks the database, determines the role, and binds the socket to the room channel `socket.join(roomCode)`.
4. The server responds with `room_state` containing the video ID, play/pause status, drift-compensated current time, and participant list.
5. When an authorized user interacts with the player (e.g., clicks Play), the client emits `play` with `{ roomCode, currentTime }`.
6. The server verifies the sender's role via `permissions.js`. If authorized, it updates the room's playback state in MongoDB and broadcasts `play` to all sockets in that room channel.
7. Receiving clients update their local YouTube player without emitting duplicate socket events.

---

## Role-Based Access Control (RBAC) Matrix

| Action | Host | Moderator | Participant |
|---|:---:|:---:|:---:|
| Watch Video | ✅ | ✅ | ✅ |
| View Participant List | ✅ | ✅ | ✅ |
| Play / Pause / Seek | ✅ | ✅ | ❌ |
| Change Video URL | ✅ | ✅ | ❌ |
| Promote to Moderator | ✅ | ❌ | ❌ |
| Demote Moderator | ✅ | ❌ | ❌ |
| Remove Participant | ✅ | ❌ | ❌ |
| Transfer Host Ownership | ✅ | ❌ | ❌ |

---

## Synchronization Strategy

1. **Drift Compensation**: When sending room state to a newly joined client, the server calculates:
   $$\text{Current Time} = \text{playbackState.currentTime} + \frac{\text{Date.now()} - \text{updatedAt}}{1000}$$
2. **Infinite Loop Prevention**: A React ref `isApplyingRemoteUpdate` is toggled `true` right before programmatic player calls (`playVideo()`, `seekTo()`). The YouTube player's `onStateChange` listener checks this ref to avoid re-emitting socket events back to the server.
3. **Seek Throttling**: The seek bar slider emits a single `seek` event on `onMouseUp` / `onTouchEnd` rather than flooding the WebSocket connection with events while dragging.

---

## API Endpoints

### `POST /api/rooms`
- **Description**: Creates a new room.
- **Request Body**:
  ```json
  {
    "userId": "user_12345",
    "username": "Unnati"
  }
  ```
- **Response** (201 Created):
  ```json
  {
    "success": true,
    "message": "Room created successfully",
    "room": {
      "roomCode": "X7K92P",
      "hostId": "user_12345",
      "playbackState": {
        "videoId": "dQw4w9WgXcQ",
        "isPlaying": false,
        "currentTime": 0
      },
      "participants": [{ "userId": "user_12345", "username": "Unnati", "role": "Host" }]
    }
  }
  ```

### `GET /api/rooms/:roomCode`
- **Description**: Retrieves room details and checks validity.
- **Response** (200 OK):
  ```json
  {
    "success": true,
    "room": { ... }
  }
  ```

### `DELETE /api/rooms/:roomCode`
- **Description**: Deletes a room (Host only).

---

## Socket Events Reference

### Client -> Server
- `join_room` (`{ roomCode, userId, username }`)
- `leave_room` (`{ roomCode }`)
- `play` (`{ roomCode, currentTime }`)
- `pause` (`{ roomCode, currentTime }`)
- `seek` (`{ roomCode, currentTime }`)
- `change_video` (`{ roomCode, videoId }`)
- `assign_role` (`{ roomCode, targetUserId, newRole }`)
- `remove_participant` (`{ roomCode, targetUserId }`)
- `transfer_host` (`{ roomCode, targetUserId }`)
- `send_message` (`{ roomCode, message }`)
- `request_sync` (`{ roomCode }`)
- `request_control` (`{ roomCode }`)

### Server -> Client
- `room_state`: Initial state payload sent upon joining.
- `user_joined`: Broadcast when a new participant connects.
- `user_left`: Broadcast when a participant leaves or disconnects.
- `play`: Broadcast when authorized user resumes playback.
- `pause`: Broadcast when authorized user pauses playback.
- `seek`: Broadcast with new target playback timestamp.
- `video_changed`: Broadcast when new video is loaded.
- `role_assigned`: Broadcast when a role is changed by the Host.
- `participant_removed`: Direct notification and room broadcast when someone is kicked.
- `host_transferred`: Broadcast when Host transfers ownership.
- `receive_message`: Broadcast when chat message is sent.
- `error`: Sent to an offending client on permission denial or validation failure (`{ code, message }`).

---

## Local Installation & Setup

### Prerequisites
- Node.js v18+ (tested on Node v24)
- MongoDB running locally on port 27017 (or MongoDB Atlas connection URI)

### 1. Clone & Install Dependencies
From the repository root:
```bash
# Install root, server, and client dependencies
npm run install:all
```

### 2. Configure Environment Variables

**Server (`server/.env`)**:
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/youtube_watch_party
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

**Client (`client/.env`)**:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

### 3. Run the Application
From the repository root:
```bash
# Starts both Express backend and Vite frontend concurrently
npm run dev
```

The application will be accessible at:
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000/api`

---

## Running Automated Tests

Run the backend integration test and the 3-browser multi-session simulation:
```bash
npm run test
```

Or run individual tests:
```bash
# Test 1: REST API & Socket RBAC integration
node server/test/socket-rbac.test.js

# Test 2: 3-Session Multi-Client simulation (Host, Moderator, Participant)
node server/test/multi-client-party.test.js
```

---

## Production Deployment Guide

### Backend on Render
1. Create a **Web Service** on [Render](https://render.com).
2. Root Directory: `server`.
3. Build Command: `npm install`.
4. Start Command: `node server.js`.
5. Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000` (or leave default for Render)
   - `MONGO_URI`: `mongodb+srv://<user>:<password>@cluster.mongodb.net/watchparty?retryWrites=true&w=majority`
   - `CLIENT_URL`: `https://your-frontend.vercel.app` (or Render frontend URL)

### Frontend on Vercel or Render
1. Create a project on Vercel or Render Static Site.
2. Root Directory: `client`.
3. Build Command: `npm run build`.
4. Output Directory: `dist`.
5. Environment Variables:
   - `VITE_API_URL`: `https://your-backend.onrender.com/api`
   - `VITE_SOCKET_URL`: `https://your-backend.onrender.com`

---

## Assignment Requirement Checklist

| Assignment Requirement | Implementation | Status |
|---|---|:---:|
| Create room | REST API + React UI | ✅ Complete |
| Join room | Room code + URL param navigation | ✅ Complete |
| Unique room code | 6-char generator (`generateRoomCode.js`) | ✅ Complete |
| YouTube integration | Official IFrame Player API | ✅ Complete |
| Play sync | Socket.IO `play` broadcast | ✅ Complete |
| Pause sync | Socket.IO `pause` broadcast | ✅ Complete |
| Seek sync | Socket.IO `seek` with committed slider | ✅ Complete |
| Change video | Socket.IO `change_video` with URL extraction | ✅ Complete |
| Host Role | Full controls & user management | ✅ Complete |
| Moderator Role | Playback control permissions | ✅ Complete |
| Participant Role | Watch-only viewer restrictions | ✅ Complete |
| Assign Role | Host promotes/demotes (`permissions.js`) | ✅ Complete |
| Remove Participant | Host kicks participant from room | ✅ Complete |
| Backend Permission Validation | `permissions.js` on every event | ✅ Complete |
| Participant List | React UI with badges and actions | ✅ Complete |
| Autoplay Limitation Handling | User interaction prompt banner | ✅ Complete |
| Loop Prevention | `isApplyingRemoteUpdate` ref | ✅ Complete |
| Deployment Readiness | Render/Vercel configuration & CORS | ✅ Complete |

---

## Known Limitations

- **Browser Autoplay Policies**: Modern browsers require an initial user gesture before playing audio in an embedded iframe. The application includes a clear overlay banner explaining this and offering a one-click unlock.
- **YouTube Embed Restrictions**: Some specific music videos or copyright-restricted tracks are blocked by video owners from third-party iframe embeds. Standard videos and trailers play properly.

## Future Improvements

- Video playback queue / playlist feature.
- Redis Pub/Sub Adapter for horizontal scaling across multiple Node.js instances.
- WebRTC voice/video chat integration.
