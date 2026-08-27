# 03 - Setup Playwright Automated Multi-Role E2E Testing

Status: ready-for-agent
Type: task
Blocked by: none

## Description
Configure Playwright in `web/` to automate multi-role verification across all user personas:
1. Super Admin login & administration flow (`user1@gmail.com`).
2. Church Admin login & parish management flow (`user2@gmail.com`).
3. Parishioner login & booking/viewing flow (`user6@gmail.com`).
4. Add npm script `npm run test:e2e` for fast, headless multi-user regression runs.

## Acceptance Criteria
- 1-command test execution runs all 3 roles headlessly in seconds.
- Regression tests for appointments, donations, and announcements feeds.
