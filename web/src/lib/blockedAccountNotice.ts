/** sessionStorage key the login page reads to thank a person who just deleted their own account. */
export const BLOCKED_ACCOUNT_NOTICE_KEY = 'sacralink:blocked-account-notice';

/**
 * Query parameter on /login that says why an open tab was signed out. It travels in the URL rather than
 * sessionStorage because the sign-out first renders the login page inside the app and then reloads it; a
 * stored note is consumed by the first render and gone by the reload.
 */
export const BLOCKED_ACCOUNT_PARAM = 'blocked';

/** Shown at login when a suspended person is signed out or tries to sign in. */
export const SUSPENDED_ACCOUNT_MESSAGE = 'This account is suspended. Contact your parish office or the Super Admin.';

/** Shown at login when a deleted account is signed out of an open tab. */
export const DELETED_ACCOUNT_MESSAGE = 'This account has been deleted. You can no longer sign in with it.';

/** Shown at login right after a person deletes their own account; displayed as a success notice, not an error. */
export const SELF_DELETED_ACCOUNT_MESSAGE = 'Your account has been deleted. Thank you for being part of Sacralink.';
