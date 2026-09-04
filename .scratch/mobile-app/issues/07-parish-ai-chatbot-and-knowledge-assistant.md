# Issue 07: Parishioner AI Chatbot & Knowledge Assistant

Type: task  
Status: ready-for-agent  
Blocked by: 02  

---

## 1. Description
Build the mobile in-app Parishioner AI Chatbot connected to the Supabase pgvector embedding store and Gemini backend to provide instant, 24/7 answers regarding parish requirements, mass times, and diocesan guidelines.

---

## 2. Acceptance Criteria
- [ ] Floating Action Button (FAB) or dedicated header button to open the AI Chatbot modal from anywhere in the app.
- [ ] Chatbot interface with typing indicators, Markdown formatting for answers, and suggested quick questions ("What are the requirements for Baptism?", "When is the next Sunday Mass?").
- [ ] Integration with Supabase Edge Function `church-assistant` (or direct vector search query against `church_knowledge_chunks`).
- [ ] Audit trail logging to `church_chat_logs`.

---

## 3. Implementation Steps
1. Create `mobile/src/components/ai/ParishionerChatbotModal.tsx`.
2. Implement streaming or async API client calling the backend church assistant.
3. Add markdown response renderer (`react-native-markdown-display` or custom styled blocks).
