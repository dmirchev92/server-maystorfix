import { PermissionsAndroid, Platform, Alert } from 'react-native';

export interface PermissionStatus {
  contacts: boolean;
  phone: boolean;
  callLog: boolean;
  sms: boolean;
}

export class PermissionService {
  private static instance: PermissionService;
  private permissionsRequested: boolean = false;

  private constructor() {}

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  /**
   * Check all permissions without requesting them
   */
  public async checkAllPermissions(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return { contacts: false, phone: false, callLog: false, sms: false };
    }

    try {
      const [contacts, phone, callLog, sms] = await Promise.all([
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG),
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.SEND_SMS),
      ]);

      console.log('📋 Permission check results:', { contacts, phone, callLog, sms });
      return { contacts, phone, callLog, sms };
    } catch (error) {
      console.error('❌ Error checking permissions:', error);
      return { contacts: false, phone: false, callLog: false, sms: false };
    }
  }

  /**
   * Check if contacts permission is granted
   */
  public async hasContactsPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    try {
      return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
    } catch (error) {
      console.error('❌ Error checking contacts permission:', error);
      return false;
    }
  }

  /**
   * Request all required permissions for SMS automation features
   * This should be called on first app load for providers
   */
  public async requestAllPermissionsOnFirstLoad(): Promise<PermissionStatus> {
    if (Platform.OS !== 'android') {
      return { contacts: false, phone: false, callLog: false, sms: false };
    }

    // Only request once per app session
    if (this.permissionsRequested) {
      console.log('📋 Permissions already requested this session, checking status...');
      return this.checkAllPermissions();
    }

    console.log('📋 Requesting all permissions on first load...');
    this.permissionsRequested = true;

    try {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        PermissionsAndroid.PERMISSIONS.SEND_SMS,
      ]);

      const status: PermissionStatus = {
        contacts: results[PermissionsAndroid.PERMISSIONS.READ_CONTACTS] === PermissionsAndroid.RESULTS.GRANTED,
        phone: results[PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE] === PermissionsAndroid.RESULTS.GRANTED,
        callLog: results[PermissionsAndroid.PERMISSIONS.READ_CALL_LOG] === PermissionsAndroid.RESULTS.GRANTED,
        sms: results[PermissionsAndroid.PERMISSIONS.SEND_SMS] === PermissionsAndroid.RESULTS.GRANTED,
      };

      console.log('📋 Permission request results:', status);

      // Log which permissions were denied for debugging
      const denied: string[] = [];
      if (!status.contacts) denied.push('Contacts');
      if (!status.phone) denied.push('Phone State');
      if (!status.callLog) denied.push('Call Log');
      if (!status.sms) denied.push('SMS');

      if (denied.length > 0) {
        console.log('⚠️ Denied permissions:', denied.join(', '));
      }

      return status;
    } catch (error) {
      console.error('❌ Error requesting permissions:', error);
      return { contacts: false, phone: false, callLog: false, sms: false };
    }
  }

  /**
   * Show a friendly alert explaining why permissions are needed
   */
  public showPermissionExplanation(): void {
    Alert.alert(
      'Разрешения за приложението',
      'За да работи автоматичното изпращане на SMS при пропуснати обаждания, приложението се нуждае от следните разрешения:\n\n' +
      '• Контакти - за филтриране на познати номера\n' +
      '• Телефон - за засичане на обаждания\n' +
      '• Списък с обаждания - за проследяване на пропуснати обаждания\n' +
      '• SMS - за изпращане на съобщения\n\n' +
      'Можете да промените разрешенията по-късно от Настройки > Приложения > SnapFix.',
      [{ text: 'Разбрах', style: 'default' }]
    );
  }

  /**
   * Reset the permission requested flag (useful for testing)
   */
  public resetPermissionRequestFlag(): void {
    this.permissionsRequested = false;
  }
}

export default PermissionService;
