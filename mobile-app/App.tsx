/**
 * ServiceText Pro - Bulgarian Market Development
 * React Native App for Bulgarian Tradespeople
 * 
 * Phase 7: Mobile-Backend Integration Demo
 * @format
 */

import React, { useState, useEffect } from 'react';
import { StatusBar, StyleSheet, useColorScheme, View, Alert } from 'react-native';
import { Provider } from 'react-redux';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { store } from './src/store';
import { AuthBus } from './src/utils/AuthBus';
import AppNavigator from './src/navigation/AppNavigator';
import { AuthScreen } from './src/screens/AuthScreen';
import ApiService from './src/services/ApiService';
import SocketIOService from './src/services/SocketIOService';
import NotificationService from './src/services/NotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationProvider } from './src/contexts/NotificationContext';

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
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AppContent />
      </SafeAreaProvider>
    </Provider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
    
    // Initialize call detection service immediately (doesn't need auth)
    const initCallDetection = async () => {
      try {
        const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
        ModernCallDetectionService.getInstance();
        console.log('📱 App.tsx - Call detection service initialized on app start');
      } catch (error) {
        console.error('❌ App.tsx - Error initializing call detection:', error);
      }
    };
    initCallDetection();
    
    const unsubscribe = AuthBus.subscribe('logout', () => {
      setCurrentUser(null);
      // Disconnect Socket.IO on logout
      SocketIOService.getInstance().disconnect();
    });
    return () => unsubscribe();
  }, []);

  // Initialize Socket.IO when user is authenticated
  useEffect(() => {
    console.log('🔍 App.tsx - currentUser changed:', currentUser?.id);
    if (currentUser) {
      console.log('✅ App.tsx - User authenticated, initializing Socket.IO');
      initializeSocketIO();
    } else {
      console.log('⚠️ App.tsx - No user, skipping Socket.IO');
    }
  }, [currentUser]);

  const initializeSocketIO = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('⚠️ App.tsx - No auth token for Socket.IO');
        return;
      }

      console.log('🔌 App.tsx - Initializing Socket.IO connection...');
      await SocketIOService.getInstance().connect(token);
      console.log('✅ App.tsx - Socket.IO initialized globally');
      
      // Initialize notification service
      console.log('📱 App.tsx - Initializing NotificationService...');
      const notificationInitialized = await NotificationService.getInstance().initialize();
      if (notificationInitialized) {
        console.log('✅ App.tsx - NotificationService initialized successfully');
      } else {
        console.warn('⚠️ App.tsx - NotificationService initialization failed');
      }
      
      // Also initialize call detection service (auto-initializes on getInstance)
      const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
      ModernCallDetectionService.getInstance();
      console.log('✅ App.tsx - Call detection service loaded');
    } catch (error) {
      console.error('❌ App.tsx - Error initializing services:', error);
    }
  };

  const checkExistingSession = async () => {
    try {
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
      console.log('🔐 App.tsx - isAuthenticated:', isAuthenticated);
      
      if (isAuthenticated) {
        // Fast-path: render app immediately when token exists
        console.log('🔐 App.tsx - Token present, rendering app immediately and verifying user in background');
        const localUser = { id: 'local', email: '', firstName: '', lastName: '', role: 'tradesperson' };
        console.log('🔐 App.tsx - Setting currentUser to:', localUser);
        setCurrentUser(localUser);

        // Verify in background without blocking UI
        ApiService.getInstance().getCurrentUser()
          .then((response) => {
            console.log('App.tsx - getCurrentUser response (bg):', response);
            if (response.success && response.data) {
              setCurrentUser(response.data);
            } else {
              console.log('App.tsx - Background user fetch failed; staying in app with local session');
            }
          })
          .catch((err) => {
            console.log('App.tsx - Background user fetch error:', err);
          });
      }
    } catch (error) {
      console.log('App.tsx - No existing session found:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
  };

  const handleLogout = async () => {
    try {
      // Import callDetectionService to clear user data
      const { ModernCallDetectionService } = await import('./src/services/ModernCallDetectionService');
      const callDetectionService = ModernCallDetectionService.getInstance();
      
      await callDetectionService.clearUserData(); // Clear user-specific data
      await ApiService.getInstance().logout();
      setCurrentUser(null);
    } catch (error) {
      console.log('Logout error:', error);
    }
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

  return (
    <NotificationProvider>
      <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
        <AppNavigator />
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
