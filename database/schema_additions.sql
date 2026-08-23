-- Squeeze Database Schema for Supabase
-- Version: 1.5.0
-- Created: 2026-08-23
-- Description: Complete schema for persistent Agent architecture

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TASKS TABLE (Agent Task Continuity)
-- ============================================================
create table if not exists tasks (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  project_id text not null,
  conversation_id text not null references conversations(id) on delete cascade,
  title text not null,
  goal text not null,
  status text not null check (status in ('pending', 'in_progress', 'completed', 'failed', 'blocked')),
  current_step text,
  completed_steps jsonb default '[]'::jsonb,
  pending_steps jsonb default '[]'::jsonb,
  failed_steps jsonb default '[]'::jsonb,
  acceptance_criteria jsonb,
  last_checkpoint jsonb,
  last_execution_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tasks_conversation on tasks(conversation_id);
create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_user_project on tasks(user_id, project_id);

-- ============================================================
-- EXECUTIONS TABLE (Execution Lifecycle)
-- ============================================================
create table if not exists executions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  project_id text not null,
  conversation_id text not null references conversations(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  status text not null check (status in ('queued', 'running', 'waiting_for_tool', 'waiting_for_studio', 'completed', 'failed', 'timeout')),
  current_stage text,
  last_successful_tool text,
  pending_tool text,
  checkpoint jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_executions_conversation on executions(conversation_id);
create index if not exists idx_executions_task on executions(task_id);
create index if not exists idx_executions_status on executions(status);

-- ============================================================
-- EXECUTION_EVENTS TABLE (Event Store for SSE)
-- ============================================================
create table if not exists execution_events (
  id text primary key,
  execution_id text not null references executions(id) on delete cascade,
  type text not null,
  message text not null,
  status text not null,
  data jsonb,
  timestamp timestamptz not null default now()
);

create index if not exists idx_execution_events_execution on execution_events(execution_id, timestamp);

-- ============================================================
-- PROJECT_SNAPSHOTS TABLE (Project State Memory)
-- ============================================================
create table if not exists project_snapshots (
  id text primary key,
  project_id text not null,
  studio_session_id text,
  timestamp timestamptz not null default now(),
  tree_hash text,
  script_hashes jsonb,
  systems jsonb,
  errors jsonb
);

create index if not exists idx_project_snapshots_project on project_snapshots(project_id, timestamp desc);

-- ============================================================
-- CHANGE_LEDGER TABLE (All Studio Changes)
-- ============================================================
create table if not exists change_ledger (
  id text primary key,
  task_id text references tasks(id) on delete set null,
  execution_id text references executions(id) on delete set null,
  project_id text not null,
  operation text not null,
  target text not null,
  before_state jsonb,
  after_state jsonb,
  studio_confirmed boolean default false,
  verified boolean default false,
  timestamp timestamptz not null default now()
);

create index if not exists idx_change_ledger_task on change_ledger(task_id);
create index if not exists idx_change_ledger_project on change_ledger(project_id, timestamp desc);

-- ============================================================
-- TOOL_CALLS TABLE (Tool Execution History)
-- ============================================================
create table if not exists tool_calls (
  id text primary key,
  execution_id text not null references executions(id) on delete cascade,
  task_id text references tasks(id) on delete set null,
  tool_name text not null,
  arguments jsonb not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed')),
  result jsonb,
  error text,
  timestamp timestamptz not null default now()
);

create index if not exists idx_tool_calls_execution on tool_calls(execution_id, timestamp);
create index if not exists idx_tool_calls_task on tool_calls(task_id);

-- ============================================================
-- UPDATE TRIGGERS
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_tasks_updated_at before update on tasks
  for each row execute function update_updated_at_column();

create trigger update_executions_updated_at before update on executions
  for each row execute function update_updated_at_column();

-- ============================================================
-- RLS POLICIES (Row Level Security)
-- ============================================================
alter table tasks enable row level security;
alter table executions enable row level security;
alter table execution_events enable row level security;
alter table project_snapshots enable row level security;
alter table change_ledger enable row level security;
alter table tool_calls enable row level security;

-- Service role can access everything
create policy "Service role has full access to tasks" on tasks
  for all using (true);

create policy "Service role has full access to executions" on executions
  for all using (true);

create policy "Service role has full access to execution_events" on execution_events
  for all using (true);

create policy "Service role has full access to project_snapshots" on project_snapshots
  for all using (true);

create policy "Service role has full access to change_ledger" on change_ledger
  for all using (true);

create policy "Service role has full access to tool_calls" on tool_calls
  for all using (true);
