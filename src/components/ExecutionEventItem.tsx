import React, { useState } from 'react';
import { 
  Brain, FileCode, Search, Code2, Plus, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Layers, Trash2
} from 'lucide-react';
import { renderHighlightedText, getStepBadgeStyle } from '../utils/textHighlighter';

export interface ExecutionEvent {
  type: string; // Reasoning, Read, Search, Grep, Glob, Edit, Create, Delete, Rename, Move, Tool, Research, Plan, Verification, Warning, Error, Success
  timestamp: number;
  message: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  metadata?: {
    filePath?: string;
    linesAdded?: number;
    linesRemoved?: number;
    diff?: string;
    offset?: number;
    limit?: number;
    query?: string;
    duration?: number;
    className?: string;
    parentPath?: string;
    properties?: any;
    size?: string;
  };
  toolName?: string;
  filePath?: string;
  duration?: number;
  executionId: string;
}

interface ExecutionEventItemProps {
  event: ExecutionEvent;
  isLive?: boolean;
}

export const ExecutionEventItem: React.FC<ExecutionEventItemProps> = ({ event, isLive }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const stepStyle = getStepBadgeStyle(event.type);

  // Determine status-based icon & color
  let statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950]" />;
  if (event.status === 'running' || event.status === 'pending') {
    statusIcon = <RefreshCw className="w-3.5 h-3.5 text-[#D29922] animate-spin" />;
  } else if (event.status === 'failed' || event.type.toLowerCase() === 'error') {
    statusIcon = <AlertTriangle className="w-3.5 h-3.5 text-[#FF7B72]" />;
  } else if (event.status === 'completed' || event.type.toLowerCase() === 'success') {
    statusIcon = <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950]" />;
  }

  // Determine icon based on event type
  let isToolCard = false;
  const typeLower = event.type.toLowerCase();

  if (typeLower === 'reasoning' || typeLower === 'plan' || typeLower === 'research') {
    isToolCard = false;
  } else if (typeLower === 'read' || typeLower === 'search' || typeLower === 'grep' || typeLower === 'glob' || typeLower === 'edit' || typeLower === 'create' || typeLower === 'delete') {
    isToolCard = true;
  } else if (typeLower === 'verification' || typeLower === 'success' || typeLower === 'error' || typeLower === 'warning') {
    isToolCard = false;
  }

  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  if (!isToolCard) {
    // Elegant line/row for Reasoning and non-tool execution elements
    return (
      <div className="flex items-start gap-2.5 font-mono text-xs text-white/90 py-1.5 border-l-2 pl-2.5 my-1" style={{ borderColor: stepStyle.iconColor }}>
        <div className="shrink-0 mt-0.5">{statusIcon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${stepStyle.bg} ${stepStyle.text} ${stepStyle.border}`}>
              {event.type}
            </span>
            {isLive && event.status === 'running' && (
              <span className="w-2 h-2 rounded-full bg-[#FFC93C] animate-ping" />
            )}
          </div>
          <div className="mt-1 text-white/90 leading-relaxed text-[11px]">
            {renderHighlightedText(event.message)}
          </div>
        </div>
      </div>
    );
  }

  // Interactive, highly polished card layout for tool actions
  return (
    <div className="border border-white/10 bg-[#0D1117] rounded-lg overflow-hidden font-mono text-xs shadow-md transition-all hover:border-white/20 my-1.5">
      <div 
        onClick={() => hasMetadata && setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none bg-gradient-to-r from-white/3 to-transparent ${hasMetadata ? 'hover:bg-white/5' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">{statusIcon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider border ${stepStyle.bg} ${stepStyle.text} ${stepStyle.border}`}>
                {event.type}
              </span>
              {event.metadata?.filePath && (
                <span className="font-mono text-[11px] text-[#BC8CFF] bg-[#BC8CFF]/10 px-1.5 py-0.5 rounded border border-[#BC8CFF]/25 truncate max-w-[240px]">
                  {event.metadata.filePath}
                </span>
              )}
            </div>
            <div className="text-white/90 text-[11px] mt-1 leading-normal truncate">
              {renderHighlightedText(event.message)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pl-2">
          {event.metadata?.duration && (
            <span className="text-[10px] text-white/40">{event.metadata.duration}ms</span>
          )}
          {hasMetadata && (
            <div className="text-white/40">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>
      </div>

      {isExpanded && hasMetadata && (
        <div className="px-4 py-3 bg-[#161B22]/80 border-t border-white/10 space-y-2 text-[11px] text-white/80 animate-fadeIn">
          {event.metadata?.filePath && (
            <div className="flex items-start gap-2">
              <span className="text-white/40 w-20 shrink-0 font-bold">File Path:</span>
              <span className="font-mono text-[#BC8CFF] break-all select-all">{event.metadata.filePath}</span>
            </div>
          )}
          {event.metadata?.query && (
            <div className="flex items-start gap-2">
              <span className="text-white/40 w-20 shrink-0 font-bold">Query:</span>
              <span className="font-mono text-[#58A6FF] break-all">{event.metadata.query}</span>
            </div>
          )}
          {event.metadata?.className && (
            <div className="flex items-start gap-2">
              <span className="text-white/40 w-20 shrink-0 font-bold">Class:</span>
              <span className="text-white/90 bg-[#FFC93C]/10 border border-[#FFC93C]/20 px-1.5 py-0.5 rounded text-[#FFC93C] font-bold">
                {event.metadata.className}
              </span>
            </div>
          )}
          {event.metadata?.parentPath && (
            <div className="flex items-start gap-2">
              <span className="text-white/40 w-20 shrink-0 font-bold">Parent:</span>
              <span className="font-mono text-[#58A6FF]">{event.metadata.parentPath}</span>
            </div>
          )}
          {event.metadata?.linesAdded !== undefined && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-white/40 w-20 shrink-0 font-bold">Added:</span>
                <span className="text-[#3FB950] font-bold">+{event.metadata.linesAdded} lines</span>
              </div>
              {event.metadata?.linesRemoved !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-white/40 font-bold">Removed:</span>
                  <span className="text-[#FF7B72] font-bold">-{event.metadata.linesRemoved} lines</span>
                </div>
              )}
            </div>
          )}
          {event.metadata?.diff && (
            <div className="space-y-1 pt-1">
              <span className="text-white/40 font-bold">Diff / Changes:</span>
              <pre className="bg-[#080d1a] p-2.5 rounded font-mono text-[10px] text-green-300 overflow-x-auto border border-white/10 max-h-40">
                {event.metadata.diff}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
