import { EventEmitter } from 'events';

class ExecutionEventBus extends EventEmitter {}
export const executionEventBus = new ExecutionEventBus();

export interface ExecutionEvent {
  type: string; // 'Reasoning' | 'Read' | 'Search' | 'Grep' | 'Glob' | 'Edit' | 'Create' | 'Delete' | 'Rename' | 'Move' | 'Tool' | 'Research' | 'Plan' | 'Verification' | 'Warning' | 'Error' | 'Success'
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

// Stores historical execution traces for persistence so they can be reopened
const executionHistories = new Map<string, ExecutionEvent[]>();

export function emitExecutionEvent(
  executionId: string, 
  event: Omit<ExecutionEvent, 'executionId' | 'timestamp'>
) {
  const fullEvent: ExecutionEvent = {
    ...event,
    timestamp: Date.now(),
    executionId,
  };

  // Add to history
  const history = executionHistories.get(executionId) || [];
  history.push(fullEvent);
  executionHistories.set(executionId, history);

  // Emit event via event bus
  executionEventBus.emit(`event:${executionId}`, fullEvent);
}

export function getExecutionHistory(executionId: string): ExecutionEvent[] {
  return executionHistories.get(executionId) || [];
}
