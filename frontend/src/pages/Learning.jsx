import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const API = '/api/learning';
const CHAT_API = '/api/chat';

const LEVEL_CONFIG = {
  A: { label: 'Beginner', color: '#f59e0b', icon: '1' },
  B: { label: 'Intermediate', color: '#3b82f6', icon: '2' },
  C: { label: 'Advanced', color: '#10b981', icon: '3' },
};

const PHASE_LABELS = { A: 'Phase A', B: 'Phase B', C: 'Phase C', COMPLETE: 'Completed' };

const CATEGORY_ORDER = ['Linear', 'Fundamental', 'Hierarchical', 'Graph', 'Algorithmic', 'Advanced'];
const CATEGORY_ICONS = {
  Linear: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Fundamental: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Hierarchical: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
    </svg>
  ),
  Graph: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  ),
  Algorithmic: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  Advanced: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  ),
};

const DIFFICULTY_LABELS = {
  A: { known: 'Easy', unknown: 'Easy' },
  B: { known: 'Medium–Hard', unknown: 'Easy–Medium' },
  C: { known: 'Mastered', unknown: 'Medium–Hard' },
};

function StatusPill({ status }) {
  const styles = {
    not_started: { bg: 'bg-gray-700/50', text: 'text-gray-400', label: 'Not Started' },
    in_progress: { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'In Progress' },
    completed: { bg: 'bg-emerald-500/15', text: 'text-emerald-400', label: 'Completed' },
  };
  const s = styles[status] || styles.not_started;
  return <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${s.bg} ${s.text}`}>{s.label}</span>;
}

function ProgressRing({ current, total, size = 36 }) {
  const pct = total > 0 ? (current / total) * 100 : 0;
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1e293b" strokeWidth="3" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#6366f1" strokeWidth="3"
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
          className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-gray-300">{current}/{total}</span>
      </div>
    </div>
  );
}

function TopicCard({ topic, levelKey, onClick, isActive }) {
  const isSkipped = topic.skip;
  const diffLabel = isSkipped ? 'Mastered' : DIFFICULTY_LABELS[levelKey]?.[topic.self_reported] || 'Easy';
  const hasProgress = topic.problems_suggested > 0 || topic.materials_viewed;

  if (isSkipped) {
    return (
      <div className="bg-gray-800/20 border border-gray-800/40 rounded-xl p-4 opacity-60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-500">{topic.name}</span>
          <span className="text-xs text-emerald-500/60 bg-emerald-500/10 px-2 py-0.5 rounded-full">Mastered</span>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl p-4 transition-all duration-200 border ${
        isActive
          ? 'bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/5'
          : 'bg-gray-800/40 border-gray-700/50 hover:bg-gray-800/60 hover:border-gray-600/50'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-200 text-sm">{topic.name}</span>
        <StatusPill status={topic.learning_status} />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded ${
            topic.self_reported === 'known'
              ? 'bg-emerald-900/30 text-emerald-400/80'
              : 'bg-amber-900/30 text-amber-400/80'
          }`}>{topic.self_reported === 'known' ? 'Known' : 'New'}</span>
          <span className="text-xs text-gray-500">{diffLabel} problems</span>
        </div>
        {hasProgress && (
          <ProgressRing current={topic.problems_completed} total={topic.problems_suggested} />
        )}
      </div>
    </button>
  );
}

function DoubtChat({ topicName, level, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [conversationId] = useState(() => `doubt-${Date.now()}`);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming) return;
    setInput('');

    const context = topicName
      ? `[Student is learning "${topicName}" at Level ${level} (${LEVEL_CONFIG[level]?.label}). Answer their DSA doubt concisely.]\n\n${text}`
      : text;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setStreaming(true);

    let assistantContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          message: context,
          mode: 'doubt',
          stream: true,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data.trim() === '[DONE]') break;
          try {
            const event = JSON.parse(data);
            if ((event.type === 'token' || event.type === 'content') && event.content) {
              assistantContent += event.content;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                return updated;
              });
            }
          } catch { /* skip */ }
        }
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, failed to get a response. Please try again.' };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-20 right-6 w-96 h-[500px] bg-[#0d1117] border border-gray-700 rounded-2xl shadow-2xl shadow-black/50 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between bg-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-200">AI Doubt Assistant</span>
            {topicName && <span className="text-xs text-gray-500 block">{topicName}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-700 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <svg className="w-10 h-10 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
            <p className="text-gray-500 text-xs">Ask any DSA doubt. I'll help!</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-xs max-w-none prose-p:my-1 prose-pre:my-1 prose-headings:text-sm prose-headings:my-1">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        return !inline && match ? (
                          <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
                            customStyle={{ borderRadius: '0.375rem', fontSize: '0.75rem', margin: '0.25rem 0' }} {...props}>
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={`${className} text-xs bg-gray-700 px-1 rounded`} {...props}>{children}</code>
                        );
                      },
                    }}
                  >
                    {msg.content || '...'}
                  </ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Ask your doubt..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
            disabled={streaming}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function ProblemRow({ problem, onComplete }) {
  const [confirming, setConfirming] = useState(false);
  const diffColors = { Easy: 'text-emerald-400', Medium: 'text-amber-400', Hard: 'text-red-400' };

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-800/40 last:border-0 group">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${problem.completed ? 'bg-emerald-400' : 'bg-gray-600'}`} />
      <div className="flex-1 min-w-0">
        <a href={problem.url} target="_blank" rel="noopener noreferrer"
          className="text-sm text-gray-200 hover:text-indigo-400 transition-colors font-medium">
          {problem.name}
        </a>
        <div className="flex items-center gap-3 mt-0.5">
          <span className={`text-xs ${diffColors[problem.difficulty] || 'text-gray-400'}`}>{problem.difficulty}</span>
          {problem.acceptance_rate != null && (
            <span className="text-xs text-gray-500">{problem.acceptance_rate.toFixed(1)}% acceptance</span>
          )}
        </div>
      </div>
      {problem.completed ? (
        <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full font-medium">Done</span>
      ) : confirming ? (
        <div className="flex items-center gap-1.5">
          <button onClick={() => { onComplete(problem.problem_id); setConfirming(false); }}
            className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-full text-white transition-colors">Yes</button>
          <button onClick={() => setConfirming(false)}
            className="text-xs px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-full text-gray-300 transition-colors">No</button>
        </div>
      ) : (
        <button onClick={() => setConfirming(true)}
          className="text-xs px-2.5 py-1 bg-gray-700/50 hover:bg-gray-700 rounded-full text-gray-400 hover:text-gray-200 opacity-0 group-hover:opacity-100 transition-all">
          Mark Done
        </button>
      )}
    </div>
  );
}

export default function Learning() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [topics, setTopics] = useState([]);
  const [level, setLevel] = useState('A');
  const [currentPhase, setCurrentPhase] = useState('A');
  const [phasesCompleted, setPhasesCompleted] = useState([]);
  const [learningComplete, setLearningComplete] = useState(false);
  const [progressSummary, setProgressSummary] = useState(null);
  const [error, setError] = useState('');

  const [selectedTopic, setSelectedTopic] = useState(null);
  const [activeTab, setActiveTab] = useState('learn');
  const [material, setMaterial] = useState('');
  const [materialLoading, setMaterialLoading] = useState(false);
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [problemsExhausted, setProblemsExhausted] = useState(false);
  const [materialCollapsed, setMaterialCollapsed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  useEffect(() => {
    if (!token) return;
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const res = await fetch(`${API}/topics`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTopics(data.topics);
      setLevel(data.level);
      setCurrentPhase(data.current_phase || data.level);
      setPhasesCompleted(data.phases_completed || []);
      setLearningComplete(data.learning_complete || false);
      setProgressSummary(data.progress_summary || null);
    } catch {
      setError('Failed to load learning data');
    } finally {
      setLoading(false);
    }
  };

  const handleTopicSelect = async (topic) => {
    setSelectedTopic(topic);
    setMaterial('');
    setProblems([]);
    setProblemsExhausted(false);
    setMaterialCollapsed(false);
    setActiveTab('learn');
    try {
      const res = await fetch(`${API}/suggestions/${topic.topic_id}`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setProblems(data.problems || []);
        if (data.saved_material) setMaterial(data.saved_material);
      }
    } catch { /* silent */ }
  };

  const refreshTopics = async () => {
    try {
      const res = await fetch(`${API}/topics`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics);
        setLearningComplete(data.learning_complete || false);
        setCurrentPhase(data.current_phase || data.level);
        setPhasesCompleted(data.phases_completed || []);
        setProgressSummary(data.progress_summary || null);
        if (selectedTopic) {
          const updated = data.topics.find(t => t.topic_id === selectedTopic.topic_id);
          if (updated) setSelectedTopic(updated);
        }
      }
    } catch { /* silent */ }
  };

  const loadMaterial = async () => {
    if (!selectedTopic) return;
    setMaterialLoading(true);
    setMaterial('');
    try {
      const res = await fetch(`${API}/material/${selectedTopic.topic_id}`, { headers: headers() });
      const data = await res.json();
      setMaterial(data.content);
      refreshTopics();
    } catch {
      setMaterial('Failed to load material. Please try again.');
    } finally {
      setMaterialLoading(false);
    }
  };

  const loadProblems = async () => {
    if (!selectedTopic) return;
    setProblemsLoading(true);
    try {
      const res = await fetch(`${API}/suggest`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ topic_id: selectedTopic.topic_id }),
      });
      const data = await res.json();
      setProblems(data.problems || []);
      if (data.exhausted) setProblemsExhausted(true);
      refreshTopics();
    } catch { /* silent */ }
    finally {
      setProblemsLoading(false);
    }
  };

  const handleComplete = async (problemId) => {
    try {
      await fetch(`${API}/complete`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ problem_id: problemId }),
      });
      setProblems(prev => prev.map(p =>
        p.problem_id === problemId ? { ...p, completed: true } : p
      ));
      refreshTopics();
    } catch { /* silent */ }
  };

  const grouped = CATEGORY_ORDER.map(cat => ({
    category: cat,
    icon: CATEGORY_ICONS[cat],
    topics: topics.filter(t => t.category === cat),
  })).filter(g => g.topics.length > 0);

  const totalTopics = topics.filter(t => !t.skip).length;
  const startedTopics = topics.filter(t => t.learning_status === 'in_progress' && !t.skip).length;
  const completedTopics = topics.filter(t => t.learning_status === 'completed').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading your learning path...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button onClick={() => navigate('/topics')} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const config = LEVEL_CONFIG[level];

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      {/* Top Bar */}
      <div className="border-b border-gray-800/60 bg-[#0d1117]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold">Learning Path</h1>
              <p className="text-xs text-gray-500">Personalized DSA curriculum</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium px-3 py-1.5 rounded-full border"
              style={{ color: config.color, borderColor: config.color + '44', backgroundColor: config.color + '15' }}>
              Level {level} — {config.label}
            </span>
            {phasesCompleted.length > 0 && (
              <span className="text-xs text-gray-500 px-2 py-1 rounded bg-gray-800/50">
                {PHASE_LABELS[currentPhase] || currentPhase}
              </span>
            )}
            <button onClick={() => navigate('/results')}
              className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              View Results
            </button>
            <button onClick={() => navigate('/topics')}
              className="text-xs text-gray-400 hover:text-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Progress Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-4">
            <div className="text-2xl font-bold text-white">{totalTopics}</div>
            <div className="text-xs text-gray-500 mt-1">Total Topics</div>
          </div>
          <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-4">
            <div className="text-2xl font-bold text-blue-400">{startedTopics}</div>
            <div className="text-xs text-gray-500 mt-1">In Progress</div>
          </div>
          <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-4">
            <div className="text-2xl font-bold text-emerald-400">{completedTopics}</div>
            <div className="text-xs text-gray-500 mt-1">Completed</div>
          </div>
          <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-4">
            <div className="text-2xl font-bold text-purple-400">
              {progressSummary ? progressSummary.problems_completed : 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">Problems Solved</div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">Overall Progress</span>
            <span className="text-sm text-gray-400">{totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${totalTopics > 0 ? (completedTopics / totalTopics) * 100 : 0}%` }} />
          </div>
        </div>

        {/* Final Assessment Banner */}
        {learningComplete && currentPhase !== 'COMPLETE' && (
          <div className="mb-8 bg-gradient-to-r from-orange-500/10 to-rose-500/10 border border-orange-500/30 rounded-xl p-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <h3 className="text-white font-semibold">All Topics Completed!</h3>
                <p className="text-gray-400 text-sm">You've finished all learning topics. Take the final assessment to advance to the next level.</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/final-assessment')}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-600 text-white font-medium hover:shadow-lg hover:shadow-orange-500/25 transition-all whitespace-nowrap cursor-pointer"
            >
              Take Final Assessment
            </button>
          </div>
        )}

        {/* Completed All Phases Banner */}
        {currentPhase === 'COMPLETE' && (
          <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-5 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center mx-auto mb-3 shadow-lg shadow-purple-500/20">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-1">All Phases Completed!</h3>
            <p className="text-gray-400 text-sm">Congratulations! You've mastered all DSA topics. Certificate generation coming soon.</p>
          </div>
        )}

        {/* Main Layout: Topics + Detail Panel */}
        <div className="flex gap-6">
          {/* Left: Topic Browser */}
          <div className={`${selectedTopic ? 'hidden lg:block lg:w-[380px]' : 'w-full'} flex-shrink-0`}>
            <div className="space-y-6">
              {grouped.map(group => (
                <div key={group.category}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-gray-500">{group.icon}</span>
                    <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{group.category}</h3>
                    <span className="text-xs text-gray-600 ml-1">{group.topics.length}</span>
                  </div>
                  <div className="space-y-2">
                    {group.topics.map(topic => (
                      <TopicCard
                        key={topic.topic_id}
                        topic={topic}
                        levelKey={level}
                        onClick={() => handleTopicSelect(topic)}
                        isActive={selectedTopic?.topic_id === topic.topic_id}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Detail Panel */}
          {selectedTopic && (
            <div className="flex-1 min-w-0">
              {/* Detail Header */}
              <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-5 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">{selectedTopic.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${
                      selectedTopic.self_reported === 'known'
                        ? 'bg-emerald-900/30 text-emerald-400'
                        : 'bg-amber-900/30 text-amber-400'
                    }`}>{selectedTopic.self_reported === 'known' ? 'Previously Known' : 'New Topic'}</span>
                    <StatusPill status={selectedTopic.learning_status} />
                    <button onClick={() => setSelectedTopic(null)} className="ml-1 text-gray-400 hover:text-white p-1 rounded-md hover:bg-gray-700/50 transition-colors" title="Close topic">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  {selectedTopic.self_reported === 'known'
                    ? `Review and strengthen your ${selectedTopic.name} skills with ${DIFFICULTY_LABELS[level]?.known || 'Easy'} level problems.`
                    : `Learn ${selectedTopic.name} from scratch with guided materials and ${DIFFICULTY_LABELS[level]?.unknown || 'Easy'} level practice.`}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-1 mb-4 bg-gray-800/30 rounded-lg p-1 border border-gray-800/60">
                <button
                  onClick={() => setActiveTab('learn')}
                  className={`flex-1 text-sm font-medium py-2.5 rounded-md transition-all ${
                    activeTab === 'learn'
                      ? 'bg-indigo-500/20 text-indigo-400 shadow-sm'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    Learn
                  </span>
                </button>
                <button
                  onClick={() => { if (selectedTopic?.materials_viewed || material) setActiveTab('practice'); }}
                  className={`flex-1 text-sm font-medium py-2.5 rounded-md transition-all ${
                    !(selectedTopic?.materials_viewed || material)
                      ? 'text-gray-600 cursor-not-allowed'
                      : activeTab === 'practice'
                        ? 'bg-purple-500/20 text-purple-400 shadow-sm'
                        : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    {!(selectedTopic?.materials_viewed || material) ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    )}
                    Practice
                  </span>
                  {!(selectedTopic?.materials_viewed || material) && (
                    <span className="text-[10px] text-gray-600 block mt-0.5">Learn first</span>
                  )}
                </button>
              </div>

              {/* Learn Tab */}
              {activeTab === 'learn' && (
                <div>
                  {!material && !materialLoading && (
                    <div className="bg-gray-800/30 border border-gray-800/60 border-dashed rounded-xl p-10 text-center">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                      <p className="text-gray-400 mb-4 text-sm">
                        Get AI-generated learning material tailored to your level
                      </p>
                      <button onClick={loadMaterial}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
                        Generate Learning Material
                      </button>
                    </div>
                  )}
                  {materialLoading && (
                    <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-10 text-center">
                      <svg className="animate-spin w-8 h-8 text-indigo-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-gray-400 text-sm">Generating personalized content...</p>
                    </div>
                  )}
                  {material && materialCollapsed && (
                    <div
                      onClick={() => setMaterialCollapsed(false)}
                      className="bg-gray-800/30 border border-gray-800/60 rounded-xl px-5 py-3 flex items-center justify-between cursor-pointer hover:bg-gray-800/50 transition-colors"
                    >
                      <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                        Learning Material
                        <span className="text-xs text-gray-500">— Click to expand</span>
                      </span>
                      <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  )}
                  {material && !materialCollapsed && (
                    <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-800/60 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">Learning Material</span>
                        <div className="flex items-center gap-3">
                          <button onClick={loadMaterial} className="text-xs text-indigo-400 hover:text-indigo-300">
                            Regenerate
                          </button>
                          <button onClick={() => setMaterialCollapsed(true)} className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            Minimize
                          </button>
                        </div>
                      </div>
                      <div className="p-5 prose prose-invert prose-sm max-w-none
                        prose-headings:text-gray-200 prose-p:text-gray-300
                        prose-strong:text-gray-200 prose-li:text-gray-300
                        prose-code:text-indigo-300 prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div"
                                  customStyle={{ borderRadius: '0.5rem', margin: '1rem 0' }} {...props}>
                                  {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                              ) : (
                                <code className={className} {...props}>{children}</code>
                              );
                            },
                          }}
                        >
                          {material}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Practice Tab */}
              {activeTab === 'practice' && (
                <div>
                  {problems.length === 0 && !problemsLoading && (
                    <div className="bg-gray-800/30 border border-gray-800/60 border-dashed rounded-xl p-10 text-center">
                      <svg className="w-12 h-12 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                      <p className="text-gray-400 mb-4 text-sm">
                        Get curated LeetCode problems matched to your skill level
                      </p>
                      <button onClick={loadProblems}
                        className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors">
                        Get Practice Problems
                      </button>
                    </div>
                  )}
                  {problemsLoading && (
                    <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl p-10 text-center">
                      <svg className="animate-spin w-8 h-8 text-purple-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <p className="text-gray-400 text-sm">Finding problems for you...</p>
                    </div>
                  )}
                  {problems.length > 0 && !problemsLoading && (
                    <div className="bg-gray-800/30 border border-gray-800/60 rounded-xl overflow-hidden">
                      <div className="px-5 py-3 border-b border-gray-800/60 flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-300">
                          Practice Problems
                          <span className="ml-2 text-xs text-gray-500">
                            {problems.filter(p => p.completed).length} of {problems.length} completed
                          </span>
                        </span>
                        {!problemsExhausted && (
                          <button onClick={loadProblems} disabled={problemsLoading}
                            className="text-xs text-purple-400 hover:text-purple-300 disabled:opacity-50">
                            + Get More
                          </button>
                        )}
                      </div>
                      {/* Progress bar for this topic */}
                      <div className="px-5 pt-3">
                        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${problems.length > 0 ? (problems.filter(p => p.completed).length / problems.length) * 100 : 0}%` }} />
                        </div>
                      </div>
                      <div className="px-5">
                        {problems.map(p => (
                          <ProblemRow key={p.problem_id} problem={p} onComplete={handleComplete} />
                        ))}
                      </div>
                      <div className="px-5 py-3 border-t border-gray-800/60 flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Solve on LeetCode, then mark as done to track progress.
                        </p>
                        {problemsExhausted && (
                          <span className="text-xs text-amber-400/80 bg-amber-400/10 px-2.5 py-1 rounded-full">
                            No more problems available
                          </span>
                        )}
                      </div>
                      {problems.length > 0 && problems.every(p => p.completed) && selectedTopic.materials_viewed && (
                        <div className="px-5 py-3 bg-emerald-500/10 border-t border-emerald-500/20 text-center">
                          <span className="text-sm text-emerald-400 font-medium">
                            Topic completed! All problems solved and materials reviewed.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty State (desktop, no topic selected) */}
          {!selectedTopic && (
            <div className="hidden lg:flex flex-1 items-center justify-center">
              <div className="text-center py-20">
                <svg className="w-16 h-16 text-gray-700 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-gray-500 text-sm">Select a topic to start learning</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Doubt Chat */}
      <DoubtChat
        topicName={selectedTopic?.name}
        level={level}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      {/* Floating Chat Button */}
      <button
        onClick={() => setChatOpen(prev => !prev)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg shadow-indigo-500/25 flex items-center justify-center transition-all z-50 ${
          chatOpen
            ? 'bg-gray-700 hover:bg-gray-600'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500'
        }`}
      >
        {chatOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        )}
      </button>
    </div>
  );
}
