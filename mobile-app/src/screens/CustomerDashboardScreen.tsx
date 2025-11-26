import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

const { width } = Dimensions.get('window');

export default function CustomerDashboardScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [activeCasesCount, setActiveCasesCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDashboardData();
      }
    }, [user])
  );

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data) {
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      // Fetch active cases
      const casesResponse = await ApiService.getInstance().getCasesWithFilters({
        customerId: user.id,
        limit: 10,
      });

      if (casesResponse.success && casesResponse.data) {
        const cases = casesResponse.data.cases || [];
        setRecentCases(cases);
        // Count active (not completed/cancelled)
        const active = cases.filter((c: any) => 
          ['pending', 'accepted', 'in_progress'].includes(c.status)
        ).length;
        setActiveCasesCount(active);
      }

      // Fetch unread messages (mock or real API)
      // For now, we'll just set it to 0 or fetch if endpoint exists
      // const messagesResponse = await ApiService.getInstance().getUnreadCount();
      // setUnreadMessagesCount(messagesResponse.count);

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    Alert.alert(
      'Изход',
      'Сигурни ли сте, че искате да излезете?',
      [
        { text: 'Отказ', style: 'cancel' },
        { 
          text: 'Изход', 
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.getInstance().logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
            // Emit logout event to trigger app-wide logout
            AuthBus.emit('logout');
          }
        }
      ]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}` : 'CL'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>Добре дошли,</Text>
            <Text style={styles.userName}>
              {user ? `${user.firstName} ${user.lastName}` : 'Клиент'}
            </Text>
            <View style={styles.serviceTypesContainer}>
              <Text style={styles.userRole}>Клиент</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsIconButton} onPress={handleLogout}>
          <Text style={styles.settingsIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRowNew}>
        <View style={[styles.kpiCard, styles.kpiActive]}>
          <Text style={styles.kpiValue}>{activeCasesCount}</Text>
          <View style={styles.kpiLabelRow}>
            <Text style={styles.kpiIcon}>📋</Text>
            <Text style={styles.kpiLabelText}>Активни заявки</Text>
          </View>
        </View>
        <View style={[styles.kpiCard, styles.kpiMessages]}>
          <Text style={styles.kpiValue}>{unreadMessagesCount}</Text>
          <View style={styles.kpiLabelRow}>
            <Text style={styles.kpiIcon}>💬</Text>
            <Text style={styles.kpiLabelText}>Съобщения</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.navigationGrid}>
        <Text style={styles.navigationTitle}>Бързи действия</Text>
        
        <View style={styles.navigationRow}>
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('CreateCase')}
          >
            <Text style={styles.navIcon}>➕</Text>
            <Text style={styles.navLabel}>Нова заявка</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('MyCases')}
          >
            <Text style={styles.navIcon}>📋</Text>
            <Text style={styles.navLabel}>Моите заявки</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.navIcon}>🔍</Text>
            <Text style={styles.navLabel}>Търсене</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navigationRow}>
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
            <Text style={styles.navLabel}>Чат</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navCard, styles.navCardMap]} 
            onPress={() => navigation.getParent()?.navigate('MapSearch')}
          >
            <Text style={styles.navIcon}>🗺️</Text>
            <Text style={styles.navLabel}>Карта</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.navIcon}>⚙️</Text>
            <Text style={styles.navLabel}>Настройки</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity / Tips could go here */}
      <View style={styles.promoCard}>
        <Text style={styles.promoTitle}>Намерете майстор</Text>
        <Text style={styles.promoText}>
          Използвайте картата или публикувайте заявка, за да намерите най-добрия професионалист за вашия ремонт.
        </Text>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1e293b', // slate-800
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#6366f1', // indigo-500
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#a5b4fc', // indigo-300
  },
  userInfo: {
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff', // white
  },
  serviceTypesContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981', // emerald-500
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // emerald-500/15
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)', // emerald-500/30
    alignSelf: 'flex-start',
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  
  // KPI Cards
  kpiRowNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  kpiActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6', // blue-500
  },
  kpiMessages: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6', // violet-500
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff', // white
    marginBottom: 4,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#94a3b8', // slate-400
  },
  kpiLabelText: {
    fontSize: 14,
    color: '#94a3b8', // slate-400
    fontWeight: '500',
  },

  // Navigation Grid
  navigationGrid: {
    padding: 16,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#cbd5e1', // slate-300
    marginBottom: 12,
    marginLeft: 4,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1, // Make it square
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  navCardMap: {
    borderColor: '#10b981', // emerald-500
    borderWidth: 2,
  },
  navCardEmpty: {
    flex: 1,
  },
  navIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    textAlign: 'center',
  },

  // Promo Card
  promoCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#4f46e5', // indigo-600
    borderRadius: 16,
    padding: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  promoText: {
    fontSize: 14,
    color: '#e0e7ff', // indigo-100
    lineHeight: 20,
  },
});
