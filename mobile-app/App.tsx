/**
 * SnapFix - Bulgarian Tradesperson Marketplace
 * React Native Mobile App
 * 
 * Production Build
 * @format
 */

import React, { useState, useEffect, useRef } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Alert, AppState, AppStateStatus } from 'react-native';
import { Provider, useSelector, useDispatch } from 'react-redux';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { store, RootState } from './src/store';
import { AuthBus } from './src/utils/AuthBus';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import ConsentScreen from './src/screens/ConsentScreen';
import { updateConsent } from './src/store/slices/appSlice';
import ApiService from './src/services/ApiService';
import SocketIOService from './src/services/SocketIOService';
import NotificationService from './src/services/NotificationService';
import FCMService from './src/services/FCMService';
import LocationTrackingService from './src/services/LocationTrackingService';
import UpdateService from './src/services/UpdateService';
import PermissionService from './src/services/PermissionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationProvider } from './src/contexts/NotificationContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { QueryProvider } from './src/query/QueryProvider';
import notifee from '@notifee/react-native';
import './src/i18n/config';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <QueryProvider>
          <ErrorBoundary>
            <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
            <AppContent />
          </ErrorBoundary>
        </QueryProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const dispatch = useDispatch();
  const { hasGDPRConsent } = useSelector((state: RootState) => state.app);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showConsentScreen, setShowConsentScreen] = useState(false);
  const appState = useRef(AppState.currentState);
  const [appStateVisible, setAppStateVisible] = useState(appState.current);
  const initialNotificationRef = useRef<any>(null);
  const SERVICE_INIT_DELAY = 1500; // Time to wait for services to initialize before processing notifications

  // Check consent status when user logs in
  useEffect(() => {
    if (currentUser && !hasGDPRConsent) {
      // Check if user has consents in backend
      checkBackendConsents();
    }
  }, [currentUser, hasGDPRConsent]);

  const checkBackendConsents = async () => {
    try {
      const response = await ApiService.getInstance().getConsents();
      if (response.success && response.data?.consents) {
        const consents = response.data.consents as Array<{ consentType: string; granted: boolean }>;
        const hasEssential = consents.some(c => c.consentType === 'essential_service' && c.granted);
        
        if (hasEssential) {
          // User has already given consent, update Redux state
          const consentDetails = consents.map(c => ({
            consentType: c.consentType,
            status: (c.granted ? 'granted' : 'withdrawn') as 'granted' | 'withdrawn',
            legalBasis: c.consentType === 'essential_service' ? 'Договор' : 'Съгласие',
            description: '',
            timestamp: new Date().toISOString(),
          }));
          
          dispatch(updateConsent({
            hasGDPRConsent: true,
            consentTimestamp: new Date().toISOString(),
            consentDetails,
          }));
          setShowConsentScreen(false);
        } else {
          // No essential consent, show consent screen
          setShowConsentScreen(true);
        }
      } else if (response.error?.code === 'INVALID_TOKEN' || response.error?.code === 'AUTHENTICATION_REQUIRED' || response.error?.code === 'NO_TOKEN') {
        // Auth error - don't show consent screen, the token refresh should handle it
        // If token refresh also failed, user will eventually be re-authenticated
        console.log('⚠️ Auth error checking consents, skipping consent screen');
        setShowConsentScreen(false);
      } else {
        // Other error or empty consents - show consent screen
        setShowConsentScreen(true);
      }
    } catch (error) {
      console.error('Error checking backend consents:', error);
      // On network error, don't show consent screen - it's not a consent issue
      setShowConsentScreen(false);
    }
  };

  const handleConsentComplete = () => {
    setShowConsentScreen(false);
  };

  // Check for initial notification IMMEDIATELY when app starts
  useEffect(() => {
    console.log('🔍 App.tsx - Setting up initial notification listener...');
    
    // Set up listener for notification press events
    const unsubscribe = notifee.onForegroundEvent(async ({ type, detail }) => {
      console.log('📱 App.tsx - Notifee foreground event:', type, detail);
      
      if (type === 1) { // EventType.PRESS
        // Handle instant job alert tap
        if (detail.notification?.data?.type === 'job_incoming') {
           console.log('🔔 Triggering instant job alert from notification tap');
           setTimeout(() => {
             SocketIOService.getInstance().triggerLocalJobAlert(detail.notification?.data);
           }, 500);
           return; 
        }

        console.log('📱 App.tsx - Notification pressed, storing for later processing');
        initialNotificationRef.current = detail;
      }
    });
    
    // Also check for initial notification synchronously
    notifee.getInitialNotification().then(initialNotification => {
      if (initialNotification) {
        console.log('📱 App.tsx - Found initial notification:', initialNotification);
        
        if (initialNotification.notification?.data?.type === 'job_incoming') {
           console.log('🔔 Triggering instant job alert from initial notification');
           setTimeout(() => {
             SocketIOService.getInstance().triggerLocalJobAlert(initialNotification.notification.data);
           }, SERVICE_INIT_DELAY); // Longer timeout for cold start
           return;
        }

        initialNotificationRef.current = initialNotification;
      } else {
        console.log('📱 App.tsx - No initial notification found');
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    checkExistingSession();
    
    // Check for app updates on startup
    const checkForUpdates = async () => {
      try {
        console.log('🔄 App.tsx - Checking for app updates...');
        await UpdateService.getInstance().checkOnStartup();
      } catch (error) {
        console.error('❌ App.tsx - Error checking for updates:', error);
      }
    };
    checkForUpdates();
    
    // Initialize call detection service (only starts if SMS was previously enabled AND user is a service provider)
    const initCallDetection = async () => {
      try {
        const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
        const { SMSService } = await import('./src/services/SMSService');
        
        // Initialize the service (doesn't start detection yet)
        const callService = ModernCallDetectionService.getInstance();
        
        // Check user role first - only service providers should have call detection
        const userJson = await AsyncStorage.getItem('user');
        const user = userJson ? JSON.parse(userJson) : null;
        const isServiceProvider = user?.role === 'tradesperson' || user?.role === 'service_provider';
        
        if (!isServiceProvider) {
          console.log('📱 App.tsx - User is not a service provider, stopping any lingering call detection...');
          // Stop any lingering foreground service from previous session
          await callService.stopDetection();
          return;
        }
        
        // Check if SMS auto-response was enabled - only then start detection
        const smsService = SMSService.getInstance();
        await smsService.loadConfig();
        const smsConfig = smsService.getConfig();
        
        if (smsConfig.isEnabled) {
          console.log('📱 App.tsx - SMS was enabled, restoring call detection...');
          const hasPermissions = await callService.checkPermissions();
          if (hasPermissions?.hasAllPermissions) {
            await callService.startDetection();
            console.log('✅ App.tsx - Call detection restored (SMS was enabled)');
          } else {
            console.log('⚠️ App.tsx - SMS enabled but permissions missing, not starting detection');
          }
        } else {
          console.log('📱 App.tsx - SMS not enabled, call detection service ready but not started');
        }
      } catch (error) {
        console.error('❌ App.tsx - Error initializing call detection:', error);
      }
    };
    initCallDetection();
    
    const unsubscribe = AuthBus.subscribe('logout', async () => {
      setCurrentUser(null);
      // Disconnect Socket.IO on logout
      SocketIOService.getInstance().disconnect();
      // Stop location tracking
      LocationTrackingService.getInstance().stopTracking();
      // Stop call detection service (removes notification)
      try {
        const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
        await ModernCallDetectionService.getInstance().stopDetection();
        console.log('✅ App.tsx - Call detection stopped on logout');
      } catch (error) {
        console.error('❌ App.tsx - Error stopping call detection on logout:', error);
      }
    });
    
    // Listen for login events from LoginScreen
    const unsubscribeLogin = AuthBus.subscribe('login', async () => {
      console.log('✅ App.tsx - Login event received, refreshing session');
      await checkExistingSession();
    });
    
    // Listen for userUpdated events (e.g., after subscription tier upgrade)
    const unsubscribeUserUpdated = AuthBus.subscribe('userUpdated', async () => {
      console.log('🔄 App.tsx - userUpdated event received, refreshing user data');
      try {
        const response = await ApiService.getInstance().getCurrentUser();
        if (response.success && response.data) {
          const userData = (response.data as any).user || response.data;
          console.log('✅ User data refreshed:', userData.subscription_tier_id);
          setCurrentUser(userData);
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('❌ Failed to refresh user data:', error);
      }
    });
    
    // Monitor app state changes (background/foreground)
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      unsubscribe();
      unsubscribeLogin();
      unsubscribeUserUpdated();
      subscription.remove();
    };
  }, []);

  // Handle app state changes to maintain session and services
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    console.log('🔄 App state changed:', appState.current, '->', nextAppState);
    
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // App has come to the foreground
      console.log('✅ App came to foreground - maintaining session');
      
      // Verify session is still valid
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
      if (isAuthenticated && !currentUser) {
        console.log('🔐 Restoring user session from token');
        await checkExistingSession();
      }
      
      // Reconnect Socket.IO if needed
      if (currentUser) {
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          console.log('🔌 Reconnecting Socket.IO after foreground');
          await SocketIOService.getInstance().connect(token, currentUser.id);
        }
      }
    } else if (nextAppState === 'background') {
      // App is going to background
      console.log('📱 App going to background - keeping services alive');
      // DO NOT logout - keep session and call detection active
      // Services will continue running in background
    }
    
    appState.current = nextAppState;
    setAppStateVisible(nextAppState);
  };

  // Initialize Socket.IO when user is authenticated
  useEffect(() => {
    console.log('🔍 App.tsx - currentUser changed:', currentUser?.id);
    if (currentUser) {
      console.log('✅ App.tsx - User authenticated, initializing Socket.IO');
      initializeSocketIO();
      // Start location tracking
      LocationTrackingService.getInstance().startTracking();
      
      // Request all permissions on first load for providers
      if (currentUser.role === 'provider') {
        console.log('📋 App.tsx - Provider logged in, requesting all permissions...');
        requestAllPermissions();
      }
    } else {
      console.log('⚠️ App.tsx - No user, skipping Socket.IO');
      LocationTrackingService.getInstance().stopTracking();
    }
  }, [currentUser]);

  // Request all permissions for providers on first load
  const requestAllPermissions = async () => {
    try {
      const permissionService = PermissionService.getInstance();
      const status = await permissionService.requestAllPermissionsOnFirstLoad();
      console.log('📋 App.tsx - Permission status after request:', status);
      
      // If contacts permission was denied, update SMS config to disable contact filtering
      if (!status.contacts) {
        console.log('⚠️ App.tsx - Contacts permission denied, disabling contact filter...');
        try {
          const { SMSService } = await import('./src/services/SMSService');
          const smsService = SMSService.getInstance();
          await smsService.updateConfig({ filterKnownContacts: false });
          console.log('✅ App.tsx - Contact filter disabled due to missing permission');
        } catch (error) {
          console.error('❌ App.tsx - Error updating SMS config:', error);
        }
      }
    } catch (error) {
      console.error('❌ App.tsx - Error requesting permissions:', error);
    }
  };

  const initializeSocketIO = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('⚠️ App.tsx - No auth token for Socket.IO');
        return;
      }

      // Get userId from currentUser
      const userId = currentUser?.id;
      console.log('🔌 App.tsx - Initializing Socket.IO connection with userId:', userId);
      
      await SocketIOService.getInstance().connect(token, userId);
      console.log('✅ App.tsx - Socket.IO initialized globally');
      
      // Initialize notification service
      console.log('📱 App.tsx - Initializing NotificationService...');
      const notificationInitialized = await NotificationService.getInstance().initialize();
      if (notificationInitialized) {
        console.log('✅ App.tsx - NotificationService initialized successfully');
      } else {
        console.warn('⚠️ App.tsx - NotificationService initialization failed');
      }
      
      // Initialize FCM for push notifications (background/killed app)
      console.log('🔥 App.tsx - Initializing FCM Service...');
      try {
        const fcmService = FCMService.getInstance();
        await fcmService.initialize();
        console.log('✅ App.tsx - FCM Service initialized successfully');
        
        // Handle initial notification if app was opened from killed state
        if (initialNotificationRef.current) {
          console.log('📱 App.tsx - Processing initial notification after FCM init');
          fcmService.handleInitialNotification(initialNotificationRef.current);
          // CRITICAL: Clear the ref to prevent double-processing on re-renders
          initialNotificationRef.current = null; 
        }
      } catch (fcmError) {
        console.error('❌ App.tsx - FCM initialization failed:', fcmError);
      }
      
      // Ensure call detection service is initialized (already done in useEffect, this is a fallback)
      const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
      ModernCallDetectionService.getInstance();
      console.log('✅ App.tsx - Call detection service ready (starts only when SMS enabled)');
    } catch (error) {
      console.error('❌ App.tsx - Error initializing services:', error);
    }
  };

  const checkExistingSession = async () => {
    try {
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
      console.log('🔐 App.tsx - isAuthenticated:', isAuthenticated);
      
      if (isAuthenticated) {
        // Try to get cached user data first
        const cachedUserStr = await AsyncStorage.getItem('user');
        if (cachedUserStr) {
          try {
            const parsed = JSON.parse(cachedUserStr);
            const cachedUser = parsed.user || parsed;
            console.log('✅ Restored user from cache:', cachedUser.id);
            setCurrentUser(cachedUser);
            setIsLoading(false);
            
            // Verify in background and update if needed
            ApiService.getInstance().getCurrentUser()
              .then((response) => {
                if (response.success && response.data) {
                  console.log('✅ User verified from API');
                  const userData = (response.data as any).user || response.data;
                  setCurrentUser(userData);
                  AsyncStorage.setItem('user', JSON.stringify(userData));
                }
              })
              .catch((err) => {
                console.log('⚠️ Background verification failed, keeping cached user:', err);
              });
            return;
          } catch (parseError) {
            console.log('⚠️ Failed to parse cached user, fetching from API');
          }
        }
        
        // No cache, fetch from API
        console.log('🔐 App.tsx - Token present, fetching user from API');
        const response = await ApiService.getInstance().getCurrentUser();
        
        if (response.success && response.data) {
          const userData = (response.data as any).user || response.data;
          console.log('✅ User fetched successfully:', userData.id);
          setCurrentUser(userData);
          // Cache user data for faster startup
          await AsyncStorage.setItem('user', JSON.stringify(userData));
        } else {
          console.log('⚠️ Failed to fetch user, token may be expired');
          // Don't logout automatically - token might be temporarily unavailable
        }
      }
    } catch (error) {
      console.log('App.tsx - Error checking session:', error);
      // Don't logout on error - network might be temporarily unavailable
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: safeAreaInsets.top }]}>
        {/* Loading screen would go here */}
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      </View>
    );
  }

  // Show consent screen if user hasn't given essential consent yet
  if (showConsentScreen) {
    return (
      <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
        <ConsentScreen onConsentComplete={handleConsentComplete} />
      </View>
    );
  }

  return (
    <NotificationProvider>
      <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
        <AppNavigator key={currentUser.role} userRole={currentUser.role} />
      </View>
    </NotificationProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;
