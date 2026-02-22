import { Logger } from '../utils/Logger';
import { PermissionsAndroid, Platform } from 'react-native';
import Contacts from 'react-native-contacts';

interface ContactInfo {
  isInContacts: boolean;
  contactName?: string;
  phoneNumber: string;
}

export class ContactService {
  private static instance: ContactService;
  private contactsCache: Map<string, string> | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ContactService {
    if (!ContactService.instance) {
      ContactService.instance = new ContactService();
    }
    return ContactService.instance;
  }

  public async requestContactsPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      Logger.debug('📋 Requesting contacts permission...');
      
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        {
          title: 'Contacts Permission',
          message: 'SnapFix needs permission to read contacts to avoid sending SMS to known contacts like family members.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Deny',
          buttonPositive: 'Allow',
        }
      );

      Logger.debug('📱 READ_CONTACTS result:', result);

      const granted = result === PermissionsAndroid.RESULTS.GRANTED;
      
      Logger.debug('📋 Contacts Permission result:', granted ? '✅ Granted' : '❌ Denied');
      return granted;
    } catch (error) {
      Logger.error('❌ Error requesting contacts permission:', error);
      return false;
    }
  }

  public async checkContactsPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;

    try {
      const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      Logger.debug('📋 Contacts permission check:', hasPermission ? '✅ Granted' : '❌ Denied');
      return hasPermission;
    } catch (error) {
      Logger.error('❌ Error checking contacts permission:', error);
      return false;
    }
  }

  public async isPhoneNumberInContacts(phoneNumber: string): Promise<ContactInfo> {
    try {
      Logger.debug(`📞 Checking if ${phoneNumber} is in contacts...`);

      // Check permission first
      const hasPermission = await this.checkContactsPermission();
      if (!hasPermission) {
        Logger.debug('❌ No contacts permission, assuming number is not in contacts');
        return {
          isInContacts: false,
          phoneNumber: phoneNumber,
        };
      }

      // Normalize phone number for comparison
      const normalizedNumber = this.normalizePhoneNumber(phoneNumber);
      Logger.debug(`📞 Normalized number: ${normalizedNumber}`);

      // Use cached contacts map for fast lookup
      const contactsMap = await this.getContactsMap();
      Logger.debug(`📞 Contacts cache has ${contactsMap.size} normalized numbers`);

      const contactName = contactsMap.get(normalizedNumber);
      if (contactName) {
        Logger.debug(`📞 Found contact: ${contactName} for number ${normalizedNumber}`);
        return {
          isInContacts: true,
          contactName,
          phoneNumber: phoneNumber,
        };
      }

      Logger.debug(`📞 Number ${phoneNumber} not found in contacts`);
      return {
        isInContacts: false,
        phoneNumber: phoneNumber,
      };

    } catch (error) {
      Logger.error('❌ Error checking contacts:', error);
      return {
        isInContacts: false,
        phoneNumber: phoneNumber,
      };
    }
  }

  private async getContactsMap(): Promise<Map<string, string>> {
    // Return cached map if still valid
    if (this.contactsCache && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.contactsCache;
    }

    // Build fresh cache from device contacts
    const contacts = await Contacts.getAll();
    const map = new Map<string, string>();
    for (const contact of contacts) {
      const name = contact.displayName || contact.givenName || 'Unknown';
      if (contact.phoneNumbers) {
        for (const phone of contact.phoneNumbers) {
          const normalized = this.normalizePhoneNumber(phone.number);
          map.set(normalized, name);
        }
      }
    }

    this.contactsCache = map;
    this.cacheTimestamp = Date.now();
    Logger.debug(`📞 Built contacts cache: ${map.size} numbers from ${contacts.length} contacts`);
    return map;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // Remove leading + for processing
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }
    
    // Handle Bulgarian numbers
    if (normalized.startsWith('359')) {
      // Already in international format
      normalized = '+' + normalized;
    } else if (normalized.startsWith('0')) {
      // Local format, convert to international
      normalized = '+359' + normalized.substring(1);
    } else if (normalized.length === 9 && /^[89]/.test(normalized)) {
      // Bulgarian mobile without country code or leading 0 (e.g. 888123456, 987654321)
      normalized = '+359' + normalized;
    }
    
    Logger.debug(`📞 Normalized ${phoneNumber} to ${normalized}`);
    return normalized;
  }

  public async getContactName(phoneNumber: string): Promise<string | null> {
    try {
      const contactInfo = await this.isPhoneNumberInContacts(phoneNumber);
      return contactInfo.contactName || null;
    } catch (error) {
      Logger.error('❌ Error getting contact name:', error);
      return null;
    }
  }

  // Method to manually mark a number as known contact (for future use)
  public async markAsKnownContact(phoneNumber: string, contactName: string): Promise<void> {
    // This could be used to build a local database of known contacts
    // For now, it's a placeholder for future enhancement
    Logger.debug(`📞 Marking ${phoneNumber} as known contact: ${contactName}`);
  }

  // Method to get all known contacts (for future use)
  public async getKnownContacts(): Promise<ContactInfo[]> {
    // This could return a list of all known contacts
    // For now, it's a placeholder for future enhancement
    Logger.debug('📞 Getting known contacts...');
    return [];
  }
}

export default ContactService;
