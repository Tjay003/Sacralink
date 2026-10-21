# Map: Priest Ministry Suite

## Notes & Decisions
- Decision Q1: Pure Liturgical Celebrant role for `role = 'priest'`; dual-role Pastors use tab on `ChurchAdminDashboard`.
- Decision Q2: Multi-constraint scheduling engine with Canon 905 Mass limit check, blackout dates, and AI conflict explanations.
- Decision Q3: Parish sacramental archive search bound to Father's parish, reusing existing search & filter interfaces.
- Decision Q4: Zero-redundancy task queue reusing `ParishAttentionWidget` as the Celebrant Attention Queue.

## Issue Tracker

| Ticket | Title | Status | Type | Blocked By |
| :--- | :--- | :---: | :---: | :---: |
| [01](issues/01-priest-availability-and-blackout-schema.md) | Priest availability & blackout schema | `resolved` | task | — |
| [02](issues/02-celebrant-attention-queue-widget.md) | Celebrant attention queue widget | `resolved` | task | — |
| [03](issues/03-smart-canon-905-conflict-solver.md) | Smart Canon 905 conflict solver & assignment | `resolved` | task | — |
| [04](issues/04-priest-dashboard-layout-enhancement.md) | Priest dashboard layout & spiritual companion | `resolved` | task | — |


