# 06: Book by tapping chips (services without documents)

Type: task
**Status:** resolved
**Blocked by:** 02, 03

**What to build:** a Parishioner taps "Book a sacrament" and completes a Booking using only chips, ending with a pending appointment. This works without Gemini.

- **Booking Guide (browser):** a Booking Draft (parish, service type, date, time, requested priest or "any", notes, current step) saved to sessionStorage. The guide always asks for the first missing or invalid field in the fixed order: service → date → time → preferred priest → notes → summary. Documents are added in ticket 07.
- **Chips from live data:** the parish's bookable services; the next open dates; open times for the chosen date; the parish's clergy plus "Any available priest". When an answer is rejected, alternatives come from the next-available-slot recommender.
- **Rules:** every value is checked with the booking rules from ticket 02 before it enters the draft. A requested priest who is unavailable gets a warning without a reason and does not block.
- **Wording:** plain template questions in the conversation's language. Gemini phrasing comes in ticket 08.
- **Summary card:** shows every choice, with change and cancel buttons. Confirm calls the existing appointment creation (pending, notify the parish admins) under the Parishioner's session, and is disabled while submitting. Success shows a link to the appointment. Failure (for example, the slot was just taken) explains the problem and offers alternatives.

- [x] A service with no required documents can be booked end to end with chips only
- [x] A taken slot or past date is never offered as a chip
- [x] Refreshing the page mid-booking keeps the progress
- [x] Double-tapping Confirm creates one appointment
- [x] One short Playwright spec books with chips and asserts a `pending` appointment with the requested priest stored as the preference (not the Celebrant) and the parish admins notified
- [x] `tsc -b` and lint are clean
