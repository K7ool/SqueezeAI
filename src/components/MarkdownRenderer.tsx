import React, { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileCode } from 'lucide-react';
import { tokenizeLuauScript, Token } from '../utils/luauSyntax';
import { sound } from '../utils/audio';

interface MarkdownRendererProps {
  content: string;
  theme?: 'dark' | 'light';
  className?: string;
}

function getTokenColor(token: Token, isDark: boolean): string {
  switch (token.type) {
    case 'comment':
      return isDark ? 'text-slate-500 italic' : 'text-slate-400 italic';
    case 'string':
      return isDark ? 'text-[#A8E6B0]' : 'text-[#2A6B47]';
    case 'keyword':
      return isDark ? 'text-[#FF7B72] font-semibold' : 'text-[#D73A49] font-semibold';
    case 'builtin':
      return isDark ? 'text-[#79C0FF]' : 'text-[#005CC5]';
    case 'function':
      return isDark ? 'text-[#D2A8FF]' : 'text-[#6F42C1]';
    case 'type':
      return isDark ? 'text-[#FFA657]' : 'text-[#E36209]';
    case 'number':
      return isDark ? 'text-[#79C0FF]' : 'text-[#005CC5]';
    case 'operator':
      return isDark ? 'text-[#FF7B72]' : 'text-[#D73A49]';
    case 'property':
      return isDark ? 'text-[#79C0FF]' : 'text-[#005CC5]';
    default:
      return isDark ? 'text-slate-200' : 'text-slate-800';
  }
}

const CodeBlockWithCopy: React.FC<{ code: string; language: string; isDark: boolean }> = ({ code, language, isDark }) => {
  const [copied, setCopied] = useState(false);

  const cleanCode = code.replace(/\n$/, '');

  const handleCopy = () => {
    try {
      sound.click();
    } catch {
      // Ignore audio error
    }
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLuau = !language || language.includes('lua') || language.includes('luau') || language === 'rbx';
  const displayLang = isLuau ? 'Luau' : language ? language.charAt(0).toUpperCase() + language.slice(1) : 'Code';

  const tokenizedLines = useMemo(() => {
    if (isLuau) {
      return tokenizeLuauScript(cleanCode);
    }
    return cleanCode.split('\n').map(line => [{ type: 'text' as const, text: line }]);
  }, [cleanCode, isLuau]);

  return (
    <div className={`my-3 rounded-xl overflow-hidden border font-mono text-xs ${
      isDark ? 'bg-[#0D1117] border-white/10 text-white' : 'bg-[#F8F9FA] border-black/10 text-[#0F172A]'
    }`}>
      {/* Code Block Header Bar */}
      <div className={`px-3 py-1.5 flex items-center justify-between border-b select-none ${
        isDark ? 'bg-[#161B22] border-white/10 text-white/60' : 'bg-[#E9ECEF] border-black/10 text-slate-600'
      }`}>
        <div className="flex items-center gap-1.5 text-[11px] font-bold">
          <FileCode className="w-3.5 h-3.5 text-[#FFC93C]" />
          <span className="uppercase tracking-wider">{displayLang}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : isDark
                ? 'bg-white/10 hover:bg-white/20 text-white'
                : 'bg-black/10 hover:bg-black/20 text-slate-800'
          }`}
          title="Copy code only"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Lines with Syntax Highlighting */}
      <div className="p-3 overflow-x-auto leading-relaxed select-text">
        <div className="table w-full border-collapse">
          {tokenizedLines.map((lineTokens, lineIdx) => (
            <div key={lineIdx} className="table-row group hover:bg-white/5 transition-colors">
              <div className="table-cell pr-3 select-none text-right font-mono text-[10px] opacity-30 w-6 align-top text-slate-400">
                {lineIdx + 1}
              </div>
              <div className="table-cell whitespace-pre font-mono">
                {lineTokens.length === 0 ? (
                  <span>&nbsp;</span>
                ) : (
                  lineTokens.map((token, tokIdx) => (
                    <span key={tokIdx} className={getTokenColor(token, isDark)}>
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  theme = 'dark',
  className = '',
}) => {
  const isDark = theme === 'dark';

  return (
    <div
      className={`markdown-body space-y-2.5 text-xs sm:text-sm leading-relaxed ${
        isDark ? 'text-[#FFFDF6]' : 'text-[#0B120D]'
      } ${className}`}
    >
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className={`text-lg sm:text-xl font-bold font-display mt-4 mb-2 tracking-tight ${
                isDark ? 'text-[#FFC93C]' : 'text-[#0B120D]'
              }`}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className={`text-base sm:text-lg font-bold font-display mt-3.5 mb-1.5 tracking-tight ${
                isDark ? 'text-[#FFC93C]' : 'text-[#0B120D]'
              }`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className={`text-sm sm:text-base font-bold font-display mt-3 mb-1 tracking-tight ${
                isDark ? 'text-[#FFC93C]' : 'text-[#0B120D]'
              }`}
            >
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4
              className={`text-xs sm:text-sm font-bold font-display mt-2.5 mb-1 ${
                isDark ? 'text-[#FFC93C]' : 'text-[#0B120D]'
              }`}
            >
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
          ),
          strong: ({ children }) => (
            <strong
              className={`font-bold ${
                isDark ? 'text-[#FFFDF6] font-semibold' : 'text-[#0B120D] font-bold'
              }`}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className={`italic ${isDark ? 'text-white/90' : 'text-[#0B120D]/90'}`}>
              {children}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 space-y-1.5 my-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 space-y-1.5 my-2">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`border-l-2 pl-3 py-1 my-2 text-xs italic ${
                isDark
                  ? 'border-[#FFC93C]/50 text-white/75 bg-white/5 rounded-r-lg'
                  : 'border-[#0B120D]/30 text-[#0B120D]/75 bg-black/5 rounded-r-lg'
              }`}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              className={`my-3.5 border-t ${
                isDark ? 'border-white/15' : 'border-black/15'
              }`}
            />
          ),
          pre: ({ children }) => <>{children}</>,
          code: ({ inline, className: codeClass, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(codeClass || '');
            const codeString = String(children);

            if (!inline && (match || codeString.includes('\n'))) {
              const lang = match ? match[1] : 'luau';
              return <CodeBlockWithCopy code={codeString} language={lang} isDark={isDark} />;
            }

            return (
              <code
                className={`font-mono text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-semibold ${
                  isDark
                    ? 'bg-white/10 text-[#FFC93C] border border-white/10'
                    : 'bg-black/10 text-[#B34126] border border-black/10'
                }`}
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#79C0FF] hover:text-[#A8E6B0] underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
