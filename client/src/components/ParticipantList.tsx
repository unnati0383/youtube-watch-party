import React from "react";
import { useRoom } from "../context/RoomContext";
import { ParticipantItem } from "./ParticipantItem";
import { Users } from "lucide-react";

export const ParticipantList: React.FC = () => {
  const { participants } = useRoom();

  // Sort: Host first, then Moderators, then Participants
  const sortedParticipants = [...participants].sort((a, b) => {
    const roleOrder: Record<string, number> = { Host: 1, Moderator: 2, Participant: 3 };
    return (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99);
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-3">
        <div className="flex items-center gap-2">
          <Users size={17} className="text-red-500" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Participants ({participants.length})
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1">
        {sortedParticipants.map((p) => (
          <ParticipantItem key={p.userId} participant={p} />
        ))}

        {sortedParticipants.length === 0 && (
          <p className="text-xs text-slate-500 text-center py-4">No participants connected.</p>
        )}
      </div>
    </div>
  );
};
