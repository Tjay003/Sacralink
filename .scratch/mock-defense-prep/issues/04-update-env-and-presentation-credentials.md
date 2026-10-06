# Issue 04: Update .env & Presentation Credentials

Type: task
Status: resolved
Blocked by: 

---

## 1. Description
The `web/.env` file currently contains outdated comments that incorrectly label `user6@gmail.com` as a "Regular user", which traps the presenter with an unassigned parish error when logging in during presentations.

Update `web/.env` with the verified demo credentials verified against Supabase Cloud:
- Super Admin: `user1@gmail.com` / `Lolgamers_123`
- Church Admin / Priest (La Salette): `user2@gmail.com` / `lolgamers123`
- Parishioner: `user5@gmail.com` / `lolgamers123`
- Volunteer: `user3@gmail.com` / `lolgamers123`

---

## 2. Acceptance Criteria
- [x] `web/.env` updated with accurate comments and verified demo accounts.

---

## 3. Resolution
- Formatted `web/.env` credentials section with standard shell comment `#` syntax.
- Documented verified credentials matching live Supabase auth records.
- Replaced invalid `user6` entry with `user5@gmail.com` (Maria Cruz).
