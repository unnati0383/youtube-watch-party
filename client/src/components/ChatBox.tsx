import React, { useState, useRef, useEffect } from "react";
import { useRoom } from "../context/RoomContext";
import { MessageSquare, Send } from "lucide-react";

export const ChatBox: React.FC = () => {
  const { chatMessages, sendChatMessage, currentUser } = useRoom();
  const [inputText, setInputText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    sendChatMessage(inputText);
    setInputText("");
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col h-[380px]">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-800/80 mb-3">
        <MessageSquare size={17} className="text-red-500" />
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">
          Party Chat
        </h2>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 text-sm">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 text-xs text-center p-4">
            <p>No messages yet.</p>
            <p>Say hello to everyone in the room!</p>
          </div>
        ) : (
          chatMessages.map((msg) => {
            const isMe = msg.userId === currentUser.userId;
            const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  isMe
                    ? "self-end bg-gradient-to-r from-red-600/90 to-rose-600/90 text-white border border-red-500/40"
                    : "self-start bg-slate-800/80 text-slate-200 border border-slate-700/60"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1 text-[10px] opacity-80 font-medium">
                  <span className="font-bold">{isMe ? "You" : msg.username}</span>
                  <span>•</span>
                  <span>{timeStr}</span>
                </div>
                <p className="break-words leading-relaxed">{msg.message}</p>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="flex gap-2 mt-3 pt-2 border-t border-slate-800/80">
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          maxLength={300}
          className="flex-1 bg-slate-950/80 border border-slate-700/80 focus:border-red-500/80 focus:ring-1 focus:ring-red-500/50 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all"
        />
        <button
          type="submit"
          className="p-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-xl shadow-md transition-all hover:scale-105 active:scale-95 shrink-0"
          title="Send"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
