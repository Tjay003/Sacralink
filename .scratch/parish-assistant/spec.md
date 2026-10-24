# Spec: AI Parish Assistant

Status: ready-for-agent

Decisions locked with Tyrone in a grilling session on 2026-10-24. Work happens on the `feature/parish-assistant` branch (cut from `main`), then merges to `main` and ships through `/release` to `feature/demo-mode`. The baseline commit `597c54d` already holds the unchanged source of the live `church-ai-chat` and `sync-church-knowledge` edge functions, which had never been in git.

## Problem Statement

A Parishioner who wants to know when Mass is, what a Baptism needs, or whether their wedding booking was approved has to dig through several screens. The current chatbot only lives on a single parish's page. It answers from a snapshot of parish data that only refreshes when a Church Admin remembers to press "Sync AI Knowledge Base", so a changed Mass time can be answered wrongly. It cannot tell a Parishioner anything about their own appointments. It cannot help them do anything: booking a sacrament still means filling a long form with a free date and time field, and an elderly Parishioner who is not comfortable typing or reading small text gives up and calls the parish office.

## Solution

A single **Parish Assistant** floats on every Parishioner page. It answers from live parish data: Mass Schedules across the diocese, sacrament requirements, open slots, and the Parishioner's own appointments. It speaks English, Tagalog or Taglish to match the Parishioner.

It can walk a Parishioner through a **Booking** one question at a time (service, date, time, preferred priest, documents, notes). Every question comes with large tap-to-answer buttons built from live data, so the whole booking can be done without typing. Typing still works ("sa Sabado ng umaga"). Required documents are attached on upload cards right in the chat. At the end the Parishioner sees a summary and taps **Confirm**, and the request lands as a pending appointment for the parish office to approve, exactly as if it came from the booking page.

When the assistant cannot answer, or the Parishioner wants to talk to the office, it drafts a **Parish Office Ticket** for them to review and confirm. Elderly Parishioners can switch on large text and have any reply read aloud.

The assistant never changes anything on its own. The AI only proposes; the Parishioner's tap on Confirm runs the same, permission-checked actions the app already uses.

## User Stories

### Finding the assistant

1. As a Parishioner, I want the assistant available on every page I use, so that I don't have to find a specific parish page before asking a question.
2. As a Parishioner on a parish's page, I want the assistant to assume I'm asking about that parish, so that I don't have to say which parish every time.
3. As a Parishioner on a page that isn't about one parish, I want the assistant to default to my favourite parish, so that common questions just work.
4. As a Parishioner with no favourite parish, I want the assistant to offer parish buttons when it needs one, so that I can pick without typing a name.
5. As a Parishioner, I want to switch the parish the assistant is talking about at any time, so that I can ask about a different church mid-conversation.
6. As a Parishioner, I want a few starter buttons ("Mass times", "Book a sacrament", "My appointments", "Talk to the parish office") when I open the assistant, so that I know what it can do.
7. As a Church Admin, Priest, Volunteer or Super Admin, I want the assistant hidden on my pages, so that my working screens stay uncluttered.

### Asking questions with live answers

8. As a Parishioner, I want Mass times read from the live Mass Schedule, so that I never get an outdated time.
9. As a Parishioner, I want to ask where I can hear Mass at a given day and time across parishes ("Sunday 6 PM"), so that I can find a Mass that fits my schedule.
10. As a Parishioner, I want the requirements for a sacrament at a specific parish, so that I can prepare the right documents.
11. As a Parishioner, I want to know which services a parish offers for booking, so that I don't ask for one it doesn't provide.
12. As a Parishioner, I want to ask whether a date and time is open for a service, so that I know before I start booking.
13. As a Parishioner, I want to ask if a particular priest can preside at a date and time and get a simple yes or no, so that I can decide whether to request him.
14. As a Parishioner, I want the assistant to never tell me why a priest is unavailable, so that the clergy's private reasons stay private.
15. As a Parishioner, I want to ask "what's the status of my baptism booking?", so that I don't have to dig through my appointments list.
16. As a Parishioner, I want the assistant to show only my own appointments, so that nobody else's bookings are exposed to me or mine to others.
17. As a Parishioner, I want to be told when an approved appointment was rescheduled and why, so that I'm not confused by the new date.
18. As a Parishioner, I want free-text parish information (announcements, the parish's own knowledge sections) still answered, so that questions about ministries, office hours or events keep working.
19. As a Parishioner, I want the assistant to say clearly when it doesn't know and offer to send my question to the parish office, so that I'm never given a made-up answer.
20. As a Parishioner, I want off-topic questions politely declined, so that the assistant stays a parish tool.
21. As a Parishioner who writes in Tagalog, I want replies in Tagalog, so that I understand them easily.
22. As a Parishioner who writes in English or Taglish, I want replies that match, so that the conversation feels natural.
23. As a Parishioner, I want short replies with lists for schedules and requirements, so that they're easy to scan on a phone.

### Booking through the conversation

24. As a Parishioner, I want to say "I want to book a baptism" and have the assistant start a guided booking, so that I don't have to find the booking page.
25. As a Parishioner, I want the assistant to ask one thing at a time, so that I'm never overwhelmed.
26. As a Parishioner, I want each question to come with large tap-to-answer buttons, so that I can book without typing.
27. As a Parishioner, I want the service buttons to show only that parish's bookable services, using the names the parish gave them, so that I pick something real.
28. As a Parishioner, I want the date buttons to offer the next open dates, so that I don't pick a day that's already full.
29. As a Parishioner, I want the time buttons to show only open slots for my chosen date, so that I can't choose a taken slot.
30. As a Parishioner, I want to type an answer like "next Saturday morning" and have it understood, so that I can answer naturally.
31. As a Parishioner, I want the assistant to tell me plainly when my typed answer isn't possible (taken slot, past date) and offer the nearest open alternatives, so that I'm not stuck.
32. As a Parishioner, I want to optionally request a specific priest or choose "Any available priest", so that I can ask for a priest I know.
33. As a Parishioner, I want to be warned (without a reason) when the priest I requested is not available at that time, and still be allowed to continue, so that my request isn't blocked by a preference.
34. As a Parishioner, I want to ask side questions mid-booking ("what's a Pre-Jordan seminar?") and then pick up where I left off, so that I don't lose my progress.
35. As a Parishioner, I want to change an earlier answer ("change the date"), so that I can fix mistakes before confirming.
36. As a Parishioner, I want to cancel the guided booking at any time, so that I'm not trapped in a flow.
37. As a Parishioner, I want my booking progress kept if I accidentally refresh the page, so that I don't have to start over.
38. As a Parishioner, I want an optional notes step, so that I can tell the parish office anything special.
39. As a Parishioner, I want a clear summary card of everything I chose before submitting, so that I can check it.
40. As a Parishioner, I want nothing submitted until I tap Confirm, so that the assistant never books on its own.
41. As a Parishioner, I want my confirmed booking to appear in My Appointments as pending, so that I know the parish office still needs to approve it.
42. As a Parishioner, I want the parish office notified of my new booking just like a form booking, so that it gets handled.
43. As a Parishioner, I want a link to the new appointment after confirming, so that I can review it.
44. As a Parishioner, I want a clear message if confirming fails (for example, the slot was taken a moment ago), with alternatives, so that I can recover.
45. As a Parishioner, I want tapping Confirm twice to create only one booking, so that I don't double-book by accident.
46. As a Parishioner, I want the guided booking to keep working with plain wording even when the AI service is busy or down, so that I can still book.

### Documents during booking

47. As a Parishioner, I want each required document shown as its own upload card with its name and description, so that I know exactly what to attach.
48. As a Parishioner on a phone, I want to take a photo or choose a file on each card, so that I can attach paper documents easily.
49. As a Parishioner, I want only the file types the parish accepts for that document, so that my upload isn't rejected later.
50. As a Parishioner, I want each card to show a tick once attached, and let me replace or remove it, so that I can fix a wrong file.
51. As a Parishioner, I want optional documents marked as optional, so that I don't think they block me.
52. As a Parishioner, I want Confirm disabled until every required document is attached, with a note saying what's missing, so that I know why I can't submit yet.
53. As a Parishioner, I want my documents never sent to the AI service, so that my birth and marriage certificates stay private.

### Parish Office Tickets

54. As a Parishioner, I want to say "I want to talk to the parish office" and get a ticket drafted from our conversation, so that I don't have to retype my question.
55. As a Parishioner, I want the assistant to offer a ticket when it can't answer, so that my question still reaches a person.
56. As a Parishioner, I want to review and edit the ticket's category, subject and message before sending, so that it says what I mean.
57. As a Parishioner, I want the ticket sent only when I tap Confirm, so that nothing is sent without my approval.
58. As a Parishioner, I want a link to the new ticket after sending, so that I can follow the office's reply.
59. As a Parishioner, I want a clear explanation if the ticket can't be created (for example, a ticket limit), so that I know what to do instead.

### Things it hands off

60. As a Parishioner who wants to cancel or reschedule, I want a button that takes me to that appointment, so that I use the proper screen where the office handles it.
61. As a Parishioner who wants to message a priest or staff member, I want a button to Messages, so that I know where to go.

### Accessibility for elderly Parishioners

62. As an elderly Parishioner, I want a large-text switch inside the assistant, so that I can read replies and buttons comfortably.
63. As an elderly Parishioner, I want my large-text choice remembered on this device, so that I don't have to turn it on every time.
64. As an elderly Parishioner, I want a "Read aloud" button on every reply, so that I can listen instead of reading.
65. As an elderly Parishioner, I want read-aloud to use a Filipino voice when the reply is in Tagalog and my device has one, so that it sounds right.
66. As a Parishioner on a browser without speech support, I want the read-aloud button hidden, so that I don't press something that does nothing.
67. As a Parishioner, I want all buttons big enough to tap reliably and usable by keyboard and screen reader, so that the assistant works for everyone.
68. As a Parishioner on a narrow phone, I want the assistant panel to fit the screen with no sideways scrolling, so that nothing is cut off.

### Limits and reliability

69. As a Parishioner, I want a friendly message if I send too many messages in a short time, so that I know to wait or call the office.
70. As a Parishioner, I want the assistant to answer with the old keyword answers when the AI service is down, so that I still get basic information.
71. As a Parishioner, I want the assistant to suggest calling the parish (with its number) when nothing else works, so that I always have a way forward.

### Parish office and platform

72. As a Church Admin, I want chat bookings to arrive as normal pending appointments with their documents, so that I approve them the same way as form bookings.
73. As a Church Admin, I want the "Sync AI Knowledge Base" button to keep working, so that free-text knowledge stays searchable.
74. As a Super Admin, I want each assistant exchange logged once in the chat logs, so that usage can be reviewed without duplicates.
75. As the developer, I want automated tests to use a scripted fake AI, so that tests never spend the free Gemini quota.
76. As the developer, I want the live site to keep working while the new assistant is built and deployed, so that the release order can't break production.
77. As the developer, I want the mobile app to keep working unchanged, so that this web effort doesn't break it.

## Implementation Decisions

### Architecture

- **Two halves with one rule: the AI proposes, the browser decides and acts.** A new edge function, `parish-assistant`, runs the language side: conversation, reading free-text answers, answering questions with read-only tools. A new browser module, the **Booking Guide**, owns the booking flow: which question comes next, the chip options, checking each answer, and the final write. No database write is ever made by the edge function or by Gemini.
- **The Booking Guide runs in the browser and reuses existing helpers.** It builds on the existing bookable-services lookup, the parish slot check, the celebrant pool evaluation, the next-available-slot recommender and the sacrament requirements lookup, all running with the Parishioner's own session. This avoids porting booking rules to Deno and keeps chip booking working when the edge function or Gemini fails.
- **Question order is fixed in code:** service → date → time → preferred priest → documents → notes → confirm. The guide always asks for the first missing or invalid field. Gemini only phrases the question warmly and reads typed answers into a proposed field value. If Gemini is unavailable, the guide uses plain template wording in the reply language.
- **The Booking Draft is held in the browser**, as a typed record of parish, service type, date, time, requested priest (or "any"), attached-document markers and notes. It is saved to sessionStorage so a refresh doesn't lose it. The draft is sent to the edge function each turn as context, but only as field values and the current step; document files are never sent.
- **Every AI-proposed value is checked by the guide before it enters the draft.** It must be a real bookable service of that parish, a future date, a slot the slot check says is free with an eligible priest, and a priest from that parish's clergy. A rejected proposal produces a plain explanation plus alternative chips from the recommender.
- **Confirm calls the existing appointment creation module** (insert as `pending`, upload documents, notify the parish's admins) under the Parishioner's session, so existing permission rules and the office notification path apply unchanged. The requested priest is stored as the Booking's preference, never as the Celebrant. Confirm is disabled while submitting, so a double tap creates one booking.
- **Ticket drafting uses the same pattern.** Gemini proposes category, subject and message; the browser shows an editable confirm card; Confirm calls the existing ticket creation function (the parish-office lane for the current parish) under the Parishioner's session. The database function keeps deciding numbering, participants, categories and limits, and its errors are shown in plain language.

### Edge function `parish-assistant`

- New slug, with JWT verification **on**: every caller is signed in, because the whole web app sits behind login.
- **Read tools run as the caller.** The function builds its Supabase client from the caller's token, so row-level security decides what the assistant can see. "My appointments" can therefore only ever return the caller's own rows. The service role is used only for writing the chat log and counting messages for the rate limit. If the existing vector-search function cannot be called as the caller, knowledge search may use the service role, because it returns public parish content filtered by parish.
- **Tools offered to Gemini (function calling):** list parishes; Mass Schedule for a parish; find Mass across parishes by day and time; bookable services for a parish; sacrament requirements for a parish's service; slot check for a parish, date and time (yes/no and whether a priest can preside); priest availability as a yes/no only; the caller's own appointments with status, schedule and any rescheduled notice; free-text knowledge search over the existing vector store.
- **Priest unavailability is answered yes/no only.** Leave and blackout reasons are never returned by any tool, so they can never reach a reply.
- **Live tools come first.** The prompt tells the model to use live tools for structured questions (Mass times, requirements, slots, appointments) and knowledge search only for free-text parish information. The existing knowledge sync and its manual Sync button stay unchanged for now.
- **Response contract (prose, not a schema):** the reply text in the user's language; optionally a proposed value for the Booking Draft's current field; optionally an intent to start a Booking or draft a Parish Office Ticket (with the drafted fields); optionally hand-off actions (open an appointment, open Messages, open the booking page); and the count of sources used. The browser treats every proposal as untrusted input to check.
- **Request contract:** the message, the last few conversation turns, the current parish (if any), and the Booking Draft's field values and current step.
- **Language:** reply in the language the Parishioner wrote in (English, Tagalog, or Tagalog for mixed Taglish), formal and respectful, short, with lists for schedules and requirements. Chip labels follow the same language.
- **Scope rules carried over from the current prompt:** parish-related only, never invent details, and say "I don't know" with an offer to draft a ticket and the parish contact number.
- **The model list comes from an environment variable**, tried in order with fallback on quota or overload errors. It drops the deprecated 2.0 models. Which current Flash models to list is confirmed with Tyrone before any real call, because of the quota rule below.
- **The Gemini base URL comes from an environment variable**, defaulting to Google's. Tests point it at a scripted fake.
- **Rate limit enforced on the server:** at most 10 assistant messages per user per 5 minutes, counted from the chat logs. Over the limit, the function returns the existing friendly rate-limit notice. The browser's sessionStorage limiter stays only as a hint in the UI.
- **Logging:** each exchange is written once, by the server, to the existing chat logs table, with the parish when there is one (that column is already nullable). The browser stops writing its own copy for assistant chats.
- **Secrets:** the Gemini key lives in Supabase secrets in production and in the git-ignored functions env file locally. It is never committed (the repo is public) and never put in CI.

### Browser: Parish Assistant panel

- **It replaces the per-parish chatbot.** One global floating assistant mounted in the dashboard layout, shown only when the signed-in role is `user` (Parishioner).
- **Parish context:** the parish of the current page when on a parish page; otherwise the Parishioner's favourite parish; otherwise ask with parish chips. A visible parish chip in the panel header lets the Parishioner switch.
- **Message types rendered:** text replies (existing markdown rendering), chip rows, document upload cards, Booking summary/confirm card, ticket confirm card, hand-off buttons, and a "busy, try again" notice.
- **Document upload cards** come from the parish's requirements for the chosen service. Each one restricts the file chooser to that requirement's allowed file types, shows the attached file with replace/remove, and marks optional ones. Files stay in browser memory until Confirm, then go through the existing document upload.
- **Large-text toggle** in the panel header scales message text and makes chips at least 56px tall. The choice is a per-device preference stored in localStorage, with try/catch around every read and write.
- **Read aloud** uses the browser's built-in speech synthesis. It picks a Filipino voice for Tagalog replies when one exists and falls back to the default voice. The button is hidden when speech synthesis isn't supported. Markdown is stripped before speaking.
- **Fallback:** if the edge function fails or times out, plain questions fall back to the existing keyword fallback, and Booking continues with template wording.
- **Design:** follows the Sacralink design system. It uses the `.card` container, Faith Blue for actions including Confirm, Sacred Gold only for liturgical accents, and light mode by default with design tokens rather than hard-coded slate/black classes. It fits phone widths with no horizontal scroll.

### Rollout

- **Production keeps the old `church-ai-chat`** until the new web build ships. The mobile app also still calls `church-ai-chat`, so it is **not** retired in this effort.
- **Release order through `/release`:** set the `parish-assistant` secrets and deploy the function, then release the web build. No database migration is expected. If one turns out to be needed, it follows the standing migration rules.

## Testing Decisions

- **A good test here drives the real assistant panel and checks real outcomes in the database.** That means appointment rows, stored documents, notifications and tickets. It does not check AI wording, chip CSS or internal module calls. Tests must survive rewording of prompts and replies.
- **One seam:** the assistant panel in the browser, driven by Playwright against the local Docker Supabase, with the `parish-assistant` edge function served by the local stack. Gemini is replaced at its HTTP boundary by a scripted fake, reached through the base-URL environment variable. The fake returns canned text and canned function calls per scenario.
- **Specs (kept short, happy path, per the test workflow's "page crosses into the backend" rule):**
  1. **Chip booking:** a Parishioner books a Baptism using only chips, attaches the required documents on the upload cards, taps Confirm, and the test asserts a `pending` appointment with the requested priest stored as the preference, the documents stored, and the parish admins notified.
  2. **Own appointments only:** the fake asks for the caller's appointments; the test asserts that only that Parishioner's appointments reach the reply and another Parishioner's never do.
  3. **Ticket drafting:** the fake proposes a ticket draft; the Parishioner confirms, and the test asserts a Parish Office Ticket exists for that parish with the drafted subject and message.
- **Not tested with Playwright:** large text, read aloud, chip layout, panel placement and wording. Those are checked with `tsc -b`, lint and the local dev server, per the test workflow's rule for UI-only work.
- **Prior art:** the booking specs that drive the real booking page and assert database state (priest request, celebrant pool and availability specs), and the ticket specs (notifications, lanes), all using the shared e2e support helpers (`loginAs`, seeded users, service client, reset helpers).
- **CI:** the `e2e` workflow must serve the edge function and point it at the fake. No Gemini key is ever placed in CI.
- **Quota rule:** no test or eval calls the real Gemini API. A real-model check happens only when Tyrone explicitly asks, one prompt at a time.

## Out of Scope

- The assistant cancelling, rescheduling or otherwise changing an existing appointment (it hands off to the appointment screen instead).
- Direct Messages to priests or staff written by the assistant (it hands off to Messages).
- A staff-facing assistant for Church Admins, Priests, Volunteers or Super Admins.
- Voice input (speech recognition).
- Automatic re-embedding on save, and removing structured data from the knowledge sync. The manual Sync button stays as it is.
- Saving conversations on the server across devices (no sessions table).
- Retiring `church-ai-chat` or deleting the one-off `test-gemini-api` function from production.
- The mobile app.
- Payment or donation actions through the assistant.

## Further Notes

- **Volunteers** book personal appointments like Parishioners (see the glossary), but they don't get the assistant in this effort, by decision. Showing it to them later is a one-line role change.
- The vector index and existing knowledge content are kept. Structured answers no longer depend on the snapshot being fresh, which removes most stale-answer risk without touching the sync.
- The current production function runs with JWT verification off and logs with the service role. The new function closes that gap. The old one stays as it is until it is retired.
- ADR 0001 (appointment edits via database functions) is respected: the assistant only creates pending appointments through the existing creation path and never edits approved ones. ADR 0002 (messaging and ticket privacy) is respected: tickets are created through the existing database function, so visibility rules are unchanged.
- Usage today is small (about 100 exchanges in total across 4 parishes), so the free Gemini tier is expected to be enough. The server-side rate limit protects the quota during the defense demo.
