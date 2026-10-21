---
Status: accepted
---

# Enforce strict 1-on-1 Direct Message privacy and claimed Parish Office Ticket visibility at the database and storage seams

1-on-1 Direct Messages (`conversations` where `is_ticket = false` and not a parish `Staff Channel`) are strictly visible only to their two `conversation_participants` rows—removing the `super_admin` and `church_admin` RLS bypasses for private threads. Parish Office Tickets (`is_ticket = true`) are visible to the requesting parishioner and the target parish's staff (`church_admin` and `volunteer`) while `open`, and once claimed (`in_progress` / `resolved` / `closed` with a handler in `conversation_participants`), remain visible to the requester, the claiming staff handler, and the parish's `church_admin`. In addition, `getOrCreateChurchStaffChannel` filters strictly to staff roles (`church_admin`, `priest`, `volunteer`) so parishioners (`user`) with `church_id` set are never auto-enrolled in a parish's internal `Staff Channel`, and browser-cached ministry fallback keys (`sacralink_local_ministry_convs` and `sacralink_local_ministry_messages_*`) are cleared on `signOut()` and scoped by user ID.

## Considered Options

- **UI-only conversation filtering**: Hiding other users' chats in the React state while leaving the `super_admin` RLS bypass and broad `church_id` participant queries intact. Rejected because any account switch on the same browser or direct API query still leaks messages across accounts.
- **Shared inbox for all conversations**: Letting church admins read all DMs between parishioners and priests in their parish. Rejected because pastoral and personal 1-on-1 conversations require confidentiality; only categorized `Parish Office Ticket` threads belong in the parish office queue.

## Consequences

- `super_admin` and `church_admin` can no longer inspect another user's 1-on-1 Direct Messages; administrative oversight of parish inquiries happens exclusively through `Parish Office Ticket` threads.
- Existing `Staff Channel` participants rows that mistakenly included `role = 'user'` profiles are cleaned up by migration so parishioners only see their own DMs and tickets.
