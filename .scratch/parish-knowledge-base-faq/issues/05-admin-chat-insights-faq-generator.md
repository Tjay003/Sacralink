# 05: Admin Inquiry Insights & 1-Click FAQ Generator from Chat Logs

Type: task  
**Status:** ready-for-agent  
**Blocked by:** 02, 03, 04  

---

## Problem Statement

Every day, parishioners ask the AI Parish Assistant dozens of practical questions ("May misa ba bukas ng gabi?", "How much is the crypt niche?", "Can non-parishioners get married here?", "What time does the parish office close on Mondays?"). All of these interactions are logged to `church_chat_logs`.

However, church administrators currently have zero visibility into these chat logs from the admin dashboard. When the assistant fails to answer a question because the knowledge base lacks information, that knowledge gap persists indefinitely. Admins have no way to discover what parishioners are asking without manual database inspection.

To create a truly self-learning parish knowledge loop, administrators need an **Inquiry Insights Panel** in `KnowledgeBasePage.tsx` that surfaces top parishioner questions, flags unanswered questions, and allows administrators to convert unanswered questions into new, published FAQ sections with a single click.

---

## What to Build

1. **Inquiry Insights Hook / Service** (`web/src/hooks/useChatInsights.ts`):
   - Queries `church_chat_logs` for `church_id = currentChurchId` (authorized via existing Supabase RLS policy `Admins can read all chat logs`).
   - Fetches the last 30 days of exchanges.
   - Computes:
     - **Total Inquiries**: Count of questions submitted to the assistant.
     - **Unanswered / Low-Confidence Queries**: Identifies logs where the assistant's reply indicated missing knowledge (e.g. reply contains keywords like `"contact the parish office"`, `"hindi ko po alam"`, `"no information available"`, or fallback notices).
     - **Top Question Clusters**: Simple frequency grouping of repeated inquiries.

2. **UI in `KnowledgeBasePage.tsx`** (`web/src/pages/admin/KnowledgeBasePage.tsx`):
   - Add a tabbed header or side section:
     - Tab 1: **"Knowledge Sections"** (the existing CRUD manager + linter + starter templates)
     - Tab 2: **"Inquiry Insights & Gaps"** (with a badge indicating count of unanswered inquiries)
   - **Insights Dashboard View**:
     - Metric cards: Total Inquiries, Unanswered Questions, Documented Topics.
     - Table / List of **Recent Unanswered Inquiries**:
       - Displays date, parishioner question, assistant's response snippet, and status.
       - **1-Click Action: "✨ Convert to FAQ"**:
         - Clicking the button switches to the section editor with:
           - `formTitle` pre-filled with a clean version of the parishioner's question (e.g. "Columbarium & Crypt Inquiries").
           - `formContent` pre-filled with an AI-generated starter draft addressing the inquiry, ready for the admin to supply exact parish numbers and confirm.
         - When the admin saves, the new section is committed to `church_knowledge_sections`, triggering instant vector sync.
         - The insight item is marked as resolved / addressed.

---

## Acceptance Criteria

- [ ] `KnowledgeBasePage.tsx` provides an "Inquiry Insights" tab accessible to Church Admins and Super Admins.
- [ ] Fetches and displays records from `church_chat_logs` matching the active church.
- [ ] Accurately detects and highlights unanswered / low-confidence inquiries.
- [ ] Clicking "Convert to FAQ" opens the editor pre-populated with the question and draft pastoral response.
- [ ] Saving the newly generated FAQ triggers vector sync and refreshes the insights list.
- [ ] Adheres strictly to the Sacralink design system tokens: clean light mode, `border-border`, `bg-card`, responsive mobile layout.
- [ ] TypeScript type checks (`tsc -b`) and ESLint pass without warnings.

---

## Test Verification Plan

1. **Unit Test (`web/src/hooks/__tests__/useChatInsights.test.ts`)**:
   - Mock `church_chat_logs` records containing answered and unanswered exchanges.
   - Assert `useChatInsights` correctly flags queries containing fallback/unanswered markers.
2. **Playwright Integration Test**:
   - Insert a mock record into `church_chat_logs` for Church A: `question: "Can we rent the parish hall for receptions?", answer: "I do not have information about parish hall rentals. Please contact the parish office."`.
   - Log in as Church Admin for Church A on `/admin/knowledge-base`.
   - Click the "Inquiry Insights" tab.
   - Assert the hall rental inquiry appears under "Unanswered Questions".
   - Click "Convert to FAQ".
   - Assert the section editor opens with the pre-filled title and drafted template.
   - Edit, click "Save Section", and assert the section is created in `church_knowledge_sections`.

---

## Comments
