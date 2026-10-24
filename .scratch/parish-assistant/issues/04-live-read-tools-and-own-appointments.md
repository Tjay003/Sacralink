# 04: Live read tools, and "my appointments" shows only your own

Type: task
**Status:** ready-for-agent
**Blocked by:** 03

**What to build:** the Parishioner can ask the assistant any structured parish question and about their own appointments, and get live answers in their language.

- Tools added to `parish-assistant`, all running as the caller: list parishes; find Mass across parishes by day and time; bookable services for a parish (the parish's own names); sacrament requirements for a parish's service; slot check (free? can a priest preside?); priest availability as yes/no only; the caller's own appointments with status, schedule and any rescheduled notice; free-text knowledge search over the existing vector store. Knowledge search may use the service role only if the vector-search function cannot be called as the caller, and then only for that parish's public content.
- Prompt rules: live tools first for structured questions, knowledge search for free text; reply in English, Tagalog, or Tagalog for Taglish; formal, short, lists for schedules and requirements; parish-related only; never invent details. When the answer isn't known, say so and give the parish contact.
- No tool ever returns a priest's leave or blackout reason.

- [ ] Each tool answers from live data for the current parish (or across parishes for the Mass search)
- [ ] "Is Father X available Saturday at 9?" gets a yes/no and never a reason, even when a leave reason exists in the database
- [ ] A Playwright spec with the fake Gemini asks for "my appointments" as Parishioner A and asserts A's appointments appear and Parishioner B's never do (spec test #2)
- [ ] Free-text questions still answer from the synced knowledge sections
- [ ] `tsc -b` and lint are clean
