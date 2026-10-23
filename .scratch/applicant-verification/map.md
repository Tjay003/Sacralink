# Map: Applicant verification for parish applications

Spec: `spec.md` (decisions locked 2026-10-24). Tickets in `issues/`. Database work is sequential, one agent at a time; production migrations from the main conversation only.

## Dependency graph
```
01 -> 02 -> 03
```

## Tasks
- [x] 01 Applicant verification data, private storage and approval rule
- [x] 02 Applicant section on the application form (after 01)
- [x] 03 Super Admin reviews the applicant (after 01, 02)

## Decisions (all defaults accepted 2026-10-24)
1. Which proof of identity counts, and is the selfie required? (default: any government photo ID plus a selfie holding it)
2. How long are the ID images kept after the decision? (default: delete 30 days after approval or final rejection)
3. May a rejected applicant resubmit on the same application? (default: yes, the failed part only, up to 3 times)
