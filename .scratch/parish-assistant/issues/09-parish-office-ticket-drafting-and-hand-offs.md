# 09: Parish Office Ticket drafting and hand-off buttons

Type: task
**Status:** ready-for-agent
**Blocked by:** 04

**What to build:** a Parishioner can reach a person through the assistant, and is sent to the right screen for things the assistant doesn't do.

- "I want to talk to the parish office" (or any answer the assistant doesn't know, offered as "Want me to send this to the parish office?") returns a ticket intent with a drafted category, subject and message from the conversation.
- The browser shows an editable confirm card. Confirm calls the existing ticket creation function for the current parish's office lane under the Parishioner's session. Success shows a link to the ticket. Database errors (for example, a ticket limit or no Church Admin) are shown in plain language with the parish contact.
- Cancel or reschedule requests get a button that opens that appointment. Messaging requests get a button to Messages. The assistant never cancels, reschedules or sends messages itself.

- [ ] A drafted ticket can be edited before Confirm, and nothing is created without Confirm
- [ ] A Playwright spec with the fake Gemini confirms a drafted ticket and asserts a Parish Office Ticket exists for that parish with the subject and message (spec test #3)
- [ ] "Cancel my wedding booking" shows a button to that appointment and changes nothing
- [ ] `tsc -b` and lint are clean
