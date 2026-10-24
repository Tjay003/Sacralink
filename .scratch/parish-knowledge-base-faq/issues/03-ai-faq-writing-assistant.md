# 03: AI Scribe ("Polish with AI") & Starter FAQ Templates

Type: task  
**Status:** completed  
**Blocked by:** 01, 02  

---

## Problem Statement

Parish administrators and church secretaries are often volunteers or busy pastoral staff who do not have time to draft extensive, well-structured pastoral policies from scratch. When setting up a knowledge base, they are confronted with a blank page and either:
1. Abandon the feature because they don't know which policies a Catholic parish needs.
2. Enter abrupt, shorthand notes (e.g. "bawal sleeveless slippers sa church, come 15 mins early") that lack warmth, reverent pastoral tone, and proper accessibility formatting.

To make the AI Knowledge Base welcoming, easy to adopt, and pastorally sound, the editor needs two AI-assisted writing tools:
1. **"✨ Polish with AI" (AI Scribe)**: Takes rough bullet points or shorthand notes and rewrites them into warm, respectful, and well-structured pastoral guidelines.
2. **"✨ Generate Starter FAQs"**: Instantly generates 5 standard, foundational Catholic parish policy templates tailored for typical Philippine/Diocesan parish needs.

---

## What to Build

1. **AI Scribe Integration Service** (`web/src/lib/supabase/aiScribe.ts`):
   - Helper function `polishKnowledgeContent(title: string, rawContent: string, churchName?: string): Promise<{ polishedTitle: string; polishedContent: string }>`
   - Calls the `parish-assistant` edge function (or dedicated backend helper) passing `action: 'polish_knowledge'` with system instructions:
     - "You are a Catholic parish pastoral communications director in the Philippines."
     - "Transform raw admin bullet points into warm, welcoming, reverent, and clear parish guidelines."
     - "Preserve all factual rules, timeframes, and requirements faithfully. Do NOT invent new obligations."
     - "Format using clear markdown headings, bulleted lists, and respectful language."
   - Graceful fallback: If edge function times out or network is offline, formats input with basic clean typography and returns with a helpful notice.

2. **Starter FAQ Templates** (`web/src/config/starterFaqTemplates.ts`):
   - Pre-crafted canonical templates for 5 standard Catholic parish topics:
     1. **Dress Code & Decorum in Church**: Proper attire for Sunday liturgy and ceremonies (modest wear, reverent silence, silenced mobile phones).
     2. **Baptism Requirements & Godparent (Ninong/Ninang) Guidelines**: Canonical requirements (Catholic confirmation, at least 16 years old, lead Christian life), birth certificate, and pre-Jordan seminar schedule guidelines.
     3. **Wedding Application & Certificate Turnaround Times**: Publication of wedding banns (3 consecutive Sundays), canonical interview lead times (1-2 months prior), and document release times.
     4. **Parish Office Services & Mass Intentions**: Office hours, requesting Mass intentions (Thanksgiving, Soul, Healing) at least 1 hour prior to liturgy, and blessing requests (homes, vehicles).
     5. **Parish Ministries & Volunteer Opportunities**: Joining the Extraordinary Ministers of Holy Communion, Lectors & Commentators, Parish Youth Ministry, or Choir.

3. **UI in `KnowledgeBasePage.tsx`**:
   - **"✨ Polish with AI" Button**:
     - Placed beside the Content textarea inside the section editor modal.
     - Styled with Sacred Gold / amber accents (`bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100`).
     - Shows a spinning loader during generation.
     - On completion, opens a side-by-side or tabbed "Review & Apply" preview showing the original vs. polished text.
     - Admin can click "Apply Polished Version" or "Revert".
   - **"✨ Generate Starter FAQs" Action**:
     - Placed on the main Knowledge Base header (especially prominent when sections count is low or 0).
     - Clicking opens a modal previewing the 5 templates with toggle checkboxes.
     - Admin can select all or individual templates and click "Create Selected Sections".
     - Inserts the selected sections into `church_knowledge_sections` with proper `display_order` and triggers auto-sync.

---

## Acceptance Criteria

- [x] "✨ Polish with AI" button is visible and active when editing/creating a section with draft content.
- [x] Clicking "Polish with AI" converts informal bullet points into respectful pastoral markdown with headings and lists.
- [x] Polish preview allows reviewing the draft before committing to the editor field.
- [x] "✨ Generate Starter FAQs" button opens the template selector modal displaying the 5 Catholic parish templates.
- [x] Admin can select one, multiple, or all 5 templates to insert in bulk.
- [x] Created starter templates appear immediately in the sections list and trigger background sync.
- [x] UI strictly complies with Sacralink design tokens (no un-themed dark classes, responsive layout, clear loading states).
- [x] `tsc -b` and ESLint checks pass cleanly.

---

## Test Verification Plan

1. **Unit Test (`web/src/lib/supabase/__tests__/aiScribe.test.ts` / `web/e2e-local/knowledge-ai-scribe.spec.ts`)**:
   - [x] Verify `polishKnowledgeContent` sends structured payload and handles successful response and timeout fallbacks.
   - [x] Verify all 5 starter templates in `starterFaqTemplates.ts` contain non-empty title and structured markdown content.
2. **Playwright Integration Test (`web/e2e-local/knowledge-ai-scribe.spec.ts`)**:
   - [x] Log in as Church Admin on `/admin/knowledge-base`.
   - [x] Click "Generate Starter FAQs", select "Dress Code & Decorum in Church", click "Create Selected".
   - [x] Assert the new section appears in the list.
   - [x] Click "Edit", add rough note "bawal sumbrero", click "Polish with AI".
   - [x] Assert the preview modal opens with refined pastoral wording.
   - [x] Click "Apply Polished Version" and save; verify database record contains the polished text.

---

## Comments

- Implemented starter FAQ templates in `web/src/config/starterFaqTemplates.ts` covering the 5 canonical Catholic parish policies (Dress Code & Liturgical Decorum, Holy Baptism Requirements & Godparents, Wedding Requirements & Document Timeline, Funeral Mass & Blessing, Mass Intentions & Office Turnaround).
- Implemented AI Scribe client in `web/src/lib/supabase/aiScribe.ts` with edge function invoke and resilient offline pastoral fallback.
- Added backend support for `action === 'polish_knowledge'` in `supabase/functions/parish-assistant/index.ts` and mocked in `scripts/fake-gemini.mjs`.
- Integrated "✨ Polish with AI" button with loading state, review comparison modal, temporary success badge, and template insertion picker in `web/src/pages/admin/KnowledgeBasePage.tsx`.
- Implemented Starter Templates Modal with multi-select bulk insertion and preview capabilities using the accessible `Modal` primitive.
- All unit & e2e tests in `web/e2e-local/knowledge-ai-scribe.spec.ts` (5 passed) and `web/e2e-local/knowledge-linter.spec.ts` (5 passed) succeed with 0 TypeScript and ESLint errors.
