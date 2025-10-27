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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { ModernCallDetectionService } from '../services/ModernCallDetectionService';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

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
  responseRate: number;
  avgResponseTime: string;
  activeConversations: number;
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
    responseRate: 86,
    avgResponseTime: '2m 15s',
    activeConversations: 5,
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
      refreshCallDetectionStatus();
      loadRecentActivity();
    }, [])
  );

  const initializeScreen = async () => {
    try {
      console.log('🚀 Initializing dashboard...');
      await loadUserData();
      await loadDashboardData();
      await refreshCallDetectionStatus();
      await loadRecentActivity();
      await testBackendConnection();
      console.log('✅ Dashboard initialization complete');
    } catch (error) {
      console.error('❌ Error initializing dashboard:', error);
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
      // Check if user is authenticated first
      const isAuthenticated = ApiService.getInstance().isAuthenticated();
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
        return;
      }

      console.log('🔍 Dashboard - Calling getCurrentUser...');
      const response = await ApiService.getInstance().getCurrentUser();
      console.log('🔍 Dashboard - getCurrentUser response:', response);
      console.log('🔍 Dashboard - response.data:', JSON.stringify(response.data, null, 2));
      
      if (response.success && response.data) {
        console.log('✅ User data loaded from backend:', response.data);
        // Handle nested user object (common API pattern)
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        
        console.log('🔍 Checking user fields:', {
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
        console.log('📱 Mapped user data:', mappedUser);
        setUser(mappedUser);
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
        console.log('📱 Using mock user for testing');
      }
    } catch (error) {
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
      console.log('📱 Using mock user as fallback');
    }
  };

  const loadDashboardData = async () => {
    try {
      console.log('📊 Loading dashboard data from backend...');
      
      // Try to get real stats from backend first
      const response = await ApiService.getInstance().getDashboardStats();
      if (response.success && response.data) {
        console.log('✅ Dashboard stats loaded from backend:', response.data);
        setStats(response.data);
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
        responseRate: Math.max(70, 100 - todaysCalls.length * 2),
        avgResponseTime: '2m 15s',
        activeConversations: 5 + Math.floor(todaysCalls.length / 2),
      };
      
      setStats(updatedStats);
      setLastUpdated(new Date());
      console.log('✅ Dashboard data loaded');
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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
    console.log('🔄 Refreshing dashboard...');
    
    try {
      await loadDashboardData();
      await refreshCallDetectionStatus();
      await loadRecentActivity();
      console.log('✅ Dashboard refreshed successfully');
    } catch (error) {
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
            <Text style={styles.statNumber}>{stats.responseRate}%</Text>
            <Text style={styles.statLabel}>Отговорени</Text>
          </View>
          <View style={[styles.statCard, styles.infoCard]}>
            <Text style={styles.statNumber}>{stats.avgResponseTime}</Text>
            <Text style={styles.statLabel}>Ср. време отговор</Text>
          </View>
        </View>

        <View style={[styles.statCard, styles.fullWidth, styles.accentCard]}>
          <Text style={styles.statNumber}>{stats.activeConversations}</Text>
          <Text style={styles.statLabel}>Активни разговори</Text>
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
      <View style={styles.activityContainer}>
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
      </View>

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
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    backgroundColor: theme.colors.primary.solid,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...theme.shadows.md,
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    opacity: 0.9,
  },
  userName: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    marginTop: theme.spacing.xs,
  },
  userRole: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.bodySmall.fontSize,
    opacity: 0.8,
    marginTop: theme.spacing.xs,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  testButton: {
    backgroundColor: theme.colors.success.solid,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
  },
  testButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xl,
  },
  logoutButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
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
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    ...theme.shadows.md,
    width: cardWidth,
  },
  fullWidth: {
    width: '100%',
  },
  primaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.solid,
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning.solid,
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success.solid,
  },
  infoCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.status.info,
  },
  accentCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.solid,
  },
  statNumber: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  statusContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  statusCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.md,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statusLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.xl,
  },
  statusActive: {
    backgroundColor: theme.colors.success.solid,
  },
  statusInactive: {
    backgroundColor: theme.colors.danger.solid,
  },
  statusText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.inverse,
    fontWeight: '600',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  startButton: {
    flex: 1,
    backgroundColor: theme.colors.success.solid,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  stopButton: {
    flex: 1,
    backgroundColor: theme.colors.danger.solid,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  actionButton: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
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
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  actionSubtitle: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  },
  actionArrow: {
    fontSize: theme.typography.h3.fontSize,
    color: theme.colors.text.tertiary,
  },
  activityContainer: {
    padding: theme.spacing.lg,
    paddingTop: 0,
  },
  activityItem: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.md,
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
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  activitySubtitle: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  },
  activityStatus: {
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: 'bold',
    marginLeft: theme.spacing.sm,
  },
  activeStatus: {
    color: theme.colors.success.solid,
  },
  completedStatus: {
    color: theme.colors.text.tertiary,
  },
  processingStatus: {
    color: theme.colors.warning.solid,
  },
  footer: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  footerText: {
    fontSize: theme.typography.caption.fontSize,
    color: theme.colors.text.tertiary,
  },
  errorText: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.danger.solid,
    textAlign: 'center',
    margin: theme.spacing.lg,
  },
});

export default ModernDashboardScreen;
