-- Adding missing tables for persistent state management
CREATE TABLE IF NOT EXISTS "tasks" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "featureName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "plan" JSONB
);

CREATE TABLE IF NOT EXISTS "executions" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
  "status" TEXT NOT NULL,
  "logs" JSONB,
  "verificationStatus" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "project_states" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lastTaskId" TEXT,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS "conversation_states" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "lastTaskId" TEXT,
  "updatedAt" TEXT NOT NULL
);
