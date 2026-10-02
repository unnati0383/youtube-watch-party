import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { RoomProvider } from "./context/RoomContext";
import { Navbar } from "./components/Navbar";
import { Home } from "./pages/Home";
import { CreateRoom } from "./pages/CreateRoom";
import { JoinRoom } from "./pages/JoinRoom";
import { WatchRoom } from "./pages/WatchRoom";

export const App: React.FC = () => {
  return (
    <Router>
      <RoomProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-red-500/30 selection:text-white flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/create-room" element={<CreateRoom />} />
              <Route path="/join-room" element={<JoinRoom />} />
              <Route path="/room/:roomCode" element={<WatchRoom />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </RoomProvider>
    </Router>
  );
};

export default App;
