const TOOL_LABELS = {
  search_web: 'Searching the web',
  fetch_webpage: 'Reading webpage',
  search_coding_problems: 'Finding coding problems',
  search_contests: 'Searching contests',
  get_current_time: 'Getting current time',
};

export default function LoadingIndicator({ activeTools = [] }) {
  const label =
    activeTools.length > 0
      ? activeTools.map((t) => TOOL_LABELS[t] || t).join(', ')
      : 'Thinking';

  return (
    <div className="flex items-start gap-3 mb-5 msg-appear">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mt-0.5 shadow-sm shadow-indigo-500/20">
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
        </svg>
      </div>
      <div className="bg-[#151921] rounded-2xl rounded-bl-md px-4 py-3 border border-gray-700/40">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:0ms]" />
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:150ms]" />
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce [animation-delay:300ms]" />
          </div>
          <span className="text-sm text-gray-400">{label}...</span>
        </div>
      </div>
    </div>
  );
}
