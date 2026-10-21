# 01: Branding text updates, numeric-only donation amount input, and hiding raw coordinates for parishioners/volunteers

Type: task
**Blocked by:** None (can start immediately)
**Status:** ready-for-agent

**What to build:** Polish four user-facing UI details requested by the client across the sidebar layout, Parishes directory, Church Details page, and Cashless Donation modal:

1. **Top-left brand subtitle**: Change the sidebar brand subtitle from `"Diocese of San Jose del Monte"` to `"Parishes of San Jose del Monte"` with proper capitalization.
2. **Parishes tab subtitle removal**: Remove the `"Manage the five parishes of the Diocese of San Jose del Monte"` subtitle text inside the Parishes page header.
3. **Strict numeric-only Donation amount input**: Prevent users from typing letters or non-numeric characters (`e`, `E`, `+`, `-`) into the Donation amount input box, and sanitize pasted text so only digits and at most one decimal point are accepted.
4. **Hide raw coordinates for Parishioner & Volunteer roles**: On the Church Details page map preview, hide the raw `📍 lat, lng` coordinate badge for `user` and `volunteer` roles while keeping the interactive OpenStreetMap embed and `"Open in OpenStreetMap"` button visible.

- [ ] Top-left brand subtitle in the main layout reads `"Parishes of San Jose del Monte"`.
- [ ] The `"Manage the five parishes of the Diocese of San Jose del Monte"` text is no longer rendered on `/churches`.
- [ ] Typing letters or `e`, `E`, `+`, `-` in the Donation amount input is blocked, and pasting non-numeric strings strips non-numeric characters.
- [ ] A Parishioner (`user`) or Volunteer (`volunteer`) viewing `/churches/:id` sees the map preview and `"Open in OpenStreetMap"` button but does not see the `📍 lat, lng` coordinate overlay badge; `church_admin`, `priest`, `admin`, and `super_admin` still see it.
- [ ] E2E test verifies all four behaviors, and `tsc -b` + `vite build` pass cleanly.
