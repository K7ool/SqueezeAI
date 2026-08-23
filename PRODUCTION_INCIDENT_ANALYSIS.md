# Production Incident Analysis - Squeeze Agent Architecture
**Date**: 2026-08-23  
**Severity**: Critical  
**Status**: Under Investigation → Fixing

---

## Executive Summary

Squeeze Agent is experiencing **critical persistence failures** across multiple layers, causing:
- Lost conversations after browser refresh
- Lost task state after server restart
- Failed Studio operations appearing as "successful"
- Agent unable to resume work ("كمل" creates new task instead of continuing)

**Root Cause**: Architecture relies on ephemeral filesystem + in-memory state instead of durable database persistence.

---

## Critical Failures Identified

### 1. Supabase Configuration Failure ✗
**Symptom**: `Supabase Write FAILED - Invalid API key`

**Root Cause**:
```typescript
// server/supabase.ts:84
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
```
- Fallback chain masks actual configuration errors
- `.env.example` contains mismatched project keys
- No `.env` file exists locally
- Vercel environment variables may not be set correctly

**Impact**: ALL database writes fail silently → data loss

---

### 2. Vercel Filesystem Persistence ✗
**Symptom**: `EROFS: read-only file system, open '/var/task/data/squeeze_db.json'`

**Root Cause**:
```typescript
// server/db.ts:838-847
function saveDb(data: DatabaseSchema) {
  memoryDb = data;
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Squeeze DB] Saved in-memory cache:', err); // ← Silent failure
  }
}
```

**Impact**: 
- Production writes to `/var/task/data/squeeze_db.json` fail
- System logs "Saved in-memory cache" → misleading success
- Data lost on cold start / deployment / crash

---

### 3. Silent In-Memory Fallback ✗
**Symptom**: System appears to work, but data disappears

**Root Cause**: No distinction between:
- "Data persisted to database" (durable)
- "Data saved in memory" (ephemeral)

**Impact**: User believes data is saved, but it's not durable

---

### 4. Conversation Persistence ✗
**Symptom**: `GET /api/conversations/conv_229d8c83/messages` returns 0 messages

**Root Cause Flow**:
```
POST /api/chat
  ↓
db.createConversation() // Writes to memory
  ↓
syncUpsert('conversations', conv) // Attempts Supabase write → FAILS
  ↓
saveDb(data) // Attempts fs.writeFileSync → FAILS on Vercel
  ↓
Silent return (data only in memoryDb)
  ↓
Server restart / cold start
  ↓
memoryDb = null
  ↓
GET /api/conversations/:id/messages → 0 results
```

**Impact**: Conversations don't persist across restarts

---

### 5. Studio Session Authentication ✗
**Symptom**: `POST /api/studio/heartbeat` returns `401 Unauthorized`

**Requires Investigation**: 
- Auth middleware for Studio endpoints
- Token validation
- Session expiry logic

---

### 6. /api/chat Execution Timeout ✗
**Symptom**: Long executions timeout on Vercel (10s serverless limit)

**Root Cause**:
```typescript
// server/app.ts:837
app.post('/api/chat', async (req, res) => {
  // ... entire agent execution happens here ...
  // ← HTTP request waits for complete execution
  res.json({ response }); // ← Only responds after ALL work done
});
```

**Impact**:
- Complex tasks timeout before completion
- No way to resume partial work
- Frontend hangs waiting for response

---

### 7. No Task Continuity ✗
**Symptom**: User says "كمل" → Agent starts new task instead of resuming

**Root Cause**: 
- No `tasks` table/state in database
- No active task resolution in `/api/chat`
- No checkpoint/resume mechanism

---

### 8. No Execution State Persistence ✗
**Symptom**: Execution events lost after server restart

**Root Cause**:
```typescript
// server/executionService.ts (in-memory event bus)
executionEventBus.on(eventName, handleEvent); // ← Events only in memory
```

**Impact**: 
- Cannot resume executions
- Cannot recover from timeout
- SSE reconnection shows no history

---

## Architecture Flaws

### Current (Broken):
```
User Request
  ↓
HTTP Handler (/api/chat)
  ↓
In-Memory State (memoryDb)
  ↓
Attempt fs.write (fails on Vercel)
  ↓
Attempt Supabase sync (fails - invalid key)
  ↓
Silent failure → data lost
```

### Required (Durable):
```
User Request
  ↓
Validate Config (fail-fast if DB unavailable)
  ↓
Write to Database FIRST (Supabase/Postgres)
  ↓
Verify write succeeded
  ↓
Update in-memory cache (optional optimization)
  ↓
Return success only if DB write confirmed
```

---

## Fix Priority Order

### Phase 1: Critical Infrastructure (Blocking Everything)
1. ✗ Fix Supabase configuration (central service, fail-fast)
2. ✗ Remove filesystem persistence completely
3. ✗ Make database writes synchronous + verified
4. ✗ Add startup validation (fail if DB unreachable)

### Phase 2: Persistence Layer
5. ✗ Fix conversation/message persistence
6. ✗ Fix Studio session persistence
7. ✗ Add execution state table
8. ✗ Add task state table

### Phase 3: Execution Architecture
9. ✗ Decouple /api/chat from long execution
10. ✗ Add execution worker/queue
11. ✗ Add checkpoint/resume capability
12. ✗ Make SSE stream durable

### Phase 4: Agent Intelligence
13. ✗ Add task continuity ("كمل" detection)
14. ✗ Add project state/memory
15. ✗ Add change ledger
16. ✗ Studio verification integration

---

## Success Criteria

### Must Pass Before "Fixed":
- [ ] Supabase writes succeed in production
- [ ] No filesystem writes in production code
- [ ] Conversations persist across server restart
- [ ] Messages persist across server restart
- [ ] Studio sessions persist across server restart
- [ ] Active task persists across server restart
- [ ] Execution state recoverable after timeout
- [ ] "كمل" resumes correct task
- [ ] Browser refresh recovers full state
- [ ] No silent failures (all errors visible)
- [ ] Health check reports actual DB status

---

## Testing Protocol

### After Each Fix:
1. Deploy to production
2. Create conversation
3. Send message
4. Verify message in database (direct query)
5. Restart server/trigger cold start
6. GET /api/conversations/:id/messages
7. Verify messages returned

### Final Integration Test:
1. User sends "Build inventory system"
2. Task created in database
3. Agent begins work
4. Refresh browser → state recovers
5. Server restarts → state recovers
6. User sends "كمل" → same task continues
7. Tool execution fails → error visible
8. Studio disconnects → execution pauses safely

---

## Next Steps

Starting with Task #1: Fix Supabase configuration
- Create central supabase service with validation
- Remove fallback chains
- Add fail-fast on missing/invalid credentials
- Verify in production

---

**Status**: Analysis complete. Beginning systematic fix.
