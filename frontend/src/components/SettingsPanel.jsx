export default function SettingsPanel({ health, onClose, onRefresh }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#0e1219] border border-gray-700/50 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">System Status</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Providers</h3>
            <div className="space-y-2">
              {health?.providers?.map((p) => (
                <div
                  key={p.provider}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        p.reachable ? 'bg-green-400' : p.configured !== false ? 'bg-yellow-400' : 'bg-red-400'
                      }`}
                    />
                    <div>
                      <span className="text-sm font-medium text-white capitalize">{p.provider}</span>
                      {p.model && (
                        <span className="text-xs text-gray-500 ml-2">{p.model}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs">
                    {p.reachable ? (
                      <span className="text-green-400">
                        Online{p.latency_ms ? ` (${p.latency_ms}ms)` : ''}
                      </span>
                    ) : p.configured !== false ? (
                      <span className="text-yellow-400">Unreachable</span>
                    ) : (
                      <span className="text-gray-500">Not configured</span>
                    )}
                  </div>
                </div>
              )) || (
                <p className="text-sm text-gray-500">Loading...</p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Services</h3>
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
              <div className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${health?.search_available ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm text-white">Web Search</span>
              </div>
              <span className={`text-xs ${health?.search_available ? 'text-green-400' : 'text-red-400'}`}>
                {health?.search_available ? 'Available' : 'Unavailable'}
              </span>
            </div>
          </div>

          {health?.available_tools && (
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Tools</h3>
              <div className="flex flex-wrap gap-2">
                {health.available_tools.map((tool) => (
                  <span
                    key={tool}
                    className="px-3 py-1 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700"
                  >
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-800 flex justify-end gap-3">
          <button
            onClick={onRefresh}
            className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
