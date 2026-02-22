// Consent Helper Utilities
// Shared utility functions for GDPR consent operations

import { ConsentType, CONSENT_TYPE_MAPPING } from '../types';

/**
 * Normalize consent type from mobile or legacy format to backend canonical format
 * @param type - Consent type string (mobile or backend format)
 * @returns Canonical ConsentType enum value
 */
export function normalizeConsentType(type: string): ConsentType {
  const normalized = CONSENT_TYPE_MAPPING[type.toLowerCase()];
  if (!normalized) {
    console.warn(`Unknown consent type: ${type}, defaulting to ESSENTIAL_SERVICE`);
    return ConsentType.ESSENTIAL_SERVICE;
  }
  return normalized;
}

/**
 * Get human-readable Bulgarian message for consent denial
 * @param consentType - The consent type that was denied
 * @returns User-friendly Bulgarian message explaining what consent is needed
 */
export function getConsentDenialMessage(consentType: ConsentType): string {
  const messages: Record<ConsentType, string> = {
    [ConsentType.ESSENTIAL_SERVICE]:
      'За да използвате основните функции на приложението, трябва да приемете обработката на основни данни.',
    [ConsentType.DATA_SHARING]:
      'За да съхраняваме съобщенията и разговорите ви, моля дайте съгласие в настройките.',
  };

  return messages[consentType] || 'Необходимо е съгласие за това действие.';
}

/**
 * Get human-readable English message for consent denial
 * @param consentType - The consent type that was denied
 * @returns User-friendly English message explaining what consent is needed
 */
export function getConsentDenialMessageEN(consentType: ConsentType): string {
  const messages: Record<ConsentType, string> = {
    [ConsentType.ESSENTIAL_SERVICE]:
      'To use the basic functions of the application, you must accept essential data processing.',
    [ConsentType.DATA_SHARING]:
      'To store your messages and conversations, please grant consent in settings.',
  };

  return messages[consentType] || 'Consent required for this action.';
}

/**
 * Get the consent management URL path for mobile/web apps
 * @returns Path to consent management screen
 */
export function getConsentManagementUrl(): string {
  return '/api/v1/gdpr/my-consents';
}

/**
 * Get app-specific consent management deep link
 * @returns Deep link to consent settings in mobile app
 */
export function getConsentManagementDeepLink(): string {
  return 'app://settings/privacy';
}

/**
 * Check if a consent type is required for basic app functionality
 * @param consentType - The consent type to check
 * @returns True if this consent is essential, false otherwise
 */
export function isEssentialConsent(consentType: ConsentType): boolean {
  return consentType === ConsentType.ESSENTIAL_SERVICE;
}

/**
 * Get all non-essential consent types
 * @returns Array of optional consent types
 */
export function getOptionalConsents(): ConsentType[] {
  return [
    ConsentType.DATA_SHARING
  ];
}

/**
 * Map action/feature to required consent type
 * @param action - The action or feature name
 * @returns Required consent type, or null if no consent needed
 */
export function getRequiredConsentForAction(action: string): ConsentType | null {
  const actionConsentMap: Record<string, ConsentType> = {
    // Essential service actions (no separate consent needed - covered by essential_service)
    'send_ai_message': null,
    'send_sms': null,
    'send_fcm_notification': null,
    'track_location': null,
    'log_analytics': null,
    'log_activity': null,
    // Data sharing actions (require data_sharing consent)
    'store_conversation': ConsentType.DATA_SHARING,
    'save_message': ConsentType.DATA_SHARING,
  };

  return actionConsentMap[action] ?? null;
}
