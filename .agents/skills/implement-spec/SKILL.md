---
name: implement-spec
description: "Implement a specification in code."
disable-model-invocation: true
---

You have been provided a spec. This spec should have tickets associated with it, describing how to implement the spec.

The goal is a clean, verified implementation on a single feature branch.

The tickets form a dependency graph. Process them in small, controlled waves (1–3 tickets at a time).

## Critical Guidelines
- **Sequential Database Work:** Never run parallel subagents if more than one touches the database, runs migrations, or modifies Supabase schema. Run database changes sequentially to prevent migration version clashing.
- **Fast Static Validation:** Subagents must validate primarily via static typechecking (`tsc -b`) and linting. Do not let child agents run full Playwright browser suites.
- **Stop Between Waves:** After completing a wave (1–3 tickets), verify diff, commit cleanly, and pause to report back to the user before grabbing the next wave.

## Steps

1. Read the spec and tickets to understand the dependency order.
2. Ensure you are on the correct staging/testing branch (`main` or dedicated feature branch from `main`).
3. Implement tickets in sequential dependency order. Small tickets can be built directly in the main session.
4. For database/RLS changes, test locally against Docker Supabase using only the single relevant spec file (`npx playwright test -c playwright.local.config.ts e2e-local/<file>.spec.ts`).
5. After completing the wave, run `tsc -b`, commit with clear messages (no co-author trailers), and report progress.
