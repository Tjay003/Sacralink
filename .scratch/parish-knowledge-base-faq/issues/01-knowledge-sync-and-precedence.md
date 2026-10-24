# 01: Streamline Knowledge Sync & Enforce Tool Precedence

Type: task  
**Status:** completed  
**Blocked by:** None (can start immediately)  

---

## Problem Statement

Currently, the `sync-church-knowledge` Supabase Edge Function reads recurring schedules from the `mass_schedules` table and embeds them into `church_knowledge_chunks` as static vector chunks (`source_type: 'mass_schedule'`). When a parish administrator updates a Mass time or adds a new liturgy in the parish admin dashboard, those changes are stored immediately in the `mass_schedules` table. However, until the admin manually triggers "Sync AI Knowledge Base", the vector store holds outdated Mass times.

Furthermore, `parish-assistant` has live read tools (`get_mass_schedule`, `find_mass_across_parishes`, `get_bookable_services`, `check_slot_availability`, `get_sacrament_requirements`), but its system instructions do not explicitly state that live database tool outputs must strictly override free-text knowledge chunks if a discrepancy exists. As a result, the model could occasionally reconcile conflicting information by blending old vector text with fresh tool outputs.

Under our **Hybrid SSOT** architectural decision:
- Relational tables are the sole authoritative source of truth for Mass times and booking schedules.
- `church_knowledge_sections` & `church_knowledge_chunks` are the authoritative source for unstructured pastoral policies, dress codes, fiesta schedules, office turnaround times, and general FAQs.

---

## What to Build

1. **Streamline `sync-church-knowledge` Edge Function** (`supabase/functions/sync-church-knowledge/index.ts`):
   - Remove step 2 (embedding recurring Mass schedules into `chunks`).
   - Add a cleanup step during sync that deletes existing chunks where `church_id = churchId` and `source_type = 'mass_schedule'`.
   - Ensure `sync-church-knowledge` focuses exclusively on:
     - Church basic metadata (name, address, contact, operating hours)
     - Sacrament requirements (`sacrament_requirements`)
     - Announcements (`church_announcements`)
     - Custom knowledge sections (`church_knowledge_sections`) with semantic chunking and overlap.

2. **System Prompt Precedence in `parish-assistant`** (`supabase/functions/parish-assistant/index.ts`):
   - Update rule 1 ("TOOL USE & PRECEDENCE") in the system instruction:
     - Explicitly define the hierarchy of truth:
       1. **Live Database Tools** (`get_mass_schedule`, `find_mass_across_parishes`, `get_bookable_services`, `check_slot_availability`, `check_priest_availability`, `get_my_appointments`) are the **authoritative Single Source of Truth (SSOT)**.
       2. **Knowledge Base Search** (`search_church_knowledge`) is authoritative ONLY for unstructured parish policies, history, dress codes, fiesta schedules, office guidelines, and FAQs.
       3. **Discrepancy Resolution**: In any case of discrepancy between knowledge base chunks and live database tool outputs (e.g., if a knowledge note mentions an old Mass time or outdated service fee), the live tool output **MUST ALWAYS** supersede and be communicated as the true current policy.

---

## Acceptance Criteria

- [x] `supabase/functions/sync-church-knowledge/index.ts` no longer queries `mass_schedules` or embeds Mass schedule chunks.
- [x] Running `sync-church-knowledge` deletes any lingering chunks with `source_type = 'mass_schedule'` for that church.
- [x] `supabase/functions/parish-assistant/index.ts` contains explicit SSOT precedence directives in `systemInstruction`.
- [x] Asking `parish-assistant` "What time is Mass?" retrieves answers strictly via `get_mass_schedule` and never returns stale vectorized text.
- [x] The sync response summary accurately reflects the processed chunks without errors.
- [x] TypeScript type checks (`deno check` or `tsc -b`) and linting pass with zero warnings.

---

## Test Verification Plan

1. **Automated Unit / Edge Function Test**:
   - Invoke `sync-church-knowledge` with a mock payload in local Supabase or test environment.
   - Query `church_knowledge_chunks` to verify 0 chunks with `source_type = 'mass_schedule'` exist after synchronization.
2. **Playwright Integration Test**:
   - Insert an outdated Mass time text into a `church_knowledge_sections` row (e.g. "Sunday Mass is at 5:00 AM") while `mass_schedules` table has "Sunday Mass is at 9:00 AM".
   - Ask the assistant in the test suite: "What time is Sunday Mass?".
   - Assert the assistant calls `get_mass_schedule` and replies with "9:00 AM" (live SSOT), ignoring the conflicting knowledge note.

---

## Comments

- Implemented in Ticket 01:
  - Streamlined `supabase/functions/sync-church-knowledge/index.ts` to purge any lingering `mass_schedule` chunks upon sync and stopped embedding recurring schedules into vector chunks.
  - Updated `supabase/functions/parish-assistant/index.ts` to explicitly define the hierarchy of truth (Live DB Tools SSOT > Knowledge Base Search) and mandatory discrepancy resolution rule.
  - Added migration `supabase/migrations/083_church_knowledge_base.sql` bringing `church_knowledge_chunks`, `church_knowledge_sections`, `church_knowledge_files`, and `match_church_knowledge` to the local migration pipeline.
  - Added Playwright test suite `web/e2e-local/parish-knowledge-sync-and-precedence.spec.ts` covering purge behavior, knowledge synchronization, and precedence resolution with conflicting notes. All 3 tests passed in 8.6s.
  - Verified `tsc -b` static checks pass with zero errors.
