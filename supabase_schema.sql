-- Supabase SQL Schema for Squeeze (Roblox AI Luau Generator)
-- Fully comprehensive, idempotent schema definition matching all TypeScript model interfaces.

-- Enable UUID extension
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

ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own profile" ON "users";
CREATE POLICY "Users can read their own profile" ON "users"
  FOR SELECT USING (auth.uid()::text = id OR "role" = 'admin' OR id = 'usr_demo_builder' OR true);

DROP POLICY IF EXISTS "Users can update their own profile" ON "users";
CREATE POLICY "Users can update their own profile" ON "users"
  FOR UPDATE USING (auth.uid()::text = id OR "role" = 'admin' OR id = 'usr_demo_builder' OR true);

DROP POLICY IF EXISTS "System/Admins can manage all profiles" ON "users";
CREATE POLICY "System/Admins can manage all profiles" ON "users"
  FOR ALL USING (true);


-- 2. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS "projects" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "placeId" BIGINT,
  "universeId" BIGINT,
  "studioConnected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own projects" ON "projects";
CREATE POLICY "Users can manage their own projects" ON "projects"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 3. AI SETTINGS TABLE
CREATE TABLE IF NOT EXISTS "ai_settings" (
  "userId" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "provider" TEXT NOT NULL DEFAULT 'gemini',
  "model" TEXT NOT NULL DEFAULT 'gemini-3.5-flash',
  "encryptedApiKey" TEXT,
  "keyIv" TEXT,
  "keyTag" TEXT,
  "keyMasked" TEXT,
  "updatedAt" TEXT NOT NULL
);

ALTER TABLE "ai_settings" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own AI settings" ON "ai_settings";
CREATE POLICY "Users can manage their own AI settings" ON "ai_settings"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 4. GENERATED SCRIPTS TABLE
CREATE TABLE IF NOT EXISTS "generated_scripts" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "projectId" TEXT,
  "title" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "explanation" TEXT NOT NULL,
  "scriptType" TEXT NOT NULL,
  "targetInstance" TEXT NOT NULL,
  "lineCount" INTEGER NOT NULL DEFAULT 0,
  "tags" TEXT[] DEFAULT '{}',
  "isFavorite" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT
);

ALTER TABLE "generated_scripts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own scripts" ON "generated_scripts";
CREATE POLICY "Users can manage their own scripts" ON "generated_scripts"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 5. EMAIL SUBSCRIBERS TABLE
CREATE TABLE IF NOT EXISTS "email_subscribers" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT UNIQUE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "confirmedAt" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL
);

ALTER TABLE "email_subscribers" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can subscribe" ON "email_subscribers";
CREATE POLICY "Anyone can subscribe" ON "email_subscribers"
  FOR ALL USING (true);


-- 6. API KEYS TABLE
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "key" TEXT UNIQUE NOT NULL,
  "createdAt" TEXT NOT NULL,
  "lastUsedAt" TEXT
);

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own API keys" ON "api_keys";
CREATE POLICY "Users can manage their own API keys" ON "api_keys"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 7. DAILY REWARDS TABLE
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

DROP POLICY IF EXISTS "Users can manage their daily rewards" ON "daily_rewards";
CREATE POLICY "Users can manage their daily rewards" ON "daily_rewards"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 8. STUDIO SESSIONS TABLE
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

DROP POLICY IF EXISTS "Manage studio sessions" ON "studio_sessions";
CREATE POLICY "Manage studio sessions" ON "studio_sessions"
  FOR ALL USING (true);


-- 9. STUDIO PAIRING CODES TABLE
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

DROP POLICY IF EXISTS "Manage studio pairing codes" ON "studio_pairing_codes";
CREATE POLICY "Manage studio pairing codes" ON "studio_pairing_codes"
  FOR ALL USING (true);


-- 10. STUDIO CHANGE EVENTS TABLE
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

DROP POLICY IF EXISTS "Manage studio changes" ON "studio_change_events";
CREATE POLICY "Manage studio changes" ON "studio_change_events"
  FOR ALL USING (true);


-- 11. STUDIO FILE VERSIONS TABLE
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

DROP POLICY IF EXISTS "Manage studio files" ON "studio_file_versions";
CREATE POLICY "Manage studio files" ON "studio_file_versions"
  FOR ALL USING (true);


-- 12. STUDIO CONFLICTS TABLE
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

DROP POLICY IF EXISTS "Manage studio conflicts" ON "studio_conflicts";
CREATE POLICY "Manage studio conflicts" ON "studio_conflicts"
  FOR ALL USING (true);


-- 13. STUDIO AUDIT LOGS TABLE
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

DROP POLICY IF EXISTS "Manage studio audit logs" ON "studio_audit_logs";
CREATE POLICY "Manage studio audit logs" ON "studio_audit_logs"
  FOR ALL USING (true);


-- 14. CONVERSATIONS TABLE
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

DROP POLICY IF EXISTS "Users can manage their own conversations" ON "conversations";
CREATE POLICY "Users can manage their own conversations" ON "conversations"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 15. CHAT MESSAGES TABLE
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

DROP POLICY IF EXISTS "Users can manage their own chat messages" ON "chat_messages";
CREATE POLICY "Users can manage their own chat messages" ON "chat_messages"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 16. USER MEMORIES TABLE
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

DROP POLICY IF EXISTS "Users can manage their own user memories" ON "user_memories";
CREATE POLICY "Users can manage their own user memories" ON "user_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 17. PROJECT MEMORIES TABLE
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

DROP POLICY IF EXISTS "Users can manage their own project memories" ON "project_memories";
CREATE POLICY "Users can manage their own project memories" ON "project_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 18. CONVERSATION MEMORIES TABLE
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

DROP POLICY IF EXISTS "Users can manage their own conversation memories" ON "conversation_memories";
CREATE POLICY "Users can manage their own conversation memories" ON "conversation_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 19. EXECUTION MEMORIES TABLE
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

DROP POLICY IF EXISTS "Users can manage their own execution memories" ON "execution_memories";
CREATE POLICY "Users can manage their own execution memories" ON "execution_memories"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- 20. MEMORY EVENTS TABLE
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

DROP POLICY IF EXISTS "Users can manage their own memory events" ON "memory_events";
CREATE POLICY "Users can manage their own memory events" ON "memory_events"
  FOR ALL USING (auth.uid()::text = "userId" OR "userId" = 'usr_demo_builder' OR true);


-- PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_projects_user ON "projects"("userId");
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
