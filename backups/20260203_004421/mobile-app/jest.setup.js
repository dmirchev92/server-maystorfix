// Jest setup file for ServiceText Pro

// Mock react-native modules
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  // Mock Platform
  RN.Platform = {
    ...RN.Platform,
    OS: 'android',
    select: jest.fn((obj) => obj.android || obj.default),
  };

  // Mock PermissionsAndroid
  RN.PermissionsAndroid = {
    PERMISSIONS: {
      READ_CONTACTS: 'android.permission.READ_CONTACTS',
      READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
    },
    RESULTS: {
      GRANTED: 'granted',
      DENIED: 'denied',
    },
    request: jest.fn().mockResolvedValue('granted'),
    requestMultiple: jest.fn().mockResolvedValue({
      'android.permission.READ_CONTACTS': 'granted',
      'android.permission.READ_CALL_LOG': 'granted',
      'android.permission.READ_PHONE_STATE': 'granted',
    }),
  };

  return RN;
});

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
  clear: jest.fn().mockResolvedValue(null),
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
  ]),
  getContactById: jest.fn(),
  addContact: jest.fn(),
  updateContact: jest.fn(),
  deleteContact: jest.fn(),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    ANDROID: {
      READ_CONTACTS: 'android.permission.READ_CONTACTS',
      READ_CALL_LOG: 'android.permission.READ_CALL_LOG',
      READ_PHONE_STATE: 'android.permission.READ_PHONE_STATE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
  },
  request: jest.fn().mockResolvedValue('granted'),
  check: jest.fn().mockResolvedValue('granted'),
}));

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Silence console warnings during tests
const originalWarn = console.warn;
const originalError = console.error;

beforeAll(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterAll(() => {
  console.warn = originalWarn;
  console.error = originalError;
});

// Global test timeout
jest.setTimeout(10000);
