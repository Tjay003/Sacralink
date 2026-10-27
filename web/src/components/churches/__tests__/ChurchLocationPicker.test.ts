import { test, expect } from '@playwright/test';
import {
  SJDM_BOUNDS,
  DEFAULT_CSJDM_LAT,
  DEFAULT_CSJDM_LNG,
  MIN_SJDM_ZOOM,
  isWithinSjdmBounds,
} from '../ChurchLocationPicker';

test.describe('Ticket 03: ChurchLocationPicker SJDM Geo-Fence Unit Tests', () => {
  test('SJDM_BOUNDS and default center are accurately defined', () => {
    expect(SJDM_BOUNDS.south).toBe(14.7500);
    expect(SJDM_BOUNDS.north).toBe(14.9000);
    expect(SJDM_BOUNDS.west).toBe(120.9800);
    expect(SJDM_BOUNDS.east).toBe(121.1600);
    expect(MIN_SJDM_ZOOM).toBe(12);

    expect(DEFAULT_CSJDM_LAT).toBe(14.8135);
    expect(DEFAULT_CSJDM_LNG).toBe(121.0453);
    expect(isWithinSjdmBounds(DEFAULT_CSJDM_LAT, DEFAULT_CSJDM_LNG)).toBe(true);
  });

  test('isWithinSjdmBounds correctly validates points strictly inside San Jose del Monte', () => {
    // Center point
    expect(isWithinSjdmBounds(14.8135, 121.0453)).toBe(true);
    // Boundary edges
    expect(isWithinSjdmBounds(14.7500, 120.9800)).toBe(true);
    expect(isWithinSjdmBounds(14.9000, 121.1600)).toBe(true);
    expect(isWithinSjdmBounds(14.7500, 121.1600)).toBe(true);
    expect(isWithinSjdmBounds(14.9000, 120.9800)).toBe(true);
    // Tungkong Mangga approximate coords
    expect(isWithinSjdmBounds(14.7925, 121.0664)).toBe(true);
    // Muzon approximate coords
    expect(isWithinSjdmBounds(14.8091, 121.0028)).toBe(true);
  });

  test('isWithinSjdmBounds correctly rejects points outside San Jose del Monte', () => {
    // South of SJDM (Quezon City / Caloocan North)
    expect(isWithinSjdmBounds(14.7000, 121.0453)).toBe(false);
    // North of SJDM (Norzagaray / Santa Maria)
    expect(isWithinSjdmBounds(14.9500, 121.0453)).toBe(false);
    // West of SJDM (Marilao / Bocaue)
    expect(isWithinSjdmBounds(14.8135, 120.9200)).toBe(false);
    // East of SJDM (Rodriguez, Rizal / Sierra Madre)
    expect(isWithinSjdmBounds(14.8135, 121.2500)).toBe(false);
    // Manila
    expect(isWithinSjdmBounds(14.5995, 120.9842)).toBe(false);
    // International
    expect(isWithinSjdmBounds(40.7128, -74.0060)).toBe(false);
  });
});
