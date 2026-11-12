import { test, expect } from '@playwright/test';
import { isWeddingService } from '../supabase/serviceTypes';
import { getMinBookableDate } from '../recommender';
import {
    validateFutureDate,
    validateBookingSubmission,
    ADVANCE_BOOKING_ERROR_MESSAGE,
    WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE,
} from '../supabase/appointments';
import { getFutureDateCandidates } from '../bookingGuide';

test.describe('Wedding Scheduling Rule (At least 1 week / 7 days in advance)', () => {
    test.describe('isWeddingService', () => {
        test('identifies weddings by service kind', () => {
            expect(isWeddingService('wedding', 'Any Custom Title')).toBe(true);
            expect(isWeddingService('Wedding', 'Something Else')).toBe(true);
            expect(isWeddingService('WEDDING', null)).toBe(true);
        });

        test('identifies weddings by service name when kind is missing or custom', () => {
            expect(isWeddingService(null, 'Wedding Mass')).toBe(true);
            expect(isWeddingService(undefined, 'Holy Matrimony')).toBe(true);
            expect(isWeddingService('', 'Sacrament of Marriage')).toBe(true);
            expect(isWeddingService(null, 'Kasalang Bayan')).toBe(true);
            expect(isWeddingService(null, 'kasal')).toBe(true);
            expect(isWeddingService(null, 'matrimonio')).toBe(true);
        });

        test('returns false for non-wedding services', () => {
            expect(isWeddingService('baptism', 'Holy Baptism')).toBe(false);
            expect(isWeddingService('funeral', 'Funeral Mass')).toBe(false);
            expect(isWeddingService('confirmation', 'Confirmation')).toBe(false);
            expect(isWeddingService(null, 'House Blessing')).toBe(false);
            expect(isWeddingService(null, 'Special Thanksgiving Mass')).toBe(false);
            expect(isWeddingService(null, null)).toBe(false);
            expect(isWeddingService(undefined, undefined)).toBe(false);
            expect(isWeddingService('', '')).toBe(false);
        });
    });

    test.describe('getMinBookableDate', () => {
        test('returns 1 day ahead by default', () => {
            const fixedDate = new Date(2026, 5, 10, 12, 0, 0); // June 10, 2026
            const minDate = getMinBookableDate(fixedDate);
            expect(minDate).toBe('2026-06-11');
        });

        test('returns 7 days ahead for weddings', () => {
            const fixedDate = new Date(2026, 5, 10, 12, 0, 0); // June 10, 2026
            const weddingMinDate = getMinBookableDate(fixedDate, { isWedding: true });
            expect(weddingMinDate).toBe('2026-06-17');
        });

        test('supports numeric daysAhead and options object', () => {
            const fixedDate = new Date(2026, 5, 10, 12, 0, 0); // June 10, 2026
            expect(getMinBookableDate(fixedDate, 7)).toBe('2026-06-17');
            expect(getMinBookableDate(fixedDate, { daysAhead: 7 })).toBe('2026-06-17');
            expect(getMinBookableDate(fixedDate, { isWedding: false })).toBe('2026-06-11');
        });
    });

    test.describe('validateFutureDate', () => {
        const baseNow = new Date(2026, 5, 10, 12, 0, 0); // 2026-06-10

        test('allows 1+ day advance for general (non-wedding) appointments', () => {
            // Tomorrow (+1 day)
            const tomorrowRes = validateFutureDate('2026-06-11', '10:00', baseNow);
            expect(tomorrowRes.ok).toBe(true);

            // 6 days ahead
            const sixDaysRes = validateFutureDate('2026-06-16', '10:00', baseNow);
            expect(sixDaysRes.ok).toBe(true);
        });

        test('rejects same day or past date for general appointments', () => {
            // Same day
            const sameDayRes = validateFutureDate('2026-06-10', '10:00', baseNow);
            expect(sameDayRes.ok).toBe(false);
            expect(sameDayRes.error).toBe(ADVANCE_BOOKING_ERROR_MESSAGE);

            // Past date
            const pastRes = validateFutureDate('2026-06-09', '10:00', baseNow);
            expect(pastRes.ok).toBe(false);
            expect(pastRes.error).toBe(ADVANCE_BOOKING_ERROR_MESSAGE);
        });

        test('enforces 7-day advance booking requirement for weddings', () => {
            // 1 day ahead -> rejected
            const day1 = validateFutureDate('2026-06-11', '10:00', baseNow, { isWedding: true });
            expect(day1.ok).toBe(false);
            expect(day1.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);

            // 3 days ahead -> rejected
            const day3 = validateFutureDate('2026-06-13', '10:00', baseNow, { isWedding: true });
            expect(day3.ok).toBe(false);
            expect(day3.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);

            // 6 days ahead -> rejected
            const day6 = validateFutureDate('2026-06-16', '10:00', baseNow, { isWedding: true });
            expect(day6.ok).toBe(false);
            expect(day6.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);

            // Exactly 7 days ahead (2026-06-17) -> accepted
            const day7 = validateFutureDate('2026-06-17', '10:00', baseNow, { isWedding: true });
            expect(day7.ok).toBe(true);

            // 14 days ahead -> accepted
            const day14 = validateFutureDate('2026-06-24', '10:00', baseNow, { isWedding: true });
            expect(day14.ok).toBe(true);
        });

        test('auto-detects wedding service by serviceType or serviceKind in options', () => {
            // By name 'Holy Matrimony'
            const matrimonyRes = validateFutureDate('2026-06-13', '10:00', baseNow, {
                serviceType: 'Holy Matrimony',
            });
            expect(matrimonyRes.ok).toBe(false);
            expect(matrimonyRes.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);

            // By kind 'wedding'
            const weddingKindRes = validateFutureDate('2026-06-13', '10:00', baseNow, {
                serviceKind: 'wedding',
            });
            expect(weddingKindRes.ok).toBe(false);
            expect(weddingKindRes.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);

            // By Filipino name 'Kasal'
            const kasalRes = validateFutureDate('2026-06-13', '10:00', baseNow, {
                serviceType: 'Kasalang Bayan',
            });
            expect(kasalRes.ok).toBe(false);
            expect(kasalRes.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);
        });
    });

    test.describe('validateBookingSubmission', () => {
        const baseNow = new Date(2026, 5, 10, 12, 0, 0); // 2026-06-10

        test('rejects wedding booking submission with less than 7 days lead time', () => {
            const result = validateBookingSubmission(
                {
                    appointmentDate: '2026-06-13', // +3 days ahead
                    appointmentTime: '10:00',
                    isWedding: true,
                    serviceType: 'Wedding Ceremony',
                    availability: true,
                    requirements: [],
                },
                baseNow
            );
            expect(result.ok).toBe(false);
            expect(result.error).toBe(WEDDING_ADVANCE_BOOKING_ERROR_MESSAGE);
        });

        test('accepts wedding booking submission with 7+ days lead time', () => {
            const result = validateBookingSubmission(
                {
                    appointmentDate: '2026-06-17', // exactly 7 days ahead
                    appointmentTime: '10:00',
                    isWedding: true,
                    serviceType: 'Wedding Ceremony',
                    availability: true,
                    requirements: [],
                },
                baseNow
            );
            expect(result.ok).toBe(true);
        });

        test('accepts non-wedding booking submission with 1+ day lead time', () => {
            const result = validateBookingSubmission(
                {
                    appointmentDate: '2026-06-11', // tomorrow
                    appointmentTime: '10:00',
                    serviceType: 'Baptism',
                    availability: true,
                    requirements: [],
                },
                baseNow
            );
            expect(result.ok).toBe(true);
        });
    });

    test.describe('getFutureDateCandidates for booking guide', () => {
        test('generates candidate dates starting 7 days ahead when isWedding is true', () => {
            const candidates = getFutureDateCandidates(7, { isWedding: true });
            expect(candidates.length).toBe(7);

            // Ensure every generated candidate passes validateFutureDate for wedding
            for (const cand of candidates) {
                const validation = validateFutureDate(cand.date, undefined, undefined, { isWedding: true });
                expect(validation.ok).toBe(true);
            }
        });

        test('generates candidate dates starting tomorrow by default', () => {
            const candidates = getFutureDateCandidates(7);
            expect(candidates.length).toBe(7);

            // Default candidates pass normal validateFutureDate
            for (const cand of candidates) {
                const validation = validateFutureDate(cand.date);
                expect(validation.ok).toBe(true);
            }
        });
    });
});
