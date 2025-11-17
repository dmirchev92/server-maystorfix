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
  Switch,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ModernCallDetectionService } from '../services/ModernCallDetectionService';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

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
}

interface DashboardStats {
  totalCalls: number;
  missedCalls: number;
  avgResponseTime: string;
  smsSent: number;
  smsChatCases?: number;
  searchChatCases?: number;
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
  const [isTogglingDetection, setIsTogglingDetection] = useState(false);
  const [serviceType, setServiceType] = useState<string>('Занаятчия');
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

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
      if (user?.id) {
        console.log('🔄 Screen focused, refreshing data for user:', user.id);
        loadDashboardData();
        refreshCallDetectionStatus();
        loadRecentActivity();
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
        
        // Load service type and profile image from provider profile
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
      console.log('✅ ========== MANUAL REFRESH COMPLETE ==========');
    } catch (error) {
      console.error('❌ ========== MANUAL REFRESH ERROR ==========');
      console.error('❌ Error refreshing dashboard:', error);
    }
    
    setIsRefreshing(false);
  };

  const handleStartCallDetection = async () => {
    try {
      console.log('🚀 Starting call detection...');
      
      // Check current permissions first
      console.log('🔍 Checking current permissions...');
      const currentPermissions = await callDetectionService.checkPermissions();
      console.log('📋 Current permissions status:', currentPermissions);
      
      // Request permissions with detailed feedback
      console.log('🔐 Requesting permissions...');
      const hasPermissions = await callDetectionService.requestPermissions();
      
      // Refresh status after permission request
      await refreshCallDetectionStatus();
      
      if (!hasPermissions) {
        Alert.alert(
          'Разрешения са необходими',
          'За детекция на обаждания са необходими разрешения за:\n\n• Достъп до състоянието на телефона\n• Достъп до списъка с обаждания\n\nМоля отидете в Настройки > Приложения > ServiceText Pro > Разрешения и ги активирайте ръчно.',
          [
            { text: 'Отказ', style: 'cancel' },
            { 
              text: 'Отвори настройки', 
              onPress: () => {
                // This would open app settings, but requires additional setup
                Alert.alert('Инструкции', 'Отидете в Настройки на телефона > Приложения > ServiceText Pro > Разрешения');
              }
            }
          ]
        );
        return;
      }

      console.log('✅ Permissions granted, starting detection...');

      // Start detection
      const success = await callDetectionService.startDetection();
      if (success) {
        Alert.alert(
          'Успех! 🎉', 
          'Детекцията на обаждания е стартирана успешно!\n\nСега можете да тествате с реално пропуснато обаждане.',
          [{ text: 'OK' }]
        );
        await refreshCallDetectionStatus();
      } else {
        Alert.alert(
          'Грешка при стартиране', 
          'Не успяхме да стартираме детекцията на обаждания. Проверете дали разрешенията са дадени правилно.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('❌ Error starting call detection:', error);
      Alert.alert(
        'Грешка', 
        `Възникна грешка при стартиране на детекцията:\n\n${error}`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleStopCallDetection = async () => {
    try {
      const success = await callDetectionService.stopDetection();
      if (success) {
        Alert.alert('Успех', 'Детекцията на обаждания е спряна.');
        await refreshCallDetectionStatus();
      }
    } catch (error) {
      console.error('Error stopping call detection:', error);
    }
  };


  const handleToggleDetectionSwitch = async (value: boolean) => {
    if (isTogglingDetection) return;
    setIsTogglingDetection(true);
    try {
      if (value) {
        await handleStartCallDetection();
      } else {
        await handleStopCallDetection();
      }
    } finally {
      setIsTogglingDetection(false);
    }
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
          <View style={styles.headerLeft}>
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
                <Text style={styles.userRole}>
                  {serviceType}
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity style={styles.settingsIconButton} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.settingsIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusCard}>
            <View style={styles.statusHeaderRow}>
              <Text style={styles.sectionTitle}>Детекция на обаждания</Text>
              <Switch
                value={!!callDetectionStatus.isListening}
                onValueChange={handleToggleDetectionSwitch}
                disabled={isTogglingDetection}
              />
            </View>
            <View style={styles.chipsRow}>
              <View style={[styles.chip, callDetectionStatus.isListening ? styles.chipSuccess : styles.chipDanger]}>
                <Text style={styles.chipText}>
                  {callDetectionStatus.isListening ? 'Активна' : 'Неактивна'}
                </Text>
              </View>
              <View style={[styles.chip, callDetectionStatus.hasPermissions ? styles.chipSuccess : styles.chipWarning]}>
                <Text style={styles.chipText}>
                  {callDetectionStatus.hasPermissions ? 'Дадени' : 'Нужни'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.kpiRowNew}>
          <View style={[styles.kpiCard, styles.kpiWarning]} key={`missed-${stats.missedCalls}`}>
            <Text style={styles.kpiValue}>{stats.missedCalls}</Text>
            <View style={styles.kpiLabelRow}>
              <View style={styles.redPhoneIcon}>
                <Text style={styles.redPhoneText}>📞</Text>
              </View>
              <Text style={styles.kpiLabelText}>Пропуснати</Text>
            </View>
          </View>
          <View style={[styles.kpiCard, styles.kpiSuccess]} key={`sms-${stats.smsSent}`}>
            <Text style={styles.kpiValue}>{stats.smsSent}</Text>
            <Text style={styles.kpiLabel}>
              <Text style={styles.kpiIcon}>💬</Text> SMS Изпратени
            </Text>
          </View>
        </View>

        {/* Chat Source Stats */}
        <View style={styles.kpiRowNew}>
          <TouchableOpacity 
            style={[styles.kpiCard, styles.kpiSms]}
            onLongPress={() => {
              Alert.alert(
                '📱 SMS Заявки',
                'Заявки създадени от клиенти чрез SMS линк след пропуснато обаждане. Тези клиенти са се свързали с вас директно.',
                [{ text: 'Разбрах' }]
              );
            }}
          >
            <Text style={styles.kpiValue}>{stats.smsChatCases || 0}</Text>
            <Text style={styles.kpiLabel}>📱 SMS Заявки</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.kpiCard, styles.kpiSearch]}
            onLongPress={() => {
              Alert.alert(
                '🌐 Уеб Заявки',
                'Заявки създадени от клиенти които са ви намерили чрез търсачката на сайта. Нови потенциални клиенти.',
                [{ text: 'Разбрах' }]
              );
            }}
          >
            <Text style={styles.kpiValue}>{stats.searchChatCases || 0}</Text>
            <Text style={styles.kpiLabel}>🌐 Уеб Заявки</Text>
          </TouchableOpacity>
        </View>

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
              <Text style={styles.navIcon}>💰</Text>
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
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('IncomeDashboard')}>
              <Text style={styles.navIcon}>📊</Text>
              <Text style={styles.navLabel}>Табло</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navCard} onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.navIcon}>💳</Text>
              <Text style={styles.navLabel}>Абонамент</Text>
            </TouchableOpacity>
            <View style={styles.navCardEmpty} />
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
        <View style={styles.userInfo}>
          <Text style={styles.welcomeText}>Добре дошли,</Text>
          <Text style={styles.userName}>
            {user ? `${user.firstName} ${user.lastName}` : 'Зареждане...'}
          </Text>
          <Text style={styles.userRole}>
            {user ? (user.role === 'tradesperson' ? 'Занаятчия' : user.role) : 'Зареждане...'}
          </Text>
        </View>
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

      {/* Call Detection Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.sectionTitle}>Детекция на обаждания</Text>
        
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Статус:</Text>
            <View style={[
              styles.statusIndicator, 
              callDetectionStatus.isListening ? styles.statusActive : styles.statusInactive
            ]}>
              <Text style={styles.statusText}>
                {callDetectionStatus.isListening ? 'Активна' : 'Неактивна'}
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
            {!callDetectionStatus.isListening ? (
              <TouchableOpacity style={styles.startButton} onPress={handleStartCallDetection}>
                <Text style={styles.buttonText}>Стартирай детекция</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.stopButton} onPress={handleStopCallDetection}>
                <Text style={styles.buttonText}>Спри детекция</Text>
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
});

export default ModernDashboardScreen;
