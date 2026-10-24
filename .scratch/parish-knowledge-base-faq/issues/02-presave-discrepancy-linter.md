# 02: Pre-Save Discrepancy Linter for Knowledge Base Sections

Type: task  
**Status:** completed  
**Blocked by:** None (can start immediately)  

---

## Problem Statement

Church administrators frequently enter free-text notes into the Knowledge Base (`church_knowledge_sections`) that contain hardcoded Mass times (e.g. "Sunday Mass at 6:00 AM, 8:00 AM, 5:00 PM") or sacramental booking fees (e.g. "Baptism fee: ₱500", "Wedding reservation is 5000 pesos"). 

When Mass schedules change in the Liturgy tab or booking fees are adjusted in the parish Services settings, these hardcoded free-text sections become out of sync. This creates inconsistent information across the website: the public Liturgy tab shows one schedule while the Knowledge Base and AI text searches recite an older hardcoded time.

To maintain the **Hybrid SSOT** rule without frustrating users through rigid blocks, we need a fast, client-side discrepancy linter that alerts administrators before saving whenever hardcoded schedules or fees are detected.

---

## What to Build

1. **Linter Utility Function** (`web/src/utils/knowledgeLinter.ts`):
   - A pure, fast client-side function: `lintKnowledgeSection(title: string, content: string): KnowledgeLintResult`.
   - Returns:
     ```ts
     export interface KnowledgeLintIssue {
       type: 'mass_schedule' | 'service_fee';
       severity: 'warning';
       message: string;
       matchedText: string;
       suggestion: string;
     }

     export interface KnowledgeLintResult {
       hasWarnings: boolean;
       issues: KnowledgeLintIssue[];
     }
     ```
   - **Pattern Detection**:
     - **Mass Times**: e.g., patterns matching liturgy keywords with times:
       - `/\b(mass|misa)\s+(?:schedule|times?|at)\b/i`
       - `/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:mass|misa)\b/i`
       - `/\b(?:sunday|saturday|daily|weekday)\s+(?:mass|misa)\b/i`
     - **Fees & Currencies**: e.g., patterns matching prices and sacramental fees:
       - `/(?:₱|php|pesos?)\s*\d+(?:,\d{3})*(?:\.\d{2})?/i`
       - `/\b\d+\s*pesos?\b/i`
       - `/\b(?:fee|bayad|donation|stipend)\s*(?:is|:|amounting to)?\s*(?:₱|php)?\s*\d+/i`

2. **UI Integration in `KnowledgeBasePage.tsx`** (`web/src/pages/admin/KnowledgeBasePage.tsx`):
   - Real-time lint evaluation on `formTitle` and `formContent` changes.
   - If warnings are detected:
     - Display a non-intrusive warning box above the editor actions with an `AlertTriangle` icon (Sacred Gold / amber token `text-amber-600 bg-amber-50 border-amber-200`).
     - Display clear, educational guidance: *"⚠️ Hardcoded Mass schedule or fee detected. Mass schedules and fees are managed dynamically in the Liturgy & Services tabs so they stay synchronized with live bookings and the AI assistant."*
     - List the specific flagged phrases and suggestions.
   - **Save Interception**:
     - When the admin clicks "Save Section", if warnings exist, prompt with a confirmation modal:
       - *"Discrepancy Warning: This section contains hardcoded schedules or fees that may become outdated when official parish schedules change. Do you want to review your changes or proceed anyway?"*
       - Buttons: `"Review & Edit"` (returns to editor) and `"Proceed Anyway"` (saves the section).
     - If no warnings exist, saving proceeds normally without interruption.

---

## Acceptance Criteria

- [x] `web/src/utils/knowledgeLinter.ts` accurately identifies both Mass schedule time patterns and fee/currency patterns with unit tests covering varied formats.
- [x] In `KnowledgeBasePage.tsx`, typing a hardcoded schedule (e.g., "Sunday Mass: 6am and 8am") or fee (e.g., "Fee: 500 pesos") immediately renders the warning badge.
- [x] Safe text (e.g., dress codes, baptism godparent requirements, parish history) produces zero false-positive warnings.
- [x] Clicking "Save Section" with active warnings triggers the confirmation modal explaining the SSOT rationale.
- [x] Clicking "Proceed Anyway" saves the section successfully and updates the knowledge base.
- [x] Styling follows Sacralink design tokens: clean light mode, `border-amber-200`, `bg-amber-50`, `text-amber-800`, with smooth transitions.
- [x] `tsc -b` and ESLint pass without warnings.

---

## Test Verification Plan

1. **Unit Tests (`web/src/utils/__tests__/knowledgeLinter.test.ts`)**:
   - Test detecting "Sunday Mass at 7:00 AM", "Weekday Mass 6pm", and "Misa ng Linggo 8:00 AM".
   - Test detecting "₱500 fee", "Php 1,500 donation", "wedding fee 5000 pesos".
   - Test clean pastoral policies (e.g. "Proper attire required: avoid sleeveless shirts") yielding `hasWarnings: false`.
2. **E2E Component Test (Playwright)**:
   - As Church Admin on `/admin/knowledge-base`, click "Add Section".
   - Input title "Mass Times Note" and content "Sunday mass at 6am".
   - Assert the warning box appears with the flagged text.
   - Click "Save", verify the confirmation modal appears.
   - Click "Proceed Anyway", assert section is created in the table.

---

## Comments

- Implemented `web/src/utils/knowledgeLinter.ts` exporting `lintKnowledgeSection`, `KnowledgeLintIssue`, and `KnowledgeLintResult`.
- Integrated real-time linter evaluation into `web/src/pages/admin/KnowledgeBasePage.tsx` with Sacralink amber tokens (`bg-amber-50`, `border-amber-200`, `text-amber-900`) and ConfirmationModal interception.
- Added comprehensive unit and E2E component tests in `web/e2e-local/knowledge-linter.spec.ts` (5 passed). All existing knowledge sync and precedence tests continue to pass (3 passed).
- Verified `tsc -b` and ESLint exit cleanly with 0 errors.
