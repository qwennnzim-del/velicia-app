
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Message, Sender } from '../types';
import { IconAppLogo, IconCopy, IconCheck } from './Icons';
import { APP_NAME } from '../constants';

interface ChatBubbleProps {
  message: Message;
}

const CodeBlock = ({ language, children }: { language: string, children: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="rounded-xl overflow-hidden my-4 border border-white/10 bg-[#1e1e1e] shadow-lg max-w-full">
      <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-white/5">
        <span className="text-xs font-mono text-gray-400 lowercase">{language || 'code'}</span>
        <button 
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors py-1 px-2 rounded-md hover:bg-white/10"
        >
          {isCopied ? (
            <>
              <IconCheck className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <IconCopy />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={language}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1.5rem',
            fontSize: '0.85rem', // Smaller professional text
            lineHeight: '1.5',
            backgroundColor: '#1e1e1e', // Match container
          }}
          wrapLines={true}
          wrapLongLines={false} // Prevent breaking formatting, allow horizontal scroll
        >
          {children}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === Sender.USER;

  return (
    <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'} mb-8 group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      <div 
        className={`
          w-full
          max-w-[90%] md:max-w-[85%] lg:max-w-[80%] 
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

        {/* Content Area */}
        <div 
          className={`
            w-full prose prose-invert 
            ${isUser 
              ? 'text-right text-white text-lg md:text-xl font-medium tracking-tight leading-relaxed prose-p:text-white' // User
              : 'text-left text-gray-100 text-[16px] md:text-[17px] leading-7 font-normal tracking-wide antialiased' // AI
            }
            prose-p:my-3
            prose-headings:font-bold prose-headings:text-white prose-headings:mt-6 prose-headings:mb-3
            prose-strong:text-white prose-strong:font-bold
            prose-ul:my-3 prose-ol:my-3
            prose-li:my-1
            prose-a:text-purple-400 prose-a:no-underline hover:prose-a:underline
            prose-pre:p-0 prose-pre:bg-transparent prose-pre:m-0 prose-pre:border-none prose-pre:shadow-none
            prose-code:text-purple-300 prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none prose-code:text-sm prose-code:font-mono
          `}
        >
           <ReactMarkdown
             components={{
               code({node, inline, className, children, ...props}: any) {
                 const match = /language-(\w+)/.exec(className || '');
                 return !inline && match ? (
                   <CodeBlock language={match[1]}>
                     {String(children).replace(/\n$/, '')}
                   </CodeBlock>
                 ) : (
                   <code className={className} {...props}>
                     {children}
                   </code>
                 );
               }
             }}
           >
             {message.text}
           </ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default ChatBubble;
