import { useState, useRef, useEffect, FormEvent } from 'react';
import { MessageSquare, X, Send, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { ChatMessage } from '../types.ts';

export default function GeminiChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: 'Hello! I am your DDRMS Intelligent Geohazard Assistant. I can help you with local weather evacuations, UP NOAH landslide warning signs, flood safety tips, and locale-specific risk protocols in Davao de Oro. How can I support you today?',
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threadEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const chatHistory = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ messages: chatHistory })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch AI response');
      }

      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: Math.random().toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Unable to connect to Gemini. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Conversation restarted. Ask me anything about Davao de Oro geohazards, rescue operations, or evacuations!',
        timestamp: new Date().toISOString()
      }
    ]);
    setError(null);
  };

  return (
    <>
      {/* Floating Chat Bubble */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg transition-all duration-200 cursor-pointer"
          title="Ask Geohazard Assistant"
          id="btn-gemini-chat-open"
        >
          <div className="relative">
            <MessageSquare className="w-6 h-6" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-white"></span>
            </span>
          </div>
        </button>
      )}

      {/* Glassmorphic Chat Drawer */}
      {isOpen && (
        <div
          className="fixed bottom-6 right-6 z-50 w-full max-w-md h-[550px] bg-white rounded-xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200"
          id="container-gemini-chat-drawer"
        >
          {/* Header */}
          <div className="bg-slate-900 border-b border-slate-850 p-4 flex items-center justify-between text-white shadow-sm">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-800 rounded-lg border border-slate-750">
                <Sparkles className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide">DDRMS Intelligent AI</h3>
                <p className="text-[10px] text-slate-400 font-medium">Powered by Gemini 3.5 Flash</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition duration-155 text-slate-300 hover:text-white cursor-pointer"
                title="Reset Chat"
                id="btn-gemini-chat-reset"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-slate-800 rounded-lg transition duration-155 text-slate-300 hover:text-white cursor-pointer"
                title="Close Assistant"
                id="btn-gemini-chat-close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${
                  m.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-lg text-xs leading-relaxed shadow-sm ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                  }`}
                >
                  <div className="whitespace-pre-line font-medium">{m.content}</div>
                </div>
                <span className="text-[9px] text-slate-400 mt-1 px-1">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="bg-white border border-slate-200 px-3.5 py-2 rounded-lg rounded-tl-none shadow-sm max-w-[85%]">
                  <div className="flex items-center gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <p className="flex-1">{error}</p>
              </div>
            )}

            <div ref={threadEndRef} />
          </div>

          {/* Input Form */}
          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about weather, landslides, evacuations..."
              className="flex-1 px-3.5 py-2 border border-slate-250 rounded-lg text-xs focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-medium bg-slate-50 focus:bg-white transition text-slate-900"
              id="input-gemini-chat-prompt"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-lg flex items-center justify-center transition shadow-sm cursor-pointer"
              id="btn-gemini-chat-send"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
