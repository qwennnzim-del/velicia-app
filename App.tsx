import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ChatBubble from './components/ChatBubble';
import { IconMenu, IconMessagePlus, IconSend, IconChevronDown, IconPaperclip } from './components/Icons';
import { Message, ChatSession, Sender } from './types';
import { MODELS, DEFAULT_MODEL } from './constants';
import { streamResponse } from './services/geminiService';

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

    // Optimistic update
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return { ...s, messages: [...s.messages, userMessage] };
      }
      return s;
    }));

    updateSessionTitle(activeSessionId, input);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; // Reset height
    
    setIsGenerating(true);

    try {
      const history = sessions.find(s => s.id === activeSessionId)?.messages || [];
      const stream = await streamResponse(selectedModel, history, userMessage.text);
      
      const botMessageId = uuidv4();
      let fullBotText = '';

      // Create placeholder bot message
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { 
            ...s, 
            messages: [...s.messages, { id: botMessageId, text: '', sender: Sender.BOT, timestamp: Date.now() }] 
          };
        }
        return s;
      }));

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
      // Add error message to chat
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return { 
            ...s, 
            messages: [...s.messages, { id: uuidv4(), text: "Sorry, I encountered an error. Please try again.", sender: Sender.BOT, timestamp: Date.now() }] 
          };
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
    <div className="flex h-screen bg-background text-white overflow-hidden font-sans">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full h-full">
        
        {/* Header Controls */}
        <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
          {/* Menu Button (Top Left) */}
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-white transition-all backdrop-blur-md border border-white/5 hover:border-white/20 shadow-lg"
            aria-label="Open Sidebar"
          >
             <IconMenu />
          </button>

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

        {/* Chat Area - Increased bottom padding to pb-60 to fix text covering issues */}
        <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-4 pt-20 pb-60 scroll-smooth">
          {(!currentSessionId || messages.length === 0) ? (
            <WelcomeScreen />
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

        {/* Floating Input Area (Sticky Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-background via-background to-transparent z-30">
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
                
                {/* Model Selector (Bottom Left) */}
                <div className="relative">
                  <button 
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-2 text-xs md:text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                  >
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 font-medium">
                      {MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                    </span>
                    <IconChevronDown />
                  </button>
                  
                  {isModelMenuOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden py-1 animate-in fade-in slide-in-from-bottom-2 z-50">
                      {MODELS.map(model => (
                        <button
                          key={model.id}
                          onClick={() => {
                            setSelectedModel(model.id);
                            setIsModelMenuOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm hover:bg-white/10 transition-colors flex items-center justify-between ${selectedModel === model.id ? 'text-purple-400 bg-white/5' : 'text-gray-300'}`}
                        >
                          {model.name}
                          {selectedModel === model.id && <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

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
    </div>
  );
};

export default App;