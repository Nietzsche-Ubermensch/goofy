import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { ChatMessage, AIProvider, AIModelConfig } from '../types';
import { generateBotResponse, streamBotResponse } from '../services/aiService';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: 'Hello, I am Lumina. I can help you evaluate card conditions, suggest grading strategies, or explain restoration techniques. How can I assist you today?',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    provider: AIProvider.OpenRouter,
    modelId: 'anthropic/claude-3.5-sonnet'
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const botMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: botMsgId,
        role: 'model',
        text: '',
        timestamp: new Date()
      }]);
      setIsTyping(false); // Stop typing indicator since we're streaming

      let fullText = '';
      await streamBotResponse(history, userMsg.text, (chunk) => {
         fullText += chunk;
         setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, text: fullText } : m
         ));
      }, aiConfig);

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${error instanceof Error ? error.message : "I encountered a connection error. Please verify your API key configuration."}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent relative overflow-hidden holo-text">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[rgba(255,0,229,0.1)] rounded-full blur-[100px] pointer-events-none mix-blend-screen"></div>
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[rgba(0,243,255,0.1)] rounded-full blur-[80px] pointer-events-none mix-blend-screen"></div>

      {/* Header */}
      <div className="p-6 border-b border-[rgba(0,243,255,0.2)] bg-black/40 backdrop-blur-md sticky top-0 z-10 flex items-center justify-between holo-border">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-[rgba(0,243,255,0.1)] border border-[#00f3ff] flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.4)]">
             <Sparkles size={20} className="text-[#00f3ff]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#00f3ff] text-lg tracking-tight font-mono holo-text">Lumina Assistant</h2>
            <div className="flex items-center gap-2">
                <select 
                    value={aiConfig.provider}
                    onChange={(e) => {
                        const provider = e.target.value as AIProvider;
                        let modelId = 'anthropic/claude-3.5-sonnet';
                        if (provider === AIProvider.OpenRouter) modelId = 'anthropic/claude-3.5-sonnet';
                        if (provider === AIProvider.Venice) modelId = 'llama-3.3-70b';
                        if (provider === AIProvider.OpenAI) modelId = 'gpt-4o';
                        if (provider === AIProvider.xAI) modelId = 'grok-beta';
                        setAiConfig({ provider, modelId });
                    }}
                    className="bg-transparent text-[10px] text-[rgba(0,243,255,0.7)] font-medium uppercase border-none focus:ring-0 p-0 cursor-pointer hover:text-[#00f3ff] transition-colors font-mono"
                >
                    <option value={AIProvider.OpenRouter}>OpenRouter</option>
                    <option value={AIProvider.Venice}>Venice</option>
                    <option value={AIProvider.OpenAI}>OpenAI</option>
                    <option value={AIProvider.xAI}>xAI</option>
                </select>
                <span className="text-[rgba(0,243,255,0.4)]">•</span>
                <select 
                    value={aiConfig.modelId}
                    onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                    className="bg-transparent text-[10px] text-[rgba(0,243,255,0.7)] font-medium uppercase border-none focus:ring-0 p-0 cursor-pointer hover:text-[#00f3ff] transition-colors font-mono"
                >
                    {aiConfig.provider === AIProvider.OpenRouter && (
                        <>
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                            <option value="meta-llama/llama-3.3-70b-instruct:free">Llama 3.3 70B</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.OpenAI && (
                        <>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.xAI && (
                        <>
                            <option value="grok-beta">Grok</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.Venice && (
                        <>
                            <option value="llama-3.3-70b">Llama 3.3 70B</option>
                            <option value="deepseek-v3">DeepSeek V3</option>
                        </>
                    )}
                </select>
            </div>
          </div>
        </div>
        <div className="px-3 py-1 rounded-sm bg-[rgba(0,243,255,0.1)] border border-[rgba(0,243,255,0.5)] text-[#00f3ff] text-xs font-mono flex items-center gap-2 shadow-[0_0_10px_rgba(0,243,255,0.3)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff] animate-pulse shadow-[0_0_5px_#00f3ff]"></span>
            OP.READY
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id} 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                  <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,243,255,0.2)] ${
                     msg.role === 'user' ? 'bg-black/60 border-[rgba(0,243,255,0.3)]' : 'bg-[rgba(0,243,255,0.1)] border-[#00f3ff]'
                 }`}>
                    {msg.role === 'user' ? <User size={14} className="text-[#00f3ff] opacity-80"/> : <Bot size={14} className="text-[#00f3ff]"/>}
                 </div>
                 
                 <div className={`flex flex-col max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                     <div className={`px-5 py-3.5 rounded-sm text-sm leading-relaxed shadow-sm holo-border ${
                        msg.role === 'user' 
                          ? 'bg-[rgba(0,243,255,0.05)] text-[rgba(0,243,255,0.9)]' 
                          : 'bg-black/60 text-[#00f3ff]'
                     }`}>
                        <div className="[&_p]:mb-2 last:[&_p]:mb-0 [&_a]:text-[rgba(255,0,229,1)] [&_a]:underline [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:mb-1 [&_strong]:font-bold [&_strong]:text-[#00f3ff] [&_pre]:bg-black/80 [&_pre]:p-2 [&_pre]:border [&_pre]:border-[rgba(0,243,255,0.3)] [&_pre]:rounded-sm [&_code]:font-mono [&_code]:text-xs [&_code]:text-[rgba(0,243,255,0.8)] font-mono">
                           <Markdown>{msg.text}</Markdown>
                        </div>
                     </div>
                     <span className="text-[10px] text-[rgba(0,243,255,0.5)] mt-1.5 px-1 font-mono">
                        {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </span>
                 </div>
              </motion.div>
            ))}
        </AnimatePresence>
        
        {isTyping && (
           <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-4"
           >
              <div className="w-8 h-8 rounded border border-[#00f3ff] bg-[rgba(0,243,255,0.1)] flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                  <Bot size={14} className="text-[#00f3ff]"/>
              </div>
              <div className="px-5 py-4 bg-black/60 holo-border rounded-sm flex items-center gap-1.5">
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0 }} className="w-1.5 h-1.5 bg-[#00f3ff] rounded-full shadow-[0_0_5px_#00f3ff]"></motion.span>
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-[#00f3ff] rounded-full shadow-[0_0_5px_#00f3ff]"></motion.span>
                  <motion.span animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-[#00f3ff] rounded-full shadow-[0_0_5px_#00f3ff]"></motion.span>
              </div>
           </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-6 bg-black/40 backdrop-blur-md border-t border-[rgba(0,243,255,0.2)]">
        <div className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="[ AWAITING INPUT... ]"
            className="w-full bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm py-4 pl-5 pr-14 text-sm text-[#00f3ff] placeholder-[rgba(0,243,255,0.4)] focus:outline-none focus:border-[#00f3ff] focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all font-mono"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="absolute right-2 top-2 p-2 holo-button rounded-sm transition-all"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-center mt-3">
             <p className="text-[10px] text-[rgba(0,243,255,0.5)] font-mono uppercase tracking-widest">Sys_Note: Output may vary. Always verify operations in meatspace.</p>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;