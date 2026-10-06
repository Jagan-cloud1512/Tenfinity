import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAuth } from '../contexts/AuthContext';

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
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25">
          <svg className="animate-spin w-6 h-6 text-white" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Generating Questions</h3>
        <p className="text-sm text-gray-400 mb-5">
          AI is creating personalized assessment questions...
        </p>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-sm font-medium text-indigo-300">
          {generated} of {total} questions generated
        </p>
      </div>
    </div>
  );
}

function CodeBlock({ code, language }) {
  return (
    <div className="code-block my-4">
      <div className="code-header">
        <span>{language || 'python'}</span>
      </div>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'python'}
        PreTag="div"
        customStyle={{
          margin: 0, borderRadius: 0,
          fontSize: '0.8125rem', padding: '1rem',
          background: '#0d1117',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function QuestionCard({ question, index, total, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const { session } = useAuth();

  const handleSubmit = async () => {
    if (selected === null || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessment/answer/${question.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ selected_index: selected }),
      });
      if (!res.ok) throw new Error('Failed to submit answer');
      const data = await res.json();
      setResult(data);
      setSubmitted(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    onAnswer(result);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-medium border border-indigo-500/20">
            {question.topic_name}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-gray-800/60 text-gray-400 text-xs font-medium">
            {question.question_type === 'mcq' ? 'Conceptual' : 'Code Output'}
          </span>
        </div>
        <span className="text-sm text-gray-500">
          Question {index + 1} of {total}
        </span>
      </div>

      <div className="mb-2">
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
            style={{ width: `${((index + (submitted ? 1 : 0)) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="bg-[#151b2e] border border-gray-800/60 rounded-2xl p-6 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4">{question.question_text}</h3>

        {question.code_snippet && (
          <CodeBlock code={question.code_snippet} language={question.code_language} />
        )}

        <div className="space-y-3 mt-4">
          {question.options.map((option, i) => {
            let optClass = 'border-gray-700/60 bg-[#0b0f1a] hover:border-gray-600';
            if (submitted && result) {
              if (i === result.correct_index) {
                optClass = 'border-emerald-500/50 bg-emerald-500/10';
              } else if (i === selected && !result.is_correct) {
                optClass = 'border-red-500/50 bg-red-500/10';
              } else {
                optClass = 'border-gray-800/40 bg-[#0b0f1a] opacity-50';
              }
            } else if (i === selected) {
              optClass = 'border-indigo-500/50 bg-indigo-500/10';
            }

            return (
              <button
                key={i}
                onClick={() => !submitted && setSelected(i)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${optClass} ${
                  submitted ? 'cursor-default' : 'cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-medium shrink-0 ${
                    submitted && i === result?.correct_index
                      ? 'border-emerald-500 text-emerald-400'
                      : submitted && i === selected && !result?.is_correct
                      ? 'border-red-500 text-red-400'
                      : i === selected
                      ? 'border-indigo-500 text-indigo-400 bg-indigo-500/20'
                      : 'border-gray-600 text-gray-500'
                  }`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className={submitted && i === result?.correct_index ? 'text-emerald-300' : 'text-gray-300'}>
                    {option}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {submitted && result && (
          <div className={`mt-5 px-4 py-3 rounded-lg text-sm ${
            result.is_correct
              ? 'bg-emerald-950/40 border border-emerald-900/50 text-emerald-300'
              : 'bg-red-950/40 border border-red-900/50 text-red-300'
          }`}>
            <p className="font-semibold mb-1">{result.is_correct ? 'Correct!' : 'Incorrect'}</p>
            <p className="text-gray-400">{result.explanation}</p>
          </div>
        )}

        <div className="flex justify-end mt-6">
          {!submitted ? (
            <button
              onClick={handleSubmit}
              disabled={selected === null || submitting}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all"
            >
              {submitting ? 'Submitting...' : 'Submit Answer'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="px-6 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all"
            >
              {result?.assessment_complete ? 'See Results' : 'Next Question'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsView({ assessment, questions, onContinue }) {
  const topicScores = {};
  for (const q of questions) {
    const name = q.topic_name || `Topic ${q.topic_id}`;
    if (!topicScores[name]) topicScores[name] = { correct: 0, total: 0 };
    topicScores[name].total += 1;
    if (q.is_correct) topicScores[name].correct += 1;
  }

  const scoreColor =
    assessment.score_percent >= 70 ? 'text-emerald-400' :
    assessment.score_percent >= 40 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">Assessment Complete</h2>
        <div className={`text-5xl font-bold ${scoreColor} mb-1`}>
          {Math.round(assessment.score_percent)}%
        </div>
        <p className="text-gray-400 text-sm">
          {assessment.correct_answers} of {assessment.total_questions} correct
        </p>
      </div>

      <div className="bg-[#151b2e] border border-gray-800/60 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Topic Breakdown
        </h3>
        <div className="space-y-3">
          {Object.entries(topicScores).map(([name, score]) => (
            <div key={name} className="flex items-center justify-between">
              <span className="text-sm text-gray-300">{name}</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  score.correct === score.total ? 'text-emerald-400' :
                  score.correct > 0 ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {score.correct}/{score.total}
                </span>
                <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      score.correct === score.total ? 'bg-emerald-500' :
                      score.correct > 0 ? 'bg-amber-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${(score.correct / score.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-[#151b2e] border border-gray-800/60 rounded-2xl p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Question Review
        </h3>
        <div className="space-y-3">
          {questions.map((q, i) => (
            <div key={q.id} className="flex items-start gap-3 text-sm">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                q.is_correct ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {q.is_correct ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-gray-300 truncate">{q.question_text}</p>
                <p className="text-gray-600 text-xs mt-0.5">{q.topic_name} &middot; {q.question_type === 'mcq' ? 'Conceptual' : 'Code Output'}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center">
        <button
          onClick={onContinue}
          className="px-8 py-3 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2"
        >
          Continue to Coding Assessment
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default function Assessment() {
  const [phase, setPhase] = useState('loading');
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState('');
  const [genProgress, setGenProgress] = useState({ generated: 0, total: 0 });
  const pollRef = useRef(null);
  const navigate = useNavigate();
  const { session, signOut } = useAuth();

  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    checkExisting();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkExisting = async () => {
    try {
      const res = await fetch('/api/assessment/current', { headers });
      if (!res.ok) throw new Error('Failed to check assessment');
      const data = await res.json();

      if (data.exists) {
        setAssessment(data.assessment);
        setQuestions(data.questions);
        if (data.assessment.status === 'generating') {
          setGenProgress({
            generated: data.assessment.questions_generated || 0,
            total: data.assessment.total_questions || 0,
          });
          setPhase('generating');
          startPolling();
        } else if (data.assessment.status === 'completed') {
          setPhase('completed');
        } else {
          const firstUnanswered = data.questions.findIndex((q) => !q.answered);
          setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
          setPhase('in_progress');
        }
      } else {
        setPhase('ready');
      }
    } catch (err) {
      setError(err.message);
      setPhase('ready');
    }
  };

  const startPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/assessment/current', { headers });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.exists) return;

        if (data.assessment.status === 'generating') {
          setGenProgress({
            generated: data.assessment.questions_generated || 0,
            total: data.assessment.total_questions || 0,
          });
        } else {
          clearInterval(pollRef.current);
          pollRef.current = null;
          setAssessment(data.assessment);
          setQuestions(data.questions);
          const firstUnanswered = data.questions.findIndex((q) => !q.answered);
          setCurrentIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
          setPhase('in_progress');
        }
      } catch { /* polling failure is transient */ }
    }, 2000);
  };

  const startAssessment = async () => {
    setPhase('generating');
    setGenProgress({ generated: 0, total: 0 });
    setError('');
    try {
      const res = await fetch('/api/assessment/start', {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to start assessment');
      }
      const data = await res.json();
      setGenProgress({ generated: 0, total: data.expected_questions || 0 });
      startPolling();
    } catch (err) {
      setError(err.message);
      setPhase('ready');
    }
  };

  const handleAnswer = (result) => {
    if (result.assessment_complete) {
      checkExisting();
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleContinue = () => {
    navigate('/coding-assessment');
  };

  if (phase === 'loading') return <Spinner text="Loading..." />;
  if (phase === 'generating') return <GeneratingProgress generated={genProgress.generated} total={genProgress.total} />;

  return (
    <div className="min-h-screen bg-[#0b0f1a] text-gray-100">
      <div className="border-b border-gray-800/60 bg-[#0b0f1a]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Initial Assessment</h1>
            <p className="text-xs text-gray-500">{session?.user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/topics')}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Back to Topics
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
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-950/40 border border-red-900/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {phase === 'ready' && (
          <div className="max-w-lg mx-auto text-center py-12">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/25">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Ready for Assessment</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-sm mx-auto">
              We'll generate personalized questions based on the topics you marked as "I Know".
              Each topic gets 1 conceptual MCQ and 1 code output prediction question.
            </p>
            <button
              onClick={startAssessment}
              className="px-8 py-3 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-500/25"
            >
              Start Assessment
            </button>
          </div>
        )}

        {phase === 'in_progress' && questions[currentIndex] && (
          <QuestionCard
            key={questions[currentIndex].id}
            question={questions[currentIndex]}
            index={currentIndex}
            total={questions.length}
            onAnswer={handleAnswer}
          />
        )}

        {phase === 'completed' && assessment && (
          <ResultsView
            assessment={assessment}
            questions={questions}
            onContinue={handleContinue}
          />
        )}
      </div>
    </div>
  );
}
