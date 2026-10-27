// Phone number fields: keep only characters a Philippine number can contain, and check a mobile number's shape.

/** A Philippine mobile number is 11 digits: 09 followed by 9 more (also the GCash and Maya account format), or +639 followed by 9 more (13 chars). */
export const MOBILE_NUMBER_LENGTH = 11;
export const MOBILE_NUMBER_INTL_LENGTH = 13;

/** Enough for a landline typed with formatting, e.g. "(044) 123-4567". */
export const MAX_LANDLINE_LENGTH = 20;

export const MOBILE_NUMBER_HINT = '11 digits starting with 09 (e.g. 09171234567) or +639XXXXXXXXX';

/** Digits only, cut to the 11 digits of a Philippine mobile number. */
export function toMobileDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, MOBILE_NUMBER_LENGTH);
}

/** Digits plus the formatting people type in landlines: spaces, dashes, parentheses and a leading +. */
export function toLandlineChars(value: string): string {
    return value.replace(/[^0-9()+\- ]/g, '').slice(0, MAX_LANDLINE_LENGTH);
}

/**
 * Sanitizes input while typing to strictly allow only valid Philippine mobile number prefixes:
 * - '0' followed by '9' and up to 9 more digits (11 digits total: 09XXXXXXXXX)
 * - '+' followed by '6', '3', '9' and up to 9 more digits (13 chars total: +639XXXXXXXXX)
 * Blocks arbitrary non-prefix digit strings (e.g. starting with 1-8), non-numeric chars except leading '+',
 * and enforces length limits.
 */
export function sanitizePhilippineMobileInput(raw: string): string {
    if (!raw) return '';

    // Strip whitespace, hyphens, and any non-digit character except leading '+'
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith('+');
    const digitsOnly = trimmed.replace(/\D/g, '');

    // Case 1: International format starting with '+'
    if (hasPlus) {
        const expectedPrefix = '639';
        let valid = '+';
        for (let i = 0; i < digitsOnly.length && valid.length < MOBILE_NUMBER_INTL_LENGTH; i++) {
            const digit = digitsOnly[i];
            if (i < expectedPrefix.length) {
                if (digit === expectedPrefix[i]) {
                    valid += digit;
                } else {
                    // Mismatched prefix (e.g. +638 or +1)
                    break;
                }
            } else {
                valid += digit;
            }
        }
        return valid;
    }

    // Case 2: Local mobile format starting with '0'
    if (digitsOnly.startsWith('0')) {
        let valid = '0';
        for (let i = 1; i < digitsOnly.length && valid.length < MOBILE_NUMBER_LENGTH; i++) {
            const digit = digitsOnly[i];
            if (i === 1) {
                if (digit === '9') {
                    valid += digit;
                } else {
                    // Local mobile must start with 09
                    break;
                }
            } else {
                valid += digit;
            }
        }
        return valid;
    }

    // Any other arbitrary non-prefix starting digits (1-8) are blocked
    return '';
}

/**
 * Validates whether a value is a complete and valid Philippine mobile number:
 * Either 09XXXXXXXXX (11 digits) or +639XXXXXXXXX (13 chars).
 */
export function isValidPhilippineMobile(value: string | null | undefined): boolean {
    if (!value) return false;
    const clean = value.replace(/[\s-]/g, '');
    return /^09\d{9}$/.test(clean) || /^\+639\d{9}$/.test(clean);
}

/** Whether a value is a complete Philippine mobile number (alias for isValidPhilippineMobile). */
export function isMobileNumber(value: string): boolean {
    return isValidPhilippineMobile(value);
}
