import React from 'react';
import { ChatSession } from '../types';
import { IconMessage, IconX, IconMessagePlus } from './Icons';
import { APP_NAME } from '../constants';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  sessions,
  currentSessionId,
  onSelectSession,
  onNewChat
}) => {
  return (
    <>
      {/* Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-[#0a0a0a] border-r border-white/10 z-50 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <span className="font-bold text-lg tracking-tight text-white">{APP_NAME}</span>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
            <IconX />
          </button>
        </div>

        <div className="p-4">
          <button 
            onClick={() => {
              onNewChat();
              if (window.innerWidth < 768) onClose();
            }}
            className="w-full flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white py-3 px-4 rounded-xl transition-all duration-200 group"
          >
            <div className="text-purple-500 group-hover:text-purple-400 transition-colors">
               <IconMessagePlus />
            </div>
            <span className="font-medium">New Chat</span>
          </button>
        </div>

        <div className="px-2 overflow-y-auto h-[calc(100%-140px)]">
          <p className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent</p>
          <div className="space-y-1">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => {
                  onSelectSession(session.id);
                  if (window.innerWidth < 768) onClose();
                }}
                className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                  currentSessionId === session.id 
                    ? 'bg-white/10 text-white' 
                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <IconMessage />
                <span className="truncate text-sm font-medium">{session.title}</span>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="px-4 text-sm text-gray-600 italic">No history yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;