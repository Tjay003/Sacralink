---
name: implement
description: "Implement a piece of work based on a spec or set of tickets."
disable-model-invocation: true
---

Implement the work described by the user in the spec or tickets.

Work in small, sequential batches (1–3 tickets at a time). Stop and report back to the user after completing each batch before moving to the next.

Run typechecking regularly (`tsc -b`). Run ONLY the single spec file for the ticket being built. Do NOT run the full test suite while building tickets.

Validate UI tickets through static typechecking and local dev inspection; write Playwright specs only for database rules (RLS), security, and core transactional state.

Commit your work to the current branch with clear, descriptive messages (no co-author trailers).
