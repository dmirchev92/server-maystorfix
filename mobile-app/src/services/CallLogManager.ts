import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CallRecord, CallEvent, Contact } from '../utils/types';

// Mock call log data for development
// In production, this would use react-native-call-log or similar
interface MockCallData {
  id: string;
  phoneNumber: string;
  timestamp: number;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  name?: string;
}

export class CallLogManager {
  private static instance: CallLogManager;
  private readonly CALL_EVENTS_KEY = '@ServiceTextPro:CallEvents';
  private readonly PROCESSED_CALLS_KEY = '@ServiceTextPro:ProcessedCalls';

  private constructor() {}

  public static getInstance(): CallLogManager {
    if (!CallLogManager.instance) {
      CallLogManager.instance = new CallLogManager();
    }
    return CallLogManager.instance;
  }

  /**
   * Get recent calls from device call log
   * For development, this returns mock data
   */
  public async getRecentCalls(limit: number = 50): Promise<CallRecord[]> {
    try {
      if (Platform.OS === 'android') {
        // In production, this would use react-native-call-log
        return await this.getMockCallData(limit);
      } else {
        // iOS implementation would go here
        return await this.getMockCallData(limit);
      }
    } catch (error) {
      console.error('Error getting recent calls:', error);
      return [];
    }
  }

  /**
   * Mock call data for development and testing
   */
  private async getMockCallData(limit: number): Promise<CallRecord[]> {
    const mockCalls: MockCallData[] = [
      {
        id: '1',
        phoneNumber: '+359888123456',
        timestamp: Date.now() - 300000, // 5 minutes ago
        duration: 0, // missed call
        type: 'missed',
        name: 'Иван Петров'
      },
      {
        id: '2',
        phoneNumber: '+359887654321',
        timestamp: Date.now() - 600000, // 10 minutes ago
        duration: 45,
        type: 'incoming',
        name: 'Мария Георгиева'
      },
      {
        id: '3',
        phoneNumber: '+359876543210',
        timestamp: Date.now() - 900000, // 15 minutes ago
        duration: 0,
        type: 'missed',
      },
      {
        id: '4',
        phoneNumber: '+359888999888',
        timestamp: Date.now() - 1800000, // 30 minutes ago
        duration: 120,
        type: 'outgoing',
        name: 'Строителна фирма'
      },
      {
        id: '5',
        phoneNumber: '+359877111222',
        timestamp: Date.now() - 3600000, // 1 hour ago
        duration: 0,
        type: 'missed',
        name: 'Спешен клиент'
      }
    ];

    return mockCalls.slice(0, limit).map(call => ({
      id: call.id,
      phoneNumber: call.phoneNumber,
      timestamp: call.timestamp,
      duration: call.duration,
      type: call.type,
      contactName: call.name,
    }));
  }

  /**
   * Store a call event for processing
   */
  public async storeCallEvent(callEvent: CallEvent): Promise<void> {
    try {
      const existingEvents = await this.getStoredCallEvents();
      existingEvents.unshift(callEvent);
      
      // Keep only last 1000 events
      if (existingEvents.length > 1000) {
        existingEvents.splice(1000);
      }
      
      await AsyncStorage.setItem(this.CALL_EVENTS_KEY, JSON.stringify(existingEvents));
    } catch (error) {
      console.error('Error storing call event:', error);
    }
  }

  /**
   * Get all stored call events
   */
  public async getStoredCallEvents(): Promise<CallEvent[]> {
    try {
      const eventsJson = await AsyncStorage.getItem(this.CALL_EVENTS_KEY);
      if (eventsJson) {
        return JSON.parse(eventsJson);
      }
      return [];
    } catch (error) {
      console.error('Error getting stored call events:', error);
      return [];
    }
  }

  /**
   * Mark a call event as processed
   */
  public async markEventProcessed(eventId: string): Promise<void> {
    try {
      const events = await this.getStoredCallEvents();
      const eventIndex = events.findIndex(e => e.id === eventId);
      
      if (eventIndex !== -1) {
        events[eventIndex].processed = true;
        await AsyncStorage.setItem(this.CALL_EVENTS_KEY, JSON.stringify(events));
      }
    } catch (error) {
      console.error('Error marking event as processed:', error);
    }
  }

  /**
   * Mark a call event as response triggered
   */
  public async markEventResponseTriggered(eventId: string): Promise<void> {
    try {
      const events = await this.getStoredCallEvents();
      const eventIndex = events.findIndex(e => e.id === eventId);
      
      if (eventIndex !== -1) {
        events[eventIndex].responseTriggered = true;
        await AsyncStorage.setItem(this.CALL_EVENTS_KEY, JSON.stringify(events));
      }
    } catch (error) {
      console.error('Error marking event as response triggered:', error);
    }
  }

  /**
   * Get call statistics
   */
  public async getCallStatistics(): Promise<{
    total: number;
    missed: number;
    incoming: number;
    outgoing: number;
    averageDuration: number;
  }> {
    try {
      const calls = await this.getRecentCalls(1000);
      const total = calls.length;
      const missed = calls.filter(c => c.type === 'missed').length;
      const incoming = calls.filter(c => c.type === 'incoming').length;
      const outgoing = calls.filter(c => c.type === 'outgoing').length;
      
      const answeredCalls = calls.filter(c => c.type !== 'missed');
      const averageDuration = answeredCalls.length > 0 
        ? answeredCalls.reduce((sum, call) => sum + call.duration, 0) / answeredCalls.length
        : 0;
      
      return {
        total,
        missed,
        incoming,
        outgoing,
        averageDuration: Math.round(averageDuration),
      };
    } catch (error) {
      console.error('Error getting call statistics:', error);
      return {
        total: 0,
        missed: 0,
        incoming: 0,
        outgoing: 0,
        averageDuration: 0,
      };
    }
  }

  /**
   * Clear all stored call events
   */
  public async clearCallEvents(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.CALL_EVENTS_KEY);
      await AsyncStorage.removeItem(this.PROCESSED_CALLS_KEY);
    } catch (error) {
      console.error('Error clearing call events:', error);
    }
  }

  /**
   * Get call events by phone number
   */
  public async getCallEventsByPhone(phoneNumber: string): Promise<CallEvent[]> {
    try {
      const events = await this.getStoredCallEvents();
      return events.filter(e => e.callRecord.phoneNumber === phoneNumber);
    } catch (error) {
      console.error('Error getting call events by phone:', error);
      return [];
    }
  }

  /**
   * Get call events by date range
   */
  public async getCallEventsByDateRange(startDate: number, endDate: number): Promise<CallEvent[]> {
    try {
      const events = await this.getStoredCallEvents();
      return events.filter(e => e.timestamp >= startDate && e.timestamp <= endDate);
    } catch (error) {
      console.error('Error getting call events by date range:', error);
      return [];
    }
  }

  /**
   * Get unprocessed call events
   */
  public async getUnprocessedEvents(): Promise<CallEvent[]> {
    try {
      const events = await this.getStoredCallEvents();
      return events.filter(e => !e.processed);
    } catch (error) {
      console.error('Error getting unprocessed events:', error);
      return [];
    }
  }

  /**
   * Get events that haven't triggered responses
   */
  public async getEventsWithoutResponse(): Promise<CallEvent[]> {
    try {
      const events = await this.getStoredCallEvents();
      return events.filter(e => !e.responseTriggered);
    } catch (error) {
      console.error('Error getting events without response:', error);
      return [];
    }
  }
}






