import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ChatMessage from '../components/ChatMessage';
import ChatInput from '../components/ChatInput';
import LoadingIndicator from '../components/LoadingIndicator';
import ProviderSelector from '../components/ProviderSelector';
import SettingsPanel from '../components/SettingsPanel';
import { useAuth } from '../contexts/AuthContext';
import {
  sendMessageStream,
  getConversations,
  getConversationMessages,
  deleteConversation,
  getHealth,
} from '../services/api';

function WelcomeScreen({ onQuickAction }) {
  const suggestions = [
    { text: 'What is quantum computing?', icon: '🔬', color: 'from-violet-500/20 to-fuchsia-500/20' },
    { text: 'Write a Python sorting program', icon: '💻', color: 'from-blue-500/20 to-cyan-500/20' },
    { text: 'Help me write a professional email', icon: '✉️', color: 'from-amber-500/20 to-orange-500/20' },
    { text: 'Find easy LeetCode problems', icon: '🧩', color: 'from-emerald-500/20 to-teal-500/20' },
    { text: 'Explain binary search', icon: '📚', color: 'from-rose-500/20 to-pink-500/20' },
    { text: 'Plan a weekend trip', icon: '✈️', color: 'from-sky-500/20 to-indigo-500/20' },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-4 md:p-8">
      <div className="text-center max-w-2xl w-full">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-white mb-1.5">AI Agent</h2>
        <p className="text-gray-500 text-sm mb-10 max-w-xs mx-auto leading-relaxed">
          Your general-purpose AI assistant
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onQuickAction(s.text)}
              className={`group px-4 py-3.5 rounded-xl bg-gradient-to-br ${s.color} border border-white/[0.04] text-sm text-gray-400 hover:text-gray-100 hover:border-white/[0.08] transition-all duration-200 text-left backdrop-blur-sm`}
            >
              <span className="block text-lg mb-1.5 group-hover:scale-110 transition-transform duration-200 inline-block">{s.icon}</span>
              <span className="block text-[13px] leading-snug">{s.text}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [mode, setMode] = useState('auto');
  const [streamingMsg, setStreamingMsg] = useState(null);
  const [activeTools, setActiveTools] = useState([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(false);
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMsg, loading]);

  useEffect(() => {
    loadConversations();
    loadHealth();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch { /* silent */ }
  };

  const loadHealth = async () => {
    try {
      const data = await getHealth();
      setHealth(data);
    } catch { /* silent */ }
  };

  const loadMessages = async (convId) => {
    try {
      const data = await getConversationMessages(convId);
      setMessages(
        data.messages.map((m) => ({
          role: m.role,
          content: m.content,
          sources: m.sources,
          tools_used: m.tools_used,
        }))
      );
    } catch {
      setMessages([]);
    }
  };

  const handleSelectConversation = async (convId) => {
    setActiveConvId(convId);
    setError(null);
    setStreamingMsg(null);
    await loadMessages(convId);
  };

  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
    setStreamingMsg(null);
  };

  const handleDeleteConversation = async (convId) => {
    try {
      await deleteConversation(convId);
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
      await loadConversations();
    } catch { /* silent */ }
  };

  const handleSend = async (text) => {
    setError(null);
    abortRef.current = false;
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    setStreamingMsg({ role: 'assistant', content: '', provider: '', model: '', sources: [], tools_used: [] });
    setActiveTools([]);

    let currentContent = '';
    let currentProvider = '';
    let currentModel = '';
    let finalSources = [];
    let finalTools = [];
    let newConvId = activeConvId;

    try {
      await sendMessageStream(activeConvId, text, mode, (event) => {
        if (abortRef.current) return;

        switch (event.type) {
          case 'provider':
            currentProvider = event.provider;
            currentModel = event.model;
            setStreamingMsg((prev) => ({ ...prev, provider: event.provider, model: event.model }));
            break;
          case 'token':
            currentContent += event.content;
            setStreamingMsg((prev) => ({ ...prev, content: currentContent }));
            break;
          case 'tool_start':
            setActiveTools((prev) => [...prev, event.tool]);
            break;
          case 'tool_done':
            setActiveTools((prev) => prev.filter((t) => t !== event.tool));
            break;
          case 'done':
            finalSources = event.sources || [];
            finalTools = event.tools_used || [];
            if (event.conversation_id) newConvId = event.conversation_id;
            if (event.provider) currentProvider = event.provider;
            if (event.model) currentModel = event.model;
            break;
          case 'error':
            setError(event.error);
            break;
        }
      });

      const assistantMsg = {
        role: 'assistant',
        content: currentContent,
        sources: finalSources,
        tools_used: finalTools,
        provider: currentProvider,
        model: currentModel,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingMsg(null);

      if (newConvId && newConvId !== activeConvId) setActiveConvId(newConvId);
      await loadConversations();
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStreamingMsg(null);
    } finally {
      setLoading(false);
      setActiveTools([]);
    }
  };

  const handleRetry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser) {
      setMessages((prev) => prev.slice(0, -1));
      handleSend(lastUser.content);
    }
  };

  return (
    <div className="flex h-full bg-[#0b0f1a] text-gray-100">
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-30 md:hidden animate-fade-in"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-40 md:static">
            <Sidebar
              conversations={conversations}
              activeId={activeConvId}
              onSelect={(id) => {
                handleSelectConversation(id);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              onNew={() => {
                handleNewChat();
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              onDelete={handleDeleteConversation}
              onOpenSettings={() => setSettingsOpen(true)}
              onNavigate={navigate}
              onSignOut={signOut}
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 bg-[#0b0f1a]/95 backdrop-blur-sm">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="text-sm text-gray-400 flex-1 truncate">
            {activeConvId ? conversations.find((c) => c.id === activeConvId)?.title || 'Chat' : 'New Chat'}
          </span>
          <ProviderSelector mode={mode} onModeChange={setMode} health={health} />
        </div>

        {messages.length === 0 && !loading ? (
          <WelcomeScreen onQuickAction={handleSend} />
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-5 md:px-8">
            <div className="max-w-3xl mx-auto space-y-1">
              {messages.map((msg, i) => (
                <ChatMessage key={`${activeConvId}-${i}`} message={msg} />
              ))}
              {streamingMsg && streamingMsg.content && <ChatMessage message={streamingMsg} isStreaming />}
              {loading && !streamingMsg?.content && <LoadingIndicator activeTools={activeTools} />}
              {activeTools.length > 0 && streamingMsg?.content && <LoadingIndicator activeTools={activeTools} />}
              {error && (
                <div className="flex justify-center my-4">
                  <div className="bg-red-950/40 border border-red-900/50 rounded-xl px-5 py-3 text-sm text-red-300 max-w-lg flex items-center gap-3">
                    <svg className="w-4 h-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <span className="flex-1">{error}</span>
                    <button onClick={handleRetry} className="px-3 py-1.5 rounded-lg bg-red-800/40 hover:bg-red-800/70 text-red-200 text-xs font-medium transition-colors">
                      Retry
                    </button>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        <ChatInput onSend={handleSend} disabled={loading} onStop={loading ? () => { abortRef.current = true; setLoading(false); setStreamingMsg(null); } : null} />
      </div>

      {settingsOpen && <SettingsPanel health={health} onClose={() => setSettingsOpen(false)} onRefresh={loadHealth} />}
    </div>
  );
}
