# 10: Large text and read aloud

Type: task
**Status:** ready-for-agent
**Blocked by:** 03

**What to build:** elderly Parishioners can read and hear the assistant comfortably.

- A large-text switch in the panel header scales message text and makes chips and buttons at least 56px tall. The choice is remembered on the device in localStorage, with every read and write wrapped in try/catch so the panel works when storage is blocked.
- A "Read aloud" button on each assistant reply uses the browser's built-in speech synthesis. Markdown is stripped before speaking. It picks a Filipino voice for Tagalog replies when the device has one, otherwise the default voice. Tapping again stops it. The button is hidden when speech synthesis isn't supported.
- All controls are keyboard-reachable with accessible labels.
- UI only: no Playwright test (per the test workflow).

- [ ] Large text survives a reload and never causes horizontal scroll at phone width
- [ ] Read aloud speaks the reply and can be stopped; it is hidden on a browser without speech synthesis
- [ ] `tsc -b` and lint are clean; checked on the local dev server at phone and desktop widths
