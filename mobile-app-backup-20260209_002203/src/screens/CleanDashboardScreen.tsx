// Clean Dashboard Screen - No Complex Detection Systems
// Simple, working dashboard without any call detection complexity

import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CleanDashboardScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 87,
    missedCalls: 12,
    responseRate: 86,
    avgResponseTime: '2m 15s',
    activeConversations: 5,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  useEffect(() => {
    loadUserData();
    loadDashboardData();
  }, []);

  const loadUserData = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data && response.data.user) {
        setUser(response.data.user);
      } else {
        // Try cached user as fallback
        const cachedUserStr = await AsyncStorage.getItem('user');
        if (cachedUserStr) {
          try {
            const cached = JSON.parse(cachedUserStr);
            setUser(cached.user || cached);
            Logger.debug('👤 Using cached user as fallback');
          } catch (e) {
            Logger.error('Failed to parse cached user:', e);
          }
        }
      }
    } catch (error) {
      Logger.error('Failed to load user data:', error);
      try {
        const cachedUserStr = await AsyncStorage.getItem('user');
        if (cachedUserStr) {
          const cached = JSON.parse(cachedUserStr);
          setUser(cached.user || cached);
          Logger.debug('👤 Using cached user as error fallback');
        }
      } catch (cacheError) {
        Logger.error('Failed to load cached user:', cacheError);
      }
    }
  };

  const loadDashboardData = async () => {
    try {
      Logger.debug('📊 Loading clean dashboard data...');
      
      // Simple, consistent stats
      const cleanStats: DashboardStats = {
        totalCalls: 87,
        missedCalls: 12,
        responseRate: 86,
        avgResponseTime: '2m 15s',
        activeConversations: 5,
      };
      
      setStats(cleanStats);
      setLastUpdated(new Date());
      Logger.debug('✅ Clean dashboard data loaded');
    } catch (error) {
      Logger.error('Failed to load dashboard data:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    Logger.debug('🔄 Refreshing clean dashboard...');
    
    try {
      await loadDashboardData();
      Logger.debug('✅ Dashboard refreshed successfully');
    } catch (error) {
      Logger.error('❌ Error refreshing dashboard:', error);
    }
    
    setIsRefreshing(false);
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
              await ApiService.logout();
              navigation.replace('Login');
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
          <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.userRole}>
            {user.role === 'tradesperson' ? 'Занаятчия' : user.role}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogoutPress}>
          <Text style={styles.logoutButtonText}>Излизане</Text>
        </TouchableOpacity>
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

      {/* Simple Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.sectionTitle}>Статус на системата</Text>
        
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>
            ✅ Системата работи в тестов режим
          </Text>
          <Text style={styles.statusText}>
            • Dashboard: Активен{'\n'}
            • Chat система: Готова{'\n'}
            • GDPR съответствие: Активно{'\n'}
            • Offline режим: Включен
          </Text>
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
        
        <View style={styles.activityItem}>
          <Text style={styles.activityIcon}>📞</Text>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Пропуснато обаждане</Text>
            <Text style={styles.activitySubtitle}>+359 888 123 456 • преди 5 мин</Text>
          </View>
          <Text style={styles.activityStatus}>AI отговор</Text>
        </View>

        <View style={styles.activityItem}>
          <Text style={styles.activityIcon}>💬</Text>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Нов разговор</Text>
            <Text style={styles.activitySubtitle}>Клиент: Георги Петров • преди 15 мин</Text>
          </View>
          <Text style={styles.activityStatus}>Активен</Text>
        </View>

        <View style={styles.activityItem}>
          <Text style={styles.activityIcon}>✅</Text>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Завършен разговор</Text>
            <Text style={styles.activitySubtitle}>Клиент: Мария Иванова • преди 1 час</Text>
          </View>
          <Text style={styles.activityStatus}>Завършен</Text>
        </View>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2E7D32',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flex: 1,
  },
  welcomeText: {
    color: 'white',
    fontSize: 16,
    opacity: 0.9,
  },
  userName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  userRole: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
    marginTop: 2,
  },
  logoutButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsContainer: {
    padding: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    width: cardWidth,
  },
  fullWidth: {
    width: '100%',
  },
  primaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  infoCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  accentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9C27B0',
  },
  statNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statusContainer: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actionsContainer: {
    padding: 20,
    paddingTop: 0,
  },
  actionButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  actionArrow: {
    fontSize: 24,
    color: '#ccc',
  },
  activityContainer: {
    padding: 20,
    paddingTop: 0,
  },
  activityItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#666',
  },
  activityStatus: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
    marginLeft: 10,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#999',
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    margin: 20,
  },
});

export default CleanDashboardScreen;



