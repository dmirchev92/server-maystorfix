/**
 * Unit Tests for Error Helper Functions
 * Tests standardized error creation and consistency
 */

import {
  unauthorized,
  invalidToken,
  invalidCredentials,
  forbidden,
  insufficientPermissions,
  badRequest,
  missingParameters,
  invalidParameters,
  validationError,
  invalidFormat,
  notFound,
  userNotFound,
  caseNotFound,
  providerNotFound,
  notificationNotFound,
  reviewNotFound,
  conversationNotFound,
  conflict,
  alreadyExists,
  reviewExists,
  internalError,
  databaseError,
  serviceUnavailable,
  operationFailed
} from '../utils/errorHelpers';

import { ServiceTextProError } from '../types';
import { ErrorCodes } from '../utils/errorCodes';

describe('Error Helper Functions', () => {
  describe('Authentication Errors (401)', () => {
    it('should create unauthorized error', () => {
      const error = unauthorized();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(error.message).toBe('Authentication required');
    });

    it('should create unauthorized error with custom message', () => {
      const error = unauthorized('Please log in');
      
      expect(error.message).toBe('Please log in');
      expect(error.statusCode).toBe(401);
    });

    it('should create invalid token error', () => {
      const error = invalidToken();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.INVALID_TOKEN);
    });

    it('should create invalid credentials error', () => {
      const error = invalidCredentials();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ErrorCodes.INVALID_CREDENTIALS);
    });
  });

  describe('Authorization Errors (403)', () => {
    it('should create forbidden error', () => {
      const error = forbidden();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCodes.FORBIDDEN);
      expect(error.message).toBe('Access forbidden');
    });

    it('should create insufficient permissions error', () => {
      const error = insufficientPermissions();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ErrorCodes.INSUFFICIENT_PERMISSIONS);
    });
  });

  describe('Validation Errors (400)', () => {
    it('should create bad request error', () => {
      const error = badRequest('Invalid input');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.BAD_REQUEST);
      expect(error.message).toBe('Invalid input');
    });

    it('should create missing parameters error', () => {
      const error = missingParameters(['email', 'password']);
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.MISSING_PARAMETERS);
      expect(error.message).toContain('email');
      expect(error.message).toContain('password');
    });

    it('should create invalid parameters error', () => {
      const error = invalidParameters('Email format is invalid');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.INVALID_PARAMETERS);
    });

    it('should create validation error', () => {
      const error = validationError('Rating must be between 1 and 5');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
    });

    it('should create invalid format error', () => {
      const error = invalidFormat('phone', '+359XXXXXXXXX');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ErrorCodes.INVALID_FORMAT);
      expect(error.message).toContain('phone');
      expect(error.message).toContain('+359XXXXXXXXX');
    });
  });

  describe('Not Found Errors (404)', () => {
    it('should create generic not found error', () => {
      const error = notFound('Resource');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.NOT_FOUND);
      expect(error.message).toBe('Resource not found');
    });

    it('should create user not found error without ID', () => {
      const error = userNotFound();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.USER_NOT_FOUND);
      expect(error.message).toBe('User not found');
    });

    it('should create user not found error with ID', () => {
      const error = userNotFound('user-123');
      
      expect(error.message).toBe('User user-123 not found');
    });

    it('should create case not found error', () => {
      const error = caseNotFound('case-123');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.CASE_NOT_FOUND);
      expect(error.message).toContain('case-123');
    });

    it('should create provider not found error', () => {
      const error = providerNotFound('provider-123');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.PROVIDER_NOT_FOUND);
    });

    it('should create notification not found error', () => {
      const error = notificationNotFound();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.NOTIFICATION_NOT_FOUND);
    });

    it('should create review not found error', () => {
      const error = reviewNotFound();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.REVIEW_NOT_FOUND);
    });

    it('should create conversation not found error', () => {
      const error = conversationNotFound();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ErrorCodes.CONVERSATION_NOT_FOUND);
    });
  });

  describe('Conflict Errors (409)', () => {
    it('should create generic conflict error', () => {
      const error = conflict('Resource already exists');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCodes.CONFLICT);
    });

    it('should create already exists error', () => {
      const error = alreadyExists('User');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCodes.ALREADY_EXISTS);
      expect(error.message).toBe('User already exists');
    });

    it('should create review exists error', () => {
      const error = reviewExists('case-123');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ErrorCodes.REVIEW_EXISTS);
      expect(error.message).toContain('case-123');
    });
  });

  describe('Server Errors (500)', () => {
    it('should create internal error', () => {
      const error = internalError();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
      expect(error.message).toBe('Internal server error');
    });

    it('should create internal error with custom message', () => {
      const error = internalError('Something went wrong');
      
      expect(error.message).toBe('Something went wrong');
    });

    it('should create database error', () => {
      const error = databaseError();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
    });

    it('should create service unavailable error', () => {
      const error = serviceUnavailable();
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ErrorCodes.SERVICE_UNAVAILABLE);
    });

    it('should create operation failed error', () => {
      const error = operationFailed('User creation');
      
      expect(error).toBeInstanceOf(ServiceTextProError);
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe(ErrorCodes.OPERATION_FAILED);
      expect(error.message).toContain('User creation');
    });

    it('should create operation failed error with reason', () => {
      const error = operationFailed('User creation', 'Database timeout');
      
      expect(error.message).toContain('User creation');
      expect(error.message).toContain('Database timeout');
    });
  });

  describe('Error Consistency', () => {
    it('should all errors be instances of ServiceTextProError', () => {
      const errors = [
        unauthorized(),
        forbidden(),
        badRequest('test'),
        notFound('test'),
        conflict('test'),
        internalError()
      ];

      errors.forEach(error => {
        expect(error).toBeInstanceOf(ServiceTextProError);
        expect(error).toBeInstanceOf(Error);
      });
    });

    it('should all errors have required properties', () => {
      const error = badRequest('Test error');
      
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('statusCode');
      expect(error).toHaveProperty('isOperational');
    });

    it('should all errors be operational by default', () => {
      const errors = [
        unauthorized(),
        badRequest('test'),
        notFound('test'),
        internalError()
      ];

      errors.forEach(error => {
        expect(error.isOperational).toBe(true);
      });
    });

    it('should preserve error stack trace', () => {
      const error = badRequest('Test error');
      
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('badRequest');
    });
  });

  describe('HTTP Status Code Mapping', () => {
    it('should map 401 errors correctly', () => {
      expect(unauthorized().statusCode).toBe(401);
      expect(invalidToken().statusCode).toBe(401);
      expect(invalidCredentials().statusCode).toBe(401);
    });

    it('should map 403 errors correctly', () => {
      expect(forbidden().statusCode).toBe(403);
      expect(insufficientPermissions().statusCode).toBe(403);
    });

    it('should map 400 errors correctly', () => {
      expect(badRequest('test').statusCode).toBe(400);
      expect(missingParameters(['test']).statusCode).toBe(400);
      expect(validationError('test').statusCode).toBe(400);
    });

    it('should map 404 errors correctly', () => {
      expect(notFound('test').statusCode).toBe(404);
      expect(userNotFound().statusCode).toBe(404);
      expect(caseNotFound().statusCode).toBe(404);
    });

    it('should map 409 errors correctly', () => {
      expect(conflict('test').statusCode).toBe(409);
      expect(alreadyExists('test').statusCode).toBe(409);
    });

    it('should map 500 errors correctly', () => {
      expect(internalError().statusCode).toBe(500);
      expect(databaseError().statusCode).toBe(500);
      expect(operationFailed('test').statusCode).toBe(500);
    });

    it('should map 503 errors correctly', () => {
      expect(serviceUnavailable().statusCode).toBe(503);
    });
  });
});
