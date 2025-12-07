import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ChatBubble from './components/ChatBubble';
import { IconMenu, IconMessagePlus, IconSend, IconChevronDown, IconPaperclip, IconX, IconCheck, IconAppLogo } from './components/Icons';
import { Message, ChatSession, Sender } from './types';
import { MODELS, DEFAULT_MODEL, APP_NAME } from './constants';
import { streamResponse } from './services/geminiService';
import { streamPollinationsResponse } from './services/pollinationsService';

// Thinking Indicator Component
const ThinkingIndicator = () => {
  const [textIndex, setTextIndex] = useState(0);
  const phrases = [
    "Thinking...", "Analyzing...", "Connecting...", "Researching...", 
    "Formulating...", "Processing...", "Synthesizing...", "Decoding...", 
    "Reasoning...", "Computing..."
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex(prev => (prev + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-4 py-4 animate-in fade-in duration-300 pl-2">
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
        {/* Conic Gradient Spinner */}
        <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0deg,#a855f7_120deg,#ec4899_240deg,#f97316_360deg)] animate-spin-slow blur-[0.5px]"></div>
        {/* Inner Black Circle */}
        <div className="absolute inset-[2px] bg-background rounded-full z-10"></div>
        {/* Logo in Center */}
        <div className="absolute z-20 flex items-center justify-center">
          <IconAppLogo className="w-3.5 h-3.5 text-white opacity-90" />
        </div>
      </div>
      <span className="text-sm font-medium text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 animate-pulse tracking-widest uppercase">
        {phrases[textIndex]}
      </span>
    </div>
  );
};

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const messages = currentSession?.messages || [];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleNewChat = () => {
    const newId = uuidv4();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setIsSidebarOpen(false);
  };

  const updateSessionTitle = (sessionId: string, firstMessage: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId && s.title === 'New Conversation') {
        return { ...s, title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '') };
      }
      return s;
    }));
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    let activeSessionId = currentSessionId;
    
    // Create new session if none exists or we are on welcome screen (logic wise)
    if (!activeSessionId) {
       const newId = uuidv4();
       activeSessionId = newId;
       const newSession: ChatSession = {
         id: newId,
         title: 'New Conversation',
         messages: [],
         createdAt: Date.now()
       };
       setSessions(prev => [newSession, ...prev]);
       setCurrentSessionId(newId);
    }

    const userMessage: Message = {
      id: uuidv4(),
      text: input,
      sender: Sender.USER,
      timestamp: Date.now()
    };

    const botMessageId = uuidv4();

    // 1. Add User Message AND Empty Bot Message (Thinking State) IMMEDIATELY
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { 
          ...s, 
          messages: [
            ...s.messages, 
            userMessage, 
            { id: botMessageId, text: '', sender: Sender.BOT, timestamp: Date.now() } // Placeholder
          ] 
        };
      }
      return s;
    }));

    updateSessionTitle(activeSessionId, input);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
    
    setIsGenerating(true);

    try {
      const history = sessions.find(s => s.id === activeSessionId)?.messages || [];
      // Filter out the last two messages we just added (User + Placeholder) to avoid sending them as history
      const apiHistory = history.filter(m => m.id !== userMessage.id && m.id !== botMessageId);

      let stream;
      
      // Determine which service to use based on model ID
      if (selectedModel.startsWith('gemini')) {
        stream = await streamResponse(selectedModel, apiHistory, userMessage.text);
      } else {
        stream = await streamPollinationsResponse(selectedModel, apiHistory, userMessage.text);
      }
      
      let fullBotText = '';

      for await (const chunk of stream) {
        fullBotText += chunk;
        setSessions(prev => prev.map(s => {
          if (s.id === activeSessionId) {
            const newMessages = [...s.messages];
            const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
            if (msgIndex !== -1) {
              newMessages[msgIndex] = { ...newMessages[msgIndex], text: fullBotText };
            }
            return { ...s, messages: newMessages };
          }
          return s;
        }));
      }
    } catch (error) {
      console.error(error);
      // Update the placeholder with error message
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const newMessages = [...s.messages];
          const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
          if (msgIndex !== -1) {
            newMessages[msgIndex] = { 
              ...newMessages[msgIndex], 
              text: "Sorry, I encountered an error. Please try again." 
            };
          }
          return { ...s, messages: newMessages };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    // Use 100dvh (Dynamic Viewport Height) to fix mobile browser bar issues
    <div className="flex h-[100dvh] bg-background text-white overflow-hidden font-sans">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
      />

      {/* Main Content Column */}
      <div className="flex-1 flex flex-col relative w-full h-full max-w-5xl mx-auto">
        
        {/* Header - Fixed/Absolute at top */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none bg-gradient-to-b from-background via-background/80 to-transparent">
          {/* Left: Menu Only (Logo Removed) */}
          <div className="flex items-center gap-3 pointer-events-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-white transition-all backdrop-blur-md border border-white/5 hover:border-white/20 shadow-lg"
              aria-label="Open Sidebar"
            >
              <IconMenu />
            </button>
            
            {/* Logo has been removed from here as requested */}
          </div>

          {/* New Chat Button (Top Right) */}
          <button 
             onClick={handleNewChat}
             className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-white transition-all backdrop-blur-md border border-white/5 hover:border-white/20 shadow-lg group"
             aria-label="New Chat"
          >
             <div className="text-gray-200 group-hover:text-purple-400 transition-colors">
               <IconMessagePlus />
             </div>
          </button>
        </div>

        {/* Chat Area - Takes remaining space (flex-1) and scrolls internally */}
        <div className="flex-1 overflow-y-auto w-full px-4 pt-20 pb-4 scroll-smooth">
          {(!currentSessionId || messages.length === 0) ? (
            <WelcomeScreen />
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {/* If this is the bot message and it is empty, show thinking indicator instead of bubble */}
                  {msg.sender === Sender.BOT && msg.text === '' ? (
                     <ThinkingIndicator />
                  ) : (
                     <ChatBubble message={msg} />
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Input Area - Static block at bottom (flex-none) */}
        <div className="flex-none w-full p-4 md:p-6 bg-background z-30">
          <div className="max-w-3xl mx-auto relative group">
            
            {/* The Conic Glow Effect Wrapper */}
            <div className="absolute -inset-[3px] rounded-3xl bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 opacity-60 blur-lg group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient-x"></div>
            
            {/* Main Input Container */}
            <div className="relative bg-[#0F0F0F] rounded-3xl border border-white/10 shadow-2xl flex flex-col p-2">
              
              {/* Text Area */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Velicia"
                rows={1}
                className="w-full bg-transparent text-white text-lg px-4 py-3 focus:outline-none resize-none placeholder-gray-500"
                style={{ minHeight: '56px' }}
              />

              {/* Bottom Controls Bar */}
              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                
                {/* Model Selector Trigger */}
                <button 
                  onClick={() => setIsModelMenuOpen(true)}
                  className="flex items-center gap-2 text-xs md:text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 font-medium">
                    {MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                  </span>
                  <IconChevronDown />
                </button>

                {/* Action Buttons (Bottom Right) */}
                <div className="flex items-center gap-2">
                  <button className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Attach">
                    <IconPaperclip />
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={!input.trim() || isGenerating}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                      input.trim() 
                        ? 'bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] hover:shadow-[0_0_25px_rgba(168,85,247,0.7)]' 
                        : 'bg-white/10 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <IconSend />
                  </button>
                </div>
              </div>

            </div>
          </div>
          
          {/* Warning Text */}
          <div className="text-center mt-3">
             <p className="text-[10px] text-gray-600">VeliciaAI can make mistakes. Check important info.</p>
          </div>
        </div>

      </div>

      {/* Model Selection Bottom Sheet */}
      {isModelMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsModelMenuOpen(false)}
          />
          
          {/* Sheet */}
          <div className="relative w-full max-w-3xl bg-[#121212] border-t border-white/10 rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">Select Model</h2>
              <button 
                onClick={() => setIsModelMenuOpen(false)}
                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <IconX />
              </button>
            </div>

            <div className="space-y-3 pb-4">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => {
                    setSelectedModel(model.id);
                    setIsModelMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group ${
                    selectedModel === model.id
                      ? 'bg-white/10 border-purple-500/50'
                      : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                  }`}
                >
                  <div className="text-left pr-4">
                    <div className={`font-semibold text-base mb-1 ${selectedModel === model.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>
                      {model.name}
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-400 leading-relaxed">
                      {model.description}
                    </div>
                  </div>
                  
                  {selectedModel === model.id && (
                    <div className="flex-none">
                      <IconCheck />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;