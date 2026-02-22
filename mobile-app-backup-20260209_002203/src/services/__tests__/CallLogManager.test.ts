import { CallLogManager } from '../CallLogManager';
import { CallRecord, CallEvent } from '../../utils/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('CallLogManager', () => {
  let callLogManager: CallLogManager;

  beforeEach(() => {
    callLogManager = CallLogManager.getInstance();
    jest.clearAllMocks();
  });

  describe('getRecentCalls', () => {
    it('should return mock call data', async () => {
      const calls = await callLogManager.getRecentCalls(5);
      
      expect(calls).toHaveLength(5);
      expect(calls[0]).toHaveProperty('phoneNumber');
      expect(calls[0]).toHaveProperty('timestamp');
      expect(calls[0]).toHaveProperty('type');
    });

    it('should return missed calls', async () => {
      const calls = await callLogManager.getRecentCalls(10);
      const missedCalls = calls.filter((call: CallRecord) => call.type === 'missed');
      
      expect(missedCalls.length).toBeGreaterThan(0);
    });
  });

  describe('filterSpamNumbers', () => {
    it('should filter out blocked numbers', async () => {
      const mockCalls: CallRecord[] = [
        {
          id: '1',
          phoneNumber: '+359888123456',
          timestamp: Date.now(),
          duration: 0,
          type: 'missed'
        },
        {
          id: '2',
          phoneNumber: '+1800123456', // Should be filtered as spam
          timestamp: Date.now(),
          duration: 0,
          type: 'missed'
        }
      ];

      const filteredCalls = await callLogManager.filterSpamNumbers(mockCalls);
      
      expect(filteredCalls).toHaveLength(1);
      expect(filteredCalls[0].phoneNumber).toBe('+359888123456');
    });
  });

  describe('storeCallEvent', () => {
    it('should store call event', async () => {
      const mockCallEvent: CallEvent = {
        id: 'test-event',
        callRecord: {
          id: '1',
          phoneNumber: '+359888123456',
          timestamp: Date.now(),
          duration: 0,
          type: 'missed'
        },
        timestamp: Date.now(),
        processed: false,
        responseTriggered: false
      };

      await expect(callLogManager.storeCallEvent(mockCallEvent)).resolves.not.toThrow();
    });
  });

  describe('getCallStatistics', () => {
    it('should return call statistics', async () => {
      const stats = await callLogManager.getCallStatistics();
      
      expect(stats).toHaveProperty('totalCalls');
      expect(stats).toHaveProperty('missedCalls');
      expect(stats).toHaveProperty('answeredCalls');
      expect(stats).toHaveProperty('averageDuration');
      
      expect(typeof stats.totalCalls).toBe('number');
      expect(typeof stats.missedCalls).toBe('number');
      expect(typeof stats.answeredCalls).toBe('number');
      expect(typeof stats.averageDuration).toBe('number');
    });
  });

  describe('blockNumber', () => {
    it('should block a phone number', async () => {
      const phoneNumber = '+359888999999';
      
      await expect(callLogManager.blockNumber(phoneNumber)).resolves.not.toThrow();
    });
  });

  describe('unblockNumber', () => {
    it('should unblock a phone number', async () => {
      const phoneNumber = '+359888999999';
      
      await expect(callLogManager.unblockNumber(phoneNumber)).resolves.not.toThrow();
    });
  });
});
