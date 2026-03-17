import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

interface SubscriptionTier {
  id: string;
  name: string;
  name_bg: string;
  description: string;
  description_bg: string;
  price_monthly: number;
  currency: string;
  features: any;
  limits: any;
  display_order: number;
}

interface UserSubscription {
  tier_id: string;
  status: string;
  expires_at: string;
}

interface PointsBalance {
  current_balance: number;
  total_earned: number;
  total_spent: number;
  last_reset?: string;
  monthly_allowance: number;
}

export default function SubscriptionScreen() {
  const { t } = useTranslation('subscription');
  const navigation = useNavigation<any>();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [pointsBalance, setPointsBalance] = useState<PointsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadSubscriptionData();
  }, []);

  const loadSubscriptionData = async () => {
    try {
      setLoading(true);
      
      // Load available tiers
      const tiersResponse = await ApiService.getInstance().getSubscriptionTiers();
      if (tiersResponse.success && tiersResponse.data?.tiers) {
        setTiers(tiersResponse.data.tiers);
      }

      // Load current subscription
      const subResponse = await ApiService.getInstance().getMySubscription();
      if (subResponse.success && subResponse.data?.subscription) {
        setCurrentSubscription(subResponse.data.subscription);
      }

      // Load points balance
      const pointsResponse = await ApiService.getInstance().getPointsBalance();
      if (pointsResponse.success && pointsResponse.data) {
        setPointsBalance(pointsResponse.data);
      }
    } catch (error) {
      Logger.error('Error loading subscription data:', error);
      Alert.alert(t('common:error'), t('loadingSubscriptions'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierId: string, tierName: string, price: number) => {
    if (tierId === 'free') {
      Alert.alert(t('common:info'), t('alreadyOnFree'));
      return;
    }

    Alert.alert(
      t('confirmUpgrade'),
      t('upgradeQuestion', { tierName, price }),
      [
        { text: t('common:cancel'), style: 'cancel' },
        {
          text: t('continue'),
          onPress: async () => {
            try {
              setUpgrading(true);
              
              // Call upgrade API
              const response = await ApiService.getInstance().upgradeSubscription(
                tierId,
                'pending', // Payment method - will be handled manually
                false // Auto-renew
              );

              if (response.success) {
                // Emit userUpdated event to refresh user data across the app (badge update)
                AuthBus.emit('userUpdated');
                
                Alert.alert(
                  t('upgradeSuccess'),
                  t('upgradeSuccessMessage'),
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        loadSubscriptionData();
                        navigation.goBack();
                      }
                    }
                  ]
                );
              } else {
                Alert.alert(t('common:error'), response.error?.message || t('upgradeError'));
              }
            } catch (error) {
              Logger.error('Error upgrading subscription:', error);
              Alert.alert(t('common:error'), t('upgradeProcessError'));
            } finally {
              setUpgrading(false);
            }
          }
        }
      ]
    );
  };

  const getTierIcon = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return '🆓';
      case 'normal':
        return '⭐';
      case 'pro':
        return '👑';
      default:
        return '📦';
    }
  };

  const getTierColor = (tierId: string) => {
    switch (tierId) {
      case 'free':
        return theme.colors.gray[500];
      case 'normal':
        return theme.colors.success.solid;
      case 'pro':
        return theme.colors.status.info;
      default:
        return theme.colors.gray[500];
    }
  };

  const renderTierFeatures = (tier: SubscriptionTier) => {
    const features = [];
    const limits = tier.limits;
    
    if (tier.id === 'free') {
      features.push('🆓 Пробен период');
      features.push(`💵 Заявки до ${limits?.max_case_budget || 250} €`);
      features.push('5 заявки или 14 дни');
      features.push('Базова видимост');
      features.push('Чат съобщения');
    } else if (tier.id === 'normal') {
      features.push('💰 50 точки/месец (месечен)');
      features.push(`💰 ${limits?.points_yearly_included || 1000} точки (годишен)`);
      features.push('🎁 10% отстъпка при първа покупка');
      features.push(`💵 Заявки до ${limits?.max_case_budget || 1000} €`);
      features.push('📱 SMS: 2 точки/SMS');
      features.push('💳 Допълнителни точки: 0.15 €/точка');
      features.push('До 5 категории услуги');
      features.push('До 20 снимки в галерията');
      features.push('Подобрена видимост в търсенето');
      features.push('Премиум значка');
    } else if (tier.id === 'pro') {
      features.push('💰 100 точки/месец (месечен)');
      features.push(`💰 ${limits?.points_yearly_included || 2000} точки (годишен)`);
      features.push('🎁 15% отстъпка при първа покупка');
      features.push('💵 Неограничен бюджет на заявки');
      features.push('📱 SMS: 1 точка/SMS (50% отстъпка)');
      features.push('💳 Допълнителни точки: 0.13 €/точка');
      features.push('Неограничени категории');
      features.push('Неограничени снимки');
      features.push('Система за наддаване');
      features.push('Приоритетна поддръжка');
      features.push('PRO значка');
      features.push('Най-висока видимост');
    }

    return features;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.solid} />
        <Text style={styles.loadingText}>{t('common:loading')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('subscriptionPlans')}</Text>
        <Text style={styles.subtitle}>
          {t('choosePlan')}
        </Text>
      </View>

      {currentSubscription && (
        <View style={styles.currentPlanBanner}>
          <Text style={styles.currentPlanText}>
            Текущ план: <Text style={styles.currentPlanTier}>
              {tiers.find(t => t.id === currentSubscription.tier_id)?.name_bg || 'Безплатен'}
            </Text>
          </Text>
          {pointsBalance && (
            <View style={styles.pointsContainer}>
              <Text style={styles.pointsText}>
                💰 Налични точки: <Text style={styles.pointsValue}>{pointsBalance.current_balance}</Text>
              </Text>
              <Text style={styles.pointsSubtext}>
                Годишна квота: {pointsBalance.monthly_allowance} | Използвани: {pointsBalance.total_spent}
              </Text>
            </View>
          )}
        </View>
      )}

      <View style={styles.tiersContainer}>
        {tiers.map((tier) => {
          const isCurrentTier = currentSubscription?.tier_id === tier.id;
          const tierColor = getTierColor(tier.id);
          const features = renderTierFeatures(tier);

          return (
            <View
              key={tier.id}
              style={[
                styles.tierCard,
                isCurrentTier && styles.currentTierCard,
                { borderColor: tierColor }
              ]}
            >
              <View style={styles.tierHeader}>
                <Text style={styles.tierIcon}>{getTierIcon(tier.id)}</Text>
                <View style={styles.tierTitleContainer}>
                  <Text style={styles.tierName}>{tier.name_bg}</Text>
                  {isCurrentTier && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t('current')}</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.tierDescription}>{tier.description_bg}</Text>

              <View style={styles.priceContainer}>
                {tier.id === 'free' ? (
                  <Text style={styles.price}>{t('free')}</Text>
                ) : (
                  <>
                    <Text style={styles.price}>
                      {tier.id === 'normal' ? '1,400 €' : '1,900 €'}
                    </Text>
                    <Text style={styles.priceUnit}>{t('perYear')}</Text>
                    <Text style={styles.priceMonthly}>
                      или {tier.id === 'normal' ? '130 €' : '230 €'}/месец
                    </Text>
                    <Text style={styles.discountBadge}>
                      🎁 {tier.id === 'normal' ? '10%' : '15%'} отстъпка при първа покупка
                    </Text>
                  </>
                )}
              </View>

              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>{t('includes')}</Text>
                {features.map((feature, index) => (
                  <View key={index} style={styles.featureItem}>
                    <Text style={styles.featureIcon}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {!isCurrentTier && tier.id !== 'free' && (
                <TouchableOpacity
                  style={[styles.upgradeButton, { backgroundColor: tierColor }]}
                  onPress={() => handleUpgrade(tier.id, tier.name_bg, tier.id === 'normal' ? 1400 : 1900)}
                  disabled={upgrading}
                >
                  {upgrading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.upgradeButtonText}>
                      Избери {tier.name_bg}
                    </Text>
                  )}
                </TouchableOpacity>
              )}

              {isCurrentTier && (
                <View style={styles.currentPlanButton}>
                  <Text style={styles.currentPlanButtonText}>{t('activePlan')}</Text>
                </View>
              )}
            </View>
          );
        })}
        
        <View style={styles.securityBadge}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>{t('securePayment')}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Имате въпроси относно плановете?
        </Text>
        <Text style={styles.footerContact}>
          Свържете се с нас за повече информация
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.primary.solid,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  currentPlanBanner: {
    backgroundColor: theme.colors.status.info,
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  currentPlanText: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
  },
  currentPlanTier: {
    fontWeight: 'bold',
  },
  pointsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.3)',
  },
  pointsText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  pointsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  pointsSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tiersContainer: {
    padding: 16,
  },
  tierCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentTierCard: {
    borderWidth: 3,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierIcon: {
    fontSize: 40,
    marginRight: 12,
  },
  tierTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  currentBadge: {
    backgroundColor: theme.colors.success.solid,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tierDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  priceContainer: {
    marginBottom: 20,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.primary.solid,
  },
  priceUnit: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  priceMonthly: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  discountBadge: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
    marginTop: 8,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  featureIcon: {
    fontSize: 16,
    color: theme.colors.success.solid,
    marginRight: 8,
    marginTop: 2,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  upgradeButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  currentPlanButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: theme.colors.gray[200],
  },
  currentPlanButtonText: {
    color: theme.colors.text.secondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  footerContact: {
    fontSize: 14,
    color: theme.colors.primary.solid,
    fontWeight: '600',
  },
  paymentInfoSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  paymentInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  paymentInfoCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentInfoText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#166534',
    borderRadius: 8,
    padding: 12,
  },
  securityIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  securityText: {
    color: '#bbf7d0',
    fontSize: 13,
    flex: 1,
  },
});
