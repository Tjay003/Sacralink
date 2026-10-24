# Map: AI Parish Assistant

Spec: `spec.md` (decisions locked 2026-10-24). Tickets in `issues/`. Branch: `feature/parish-assistant` (from `main`), merged to `main`, shipped with `/release`. No ticket is expected to touch the database schema. Automated tests use the scripted fake Gemini; real Gemini calls only when Tyrone asks, one prompt at a time.

## Dependency graph
```
01 (resolved)
02 ──────────────┐
03 ─┬─ 04 ─┬─ 08 │
    │      └─ 09 │
    ├─ 05        │
    ├─ 10        │
    └────────── 06 ─┬─ 07
                    └─ 08
```
06 needs 02 and 03. 08 needs 04 and 06.

## Tasks
- [x] 01 Commit the live edge functions as a baseline
- [x] 02 Prefactor: booking rules out of the booking page
- [x] 03 Tracer bullet: global assistant answers Mass times from live data
- [x] 04 Live read tools, and "my appointments" shows only your own (after 03)
- [x] 05 Reliability: server rate limit, one log per exchange, model list, fallback (after 03)
- [x] 06 Book by tapping chips, services without documents (after 02, 03)
- [ ] 07 Document upload cards in the chat (after 06)
- [ ] 08 AI-assisted booking (after 04, 06)
- [ ] 09 Parish Office Ticket drafting and hand-off buttons (after 04)
- [ ] 10 Large text and read aloud (after 03)

## Decisions (grilling session 2026-10-24)
1. Action scope: answers, guided Booking and ticket drafting; the AI only proposes, the browser acts on the Parishioner's Confirm tap.
2. Provider: Gemini (existing key), model list from an environment variable.
3. Agent loop: new edge function `parish-assistant`, JWT verification on, read tools run as the caller (RLS).
4. Knowledge: keep the vector store and manual Sync; live tools come first for structured questions.
5. Placement: one global assistant, Parishioners (role `user`) only, parish-aware.
6. State: Booking Draft held in the browser (sessionStorage).
7. Flow control: code picks the next question and the chips, Gemini phrases and parses. Booking Guide runs in the browser.
8. Input: tap chips plus typing; documents on upload cards in the chat, never sent to Gemini.
9. Tickets: drafted by the AI, confirmed by the Parishioner, created by the existing ticket function.
10. Elderly UX: large text and read aloud; no voice input.
11. Testing: one Playwright seam with a scripted fake Gemini; real-model checks only on request.
12. Rollout: new slug beside `church-ai-chat`; the old one stays (the mobile app still uses it).
