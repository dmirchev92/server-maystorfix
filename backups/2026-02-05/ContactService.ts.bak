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

      // Get all contacts
      const contacts = await Contacts.getAll();
      Logger.debug(`📞 Found ${contacts.length} contacts in device`);

      // Check if the phone number exists in any contact
      for (const contact of contacts) {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          for (const phone of contact.phoneNumbers) {
            const contactNormalized = this.normalizePhoneNumber(phone.number);
            
            // Compare normalized numbers
            if (contactNormalized === normalizedNumber) {
              Logger.debug(`📞 Found contact: ${contact.displayName} with number ${phone.number}`);
              return {
                isInContacts: true,
                contactName: contact.displayName || contact.givenName || 'Unknown',
                phoneNumber: phoneNumber,
              };
            }
          }
        }
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
    } else if (normalized.length >= 9) {
      // Assume it's a Bulgarian number without country code
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
