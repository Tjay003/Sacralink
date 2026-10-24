# 03: Tracer bullet: global assistant answers Mass times from live data

Type: task
**Status:** resolved
**Blocked by:** None (can start immediately)

**What to build:** the thinnest complete path through every layer. A Parishioner on any page opens the new Parish Assistant, asks "What are the Mass times?", and gets the current parish's live Mass Schedule.

- **Panel:** one floating assistant replaces the per-parish chatbot, mounted in the dashboard layout and shown only for role `user`. Parish context is the parish of the current page, otherwise the favourite parish, otherwise parish chips; a header chip lets the Parishioner switch parish. Starter chips appear when it opens. It follows the Sacralink design system and fits phone widths.
- **Edge function `parish-assistant`:** new slug with JWT verification on. It builds its Supabase client from the caller's token, has one tool (the Mass Schedule for a parish), and uses Gemini function calling. The Gemini base URL and model list come from environment variables.
- **Response contract:** reply text, plus optional slots reserved for draft proposals, intents and hand-off actions (filled in by later tickets), and the source count, as described in the spec.
- **Fake Gemini:** a scripted fake reachable from the locally served function through the base-URL variable, returning canned text and function calls per scenario.
- **CI:** the `e2e` workflow serves the function and points it at the fake. No Gemini key ever goes into CI.
- The old `church-ai-chat` function stays deployed and untouched.

- [x] A Parishioner sees the assistant on the dashboard, appointments and parish pages; staff roles never see it
- [x] On a parish page the assistant uses that parish; elsewhere it uses the favourite parish or asks with parish chips
- [x] Asking for Mass times returns the parish's live Mass Schedule (a schedule changed in the database shows up immediately, with no sync)
- [x] An unauthenticated call to `parish-assistant` is refused
- [x] One short Playwright spec drives the panel against local Supabase with the fake Gemini and asserts the live schedule appears
- [x] The `e2e` workflow runs that spec green with no real Gemini key
- [x] `tsc -b` and lint are clean; the panel has no horizontal scroll at phone width
