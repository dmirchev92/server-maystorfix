import React, { useState, useEffect } from 'react';
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

export default function SubscriptionScreen() {
  const navigation = useNavigation<any>();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
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
    } catch (error) {
      console.error('Error loading subscription data:', error);
      Alert.alert('Грешка', 'Не успяхме да заредим информацията за абонаментите');
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (tierId: string, tierName: string, price: number) => {
    if (tierId === 'free') {
      Alert.alert('Информация', 'Вече сте на безплатния план');
      return;
    }

    Alert.alert(
      'Потвърдете надстройването',
      `Искате ли да надстроите до ${tierName} за ${price} лв/месец?\n\nЗа да завършите процеса, моля свържете се с нас за плащане.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Продължи',
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
                Alert.alert(
                  'Успех!',
                  'Вашата заявка за надстройване е приета. Нашият екип ще се свърже с вас за финализиране на плащането.',
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
                Alert.alert('Грешка', response.error?.message || 'Възникна грешка при надстройването');
              }
            } catch (error) {
              console.error('Error upgrading subscription:', error);
              Alert.alert('Грешка', 'Не успяхме да обработим заявката за надстройване');
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
    
    if (tier.id === 'free') {
      features.push('5 заявки или 14 дни пробен период');
      features.push('Базова видимост');
      features.push('Чат съобщения');
    } else if (tier.id === 'normal') {
      features.push('До 5 категории услуги');
      features.push('До 20 снимки в галерията');
      features.push('50 приемания на заявки месечно');
      features.push('Подобрена видимост в търсенето');
      features.push('Приоритетни известия');
    } else if (tier.id === 'pro') {
      features.push('Неограничени категории');
      features.push('Неограничени снимки');
      features.push('Неограничени заявки');
      features.push('Система за наддаване');
      features.push('Приоритетна поддръжка');
      features.push('Премиум значка');
      features.push('Най-висока видимост');
    }

    return features;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.solid} />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Абонаментни Планове</Text>
        <Text style={styles.subtitle}>
          Изберете плана, който отговаря на вашите нужди
        </Text>
      </View>

      {currentSubscription && (
        <View style={styles.currentPlanBanner}>
          <Text style={styles.currentPlanText}>
            Текущ план: <Text style={styles.currentPlanTier}>
              {tiers.find(t => t.id === currentSubscription.tier_id)?.name_bg || 'Безплатен'}
            </Text>
          </Text>
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
                      <Text style={styles.currentBadgeText}>Текущ</Text>
                    </View>
                  )}
                </View>
              </View>

              <Text style={styles.tierDescription}>{tier.description_bg}</Text>

              <View style={styles.priceContainer}>
                <Text style={styles.price}>
                  {tier.price_monthly > 0 ? `${tier.price_monthly} лв` : 'Безплатно'}
                </Text>
                {tier.price_monthly > 0 && (
                  <Text style={styles.priceUnit}>на месец</Text>
                )}
              </View>

              <View style={styles.featuresContainer}>
                <Text style={styles.featuresTitle}>Включва:</Text>
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
                  onPress={() => handleUpgrade(tier.id, tier.name_bg, tier.price_monthly)}
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
                  <Text style={styles.currentPlanButtonText}>Активен план</Text>
                </View>
              )}
            </View>
          );
        })}
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
});
