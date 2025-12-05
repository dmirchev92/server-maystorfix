// Modern Dashboard Screen with Real Call Detection
// Integrates with ModernCallDetectionService for Android 15+

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ModernCallDetectionService } from '../services/ModernCallDetectionService';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LocationTrackingService from '../services/LocationTrackingService';
import { SMSService } from '../services/SMSService';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

// Location mode type for Option C selector
type LocationMode = 'off' | 'always' | 'schedule';

interface ScheduleSettings {
  schedule_enabled: boolean;
  start_time: string;
  end_time: string;
}

const USE_NEW_DASHBOARD_UI = true;

// Service category translations
const SERVICE_CATEGORY_TRANSLATIONS: { [key: string]: string } = {
  'electrician': 'Електротехник',
  'plumber': 'Водопроводчик',
  'handyman': 'Майстор',
  'carpenter': 'Дърводелец',
  'painter': 'Бояджия',
  'locksmith': 'Ключар',
  'cleaner': 'Почистване',
  'gardener': 'Градинар',
  'mechanic': 'Механик',
  'roofer': 'Покривни работи',
  'tiler': 'Плочкаджия',
  'welder': 'Заварчик',
};

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  businessId?: string;
  isGdprCompliant: boolean;
  subscription_tier_id?: string;
}

interface DashboardStats {
  totalCalls: number;
  missedCalls: number;
  avgResponseTime: string;
  smsSent: number;
  smsChatCases?: number;
  searchChatCases?: number;
}

interface ProviderStats {
  available: number;
  accepted: number;
  completedCases: number;
  averageRating: number;
  totalReviews: number;
}

interface CallDetectionStatus {
  isInitialized: boolean;
  isListening: boolean;
  hasPermissions: boolean;
  androidVersion: string;
  lastCallTime?: string;
}

interface ActivityItem {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  status: string;
  timestamp: number;
}

function ModernDashboardScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 87,
    missedCalls: 12,
    avgResponseTime: '2m 15s',
    smsSent: 0,
  });
  const [callDetectionStatus, setCallDetectionStatus] = useState<CallDetectionStatus>({
    isInitialized: false,
    isListening: false,
    hasPermissions: false,
    androidVersion: 'Unknown',
  });
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [serviceType, setServiceType] = useState<string>('Занаятчия');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  
  // Location sharing state - Option C: 3-mode selector
  const [locationMode, setLocationMode] = useState<LocationMode>('off');
  const [isTogglingLocation, setIsTogglingLocation] = useState(false);
  const [scheduleSettings, setScheduleSettings] = useState<ScheduleSettings | null>(null);
  
  // Legacy state for compatibility
  const [isLocationEnabled, setIsLocationEnabled] = useState(false);
  
  // SMS Automation state
  const [isSmsEnabled, setIsSmsEnabled] = useState(false);
  const [isTogglingSms, setIsTogglingSms] = useState(false);
  const [filterKnownContacts, setFilterKnownContacts] = useState(true);
  const [isTogglingFilter, setIsTogglingFilter] = useState(false);
  
  // Free Inspection state
  const [freeInspectionActive, setFreeInspectionActive] = useState(false);
  const [freeInspectionLoading, setFreeInspectionLoading] = useState(false);
  
  // Automation Hub expansion state
  const [isAutomationExpanded, setIsAutomationExpanded] = useState(true);

  const callDetectionService = ModernCallDetectionService.getInstance();

  useEffect(() => {
    initializeScreen();
    setupCallDetectionListener();
    
    return () => {
      // Cleanup listeners when component unmounts
      callDetectionService.removeMissedCallListener(handleMissedCall);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Refresh data when screen comes into focus
      console.log('🔄 useFocusEffect triggered', { hasUser: !!user, userId: user?.id });
      loadLocationPreference(); // Always load location preference
      loadSmsStatus(); // Always load SMS status
      loadFreeInspectionStatus(); // Load free inspection status
      if (user?.id) {
        console.log('🔄 Screen focused, refreshing data for user:', user.id);
        loadDashboardData();
        refreshCallDetectionStatus();
        loadRecentActivity();
        loadProviderStats(user.id);
      } else {
        console.log('⚠️ useFocusEffect: User not loaded yet, skipping refresh');
      }
    }, [user?.id])
  );

  const initializeScreen = async () => {
    try {
      console.log('🚀 ========== DASHBOARD INITIALIZATION START ==========');
      
      console.log('🚀 Step 1: Loading user data...');
      await loadUserData();
      console.log('🚀 Step 1: User data loaded');
      
      console.log('🚀 Step 2: Loading dashboard data...');
      await loadDashboardData();
      console.log('🚀 Step 2: Dashboard data loaded');
      
      console.log('🚀 Step 3: Refreshing call detection status...');
      await refreshCallDetectionStatus();
      console.log('🚀 Step 3: Call detection status refreshed');
      
      console.log('🚀 Step 4: Loading recent activity...');
      await loadRecentActivity();
      console.log('🚀 Step 4: Recent activity loaded');
      
      console.log('🚀 Step 5: Testing backend connection...');
      await testBackendConnection();
      console.log('🚀 Step 5: Backend connection tested');
      
      console.log('🚀 ========== DASHBOARD INITIALIZATION COMPLETE ==========');
    } catch (error) {
      console.error('❌ ========== DASHBOARD INITIALIZATION ERROR ==========');
      console.error('❌ Error initializing screen:', error);
      Alert.alert('Грешка', 'Проблем при зареждане на данните');
    }
  };


  const testBackendConnection = async () => {
    try {
      const response = await ApiService.getInstance().healthCheck();
      if (response.success) {
        console.log('✅ Backend connection successful:', response.data);
      } else {
        console.log('❌ Backend connection failed:', response.error);
      }
    } catch (error) {
      console.log('❌ Backend connection error:', error);
    }
  };

  const testDatabaseConnection = async () => {
    try {
      console.log('🔍 Testing database connection...');
      
      // Test 1: Health Check
      const healthResponse = await ApiService.getInstance().healthCheck();
      console.log('📊 Health Check:', healthResponse);
      
      // Test 2: Try to get dashboard stats (this will test database queries)
      const statsResponse = await ApiService.getInstance().getDashboardStats();
      console.log('📈 Dashboard Stats:', statsResponse);
      
      // Test 3: Try to sync a test missed call
      const testMissedCall = {
        id: 'test-' + Date.now(),
        phoneNumber: '+359888123456',
        timestamp: new Date().toISOString(),
        duration: 0,
        type: 'missed',
        smsSent: false,
        smsSentAt: null
      };
      
      const syncResponse = await ApiService.getInstance().syncMissedCalls([testMissedCall]);
      console.log('📞 Sync Test:', syncResponse);
      
      // Show results to user
      Alert.alert(
        'Резултат от теста на базата данни',
        `Здравословна проверка: ${healthResponse.success ? '✅ Успешно' : '❌ Неуспешно'}\n` +
        `Статистики: ${statsResponse.success ? '✅ Успешно' : '❌ Неуспешно'}\n` +
        `Синхронизация: ${syncResponse.success ? '✅ Успешно' : '❌ Неуспешно'}\n\n` +
        `Проверете конзолата за подробности.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      Alert.alert(
        'Грешка при тест на базата данни',
        `Възникна грешка: ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const setupCallDetectionListener = () => {
    callDetectionService.addMissedCallListener(handleMissedCall);
  };

  const handleMissedCall = (event: any) => {
    console.log('📞 New missed call received:', event);
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalCalls: prev.totalCalls + 1,
      missedCalls: prev.missedCalls + 1,
    }));

    // Add to recent activity
    const newActivity: ActivityItem = {
      id: `call_${Date.now()}`,
      icon: '📞',
      title: 'Пропуснато обаждане',
      subtitle: `${event.phoneNumber} • ${event.formattedTime}`,
      status: 'AI отговор',
      timestamp: event.timestamp,
    };

    setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)]);
    setLastUpdated(new Date());

    // Show notification
    Alert.alert(
      'Пропуснато обаждане',
      `От: ${event.phoneNumber}\nВреме: ${event.formattedTime}`,
      [{ text: 'OK' }]
    );
  };

  const loadProviderStats = async (userId: string) => {
    try {
      console.log('📊 Loading provider stats for user:', userId);
      const [statsResponse, providerResponse] = await Promise.all([
        ApiService.getInstance().makeRequest(`/cases/stats?providerId=${userId}`),
        ApiService.getInstance().makeRequest(`/marketplace/providers/${userId}`)
      ]);

      const statsData: any = statsResponse.data || {};
      const providerData: any = providerResponse.data || {};

      const stats: ProviderStats = {
        available: Number(statsData.available) || 0,
        accepted: Number(statsData.accepted) || 0,
        completedCases: Number(statsData.completed) || 0,
        averageRating: Number(providerData.rating) || 0,
        totalReviews: Number(providerData.totalReviews || providerData.total_reviews) || 0
      };

      console.log('✅ Provider stats loaded:', stats);
      setProviderStats(stats);
    } catch (error) {
      console.error('❌ Error loading provider stats:', error);
    }
  };

  const loadUserData = async () => {
    try {
      console.log('👤 ========== loadUserData START ==========');
      
      // Check if user is authenticated first
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
      console.log('👤 Authentication status:', isAuthenticated);
      
      if (!isAuthenticated) {
        console.log('⚠️ User not authenticated, using mock user');
        const mockUser: User = {
          id: '1',
          email: 'ivan@test.com',
          firstName: 'Иван',
          lastName: 'Петров',
          phoneNumber: '+359888123456',
          role: 'tradesperson',
          businessId: 'business-1',
          isGdprCompliant: true,
        };
        setUser(mockUser);
        console.log('👤 Mock user set:', mockUser.id);
        console.log('👤 ========== loadUserData COMPLETE (MOCK) ==========');
        return;
      }

      console.log('� Calling getCurrentUser API...');
      const response = await ApiService.getInstance().getCurrentUser();
      console.log('� getCurrentUser response:', { success: response.success, hasData: !!response.data });
      console.log('� Full response data:', JSON.stringify(response.data, null, 2));
      
      if (response.success && response.data) {
        console.log('✅ User data loaded from backend successfully');
        // Handle nested user object (common API pattern)
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        
        console.log('� Checking user fields:', {
          id: userData.id,
          firstName: userData.firstName,
          first_name: userData.first_name,
          lastName: userData.lastName,
          last_name: userData.last_name,
          hasUserObject: !!rawData.user
        });
        
        const mappedUser: User = {
          id: userData.id,
          email: userData.email,
          firstName: userData.firstName || userData.first_name || 'Потребител',
          lastName: userData.lastName || userData.last_name || '',
          phoneNumber: userData.phoneNumber || userData.phone_number || '',
          role: userData.role || 'tradesperson',
          businessId: userData.businessId || userData.business_id,
          isGdprCompliant: userData.isGdprCompliant || userData.is_gdpr_compliant || false,
          subscription_tier_id: userData.subscription_tier_id || 'free',
        };
        console.log('� Mapped user data:', mappedUser);
        console.log('👤 User ID that will be used for API calls:', mappedUser.id);
        
        // Save user to AsyncStorage so other services can access it
        await AsyncStorage.setItem('user', JSON.stringify(mappedUser));
        console.log('💾 User saved to AsyncStorage for call detection service');
        
        console.log('👤 Setting user state...');
        setUser(mappedUser);
        console.log('👤 User state set successfully');
        console.log('👤 ========== loadUserData COMPLETE (REAL USER) ==========');
        
        // Load service type, profile image, and provider stats
        if (mappedUser.id) {
          try {
            const profileResponse = await ApiService.getInstance().makeRequest(`/marketplace/providers/${mappedUser.id}`);
            if (profileResponse.success && profileResponse.data) {
              const profileData: any = profileResponse.data;
              if (profileData.serviceCategory) {
                // Translate to Bulgarian if it's in English
                const translatedCategory = SERVICE_CATEGORY_TRANSLATIONS[profileData.serviceCategory.toLowerCase()] 
                  || profileData.serviceCategory;
                setServiceType(translatedCategory);
              }
              if (profileData.profileImageUrl) {
                setProfileImageUrl(profileData.profileImageUrl);
              }
            }
            // Load provider stats
            await loadProviderStats(mappedUser.id);
          } catch (error) {
            console.error('Error loading profile data:', error);
          }
        }
      } else {
        console.log('⚠️ No user data from backend, using mock user. Response:', response);
        const mockUser: User = {
          id: '1',
          email: 'ivan@test.com',
          firstName: 'Иван',
          lastName: 'Петров',
          phoneNumber: '+359888123456',
          role: 'tradesperson',
          businessId: 'business-1',
          isGdprCompliant: true,
        };
        setUser(mockUser);
        console.log('� Using mock user for testing:', mockUser.id);
        console.log('👤 ========== loadUserData COMPLETE (MOCK FALLBACK) ==========');
      }
    } catch (error) {
      console.error('❌ ========== loadUserData ERROR ==========');
      console.error('❌ Failed to load user data:', error);
      // Set mock user as fallback
      const mockUser: User = {
        id: '1',
        email: 'ivan@test.com',
        firstName: 'Иван',
        lastName: 'Петров',
        phoneNumber: '+359888123456',
        role: 'tradesperson',
        businessId: 'business-1',
        isGdprCompliant: true,
      };
      setUser(mockUser);
      console.log('� Using mock user as fallback:', mockUser.id);
      console.log('👤 ========== loadUserData COMPLETE (ERROR FALLBACK) ==========');
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('📊 ========== loadDashboardData START ==========');
      console.log('📊 Current user state:', { hasUser: !!user, userId: user?.id });
      
      if (!user?.id) {
        console.log('⚠️ loadDashboardData: No user ID available, cannot fetch stats');
        return;
      }
      
      console.log('📊 Fetching dashboard stats for user:', user.id);
      
      // Try to get real stats from backend first (pass userId for missed calls count)
      const response = await ApiService.getInstance().getDashboardStats(user.id);
      console.log('📊 getDashboardStats response:', { success: response.success, data: response.data });
      
      // Get chat source stats (use user.id as providerId for service providers)
      let chatSourceStats = { smsChatCases: 0, searchChatCases: 0 };
      try {
        console.log('📊 Fetching chat source stats for provider:', user.id);
        const chatSourceResponse = await ApiService.getInstance().getCaseStatsByChatSource(user.id);
        console.log('📊 getCaseStatsByChatSource response:', { 
          success: chatSourceResponse.success, 
          data: chatSourceResponse.data 
        });
        
        if (chatSourceResponse.success && chatSourceResponse.data) {
          console.log('✅ Chat source stats loaded successfully');
          const totals = chatSourceResponse.data.totals || chatSourceResponse.data;
          chatSourceStats = {
            smsChatCases: totals.smschat || 0,
            searchChatCases: totals.searchchat || 0,
          };
          console.log('📊 Parsed chat source stats:', chatSourceStats);
        } else {
          console.log('⚠️ Chat source stats response not successful or no data');
        }
      } catch (error) {
        console.error('❌ Error loading chat source stats:', error);
      }
      
      if (response.success && response.data) {
        console.log('✅ Dashboard stats loaded from backend successfully');
        const newStats = {
          ...response.data,
          ...chatSourceStats,
        };
        console.log('📊 Final merged stats to be set:', newStats);
        console.log('📊 Stats breakdown:', {
          totalCalls: newStats.totalCalls,
          missedCalls: newStats.missedCalls,
          smsSent: newStats.smsSent,
          smsChatCases: newStats.smsChatCases,
          searchChatCases: newStats.searchChatCases
        });
        setStats(newStats);
        setLastUpdated(new Date());
        console.log('📊 ========== loadDashboardData SUCCESS ==========');
        return;
      }
      
      console.log('⚠️ Backend stats not available, using local data');
      
      // Fallback: Get stored missed calls to update stats
      const storedCalls = await callDetectionService.getStoredMissedCalls();
      const todaysCalls = storedCalls.filter(call => {
        const callDate = new Date(call.timestamp);
        const today = new Date();
        return callDate.toDateString() === today.toDateString();
      });

      const updatedStats: DashboardStats = {
        totalCalls: 87 + storedCalls.length,
        missedCalls: 12 + todaysCalls.length,
        avgResponseTime: '2m 15s',
        smsSent: 0, // Will be loaded from backend
        ...chatSourceStats,
      };
      
      console.log('📊 Fallback stats:', updatedStats);
      setStats(updatedStats);
      setLastUpdated(new Date());
      console.log('📊 ========== loadDashboardData FALLBACK ==========');
    } catch (error) {
      console.error('❌ ========== loadDashboardData ERROR ==========');
      console.error('❌ Failed to load dashboard data:', error);
      if (error instanceof Error) {
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
    }
  };

  const loadRecentActivity = async () => {
    try {
      console.log('📋 Loading recent activity...');
      
      // Get real missed calls from local storage
      const storedCalls = await callDetectionService.getStoredMissedCalls();
      console.log('📞 Found stored calls:', storedCalls.length);
      
      // Convert stored calls to activity items
      const callActivities: ActivityItem[] = storedCalls
        .slice(0, 10) // Show up to 10 recent calls
        .map((call, index) => ({
          id: call.id || `call_${index}`,
          icon: '📞',
          title: 'Пропуснато обаждане',
          subtitle: `${call.phoneNumber} • ${call.formattedTime}`,
          status: call.aiResponseSent ? 'AI отговор изпратен' : 'Обработва се',
          timestamp: call.timestamp,
        }));

      // Sort by timestamp (most recent first)
      const allActivities = callActivities
        .sort((a, b) => b.timestamp - a.timestamp);

      console.log('✅ Recent activity loaded:', allActivities.length, 'items');
      setRecentActivity(allActivities);
    } catch (error) {
      console.error('Failed to load recent activity:', error);
    }
  };

  const refreshCallDetectionStatus = async () => {
    try {
      const permissions = await callDetectionService.checkPermissions();
      
      setCallDetectionStatus({
        isInitialized: callDetectionService.isServiceInitialized(),
        isListening: callDetectionService.isServiceListening(),
        hasPermissions: permissions?.hasAllPermissions || false,
        androidVersion: permissions?.androidVersion || 'Unknown',
      });
    } catch (error) {
      console.error('Failed to refresh call detection status:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    console.log('🔄 ========== MANUAL REFRESH START ==========');
    console.log('🔄 Current user:', { hasUser: !!user, userId: user?.id });
    
    try {
      console.log('🔄 Refreshing dashboard data...');
      await loadDashboardData();
      console.log('🔄 Refreshing call detection status...');
      await refreshCallDetectionStatus();
      console.log('🔄 Refreshing recent activity...');
      await loadRecentActivity();
      if (user?.id) {
        console.log('🔄 Refreshing provider stats...');
        await loadProviderStats(user.id);
      }
      console.log('✅ ========== MANUAL REFRESH COMPLETE ==========');
    } catch (error) {
      console.error('❌ ========== MANUAL REFRESH ERROR ==========');
      console.error('❌ Error refreshing dashboard:', error);
    }
    
    setIsRefreshing(false);
  };

  // Load location sharing preference and determine mode
  const loadLocationPreference = async () => {
    try {
      // Get tracking preference
      const enabled = await LocationTrackingService.getInstance().getTrackingPreference();
      console.log('📍 Dashboard - Tracking preference:', enabled);
      setIsLocationEnabled(enabled);
      
      // Get schedule settings
      const scheduleResponse = await ApiService.getInstance().getLocationSchedule();
      console.log('📍 Dashboard - Schedule response:', JSON.stringify(scheduleResponse, null, 2));
      if (scheduleResponse.success && scheduleResponse.data) {
        const schedule = scheduleResponse.data;
        const newScheduleSettings = {
          schedule_enabled: schedule.schedule_enabled,
          start_time: schedule.start_time || '08:00',
          end_time: schedule.end_time || '21:00',
        };
        console.log('📍 Dashboard - Setting schedule settings:', JSON.stringify(newScheduleSettings, null, 2));
        setScheduleSettings(newScheduleSettings);
        
        // Determine location mode based on settings
        if (!enabled) {
          setLocationMode('off');
        } else if (schedule.schedule_enabled) {
          setLocationMode('schedule');
        } else {
          setLocationMode('always');
        }
        console.log('📍 Dashboard - Location mode set to:', !enabled ? 'off' : (schedule.schedule_enabled ? 'schedule' : 'always'));
      } else {
        // No schedule data, determine mode from enabled state only
        setLocationMode(enabled ? 'always' : 'off');
        console.log('📍 Dashboard - No schedule data, mode set to:', enabled ? 'always' : 'off');
      }
    } catch (error) {
      console.error('Error loading location preference:', error);
      setLocationMode('off');
    }
  };
  
  // Load SMS automation status and sync call detection
  const loadSmsStatus = async () => {
    try {
      await SMSService.getInstance().refreshConfigFromAPI();
      const stats = SMSService.getInstance().getStats();
      const wasEnabled = isSmsEnabled;
      setIsSmsEnabled(stats.isEnabled);
      setFilterKnownContacts(stats.filterKnownContacts ?? true); // Load filter state
      
      // Sync call detection with SMS status (e.g., if enabled from web)
      const isCallDetectionRunning = callDetectionService.isServiceListening();
      
      if (stats.isEnabled && !isCallDetectionRunning) {
        // SMS is enabled but call detection isn't running - start it
        console.log('📱 SMS enabled but call detection not running, syncing...');
        const hasPermissions = await callDetectionService.checkPermissions();
        if (hasPermissions?.hasAllPermissions) {
          await callDetectionService.startDetection();
          await refreshCallDetectionStatus();
          console.log('✅ Call detection synced with SMS status');
        }
      } else if (!stats.isEnabled && isCallDetectionRunning) {
        // SMS is disabled but call detection is running - stop it
        console.log('📱 SMS disabled but call detection running, syncing...');
        await callDetectionService.stopDetection();
        await refreshCallDetectionStatus();
        console.log('✅ Call detection stopped (SMS disabled)');
      }
    } catch (error) {
      console.error('Error loading SMS status:', error);
    }
  };

  // Handle location mode change (Option C - 3 mode selector)
  const handleLocationModeChange = async (mode: LocationMode) => {
    if (isTogglingLocation) return;
    setIsTogglingLocation(true);
    
    try {
      const previousMode = locationMode;
      setLocationMode(mode);
      
      switch (mode) {
        case 'off':
          // Disable location tracking
          await LocationTrackingService.getInstance().setTrackingPreference(false);
          setIsLocationEnabled(false);
          break;
          
        case 'always':
          // Enable location tracking, disable schedule
          await LocationTrackingService.getInstance().setTrackingPreference(true);
          setIsLocationEnabled(true);
          // ALWAYS disable schedule when in "always" mode (regardless of local state)
          await ApiService.getInstance().updateLocationSchedule({ schedule_enabled: false });
          setScheduleSettings(prev => prev ? { ...prev, schedule_enabled: false } : { schedule_enabled: false, start_time: '08:00', end_time: '21:00' });
          break;
          
        case 'schedule':
          // Enable location tracking with schedule
          await LocationTrackingService.getInstance().setTrackingPreference(true);
          setIsLocationEnabled(true);
          // Enable schedule
          await ApiService.getInstance().updateLocationSchedule({ schedule_enabled: true });
          setScheduleSettings(prev => prev ? { ...prev, schedule_enabled: true } : { schedule_enabled: true, start_time: '08:00', end_time: '21:00' });
          // Apply schedule immediately
          await LocationTrackingService.getInstance().checkAndApplySchedule();
          break;
      }
    } catch (error) {
      console.error('Error changing location mode:', error);
      Alert.alert('Грешка', 'Неуспешна промяна на настройките за локация');
      // Revert on error
      await loadLocationPreference();
    } finally {
      setIsTogglingLocation(false);
    }
  };
  
  // Toggle SMS automation with call detection combined
  const handleToggleSmsWithCallDetection = async () => {
    if (isTogglingSms) return;
    setIsTogglingSms(true);
    
    try {
      const newEnabled = !isSmsEnabled;
      setIsSmsEnabled(newEnabled);
      
      if (newEnabled) {
        // First, request call detection permissions
        const hasPermissions = await callDetectionService.requestPermissions();
        if (!hasPermissions) {
          Alert.alert(
            'Разрешения са необходими',
            'За автоматични SMS при пропуснати обаждания са необходими разрешения за:\n\n• Достъп до състоянието на телефона\n• Достъп до списъка с обаждания\n\nМоля отидете в Настройки > Приложения > ServiceText Pro > Разрешения.',
            [{ text: 'OK' }]
          );
          setIsSmsEnabled(false);
          return;
        }
        
        // Start call detection
        await callDetectionService.startDetection();
        await refreshCallDetectionStatus();
        
        // Enable SMS
        const smsSuccess = await SMSService.getInstance().toggleEnabled();
        if (!smsSuccess) {
          // SMS toggle failed, stop call detection too
          await callDetectionService.stopDetection();
          await refreshCallDetectionStatus();
          setIsSmsEnabled(false);
          Alert.alert('Грешка', 'Нужни са разрешения за SMS');
          return;
        }
        
        Alert.alert(
          '✅ Авто SMS активирано',
          'При пропуснато обаждане автоматично ще се изпрати SMS с линк за чат.',
          [{ text: 'OK' }]
        );
      } else {
        // Stop call detection
        await callDetectionService.stopDetection();
        await refreshCallDetectionStatus();
        
        // Disable SMS
        await SMSService.getInstance().toggleEnabled();
      }
    } catch (error) {
      console.error('Error toggling SMS with call detection:', error);
      setIsSmsEnabled(!isSmsEnabled); // Revert
      Alert.alert('Грешка', 'Неуспешна промяна на настройките');
    } finally {
      setIsTogglingSms(false);
    }
  };
  
  // Toggle contact filtering (skip known contacts like family)
  const handleToggleContactFilter = async () => {
    if (isTogglingFilter) return;
    setIsTogglingFilter(true);
    
    try {
      const newFiltering = !filterKnownContacts;
      
      // If enabling filtering, request contacts permission
      if (newFiltering) {
        const { ContactService } = await import('../services/ContactService');
        const contactService = ContactService.getInstance();
        const hasPermission = await contactService.requestContactsPermission();
        
        if (!hasPermission) {
          Alert.alert(
            'Изисква се разрешение',
            'Филтрирането на контакти изисква достъп до контактите. Моля, разрешете достъпа.',
            [{ text: 'OK' }]
          );
          setIsTogglingFilter(false);
          return;
        }
      }
      
      // Update the SMS service config
      await SMSService.getInstance().updateConfig({ filterKnownContacts: newFiltering });
      setFilterKnownContacts(newFiltering);
      
      Alert.alert(
        newFiltering ? '✅ Филтър включен' : '❌ Филтър изключен',
        newFiltering 
          ? 'SMS ще се изпращат само до непознати номера (не на семейство/приятели).'
          : 'SMS ще се изпращат до всички пропуснати обаждания.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error toggling contact filter:', error);
      Alert.alert('Грешка', 'Неуспешна промяна на филтъра');
    } finally {
      setIsTogglingFilter(false);
    }
  };
  
  // Load free inspection status
  const loadFreeInspectionStatus = async () => {
    try {
      const response = await ApiService.getInstance().getFreeInspectionStatus();
      if (response.success && response.data) {
        setFreeInspectionActive(response.data.freeInspectionActive || false);
      }
    } catch (error) {
      console.error('Error loading free inspection status:', error);
    }
  };
  
  // Handle free inspection toggle
  const handleFreeInspectionToggle = async (value: boolean) => {
    setFreeInspectionLoading(true);
    try {
      const response = await ApiService.getInstance().toggleFreeInspection(value);
      if (response.success) {
        setFreeInspectionActive(value);
        Alert.alert(
          value ? '✅ Безплатен оглед активиран' : '❌ Безплатен оглед деактивиран',
          value 
            ? 'Клиентите наблизо ще получат известие и ще могат да ви намерят на картата.' 
            : 'Вече не се показвате като предлагащ безплатен оглед.'
        );
      } else {
        Alert.alert('Грешка', 'Неуспешна промяна на статуса');
      }
    } catch (error) {
      console.error('Error toggling free inspection:', error);
      Alert.alert('Грешка', 'Неуспешна връзка със сървъра');
    } finally {
      setFreeInspectionLoading(false);
    }
  };
  
  // Legacy toggle for compatibility
  const handleToggleLocation = async (value: boolean) => {
    handleLocationModeChange(value ? 'always' : 'off');
  };


  const handleLogoutPress = async () => {
    Alert.alert(
      'Излизане',
      'Сигурни ли сте, че искате да излезете от системата?',
      [
        { text: 'Отказ', style: 'cancel' },
        { 
          text: 'Излизане', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await callDetectionService.stopDetection();
              await callDetectionService.clearUserData(); // Clear user-specific data
              await ApiService.getInstance().logout();
              // Do NOT clear remembered credentials; users expect them to persist across logouts
              // Notify app to reset auth state if needed
              AuthBus.emit('logout');
            } catch (error) {
              Alert.alert('Грешка', 'Проблем при излизане от системата');
            }
          }
        },
      ]
    );
  };

  const handleChatPress = () => {
    navigation.navigate('Chat');
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Грешка: Няма данни за потребителя</Text>
      </View>
    );
  }

  if (USE_NEW_DASHBOARD_UI) {
    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerLeft}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              {profileImageUrl ? (
                <Image 
                  source={{ uri: profileImageUrl }} 
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}` : 'SP'}
                </Text>
              )}
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.welcomeText}>Добре дошли,</Text>
              <Text style={styles.userName}>
                {user ? `${user.firstName} ${user.lastName}` : 'Зареждане...'}
              </Text>
              <View style={styles.serviceTypesContainer}>
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <Text style={styles.userRole}>
                    {serviceType}
                  </Text>
                  {/* Subscription Badge */}
                  <View style={{
                    backgroundColor: user?.subscription_tier_id === 'pro' ? 'rgba(168, 85, 247, 0.2)' :
                                     user?.subscription_tier_id === 'normal' ? 'rgba(59, 130, 246, 0.2)' :
                                     'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    borderColor: user?.subscription_tier_id === 'pro' ? '#a855f7' :
                                 user?.subscription_tier_id === 'normal' ? '#3b82f6' :
                                 '#94a3b8',
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 10,
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: user?.subscription_tier_id === 'pro' ? '#c084fc' :
                             user?.subscription_tier_id === 'normal' ? '#60a5fa' :
                             '#94a3b8',
                    }}>
                      {user?.subscription_tier_id === 'pro' ? 'PRO' :
                       user?.subscription_tier_id === 'normal' ? 'NORMAL' : 'FREE'}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.profileHint}>Виж профила ›</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsIconButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== AUTOMATION HUB ==================== */}
        <View style={styles.automationHub}>
          {/* Hub Header */}
          <TouchableOpacity 
            style={styles.automationHubHeader}
            onPress={() => setIsAutomationExpanded(!isAutomationExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.automationHubTitleRow}>
              <Text style={styles.automationHubIcon}>⚡</Text>
              <Text style={styles.automationHubTitle}>Автоматизация</Text>
            </View>
            <View style={styles.automationHubStatus}>
              <View style={[
                styles.automationStatusDot,
                (isSmsEnabled || freeInspectionActive || locationMode !== 'off') 
                  ? styles.statusDotActive 
                  : styles.statusDotInactive
              ]} />
              <Text style={styles.automationStatusText}>
                {[
                  isSmsEnabled ? '📱' : '',
                  freeInspectionActive ? '🔧' : '',
                  locationMode !== 'off' ? '📍' : ''
                ].filter(Boolean).join(' ') || 'Изкл.'}
              </Text>
              <Text style={styles.automationExpandIcon}>
                {isAutomationExpanded ? '▲' : '▼'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Hub Content - Expandable */}
          {isAutomationExpanded && (
            <View style={styles.automationHubContent}>
              
              {/* 1. Auto SMS + Call Detection Combined Toggle */}
              <TouchableOpacity 
                style={styles.automationRow}
                onPress={handleToggleSmsWithCallDetection}
                disabled={isTogglingSms}
                activeOpacity={0.7}
              >
                <Text style={styles.automationRowIcon}>📱</Text>
                <View style={styles.automationRowText}>
                  <Text style={styles.automationRowLabel}>Авто SMS</Text>
                  <Text style={styles.automationRowStatus}>
                    {isSmsEnabled ? 'Активно • Следи обаждания' : 'Неактивно'}
                  </Text>
                </View>
                <View style={[
                  styles.automationToggle,
                  isSmsEnabled ? styles.toggleOn : styles.toggleOff
                ]}>
                  <View style={[
                    styles.automationToggleKnob,
                    isSmsEnabled ? styles.toggleKnobOn : styles.toggleKnobOff
                  ]} />
                </View>
              </TouchableOpacity>

              {/* Contact Filter Sub-option (only shown when SMS is enabled) */}
              {isSmsEnabled && (
                <TouchableOpacity 
                  style={[styles.automationRow, styles.automationSubRow]}
                  onPress={handleToggleContactFilter}
                  disabled={isTogglingFilter}
                  activeOpacity={0.7}
                >
                  <Text style={styles.automationRowIcon}>👥</Text>
                  <View style={styles.automationRowText}>
                    <Text style={styles.automationRowLabel}>Филтър контакти</Text>
                    <Text style={styles.automationRowStatus}>
                      {filterKnownContacts ? 'Само непознати' : 'Всички номера'}
                    </Text>
                  </View>
                  <View style={[
                    styles.automationToggle,
                    filterKnownContacts ? styles.toggleOn : styles.toggleOff
                  ]}>
                    <View style={[
                      styles.automationToggleKnob,
                      filterKnownContacts ? styles.toggleKnobOn : styles.toggleKnobOff
                    ]} />
                  </View>
                </TouchableOpacity>
              )}

              {/* 2. Free Inspection Toggle */}
              <TouchableOpacity 
                style={styles.automationRow}
                onPress={() => !freeInspectionLoading && handleFreeInspectionToggle(!freeInspectionActive)}
                disabled={freeInspectionLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.automationRowIcon}>🔧</Text>
                <View style={styles.automationRowText}>
                  <Text style={styles.automationRowLabel}>Безплатен оглед</Text>
                  <Text style={styles.automationRowStatus}>
                    {freeInspectionActive ? 'Активен' : 'Неактивен'}
                  </Text>
                </View>
                <View style={[
                  styles.automationToggle,
                  freeInspectionActive ? styles.toggleOn : styles.toggleOff
                ]}>
                  <View style={[
                    styles.automationToggleKnob,
                    freeInspectionActive ? styles.toggleKnobOn : styles.toggleKnobOff
                  ]} />
                </View>
              </TouchableOpacity>

              {/* 3. Location - Option C: 3 Mode Selector */}
              <View style={styles.locationSection}>
                <View style={styles.locationHeader}>
                  <Text style={styles.automationRowIcon}>📍</Text>
                  <Text style={styles.automationRowLabel}>Споделяне на локация</Text>
                </View>
                
                <View style={styles.locationModeSelector}>
                  {/* Off */}
                  <TouchableOpacity
                    style={[
                      styles.locationModeOption,
                      locationMode === 'off' && styles.locationModeSelected
                    ]}
                    onPress={() => handleLocationModeChange('off')}
                    disabled={isTogglingLocation}
                  >
                    <View style={[
                      styles.locationModeRadio,
                      locationMode === 'off' && styles.locationModeRadioSelected
                    ]}>
                      {locationMode === 'off' && <View style={styles.locationModeRadioInner} />}
                    </View>
                    <Text style={[
                      styles.locationModeText,
                      locationMode === 'off' && styles.locationModeTextSelected
                    ]}>Изключено</Text>
                  </TouchableOpacity>

                  {/* Always On */}
                  <TouchableOpacity
                    style={[
                      styles.locationModeOption,
                      locationMode === 'always' && styles.locationModeSelected
                    ]}
                    onPress={() => handleLocationModeChange('always')}
                    disabled={isTogglingLocation}
                  >
                    <View style={[
                      styles.locationModeRadio,
                      locationMode === 'always' && styles.locationModeRadioSelected
                    ]}>
                      {locationMode === 'always' && <View style={styles.locationModeRadioInner} />}
                    </View>
                    <Text style={[
                      styles.locationModeText,
                      locationMode === 'always' && styles.locationModeTextSelected
                    ]}>Винаги вкл.</Text>
                  </TouchableOpacity>

                  {/* Schedule */}
                  <TouchableOpacity
                    style={[
                      styles.locationModeOption,
                      styles.locationModeOptionSchedule,
                      locationMode === 'schedule' && styles.locationModeSelectedSchedule
                    ]}
                    onPress={() => handleLocationModeChange('schedule')}
                    disabled={isTogglingLocation}
                  >
                    <View style={[
                      styles.locationModeRadio,
                      locationMode === 'schedule' && styles.locationModeRadioSelectedSchedule
                    ]}>
                      {locationMode === 'schedule' && <View style={styles.locationModeRadioInnerSchedule} />}
                    </View>
                    <View style={styles.locationScheduleContent}>
                      <Text style={[
                        styles.locationModeText,
                        locationMode === 'schedule' && styles.locationModeTextSelectedSchedule
                      ]}>По график</Text>
                      {scheduleSettings && (
                        <Text style={styles.locationScheduleTime}>
                          {scheduleSettings.start_time} - {scheduleSettings.end_time}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity 
                      style={styles.locationScheduleEditBtn}
                      onPress={() => navigation.navigate('LocationSchedule')}
                    >
                      <Text style={styles.locationScheduleEditText}>✏️</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Full Settings Link */}
              <TouchableOpacity 
                style={styles.automationSettingsLink}
                onPress={() => navigation.navigate('SMS')}
              >
                <Text style={styles.automationSettingsText}>⚙️ Пълни настройки за автоматизация</Text>
                <Text style={styles.automationSettingsArrow}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* ==================== END AUTOMATION HUB ==================== */}

        {/* Quick Actions */}
        <View style={styles.navigationGrid}>
          <Text style={styles.navigationTitle}>Бързи действия</Text>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Cases')}>
              <Text style={styles.navIcon}>📋</Text>
              <Text style={styles.navLabel}>Заявки</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={handleChatPress}>
              <Text style={styles.navIcon}>💬</Text>
              <Text style={styles.navLabel}>Чат</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('SMS')}>
              <Text style={styles.navIcon}>📱</Text>
              <Text style={styles.navLabel}>SMS</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('MyBids')}>
              <Text style={styles.navIcon}>🏷️</Text>
              <Text style={styles.navLabel}>Оферти</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Points')}>
              <Text style={styles.navIcon}>💎</Text>
              <Text style={styles.navLabel}>Точки</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('ReferralDashboard')}>
              <Text style={styles.navIcon}>🎯</Text>
              <Text style={styles.navLabel}>Препоръки</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('MapSearch')}>
              <Text style={styles.navIcon}>🗺️</Text>
              <Text style={styles.navLabel}>Карта</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('IncomeDashboard')}>
              <Text style={styles.navIcon}>📈</Text>
              <Text style={styles.navLabel}>Приходи</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Statistics')}>
              <Text style={styles.navIcon}>📊</Text>
              <Text style={styles.navLabel}>Статистики</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity - Commented out as requested */}
        {/* <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Последна активност</Text>
          {recentActivity.length > 0 ? (
            recentActivity.map((activity) => (
              <View key={activity.id} style={styles.activityItem}>
                <Text style={styles.activityIcon}>{activity.icon}</Text>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
                </View>
                <Text style={[
                  styles.activityStatus,
                  activity.status === 'Завършен' ? styles.completedStatus : 
                  activity.status === 'Активен' ? styles.activeStatus : styles.processingStatus
                ]}>
                  {activity.status}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.activityItem}>
              <Text style={styles.activityIcon}>ℹ️</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>Няма последна активност</Text>
                <Text style={styles.activitySubtitle}>Стартирайте детекцията за да видите обаждания</Text>
              </View>
            </View>
          )}
        </View> */}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Последна актуализация: {lastUpdated.toLocaleTimeString('bg-BG')}
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.userInfo}
          onPress={() => navigation.navigate('EditProfile')}
          activeOpacity={0.7}
        >
          <Text style={styles.welcomeText}>Добре дошли,</Text>
          <Text style={styles.userName}>
            {user ? `${user.firstName} ${user.lastName}` : 'Зареждане...'}
          </Text>
          <Text style={styles.userRole}>
            {user ? (user.role === 'tradesperson' ? 'Занаятчия' : user.role) : 'Зареждане...'}
          </Text>
          <Text style={styles.profileHint}>Виж профила ›</Text>
        </TouchableOpacity>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.testButton} onPress={testDatabaseConnection}>
            <Text style={styles.testButtonText}>Тест DB</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
            <Text style={styles.logoutButtonText}>Излизане</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.primaryCard]}>
            <Text style={styles.statNumber}>{stats.totalCalls}</Text>
            <Text style={styles.statLabel}>Общо обаждания</Text>
          </View>
          <View style={[styles.statCard, styles.warningCard]}>
            <Text style={styles.statNumber}>{stats.missedCalls}</Text>
            <Text style={styles.statLabel}>Пропуснати</Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.successCard]}>
            <Text style={styles.statNumber}>{stats.smsSent}</Text>
            <Text style={styles.statLabel}>📤 SMS Изпратени</Text>
          </View>
          <View style={[styles.statCard, styles.infoCard]}>
            <Text style={styles.statNumber}>{stats.avgResponseTime}</Text>
            <Text style={styles.statLabel}>Ср. време отговор</Text>
          </View>
        </View>
      </View>

      {/* Auto SMS Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.sectionTitle}>Авто SMS</Text>
        
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Статус:</Text>
            <View style={[
              styles.statusIndicator, 
              isSmsEnabled ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusText}>
                {isSmsEnabled ? 'Активно' : 'Неактивно'}
              </Text>
            </View>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Разрешения:</Text>
            <View style={[
              styles.statusIndicator,
              callDetectionStatus.hasPermissions ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusText}>
                {callDetectionStatus.hasPermissions ? 'Дадени' : 'Нужни'}
              </Text>
            </View>
          </View>



          <View style={styles.buttonRow}>
            {!isSmsEnabled ? (
              <TouchableOpacity style={styles.startButton} onPress={handleToggleSmsWithCallDetection}>
                <Text style={styles.buttonText}>Стартирай Авто SMS</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleToggleSmsWithCallDetection}>
                <Text style={styles.buttonText}>Спри Авто SMS</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Бързи действия</Text>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleChatPress}>
          <Text style={styles.actionIcon}>💬</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Чат с клиенти</Text>
            <Text style={styles.actionSubtitle}>Управление на разговори</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => Alert.alert('Настройки', 'Функцията ще бъде добавена скоро')}
        >
          <Text style={styles.actionIcon}>📱</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Настройки за съобщения</Text>
            <Text style={styles.actionSubtitle}>WhatsApp, Viber, Telegram</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => navigation.navigate('Settings', { screen: 'Consent' })}
        >
          <Text style={styles.actionIcon}>🔒</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>GDPR & Поверителност</Text>
            <Text style={styles.actionSubtitle}>Управление на данните</Text>
          </View>
          <Text style={styles.actionArrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Activity */}
      {/* <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>Последна активност</Text>
        
        {recentActivity.length > 0 ? (
          recentActivity.map((activity) => (
            <View key={activity.id} style={styles.activityItem}>
              <Text style={styles.activityIcon}>{activity.icon}</Text>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activitySubtitle}>{activity.subtitle}</Text>
              </View>
              <Text style={[
                styles.activityStatus,
                activity.status === 'Завършен' ? styles.completedStatus : 
                activity.status === 'Активен' ? styles.activeStatus : styles.processingStatus
              ]}>
                {activity.status}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>ℹ️</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>Няма последна активност</Text>
              <Text style={styles.activitySubtitle}>Стартирайте детекцията за да видите обаждания</Text>
            </View>
          </View>
        )}
      </View> */}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Последна актуализация: {lastUpdated.toLocaleTimeString('bg-BG')}
        </Text>
      </View>
    </ScrollView>
  );
};

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900 - modern dark background
  },
  header: {
    backgroundColor: '#1e293b', // slate-800 - elegant dark header
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.3)', // indigo accent border
    marginBottom: theme.spacing.lg, // Add spacing before call detection
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo background
    borderWidth: 2,
    borderColor: '#6366f1', // indigo-500
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.md,
    overflow: 'hidden', // Ensure image respects border radius
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarText: {
    color: '#a5b4fc', // indigo-300
    fontSize: 18,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    color: '#94a3b8', // slate-400 - subtle greeting
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.fontWeight.medium,
  },
  userName: {
    color: '#cbd5e1', // slate-300 - prominent name
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    marginTop: 2,
  },
  serviceTypesContainer: {
    marginTop: 2,
  },
  userRole: {
    color: '#a5b4fc', // indigo-300 - accent for role
    fontSize: theme.typography.caption.fontSize,
    fontWeight: theme.fontWeight.medium,
  },
  profileHint: {
    color: '#6366f1', // indigo-500 - clickable hint
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  settingsIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.1)', // subtle slate background
    marginTop: 4,
  },
  settingsIcon: {
    fontSize: 22,
    opacity: 0.7,
  },
  testButton: {
    backgroundColor: '#4ade80', // green-400
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'transparent',
  },
  logoutButtonText: {
    color: '#94a3b8', // slate-400
    fontSize: 13,
    fontWeight: '500',
  },
  statsContainer: {
    padding: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  statCard: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    width: cardWidth,
  },
  fullWidth: {
    width: '100%',
  },
  primaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1', // indigo-500
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b', // amber-500
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80', // green-400
  },
  infoCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#0ea5e9', // sky-500
  },
  accentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1', // indigo-500
  },
  statNumber: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
  },
  kpiRowNew: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800 - default
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  kpiPrimary: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // indigo fill
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#818cf8', // indigo-400 - brighter accent
  },
  kpiWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // amber fill
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#fbbf24', // amber-400 - brighter accent
  },
  kpiSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.15)', // green fill
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80', // green-400 - brighter accent
  },
  kpiSms: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)', // purple fill
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#c084fc', // purple-400 - brighter accent
  },
  kpiSearch: {
    backgroundColor: 'rgba(14, 165, 233, 0.15)', // sky blue fill
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
    borderLeftWidth: 4,
    borderLeftColor: '#38bdf8', // sky-400 - brighter accent
  },
  kpiValue: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: '#cbd5e1', // slate-300
  },
  kpiLabel: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.xs,
    gap: 4,
  },
  kpiLabelText: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
  },
  redPhoneIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ef4444', // red-500
    justifyContent: 'center',
    alignItems: 'center',
  },
  redPhoneText: {
    fontSize: 12,
    color: '#ffffff',
  },
  kpiIcon: {
    fontSize: 16,
    color: '#ffffff', // Force full color rendering
  },
  kpiIconRed: {
    fontSize: 16,
    color: '#ef4444', // red-500 - red phone icon
    fontWeight: 'bold',
  },
  statusContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.md,
  },
  statusCard: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500 accent
  },
  statusHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  chip: {
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSuccess: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)', // green-400/20
    borderWidth: 1,
    borderColor: '#4ade80', // green-400
  },
  chipDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500/20
    borderWidth: 1,
    borderColor: '#ef4444', // red-500
  },
  chipWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)', // amber-500/20
    borderWidth: 1,
    borderColor: '#f59e0b', // amber-500
  },
  chipText: {
    color: '#cbd5e1', // slate-300
    fontSize: theme.typography.caption.fontSize,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
  },
  statusActive: {
    backgroundColor: '#4ade80', // green-400
  },
  statusInactive: {
    backgroundColor: '#ef4444', // red-500
  },
  statusText: {
    fontSize: theme.typography.caption.fontSize,
    color: '#ffffff',
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    color: '#cbd5e1', // slate-300
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  startButton: {
    flex: 1,
    backgroundColor: '#4ade80', // green-400
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#ef4444', // red-500
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  navigationGrid: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  navigationTitle: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.md,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    minHeight: 90,
  },
  navCardEmpty: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  navIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  navLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    textAlign: 'center',
  },
  quickChipsContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  quickChipsScroll: {
    paddingRight: theme.spacing.lg,
  },
  quickChip: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.xl,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  quickChipText: {
    color: '#cbd5e1', // slate-300
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  actionSubtitle: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
  },
  actionArrow: {
    fontSize: theme.typography.h3.fontSize,
    color: '#64748b', // slate-500
  },
  activityContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  activityItem: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  activitySubtitle: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94a3b8', // slate-400
  },
  activityStatus: {
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm,
  },
  activeStatus: {
    color: '#4ade80', // green-400
  },
  completedStatus: {
    color: '#64748b', // slate-500
  },
  processingStatus: {
    color: '#f59e0b', // amber-500
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.typography.caption.fontSize,
    color: '#64748b', // slate-500
  },
  errorText: {
    fontSize: theme.typography.body.fontSize,
    color: '#ef4444', // red-500
    textAlign: 'center',
    margin: theme.spacing.lg,
  },
  // Provider Stats Section
  providerStatsSection: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  providerStatCard: {
    width: '48%',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  providerStatGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  providerStatBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  providerStatPurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  providerStatYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  providerStatPink: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  providerStatIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  providerStatIcon: {
    fontSize: 20,
  },
  providerStatContent: {
    flex: 1,
  },
  providerStatLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  providerStatValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  // Map and Income Row
  mapIncomeRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  mapIncomeCard: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.xl,
    alignItems: 'center',
    borderWidth: 1,
  },
  mapCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  incomeCard: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  mapIncomeIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.xs,
  },
  mapIncomeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  mapIncomeSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  // Call Detection Simplified Styles
  callDetectionRow: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  callDetectionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
  },
  callDetectionActive: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: '#22c55e',
  },
  callDetectionInactive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
  },
  callDetectionNeutral: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  navArrow: {
    fontSize: 24,
    color: '#94a3b8',
    fontWeight: '300',
  },
  callDetectionIcon: {
    fontSize: 28,
    marginRight: theme.spacing.md,
  },
  callDetectionTextContainer: {
    flex: 1,
  },
  callDetectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  callDetectionStatus: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  callDetectionIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  indicatorGreen: {
    backgroundColor: '#22c55e',
  },
  indicatorRed: {
    backgroundColor: '#ef4444',
  },
  // Stats Sections
  statsSection: {
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statsSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  filterArrow: {
    padding: 6,
  },
  filterArrowText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  filterArrowDisabled: {
    opacity: 0.3,
  },
  filterArrowTextDisabled: {
    color: '#475569',
  },
  filterText: {
    fontSize: 13,
    color: '#cbd5e1',
    fontWeight: '500',
    marginHorizontal: 8,
    minWidth: 100,
    textAlign: 'center',
  },
  statsCardsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  statsCard: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statsCardOrange: {
    borderColor: 'rgba(249, 115, 22, 0.4)',
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  statsCardGreen: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  statsCardIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  statsCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  statsCardLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  // Small stat cards (3 per row)
  statsCardSmall: {
    flex: 1,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    minHeight: 80,
  },
  statsCardBlue: {
    borderColor: 'rgba(59, 130, 246, 0.4)',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  statsCardYellow: {
    borderColor: 'rgba(234, 179, 8, 0.4)',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  statsCardPink: {
    borderColor: 'rgba(236, 72, 153, 0.4)',
    backgroundColor: 'rgba(236, 72, 153, 0.1)',
  },
  statsCardTeal: {
    borderColor: 'rgba(20, 184, 166, 0.4)',
    backgroundColor: 'rgba(20, 184, 166, 0.1)',
  },
  statsCardPurple: {
    borderColor: 'rgba(168, 85, 247, 0.4)',
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
  },
  statsCardCyan: {
    borderColor: 'rgba(6, 182, 212, 0.4)',
    backgroundColor: 'rgba(6, 182, 212, 0.1)',
  },
  statsCardIndigo: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  statsCardIconSmall: {
    fontSize: 18,
    marginBottom: 2,
  },
  statsCardValueSmall: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  statsCardLabelSmall: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 2,
  },
  // Filter badge and button styles
  filterBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
  },
  filterBadgeText: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '500',
  },
  filterBadgeClose: {
    fontSize: 12,
    color: '#60a5fa',
    marginLeft: 6,
    fontWeight: '700',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  filterButtonIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  filterButtonText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    width: '80%',
    maxHeight: '60%',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  monthPickerScroll: {
    maxHeight: 300,
  },
  monthPickerItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.2)',
  },
  monthPickerItemText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  
  // ==================== AUTOMATION HUB STYLES ====================
  automationHub: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    overflow: 'hidden',
  },
  automationHubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.2)',
  },
  automationHubTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  automationHubIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  automationHubTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  automationHubStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  automationStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusDotActive: {
    backgroundColor: '#22c55e',
  },
  statusDotInactive: {
    backgroundColor: '#64748b',
  },
  automationStatusText: {
    fontSize: 14,
    color: '#94a3b8',
    marginRight: 8,
  },
  automationExpandIcon: {
    fontSize: 12,
    color: '#94a3b8',
  },
  automationHubContent: {
    padding: 12,
  },
  automationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    marginBottom: 8,
  },
  automationSubRow: {
    marginLeft: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderLeftWidth: 2,
    borderLeftColor: '#6366f1',
  },
  automationRowIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  automationRowText: {
    flex: 1,
  },
  automationRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  automationRowStatus: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  automationToggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    padding: 2,
  },
  toggleOn: {
    backgroundColor: '#22c55e',
  },
  toggleOff: {
    backgroundColor: '#374151',
  },
  automationToggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },
  toggleKnobOff: {
    alignSelf: 'flex-start',
  },
  
  // Location Section with 3-mode selector
  locationSection: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationModeSelector: {
    gap: 8,
  },
  locationModeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.6)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.3)',
  },
  locationModeOptionSchedule: {
    // Extra style for schedule option
  },
  locationModeSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  locationModeSelectedSchedule: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  locationModeRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#64748b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locationModeRadioSelected: {
    borderColor: '#22c55e',
  },
  locationModeRadioSelectedSchedule: {
    borderColor: '#3b82f6',
  },
  locationModeRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  locationModeRadioInnerSchedule: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3b82f6',
  },
  locationModeText: {
    fontSize: 14,
    color: '#94a3b8',
    fontWeight: '500',
  },
  locationModeTextSelected: {
    color: '#22c55e',
    fontWeight: '600',
  },
  locationModeTextSelectedSchedule: {
    color: '#60a5fa',
    fontWeight: '600',
  },
  locationScheduleContent: {
    flex: 1,
  },
  locationScheduleTime: {
    fontSize: 12,
    color: '#60a5fa',
    marginTop: 2,
  },
  locationScheduleEditBtn: {
    padding: 8,
  },
  locationScheduleEditText: {
    fontSize: 16,
  },
  
  // Full Settings Link
  automationSettingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(100, 116, 139, 0.2)',
  },
  automationSettingsText: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  automationSettingsArrow: {
    fontSize: 16,
    color: '#6366f1',
    marginLeft: 4,
  },
  // ==================== END AUTOMATION HUB STYLES ====================
});

export default ModernDashboardScreen;
