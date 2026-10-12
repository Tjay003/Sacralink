/**
 * Auth Rate Limiter
 * Provides client-side progressive delay and lockout mechanisms to protect
 * login and registration flows against brute-force attacks, credential stuffing, and bot hammering.
 */

interface RateLimitRecord {
    attempts: number;
    lastAttemptTime: number;
    lockoutUntil: number;
}

const LOGIN_STORAGE_KEY = 'sacralink_auth_login_ratelimit_v1';
const REGISTER_STORAGE_KEY = 'sacralink_auth_register_ratelimit_v1';

// Login rules
const MAX_FREE_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Registration rules: max 3 registrations per 10 minutes per device
const MAX_REGISTER_ATTEMPTS = 3;
const REGISTER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getStorageMap(key: string): Record<string, RateLimitRecord> {
    try {
        const item = localStorage.getItem(key);
        if (!item) return {};
        return JSON.parse(item);
    } catch {
        return {};
    }
}

function saveStorageMap(key: string, data: Record<string, RateLimitRecord>) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch {
        // LocalStorage quota or access error
    }
}

/**
 * Calculates progressive lockout duration based on consecutive failed attempts.
 */
function calculateLockoutDuration(attempts: number): number {
    if (attempts >= 12) return 15 * 60 * 1000; // 15 minutes lockout
    if (attempts >= 8) return 5 * 60 * 1000;   // 5 minutes lockout
    if (attempts >= MAX_FREE_LOGIN_ATTEMPTS) return 60 * 1000; // 60 seconds cooldown
    return 0;
}

/**
 * Checks current login status for an identifier (email / username).
 */
export function checkLoginRateLimit(identifier: string): {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
} {
    if (!identifier) {
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    const key = identifier.trim().toLowerCase();
    const map = getStorageMap(LOGIN_STORAGE_KEY);
    const record = map[key];

    if (!record) {
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    const now = Date.now();

    // Check if within window
    if (now - record.lastAttemptTime > LOGIN_WINDOW_MS && record.lockoutUntil <= now) {
        // Window expired, reset
        delete map[key];
        saveStorageMap(LOGIN_STORAGE_KEY, map);
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    if (record.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
        return {
            isLocked: true,
            remainingSeconds,
            attempts: record.attempts,
        };
    }

    return {
        isLocked: false,
        remainingSeconds: 0,
        attempts: record.attempts,
    };
}

/**
 * Records a failed login attempt and calculates whether a lockout is triggered.
 */
export function recordFailedLogin(identifier: string): {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
} {
    if (!identifier) {
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    const key = identifier.trim().toLowerCase();
    const map = getStorageMap(LOGIN_STORAGE_KEY);
    const now = Date.now();

    const existing = map[key];
    let attempts = 1;

    if (existing && now - existing.lastAttemptTime <= LOGIN_WINDOW_MS) {
        attempts = existing.attempts + 1;
    }

    const lockoutMs = calculateLockoutDuration(attempts);
    const lockoutUntil = lockoutMs > 0 ? now + lockoutMs : 0;

    map[key] = {
        attempts,
        lastAttemptTime: now,
        lockoutUntil,
    };

    saveStorageMap(LOGIN_STORAGE_KEY, map);

    const remainingSeconds = lockoutMs > 0 ? Math.ceil(lockoutMs / 1000) : 0;

    return {
        isLocked: lockoutMs > 0,
        remainingSeconds,
        attempts,
    };
}

/**
 * Clears failed login attempts after a successful authentication.
 */
export function recordSuccessfulLogin(identifier: string) {
    if (!identifier) return;
    const key = identifier.trim().toLowerCase();
    const map = getStorageMap(LOGIN_STORAGE_KEY);
    if (map[key]) {
        delete map[key];
        saveStorageMap(LOGIN_STORAGE_KEY, map);
    }
}

/**
 * Checks if client is currently rate limited from creating new accounts.
 */
export function checkRegistrationRateLimit(): {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
} {
    const map = getStorageMap(REGISTER_STORAGE_KEY);
    const record = map['global_client'];

    if (!record) {
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    const now = Date.now();

    if (now - record.lastAttemptTime > REGISTER_WINDOW_MS && record.lockoutUntil <= now) {
        delete map['global_client'];
        saveStorageMap(REGISTER_STORAGE_KEY, map);
        return { isLocked: false, remainingSeconds: 0, attempts: 0 };
    }

    if (record.lockoutUntil > now) {
        const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
        return {
            isLocked: true,
            remainingSeconds,
            attempts: record.attempts,
        };
    }

    return {
        isLocked: false,
        remainingSeconds: 0,
        attempts: record.attempts,
    };
}

/**
 * Records a registration attempt. If the maximum allowed attempts within the window
 * is reached, locks out registration on this client.
 */
export function recordRegistrationAttempt(): {
    isLocked: boolean;
    remainingSeconds: number;
    attempts: number;
} {
    const map = getStorageMap(REGISTER_STORAGE_KEY);
    const now = Date.now();
    const existing = map['global_client'];
    let attempts = 1;

    if (existing && now - existing.lastAttemptTime <= REGISTER_WINDOW_MS) {
        attempts = existing.attempts + 1;
    }

    let lockoutUntil = 0;
    if (attempts >= MAX_REGISTER_ATTEMPTS) {
        // Lock out for remaining of window (10 minutes)
        lockoutUntil = now + REGISTER_WINDOW_MS;
    }

    map['global_client'] = {
        attempts,
        lastAttemptTime: now,
        lockoutUntil,
    };

    saveStorageMap(REGISTER_STORAGE_KEY, map);

    const remainingSeconds = lockoutUntil > now ? Math.ceil((lockoutUntil - now) / 1000) : 0;

    return {
        isLocked: remainingSeconds > 0,
        remainingSeconds,
        attempts,
    };
}
