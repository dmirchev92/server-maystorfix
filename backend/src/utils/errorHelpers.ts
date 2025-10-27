/**
 * Error Helper Functions for ServiceTextPro API
 * 
 * These helper functions provide a consistent way to throw errors across the application.
 * All errors are instances of ServiceTextProError and will be caught by the global error handler.
 */

import { ServiceTextProError } from '../types';
import { ErrorCodes, ErrorStatusCodes } from './errorCodes';

// ============================================================================
// Authentication Errors (401)
// ============================================================================

/**
 * Throw when user is not authenticated
 */
export const unauthorized = (message = 'Authentication required') => 
  new ServiceTextProError(message, ErrorCodes.UNAUTHORIZED, 401);

/**
 * Throw when token is invalid or expired
 */
export const invalidToken = (message = 'Invalid or expired token') =>
  new ServiceTextProError(message, ErrorCodes.INVALID_TOKEN, 401);

/**
 * Throw when credentials are invalid
 */
export const invalidCredentials = (message = 'Invalid credentials') =>
  new ServiceTextProError(message, ErrorCodes.INVALID_CREDENTIALS, 401);

// ============================================================================
// Authorization Errors (403)
// ============================================================================

/**
 * Throw when user doesn't have permission
 */
export const forbidden = (message = 'Access forbidden') =>
  new ServiceTextProError(message, ErrorCodes.FORBIDDEN, 403);

/**
 * Throw when user has insufficient permissions
 */
export const insufficientPermissions = (message = 'Insufficient permissions') =>
  new ServiceTextProError(message, ErrorCodes.INSUFFICIENT_PERMISSIONS, 403);

// ============================================================================
// Validation Errors (400)
// ============================================================================

/**
 * Throw for general bad requests
 */
export const badRequest = (message: string) =>
  new ServiceTextProError(message, ErrorCodes.BAD_REQUEST, 400);

/**
 * Throw when required parameters are missing
 */
export const missingParameters = (params: string[]) =>
  new ServiceTextProError(
    `Missing required parameters: ${params.join(', ')}`,
    ErrorCodes.MISSING_PARAMETERS,
    400
  );

/**
 * Throw when parameters are invalid
 */
export const invalidParameters = (message: string) =>
  new ServiceTextProError(message, ErrorCodes.INVALID_PARAMETERS, 400);

/**
 * Throw for validation errors
 */
export const validationError = (message: string) =>
  new ServiceTextProError(message, ErrorCodes.VALIDATION_ERROR, 400);

/**
 * Throw when format is invalid
 */
export const invalidFormat = (field: string, expected: string) =>
  new ServiceTextProError(
    `Invalid format for ${field}. Expected: ${expected}`,
    ErrorCodes.INVALID_FORMAT,
    400
  );

// ============================================================================
// Not Found Errors (404)
// ============================================================================

/**
 * Throw for generic not found errors
 */
export const notFound = (resource: string) =>
  new ServiceTextProError(
    `${resource} not found`,
    ErrorCodes.NOT_FOUND,
    404
  );

/**
 * Throw when user is not found
 */
export const userNotFound = (userId?: string) =>
  new ServiceTextProError(
    userId ? `User ${userId} not found` : 'User not found',
    ErrorCodes.USER_NOT_FOUND,
    404
  );

/**
 * Throw when case is not found
 */
export const caseNotFound = (caseId?: string) =>
  new ServiceTextProError(
    caseId ? `Case ${caseId} not found` : 'Case not found',
    ErrorCodes.CASE_NOT_FOUND,
    404
  );

/**
 * Throw when provider is not found
 */
export const providerNotFound = (providerId?: string) =>
  new ServiceTextProError(
    providerId ? `Provider ${providerId} not found` : 'Provider not found',
    ErrorCodes.PROVIDER_NOT_FOUND,
    404
  );

/**
 * Throw when notification is not found
 */
export const notificationNotFound = (notificationId?: string) =>
  new ServiceTextProError(
    notificationId ? `Notification ${notificationId} not found` : 'Notification not found',
    ErrorCodes.NOTIFICATION_NOT_FOUND,
    404
  );

/**
 * Throw when review is not found
 */
export const reviewNotFound = (reviewId?: string) =>
  new ServiceTextProError(
    reviewId ? `Review ${reviewId} not found` : 'Review not found',
    ErrorCodes.REVIEW_NOT_FOUND,
    404
  );

/**
 * Throw when conversation is not found
 */
export const conversationNotFound = (conversationId?: string) =>
  new ServiceTextProError(
    conversationId ? `Conversation ${conversationId} not found` : 'Conversation not found',
    ErrorCodes.CONVERSATION_NOT_FOUND,
    404
  );

// ============================================================================
// Conflict Errors (409)
// ============================================================================

/**
 * Throw for generic conflicts
 */
export const conflict = (message: string) =>
  new ServiceTextProError(message, ErrorCodes.CONFLICT, 409);

/**
 * Throw when resource already exists
 */
export const alreadyExists = (resource: string) =>
  new ServiceTextProError(
    `${resource} already exists`,
    ErrorCodes.ALREADY_EXISTS,
    409
  );

/**
 * Throw when review already exists
 */
export const reviewExists = (caseId: string) =>
  new ServiceTextProError(
    `Review for case ${caseId} already exists`,
    ErrorCodes.REVIEW_EXISTS,
    409
  );

// ============================================================================
// Server Errors (500)
// ============================================================================

/**
 * Throw for internal server errors
 */
export const internalError = (message = 'Internal server error') =>
  new ServiceTextProError(message, ErrorCodes.INTERNAL_ERROR, 500);

/**
 * Throw for database errors
 */
export const databaseError = (message = 'Database operation failed') =>
  new ServiceTextProError(message, ErrorCodes.DATABASE_ERROR, 500);

/**
 * Throw when service is unavailable
 */
export const serviceUnavailable = (message = 'Service temporarily unavailable') =>
  new ServiceTextProError(message, ErrorCodes.SERVICE_UNAVAILABLE, 503);

/**
 * Throw when operation fails
 */
export const operationFailed = (operation: string, reason?: string) =>
  new ServiceTextProError(
    reason ? `${operation} failed: ${reason}` : `${operation} failed`,
    ErrorCodes.OPERATION_FAILED,
    500
  );

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a custom error with specific code and status
 */
export const customError = (message: string, code: string, statusCode: number) =>
  new ServiceTextProError(message, code, statusCode);

/**
 * Wrap async route handlers to catch errors automatically
 */
export const asyncHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
