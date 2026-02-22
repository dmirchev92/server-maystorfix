import { ContactService } from '../ContactService';
import { Contact, ContactCategory, ContactPriority } from '../../utils/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock react-native-contacts
jest.mock('react-native-contacts', () => ({
  getAll: jest.fn().mockResolvedValue([
    {
      recordID: '1',
      givenName: 'Иван',
      familyName: 'Петров',
      phoneNumbers: [{ number: '+359888123456' }]
    },
    {
      recordID: '2',
      givenName: 'Мария',
      familyName: 'Георгиева',
      phoneNumbers: [{ number: '+359887654321' }]
    }
  ])
}));

// Mock PermissionsAndroid
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  PermissionsAndroid: {
    PERMISSIONS: {
      READ_CONTACTS: 'android.permission.READ_CONTACTS'
    },
    RESULTS: {
      GRANTED: 'granted'
    },
    request: jest.fn().mockResolvedValue('granted')
  }
}));

describe('ContactService', () => {
  let contactService: ContactService;

  beforeEach(() => {
    contactService = ContactService.getInstance();
    jest.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ContactService.getInstance();
      const instance2 = ContactService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('findContactByPhone', () => {
    it('should find contact by phone number', async () => {
      const mockContact: Contact = {
        id: '1',
        name: 'Test Contact',
        phoneNumbers: ['+359888123456'],
        category: 'existing_customer',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 0,
          totalMissedCalls: 0,
          responseRate: 0
        }
      };

      // Mock the getContacts method to return our test contact
      jest.spyOn(contactService, 'getContacts').mockResolvedValue([mockContact]);

      const foundContact = await contactService.findContactByPhone('+359888123456');
      
      expect(foundContact).not.toBeNull();
      expect(foundContact?.name).toBe('Test Contact');
      expect(foundContact?.phoneNumbers).toContain('+359888123456');
    });

    it('should return null for non-existent phone number', async () => {
      jest.spyOn(contactService, 'getContacts').mockResolvedValue([]);

      const foundContact = await contactService.findContactByPhone('+359999999999');
      
      expect(foundContact).toBeNull();
    });
  });

  describe('categorizeContact', () => {
    it('should categorize existing customer with service history', async () => {
      const contact: Contact = {
        id: '1',
        name: 'Test Customer',
        phoneNumbers: ['+359888123456'],
        category: 'new_prospect',
        priority: 'medium',
        serviceHistory: [
          {
            id: '1',
            date: Date.now(),
            serviceType: 'electrical',
            description: 'Fixed outlet',
            cost: 50,
            status: 'completed'
          }
        ],
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 0,
          totalMissedCalls: 0,
          responseRate: 0
        }
      };

      const category = await contactService.categorizeContact(contact);
      
      expect(category).toBe('existing_customer');
    });

    it('should categorize supplier based on business keywords', async () => {
      const contact: Contact = {
        id: '1',
        name: 'Електро ЕООД',
        phoneNumbers: ['+359888123456'],
        category: 'new_prospect',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 0,
          totalMissedCalls: 0,
          responseRate: 0
        }
      };

      const category = await contactService.categorizeContact(contact);
      
      expect(category).toBe('supplier');
    });

    it('should default to new_prospect', async () => {
      const contact: Contact = {
        id: '1',
        name: 'Regular Person',
        phoneNumbers: ['+359888123456'],
        category: 'new_prospect',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 0,
          totalMissedCalls: 0,
          responseRate: 0
        }
      };

      const category = await contactService.categorizeContact(contact);
      
      expect(category).toBe('new_prospect');
    });
  });

  describe('determineContactPriority', () => {
    it('should assign VIP priority to high-value customers', async () => {
      const contact: Contact = {
        id: '1',
        name: 'VIP Customer',
        phoneNumbers: ['+359888123456'],
        category: 'existing_customer',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 10,
          totalMissedCalls: 1,
          responseRate: 0.9,
          averageJobValue: 1500
        }
      };

      const priority = await contactService.determineContactPriority(contact);
      
      expect(priority).toBe('vip');
    });

    it('should assign low priority to poor responders', async () => {
      const contact: Contact = {
        id: '1',
        name: 'Poor Responder',
        phoneNumbers: ['+359888123456'],
        category: 'new_prospect',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 10,
          totalMissedCalls: 8,
          responseRate: 0.2
        }
      };

      const priority = await contactService.determineContactPriority(contact);
      
      expect(priority).toBe('low');
    });
  });

  describe('updateContactMetadata', () => {
    it('should update call statistics', async () => {
      const mockContact: Contact = {
        id: '1',
        name: 'Test Contact',
        phoneNumbers: ['+359888123456'],
        category: 'existing_customer',
        priority: 'medium',
        preferences: {
          preferredPlatform: 'whatsapp',
          language: 'bg'
        },
        metadata: {
          totalCalls: 5,
          totalMissedCalls: 2,
          responseRate: 0.6
        }
      };

      jest.spyOn(contactService, 'findContactByPhone').mockResolvedValue(mockContact);
      jest.spyOn(contactService, 'saveContact').mockResolvedValue(undefined);

      await contactService.updateContactMetadata('+359888123456', true, 200);

      expect(contactService.saveContact).toHaveBeenCalled();
    });
  });

  describe('searchContacts', () => {
    it('should search contacts by name', async () => {
      const mockContacts: Contact[] = [
        {
          id: '1',
          name: 'Иван Петров',
          phoneNumbers: ['+359888123456'],
          category: 'existing_customer',
          priority: 'medium',
          preferences: {
            preferredPlatform: 'whatsapp',
            language: 'bg'
          },
          metadata: {
            totalCalls: 0,
            totalMissedCalls: 0,
            responseRate: 0
          }
        }
      ];

      jest.spyOn(contactService, 'getContacts').mockResolvedValue(mockContacts);

      const results = await contactService.searchContacts('Иван');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Иван Петров');
    });

    it('should search contacts by phone number', async () => {
      const mockContacts: Contact[] = [
        {
          id: '1',
          name: 'Test Contact',
          phoneNumbers: ['+359888123456'],
          category: 'existing_customer',
          priority: 'medium',
          preferences: {
            preferredPlatform: 'whatsapp',
            language: 'bg'
          },
          metadata: {
            totalCalls: 0,
            totalMissedCalls: 0,
            responseRate: 0
          }
        }
      ];

      jest.spyOn(contactService, 'getContacts').mockResolvedValue(mockContacts);

      const results = await contactService.searchContacts('123456');
      
      expect(results).toHaveLength(1);
      expect(results[0].phoneNumbers[0]).toContain('123456');
    });
  });
});
