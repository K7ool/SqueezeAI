/**
 * Task State Management
 *
 * Persistent tasks that can be resumed across sessions.
 */

export interface TaskRecord {
  id: string;
  userId: string;
  projectId: string;
  conversationId: string;
  title: string;
  goal: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
  currentStep?: string;
  completedSteps: string[];
  pendingSteps: string[];
  failedSteps: Array<{ step: string; error: string; timestamp: string }>;
  acceptanceCriteria?: string[];
  lastCheckpoint?: any;
  lastExecutionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

import { getAdminClient } from './supabaseClient.js';
import crypto from 'crypto';

/**
 * Creates a new persistent task
 */
export async function createTask(task: Omit<TaskRecord, 'id' | 'createdAt' | 'updatedAt' | 'completedSteps' | 'pendingSteps' | 'failedSteps'>): Promise<TaskRecord> {
  const now = new Date().toISOString();
  const newTask: TaskRecord = {
    ...task,
    id: 'task_' + crypto.randomUUID().slice(0, 8),
    completedSteps: [],
    pendingSteps: [],
    failedSteps: [],
    createdAt: now,
    updatedAt: now
  };

  const supabase = getAdminClient();
  const { error } = await supabase
    .from('tasks')
    .insert([newTask]);

  if (error) {
    console.error('[Task] Failed to create task:', error);
    throw new Error(`Task creation failed: ${error.message}`);
  }

  console.log(`[Task] Created: ${newTask.id} - ${newTask.title}`);
  return newTask;
}

/**
 * Gets active task for a conversation
 */
export async function getActiveTask(conversationId: string): Promise<TaskRecord | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('conversationId', conversationId)
    .in('status', ['pending', 'in_progress', 'blocked'])
    .order('updatedAt', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
    console.error('[Task] Failed to get active task:', error);
    return null;
  }

  return data;
}

/**
 * Updates task state
 */
export async function updateTask(taskId: string, updates: Partial<TaskRecord>): Promise<TaskRecord | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from('tasks')
    .update({
      ...updates,
      updatedAt: new Date().toISOString()
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) {
    console.error('[Task] Failed to update task:', error);
    return null;
  }

  console.log(`[Task] Updated: ${taskId} - status: ${data.status}`);
  return data;
}

/**
 * Gets task by ID
 */
export async function getTaskById(taskId: string): Promise<TaskRecord | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (error) {
    console.error('[Task] Failed to get task:', error);
    return null;
  }

  return data;
}

/**
 * Lists tasks for a project/conversation
 */
export async function listTasks(filters: {
  userId?: string;
  projectId?: string;
  conversationId?: string;
  status?: TaskRecord['status'];
}): Promise<TaskRecord[]> {
  const supabase = getAdminClient();
  let query = supabase.from('tasks').select('*');

  if (filters.userId) query = query.eq('userId', filters.userId);
  if (filters.projectId) query = query.eq('projectId', filters.projectId);
  if (filters.conversationId) query = query.eq('conversationId', filters.conversationId);
  if (filters.status) query = query.eq('status', filters.status);

  const { data, error } = await query.order('updatedAt', { ascending: false });

  if (error) {
    console.error('[Task] Failed to list tasks:', error);
    return [];
  }

  return data || [];
}
