# Issue 07: Parishioner AI Chatbot & Knowledge Assistant

Type: task  
Status: resolved  
Blocked by: 02  

---

## 1. Description
Build the mobile in-app Parishioner AI Chatbot connected to the Supabase pgvector embedding store and Gemini backend to provide instant, 24/7 answers regarding parish requirements, mass times, and diocesan guidelines.

---

## 2. Acceptance Criteria
- [x] Floating Action Button (FAB) or dedicated header button to open the AI Chatbot modal from anywhere in the app.
- [x] Chatbot interface with typing indicators, Markdown formatting for answers, and suggested quick questions ("What are the requirements for Baptism?", "When is the next Sunday Mass?").
- [x] Integration with Supabase Edge Function `church-ai-chat` (with robust structured diocesan & parish knowledge base fallback).
- [x] Audit trail logging to `church_chat_logs`.

---

## 3. Implementation Steps
1. Create `mobile/src/components/ai/ParishionerChatbotModal.tsx`.
2. Implement streaming or async API client calling the backend church assistant.
3. Add markdown response renderer (`react-native-markdown-display` or custom styled blocks).

---

## 4. Resolution
- **AI Assistant API Client & Failover Layer** (`mobile/src/lib/supabase/aiAssistant.ts`):
  - Created `askParishAIAssistant` calling Supabase Edge Function `church-ai-chat` with `churchId`, `message`, and `conversationHistory`.
  - Implemented structured fallback engine retrieving live parish info (`churches`), mass schedules (`mass_schedules`), sacrament requirements (`sacrament_requirements`), and knowledge chunks (`church_knowledge_chunks`).
  - Implemented audit trail logging via `logChurchChat` recording interactions to `church_chat_logs` (`user_id`, `church_id`, `question`, `answer`).
- **In-App Parishioner AI Chatbot Modal** (`mobile/src/components/ai/ParishionerChatbotModal.tsx`):
  - Built full Catholic knowledge assistant modal with active parish switcher and general diocesan mode.
  - Implemented quick suggestion prompt pills (Baptism requirements, Sunday Mass times, cashless donations, confirmation eligibility, wedding requirements).
  - Designed user vs. assistant bubbles with Sacred Gold spark badges, verified parish knowledge citation badges, and timestamp formatting.
  - Implemented hardware-accelerated animated bouncing dots typing indicator.
  - Built custom Markdown renderer handling bold text, italics, and gold bullet points.
- **Floating Action Button** (`mobile/src/components/ai/AIAssistantFAB.tsx`):
  - Created FAB with Sacred Gold (`#F59E0B`) spark icon (`Sparkles`), gold ring styling, and subtle breathing animation.
- **Screen Integration**:
  - Embedded `AIAssistantFAB` in `mobile/app/(tabs)/explore/index.tsx`.
  - Embedded `AIAssistantFAB` and "Ask Parish AI Assistant" action card in `mobile/app/church/[id].tsx`.
- **Static Verification**:
  - `npx tsc --noEmit` passed with 0 errors.
  - `npx expo export --platform android` succeeded with complete Hermes bytecode compilation (`entry-*.hbc`).
