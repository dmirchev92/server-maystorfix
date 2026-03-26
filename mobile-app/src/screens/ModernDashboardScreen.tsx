// Modern Dashboard Screen with Real Call Detection
// Integrates with ModernCallDetectionService for Android 15+

import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import DataRetentionModal from '../components/DataRetentionModal';
import { getCategoryLabel } from '../constants/serviceCategories';

// Location mode type for Option C selector
type LocationMode = 'off' | 'always' | 'schedule';

interface ScheduleSettings {
  schedule_enabled: boolean;
  start_time: string;
  end_time: string;
}

const USE_NEW_DASHBOARD_UI = true;

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

const ModernDashboardScreen: React.FC = () => {
  const { t } = useTranslation('dashboard');
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
  const [serviceCategories, setServiceCategories] = useState<string[]>([]);
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
  
  // Data Retention state
  const [showDataRetentionModal, setShowDataRetentionModal] = useState(false);
  const [dataRetentionDaysRemaining, setDataRetentionDaysRemaining] = useState(0);
  
  // Points balance state
  const [pointsBalance, setPointsBalance] = useState<number>(0);
  const [pointsLoading, setPointsLoading] = useState(false);

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
      Logger.debug('🔄 useFocusEffect triggered', { hasUser: !!user, userId: user?.id });
      loadLocationPreference(); // Always load location preference
      loadSmsStatus(); // Always load SMS status
      loadFreeInspectionStatus(); // Load free inspection status
      if (user?.id) {
        Logger.debug('🔄 Screen focused, refreshing data for user:', user.id);
        loadDashboardData();
        refreshCallDetectionStatus();
        loadRecentActivity();
        loadProviderStats(user.id);
      } else {
        Logger.debug('⚠️ useFocusEffect: User not loaded yet, skipping refresh');
      }
    }, [user?.id])
  );

  const initializeScreen = async () => {
    try {
      Logger.debug('🚀 ========== DASHBOARD INITIALIZATION START ==========');
      
      Logger.debug('🚀 Step 1: Loading user data...');
      await loadUserData();
      Logger.debug('🚀 Step 1: User data loaded');
      
      Logger.debug('🚀 Step 2: Loading dashboard data...');
      await loadDashboardData();
      Logger.debug('🚀 Step 2: Dashboard data loaded');
      
      Logger.debug('🚀 Step 3: Refreshing call detection status...');
      await refreshCallDetectionStatus();
      Logger.debug('🚀 Step 3: Call detection status refreshed');
      
      Logger.debug('🚀 Step 4: Loading recent activity...');
      await loadRecentActivity();
      Logger.debug('🚀 Step 4: Recent activity loaded');
      
      Logger.debug('🚀 Step 5: Testing backend connection...');
      await testBackendConnection();
      Logger.debug('🚀 Step 5: Backend connection tested');
      
      Logger.debug('🚀 Step 6: Checking data retention status...');
      await checkDataRetentionStatus();
      Logger.debug('🚀 Step 6: Data retention checked');
      
      Logger.debug('🚀 Step 7: Loading points balance...');
      await loadPointsBalance();
      Logger.debug('🚀 Step 7: Points balance loaded');
      
      Logger.debug('🚀 ========== DASHBOARD INITIALIZATION COMPLETE ==========');
    } catch (error) {
      Logger.error('❌ ========== DASHBOARD INITIALIZATION ERROR ==========');
      Logger.error('❌ Error initializing screen:', error);
      Alert.alert(t('common:error'), t('errorLoadingData'));
    }
  };
  
  // Check data retention status and show modal if expiring soon (within 30 days)
  const checkDataRetentionStatus = async () => {
    try {
      const response = await ApiService.getInstance().getDataRetentionStatus();
      if (response.success && response.data) {
        const daysRemaining = response.data.dataRetention?.daysRemaining;
        // Show modal if less than 30 days remaining
        if (daysRemaining !== undefined && daysRemaining <= 30) {
          // Check if user already dismissed this session
          const dismissedKey = 'dataRetentionDismissed';
          const dismissed = await AsyncStorage.getItem(dismissedKey);
          const today = new Date().toDateString();
          
          if (dismissed !== today) {
            setDataRetentionDaysRemaining(daysRemaining);
            setShowDataRetentionModal(true);
          }
        }
      }
    } catch (error) {
      Logger.error('Error checking data retention status:', error);
    }
  };
  
  const handleDataRetentionExtended = () => {
    setShowDataRetentionModal(false);
    Alert.alert(t('common:success'), t('dataRetentionExtended'));
  };
  
  const handleDataRetentionDismissed = async () => {
    // Mark as dismissed for today so we don't show again this session
    await AsyncStorage.setItem('dataRetentionDismissed', new Date().toDateString());
    setShowDataRetentionModal(false);
  };

  // Load points balance
  const loadPointsBalance = async () => {
    try {
      setPointsLoading(true);
      const response = await ApiService.getInstance().getPointsBalance();
      if (response.success && response.data) {
        setPointsBalance(response.data.current_balance || 0);
      }
    } catch (error) {
      Logger.error('Error loading points balance:', error);
    } finally {
      setPointsLoading(false);
    }
  };

  const testBackendConnection = async () => {
    try {
      const response = await ApiService.getInstance().healthCheck();
      if (response.success) {
        Logger.debug('✅ Backend connection successful:', response.data);
      } else {
        Logger.debug('❌ Backend connection failed:', response.error);
      }
    } catch (error) {
      Logger.debug('❌ Backend connection error:', error);
    }
  };

  const testDatabaseConnection = async () => {
    try {
      Logger.debug('🔍 Testing database connection...');
      
      // Test 1: Health Check
      const healthResponse = await ApiService.getInstance().healthCheck();
      Logger.debug('📊 Health Check:', healthResponse);
      
      // Test 2: Try to get dashboard stats (this will test database queries)
      const statsResponse = await ApiService.getInstance().getDashboardStats();
      Logger.debug('📈 Dashboard Stats:', statsResponse);
      
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
      Logger.debug('📞 Sync Test:', syncResponse);
      
      // Show results to user
      Alert.alert(
        t('dbTestResult'),
        `${t('healthCheck')} ${healthResponse.success ? `✅ ${t('successful')}` : `❌ ${t('failed')}`}\n` +
        `${t('statistics')}: ${statsResponse.success ? `✅ ${t('successful')}` : `❌ ${t('failed')}`}\n` +
        `${t('sync')}: ${syncResponse.success ? `✅ ${t('successful')}` : `❌ ${t('failed')}`}\n\n` +
        t('checkConsoleDetails'),
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      Logger.error('❌ Database connection test failed:', error);
      Alert.alert(
        t('dbTestError'),
        `${t('errorOccurred')} ${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const setupCallDetectionListener = () => {
    callDetectionService.addMissedCallListener(handleMissedCall);
  };

  const handleMissedCall = (event: any) => {
    Logger.debug('📞 New missed call received:', event);
    
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
      title: t('missedCall'),
      subtitle: `${event.phoneNumber} • ${event.formattedTime}`,
      status: t('aiResponse'),
      timestamp: event.timestamp,
    };

    setRecentActivity(prev => [newActivity, ...prev.slice(0, 9)]);
    setLastUpdated(new Date());

    // Show notification
    Alert.alert(
      t('missedCallFrom'),
      `${t('from')} ${event.phoneNumber}\n${t('time')} ${event.formattedTime}`,
      [{ text: 'OK' }]
    );
  };

  const loadProviderStats = async (userId: string) => {
    try {
      Logger.debug('📊 Loading provider stats for user:', userId);
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

      Logger.debug('✅ Provider stats loaded:', stats);
      setProviderStats(stats);
    } catch (error) {
      Logger.error('❌ Error loading provider stats:', error);
    }
  };

  const loadUserData = async () => {
    try {
      Logger.debug('👤 ========== loadUserData START ==========');
      
      // Check if user is authenticated first
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
      Logger.debug('👤 Authentication status:', isAuthenticated);
      
      if (!isAuthenticated) {
        Logger.debug('⚠️ User not authenticated, triggering logout');
        AuthBus.emit('logout');
        Logger.debug('👤 ========== loadUserData ABORTED (NOT AUTHENTICATED) ==========');
        return;
      }

      Logger.debug('� Calling getCurrentUser API...');
      const response = await ApiService.getInstance().getCurrentUser();
      Logger.debug('� getCurrentUser response:', { success: response.success, hasData: !!response.data });
      Logger.debug('� Full response data:', JSON.stringify(response.data, null, 2));
      
      if (response.success && response.data) {
        Logger.debug('✅ User data loaded from backend successfully');
        // Handle nested user object (common API pattern)
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        
        Logger.debug('� Checking user fields:', {
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
          firstName: userData.firstName || userData.first_name || t('user'),
          lastName: userData.lastName || userData.last_name || '',
          phoneNumber: userData.phoneNumber || userData.phone_number || '',
          role: userData.role || 'tradesperson',
          businessId: userData.businessId || userData.business_id,
          isGdprCompliant: userData.isGdprCompliant || userData.is_gdpr_compliant || false,
          subscription_tier_id: userData.subscription_tier_id || 'free',
        };
        Logger.debug('� Mapped user data:', mappedUser);
        Logger.debug('👤 User ID that will be used for API calls:', mappedUser.id);
        
        // Save user to AsyncStorage so other services can access it
        await AsyncStorage.setItem('user', JSON.stringify(mappedUser));
        Logger.debug('💾 User saved to AsyncStorage for call detection service');
        
        Logger.debug('👤 Setting user state...');
        setUser(mappedUser);
        Logger.debug('👤 User state set successfully');
        Logger.debug('👤 ========== loadUserData COMPLETE (REAL USER) ==========');
        
        // Load service categories, profile image, and provider stats
        if (mappedUser.id) {
          try {
            // Load current selected categories from provider_service_categories
            const categoriesResponse = await ApiService.getInstance().makeRequest(`/provider/categories`);
            if (categoriesResponse.success && categoriesResponse.data) {
              const data = categoriesResponse.data as any;
              if (data.categories && Array.isArray(data.categories)) {
                // API returns objects {category_id, category_label_bg, ...} - extract string IDs
                const categoryIds = data.categories.map((cat: any) => 
                  typeof cat === 'string' ? cat : (cat.category_id || cat.id || String(cat))
                );
                setServiceCategories(categoryIds);
              }
            }
            
            // Load profile image
            const profileResponse = await ApiService.getInstance().makeRequest(`/marketplace/providers/${mappedUser.id}`);
            if (profileResponse.success && profileResponse.data) {
              const profileData: any = profileResponse.data;
              if (profileData.profileImageUrl) {
                setProfileImageUrl(profileData.profileImageUrl);
              }
            }
            // Load provider stats
            await loadProviderStats(mappedUser.id);
          } catch (error) {
            Logger.error('Error loading profile data:', error);
          }
        }
      } else {
        Logger.debug('⚠️ No user data from backend, trying cached user. Response:', response);
        const cachedUserStr = await AsyncStorage.getItem('user');
        if (cachedUserStr) {
          try {
            const cached = JSON.parse(cachedUserStr);
            const cachedUser = cached.user || cached;
            setUser(cachedUser);
            Logger.debug('👤 Using cached user:', cachedUser.id);
          } catch (e) {
            Logger.error('Failed to parse cached user:', e);
          }
        }
        Logger.debug('👤 ========== loadUserData COMPLETE (CACHE FALLBACK) ==========');
      }
    } catch (error) {
      Logger.error('❌ ========== loadUserData ERROR ==========');
      Logger.error('❌ Failed to load user data:', error);
      // Try cached user as fallback
      try {
        const cachedUserStr = await AsyncStorage.getItem('user');
        if (cachedUserStr) {
          const cached = JSON.parse(cachedUserStr);
          const cachedUser = cached.user || cached;
          setUser(cachedUser);
          Logger.debug('👤 Using cached user as error fallback:', cachedUser.id);
        }
      } catch (cacheError) {
        Logger.error('Failed to load cached user:', cacheError);
      }
      Logger.debug('👤 ========== loadUserData COMPLETE (ERROR FALLBACK) ==========');
    }
  };

  const loadDashboardData = async () => {
    try {
      Logger.debug('📊 ========== loadDashboardData START ==========');
      Logger.debug('📊 Current user state:', { hasUser: !!user, userId: user?.id });
      
      if (!user?.id) {
        Logger.debug('⚠️ loadDashboardData: No user ID available, cannot fetch stats');
        return;
      }
      
      Logger.debug('📊 Fetching dashboard stats for user:', user.id);
      
      // Try to get real stats from backend first (pass userId for missed calls count)
      const response = await ApiService.getInstance().getDashboardStats(user.id);
      Logger.debug('📊 getDashboardStats response:', { success: response.success, data: response.data });
      
      // Get chat source stats (use user.id as providerId for service providers)
      let chatSourceStats = { smsChatCases: 0, searchChatCases: 0 };
      try {
        Logger.debug('📊 Fetching chat source stats for provider:', user.id);
        const chatSourceResponse = await ApiService.getInstance().getCaseStatsByChatSource(user.id);
        Logger.debug('📊 getCaseStatsByChatSource response:', { 
          success: chatSourceResponse.success, 
          data: chatSourceResponse.data 
        });
        
        if (chatSourceResponse.success && chatSourceResponse.data) {
          Logger.debug('✅ Chat source stats loaded successfully');
          const totals = chatSourceResponse.data.totals || chatSourceResponse.data;
          chatSourceStats = {
            smsChatCases: totals.smschat || 0,
            searchChatCases: totals.searchchat || 0,
          };
          Logger.debug('📊 Parsed chat source stats:', chatSourceStats);
        } else {
          Logger.debug('⚠️ Chat source stats response not successful or no data');
        }
      } catch (error) {
        Logger.error('❌ Error loading chat source stats:', error);
      }
      
      if (response.success && response.data) {
        Logger.debug('✅ Dashboard stats loaded from backend successfully');
        const newStats = {
          ...response.data,
          ...chatSourceStats,
        };
        Logger.debug('📊 Final merged stats to be set:', newStats);
        Logger.debug('📊 Stats breakdown:', {
          totalCalls: newStats.totalCalls,
          missedCalls: newStats.missedCalls,
          smsSent: newStats.smsSent,
          smsChatCases: newStats.smsChatCases,
          searchChatCases: newStats.searchChatCases
        });
        setStats(newStats);
        setLastUpdated(new Date());
        Logger.debug('📊 ========== loadDashboardData SUCCESS ==========');
        return;
      }
      
      Logger.debug('⚠️ Backend stats not available, using local data');
      
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
      
      Logger.debug('📊 Fallback stats:', updatedStats);
      setStats(updatedStats);
      setLastUpdated(new Date());
      Logger.debug('📊 ========== loadDashboardData FALLBACK ==========');
    } catch (error) {
      Logger.error('❌ ========== loadDashboardData ERROR ==========');
      Logger.error('❌ Failed to load dashboard data:', error);
      if (error instanceof Error) {
        Logger.error('❌ Error details:', {
          message: error.message,
          stack: error.stack
        });
      }
    }
  };

  const loadRecentActivity = async () => {
    try {
      Logger.debug('📋 Loading recent activity...');
      
      // Get real missed calls from local storage
      const storedCalls = await callDetectionService.getStoredMissedCalls();
      Logger.debug('📞 Found stored calls:', storedCalls.length);
      
      // Convert stored calls to activity items
      const callActivities: ActivityItem[] = storedCalls
        .slice(0, 10) // Show up to 10 recent calls
        .map((call, index) => ({
          id: call.id || `call_${index}`,
          icon: '📞',
          title: t('missedCall'),
          subtitle: `${call.phoneNumber} • ${call.formattedTime}`,
          status: call.aiResponseSent ? t('aiResponseSent') : t('processing'),
          timestamp: call.timestamp,
        }));

      // Sort by timestamp (most recent first)
      const allActivities = callActivities
        .sort((a, b) => b.timestamp - a.timestamp);

      Logger.debug('✅ Recent activity loaded:', allActivities.length, 'items');
      setRecentActivity(allActivities);
    } catch (error) {
      Logger.error('Failed to load recent activity:', error);
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
      Logger.error('Failed to refresh call detection status:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Logger.debug('🔄 ========== MANUAL REFRESH START ==========');
    Logger.debug('🔄 Current user:', { hasUser: !!user, userId: user?.id });
    
    try {
      Logger.debug('🔄 Refreshing dashboard data...');
      await loadDashboardData();
      Logger.debug('🔄 Refreshing call detection status...');
      await refreshCallDetectionStatus();
      Logger.debug('🔄 Refreshing recent activity...');
      await loadRecentActivity();
      if (user?.id) {
        Logger.debug('🔄 Refreshing provider stats...');
        await loadProviderStats(user.id);
      }
      Logger.debug('✅ ========== MANUAL REFRESH COMPLETE ==========');
    } catch (error) {
      Logger.error('❌ ========== MANUAL REFRESH ERROR ==========');
      Logger.error('❌ Error refreshing dashboard:', error);
    }
    
    setIsRefreshing(false);
  };

  // Load location sharing preference and determine mode
  const loadLocationPreference = async () => {
    try {
      // Get tracking preference
      const enabled = await LocationTrackingService.getInstance().getTrackingPreference();
      Logger.debug('📍 Dashboard - Tracking preference:', enabled);
      setIsLocationEnabled(enabled);
      
      // Get schedule settings
      const scheduleResponse = await ApiService.getInstance().getLocationSchedule();
      Logger.debug('📍 Dashboard - Schedule response:', JSON.stringify(scheduleResponse, null, 2));
      if (scheduleResponse.success && scheduleResponse.data) {
        const schedule = scheduleResponse.data;
        const newScheduleSettings = {
          schedule_enabled: schedule.schedule_enabled,
          start_time: schedule.start_time || '08:00',
          end_time: schedule.end_time || '21:00',
        };
        Logger.debug('📍 Dashboard - Setting schedule settings:', JSON.stringify(newScheduleSettings, null, 2));
        setScheduleSettings(newScheduleSettings);
        
        // Determine location mode based on settings
        if (!enabled) {
          setLocationMode('off');
        } else if (schedule.schedule_enabled) {
          setLocationMode('schedule');
        } else {
          setLocationMode('always');
        }
        Logger.debug('📍 Dashboard - Location mode set to:', !enabled ? 'off' : (schedule.schedule_enabled ? 'schedule' : 'always'));
      } else {
        // No schedule data, determine mode from enabled state only
        setLocationMode(enabled ? 'always' : 'off');
        Logger.debug('📍 Dashboard - No schedule data, mode set to:', enabled ? 'always' : 'off');
      }
    } catch (error) {
      Logger.error('Error loading location preference:', error);
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
        Logger.debug('📱 SMS enabled but call detection not running, syncing...');
        const hasPermissions = await callDetectionService.checkPermissions();
        if (hasPermissions?.hasAllPermissions) {
          await callDetectionService.startDetection();
          await refreshCallDetectionStatus();
          Logger.debug('✅ Call detection synced with SMS status');
        }
      } else if (!stats.isEnabled && isCallDetectionRunning) {
        // SMS is disabled but call detection is running - stop it
        Logger.debug('📱 SMS disabled but call detection running, syncing...');
        await callDetectionService.stopDetection();
        await refreshCallDetectionStatus();
        Logger.debug('✅ Call detection stopped (SMS disabled)');
      }
    } catch (error) {
      Logger.error('Error loading SMS status:', error);
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
      Logger.error('Error changing location mode:', error);
      Alert.alert(t('common:error'), t('locationModeChangeError'));
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
            t('permissionsRequired'),
            t('callDetectionPermissions'),
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
          Alert.alert(t('common:error'), t('smsPermissionsNeeded'));
          return;
        }
        
        Alert.alert(
          `✅ ${t('autoSMSActivated')}`,
          t('autoSMSMessage'),
          [{ text: 'OK' }]
        );
      } else {
        // Stop call detection
        await callDetectionService.stopDetection();
        await refreshCallDetectionStatus();
        
        // Disable SMS
        await SMSService.getInstance().toggleEnabled();
        
        // Sync to native to stop the foreground service
        await callDetectionService.syncSettingsToNative();
      }
    } catch (error) {
      Logger.error('Error toggling SMS with call detection:', error);
      setIsSmsEnabled(!isSmsEnabled); // Revert
      Alert.alert(t('common:error'), t('settingsChangeError'));
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
            t('contactPermissionRequired'),
            t('contactPermissionMessage'),
            [{ text: 'OK' }]
          );
          setIsTogglingFilter(false);
          return;
        }
      }
      
      // Update the SMS service config
      await SMSService.getInstance().updateConfig({ filterKnownContacts: newFiltering });
      setFilterKnownContacts(newFiltering);
      
      // Sync to native so background service uses new filter setting
      await callDetectionService.syncSettingsToNative();
      
      Alert.alert(
        newFiltering ? `✅ ${t('filterOn')}` : `❌ ${t('filterOff')}`,
        newFiltering 
          ? t('filterOnMessage')
          : t('filterOffMessage'),
        [{ text: 'OK' }]
      );
    } catch (error) {
      Logger.error('Error toggling contact filter:', error);
      Alert.alert(t('common:error'), t('filterChangeError'));
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
      Logger.error('Error loading free inspection status:', error);
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
          value ? `✅ ${t('freeInspectionActivated')}` : `❌ ${t('freeInspectionDeactivated')}`,
          value 
            ? t('freeInspectionActiveMessage')
            : t('freeInspectionInactiveMessage')
        );
      } else {
        Alert.alert(t('common:error'), t('statusChangeError'));
      }
    } catch (error) {
      Logger.error('Error toggling free inspection:', error);
      Alert.alert(t('common:error'), t('serverConnectionError'));
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
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('logout'), 
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
              Alert.alert(t('common:error'), t('logoutError'));
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
        <Text style={styles.errorText}>{t('errorNoUserData')}</Text>
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
              <Text style={styles.welcomeText}>{t('welcome')}</Text>
              <Text style={styles.userName}>
                {user ? `${user.firstName} ${user.lastName}` : t('loading')}
              </Text>
              {/* Subscription Badge - on its own line */}
              <View style={{
                alignSelf: 'flex-start',
                backgroundColor: user?.subscription_tier_id === 'pro' ? 'rgba(168, 85, 247, 0.2)' :
                                 user?.subscription_tier_id === 'normal' ? 'rgba(59, 130, 246, 0.2)' :
                                 'rgba(148, 163, 184, 0.2)',
                borderWidth: 1,
                borderColor: user?.subscription_tier_id === 'pro' ? '#a855f7' :
                             user?.subscription_tier_id === 'normal' ? '#3b82f6' :
                             '#94a3b8',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 12,
                marginBottom: 8,
              }}>
                <Text style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: user?.subscription_tier_id === 'pro' ? '#c084fc' :
                         user?.subscription_tier_id === 'normal' ? '#60a5fa' :
                         '#94a3b8',
                }}>
                  {user?.subscription_tier_id === 'pro' ? 'PRO' :
                   user?.subscription_tier_id === 'normal' ? 'NORMAL' : 'FREE'}
                </Text>
              </View>
              {/* Categories as chips */}
              <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 6}}>
                {serviceCategories.length > 0 
                  ? serviceCategories.map((cat, index) => (
                      <View key={index} style={{
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        borderRadius: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}>
                        <Text style={{
                          fontSize: 12,
                          color: '#a5b4fc',
                          fontWeight: '500',
                        }}>
                          {getCategoryLabel(cat)}
                        </Text>
                      </View>
                    ))
                  : <Text style={styles.userRole}>{t('loading')}</Text>
                }</View>
              <Text style={styles.profileHint}>{t('viewProfile')}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsIconButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ==================== POINTS BALANCE CARD ==================== */}
        <TouchableOpacity 
          style={styles.pointsCard}
          onPress={() => navigation.navigate('Points')}
          activeOpacity={0.8}
        >
          <View style={styles.pointsCardContent}>
            <View style={styles.pointsCardLeft}>
              <Text style={styles.pointsCardIcon}>💰</Text>
              <View>
                <Text style={styles.pointsCardLabel}>{t('common:points')}</Text>
                <Text style={styles.pointsCardValue}>
                  {pointsLoading ? '...' : pointsBalance}
                </Text>
              </View>
            </View>
            <View style={styles.pointsCardRight}>
              <View style={styles.buyPointsButton}>
                <Text style={styles.buyPointsButtonText}>{t('common:buyPoints')}</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

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
              <Text style={styles.automationHubTitle}>{t('automation')}</Text>
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
                ].filter(Boolean).join(' ') || t('off')}
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
                  <Text style={styles.automationRowLabel}>{t('autoSMS')}</Text>
                  <Text style={styles.automationRowStatus}>
                    {isSmsEnabled ? `${t('active')} • ${t('monitoringCalls')}` : t('inactive')}
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
                    <Text style={styles.automationRowLabel}>{t('contactFilter')}</Text>
                    <Text style={styles.automationRowStatus}>
                      {filterKnownContacts ? t('filterEnabled') : t('filterDisabled')}
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
                  <Text style={styles.automationRowLabel}>{t('freeInspection')}</Text>
                  <Text style={styles.automationRowStatus}>
                    {freeInspectionActive ? t('active') : t('inactive')}
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
                  <Text style={styles.automationRowLabel}>{t('locationSharing')}</Text>
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
                    ]}>{t('off')}</Text>
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
                    ]}>{t('alwaysOn')}</Text>
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
                      ]}>{t('scheduled')}</Text>
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
                <Text style={styles.automationSettingsText}>⚙️ {t('fullAutomationSettings')}</Text>
                <Text style={styles.automationSettingsArrow}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
        {/* ==================== END AUTOMATION HUB ==================== */}

        {/* Quick Actions Navigation */}
        <View style={styles.actionsContainer}>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Cases')}>
              <Text style={styles.navIcon}>📋</Text>
                <Text style={styles.actionText}>{t('viewCases')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={handleChatPress}>
              <Text style={styles.navIcon}>💬</Text>
                <Text style={styles.actionText}>{t('viewChat')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('SMS')}>
              <Text style={styles.navIcon}>📱</Text>
                <Text style={styles.actionText}>{t('viewSMS')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('MyBids')}>
              <Text style={styles.navIcon}>🏷️</Text>
                <Text style={styles.actionText}>{t('viewBids')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Points')}>
              <Text style={styles.navIcon}>💎</Text>
                <Text style={styles.actionText}>{t('viewPoints')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('VipVisibility')}>
              <Text style={styles.navIcon}>👑</Text>
                <Text style={styles.actionText}>{t('viewVIP')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('ReferralDashboard')}>
              <Text style={styles.navIcon}>🎯</Text>
                <Text style={styles.actionText}>{t('viewReferrals')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('MapSearch')}>
              <Text style={styles.navIcon}>🗺️</Text>
                <Text style={styles.actionText}>{t('viewMap')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('IncomeDashboard')}>
              <Text style={styles.navIcon}>📈</Text>
                <Text style={styles.actionText}>{t('viewIncome')}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Statistics')}>
              <Text style={styles.navIcon}>📊</Text>
                <Text style={styles.actionText}>{t('viewStatistics')}</Text>
            </TouchableOpacity>
            {user?.email === 'admin@snapfix.bg' && (
              <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Game')}>
                <Text style={styles.navIcon}>🎮</Text>
                <Text style={styles.actionText}>{t('viewGame')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* ==================== END QUICK ACTIONS ==================== */}

      {/* Recent Activity */}
      {/* <View style={styles.activityContainer}>
        <Text style={styles.sectionTitle}>{t('recentActivity')}</Text>
        
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
                activity.status === t('completed') ? styles.completedStatus : 
                activity.status === t('active') ? styles.activeStatus : styles.processingStatus
              ]}>
                {activity.status}
              </Text>
            </View>
          ))
        ) : (
          <View style={styles.activityItem}>
            <Text style={styles.activityIcon}>ℹ️</Text>
            <View style={styles.activityContent}>
              <Text style={styles.activityTitle}>{t('noRecentActivity')}</Text>
              <Text style={styles.activitySubtitle}>{t('startDetectionToSeeCalls')}</Text>
            </View>
          </View>
        )}
      </View> */}

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {t('lastUpdate')}: {lastUpdated.toLocaleTimeString(t('common:locale'))}
        </Text>
      </View>
    </ScrollView>
    );
  }

  return null;
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
  
  // ==================== POINTS CARD STYLES ====================
  pointsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    padding: 16,
  },
  pointsCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pointsCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pointsCardIcon: {
    fontSize: 32,
  },
  pointsCardLabel: {
    fontSize: 12,
    color: '#a5b4fc',
    marginBottom: 2,
  },
  pointsCardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  pointsCardRight: {
    alignItems: 'flex-end',
  },
  buyPointsButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  buyPointsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
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
