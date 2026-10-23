# Release smoke checklist (5 minutes)

Run this on the **live site** right after `/release` reports the Vercel deploy as successful. It proves the
release reached production and the main screens still open with real data. The automated suites already
covered the logic; this catches what only production can show (env vars, real data, a migration that was
not applied, a stale cached build).

**Look, don't touch.** Production holds real parishes and people: do not submit bookings, donations,
messages, applications or edits here. Open forms and modals, then close them.

Keep the browser console open (F12, Console tab) the whole time. A red error is a fail even when the
page looks fine.

## 0. Before you start (30 seconds)

- [ ] Open the live site in a **private/incognito window** (no cached old build, no old session).
- [ ] The login page shows the Sacralink logo and the "Welcome Back" form.

## 1. Super Admin (1 minute)

- [ ] Signs in and lands on the dashboard; the stat tiles show numbers, not blanks or endless spinners.
- [ ] **Churches** lists the parishes; churches without a photo show the blue cover, not a broken image.
- [ ] **Parish applications** (`/admin/applications`) opens and lists applications.
- [ ] **Users** opens and lists accounts.
- [ ] Sign out returns to the login page.

## 2. Church Admin (1 minute)

- [ ] Signs in; the dashboard shows their own parish.
- [ ] **Appointments** lists real appointments; open one and close it again.
- [ ] **Messages** opens; the ticket list and one conversation load.
- [ ] Their church page opens, and **Edit** opens the form (close it without saving).
- [ ] Sign out.

## 3. Parishioner (1 minute)

- [ ] Signs in; the dashboard shows upcoming appointments or a clean empty state.
- [ ] Open a church page: Mass schedule, parish team and services show.
- [ ] Open **Book** for a sacrament: the form loads with dates and the service list (close it without submitting).
- [ ] **Donations** opens (close without donating).
- [ ] Sign out.

## 4. What you just released (1 minute)

- [ ] Open the screen this release changed and do the one thing it was for, as the role it was for,
      stopping before anything that writes data. For a database change, read the result instead
      (for example: the new column shows, the new rule hides what it should).

## If something fails

1. Screenshot it with the console visible, and note the role and the page.
2. If it breaks a demo or blocks people: tell Claude "roll back production". Claude moves
   `feature/demo-mode` back to the previous release commit (shown in the `/release` report) and asks
   before pushing. Migrations are not rolled back automatically.
3. Otherwise: tell Claude what failed; the fix goes through `main` and `/release` like any change.
