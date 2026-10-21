# 06: Complete Parish Office Tickets lifecycle, Volunteer messaging scope, info panel cleanup, and live sidebar badges

Type: task
**Blocked by:** 05: Messaging and Parish Office Ticket privacy RLS, Staff Channel role filtering, and logout cache cleanup
**Status:** ready-for-agent

**What to build:** Complete the end-to-end Messages and Parish Office Tickets experience, enforce Volunteer messaging boundaries, remove hardcoded placeholders, and wire live notification badges in the sidebar:

1. **Create Parish Office Ticket directly from `/messages`**:
   - Allow Parishioners (`user`) and Volunteers (`volunteer`) to open a new Parish Office Ticket directly from `/messages` (via a `"New Ticket"` button that opens `ParishInquiryModal` with a parish selector when no parish is pre-selected, defaulting to the user's home/assigned parish if set).
2. **Ticket Status Filter & Closed State Lifecycle**:
   - Under the Tickets view on `/messages`, add status filter pills (`All`, `Open`, `In Progress`, `Resolved`, `Closed`).
   - When a ticket's `ticket_status` is `closed`, replace the message composer input with a locked banner (`"This inquiry ticket is closed"`) and a `"Reopen Ticket"` button (available to the requester and parish staff) that transitions `ticket_status` back to `open` and posts a system status note.
3. **Volunteer Messaging Scope**:
   - Allow Volunteers to access their parish's **Staff Channel**, view and triage incoming **Parish Office Tickets** for their assigned parish (replying and updating status to `in_progress` or `resolved`), and DM their own parish's Church Admin/Staff.
   - Prevent Volunteers from initiating cold 1-on-1 Direct Messages to parishioners (`user`) or priests (`priest`) in the New Message modal.
4. **Remove Hardcoded Info Panel Placeholder & Wire Live Sidebar Badges**:
   - Remove the hardcoded `'Baptism · Nov 11, 2026'` fallback from the right-hand conversation details panel in `MessagingPage` so the Appointment card only renders when a real appointment is linked (`selectedConv.appointment_id` / `selectedConv.appointment`).
   - In `DashboardLayout`, replace the hardcoded `badge: 12` on Appointments and `badge: 2` on Messages with live counts from Supabase (role-scoped pending appointments count and unread messages count, hiding the badge when the count is `0`).

- [ ] A Parishioner or Volunteer on `/messages` can click `"New Ticket"`, choose a parish, category, subject, and message, and land directly in the newly created Parish Office Ticket thread.
- [ ] Filtering tickets by `Open`, `In Progress`, `Resolved`, and `Closed` works on `/messages`, and a `closed` ticket locks the composer while offering a working `"Reopen Ticket"` button.
- [ ] A Volunteer on `/messages` can use their parish's Staff Channel, triage/reply to their parish's tickets (`in_progress` / `resolved`), and DM their parish's staff, but cannot cold-DM parishioners or priests.
- [ ] The right-hand conversation info panel never displays `'Baptism · Nov 11, 2026'` when no appointment is linked.
- [ ] Sidebar badges on Appointments and Messages show live counts (and disappear when `0`) instead of hardcoded `12` and `2`.
- [ ] E2E tests verify ticket creation from `/messages`, status filtering, closing/reopening a ticket, Volunteer messaging scope, and dynamic sidebar badges.
