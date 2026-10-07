import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_ORDER = ['Linear', 'Fundamental', 'Hierarchical', 'Graph', 'Algorithmic', 'Advanced'];

const CATEGORY_ICONS = {
  Linear: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  ),
  Fundamental: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  Hierarchical: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  ),
  Graph: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  Algorithmic: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  Advanced: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

export default function TopicSelection() {
  const [topics, setTopics] = useState([]);
  const [selections, setSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [topicsRes, selectionsRes] = await Promise.all([
        fetch('/api/topics'),
        fetch('/api/topics/user', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (!topicsRes.ok) throw new Error('Failed to load topics');
      const topicsData = await topicsRes.json();
      setTopics(topicsData);

      if (selectionsRes.ok) {
        const selData = await selectionsRes.json();
        setSelections(selData.selections || {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleTopic = (topicId, status) => {
    setSelections((prev) => {
      const current = prev[topicId];
      if (current === status) {
        const next = { ...prev };
        delete next[topicId];
        return next;
      }
      return { ...prev, [topicId]: status };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    const selectionList = Object.entries(selections).map(([topicId, status]) => ({
      topic_id: Number(topicId),
      status,
    }));

    try {
      const res = await fetch('/api/topics/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ selections: selectionList }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to save selections');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    setSaving(true);
    setError('');

    const selectionList = Object.entries(selections).map(([topicId, status]) => ({
      topic_id: Number(topicId),
      status,
    }));

    try {
      const res = await fetch('/api/topics/select', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ selections: selectionList }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || 'Failed to save selections');
      }
      navigate('/assessment');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalTopics = topics.length;
  const totalSelected = Object.keys(selections).length;
  const knownCount = Object.values(selections).filter((s) => s === 'known').length;
  const unknownCount = Object.values(selections).filter((s) => s === 'unknown').length;
  const allClassified = totalTopics > 0 && totalSelected === totalTopics;

  const grouped = {};
  for (const topic of topics) {
    if (!grouped[topic.category]) grouped[topic.category] = [];
    grouped[topic.category].push(topic);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading topics...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800/60 bg-[#0b0f1a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">DSA Learning Platform</h1>
            <p className="text-xs text-gray-500">{session?.user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white bg-[#151b2e] border border-gray-800/60 hover:border-indigo-500/30 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              AI Chat
            </button>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {/* Title section */}
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            What DSA topics do you know?
          </h2>
          <p className="text-gray-500 text-sm max-w-lg mx-auto">
            Classify each topic honestly. This helps us create a personalized learning path.
            You can always change your answers later.
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-400">
              {totalSelected} of {totalTopics} topics classified
            </span>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                I Know ({knownCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                I Don't Know ({unknownCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-600" />
                Not classified ({totalTopics - totalSelected})
              </span>
            </div>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
              style={{ width: `${totalTopics > 0 ? (totalSelected / totalTopics) * 100 : 0}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Topic groups */}
        <div className="space-y-8">
          {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((category) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-gray-500">{CATEGORY_ICONS[category]}</span>
                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  {category}
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {grouped[category].map((topic) => {
                  const status = selections[topic.id];
                  return (
                    <div
                      key={topic.id}
                      className={`rounded-xl border p-4 transition-all duration-200 ${
                        status === 'known'
                          ? 'bg-emerald-500/10 border-emerald-500/30'
                          : status === 'unknown'
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-[#151b2e] border-gray-800/60 hover:border-gray-700/60'
                      }`}
                    >
                      <div className="mb-3">
                        <h4 className="text-sm font-semibold text-white">{topic.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{topic.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => toggleTopic(topic.id, 'known')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            status === 'known'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gray-800/60 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-300'
                          }`}
                        >
                          I Know
                        </button>
                        <button
                          onClick={() => toggleTopic(topic.id, 'unknown')}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            status === 'unknown'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-800/60 text-gray-400 hover:bg-amber-500/20 hover:text-amber-300'
                          }`}
                        >
                          I Don't Know
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="sticky bottom-0 bg-[#0b0f1a]/95 backdrop-blur-sm border-t border-gray-800/60 mt-8 -mx-4 sm:-mx-6 px-4 sm:px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="text-sm text-gray-500">
              {allClassified
                ? 'All topics classified. Ready to continue!'
                : `${totalTopics - totalSelected} topic${totalTopics - totalSelected !== 1 ? 's' : ''} remaining`}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={saving || totalSelected === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white bg-gray-800/60 hover:bg-gray-700/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                {saving ? 'Saving...' : 'Save progress'}
              </button>
              <button
                onClick={handleContinue}
                disabled={!allClassified || saving}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
              >
                Continue to Assessment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
