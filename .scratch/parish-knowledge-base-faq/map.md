# Map: Parish Knowledge Base & FAQ Synergy with AI Assistant

Spec: `spec.md` (decisions locked 2026-10-25). Tickets in `issues/`.  
Branch: `feature/parish-knowledge-base-faq` (cut from `main`), merged to `main`, released via gate to `feature/demo-mode`.  
Adheres to the Sacralink Design System (`AGENTS.md`) and Issue Tracker conventions (`docs/agents/issue-tracker.md`).

---

## Dependency Graph

```
01 (Knowledge Sync & Precedence) ────┐
                                    ├───► 03 (AI Scribe & Starter FAQs)
02 (Pre-Save Discrepancy Linter) ───┘         │
                                              ▼
04 (Public FAQ Accordion & Deep Link) ───► 05 (Inquiry Insights & Self-Learning FAQ)
```

- **01** (Sync & Precedence) and **02** (Linter) can be tackled independently or in parallel.
- **03** (AI Scribe & Starter FAQs) builds on the sanitized section structure and linter.
- **04** (Public FAQ Accordion) exposes sections to parishioners with `<ParishAssistant />` deep linking.
- **05** (Inquiry Insights) connects chat logs back to the knowledge editor, closing the self-learning loop.

---

## Tasks

- [ ] **01: Streamline Knowledge Sync & Enforce Tool Precedence** (`issues/01-knowledge-sync-and-precedence.md`)
  - Stop embedding `mass_schedules` into static chunks in `sync-church-knowledge`.
  - Update `parish-assistant` system prompt to mandate live tool SSOT precedence over vector text.
- [ ] **02: Pre-Save Discrepancy Linter for Knowledge Base Sections** (`issues/02-presave-discrepancy-linter.md`)
  - Create client-side regex linter in `web/src/utils/knowledgeLinter.ts`.
  - Integrate real-time warning badge and confirmation prompt in `KnowledgeBasePage.tsx`.
- [ ] **03: AI Scribe ("Polish with AI") & Starter FAQ Templates** (`issues/03-ai-faq-writing-assistant.md`)
  - Implement "✨ Polish with AI" button in section editor to refine rough notes into warm pastoral policy.
  - Implement "✨ Generate Starter FAQs" to provide 5 standard Catholic parish policy templates.
- [ ] **04: Public Parish Profile FAQ Accordion with Assistant Deep Linking** (`issues/04-public-parish-faq-accordion.md`)
  - Add "Parish Guide & FAQs" tab and search-filtered accordion to `ChurchDetailPage.tsx`.
  - Add window event listener in `<ParishAssistant />` for deep linking with pre-filled inquiries.
- [x] **05: Admin Inquiry Insights & 1-Click FAQ Generator from Chat Logs** (`issues/05-admin-chat-insights-faq-generator.md`)
  - Add Inquiry Insights panel in `KnowledgeBasePage.tsx` reading `church_chat_logs`.
  - Add 1-click "Convert to FAQ" action to turn common/unanswered questions into knowledge sections.

---

## Key Architectural Decisions

1. **Hybrid SSOT Principle**:
   - Structured data (Mass schedules, open slots, service fees, booking rules) is owned exclusively by live relational PostgreSQL tables.
   - Unstructured data (policies, guidelines, history, dress codes, turnaround times) is owned by `church_knowledge_sections` and vectorized in `church_knowledge_chunks`.
   - In any conflict, live relational tools always prevail over vector search results.
2. **Zero Duplicate Stale Embeddings**:
   - `sync-church-knowledge` removes mass schedule embedding so that schedule updates in the admin panel take effect instantly without requiring vector re-indexing.
3. **Guardrails Over Hard Blocks**:
   - The Pre-Save Discrepancy Linter warns and educates admins about hardcoded times and fees, but permits a "Proceed Anyway" confirmation to avoid frustrating edge-case workflows.
4. **Accessible Parishioner Experience**:
   - Parishioners can read FAQs statically on `ChurchDetailPage.tsx` or deep-link directly into the conversational `<ParishAssistant />` with one tap.
5. **Continuous Self-Learning Loop**:
   - Chat logs from `church_chat_logs` feed directly into admin insights, highlighting questions parishioners are asking that lack documentation, enabling 1-click knowledge expansion.
