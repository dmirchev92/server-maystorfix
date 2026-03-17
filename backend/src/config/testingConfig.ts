/**
 * Testing Configuration - Feature Flags
 * 
 * Quick toggles for international testing support
 * Set to false for production Bulgaria-only mode
 */

export const TESTING_CONFIG = {
  /**
   * Allow international phone numbers (non-Bulgarian)
   * true = Accept any international format (+1, +44, etc.)
   * false = Bulgaria only (+359)
   */
  ALLOW_INTERNATIONAL_PHONES: true,

  /**
   * Enable SMS for international numbers
   * true = Allow SMS to international numbers via Mobica (may fail or incur high costs)
   * false = Disable SMS for non-Bulgarian numbers
   * Note: Mobica is Bulgarian provider, international SMS may not work or be expensive
   */
  ALLOW_INTERNATIONAL_SMS: false,
};
