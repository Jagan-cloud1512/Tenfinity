import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useState } from 'react';

const LANG_NAMES = {
  js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', java: 'Java', cpp: 'C++', c: 'C',
  cs: 'C#', go: 'Go', rust: 'Rust', rb: 'Ruby', ruby: 'Ruby',
  php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', sql: 'SQL',
  html: 'HTML', css: 'CSS', json: 'JSON', yaml: 'YAML', yml: 'YAML',
  xml: 'XML', bash: 'Bash', sh: 'Shell', shell: 'Shell',
  dockerfile: 'Dockerfile', md: 'Markdown', markdown: 'Markdown',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button onClick={handleCopy} className="copy-btn">
      {copied ? (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function SourcesList({ sources }) {
  if (!sources?.length) return null;
  const unique = sources.filter(
    (s, i, a) => s.url && a.findIndex((x) => x.url === s.url) === i
  );
  if (!unique.length) return null;

  return (
    <div className="mt-3 pt-3 border-t border-gray-700/50">
      <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">
        Sources
      </p>
      <div className="flex flex-wrap gap-2">
        {unique.map((source, i) => (
          <a
            key={i}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-800/80 text-blue-400 hover:bg-gray-700 hover:text-blue-300 transition-colors truncate max-w-[280px] border border-gray-700/50"
            title={source.url}
          >
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            {source.title || new URL(source.url).hostname}
          </a>
        ))}
      </div>
    </div>
  );
}

function ToolBadges({ toolsUsed }) {
  if (!toolsUsed?.length) return null;
  const labels = {
    search_web: 'Web Search',
    fetch_webpage: 'Page Fetch',
    search_coding_problems: 'Problems',
    search_contests: 'Contests',
    get_current_time: 'Time',
  };
  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {[...new Set(toolsUsed)].map((tool, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20"
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          {labels[tool] || tool}
        </span>
      ))}
    </div>
  );
}

function ProviderBadge({ provider, model }) {
  if (!provider) return null;
  return (
    <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-700/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      <span className="text-[10px] text-gray-500">
        {provider}{model ? ` · ${model}` : ''}
      </span>
    </div>
  );
}

const S = {
  p: {
    margin: '0.9em 0',
    lineHeight: 1.8,
  },
  h1: { margin: '1.6em 0 0.6em', fontSize: '1.45em', fontWeight: 600, color: '#f0f0f5', lineHeight: 1.35 },
  h2: { margin: '1.5em 0 0.55em', fontSize: '1.25em', fontWeight: 600, color: '#f0f0f5', lineHeight: 1.35 },
  h3: { margin: '1.4em 0 0.5em', fontSize: '1.1em', fontWeight: 600, color: '#f0f0f5', lineHeight: 1.35 },
  h4: { margin: '1.3em 0 0.45em', fontSize: '1em', fontWeight: 600, color: '#f0f0f5', lineHeight: 1.35 },
  ul: {
    margin: '0.9em 0',
    paddingLeft: '2em',
    listStyleType: 'disc',
  },
  ol: {
    margin: '0.9em 0',
    paddingLeft: '2em',
    listStyleType: 'decimal',
  },
  li: {
    margin: '0.4em 0',
    paddingLeft: '0.25em',
    display: 'list-item',
    lineHeight: 1.75,
  },
  blockquote: {
    margin: '1.2em 0',
    padding: '0.7em 1.15em',
    borderLeft: '3px solid #6366f1',
    background: 'rgba(99,102,241,0.06)',
    borderRadius: '0 0.5rem 0.5rem 0',
    color: '#b8bcc8',
  },
  hr: {
    margin: '2em 0',
    border: 'none',
    borderTop: '1px solid rgba(99,102,241,0.15)',
  },
  strong: { fontWeight: 600, color: '#ededf5' },
  em: { fontStyle: 'italic', color: '#c0c0d0' },
  tableWrap: {
    overflowX: 'auto',
    margin: '1.2em 0',
    border: '1px solid #1e2433',
    borderRadius: '0.5rem',
  },
  th: {
    padding: '0.6em 0.85em',
    borderBottom: '1px solid #1e2433',
    textAlign: 'left',
    background: '#111827',
    fontWeight: 600,
    color: '#94a0b8',
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  },
  td: {
    padding: '0.6em 0.85em',
    borderBottom: '1px solid #1e2433',
    textAlign: 'left',
  },
};

const mdComponents = {
  p({ children }) { return <p style={S.p}>{children}</p>; },
  h1({ children }) { return <h1 style={S.h1}>{children}</h1>; },
  h2({ children }) { return <h2 style={S.h2}>{children}</h2>; },
  h3({ children }) { return <h3 style={S.h3}>{children}</h3>; },
  h4({ children }) { return <h4 style={S.h4}>{children}</h4>; },
  h5({ children }) { return <h5 style={S.h4}>{children}</h5>; },
  h6({ children }) { return <h6 style={S.h4}>{children}</h6>; },
  ul({ children }) { return <ul style={S.ul}>{children}</ul>; },
  ol({ children }) { return <ol style={S.ol}>{children}</ol>; },
  li({ children }) { return <li style={S.li}>{children}</li>; },
  blockquote({ children }) { return <blockquote style={S.blockquote}>{children}</blockquote>; },
  hr() { return <hr style={S.hr} />; },
  strong({ children }) { return <strong style={S.strong}>{children}</strong>; },
  em({ children }) { return <em style={S.em}>{children}</em>; },
  pre({ children }) {
    return <>{children}</>;
  },
  code({ className, children }) {
    const match = /language-(\w+)/.exec(className || '');
    const codeText = String(children).replace(/\n$/, '');

    if (match || codeText.includes('\n')) {
      const lang = match?.[1] || 'text';
      return (
        <div className="code-block">
          <div className="code-header">
            <span>{LANG_NAMES[lang] || lang}</span>
            <CopyButton text={codeText} />
          </div>
          <SyntaxHighlighter
            style={oneDark}
            language={lang}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: 0,
              fontSize: '0.8125rem',
              padding: '1rem',
              background: '#0d1117',
            }}
          >
            {codeText}
          </SyntaxHighlighter>
        </div>
      );
    }

    return <code className="inline-code">{children}</code>;
  },
  table({ children }) {
    return (
      <div style={S.tableWrap}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', lineHeight: 1.6 }}>{children}</table>
      </div>
    );
  },
  th({ children }) { return <th style={S.th}>{children}</th>; },
  td({ children }) { return <td style={S.td}>{children}</td>; },
  a({ href, children }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#818cf8', textDecoration: 'underline', textUnderlineOffset: '2px' }}
      >
        {children}
      </a>
    );
  },
};

export default function ChatMessage({ message, isStreaming }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} mb-5 msg-appear`}>
      {!isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mt-0.5 shadow-sm shadow-indigo-500/20">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
      )}

      <div
        className={`min-w-0 ${
          isUser
            ? 'max-w-[75%] rounded-2xl rounded-br-md px-4 py-2.5 bg-indigo-600 text-white'
            : 'max-w-[90%] rounded-2xl rounded-bl-md px-5 py-4 bg-[#12161f] text-gray-100 border border-[#1e2536]'
        }`}
      >
        {!isUser && <ToolBadges toolsUsed={message.tools_used} />}

        {isUser ? (
          <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        ) : (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
              {message.content}
            </ReactMarkdown>
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-indigo-400 animate-pulse ml-0.5 rounded-sm align-middle" />
            )}
          </div>
        )}

        {!isUser && !isStreaming && <SourcesList sources={message.sources} />}
        {!isUser && !isStreaming && (
          <ProviderBadge provider={message.provider} model={message.model} />
        )}
      </div>

      {isUser && (
        <div className="shrink-0 w-7 h-7 rounded-lg bg-indigo-600/80 flex items-center justify-center mt-0.5">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}
