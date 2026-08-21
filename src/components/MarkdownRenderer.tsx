import React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  theme?: 'dark' | 'light';
  className?: string;
}

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
          code: ({ children, className: codeClass }) => {
            const isCodeBlock = codeClass && codeClass.includes('language-');
            if (isCodeBlock) {
              return (
                <code
                  className={`block font-mono text-xs p-3 rounded-xl overflow-x-auto my-2 leading-relaxed ${
                    isDark
                      ? 'bg-[#0D1117] text-[#A8E6B0] border border-white/10'
                      : 'bg-[#F4F1EA] text-[#2A6B47] border border-black/10'
                  }`}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`font-mono text-[11px] sm:text-xs px-1.5 py-0.5 rounded font-semibold ${
                  isDark
                    ? 'bg-white/10 text-[#FFC93C] border border-white/10'
                    : 'bg-black/10 text-[#B34126] border border-black/10'
                }`}
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
