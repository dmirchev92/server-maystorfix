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
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  rewardType: 'discount_10' | 'discount_50' | 'free_month';
  rewardValue: number;
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

      const response = await fetch('https://maystorfix.com/api/v1/referrals/dashboard', {
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
      console.error('Error fetching referral dashboard:', err);
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

  const copyReferralCode = () => {
    if (!dashboard?.referralCode) return;
    
    Clipboard.setString(dashboard.referralCode);
    Alert.alert('Успех', 'Препоръчителният код е копиран!');
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
        message: `Присъедини се към ServiceText Pro и получи достъп до най-добрите майстори в България! ${dashboard.referralLink}`,
        title: 'ServiceText Pro Покана',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const openWhatsApp = () => {
    if (!dashboard?.referralLink) return;

    const message = encodeURIComponent(
      `Присъедини се към ServiceText Pro и получи достъп до най-добрите майстори в България! ${dashboard.referralLink}`
    );
    const url = `whatsapp://send?text=${message}`;
    
    Linking.canOpenURL(url)
      .then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          Alert.alert('Грешка', 'WhatsApp не е инсталиран на устройството');
        }
      })
      .catch((err) => console.error('Error opening WhatsApp:', err));
  };

  const getRewardTypeText = (type: string) => {
    switch (type) {
      case 'discount_10':
        return '10% отстъпка';
      case 'discount_50':
        return '50% отстъпка';
      case 'free_month':
        return 'Безплатен месец';
      default:
        return type;
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
      <View style={styles.header}>
        <Text style={styles.title}>🎯 Препоръчителна система</Text>
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
          <TouchableOpacity style={styles.copyButton} onPress={copyReferralCode}>
            <Text style={styles.copyButtonText}>📋 Копирай код</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.copyButton} onPress={copyReferralLink}>
            <Text style={styles.copyButtonText}>🔗 Копирай връзка</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.shareButton} onPress={shareReferralLink}>
            <Text style={styles.shareButtonText}>📤 Сподели</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.whatsappButton} onPress={openWhatsApp}>
            <Text style={styles.whatsappButtonText}>💬 WhatsApp</Text>
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
                    {getRewardTypeText(reward.rewardType)}
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

      {/* Reward Tiers Info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Нива на награди</Text>
        <View style={styles.tiersList}>
          <View style={styles.tierItem}>
            <Text style={styles.tierClicks}>50 кликове</Text>
            <Text style={styles.tierReward}>→ 10% отстъпка</Text>
          </View>
          <View style={styles.tierItem}>
            <Text style={styles.tierClicks}>100 кликове</Text>
            <Text style={styles.tierReward}>→ 50% отстъпка</Text>
          </View>
          <View style={styles.tierItem}>
            <Text style={styles.tierClicks}>500 кликове</Text>
            <Text style={styles.tierReward}>→ Безплатен месец</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  card: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  codeContainer: {
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  code: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3B82F6',
    fontFamily: 'monospace',
  },
  linkContainer: {
    marginBottom: 20,
  },
  linkLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  link: {
    fontSize: 14,
    color: '#111827',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  copyButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  copyButtonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  shareButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  shareButtonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  whatsappButtonText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  usersList: {
    gap: 12,
  },
  userCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
  },
  userInfo: {
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userStatus: {
    fontSize: 14,
    color: '#6B7280',
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
    fontWeight: 'bold',
    color: '#3B82F6',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  rewardsList: {
    gap: 12,
  },
  rewardCard: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 16,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rewardType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  rewardStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardStatusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  rewardProgress: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  rewardDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tiersList: {
    gap: 12,
  },
  tierItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
  },
  tierClicks: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  tierReward: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});

export default ReferralDashboardScreen;
