# 07: Document upload cards in the chat

Type: task
**Status:** resolved
**Blocked by:** 06

**What to build:** a Parishioner booking a service that needs documents (for example, Baptism) attaches them on cards inside the chat and submits without leaving the conversation.

- After the priest step, the guide shows one card per requirement for the chosen service: name, description, required or optional, and a "Take photo / Choose file" button limited to that requirement's allowed file types.
- Each card shows the attached file with replace and remove.
- Files stay in browser memory until Confirm, then go through the existing document upload as part of the existing appointment creation. Files and their contents are never sent to the edge function or Gemini; the draft only records "attached".
- Confirm stays disabled while a required document is missing, with a note naming what's missing (the same rule as the booking page, through ticket 02).

- [x] A Baptism can be booked end to end with chips and upload cards
- [x] Confirm is disabled until every required document is attached; optional ones never block
- [x] The file chooser only accepts the requirement's allowed types
- [x] The Playwright spec from ticket 06 is extended (or a sibling added) to book a Baptism with documents and assert the stored documents (spec test #1)
- [x] `tsc -b` and lint are clean
