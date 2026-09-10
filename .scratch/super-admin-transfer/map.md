# Map: Single Super Admin & Ownership Transfer

## Notes & Decisions
- Super Admin role is unique and singular ($\le 1$ in the system).
- Super Admin role cannot be assigned through standard role selectors; it can only be transferred by the incumbent Super Admin.
- The transfer is atomic in PostgreSQL (`SECURITY DEFINER` function).
- Database has a partial unique index on `profiles(role) WHERE role = 'super_admin'`.

## Task List
- [x] [`01-database-constraint-and-transfer-rpc.md`](./issues/01-database-constraint-and-transfer-rpc.md)
- [x] [`02-remove-super-admin-from-role-pickers.md`](./issues/02-remove-super-admin-from-role-pickers.md)
- [x] [`03-transfer-ownership-modal-and-ui.md`](./issues/03-transfer-ownership-modal-and-ui.md)
- [x] [`04-e2e-and-security-verification.md`](./issues/04-e2e-and-security-verification.md)
