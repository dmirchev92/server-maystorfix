/**
 * Service Metrics Configuration
 * Defines which services are measured by square meters (кв.м)
 */

export const SERVICES_WITH_SQUARE_METERS = [
  'painter',        // Боядисване - painting is measured by area
  'gardener',       // Озеленяване - gardening is measured by area
  'roofer',         // Ремонти на покрив - roofing is measured by area
  'tiler',          // Плочки и теракот - tiling is measured by area
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
