import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import SocketIOService from '../services/SocketIOService';
import ApiService from '../services/ApiService';
import PushNotificationService from '../services/PushNotificationService';
import NotificationToast from '../components/NotificationToast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'message' | 'case' | 'info' | 'success' | 'error';
  data?: any;
}

interface NotificationContextType {
  showNotification: (notification: Omit<Notification, 'id'>) => void;
  clearNotification: () => void;
  unreadCount: number;
  refreshUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [currentNotification, setCurrentNotification] = useState<Notification | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [user, setUser] = useState<any>(null);
  const [socketInitialized, setSocketInitialized] = useState(false);

  // Load user and initialize services
  useEffect(() => {
    loadUser();
    initializePushNotifications();
  }, []);

  const initializePushNotifications = async () => {
    try {
      await PushNotificationService.getInstance().initialize();
      console.log('✅ Push notifications initialized');
    } catch (error) {
      console.error('❌ Error initializing push notifications:', error);
    }
  };

  // Socket listeners are already set up in SocketIOService
  // No need to set them up again here

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [user]);

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data) {
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        setUser(userData);
        
        // Socket.IO is already initialized in App.tsx, no need to connect again
        console.log('✅ NotificationContext - User loaded, Socket.IO already initialized');
        
        // Load unread count
        refreshUnreadCount();
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && user) {
      // App came to foreground
      console.log('🔄 App became active');
      // Socket.IO reconnection is handled automatically
      // Refresh unread count
      refreshUnreadCount();
    } else if (nextAppState === 'background') {
      // App went to background
      console.log('📱 App went to background');
    }
  };

  // Socket listeners are handled in SocketIOService
  // SocketIOService already shows notifications via NotificationService

  const refreshUnreadCount = async () => {
    try {
      // You can implement an API call to get unread count
      // For now, we'll just log it
      console.log('🔄 Refreshing unread count...');
      // const response = await ApiService.getInstance().getUnreadNotificationCount();
      // if (response.success && response.data) {
      //   setUnreadCount(response.data.count);
      // }
    } catch (error) {
      console.error('Error refreshing unread count:', error);
    }
  };

  const showNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setCurrentNotification({
      id,
      ...notification,
    });
  }, []);

  const clearNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  const handleNotificationPress = () => {
    if (currentNotification?.data) {
      // Handle navigation based on notification type
      console.log('🔔 Notification pressed:', currentNotification.data);
      // You can implement navigation here
      // navigation.navigate('ChatDetail', { conversationId: data.conversationId });
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        showNotification,
        clearNotification,
        unreadCount,
        refreshUnreadCount,
      }}
    >
      {children}
      {currentNotification && (
        <NotificationToast
          visible={!!currentNotification}
          title={currentNotification.title}
          message={currentNotification.message}
          type={currentNotification.type}
          onPress={handleNotificationPress}
          onDismiss={clearNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};
