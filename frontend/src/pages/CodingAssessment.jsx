import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE } from '../lib/api';

const API = `${API_BASE}/coding`;

const LANGUAGES = [
  { id: 'python', label: 'Python', monacoId: 'python' },
  { id: 'cpp', label: 'C++', monacoId: 'cpp' },
  { id: 'c', label: 'C', monacoId: 'c' },
];

const STARTER_TEMPLATES = {
  python: `# Read input and solve the problem
`,
  cpp: `#include <iostream>
using namespace std;

int main() {
    // Read input and solve the problem

    return 0;
}
`,
  c: `#include <stdio.h>

int main() {
    // Read input and solve the problem

    return 0;
}
`,
};

function Spinner({ text }) {
  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <div className="flex items-center gap-3 text-gray-400">
        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        {text}
      </div>
    </div>
  );
}

function GeneratingProgress({ generated, total }) {
  const pct = total > 0 ? Math.round((generated / total) * 100) : 0;
  return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <div className="max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25">
          <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">Generating Coding Problems</h2>
        <p className="text-gray-400 text-sm mb-4">{generated} of {total} problems generated</p>
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function TestResult({ result, index }) {
  return (
    <div className={`border rounded-lg p-3 text-sm ${result.passed ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-300">Test Case {index + 1}</span>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${result.passed ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {result.passed ? 'Passed' : 'Failed'}
        </span>
      </div>
      <div className="space-y-1 text-xs font-mono">
        <div><span className="text-gray-500">Input: </span><span className="text-gray-300">{result.input}</span></div>
        <div><span className="text-gray-500">Expected: </span><span className="text-green-400">{result.expected_output}</span></div>
        {!result.passed && (
          <div><span className="text-gray-500">Got: </span><span className="text-red-400">{result.actual_output || '(empty)'}</span></div>
        )}
        {result.error && <div className="text-red-400 mt-1">{result.error}</div>}
      </div>
    </div>
  );
}

function ResultsView({ assessment, problems, onContinue }) {
  return (
    <div className="min-h-screen bg-[#0b0f1a] p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Coding Assessment Complete</h1>
          <p className="text-gray-400">
            You passed {assessment.passed_problems} of {assessment.total_problems} problems ({assessment.score_percent}%)
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {problems.map((p) => (
            <div key={p.id} className="bg-[#111827] border border-gray-800 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium">{p.title}</h3>
                <p className="text-gray-500 text-sm">{p.topic_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400">{p.passed_count}/{p.total_count} tests</span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${p.submission_status === 'passed' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {p.submission_status === 'passed' ? 'Passed' : 'Failed'}
                </span>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onContinue} className="w-full py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer">
          View Results &amp; Start Learning
        </button>
      </div>
    </div>
  );
}

export default function CodingAssessment() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const pollRef = useRef(null);

  const [phase, setPhase] = useState('loading');
  const [assessment, setAssessment] = useState(null);
  const [problems, setProblems] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [error, setError] = useState('');
  const [genProgress, setGenProgress] = useState({ generated: 0, total: 2 });
  const codeMapRef = useRef({});

  const token = session?.access_token;

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  }), [token]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchCurrent = useCallback(async () => {
    const res = await fetch(`${API}/current`, { headers: headers() });
    if (!res.ok) throw new Error('Failed to fetch');
    return res.json();
  }, [headers]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await fetchCurrent();
        if (!data.exists) return;

        if (data.assessment.status === 'generating') {
          setGenProgress({
            generated: data.assessment.problems_generated || 0,
            total: data.assessment.total_problems || 2,
          });
        } else if (data.assessment.status === 'in_progress') {
          stopPolling();
          setAssessment(data.assessment);
          setProblems(data.problems);
          const firstUnsolved = data.problems.findIndex(p => (!p.submission_status || p.submission_status === 'pending'));
          const idx = firstUnsolved >= 0 ? firstUnsolved : 0;
          setCurrentIdx(idx);
          setCode(data.problems[idx]?.user_code || data.problems[idx]?.starter_code || '');
          setPhase('in_progress');
        } else if (data.assessment.status === 'completed') {
          stopPolling();
          setAssessment(data.assessment);
          setProblems(data.problems);
          setPhase('completed');
        }
      } catch (_) { /* keep polling */ }
    }, 2000);
  }, [fetchCurrent, stopPolling]);

  useEffect(() => {
    return stopPolling;
  }, [stopPolling]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const data = await fetchCurrent();

        if (!data.exists) {
          setPhase('ready');
          return;
        }

        if (data.assessment.status === 'generating') {
          setGenProgress({
            generated: data.assessment.problems_generated || 0,
            total: data.assessment.total_problems || 2,
          });
          setPhase('generating');
          startPolling();
        } else if (data.assessment.status === 'in_progress') {
          setAssessment(data.assessment);
          setProblems(data.problems);
          const firstUnsolved = data.problems.findIndex(p => (!p.submission_status || p.submission_status === 'pending'));
          const idx = firstUnsolved >= 0 ? firstUnsolved : 0;
          setCurrentIdx(idx);
          setCode(data.problems[idx]?.user_code || data.problems[idx]?.starter_code || '');
          setPhase('in_progress');
        } else if (data.assessment.status === 'completed') {
          setAssessment(data.assessment);
          setProblems(data.problems);
          setPhase('completed');
        }
      } catch (e) {
        setError(e.message);
        setPhase('error');
      }
    })();
  }, [token, fetchCurrent, startPolling]);

  const startAssessment = async () => {
    setPhase('generating');
    setGenProgress({ generated: 0, total: 2 });
    try {
      const res = await fetch(`${API}/start`, {
        method: 'POST',
        headers: headers(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start');
      }
      startPolling();
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  const currentProblem = problems[currentIdx];

  const getCodeForProblem = (problem, lang) => {
    if (!problem) return '';
    const key = `${problem.id}:${lang}`;
    if (codeMapRef.current[key] !== undefined) return codeMapRef.current[key];
    if (lang === 'python') return problem.user_code || problem.starter_code || STARTER_TEMPLATES.python;
    return STARTER_TEMPLATES[lang] || '';
  };

  const saveCurrentCode = () => {
    if (currentProblem) {
      codeMapRef.current[`${currentProblem.id}:${language}`] = code;
    }
  };

  const switchProblem = (idx) => {
    saveCurrentCode();
    setCurrentIdx(idx);
    setCode(getCodeForProblem(problems[idx], language));
    setTestResults(null);
  };

  const handleLanguageChange = (newLang) => {
    saveCurrentCode();
    setLanguage(newLang);
    setCode(getCodeForProblem(currentProblem, newLang));
  };

  const runCode = async () => {
    if (!currentProblem) return;
    setRunning(true);
    setTestResults(null);
    try {
      const res = await fetch(`${API}/run/${currentProblem.id}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ code, language }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Run failed');
      }
      const data = await res.json();
      setTestResults({ type: 'run', ...data });
    } catch (e) {
      setTestResults({ type: 'error', error: e.message });
    } finally {
      setRunning(false);
    }
  };

  const submitCode = async () => {
    if (!currentProblem) return;
    setSubmitting(true);
    setTestResults(null);
    try {
      const res = await fetch(`${API}/submit/${currentProblem.id}`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ code, language }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Submit failed');
      }
      const data = await res.json();
      setTestResults({ type: 'submit', ...data });

      if (data.assessment_complete) {
        setTimeout(async () => {
          const curr = await fetchCurrent();
          setAssessment(curr.assessment);
          setProblems(curr.problems);
          setPhase('completed');
        }, 1500);
      } else {
        const updated = await fetchCurrent();
        setProblems(updated.problems);
      }
    } catch (e) {
      setTestResults({ type: 'error', error: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'loading') return <Spinner text="Loading coding assessment..." />;
  if (phase === 'error') return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <button onClick={() => { setError(''); setPhase('ready'); }} className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 cursor-pointer">Try Again</button>
      </div>
    </div>
  );

  if (phase === 'ready') return (
    <div className="min-h-screen bg-[#0b0f1a] flex items-center justify-center">
      <div className="max-w-md mx-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/25">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Coding Assessment</h1>
        <p className="text-gray-400 mb-6">Solve 2 coding problems from your known DSA topics. Write code in Python, C++, or C that reads from stdin and prints to stdout.</p>
        <button onClick={startAssessment} className="px-8 py-3 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-medium hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer">
          Start Coding Assessment
        </button>
      </div>
    </div>
  );

  if (phase === 'generating') return <GeneratingProgress generated={genProgress.generated} total={genProgress.total} />;

  if (phase === 'completed') {
    return (
      <ResultsView
        assessment={assessment}
        problems={problems.map(p => ({
          id: p.id,
          title: p.title,
          topic_name: p.topic_name,
          passed_count: p.passed_count,
          total_count: p.total_count,
          submission_status: p.submission_status,
        }))}
        onContinue={() => navigate('/results')}
      />
    );
  }

  const submitted = currentProblem?.submission_status && currentProblem.submission_status !== 'pending';

  return (
    <div className="h-screen bg-[#0b0f1a] flex flex-col">
      {/* Top bar */}
      <div className="h-12 bg-[#111827] border-b border-gray-800 flex items-center px-4 shrink-0">
        <h1 className="text-white font-semibold text-sm mr-6">Coding Assessment</h1>
        <div className="flex gap-1">
          {problems.map((p, i) => (
            <button
              key={p.id}
              onClick={() => switchProblem(i)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                i === currentIdx
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : p.submission_status === 'passed'
                    ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                    : p.submission_status === 'failed'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}
            >
              Problem {i + 1}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-4">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            disabled={submitted}
            className="bg-gray-800 text-gray-300 text-xs border border-gray-700 rounded-md px-2 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer disabled:opacity-50"
          >
            {LANGUAGES.map(l => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500">
            {problems.filter(p => p.submission_status && p.submission_status !== 'pending').length}/{problems.length} submitted
          </span>
        </div>
      </div>

      {/* Main content — 2 panels */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Problem description */}
        <div className="w-[45%] border-r border-gray-800 overflow-y-auto p-5">
          {currentProblem && (
            <>
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">{currentProblem.topic_name}</span>
                <span className="text-xs text-gray-600">Easy</span>
              </div>
              <h2 className="text-lg font-semibold text-white mb-4">{currentProblem.title}</h2>
              <div className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed mb-6">{currentProblem.description}</div>

              <h3 className="text-sm font-medium text-gray-400 mb-2">Sample Test Cases</h3>
              <div className="space-y-3">
                {currentProblem.visible_test_cases.map((tc, i) => (
                  <div key={i} className="bg-[#111827] border border-gray-800 rounded-lg p-3 text-xs font-mono">
                    <div className="mb-1"><span className="text-gray-500">Input: </span><span className="text-gray-300 whitespace-pre-wrap">{tc.input}</span></div>
                    <div><span className="text-gray-500">Output: </span><span className="text-emerald-400 whitespace-pre-wrap">{tc.expected_output}</span></div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: Editor + Results */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Editor */}
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language={LANGUAGES.find(l => l.id === language)?.monacoId || 'python'}
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || '')}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                padding: { top: 12 },
                readOnly: submitted,
              }}
            />
          </div>

          {/* Test results panel */}
          {testResults && (
            <div className="max-h-[40%] border-t border-gray-800 overflow-y-auto p-4 bg-[#0d1117]">
              {testResults.type === 'error' ? (
                <p className="text-red-400 text-sm">{testResults.error}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-300">
                      {testResults.type === 'run' ? 'Run Results' : 'Submission Results'}
                    </h3>
                    <span className={`text-xs font-medium ${
                      (testResults.passed_count ?? testResults.passed) === (testResults.total_count ?? testResults.total)
                        ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {testResults.passed_count ?? testResults.passed}/{testResults.total_count ?? testResults.total} passed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {testResults.results.map((r, i) => <TestResult key={i} result={r} index={i} />)}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="h-14 bg-[#111827] border-t border-gray-800 flex items-center justify-end px-4 gap-3 shrink-0">
            {submitted ? (
              <span className={`text-sm font-medium ${currentProblem?.submission_status === 'passed' ? 'text-green-400' : 'text-red-400'}`}>
                {currentProblem?.submission_status === 'passed' ? 'All tests passed!' : 'Some tests failed'}
              </span>
            ) : (
              <>
                <button
                  onClick={runCode}
                  disabled={running || submitting}
                  className="px-5 py-2 rounded-lg bg-gray-700 text-gray-200 text-sm font-medium hover:bg-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {running ? 'Running...' : 'Run'}
                </button>
                <button
                  onClick={submitCode}
                  disabled={running || submitting}
                  className="px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 text-white text-sm font-medium hover:shadow-lg hover:shadow-emerald-500/25 disabled:opacity-50 transition-all cursor-pointer"
                >
                  {submitting ? 'Submitting...' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
