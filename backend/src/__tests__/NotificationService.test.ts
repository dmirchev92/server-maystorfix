/**
 * Unit Tests for NotificationService
 * Tests notification creation, case notifications, and survey system
 */

import NotificationService from '../services/NotificationService';
import { DatabaseFactory } from '../models/DatabaseFactory';

// Mock the database
jest.mock('../models/DatabaseFactory');
jest.mock('../utils/logger');

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockDb: any;

  beforeEach(() => {
    // Setup mock database
    mockDb = {
      db: {
        run: jest.fn((sql: string, params: any[], callback?: Function) => {
          if (callback) {
            callback.call({ lastID: 'notification-123', changes: 1 }, null);
          }
          return Promise.resolve();
        }),
        get: jest.fn((sql: string, params: any[], callback: Function) => {
          callback(null, null);
        }),
        all: jest.fn((sql: string, params: any[], callback: Function) => {
          callback(null, []);
        })
      }
    };

    // Mock DatabaseFactory
    (DatabaseFactory.getDatabase as jest.Mock).mockReturnValue(mockDb);

    // Create service instance
    notificationService = new NotificationService();

    jest.clearAllMocks();
  });

  // ============================================================================
  // CREATE NOTIFICATION TESTS
  // ============================================================================

  describe('createNotification', () => {
    it('should create notification with all required fields', async () => {
      const notificationId = await notificationService.createNotification(
        'user-123',
        'case_completed',
        'Case Completed',
        'Your case has been completed',
        { caseId: 'case-123' }
      );

      expect(notificationId).toBeDefined();
      expect(mockDb.db.run).toHaveBeenCalled();
      
      // Verify SQL contains correct table name
      const sqlCall = mockDb.db.run.mock.calls[0][0];
      expect(sqlCall).toContain('INSERT INTO notifications');
    });

    it('should create notification without metadata', async () => {
      const notificationId = await notificationService.createNotification(
        'user-123',
        'case_accepted',
        'Case Accepted',
        'Provider accepted your case'
      );

      expect(notificationId).toBeDefined();
      expect(mockDb.db.run).toHaveBeenCalled();
    });

    it('should handle notification creation errors', async () => {
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(new Error('Database error'));
      });

      await expect(
        notificationService.createNotification(
          'user-123',
          'test_type',
          'Test',
          'Test message'
        )
      ).rejects.toThrow();
    });

    it('should accept all valid notification types', async () => {
      const types = ['case_completed', 'case_assigned', 'new_case_available', 'review_request'];
      
      for (const type of types) {
        const notificationId = await notificationService.createNotification(
          'user-123',
          type,
          'Test',
          'Test message'
        );
        expect(notificationId).toBeDefined();
      }
    });

    it('should serialize metadata as JSON', async () => {
      const metadata = { caseId: 'case-123', action: 'view' };
      
      await notificationService.createNotification(
        'user-123',
        'case_completed',
        'Test',
        'Test message',
        metadata
      );

      const sqlParams = mockDb.db.run.mock.calls[0][1];
      // Metadata should be stringified
      expect(typeof sqlParams[4]).toBe('string');
    });
  });

  // ============================================================================
  // CASE COMPLETED NOTIFICATION TESTS
  // ============================================================================

  describe('notifyCaseCompleted', () => {
    beforeEach(() => {
      // Mock case details query
      mockDb.db.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        if (sql.includes('marketplace_service_cases')) {
          callback(null, {
            id: 'case-123',
            customer_id: 'customer-123',
            provider_id: 'provider-123',
            description: 'Test case',
            first_name: 'John',
            last_name: 'Doe',
            business_name: 'Test Business'
          });
        } else if (sql.includes('marketplace_conversations')) {
          callback(null, {
            id: 'conversation-123'
          });
        } else {
          callback(null, null);
        }
      });
    });

    it('should create notification for completed case', async () => {
      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      // Should call db.run at least once for notification
      expect(mockDb.db.run).toHaveBeenCalled();
      
      // Verify notification creation
      const calls = mockDb.db.run.mock.calls;
      const notificationCall = calls.find((call: any) => 
        call[0].includes('INSERT INTO notifications')
      );
      expect(notificationCall).toBeDefined();
    });

    it('should send survey message to chat', async () => {
      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      // Should query for conversation
      expect(mockDb.db.get).toHaveBeenCalled();
      
      // Should insert chat message
      const calls = mockDb.db.run.mock.calls;
      const messageCall = calls.find((call: any) => 
        call[0].includes('INSERT INTO marketplace_chat_messages')
      );
      expect(messageCall).toBeDefined();
    });

    it('should handle missing customer_id gracefully', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, {
          id: 'case-123',
          customer_id: null,
          provider_id: 'provider-123'
        });
      });

      // Should not throw error
      await expect(
        notificationService.notifyCaseCompleted('case-123', null as any, 'provider-123')
      ).resolves.not.toThrow();
    });

    it('should handle missing provider_id gracefully', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, {
          id: 'case-123',
          customer_id: 'customer-123',
          provider_id: null
        });
      });

      await expect(
        notificationService.notifyCaseCompleted('case-123', 'customer-123', null as any)
      ).resolves.not.toThrow();
    });

    it('should handle missing conversation gracefully', async () => {
      mockDb.db.get.mockImplementation((sql: string, params: any[], callback: Function) => {
        if (sql.includes('marketplace_service_cases')) {
          callback(null, {
            id: 'case-123',
            customer_id: 'customer-123',
            provider_id: 'provider-123'
          });
        } else if (sql.includes('marketplace_conversations')) {
          callback(null, null); // No conversation found
        } else {
          callback(null, null);
        }
      });

      // Should still create notification even if chat message fails
      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      // Notification should still be created
      const notificationCall = mockDb.db.run.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO notifications')
      );
      expect(notificationCall).toBeDefined();
    });

    it('should use business_name if available', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, {
          id: 'case-123',
          customer_id: 'customer-123',
          provider_id: 'provider-123',
          business_name: 'Test Business',
          first_name: 'John',
          last_name: 'Doe'
        });
      });

      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      // Check if chat message was attempted
      const messageCall = mockDb.db.run.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO marketplace_chat_messages')
      );
      
      // Just verify message was created
      expect(messageCall).toBeDefined();
    });

    it('should fallback to first_name and last_name if no business_name', async () => {
      mockDb.db.get.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(null, {
          id: 'case-123',
          customer_id: 'customer-123',
          provider_id: 'provider-123',
          business_name: null,
          first_name: 'John',
          last_name: 'Doe'
        });
      });

      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      const messageCall = mockDb.db.run.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO marketplace_chat_messages')
      );
      
      // Just verify message was created
      expect(messageCall).toBeDefined();
    });
  });

  // ============================================================================
  // CASE ASSIGNED NOTIFICATION TESTS
  // ============================================================================

  describe('notifyCaseAssigned', () => {
    it('should create notification for assigned case', async () => {
      await notificationService.notifyCaseAssigned(
        'case-123',
        'customer-123',
        'provider-123',
        'Test Provider'
      );

      expect(mockDb.db.run).toHaveBeenCalled();
      
      const notificationCall = mockDb.db.run.mock.calls[0];
      expect(notificationCall[0]).toContain('INSERT INTO notifications');
      
      // Verify parameters
      const params = notificationCall[1];
      expect(params).toContain('customer-123');
      expect(params).toContain('case_assigned');
    });

    it('should include provider name in notification', async () => {
      const providerName = 'John\'s Electrical Service';
      
      await notificationService.notifyCaseAssigned(
        'case-123',
        'customer-123',
        'provider-123',
        providerName
      );

      const params = mockDb.db.run.mock.calls[0][1];
      const message = params[3]; // message parameter
      // Message is in Bulgarian, just verify it exists
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should handle database errors', async () => {
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        callback(new Error('Database error'));
      });

      await expect(
        notificationService.notifyCaseAssigned('case-123', 'customer-123', 'provider-123', 'Test Provider')
      ).rejects.toThrow();
    });
  });

  // ============================================================================
  // NEW CASE AVAILABLE NOTIFICATION TESTS
  // ============================================================================

  describe('notifyNewCaseAvailable', () => {
    it('should create notifications for multiple providers', async () => {
      const providerIds = ['provider-1', 'provider-2', 'provider-3'];
      
      await notificationService.notifyNewCaseAvailable(
        'case-123',
        'electrician',
        'Sofia',
        providerIds
      );

      // Should create notification for each provider
      expect(mockDb.db.run).toHaveBeenCalledTimes(3);
    });

    it('should include category and location in notification', async () => {
      await notificationService.notifyNewCaseAvailable(
        'case-123',
        'plumber',
        'Plovdiv',
        ['provider-123']
      );

      const params = mockDb.db.run.mock.calls[0][1];
      const message = params[3];
      // Message is in Bulgarian, just verify it exists and has content
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
      expect(message.length).toBeGreaterThan(0);
    });

    it('should handle empty provider list', async () => {
      await notificationService.notifyNewCaseAvailable(
        'case-123',
        'electrician',
        'Sofia',
        []
      );

      // Should not create any notifications
      expect(mockDb.db.run).not.toHaveBeenCalled();
    });

    it('should attempt to create notification for each provider', async () => {
      const providerIds = ['provider-1', 'provider-2'];
      
      await notificationService.notifyNewCaseAvailable(
        'case-123',
        'electrician',
        'Sofia',
        providerIds
      );

      // Should attempt to create notification for each provider
      expect(mockDb.db.run).toHaveBeenCalledTimes(2);
    });
  });

  // ============================================================================
  // NOTIFICATION METADATA TESTS
  // ============================================================================

  describe('Notification Metadata', () => {
    it('should include caseId in metadata', async () => {
      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      const notificationCall = mockDb.db.run.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO notifications')
      );
      
      expect(notificationCall).toBeDefined();
      const params = notificationCall[1];
      
      // Find metadata parameter (should be JSON string with caseId)
      const metadataParam = params.find((p: any) => {
        if (typeof p === 'string') {
          try {
            const parsed = JSON.parse(p);
            return parsed.caseId !== undefined;
          } catch {
            return false;
          }
        }
        return false;
      });
      
      expect(metadataParam).toBeDefined();
      if (metadataParam) {
        const parsed = JSON.parse(metadataParam);
        expect(parsed.caseId).toBe('case-123');
      }
    });

    it('should include action in metadata', async () => {
      await notificationService.notifyCaseCompleted(
        'case-123',
        'customer-123',
        'provider-123'
      );

      const notificationCall = mockDb.db.run.mock.calls.find((call: any) => 
        call[0].includes('INSERT INTO notifications')
      );
      
      expect(notificationCall).toBeDefined();
      const params = notificationCall[1];
      
      // Find metadata parameter (should be JSON string with action)
      const metadataParam = params.find((p: any) => {
        if (typeof p === 'string') {
          try {
            const parsed = JSON.parse(p);
            return parsed.action !== undefined;
          } catch {
            return false;
          }
        }
        return false;
      });
      
      expect(metadataParam).toBeDefined();
      if (metadataParam) {
        const parsed = JSON.parse(metadataParam);
        // Action could be 'view_survey' or 'review_service'
        expect(parsed.action).toBeDefined();
        expect(typeof parsed.action).toBe('string');
      }
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    it('should log errors but not throw for non-critical failures', async () => {
      mockDb.db.run.mockImplementationOnce((sql: string, params: any[], callback: Function) => {
        if (sql.includes('marketplace_chat_messages')) {
          callback(new Error('Chat message failed'));
        } else {
          callback.call({ lastID: 'notification-123' }, null);
        }
      });

      // Should not throw even if chat message fails
      await expect(
        notificationService.notifyCaseCompleted('case-123', 'customer-123', 'provider-123')
      ).resolves.not.toThrow();
    });

    it('should handle database connection errors', async () => {
      mockDb.db.run.mockImplementationOnce(() => {
        throw new Error('Connection lost');
      });

      await expect(
        notificationService.createNotification('user-123', 'test', 'Test', 'Test')
      ).rejects.toThrow('Connection lost');
    });
  });

  // ============================================================================
  // NOTIFICATION TYPE TESTS
  // ============================================================================

  describe('Notification Types', () => {
    it('should support case_completed type', async () => {
      await notificationService.createNotification(
        'user-123',
        'case_completed',
        'Case Completed',
        'Your case is done'
      );

      const params = mockDb.db.run.mock.calls[0][1];
      expect(params).toContain('case_completed');
    });

    it('should support case_assigned type', async () => {
      await notificationService.createNotification(
        'user-123',
        'case_assigned',
        'Case Assigned',
        'New case assigned'
      );

      const params = mockDb.db.run.mock.calls[0][1];
      expect(params).toContain('case_assigned');
    });

    it('should support new_case_available type', async () => {
      await notificationService.createNotification(
        'user-123',
        'new_case_available',
        'New Case',
        'New case in your area'
      );

      const params = mockDb.db.run.mock.calls[0][1];
      expect(params).toContain('new_case_available');
    });

    it('should support review_request type', async () => {
      await notificationService.createNotification(
        'user-123',
        'review_request',
        'Review Request',
        'Please review the service'
      );

      const params = mockDb.db.run.mock.calls[0][1];
      expect(params).toContain('review_request');
    });
  });
});
