import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getSupabaseClient } from './supabase.js';

// Load environment variables
dotenv.config();

const DB_FILE = path.join(process.cwd(), 'data', 'squeeze_db.json');

async function runMigration() {
  console.log('🚀 Starting Squeeze DB Migration to Supabase...');
  
  if (!fs.existsSync(DB_FILE)) {
    console.log('⚠️ Squeeze DB JSON file not found at:', DB_FILE);
    console.log('Nothing to migrate. Exiting.');
    return;
  }

  let dbData: any;
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    dbData = JSON.parse(raw);
    console.log('✅ Successfully loaded local database squeeze_db.json.');
  } catch (err) {
    console.error('❌ Failed to read or parse local database JSON file:', err);
    process.exit(1);
  }

  const supabase = getSupabaseClient(true); // privileged server-side access

  // Idempotent table helper
  async function migrateTable(
    tableName: string,
    records: any[],
    pkField: string,
    transformFn: (item: any) => any = (item) => item
  ) {
    if (!records || records.length === 0) {
      console.log(`ℹ️ Table [${tableName}] has 0 records. Skipping.`);
      return;
    }

    console.log(`📦 Migrating [${tableName}] (${records.length} records in queue)...`);

    const BATCH_SIZE = 50;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batchRaw = records.slice(i, i + BATCH_SIZE);
      const batchTransformed = batchRaw.map(transformFn);

      const { error } = await supabase
        .from(tableName)
        .upsert(batchTransformed, { onConflict: pkField });

      if (error) {
        console.error(`❌ Error migrating batch [${i} to ${i + batchRaw.length}] in [${tableName}]:`, error);
      } else {
        console.log(`   └─ Successfully upserted batch [${i + 1} - ${Math.min(i + BATCH_SIZE, records.length)}]`);
      }
    }
  }

  try {
    // 1. Users
    await migrateTable('users', dbData.users, 'id');

    // 2. Daily Rewards (depend on users)
    await migrateTable('daily_rewards', dbData.dailyRewards, 'userId');

    // 3. Email Subscribers
    await migrateTable('email_subscribers', dbData.subscribers, 'id');

    // 4. API Keys
    await migrateTable('api_keys', dbData.apiKeys, 'id');

    // 5. Generated Scripts
    await migrateTable('generated_scripts', dbData.scripts, 'id');

    // 6. Studio Sessions
    await migrateTable('studio_sessions', dbData.studioSessions, 'sessionId');

    // 7. Studio Pairing Codes
    await migrateTable('studio_pairing_codes', dbData.studioPairingCodes, 'code');

    // 8. Studio Change Events
    await migrateTable('studio_change_events', dbData.studioChanges, 'changeId');

    // 9. Studio File Versions
    await migrateTable('studio_file_versions', dbData.studioFiles, 'id');

    // 10. Studio Conflicts
    await migrateTable('studio_conflicts', dbData.studioConflicts, 'conflictId');

    // 11. Studio Audit Logs
    await migrateTable('studio_audit_logs', dbData.studioAuditLogs, 'id');

    // 12. Conversations
    await migrateTable('conversations', dbData.conversations, 'id');

    // 13. Chat Messages (depend on conversations)
    await migrateTable('chat_messages', dbData.messages, 'id');

    // 14. User Memories
    await migrateTable('user_memories', dbData.userMemories, 'id');

    // 15. Project Memories
    await migrateTable('project_memories', dbData.projectMemories, 'id');

    // 16. Conversation Memories
    await migrateTable('conversation_memories', dbData.conversationMemories, 'id');

    // 17. Execution Memories
    await migrateTable('execution_memories', dbData.executionMemories, 'id');

    // 18. Memory Events
    await migrateTable('memory_events', dbData.memoryEvents, 'id');

    console.log('🎉 Squeeze DB Migration to Supabase Completed Successfully!');
  } catch (err) {
    console.error('❌ Unexpected fatal error during migration:', err);
    process.exit(1);
  }
}

runMigration();
