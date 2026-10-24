// Phone number fields: keep only characters a Philippine number can contain, and check a mobile number's shape.

/** A Philippine mobile number is 11 digits: 09 followed by 9 more (also the GCash and Maya account format). */
export const MOBILE_NUMBER_LENGTH = 11;

/** Enough for a landline typed with formatting, e.g. "(044) 123-4567". */
export const MAX_LANDLINE_LENGTH = 20;

export const MOBILE_NUMBER_HINT = '11 digits starting with 09, e.g. 09171234567';

/** Digits only, cut to the 11 digits of a Philippine mobile number. */
export function toMobileDigits(value: string): string {
    return value.replace(/\D/g, '').slice(0, MOBILE_NUMBER_LENGTH);
}

/** Digits plus the formatting people type in landlines: spaces, dashes, parentheses and a leading +. */
export function toLandlineChars(value: string): string {
    return value.replace(/[^0-9()+\- ]/g, '').slice(0, MAX_LANDLINE_LENGTH);
}

/** Whether a value is a complete Philippine mobile number. */
export function isMobileNumber(value: string): boolean {
    return /^09\d{9}$/.test(value);
}
