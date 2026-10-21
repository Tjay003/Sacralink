# Specification: Appointment Editing

Status: resolved
Source: grill-with-docs session, 2026-10-21
Glossary: Celebrant, Reschedule, Appointment Change, Celebrated, Cancelled, Restore (see `CONTEXT.md`)
ADR: `docs/adr/0001-appointment-edits-via-database-functions.md`

---

## 1. Problem

On `main`, the parish office can no longer change the Celebrant of an approved appointment. The UI redesign (commit `4a30bec`) hid "Change celebrant" once a priest was assigned; `feature/demo-mode` still has it. Nothing in the app can mark an appointment Celebrated, Cancel it, or Reschedule it, even though the database status type allows `completed`, `cancelled` and `rescheduled`. As a result, the priest dashboard's "Celebrated this year" stat can never rise above 0, and past appointments stay "approved" forever.

Changing the celebrant today reuses the approve path, which re-sends the "approved" notification to the parishioner and never tells the previous priest they were removed.

## 2. Decisions

| # | Decision |
|---|----------|
| 1 | An approved appointment supports **Reschedule**, **Change celebrant**, **Mark celebrated** and **Cancel**. The office can **Restore** a Cancelled or Celebrated appointment to approved. |
| 2 | A reason is **required** for reschedule, celebrant change, cancel and restore. Mark celebrated takes an **optional** note. |
| 3 | A Reschedule keeps the **same appointment, still approved**. Date and time change in place. `rescheduled` is never used as a status. |
| 4 | A rescheduled appointment shows an amber **"Rescheduled from <old date>"** notice, with the reason on hover or tap. The parishioner, the celebrant and the office all see it. It disappears once the new date has passed, and the change history keeps it permanently. |
| 5 | Reschedule and celebrant change re-run the celebrant availability check (day off, leave, double booking, Canon 905 limits). A conflict is a **warning the office can override**. The office can switch celebrant in the same save as a reschedule. |
| 6 | **Notifications** (in-app): reschedule and cancel notify the parishioner and the current celebrant, with the reason. A celebrant change notifies the new priest (assigned) and the old priest (removed). Restore notifies the same people as the change it reverses. Mark celebrated notifies no one. |
| 7 | **Permissions**: the office (church admin, admin, super admin) can perform every action. A priest can only **mark his own** appointments celebrated. |
| 8 | The priest marks celebrations from today's timeline (once the start time has passed) and from "Needs celebrant attention", where past approved appointments he presided at appear as "Not yet marked celebrated". |
| 9 | The office UI is **one Edit modal**. The office picks an action, and only that action's fields plus the reason box appear. The approve modal goes back to handling **pending requests only**. |
| 10 | Every edit is stored as an **Appointment Change** row in a new change history table. `admin_feedback` is left untouched. |
| 11 | Edits are **database-enforced** through functions that write the change and its history row together. Church staff lose direct `UPDATE` on `appointments`, including for approve and reject (see ADR 0001). |
| 12 | Scope is **web only**. Mobile appointment write paths break once the lockdown lands. This is a known and accepted consequence. |

## 3. Working defaults (confirmed with the user)

- An appointment can't be rescheduled to a date in the past.
- The office and the appointment's celebrant can see its change history. The parishioner sees only the notices and their notifications.
- A cancelled appointment shows its cancellation reason on the parishioner's appointment card.

## 4. Out of scope

- The mobile app (iOS/Android) edit flows.
- Rescheduling a pending request. Pending requests are approved, rejected, or left to the parishioner.
- Automatically marking past appointments celebrated.
