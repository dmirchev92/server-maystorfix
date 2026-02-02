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
  Linking,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../styles/theme';

interface ReferredUser {
  referredUser: {
    id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
  };
  totalClicks: number;
  validClicks: number;
  monthlyClicks: number;
  status: string;
  profileUrl: string;
}

interface ReferralReward {
  id: string;
  rewardType: 'signup_bonus' | 'referrer_signup_bonus' | 'clicks_50_bonus' | 'aggregate_5x50_bonus';
  rewardValue: number;
  pointsAwarded: number;
  clicksRequired: number;
  clicksAchieved: number;
  earnedAt: string;
  status: 'earned' | 'applied' | 'expired';
}

interface ReferralDashboard {
  referralCode: string;
  referralLink: string;
  referredUsers: ReferredUser[];
  totalRewards: ReferralReward[];
}

const ReferralDashboardScreen: React.FC = () => {
  const navigation = useNavigation();
  const [dashboard, setDashboard] = useState<ReferralDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setError(null);
      const token = await AsyncStorage.getItem('auth_token');
      
      if (!token) {
        setError('Не сте влезли в профила си');
        return;
      }

      const response = await fetch('https://snapfix.bg/api/v1/referrals/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Неуспешно зареждане на данните');
      }

      const data: any = await response.json();
      setDashboard(data.data);
    } catch (err) {
      Logger.error('Error fetching referral dashboard:', err);
      setError('Грешка при зареждане на данните');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDashboard();
  };

  const copyReferralLink = () => {
    if (!dashboard?.referralLink) return;
    
    Clipboard.setString(dashboard.referralLink);
    Alert.alert('Успех', 'Препоръчителната връзка е копирана!');
  };

  const shareReferralLink = async () => {
    if (!dashboard?.referralLink) return;

    try {
      await Share.share({
        message: `Присъедини се към SnapFix и получи достъп до най-добрите майстори в България! ${dashboard.referralLink}`,
        title: 'SnapFix Покана',
      });
    } catch (error) {
      Logger.error('Error sharing:', error);
    }
  };

  const getRewardTypeText = (type: string, points?: number) => {
    switch (type) {
      case 'signup_bonus':
        return `+${points || 5} точки (регистрация)`;
      case 'referrer_signup_bonus':
        return `+${points || 5} точки (препоръка)`;
      case 'clicks_50_bonus':
        return `+${points || 10} точки (50 клика)`;
      case 'aggregate_5x50_bonus':
        return `+${points || 100} точки (5 препоръки)`;
      default:
        return `+${points || 0} точки`;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'earned':
        return '#10B981';
      case 'applied':
        return '#6B7280';
      case 'expired':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>Опитай отново</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Няма данни за показване</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with Back Button */}
      <View style={styles.backHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('ProviderDashboard' as never)} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>Препоръки</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>🎯 Препоръчай приятел</Text>
        <Text style={styles.subtitle}>
          Споделете вашия код и спечелете награди!
        </Text>
      </View>

      {/* Referral Code & Link Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Вашият препоръчителен код</Text>
        
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>Препоръчителен код:</Text>
          <Text style={styles.code}>{dashboard.referralCode}</Text>
        </View>

        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>Пълна връзка:</Text>
          <Text style={styles.link} numberOfLines={2}>
            {dashboard.referralLink}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.shareButton} onPress={shareReferralLink}>
            <Text style={styles.shareButtonText}>📤 Сподели</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.copyButton} onPress={copyReferralLink}>
            <Text style={styles.copyButtonText}>🔗 Копирай връзка</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Referred Users Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👥 Препоръчани потребители</Text>
        
        {dashboard.referredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤷‍♂️</Text>
            <Text style={styles.emptyText}>
              Все още няма препоръчани потребители
            </Text>
            <Text style={styles.emptySubtext}>
              Споделете вашия код с приятели!
            </Text>
          </View>
        ) : (
          <View style={styles.usersList}>
            {dashboard.referredUsers.map((user, index) => (
              <View key={index} style={styles.userCard}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {user.referredUser.businessName || 
                     `${user.referredUser.firstName} ${user.referredUser.lastName}`}
                  </Text>
                  <Text style={styles.userStatus}>Статус: {user.status}</Text>
                </View>
                
                <View style={styles.userStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.totalClicks}</Text>
                    <Text style={styles.statLabel}>Общо кликове</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.validClicks}</Text>
                    <Text style={styles.statLabel}>Валидни</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.monthlyClicks}</Text>
                    <Text style={styles.statLabel}>Този месец</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Rewards Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎁 Награди</Text>
        
        {dashboard.totalRewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>
              Все още няма спечелени награди
            </Text>
          </View>
        ) : (
          <View style={styles.rewardsList}>
            {dashboard.totalRewards.map((reward) => (
              <View key={reward.id} style={styles.rewardCard}>
                <View style={styles.rewardHeader}>
                  <Text style={styles.rewardType}>
                    {getRewardTypeText(reward.rewardType, reward.pointsAwarded || reward.rewardValue)}
                  </Text>
                  <View 
                    style={[
                      styles.rewardStatus,
                      { backgroundColor: getStatusColor(reward.status) }
                    ]}
                  >
                    <Text style={styles.rewardStatusText}>
                      {reward.status === 'earned' ? 'Спечелена' :
                       reward.status === 'applied' ? 'Приложена' : 'Изтекла'}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.rewardProgress}>
                  Прогрес: {reward.clicksAchieved}/{reward.clicksRequired} кликове
                </Text>
                
                <Text style={styles.rewardDate}>
                  Спечелена на: {new Date(reward.earnedAt).toLocaleDateString('bg-BG')}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Bottom spacing */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  backHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: '#fff',
  },
  backHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a', // slate-900
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: '#cbd5e1', // slate-300
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a', // slate-900
    padding: theme.spacing.lg,
  },
  errorText: {
    fontSize: theme.fontSize.md,
    color: '#ef4444', // red-500
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: '#6366f1', // indigo-500
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: '#1e293b', // slate-800
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
  },
  card: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  cardTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.md,
  },
  codeContainer: {
    marginBottom: theme.spacing.md,
  },
  codeLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.xs,
  },
  code: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: '#a5b4fc', // indigo-300
    fontFamily: 'monospace',
  },
  linkContainer: {
    marginBottom: theme.spacing.lg,
  },
  linkLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.xs,
  },
  link: {
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  copyButtonText: {
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#6366f1', // indigo-500
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: 4,
  },
  shareButtonText: {
    textAlign: 'center',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    color: '#ffffff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: '#64748b', // slate-500
  },
  usersList: {
    gap: theme.spacing.md,
  },
  userCard: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: '#0f172a', // slate-900
  },
  userInfo: {
    marginBottom: theme.spacing.md,
  },
  userName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  userStatus: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
  },
  userStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: '#a5b4fc', // indigo-300
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
    marginTop: 2,
  },
  rewardsList: {
    gap: theme.spacing.md,
  },
  rewardCard: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: '#0f172a', // slate-900
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  rewardType: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
  },
  rewardStatus: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  rewardStatusText: {
    fontSize: theme.fontSize.xs,
    color: '#ffffff',
    fontWeight: theme.fontWeight.semibold,
  },
  rewardProgress: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.xs,
  },
  rewardDate: {
    fontSize: theme.fontSize.xs,
    color: '#64748b', // slate-500
  },
});

export default ReferralDashboardScreen;
