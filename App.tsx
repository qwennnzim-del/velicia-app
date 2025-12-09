import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Sidebar from './components/Sidebar';
import WelcomeScreen from './components/WelcomeScreen';
import ChatBubble from './components/ChatBubble';
import { 
  IconMenu, IconMessagePlus, IconSend, IconChevronDown, 
  IconPaperclip, IconX, IconCheck, IconAppLogo,
  IconCamera, IconImage, IconFile, IconXCircle, IconSearch
} from './components/Icons';
import { Message, ChatSession, Sender, Attachment } from './types';
import { MODELS, DEFAULT_MODEL } from './constants';
import { streamResponse } from './services/geminiService';
import { streamPollinationsResponse } from './services/pollinationsService';
import { streamHuggingFaceResponse } from './services/huggingFaceService';

// Thinking Indicator Component with Search Support
const ThinkingIndicator = ({ isSearching = false }: { isSearching?: boolean }) => {
  const [textIndex, setTextIndex] = useState(0);
  
  const thinkingPhrases = [
    "Thinking...", "Analyzing...", "Connecting...", "Formulating...", 
    "Processing...", "Synthesizing...", "Reasoning...", "Computing..."
  ];
  
  const searchingPhrases = [
    "Searching...", "Browsing web...", "Finding sources...", "Checking facts...",
    "Scanning database...", "Verifying info...", "Looking up...", "Deep searching..."
  ];

  const phrases = isSearching ? searchingPhrases : thinkingPhrases;

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex(prev => (prev + 1) % phrases.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [phrases]);

  return (
    <div className="flex items-center gap-4 py-4 animate-in fade-in duration-300 pl-2">
      <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
        {/* Conic Gradient Spinner */}
        <div className={`absolute inset-0 rounded-full animate-spin-slow blur-[0.5px] ${
          isSearching 
            ? 'bg-[conic-gradient(from_0deg,transparent_0deg,#3b82f6_120deg,#06b6d4_240deg,#3b82f6_360deg)]' // Blue/Cyan for search
            : 'bg-[conic-gradient(from_0deg,transparent_0deg,#a855f7_120deg,#ec4899_240deg,#f97316_360deg)]' // Purple/Orange for think
        }`}></div>
        
        {/* Inner Black Circle */}
        <div className="absolute inset-[2px] bg-background rounded-full z-10"></div>
        
        {/* Icon in Center */}
        <div className="absolute z-20 flex items-center justify-center">
          {isSearching ? (
             <IconSearch /> // Assuming IconSearch is small enough or we style it
          ) : (
             <IconAppLogo className="w-3.5 h-3.5 text-white opacity-90" />
          )}
        </div>
      </div>
      <span className={`text-sm font-medium text-transparent bg-clip-text animate-pulse tracking-widest uppercase ${
        isSearching ? 'bg-gradient-to-r from-blue-400 to-cyan-400' : 'bg-gradient-to-r from-purple-400 to-pink-400'
      }`}>
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
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSearchingMode, setIsSearchingMode] = useState(false);
  
  // Attachments State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setAttachments([]);
  };

  const updateSessionTitle = (sessionId: string, firstMessage: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId && s.title === 'New Conversation') {
        return { ...s, title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? '...' : '') };
      }
      return s;
    }));
  };

  // Helper to read file as Base64
  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      try {
        const base64Data = await readFileAsBase64(file);
        const newAttachment: Attachment = {
          id: uuidv4(),
          type: file.type.startsWith('image/') ? 'image' : 'file',
          mimeType: file.type,
          data: base64Data,
          name: file.name
        };
        setAttachments(prev => [...prev, newAttachment]);
        setIsAttachmentMenuOpen(false);
      } catch (err) {
        console.error("Failed to read file", err);
      }
    }
  };

  const triggerFileUpload = (acceptType: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isGenerating) return;

    // Detect search intent keywords
    const searchKeywords = /(cari|search|harga|terbaru|news|berita|siapa|dimana|kapan|what is|where is|who is)/i;
    const isSearchIntent = searchKeywords.test(input);
    setIsSearchingMode(isSearchIntent);

    let activeSessionId = currentSessionId;
    
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

    // Prepare text to display (include attachment info if any)
    let displayText = input;
    if (attachments.length > 0) {
      const fileNames = attachments.map(a => `[${a.type === 'image' ? 'Image' : 'File'}: ${a.name}]`).join(' ');
      displayText = `${input}\n${fileNames}`.trim();
    }

    const userMessage: Message = {
      id: uuidv4(),
      text: displayText,
      sender: Sender.USER,
      timestamp: Date.now()
    };

    const botMessageId = uuidv4();

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

    updateSessionTitle(activeSessionId, input || 'Attachment sent');
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]); // Clear attachments after sending
    if (textareaRef.current) textareaRef.current.style.height = 'auto'; 
    
    setIsGenerating(true);

    try {
      const history = sessions.find(s => s.id === activeSessionId)?.messages || [];
      const apiHistory = history.filter(m => m.id !== userMessage.id && m.id !== botMessageId);

      let stream;
      
      if (selectedModel.startsWith('gemini')) {
        stream = await streamResponse(selectedModel, apiHistory, input, currentAttachments);
      } else if (selectedModel.startsWith('hf_')) {
        // HUGGING FACE SERVICE ROUTING
        stream = await streamHuggingFaceResponse(selectedModel, apiHistory, input, currentAttachments);
      } else {
        stream = await streamPollinationsResponse(selectedModel, apiHistory, input, currentAttachments);
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
      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          const newMessages = [...s.messages];
          const msgIndex = newMessages.findIndex(m => m.id === botMessageId);
          if (msgIndex !== -1) {
            newMessages[msgIndex] = { 
              ...newMessages[msgIndex], 
              text: "Sorry, I encountered an error processing your request. Please check your connection or API keys." 
            };
          }
          return { ...s, messages: newMessages };
        }
        return s;
      }));
    } finally {
      setIsGenerating(false);
      setIsSearchingMode(false); // Reset search mode
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-[100dvh] bg-background text-white overflow-hidden font-sans">
      
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        sessions={sessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
        onNewChat={handleNewChat}
      />

      {/* Hidden File Input */}
      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex-1 flex flex-col relative w-full h-full max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 pointer-events-none bg-gradient-to-b from-background via-background/80 to-transparent">
          <div className="flex items-center gap-3 pointer-events-auto">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-white transition-all backdrop-blur-md border border-white/5 hover:border-white/20 shadow-lg"
            >
              <IconMenu />
            </button>
          </div>

          <button 
             onClick={handleNewChat}
             className="pointer-events-auto w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-full text-white transition-all backdrop-blur-md border border-white/5 hover:border-white/20 shadow-lg group"
          >
             <div className="text-gray-200 group-hover:text-purple-400 transition-colors">
               <IconMessagePlus />
             </div>
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto w-full px-4 pt-20 pb-4 scroll-smooth">
          {(!currentSessionId || messages.length === 0) ? (
            <WelcomeScreen />
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.sender === Sender.BOT && msg.text === '' ? (
                     <ThinkingIndicator isSearching={isSearchingMode} />
                  ) : (
                     <ChatBubble message={msg} />
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} className="h-2" />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex-none w-full p-4 md:p-6 bg-background z-30">
          <div className="max-w-3xl mx-auto relative group">
            
            {/* Attachment Preview Area */}
            {attachments.length > 0 && (
              <div className="absolute bottom-full left-0 mb-3 flex gap-2 overflow-x-auto max-w-full pb-2 px-1">
                {attachments.map(att => (
                   <div key={att.id} className="relative group/att bg-[#1a1a1a] border border-white/10 rounded-xl p-2 flex items-center gap-2 shrink-0 animate-in fade-in slide-in-from-bottom-2">
                     {att.type === 'image' ? (
                       <img src={att.data} alt="preview" className="w-10 h-10 object-cover rounded-lg" />
                     ) : (
                       <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-gray-400">
                         <IconFile />
                       </div>
                     )}
                     <div className="max-w-[100px]">
                        <p className="text-xs text-white truncate">{att.name}</p>
                        <p className="text-[10px] text-gray-500 uppercase">{att.type}</p>
                     </div>
                     <button 
                       onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                       className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md"
                     >
                       <IconXCircle />
                     </button>
                   </div>
                ))}
              </div>
            )}

            {/* Glow Effect */}
            <div className={`absolute -inset-[3px] rounded-3xl opacity-60 blur-lg transition duration-1000 animate-gradient-x ${
              isSearchingMode 
                ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400' 
                : 'bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 group-hover:opacity-100'
            }`}></div>
            
            {/* Main Input Container */}
            <div className="relative bg-[#0F0F0F] rounded-3xl border border-white/10 shadow-2xl flex flex-col p-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isSearchingMode ? "Searching web..." : "Ask Velicia"}
                rows={1}
                className="w-full bg-transparent text-white text-lg px-4 py-3 focus:outline-none resize-none placeholder-gray-500"
                style={{ minHeight: '56px' }}
              />

              <div className="flex items-center justify-between px-2 pt-2 pb-1">
                <button 
                  onClick={() => setIsModelMenuOpen(true)}
                  className="flex items-center gap-2 text-xs md:text-sm text-gray-400 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/5 transition-colors"
                >
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-blue-400 font-medium">
                    {MODELS.find(m => m.id === selectedModel)?.name || selectedModel}
                  </span>
                  <IconChevronDown />
                </button>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setIsAttachmentMenuOpen(true)}
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors relative" 
                    title="Attach"
                  >
                    <IconPaperclip />
                    {attachments.length > 0 && (
                      <span className="absolute top-2 right-2 w-2 h-2 bg-purple-500 rounded-full"></span>
                    )}
                  </button>
                  <button 
                    onClick={handleSendMessage}
                    disabled={(!input.trim() && attachments.length === 0) || isGenerating}
                    className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                      (input.trim() || attachments.length > 0) 
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
          
          <div className="text-center mt-3">
             <p className="text-[10px] text-gray-600">VeliciaAI can make mistakes. Check important info.</p>
          </div>
        </div>

      </div>

      {/* Model Selection Sheet */}
      {isModelMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModelMenuOpen(false)} />
          <div className="relative w-full max-w-3xl bg-[#121212] border-t border-white/10 rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white tracking-tight">Select Model</h2>
              <button onClick={() => setIsModelMenuOpen(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full"><IconX /></button>
            </div>
            <div className="space-y-3 pb-4">
              {MODELS.map(model => (
                <button
                  key={model.id}
                  onClick={() => { setSelectedModel(model.id); setIsModelMenuOpen(false); }}
                  className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group ${
                    selectedModel === model.id ? 'bg-white/10 border-purple-500/50' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'
                  }`}
                >
                  <div className="text-left pr-4">
                    <div className={`font-semibold text-base mb-1 ${selectedModel === model.id ? 'text-white' : 'text-gray-300 group-hover:text-white'}`}>{model.name}</div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-400 leading-relaxed">{model.description}</div>
                  </div>
                  {selectedModel === model.id && <div className="flex-none"><IconCheck /></div>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Attachment Selection Sheet */}
      {isAttachmentMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAttachmentMenuOpen(false)} />
          <div className="relative w-full max-w-md bg-[#121212] border-t border-white/10 rounded-t-3xl shadow-2xl p-6 animate-in slide-in-from-bottom duration-300 pb-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Attach</h2>
              <button onClick={() => setIsAttachmentMenuOpen(false)} className="p-2 text-gray-400 hover:text-white"><IconX /></button>
            </div>
            
            <div className="flex justify-around items-center gap-4">
              {/* Camera Option */}
              <button 
                onClick={() => triggerFileUpload('image/*;capture=camera')}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-purple-400 group-hover:bg-white/10 group-hover:scale-105 transition-all">
                  <IconCamera />
                </div>
                <span className="text-xs text-gray-400">Camera</span>
              </button>

              {/* Image Option */}
              <button 
                onClick={() => triggerFileUpload('image/*')}
                className="flex flex-col items-center gap-2 group"
              >
                 <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-pink-400 group-hover:bg-white/10 group-hover:scale-105 transition-all">
                   <IconImage />
                 </div>
                 <span className="text-xs text-gray-400">Gallery</span>
              </button>

              {/* File Option */}
              <button 
                onClick={() => triggerFileUpload('.txt,.csv,.json,.js,.py,.md,.pdf')}
                className="flex flex-col items-center gap-2 group"
              >
                 <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-blue-400 group-hover:bg-white/10 group-hover:scale-105 transition-all">
                   <IconFile />
                 </div>
                 <span className="text-xs text-gray-400">Document</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default App;