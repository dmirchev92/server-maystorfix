/**
 * Unit Tests for CaseController
 * Tests case management endpoints with mocked database
 */

import { Request, Response } from 'express';
import {
  createCase,
  getCasesWithFilters,
  acceptCase,
  completeCase
} from '../controllers/caseController';
import { DatabaseFactory } from '../models/DatabaseFactory';
import NotificationService from '../services/NotificationService';

// Mock dependencies
jest.mock('../models/DatabaseFactory');
jest.mock('../services/NotificationService');
jest.mock('../services/SmartMatchingService');
jest.mock('../utils/logger');

describe('CaseController Unit Tests', () => {
  let mockDb: any;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      db: {
        run: jest.fn((sql: string, params: any, callback: Function) => {
          const context = { lastID: 'test-id', changes: 1 };
          callback.call(context, null);
        }),
        get: jest.fn((sql: string, params: any, callback: Function) => {
          callback(null, null);
        }),
        all: jest.fn((sql: string, params: any, callback: Function) => {
          callback(null, []);
        })
      }
    };

    // Setup mock notification service
    mockNotificationService = {
      notifyCaseAssigned: jest.fn().mockResolvedValue(undefined),
      notifyCaseCompleted: jest.fn().mockResolvedValue(undefined)
    } as any;

    // Mock DatabaseFactory
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDb);
    
    // Mock NotificationService constructor
    (NotificationService as jest.MockedClass<typeof NotificationService>).mockImplementation(() => mockNotificationService);

    // Setup mock request and response
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    mockReq = {
      body: {},
      params: {},
      query: {}
    };
    
    mockRes = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  describe('createCase', () => {
    it('should create case with valid data', async () => {
      mockReq.body = {
        serviceType: 'electrician',
        description: 'Need electrical work',
        phone: '+359888123456',
        city: 'Sofia',
        customerId: 'customer-123'
      };

      await createCase(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Object)
        })
      );
    });

    it('should reject case with missing required fields', async () => {
      mockReq.body = {
        serviceType: 'electrician'
        // Missing description, phone, city
      };

      await createCase(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.any(Object)
        })
      );
    });
  });

  describe('getCasesWithFilters', () => {
    it('should return cases with pagination', async () => {
      const mockCases = [
        { id: 'case-1', status: 'pending' },
        { id: 'case-2', status: 'accepted' }
      ];

      mockDb.db.all.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, mockCases);
      });

      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, { total: 2 });
      });

      mockReq.query = { page: '1', limit: '10' };

      await getCasesWithFilters(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            cases: expect.any(Array),
            pagination: expect.any(Object)
          })
        })
      );
    });

    it('should handle database errors', async () => {
      mockDb.db.all.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(new Error('Database error'), null);
      });

      mockReq.query = {};

      await getCasesWithFilters(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
    });
  });

  describe('acceptCase', () => {
    it('should accept a pending case', async () => {
      mockReq.params = { caseId: 'case-123' };
      mockReq.body = { 
        providerId: 'provider-123', 
        providerName: 'Test Provider' 
      };

      // Mock case lookup
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, { 
          id: 'case-123', 
          status: 'pending',
          customer_id: 'customer-123'
        });
      });

      // Mock update
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback.call({ changes: 1 }, null);
      });

      await acceptCase(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockNotificationService.notifyCaseAssigned).toHaveBeenCalled();
    });
  });

  describe('completeCase', () => {
    it('should complete a case', async () => {
      mockReq.params = { caseId: 'case-123' };
      mockReq.body = {
        completionNotes: 'Work completed'
      };

      // Mock case lookup
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, {
          id: 'case-123',
          customer_id: 'customer-123',
          provider_id: 'provider-123',
          status: 'accepted'
        });
      });

      // Mock update
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback.call({ changes: 1 }, null);
      });

      await completeCase(mockReq as Request, mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockNotificationService.notifyCaseCompleted).toHaveBeenCalled();
    });
  });
});
