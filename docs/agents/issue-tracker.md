# Issue tracker: Local Markdown

Issues, specs, and task tickets for this repo live entirely as markdown files in `.scratch/`.

## Conventions

- One feature / effort per directory: `.scratch/<feature-slug>/`
- The specification is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered sequentially from `01` (e.g. `01-create-announcements-module.md`), never a single combined file.
- Triage state is recorded as a `Status:` header line near the top of each issue file (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`, `claimed`, `resolved`).
- Comments and discussion append to the bottom of the file under a `## Comments` heading.

## Archiving finished efforts

- Archive a whole effort, never a single ticket. Move `.scratch/<feature-slug>/` to `.scratch/archive/<feature-slug>/` only when **every** ticket in it has `Status: resolved` (or `wontfix`).
- Leave resolved tickets in place while any ticket in their effort is still open. "Blocked by" and frontier scans look for blocker files in the same `issues/` folder, so moving one early makes its dependents look permanently blocked.
- Archived efforts stay in git and are still worth reading for past decisions and resolutions. Skills skip `.scratch/archive/` when looking for open work.

## When a skill says "publish to the issue tracker"

Create a new markdown ticket file under `.scratch/<feature-slug>/issues/` (creating directories if needed).

## When a skill says "fetch the relevant ticket"

Read the markdown ticket file at the referenced path in `.scratch/<feature-slug>/issues/`.

## Wayfinding operations

Used by `/wayfinder` and task runners. The **map** is a file with one **child** file per ticket:

- **Map**: `.scratch/<effort>/map.md` (holding Notes, Decisions-so-far, and the task list).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`. A `Type:` line records the ticket type (`research` / `prototype` / `grilling` / `task`); a `Status:` line records `claimed` / `resolved`.
- **Blocking**: A `Blocked by: NN, NN` line near the top. A ticket is unblocked when every ticket file it lists has `Status: resolved`.
- **Frontier**: Scan `.scratch/<effort>/issues/` for files that are unblocked and unclaimed; lowest number wins.
- **Claim**: Set `Status: claimed` before beginning implementation.
- **Resolve**: Append the implementation outcome under an `## Answer` or `## Resolution` heading, set `Status: resolved`, and append a decision pointer to `map.md`.
