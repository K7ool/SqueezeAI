/**
 * Execution State Management
 *
 * Persistent execution events and checkpoints for resumable operations.
 */

export interface ExecutionRecord {
  id: string;
  userId: string;
  projectId: string;
  conversationId: string;
  taskId?: string;
  status: 'queued' | 'running' | 'waiting_for_tool' | 'waiting_for_studio' | 'completed' | 'failed' | 'timeout';
  currentStage?: string;
  lastSuccessfulTool?: string;
  pendingTool?: string;
  checkpoint?: any;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ExecutionEventRecord {
  id: string;
  executionId: string;
  type: string;
  message: string;
  status: string;
  data?: any;
  timestamp: string;
}

import { getAdminClient } from './supabaseClient.js';
import crypto from 'crypto';

/**
 * Creates a new execution
 */
export async function createExecution(exec: Omit<ExecutionRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExecutionRecord> {
  const now = new Date().toISOString();
  const newExec: ExecutionRecord = {
    ...exec,
    id: exec.id || ('exec_' + Date.now()),
    createdAt: now,
    updatedAt: now
  };

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('executions')
    .insert([newExec]);

  if (error) {
    console.error('[Execution] Failed to create:', error);
    throw new Error(`Execution creation failed: ${error.message}`);
  }

  console.log(`[Execution] Created: ${newExec.id}`);
  return newExec;
}

/**
 * Updates execution state
 */
export async function updateExecution(executionId: string, updates: Partial<ExecutionRecord>): Promise<ExecutionRecord | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('executions')
    .update({
      ...updates,
      updatedAt: new Date().toISOString()
    })
    .eq('id', executionId)
    .select()
    .single();

  if (error) {
    console.error('[Execution] Failed to update:', error);
    return null;
  }

  return data;
}

/**
 * Persists an execution event
 */
export async function saveExecutionEvent(event: Omit<ExecutionEventRecord, 'id' | 'timestamp'>): Promise<ExecutionEventRecord> {
  const now = new Date().toISOString();
  const newEvent: ExecutionEventRecord = {
    ...event,
    id: 'evt_' + crypto.randomUUID().slice(0, 12),
    timestamp: now
  };

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('execution_events')
    .insert([newEvent]);

  if (error) {
    console.error('[Execution] Failed to save event:', error);
    // Don't throw - events are best-effort
  }

  return newEvent;
}

/**
 * Gets execution events (for SSE reconnection)
 */
export async function getExecutionEvents(executionId: string, limit = 100): Promise<ExecutionEventRecord[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('execution_events')
    .select('*')
    .eq('executionId', executionId)
    .order('timestamp', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[Execution] Failed to get events:', error);
    return [];
  }

  return data || [];
}

/**
 * Gets execution by ID
 */
export async function getExecutionById(executionId: string): Promise<ExecutionRecord | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('executions')
    .select('*')
    .eq('id', executionId)
    .single();

  if (error) {
    console.error('[Execution] Failed to get execution:', error);
    return null;
  }

  return data;
}
