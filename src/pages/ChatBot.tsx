import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, Globe, ExternalLink } from 'lucide-react';
import { ChatMessage, AIProvider, AIModelConfig, GroundingSource } from '../types';
import { streamBotResponse } from '../services/aiService';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';

const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'model',
      text: 'Hello, I am Lumina. I can help you evaluate card conditions, analyze centering, inspect micro-damage, and research real-time sports card market value and grading populations.',
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [enableGrounding, setEnableGrounding] = useState(true);
  const [aiConfig, setAiConfig] = useState<AIModelConfig>({
    provider: AIProvider.Gemini,
    modelId: 'gemini-3.5-flash'
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
      await streamBotResponse(
        history, 
        userMsg.text, 
        (chunk) => {
          fullText += chunk;
          setMessages(prev => prev.map(m => 
            m.id === botMsgId ? { ...m, text: fullText } : m
          ));
        }, 
        aiConfig,
        (sources: GroundingSource[]) => {
          setMessages(prev => prev.map(m =>
            m.id === botMsgId ? { ...m, groundingSources: sources } : m
          ));
        },
        { enableSearchGrounding: enableGrounding }
      );

    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: `Error: ${error instanceof Error ? error.message : "I encountered a connection error. Please verify your API key or server connection in Settings."}`,
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
      <div className="p-4 sm:p-6 border-b border-[rgba(0,243,255,0.2)] bg-black/40 backdrop-blur-md sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 holo-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[rgba(0,243,255,0.1)] border border-[#00f3ff] flex items-center justify-center shadow-[0_0_15px_rgba(0,243,255,0.4)]">
             <Sparkles size={18} className="text-[#00f3ff]" />
          </div>
          <div>
            <h2 className="font-semibold text-[#00f3ff] text-base sm:text-lg tracking-tight font-mono holo-text">Lumina Assistant</h2>
            <div className="flex items-center gap-2 flex-wrap">
                <select 
                    value={aiConfig.provider}
                    onChange={(e) => {
                        const provider = e.target.value as AIProvider;
                        let modelId = 'gemini-3.5-flash';
                        if (provider === AIProvider.OpenRouter) modelId = 'anthropic/claude-3.5-sonnet';
                        if (provider === AIProvider.Venice) modelId = 'llama-3.3-70b';
                        if (provider === AIProvider.OpenAI) modelId = 'gpt-4o';
                        if (provider === AIProvider.xAI) modelId = 'grok-2';
                        setAiConfig({ provider, modelId });
                    }}
                    className="bg-transparent text-[11px] text-[rgba(0,243,255,0.8)] font-medium uppercase border-none focus:ring-0 p-0 cursor-pointer hover:text-[#00f3ff] transition-colors font-mono"
                >
                    <option value={AIProvider.Gemini}>Gemini</option>
                    <option value={AIProvider.OpenRouter}>OpenRouter</option>
                    <option value={AIProvider.Venice}>Venice</option>
                    <option value={AIProvider.OpenAI}>OpenAI</option>
                    <option value={AIProvider.xAI}>xAI</option>
                </select>
                <span className="text-[rgba(0,243,255,0.4)]">•</span>
                <select 
                    value={aiConfig.modelId}
                    onChange={(e) => setAiConfig({ ...aiConfig, modelId: e.target.value })}
                    className="bg-transparent text-[11px] text-[rgba(0,243,255,0.8)] font-medium uppercase border-none focus:ring-0 p-0 cursor-pointer hover:text-[#00f3ff] transition-colors font-mono"
                >
                    {aiConfig.provider === AIProvider.Gemini && (
                        <>
                            <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                            <option value="gemini-3.7-flash">Gemini 3.7 Flash</option>
                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.OpenRouter && (
                        <>
                            <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                            <option value="deepseek/deepseek-r1">DeepSeek R1</option>
                            <option value="meta-llama/llama-3.3-70b-instruct">Llama 3.3 70B</option>
                            <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.OpenAI && (
                        <>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o Mini</option>
                            <option value="o3-mini">o3-mini</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.xAI && (
                        <>
                            <option value="grok-2">Grok 2</option>
                            <option value="grok-2-vision-1212">Grok 2 Vision</option>
                        </>
                    )}
                    {aiConfig.provider === AIProvider.Venice && (
                        <>
                            <option value="llama-3.3-70b">Llama 3.3 70B</option>
                            <option value="deepseek-v3">DeepSeek V3</option>
                            <option value="deepseek-r1">DeepSeek R1</option>
                        </>
                    )}
                </select>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {aiConfig.provider === AIProvider.Gemini && (
            <button
              onClick={() => setEnableGrounding(!enableGrounding)}
              className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex items-center gap-1.5 transition-all ${
                enableGrounding
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,243,255,0.25)]'
                  : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle Google Search Grounding for real-time card facts and market data"
            >
              <Globe size={13} className={enableGrounding ? 'text-cyan-300' : 'text-slate-500'} />
              <span>Search Grounding: {enableGrounding ? 'ON' : 'OFF'}</span>
            </button>
          )}

          <div className="px-2.5 py-1 rounded-sm bg-[rgba(0,243,255,0.1)] border border-[rgba(0,243,255,0.5)] text-[#00f3ff] text-xs font-mono flex items-center gap-2 shadow-[0_0_10px_rgba(0,243,255,0.3)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00f3ff] animate-pulse shadow-[0_0_5px_#00f3ff]"></span>
              ONLINE
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
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

                        {/* Search Grounding Sources */}
                        {msg.groundingSources && msg.groundingSources.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-cyan-500/20 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-cyan-300">
                              <Globe size={12} />
                              <span>Live Grounded Sources:</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {msg.groundingSources.map((source, idx) => (
                                <a
                                  key={idx}
                                  href={source.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-500/40 text-[10px] text-cyan-200 transition-colors"
                                >
                                  <span className="truncate max-w-[180px]">{source.title || source.uri}</span>
                                  <ExternalLink size={10} className="shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
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
      <div className="p-4 sm:p-6 bg-black/40 backdrop-blur-md border-t border-[rgba(0,243,255,0.2)]">
        <div className="max-w-4xl mx-auto relative group">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="[ Ask Lumina about card condition, centering, grading odds, or market data... ]"
            className="w-full bg-black/60 border border-[rgba(0,243,255,0.3)] rounded-sm py-3.5 pl-4 pr-14 text-sm text-[#00f3ff] placeholder-[rgba(0,243,255,0.4)] focus:outline-none focus:border-[#00f3ff] focus:shadow-[0_0_15px_rgba(0,243,255,0.3)] transition-all font-mono"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping}
            className="absolute right-2 top-2 p-2 holo-button rounded-sm transition-all min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40"
            aria-label="Send Message"
          >
            <Send size={16} />
          </button>
        </div>
        <div className="text-center mt-2.5">
             <p className="text-[10px] text-[rgba(0,243,255,0.5)] font-mono uppercase tracking-widest">Real-time Search Grounding & Multimodal Neural Inspection</p>
        </div>
      </div>
    </div>
  );
};

export default ChatBot;
