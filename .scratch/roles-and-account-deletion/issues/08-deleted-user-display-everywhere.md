# 08: Deleted User display everywhere

Type: task
Status: ready-for-agent
**Blocked by:** 07

**What to build:** Wherever a person's name is rendered, a deleted account shows **Deleted User** with a small danger icon (lucide `TriangleAlert` or `CircleAlert`, red) whose hover and keyboard-focus tooltip says "Deleted user". Ticket 07 sets `profiles.full_name = 'Deleted User'` and `deleted_at`, so the name is already scrubbed in the data; this ticket adds the marker and makes sure no screen shows a blank, "Unnamed User" or a broken avatar.

- New shared component `web/src/components/ui/UserName.tsx` (props: `name`, `deletedAt`, optional `className`) that renders the name, or "Deleted User" plus the icon and tooltip when `deletedAt` is set. Use the project design tokens (`text-destructive`, `text-muted`), accessible (`aria-label="Deleted user"`, focusable tooltip, not hover-only).
- Include `deleted_at` in the profile selects and joins that feed names, then replace raw `full_name` renders with `UserName`. The 30 `.tsx` files that read `full_name` are the checklist; the ones that matter most: `pages/appointments/AppointmentsPage.tsx` (parishioner, celebrant), `components/appointments/{ApproveAppointmentModal,CelebrantPicker}.tsx`, `pages/donations/DonationsPage.tsx` and `components/donations/DonationDetailModal.tsx`, `pages/messages/MessagingPage.tsx` (message senders, conversation titles, avatars), `components/dashboard/{RecentActivityWidget,RecentAppointmentsWidget,CelebrantAttentionWidget,ParishAttentionWidget,DashboardCalendar}.tsx`, `pages/admin/{UsersPage,ParishApplicationsPage}.tsx`, `pages/churches/ChurchDetailPage.tsx` (audit trail and staff lists), and the appointment change history rows (`changed_by`).
- A **suspended** account (ticket 19) is not a Deleted User: it keeps its real name and avatar everywhere. Do not route `suspended_at` through `UserName`'s deleted state; ticket 19 and ticket 20 may add a separate small "Suspended" mark.
- Avatar fallback for a deleted user is the neutral initial/icon, never a stale image.
- Messages: a deleted sender's messages stay in place with the Deleted User label; direct conversations with a deleted user become read-only: the composer is disabled with the notice "This user is no longer available" (the database rule that rejects the message is in ticket 07, spec decision 38; ticket 12 reads the list flag for both deleted and suspended users).

- [ ] A deleted user's name appears as "Deleted User" with the danger icon in appointments, donations, messages, activity widgets, church staff lists and appointment history. Hovering or focusing the icon shows "Deleted user".
- [ ] No screen shows a blank name, "Unnamed User", "null" or the old email.
- [ ] A direct conversation with a deleted user cannot be written to: the composer is disabled with "This user is no longer available", and REST is rejected (ticket 07).
- [ ] Layout does not shift or overflow on mobile width (the repo has `responsive-no-horizontal-scroll.spec.ts`).

**Test plan** (local `deleted-user-display.spec.ts`; relies on the ticket 07 seeding helper): delete a parishioner who has an approved appointment, a donation and a message; as a Church Admin assert the label and icon on the appointment row and the donation row, and as the other conversation member assert the message sender label and the read-only composer. One test asserts the tooltip text. Three or four tests; wording and layout beyond that get no tests.
