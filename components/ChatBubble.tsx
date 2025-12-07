import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, Sender } from '../types';

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
        {/* Sender Name (Optional - keep minimal or hidden based on request, here hidden but structure ready) */}
        
        {/* Content Area - Completely Transparent */}
        <div 
          className={`
            prose prose-invert max-w-none 
            ${isUser 
              ? 'text-right text-gray-200 text-lg md:text-xl font-medium tracking-tight leading-relaxed' // User Style: Like a headline/query
              : 'text-left text-gray-300 text-base md:text-lg leading-7 tracking-wide font-light' // AI Style: Professional body text
            }
            prose-p:my-1 prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg
            prose-headings:font-semibold prose-headings:text-white prose-headings:mt-4 prose-headings:mb-2
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
            prose-strong:text-white prose-strong:font-bold
            prose-code:text-pink-300 prose-code:bg-white/5 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-ul:my-2 prose-ol:my-2
            prose-li:my-0.5
          `}
        >
           <ReactMarkdown>{message.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;