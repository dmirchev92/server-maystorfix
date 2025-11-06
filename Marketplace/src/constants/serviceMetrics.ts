/**
 * Service Metrics Configuration
 * Defines which services are measured by square meters (кв.м)
 */

export const SERVICES_WITH_SQUARE_METERS = [
  'painter',        // Бояджия - painting is measured by area
  'cleaner',        // Почистване - cleaning is measured by area
  'flooring',       // Подови настилки - flooring is measured by area
  'tiler',          // Фаянсаджия - tiling is measured by area
  'plasterer',      // Мазач - plastering is measured by area
  'roofer',         // Покривджия - roofing is measured by area
  'gardener',       // Градинар - gardening can be measured by area
] as const;

/**
 * Check if a service type requires square meters measurement
 */
export function requiresSquareMeters(serviceType: string): boolean {
  return SERVICES_WITH_SQUARE_METERS.includes(serviceType as any);
}

/**
 * Get the label for square meters in Bulgarian
 */
export function getSquareMetersLabel(): string {
  return 'кв.м';
}

/**
 * Format square meters for display
 */
export function formatSquareMeters(sqm: number | null | undefined): string {
  if (!sqm) return '';
  return `${sqm} кв.м`;
}
