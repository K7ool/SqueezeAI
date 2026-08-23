import React, { useState, useMemo } from 'react';
import { Copy, Check, Download, HardDrive, FileCode, Maximize2, Minimize2 } from 'lucide-react';
import { tokenizeLuauScript, Token } from '../utils/luauSyntax';
import { saveSingleScriptToDisk } from '../utils/projectDisk';
import { formatAndSanitizeLuau } from '../utils/luauFormatter';
import { sound } from '../utils/audio';

interface LuauCodeViewerProps {
  code: string;
  filename?: string;
  theme?: 'dark' | 'paper';
  readOnly?: boolean;
  onChange?: (newCode: string) => void;
  showLineNumbers?: boolean;
  maxHeight?: string;
  onOpenInProject?: () => void;
  onSavedToDisk?: (filename: string) => void;
}

export const LuauCodeViewer: React.FC<LuauCodeViewerProps> = ({
  code,
  filename = 'Script.server.luau',
  theme = 'paper',
  showLineNumbers = true,
  maxHeight = '460px',
  onOpenInProject,
  onSavedToDisk,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Always sanitize and format code so it's guaranteed clean multi-line Luau
  const formattedCode = useMemo(() => {
    return formatAndSanitizeLuau(code);
  }, [code]);

  // Tokenize lines cleanly without regex replace vulnerabilities
  const tokenizedLines = useMemo(() => {
    return tokenizeLuauScript(formattedCode);
  }, [formattedCode]);

  const handleCopy = () => {
    sound.success();
    navigator.clipboard.writeText(formattedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToDisk = async () => {
    sound.pop();
    setIsSaving(true);
    try {
      const res = await saveSingleScriptToDisk(filename, formattedCode);
      if (res.success) {
        sound.success();
        if (onSavedToDisk) onSavedToDisk(res.filename);
      }
    } catch (err) {
      sound.error();
      console.error('Save to disk failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const getTokenColor = (token: Token, isDark: boolean): string => {
    if (isDark) {
      switch (token.type) {
        case 'keyword': return 'text-[#FF7B72] font-semibold'; // Studio Red/Coral
        case 'builtin': return 'text-[#79C0FF] font-medium'; // Studio Blue
        case 'function': return 'text-[#D2A8FF] font-semibold'; // Studio Purple
        case 'string': return 'text-[#A5D6FF]'; // Studio Light Blue / Green
        case 'comment': return 'text-[#8B949E] italic'; // Studio Gray
        case 'number': return 'text-[#FFA657]'; // Studio Orange
        case 'type': return 'text-[#7EE787] font-medium'; // Studio Mint
        case 'operator': return 'text-[#FF7B72]';
        case 'property': return 'text-[#E6EDF3]';
        case 'punctuation': return 'text-[#8B949E]';
        default: return 'text-[#E6EDF3]';
      }
    } else {
      // Paper / Receipt theme
      switch (token.type) {
        case 'keyword': return 'text-[#9A3412] font-semibold'; // Warm Burnt Orange/Brown
        case 'builtin': return 'text-[#1E40AF] font-semibold'; // Deep Royal Blue
        case 'function': return 'text-[#166534] font-semibold'; // Emerald Green
        case 'string': return 'text-[#854D0E]'; // Amber Ochre
        case 'comment': return 'text-[#64748B] italic'; // Slate Muted
        case 'number': return 'text-[#C2410C] font-mono'; // Rich Tangerine
        case 'type': return 'text-[#047857] font-semibold'; // Pine
        case 'operator': return 'text-[#9A3412]';
        case 'property': return 'text-[#0F172A]';
        case 'punctuation': return 'text-[#475569]';
        default: return 'text-[#0F172A]';
      }
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`rounded-xl overflow-hidden flex flex-col font-mono text-xs sm:text-[13px] border ${
      isDark 
        ? 'bg-[#0D1117] border-white/10 text-[#E6EDF3]' 
        : 'bg-[#FFFDF6] border-[#0B120D]/15 text-[#0F172A]'
    }`}>
      {/* Code Header Bar */}
      <div className={`px-3 sm:px-4 py-2 flex items-center justify-between border-b select-none gap-2 ${
        isDark 
          ? 'bg-[#161B22] border-white/10 text-[#8B949E]' 
          : 'bg-[#FFF8E7] border-[#0B120D]/10 text-[#0B120D]/80'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCode className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-[#79C0FF]' : 'text-[#F0A500]'}`} />
          <span className="font-bold tracking-tight truncate text-[11px] sm:text-xs">{filename}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase shrink-0 font-bold ${
            isDark ? 'bg-white/10 text-[#7EE787]' : 'bg-[#142019]/10 text-[#142019]'
          }`}>
            Luau
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onOpenInProject && (
            <button
              onClick={() => {
                sound.whoosh();
                onOpenInProject();
              }}
              className={`p-1.5 sm:px-2 sm:py-1 rounded text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
                isDark 
                  ? 'bg-white/10 hover:bg-white/20 text-[#FFFDF6]' 
                  : 'bg-[#142019]/10 hover:bg-[#142019]/20 text-[#0B120D]'
              }`}
              title="Open inside Studio Project Workspace"
            >
              <HardDrive className="w-3 h-3 text-[#FFC93C]" />
              <span className="hidden md:inline text-[11px]">Workspace</span>
            </button>
          )}

          <button
            onClick={handleSaveToDisk}
            disabled={isSaving}
            className={`p-1.5 sm:px-2 sm:py-1 rounded text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-[#FFFDF6]'
                : 'bg-[#142019]/10 hover:bg-[#FFC93C] hover:text-[#0B120D] text-[#0B120D]'
            }`}
            title="Save file directly to local disk (.luau)"
          >
            <Download className="w-3 h-3" />
            <span className="hidden md:inline text-[11px]">Save</span>
          </button>

          <button
            onClick={handleCopy}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 active:scale-95 transition-all cursor-pointer ${
              isDark
                ? 'bg-white/10 hover:bg-white/20 text-[#FFFDF6]'
                : 'bg-[#142019]/10 hover:bg-[#142019]/20 text-[#0B120D]'
            }`}
            title="Copy script to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-[#A8E6B0]" /> : <Copy className="w-3 h-3" />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => {
              sound.click();
              setIsExpanded(!isExpanded);
            }}
            className="p-1.5 rounded hover:bg-white/10 active:scale-95 text-xs transition-all cursor-pointer text-[#0B120D]/60 hover:text-[#0B120D]"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Code Body */}
      <div 
        className="overflow-x-auto overflow-y-auto p-3 sm:p-4 leading-relaxed select-text"
        style={{ maxHeight: isExpanded ? '850px' : maxHeight }}
      >
        <div className="table w-full border-collapse">
          {tokenizedLines.map((lineTokens, lineIdx) => (
            <div key={lineIdx} className="table-row group hover:bg-white/5 transition-colors">
              {showLineNumbers && (
                <div 
                  className={`table-cell pr-3 sm:pr-4 pl-1 text-right select-none font-mono text-[11px] opacity-40 w-8 align-top ${
                    isDark ? 'text-[#8B949E]' : 'text-[#64748B]'
                  }`}
                >
                  {lineIdx + 1}
                </div>
              )}
              <div className="table-cell whitespace-pre font-mono">
                {lineTokens.length === 0 ? (
                  <span>&nbsp;</span>
                ) : (
                  lineTokens.map((token, tokIdx) => (
                    <span 
                      key={tokIdx} 
                      className={getTokenColor(token, isDark)}
                    >
                      {token.text}
                    </span>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer Info */}
      <div className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-[11px] border-t flex items-center justify-between select-none ${
        isDark 
          ? 'bg-[#161B22] border-white/10 text-[#8B949E]' 
          : 'bg-[#FFF8E7] border-[#0B120D]/10 text-[#0B120D]/60'
      }`}>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#A8E6B0]" />
          <span>Roblox Luau Type Checked</span>
        </span>
        <span>{tokenizedLines.length} lines</span>
      </div>
    </div>
  );
};

