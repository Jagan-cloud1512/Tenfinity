import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/api';

const API = `${API_BASE}/learning`;

const LEVEL_CONFIG = {
  A: { label: 'Beginner', color: '#f59e0b', bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
  B: { label: 'Intermediate', color: '#3b82f6', bg: 'from-blue-500/20 to-indigo-500/20', border: 'border-blue-500/30' },
  C: { label: 'Advanced', color: '#10b981', bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30' },
};

function ScoreRing({ value, label, color, size = 100 }) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xl font-bold text-white">{value}%</span>
        </div>
      </div>
      <span className="text-sm text-gray-400 font-medium">{label}</span>
    </div>
  );
}

function StrengthRow({ topic, index }) {
  const barColor = topic.score_percent >= 70 ? '#10b981' : topic.score_percent >= 40 ? '#f59e0b' : '#ef4444';
  const label = topic.score_percent >= 70 ? 'Strong' : topic.score_percent >= 40 ? 'Moderate' : 'Weak';

  return (
    <div className="flex items-center gap-4 py-3 border-b border-gray-800/50 last:border-0">
      <span className="w-6 text-sm text-gray-500 font-mono">{index + 1}</span>
      <span className="w-40 text-sm text-gray-200 font-medium truncate">{topic.topic_name}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${Math.max(topic.score_percent, 3)}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-16 text-right text-sm font-mono text-gray-300">
        {topic.total > 0 ? `${topic.correct}/${topic.total}` : '—'}
      </span>
      <span className="w-14 text-right text-sm font-mono" style={{ color: barColor }}>{topic.score_percent}%</span>
      <span className="w-20 text-right text-xs font-medium px-2 py-0.5 rounded-full" style={{
        backgroundColor: barColor + '18', color: barColor,
      }}>{label}</span>
    </div>
  );
}

export default function Results() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const token = session?.access_token;

  const [loading, setLoading] = useState(true);
  const [classification, setClassification] = useState(null);
  const [strengths, setStrengths] = useState([]);
  const [error, setError] = useState('');

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
      const [classRes, strengthsRes] = await Promise.all([
        fetch(`${API}/classify`, { headers: headers() }),
        fetch(`${API}/strengths`, { headers: headers() }),
      ]);
      if (!classRes.ok || !strengthsRes.ok) throw new Error('Failed to load');
      setClassification(await classRes.json());
      const sData = await strengthsRes.json();
      setStrengths(sData.topics || []);
    } catch {
      setError('Failed to load assessment results. Please complete an assessment first.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Analyzing your performance...
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

  const level = classification?.level || 'A';
  const config = LEVEL_CONFIG[level];

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">Assessment Results</h1>
            <p className="text-gray-400 text-sm mt-1">Your skill evaluation summary</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/learning')}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors">
              Start Learning
            </button>
            <button onClick={() => navigate('/topics')}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors">
              Back
            </button>
          </div>
        </div>

        {/* Level Card */}
        <div className={`relative overflow-hidden bg-gradient-to-r ${config.bg} border ${config.border} rounded-2xl p-6 mb-8`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-400 mb-1">Your Skill Level</div>
              <div className="text-4xl font-bold mb-2" style={{ color: config.color }}>
                Level {level}
              </div>
              <div className="text-lg text-gray-300">{config.label}</div>
              <p className="text-sm text-gray-400 mt-3 max-w-md">{classification?.feedback}</p>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <div className="relative">
                <ScoreRing value={classification?.mcq_score_percent || 0} label="MCQ" color="#8b5cf6" />
              </div>
              <div className="relative">
                <ScoreRing value={classification?.coding_score_percent || 0} label="Coding" color="#06b6d4" />
              </div>
              <div className="relative">
                <ScoreRing value={classification?.overall_score_percent || 0} label="Overall" color={config.color} size={120} />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Score Cards */}
        <div className="grid grid-cols-3 gap-3 mb-8 md:hidden">
          {[
            { label: 'MCQ', value: classification?.mcq_score_percent || 0, color: '#8b5cf6' },
            { label: 'Coding', value: classification?.coding_score_percent || 0, color: '#06b6d4' },
            { label: 'Overall', value: classification?.overall_score_percent || 0, color: config.color },
          ].map(s => (
            <div key={s.label} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 text-center">
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}%</div>
              <div className="text-xs text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Topic Performance */}
        {strengths.length > 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Topic Performance</h2>
              <span className="text-xs text-gray-500">{strengths.length} assessed topics</span>
            </div>
            <div className="flex items-center gap-4 py-2 mb-1 text-xs text-gray-500 font-medium">
              <span className="w-6">#</span>
              <span className="w-40">Topic</span>
              <span className="flex-1">Score</span>
              <span className="w-16 text-right">Solved</span>
              <span className="w-14 text-right">%</span>
              <span className="w-20 text-right">Status</span>
            </div>
            <div>
              {[...strengths]
                .sort((a, b) => b.score_percent - a.score_percent)
                .map((topic, i) => (
                  <StrengthRow key={topic.topic_id} topic={topic} index={i} />
                ))}
            </div>
          </div>
        )}

        {strengths.length === 0 && (
          <div className="bg-gray-900/50 border border-gray-800 rounded-2xl p-8 text-center">
            <p className="text-gray-400">No topic-level data available. Complete the MCQ assessment to see per-topic performance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
