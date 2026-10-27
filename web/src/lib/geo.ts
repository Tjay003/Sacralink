/**
 * Geographical Calculation Utilities using the Haversine Formula
 * Earth Mean Radius: 6,371 km
 */

export const EARTH_RADIUS_KM = 6371;

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the great-circle distance between two geographic coordinates on Earth
 * using the Haversine formula.
 *
 * Formula:
 *   a = sin²(Δlat / 2) + cos(lat1) * cos(lat2) * sin²(Δlon / 2)
 *   c = 2 * atan2(√a, √(1−a))
 *   d = R * c
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in kilometers
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Formats a distance in kilometers to a human-readable string.
 * Examples: "3.2 km away", "850 m away", "0.5 km away"
 *
 * @param distanceKm Distance in kilometers
 * @returns Human-readable formatted string
 */
export function formatDistance(distanceKm: number): string {
  if (typeof distanceKm !== 'number' || isNaN(distanceKm) || distanceKm < 0) {
    return '0 km away';
  }

  if (distanceKm < 0.1) {
    const meters = Math.round(distanceKm * 1000);
    return `${meters} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
}

/**
 * Official Geographic Bounding Box for the City of San Jose del Monte (CSJDM), Bulacan, Philippines
 * South: 14.7500° N
 * North: 14.9000° N
 * West:  120.9800° E
 * East:  121.1600° E
 */
export const SJDM_BOUNDS = {
  south: 14.7500,
  north: 14.9000,
  west: 120.9800,
  east: 121.1600,
} as const;

// Default center: City of San Jose del Monte (CSJDM), Bulacan, Philippines
export const DEFAULT_CSJDM_LAT = 14.8135;
export const DEFAULT_CSJDM_LNG = 121.0453;
export const MIN_SJDM_ZOOM = 12;
export const MAX_SJDM_ZOOM = 19;
export const DEFAULT_ZOOM = 13;
export const FOCUSED_ZOOM = 16;

/**
 * Validates whether the given WGS84 coordinates fall strictly within the City of San Jose del Monte, Bulacan.
 */
export function isWithinSjdmBounds(lat: number, lng: number): boolean {
  return (
    lat >= SJDM_BOUNDS.south &&
    lat <= SJDM_BOUNDS.north &&
    lng >= SJDM_BOUNDS.west &&
    lng <= SJDM_BOUNDS.east
  );
}
