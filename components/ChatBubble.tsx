
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender } from '../types';
import { IconAppLogo } from './Icons';
import { APP_NAME } from '../constants';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === Sender.USER;

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-8 group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`
          max-w-[90%] md:max-w-[80%] lg:max-w-[75%] 
          flex flex-col 
          ${isUser ? 'items-end' : 'items-start'}
        `}
      >
        {/* AI Identity Header */}
        {!isUser && (
          <div className="flex items-center gap-2.5 mb-2 pl-1 select-none">
             <div className="relative flex items-center justify-center w-5 h-5">
                <div className="absolute inset-0 bg-purple-500/30 blur-sm rounded-full"></div>
                <IconAppLogo className="relative w-5 h-5 text-white" />
             </div>
             <span className="text-sm font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400">
               {APP_NAME}
             </span>
          </div>
        )}

        {/* Content Area - Completely Transparent */}
        <div 
          className={`
            prose prose-invert max-w-none 
            ${isUser 
              ? 'text-right text-white text-lg md:text-xl font-medium tracking-tight leading-relaxed' // User
              : 'text-left text-gray-100 text-[17px] md:text-[19px] leading-8 font-normal tracking-wide antialiased' // AI: Sharper, professional
            }
            prose-p:my-3 prose-p:text-gray-100
            prose-headings:font-bold prose-headings:text-white prose-headings:mt-6 prose-headings:mb-3
            prose-pre:bg-[#151515] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-xl prose-pre:shadow-lg
            prose-code:text-purple-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
            prose-strong:text-white prose-strong:font-bold
            prose-ul:my-3 prose-ol:my-3
            prose-li:my-1
          `}
        >
           <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
