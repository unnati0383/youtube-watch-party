import React, { useState } from "react";
import type { Participant } from "../types/room";
import { useRoom } from "../context/RoomContext";
import { Crown, Shield, User, MoreVertical, UserMinus, ShieldAlert, ArrowUpRight } from "lucide-react";

interface ParticipantItemProps {
  participant: Participant;
}

export const ParticipantItem: React.FC<ParticipantItemProps> = ({ participant }) => {
  const { isHost, currentUser, assignRole, removeParticipant, transferHost } = useRoom();
  const [showMenu, setShowMenu] = useState<boolean>(false);

  const isSelf = participant.userId === currentUser.userId;

  const getRoleIcon = () => {
    switch (participant.role) {
      case "Host":
        return <Crown size={15} className="text-amber-400" />;
      case "Moderator":
        return <Shield size={15} className="text-blue-400" />;
      default:
        return <User size={15} className="text-slate-400" />;
    }
  };

  const getRoleBadgeClasses = () => {
    switch (participant.role) {
      case "Host":
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      case "Moderator":
        return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default:
        return "bg-slate-800 text-slate-400 border-slate-700/50";
    }
  };

  return (
    <div className="relative flex items-center justify-between p-3 rounded-xl bg-slate-950/40 border border-slate-800/80 hover:border-slate-700/80 transition-all group">
      {/* User Info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0">
          {getRoleIcon()}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100 truncate">
              {participant.username}
            </span>
            {isSelf && (
              <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.2 rounded font-medium">
                You
              </span>
            )}
          </div>
          <span
            className={`inline-block text-[11px] px-2 py-0.5 rounded border font-medium mt-0.5 ${getRoleBadgeClasses()}`}
          >
            {participant.role}
          </span>
        </div>
      </div>

      {/* Host Management Actions */}
      {isHost && !isSelf && (
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Manage participant"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <>
              {/* Click backdrop to close */}
              <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />

              <div className="absolute right-0 top-8 z-30 w-44 bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl py-1 backdrop-blur-md animate-fadeIn">
                {/* Promote to Moderator */}
                {participant.role === "Participant" && (
                  <button
                    onClick={() => {
                      assignRole(participant.userId, "Moderator");
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-300 hover:bg-slate-800 text-left transition-colors"
                  >
                    <Shield size={14} className="text-blue-400" />
                    <span>Make Moderator</span>
                  </button>
                )}

                {/* Demote to Participant */}
                {participant.role === "Moderator" && (
                  <button
                    onClick={() => {
                      assignRole(participant.userId, "Participant");
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 text-left transition-colors"
                  >
                    <ShieldAlert size={14} className="text-amber-400" />
                    <span>Demote to Viewer</span>
                  </button>
                )}

                {/* Transfer Host */}
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Are you sure you want to transfer Host ownership to ${participant.username}? You will become a regular participant.`
                      )
                    ) {
                      transferHost(participant.userId);
                      setShowMenu(false);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-amber-300 hover:bg-slate-800 text-left transition-colors border-t border-slate-800"
                >
                  <ArrowUpRight size={14} className="text-amber-400" />
                  <span>Transfer Host</span>
                </button>

                {/* Remove Participant */}
                <button
                  onClick={() => {
                    if (window.confirm(`Kick ${participant.username} out of the party?`)) {
                      removeParticipant(participant.userId);
                      setShowMenu(false);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 text-left transition-colors border-t border-slate-800"
                >
                  <UserMinus size={14} />
                  <span>Remove from Room</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
