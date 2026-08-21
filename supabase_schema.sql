-- Supabase SQL Schema for Squeeze (Roblox AI Luau Generator)
-- Idempotent schema definition matching the TypeScript model interfaces

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "name" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "avatar" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "plan" TEXT NOT NULL DEFAULT 'free',
  "planStatus" TEXT NOT NULL DEFAULT 'active',
  "monthlyLimit" INTEGER NOT NULL DEFAULT 25,
  "usedGenerations" INTEGER NOT NULL DEFAULT 0,
  "quotaResetDate" TEXT NOT NULL,
  "stripeCustomerId" TEXT UNIQUE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

-- Enable RLS
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

-- Policies for users
CREATE POLICY "Users can read their own profile" ON "users"
  FOR SELECT USING (auth.uid()::text = id OR "role" = 'admin');

CREATE POLICY "Users can update their own profile" ON "users"
  FOR UPDATE USING (auth.uid()::text = id OR "role" = 'admin');

CREATE POLICY "System/Admins can manage all profiles" ON "users"
  FOR ALL USING ("role" = 'admin');


-- 2. GENERATED SCRIPTS
CREATE TABLE IF NOT EXISTS "generated_scripts" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "scriptType" TEXT NOT NULL,
  "targetInstance" TEXT NOT NULL,
  "lineCount" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] DEFAULT '{}',
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TEXT NOT NULL
);

ALTER TABLE "generated_scripts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own scripts" ON "generated_scripts"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 3. EMAIL SUBSCRIBERS
CREATE TABLE IF NOT EXISTS "email_subscribers" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "confirmedAt" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);

ALTER TABLE "email_subscribers" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can subscribe" ON "email_subscribers"
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view and manage subscribers" ON "email_subscribers"
  FOR ALL USING (true); -- Managed through service role or checked by admin status


-- 4. API KEYS
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "key" TEXT UNIQUE NOT NULL,
  "createdAt" TEXT NOT NULL,
  "lastUsedAt" TEXT
);

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own API keys" ON "api_keys"
  FOR ALL USING (auth.uid()::text = "userId");


-- 5. DAILY REWARDS
CREATE TABLE IF NOT EXISTS "daily_rewards" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "longestStreak" INTEGER NOT NULL DEFAULT 0,
  "totalClaims" INTEGER NOT NULL DEFAULT 0,
  "lastClaimTimestamp" BIGINT NOT NULL,
  "lastClaimedDay" INTEGER NOT NULL,
  "hasClaimedVIP" BOOLEAN NOT NULL DEFAULT false,
  "coins" INTEGER NOT NULL DEFAULT 0,
  "gems" INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE "daily_rewards" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their daily rewards" ON "daily_rewards"
  FOR ALL USING (auth.uid()::text = "userId");


-- 6. STUDIO SESSIONS
CREATE TABLE IF NOT EXISTS "studio_sessions" (
  "sessionId" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "projectId" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "placeId" BIGINT,
  "placeName" TEXT,
  "universeId" BIGINT,
  "pairingCode" TEXT NOT NULL,
  "token" TEXT UNIQUE NOT NULL,
  "status" TEXT NOT NULL,
  "connectedAt" BIGINT,
  "lastHeartbeat" BIGINT NOT NULL,
  "pluginVersion" TEXT NOT NULL,
  "clientIp" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

ALTER TABLE "studio_sessions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio sessions" ON "studio_sessions"
  FOR ALL USING (true); -- Checked and isolated at application level


-- 7. STUDIO PAIRING CODES
CREATE TABLE IF NOT EXISTS "studio_pairing_codes" (
  "code" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "projectName" TEXT NOT NULL,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "token" TEXT NOT NULL,
  "expiresAt" BIGINT NOT NULL,
  "used" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TEXT NOT NULL
);

ALTER TABLE "studio_pairing_codes" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio pairing codes" ON "studio_pairing_codes"
  FOR ALL USING (true);


-- 8. STUDIO CHANGE EVENTS
CREATE TABLE IF NOT EXISTS "studio_change_events" (
  "changeId" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "fileId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "hash" TEXT NOT NULL,
  "timestamp" BIGINT NOT NULL,
  "author" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "errorMessage" TEXT,
  "createdAt" TEXT NOT NULL
);

ALTER TABLE "studio_change_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio changes" ON "studio_change_events"
  FOR ALL USING (true);


-- 9. STUDIO FILE VERSIONS
CREATE TABLE IF NOT EXISTS "studio_file_versions" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "className" TEXT NOT NULL,
  "parentPath" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "hash" TEXT NOT NULL,
  "updatedAt" BIGINT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  UNIQUE("projectId", "path")
);

ALTER TABLE "studio_file_versions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio files" ON "studio_file_versions"
  FOR ALL USING (true);


-- 10. STUDIO CONFLICTS
CREATE TABLE IF NOT EXISTS "studio_conflicts" (
  "conflictId" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "fileId" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "websiteVersion" INTEGER NOT NULL,
  "websiteSource" TEXT NOT NULL,
  "websiteUpdatedAt" BIGINT NOT NULL,
  "studioVersion" INTEGER NOT NULL,
  "studioSource" TEXT NOT NULL,
  "studioUpdatedAt" BIGINT NOT NULL,
  "detectedAt" BIGINT NOT NULL,
  "status" TEXT NOT NULL,
  "resolution" TEXT,
  "resolvedAt" BIGINT
);

ALTER TABLE "studio_conflicts" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio conflicts" ON "studio_conflicts"
  FOR ALL USING (true);


-- 11. STUDIO AUDIT LOGS
CREATE TABLE IF NOT EXISTS "studio_audit_logs" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "sessionId" TEXT,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "type" TEXT NOT NULL,
  "author" TEXT NOT NULL,
  "details" TEXT NOT NULL,
  "metadata" JSONB,
  "timestamp" BIGINT NOT NULL
);

ALTER TABLE "studio_audit_logs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manage studio audit logs" ON "studio_audit_logs"
  FOR ALL USING (true);


-- 12. CONVERSATIONS
CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "lastMessageAt" TEXT NOT NULL,
  "messageCount" INTEGER NOT NULL DEFAULT 0,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "tags" TEXT[] DEFAULT '{}'
);

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversations" ON "conversations"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 13. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL,
  "thinkingSteps" JSONB,
  "changePlan" JSONB,
  "codeReview" JSONB,
  "actionPerformed" JSONB,
  "filesGenerated" JSONB,
  "suggestedPrompts" TEXT[] DEFAULT '{}',
  "executionId" TEXT,
  "executionDetails" JSONB
);

ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own chat messages" ON "chat_messages"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 14. USER MEMORIES
CREATE TABLE IF NOT EXISTS "user_memories" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "confidence" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "user_memories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own user memories" ON "user_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 15. PROJECT MEMORIES
CREATE TABLE IF NOT EXISTS "project_memories" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "projectName" TEXT,
  "gameType" TEXT,
  "architecture" TEXT,
  "majorSystems" TEXT[] DEFAULT '{}',
  "services" TEXT[] DEFAULT '{}',
  "frameworks" TEXT[] DEFAULT '{}',
  "dataSystem" TEXT,
  "UIFramework" TEXT,
  "commandSystem" TEXT,
  "permissionSystem" TEXT,
  "knownProblems" TEXT[] DEFAULT '{}',
  "importantFiles" TEXT[] DEFAULT '{}',
  "learnedConventions" JSONB DEFAULT '{}'::jsonb,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "lastVerifiedAt" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE "project_memories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own project memories" ON "project_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 16. CONVERSATION MEMORIES
CREATE TABLE IF NOT EXISTS "conversation_memories" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "currentFeature" TEXT,
  "currentProblem" TEXT,
  "importantDecisions" TEXT[] DEFAULT '{}',
  "relevantFiles" TEXT[] DEFAULT '{}',
  "recentOperations" TEXT[] DEFAULT '{}',
  "openIssues" TEXT[] DEFAULT '{}',
  "userIntent" TEXT,
  "recentObjects" JSONB,
  "updatedAt" TEXT NOT NULL
);

ALTER TABLE "conversation_memories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own conversation memories" ON "conversation_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 17. EXECUTION MEMORIES
CREATE TABLE IF NOT EXISTS "execution_memories" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "request" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "planSummary" TEXT,
  "toolsUsed" TEXT[] DEFAULT '{}',
  "filesChanged" TEXT[] DEFAULT '{}',
  "instancesChanged" TEXT[] DEFAULT '{}',
  "errors" JSONB DEFAULT '[]'::jsonb,
  "verificationStatus" TEXT NOT NULL,
  "finalStatus" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL
);

ALTER TABLE "execution_memories" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own execution memories" ON "execution_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- 18. MEMORY EVENTS
CREATE TABLE IF NOT EXISTS "memory_events" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "projectId" TEXT,
  "memoryType" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "key" TEXT,
  "details" TEXT NOT NULL,
  "timestamp" TEXT NOT NULL
);

ALTER TABLE "memory_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own memory events" ON "memory_events"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder');


-- CREATE OPTIMIZING INDEXES FOR SPEED AND INTEGRITY
CREATE INDEX IF NOT EXISTS idx_scripts_user ON "generated_scripts"("userId");
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON "api_keys"("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_project ON "studio_sessions"("projectId");
CREATE INDEX IF NOT EXISTS idx_changes_project ON "studio_change_events"("projectId");
CREATE INDEX IF NOT EXISTS idx_files_project ON "studio_file_versions"("projectId");
CREATE INDEX IF NOT EXISTS idx_conversations_user ON "conversations"("userId");
CREATE INDEX IF NOT EXISTS idx_conversations_project ON "conversations"("projectId");
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON "chat_messages"("conversationId");
CREATE INDEX IF NOT EXISTS idx_user_memories_user ON "user_memories"("userId");
CREATE INDEX IF NOT EXISTS idx_project_memories_project ON "project_memories"("projectId");
CREATE INDEX IF NOT EXISTS idx_conv_memories_conv ON "conversation_memories"("conversationId");
CREATE INDEX IF NOT EXISTS idx_exec_memories_user ON "execution_memories"("userId");
CREATE INDEX IF NOT EXISTS idx_memory_events_user ON "memory_events"("userId");
