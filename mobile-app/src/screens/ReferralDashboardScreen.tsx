import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
        setError(t('pleaseLoginAgain'));
        return;
      }

      const response = await fetch('https://snapfix.bg/api/v1/referrals/dashboard', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(t('loadError'));
      }

      const data: any = await response.json();
      setDashboard(data.data);
    } catch (err) {
      Logger.error('Error fetching referral dashboard:', err);
      setError(t('loadError'));
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
    Alert.alert(t('common:success'), t('referralLinkCopied'));
  };

  const shareReferralLink = async () => {
    if (!dashboard?.referralLink) return;

    try {
      await Share.share({
        message: `${t('refShareMessage')} ${dashboard.referralLink}`,
        title: t('refShareTitle'),
      });
    } catch (error) {
      Logger.error('Error sharing:', error);
    }
  };


  const getRewardTypeText = (type: string, points?: number) => {
    switch (type) {
      case 'signup_bonus':
        return `+${points || 5} ${t('points').toLowerCase()} (${t('refSignup')})`;
      case 'referrer_signup_bonus':
        return `+${points || 5} ${t('points').toLowerCase()} (${t('refReferral')})`;
      case 'clicks_50_bonus':
        return `+${points || 10} ${t('points').toLowerCase()} (50 ${t('refClicks')})`;
      case 'aggregate_5x50_bonus':
        return `+${points || 100} ${t('points').toLowerCase()} (5 ${t('refReferrals')})`;
      default:
        return `+${points || 0} ${t('points').toLowerCase()}`;
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
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>❌ {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchDashboard}>
          <Text style={styles.retryButtonText}>{t('tryAgain')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('noResults')}</Text>
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.backHeaderTitle}>{t('dashboard:referrals')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.header}>
        <Text style={styles.title}>🎯 {t('refRecommendFriend')}</Text>
        <Text style={styles.subtitle}>
          {t('refShareAndEarn')}
        </Text>
      </View>

      {/* Summary Stats Card */}
      <View style={styles.statsCard}>
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {dashboard.totalRewards.reduce((sum, r) => sum + (r.pointsAwarded || r.rewardValue || 0), 0)}
            </Text>
            <Text style={styles.statBoxLabel}>{t('refTotalPointsEarned')}</Text>
          </View>
          <View style={styles.statBoxDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>{dashboard.referredUsers.length}</Text>
            <Text style={styles.statBoxLabel}>{t('refActiveReferrals')}</Text>
          </View>
          <View style={styles.statBoxDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statBoxValue}>
              {dashboard.referredUsers.reduce((sum, u) => sum + u.totalClicks, 0)}
            </Text>
            <Text style={styles.statBoxLabel}>{t('refTotalClicks')}</Text>
          </View>
        </View>
      </View>

      {/* Progress to Next Reward */}
      {(() => {
        const totalReferrals = dashboard.referredUsers.length;
        const nextMilestone = totalReferrals < 5 ? 5 : Math.ceil((totalReferrals + 1) / 5) * 5;
        const progress = (totalReferrals / nextMilestone) * 100;
        const remaining = nextMilestone - totalReferrals;
        
        return (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressTitle}>🏆 {t('refNextReward')}</Text>
              <Text style={styles.progressMilestone}>{totalReferrals}/{nextMilestone}</Text>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {remaining === 0 
                ? t('refMilestoneReached') 
                : t('refReferralsToGo', { count: remaining })}
            </Text>
          </View>
        );
      })()}

      {/* Referral Code & Link Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 {t('refYourCode')}</Text>
        
        <View style={styles.codeContainer}>
          <Text style={styles.codeLabel}>{t('refReferralCode')}:</Text>
          <Text style={styles.code}>{dashboard.referralCode}</Text>
        </View>

        <View style={styles.linkContainer}>
          <Text style={styles.linkLabel}>{t('refFullLink')}:</Text>
          <Text style={styles.link} numberOfLines={2}>
            {dashboard.referralLink}
          </Text>
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.shareButton} onPress={shareReferralLink}>
            <Text style={styles.shareButtonText}>📤 {t('refShare')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.copyButton} onPress={copyReferralLink}>
            <Text style={styles.copyButtonText}>🔗 {t('refCopyLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>


      {/* Referred Users Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👥 {t('refReferredUsers')}</Text>
        
        {dashboard.referredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🤷‍♂️</Text>
            <Text style={styles.emptyText}>
              {t('refNoReferredUsers')}
            </Text>
            <Text style={styles.emptySubtext}>
              {t('refShareYourCode')}
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
                  <Text style={styles.userStatus}>{t('refStatus')}: {user.status === 'active' ? t('refActive') : user.status === 'pending' ? t('refPending') : user.status}</Text>
                </View>
                
                <View style={styles.userStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.totalClicks}</Text>
                    <Text style={styles.statLabel}>{t('refTotalClicks')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.validClicks}</Text>
                    <Text style={styles.statLabel}>{t('refValid')}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{user.monthlyClicks}</Text>
                    <Text style={styles.statLabel}>{t('refThisMonth')}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Rewards Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎁 {t('refRewards')}</Text>
        
        {dashboard.totalRewards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyText}>
              {t('refNoRewards')}
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
                      {reward.status === 'earned' ? t('refEarned') :
                       reward.status === 'applied' ? t('refApplied') : t('refExpired')}
                    </Text>
                  </View>
                </View>
                
                <Text style={styles.rewardProgress}>
                  {t('refProgress')}: {reward.clicksAchieved}/{reward.clicksRequired} {t('refClicks')}
                </Text>
                
                <Text style={styles.rewardDate}>
                  {t('refEarnedOn')}: {new Date(reward.earnedAt).toLocaleDateString('bg-BG')}
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
  // Summary Stats Card styles
  statsCard: {
    backgroundColor: '#1e293b',
    margin: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statBoxValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#10B981', // emerald-500
    marginBottom: 4,
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  statBoxDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
  },
  // Progress Card styles
  progressCard: {
    backgroundColor: '#1e293b',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderLeftWidth: 3,
    borderLeftColor: '#10B981', // emerald-500
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  progressTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  progressMilestone: {
    fontSize: theme.fontSize.md,
    fontWeight: '700',
    color: '#10B981',
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#0f172a',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 5,
  },
  progressText: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8',
    textAlign: 'center',
  },
});

export default ReferralDashboardScreen;
