# Issue 02: Web AI Chatbot Dual-Resilience SQL Fallback Parity

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
Port the dual-resilience database query fallback from Mobile (`mobile/src/lib/supabase/aiAssistant.ts`) into Web (`web/src/components/ai/ChurchChatbot.tsx`).

If the Supabase Edge Function `church-ai-chat` experiences cold-start latency, network interruption, or Google Gemini HTTP 429 quota limits during the live client mock defense, the Web chatbot should automatically fall back to querying the church's:
1. `mass_schedules`
2. `sacrament_requirements`
3. `churches` contact and cashless donation numbers
4. `church_knowledge_chunks` keyword search

This guarantees 100% answer availability and zero user-visible error banners during live presentations.

---

## 2. Acceptance Criteria
- [x] `ChurchChatbot.tsx` implements local database fallback logic when the edge function invocation fails or returns an error.
- [x] TypeScript build (`npm run build` in `web/`) passes with 0 errors.
- [x] Lint check passes with 0 errors on modified files.

---

## 3. Implementation Summary & Verification

### Files Created & Modified:
1. `web/src/lib/supabase/aiFallback.ts` (Created):
   - Implemented `formatTime12` helper for standard 12-hour AM/PM schedule formatting.
   - Implemented `logChurchChat` for client audit trail logging to `church_chat_logs`.
   - Implemented `generateFallbackResponse(message, churchId, churchNameFallback)`:
     - Directly queries `churches` table for parish name, address, contact, and GCash/Maya information.
     - Performs keyword searches across `church_knowledge_chunks` and `church_knowledge_sections`.
     - Queries `mass_schedules` and groups results by day with formatted times and languages.
     - Queries `sacrament_requirements` for Baptism, Holy Matrimony, and Confirmation.
     - Provides cashless donation details (GCash/Maya numbers).
     - Returns diocesan-level fallback guidelines when no church or specific match exists.
   - Implemented `askParishAI`: Wraps `supabase.functions.invoke('church-ai-chat')` with a 12s timeout and automatic seamless failover to `generateFallbackResponse`.
2. `web/src/components/ai/ChurchChatbot.tsx` (Modified):
   - Replaced direct, brittle edge function call with `askParishAI` and dual-resilient fallback handlers.
   - Guaranteed smooth message delivery into the chat message stream with zero error banners or interrupted user sessions.
3. `web/src/types/database.ts` (Modified):
   - Added strongly-typed table schemas for `church_chat_logs`, `church_knowledge_chunks`, and `church_knowledge_sections`.
   - Exported convenience types `ChurchKnowledgeChunk`, `ChurchKnowledgeSection`, and `ChurchChatLog`.

### Validation Results:
- **Lint Check**: `npx eslint src/types/database.ts src/lib/supabase/aiFallback.ts src/components/ai/ChurchChatbot.tsx` passed with 0 errors and 0 warnings.
- **Production Build**: `npm run build` in `web/` (`tsc -b && vite build`) succeeded with 0 errors.

