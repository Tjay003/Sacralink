---
Status: accepted
---

# Appointment edits go through database functions that record a change history

Once an appointment is approved, every edit (reschedule, celebrant change, cancellation, marking it celebrated, restoring it) goes through a dedicated database function. Each function writes the status or schedule change and an Appointment Change row (action, reason, before and after values, who, when) in the same transaction. Direct `UPDATE` access on `appointments` is removed for church staff (church admin, admin, priest). Super admin keeps it for system-wide admin tooling. We chose this so that a reason and the change history can't be skipped, and because a row-level policy cannot limit a priest to changing only the status of his own appointments. That rule is enforced inside the function.

## Considered Options

- **Columns on `appointments`** (`rescheduled_from`, `change_reason`): simpler, but they only remember the latest change and overwrite earlier reasons.
- **Reusing `admin_feedback`**: no migration, but it mixes the office's approval note with edit history, and a "rescheduled" notice can't be detected reliably.
- **UI-only permission checks**: fastest, but any priest at the parish could still edit any appointment through the API.

## Consequences

- Approve and reject also move to functions, because direct updates are no longer allowed.
- The mobile app writes to `appointments` directly (admin approve and update, plus its own cancel path that writes the reason into the parishioner's notes). Those flows stop working until they are rebuilt on these functions. This was accepted knowingly, and the effort is scoped to web only.
