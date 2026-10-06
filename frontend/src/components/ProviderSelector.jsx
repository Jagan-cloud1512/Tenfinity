import { useState, useRef, useEffect } from 'react';

const MODES = [
  { value: 'auto', label: 'Auto', description: 'Best available provider' },
  { value: 'fast', label: 'Fast', description: 'Prefer fastest provider' },
  { value: 'local', label: 'Local', description: 'Prefer Ollama (local)' },
  { value: 'groq', label: 'Groq', description: 'Groq API only' },
  { value: 'openrouter', label: 'OpenRouter', description: 'OpenRouter API only' },
  { value: 'ollama', label: 'Ollama', description: 'Ollama only' },
];

function ProviderDot({ health, provider }) {
  if (!health?.providers) return null;
  const p = health.providers.find((h) => h.provider === provider);
  if (!p) return null;
  const color = p.reachable ? 'bg-green-400' : p.configured !== false ? 'bg-yellow-400' : 'bg-gray-600';
  return <span className={`w-1.5 h-1.5 rounded-full ${color}`} />;
}

export default function ProviderSelector({ mode, onModeChange, health }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = MODES.find((m) => m.value === mode) || MODES[0];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#131722] border border-[#1e2536] text-sm text-gray-400 hover:bg-[#1a1f2e] hover:text-white transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-indigo-400" />
        {current.label}
        <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-[#131722] border border-[#1e2536] shadow-xl shadow-black/40 z-50 py-1 overflow-hidden">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => {
                onModeChange(m.value);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                mode === m.value
                  ? 'bg-indigo-600/20 text-indigo-300'
                  : 'text-gray-300 hover:bg-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-1.5">
                {m.value === 'auto' || m.value === 'fast' || m.value === 'local' ? (
                  <span className={`w-2 h-2 rounded-full ${mode === m.value ? 'bg-indigo-400' : 'bg-gray-500'}`} />
                ) : (
                  <ProviderDot health={health} provider={m.value} />
                )}
              </div>
              <div className="text-left">
                <div className="font-medium">{m.label}</div>
                <div className="text-xs text-gray-500">{m.description}</div>
              </div>
              {mode === m.value && (
                <svg className="w-4 h-4 ml-auto text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
