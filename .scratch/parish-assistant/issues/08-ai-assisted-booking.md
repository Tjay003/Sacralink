# 08: AI-assisted booking

Type: task
**Status:** resolved
**Blocked by:** 04, 06

**What to build:** the guided Booking feels like a conversation. A Parishioner can say "I want to book a baptism", answer in their own words, ask side questions, and change their mind. The guide stays in control.

- `parish-assistant` recognizes a booking intent and returns it, so the browser starts the guide (with the service pre-proposed when one was named).
- Each turn sends the Booking Draft's values and current step. Gemini returns a warm, short phrasing of the guide's question and, when the Parishioner typed an answer, a proposed value for the current field (for example, "sa Sabado ng umaga" becomes a date and time window).
- The browser checks every proposal with the booking rules before accepting it. A rejected proposal gets a plain explanation and alternative chips.
- A side question mid-booking ("what's a Pre-Jordan seminar?") is answered, then the guide asks its pending question again.
- "Change the date" (or any earlier field) clears that field and what depends on it, and the guide asks again.
- If Gemini is unavailable, the guide falls back to template wording and chips (ticket 06 behaviour).

- [x] "I want to book a baptism" starts the guide at the date step with Baptism selected
- [x] A typed answer that the fake Gemini maps to a taken slot is rejected with alternatives; a free one is accepted
- [x] A side question is answered and the booking resumes at the same step
- [x] Changing an earlier answer re-asks it and dependent fields
- [x] Replies match the Parishioner's language (English, Tagalog, Taglish)
- [x] `tsc -b` and lint are clean
