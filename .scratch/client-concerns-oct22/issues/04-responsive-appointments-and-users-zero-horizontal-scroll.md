# 04: Zero-horizontal-scroll responsive layouts for Appointments table and Users directory

Type: task
**Blocked by:** 03: Volunteer dashboard cleanup, personal-only sacrament appointments, and parish/QR edit restrictions
**Status:** ready-for-agent

**What to build:** Redesign the responsive layouts of the Appointments page (`/appointments`) and the Users directory page (`/users`) so that neither page ever triggers a horizontal scrollbar on any screen size (mobile `375px`, tablet `768px`, laptop `1024px`/`1280px`, and desktop `1440px+`):

1. **Appointments Table (`/appointments`)**:
   - Remove `overflow-x-auto` and `min-w-[800px] lg:min-w-[920px]` from the desktop table container.
   - Use responsive stacked cards below `lg` (`< 1024px`) and a fluid `w-full table-fixed` 4-column table on `lg+` (`>= 1024px`):
     1. **Sacrament & Parish** (sacrament icon, title, and wrapping/truncating parish name)
     2. **Parishioner & Candidate** (candidate/intention name, requester name, documents link, and notes)
     3. **Schedule & Celebrant** (date, time, rescheduled notice, assigned celebrant, and preferred priest note)
     4. **Status & Actions** (status badge and compact wrapping action buttons so rows never overflow horizontally)
2. **Users Directory (`/users`)**:
   - Remove `overflow-x-auto` from the desktop flat table mode and ensure the grouped accordion view also wraps cleanly on all widths.
   - Use the responsive 1/2-column card grid below `lg` (`< 1024px`) and a fluid `w-full table-fixed` 4-column table on `lg+` (`>= 1024px`):
     1. **User & Email** (avatar, full name, and wrapping/truncating email stacked in one cell)
     2. **Role & Assigned Parish** (role/clergy badges stacked above the assigned parish link/tooltip)
     3. **Registered** (registration date)
     4. **Actions** (compact wrapping action buttons for Edit Role / Transfer Ownership)

- [ ] Neither `/appointments` nor `/users` uses `overflow-x-auto` or fixed `min-w-[...]` table constraints that force horizontal scrolling.
- [ ] Across viewports `375px`, `768px`, `1024px`, `1280px`, and `1440px`, both `/appointments` and `/users` satisfy `document.documentElement.scrollWidth <= document.documentElement.clientWidth` and have zero horizontally overflowing table containers.
- [ ] All sorting, filtering, document viewing, role editing, and appointment actions remain accessible on both desktop table rows (`lg+`) and mobile/tablet cards (`< lg`).
- [ ] E2E test verifies zero horizontal scroll across mobile, tablet, laptop, and desktop viewports for both `/appointments` and `/users`.
- [ ] Typecheck and build stay green.
