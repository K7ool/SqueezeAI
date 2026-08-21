import React, { useState } from 'react';
import { 
  Brain, FileCode, Search, Code2, Plus, RefreshCw, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Layers, Trash2
} from 'lucide-react';

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

  // Determine icon, colors, and layout type based on event type
  let icon = <Brain className="w-3.5 h-3.5 text-[#FFC93C]" />;
  let badgeColor = 'bg-[#FFC93C]/10 border-[#FFC93C]/20 text-[#FFC93C]';
  let isToolCard = false;

  const typeLower = event.type.toLowerCase();

  if (typeLower === 'reasoning') {
    icon = <Brain className="w-3.5 h-3.5 text-[#FFC93C]" />;
    badgeColor = 'text-[#FFC93C]';
    isToolCard = false;
  } else if (typeLower === 'read') {
    icon = <FileCode className="w-3.5 h-3.5 text-[#58A6FF]" />;
    badgeColor = 'bg-[#58A6FF]/10 border-[#58A6FF]/20 text-[#58A6FF]';
    isToolCard = true;
  } else if (typeLower === 'search' || typeLower === 'grep' || typeLower === 'glob') {
    icon = <Search className="w-3.5 h-3.5 text-[#A5D6FF]" />;
    badgeColor = 'bg-[#A5D6FF]/10 border-[#A5D6FF]/20 text-[#A5D6FF]';
    isToolCard = true;
  } else if (typeLower === 'edit') {
    icon = <Code2 className="w-3.5 h-3.5 text-[#BC8CFF]" />;
    badgeColor = 'bg-[#BC8CFF]/10 border-[#BC8CFF]/20 text-[#BC8CFF]';
    isToolCard = true;
  } else if (typeLower === 'create') {
    icon = <Plus className="w-3.5 h-3.5 text-[#7EE787]" />;
    badgeColor = 'bg-[#7EE787]/10 border-[#7EE787]/20 text-[#7EE787]';
    isToolCard = true;
  } else if (typeLower === 'delete') {
    icon = <Trash2 className="w-3.5 h-3.5 text-[#FF7B72]" />;
    badgeColor = 'bg-[#FF7B72]/10 border-[#FF7B72]/20 text-[#FF7B72]';
    isToolCard = true;
  } else if (typeLower === 'verification' || typeLower === 'plan' || typeLower === 'research') {
    icon = <RefreshCw className={`w-3.5 h-3.5 text-[#D29922] ${isLive && event.status === 'running' ? 'animate-spin' : ''}`} />;
    badgeColor = 'bg-[#D29922]/10 border-[#D29922]/20 text-[#D29922]';
    isToolCard = false;
  } else if (typeLower === 'success') {
    icon = <CheckCircle2 className="w-3.5 h-3.5 text-[#3FB950]" />;
    badgeColor = 'bg-[#3FB950]/10 border-[#3FB950]/20 text-[#3FB950]';
    isToolCard = false;
  } else if (typeLower === 'error') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-[#FF7B72]" />;
    badgeColor = 'bg-[#FF7B72]/10 border-[#FF7B72]/20 text-[#FF7B72]';
    isToolCard = false;
  } else if (typeLower === 'warning') {
    icon = <AlertTriangle className="w-3.5 h-3.5 text-[#D29922]" />;
    badgeColor = 'bg-[#D29922]/10 border-[#D29922]/20 text-[#D29922]';
    isToolCard = false;
  }

  const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;

  if (!isToolCard) {
    // Elegant line/row for Reasoning and non-tool execution elements
    return (
      <div className="flex items-start gap-2.5 font-mono text-xs text-white/90">
        <div className="shrink-0 mt-0.5">{icon}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-[10px] text-white/40">{event.type}</span>
            {isLive && event.status === 'running' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FFC93C] animate-ping" />
            )}
          </div>
          <p className="mt-0.5 text-white/90 leading-relaxed text-[11px]">{event.message}</p>
        </div>
      </div>
    );
  }

  // Interactive, highly polished card layout for tool actions
  return (
    <div className="border border-white/5 bg-[#0D1117] rounded-lg overflow-hidden font-mono text-xs shadow-md transition-all hover:border-white/10">
      <div 
        onClick={() => hasMetadata && setIsExpanded(!isExpanded)}
        className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none bg-gradient-to-r from-white/2 to-transparent ${hasMetadata ? 'hover:bg-white/5' : 'cursor-default'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="shrink-0">{icon}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border ${badgeColor}`}>
                {event.type}
              </span>
              {event.metadata?.filePath && (
                <span className="text-white/40 text-[10px] truncate max-w-[200px] md:max-w-[320px]">
                  {event.metadata.filePath.split(',').map(f => f.split('/').pop()).join(', ')}
                </span>
              )}
            </div>
            <p className="text-white/80 text-[11px] mt-1 leading-normal truncate">{event.message}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-2">
          {event.metadata?.duration && (
            <span className="text-[10px] text-white/30">{event.metadata.duration}ms</span>
          )}
          {hasMetadata && (
            <div className="text-white/40">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>
      </div>

      {isExpanded && hasMetadata && (
        <div className="px-4 py-3 bg-[#161B22]/60 border-t border-white/5 space-y-2 text-[11px] text-white/70 animate-fadeIn">
          {event.metadata?.filePath && (
            <div className="flex items-start gap-2">
              <span className="text-white/30 w-16 shrink-0">Path:</span>
              <span className="text-white/90 break-all select-all font-bold">{event.metadata.filePath}</span>
            </div>
          )}
          {event.metadata?.query && (
            <div className="flex items-start gap-2">
              <span className="text-white/30 w-16 shrink-0">Query:</span>
              <span className="text-white/90 bg-white/5 px-1.5 py-0.5 rounded text-blue-300 font-bold">"{event.metadata.query}"</span>
            </div>
          )}
          {event.metadata?.className && (
            <div className="flex items-start gap-2">
              <span className="text-white/30 w-16 shrink-0">Class:</span>
              <span className="text-white/90 bg-[#FFC93C]/10 border border-[#FFC93C]/20 px-1.5 py-0.5 rounded text-[#FFC93C] font-bold">
                {event.metadata.className}
              </span>
            </div>
          )}
          {event.metadata?.parentPath && (
            <div className="flex items-start gap-2">
              <span className="text-white/30 w-16 shrink-0">Parent:</span>
              <span className="text-[#58A6FF]">{event.metadata.parentPath}</span>
            </div>
          )}
          {event.metadata?.linesAdded !== undefined && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-white/30 w-16 shrink-0">Added:</span>
                <span className="text-[#3FB950] font-bold">+{event.metadata.linesAdded} lines</span>
              </div>
              {event.metadata?.linesRemoved !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30">Removed:</span>
                  <span className="text-[#FF7B72] font-bold">-{event.metadata.linesRemoved} lines</span>
                </div>
              )}
            </div>
          )}
          {event.metadata?.offset !== undefined && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-white/30 w-16 shrink-0">Offset:</span>
                <span className="text-white/90">{event.metadata.offset}</span>
              </div>
              {event.metadata?.limit !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-white/30">Limit:</span>
                  <span className="text-white/90">{event.metadata.limit}</span>
                </div>
              )}
            </div>
          )}
          {event.metadata?.properties && Object.keys(event.metadata.properties).length > 0 && (
            <div className="mt-1">
              <div className="text-white/30 mb-1">Properties:</div>
              <pre className="bg-[#0D1117] p-2 rounded text-white/90 overflow-x-auto text-[10px] leading-tight border border-white/5">
                {JSON.stringify(event.metadata.properties, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
