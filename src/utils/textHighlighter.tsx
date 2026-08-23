import React from 'react';

/**
 * Parses text and highlights:
 * 1. File names and script paths (e.g., ServerScriptService/MainServer, src/db.ts, *.lua) -> light purple/cyan with monospace.
 * 2. Intent badges (e.g., PROJECT_QUERY, EXPLAIN, GREETING, CODE_GENERATION) -> cyan/blue pill badge.
 * 3. Roblox Services & System names (e.g., ReplicatedStorage, DataModel, Workspace, ProfileService, Knit) -> gold/yellow tag.
 * 4. Backticked code blocks (`code`) -> dark code pill.
 */
export function renderHighlightedText(text: string): React.ReactNode {
  if (!text) return null;

  // Split by backticks first to handle code snippets
  const parts = text.split(/(`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      const code = part.slice(1, -1);
      return (
        <code key={i} className="bg-[#1F242C] text-[#7EE787] border border-white/15 px-1.5 py-0.5 rounded font-mono text-[11px] shadow-sm">
          {code}
        </code>
      );
    }

    // Tokenize text for file paths, intents, and services
    const subParts = part.split(/(\s+|[:,\-\/\.()\[\]{}>]+)/g);

    return (
      <span key={i}>
        {subParts.map((token, j) => {
          const tTrim = token.trim();
          if (!tTrim) return token;

          // Check if token is an intent value
          const intents = [
            'PROJECT_QUERY', 'EXPLAIN', 'GREETING', 'CODE_GENERATION', 
            'REFACTOR', 'DEBUG', 'ANALYZE', 'SYSTEM_ARCHITECTURE', 'GAME_INTELLIGENCE'
          ];
          if (intents.includes(tTrim.toUpperCase())) {
            return (
              <span key={j} className="inline-block px-1.5 py-0.2 mx-0.5 text-[10px] font-bold font-mono rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-xs">
                {tTrim}
              </span>
            );
          }

          // Check if token is a file path or script name
          const isFile = tTrim.match(/\.(lua|luau|ts|tsx|js|json|css|html|md)$/i) || 
                         tTrim.startsWith('ServerScriptService/') || 
                         tTrim.startsWith('ReplicatedStorage/') || 
                         tTrim.startsWith('StarterPlayer/') ||
                         tTrim.startsWith('StarterCharacterScripts/') ||
                         tTrim.startsWith('StarterGui/') ||
                         tTrim.startsWith('Workspace/') ||
                         tTrim.includes('/src/') ||
                         tTrim.includes('/server/') ||
                         tTrim.includes('/components/');

          if (isFile) {
            return (
              <span key={j} className="font-mono text-[11px] text-[#BC8CFF] bg-[#BC8CFF]/10 px-1.5 py-0.5 rounded border border-[#BC8CFF]/25 font-semibold">
                {tTrim}
              </span>
            );
          }

          // Check if token is a Roblox Service / System name
          const robloxServices = [
            'DataModel', 'ReplicatedStorage', 'ServerScriptService', 'ServerStorage', 
            'StarterPlayer', 'Workspace', 'Players', 'TweenService', 'RunService', 
            'HttpService', 'ProfileService', 'Knit', 'Fusion', 'CollectionService', 
            'PhysicsService', 'MarketplaceService', 'TeleportService', 'SoundService'
          ];
          if (robloxServices.includes(tTrim)) {
            return (
              <span key={j} className="font-mono text-[11px] text-[#FFC93C] bg-[#FFC93C]/10 px-1.5 py-0.5 rounded border border-[#FFC93C]/25 font-bold">
                {tTrim}
              </span>
            );
          }

          return token;
        })}
      </span>
    );
  });
}

/**
 * Returns distinct colors and styling for execution step labels.
 */
export function getStepBadgeStyle(stage: string): { bg: string; text: string; border: string; iconColor: string } {
  const lower = stage.toLowerCase();
  if (lower.includes('intent') || lower.includes('classification')) {
    return { bg: 'bg-[#58A6FF]/15', text: 'text-[#58A6FF]', border: 'border-[#58A6FF]/35', iconColor: '#58A6FF' };
  }
  if (lower.includes('context') || lower.includes('analysis') || lower.includes('read') || lower.includes('search') || lower.includes('grep')) {
    return { bg: 'bg-[#BC8CFF]/15', text: 'text-[#BC8CFF]', border: 'border-[#BC8CFF]/35', iconColor: '#BC8CFF' };
  }
  if (lower.includes('design') || lower.includes('architecture') || lower.includes('plan') || lower.includes('strategy')) {
    return { bg: 'bg-[#D29922]/15', text: 'text-[#D29922]', border: 'border-[#D29922]/35', iconColor: '#D29922' };
  }
  if (lower.includes('implement') || lower.includes('edit') || lower.includes('create') || lower.includes('code')) {
    return { bg: 'bg-[#FFC93C]/15', text: 'text-[#FFC93C]', border: 'border-[#FFC93C]/35', iconColor: '#FFC93C' };
  }
  if (lower.includes('review') || lower.includes('verify') || lower.includes('test')) {
    return { bg: 'bg-[#A5D6FF]/15', text: 'text-[#A5D6FF]', border: 'border-[#A5D6FF]/35', iconColor: '#A5D6FF' };
  }
  if (lower.includes('complete') || lower.includes('success')) {
    return { bg: 'bg-[#3FB950]/15', text: 'text-[#3FB950]', border: 'border-[#3FB950]/35', iconColor: '#3FB950' };
  }
  if (lower.includes('error') || lower.includes('fail')) {
    return { bg: 'bg-[#FF7B72]/15', text: 'text-[#FF7B72]', border: 'border-[#FF7B72]/35', iconColor: '#FF7B72' };
  }
  return { bg: 'bg-white/10', text: 'text-white/90', border: 'border-white/20', iconColor: '#FFC93C' };
}
