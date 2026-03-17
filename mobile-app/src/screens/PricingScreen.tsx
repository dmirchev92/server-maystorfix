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
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../styles/theme';

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  yearlyPoints: number;
  features: string[];
  maxBudget: number;
}

const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'normal',
    name: 'Normal',
    price: 1400,
    yearlyPoints: 1000,
    maxBudget: 1000,
    features: [
      '50 точки/месец (месечен план)',
      '1,000 точки (годишен план)',
      '🎁 10% отстъпка при първа покупка (спестявате 140 € годишно или 13 € месечно)',
      'Достъп до заявки до 1000 €',
      '2 точки за SMS',
      '0.15 €/точка за допълнителни',
      'Профил в директорията',
      'Чат с клиенти',
    ],
  },
  {
    id: 'pro',
    name: 'PRO',
    price: 1900,
    yearlyPoints: 2000,
    maxBudget: 5000,
    features: [
      '100 точки/месец (месечен план)',
      '2,000 точки (годишен план)',
      '🎁 15% отстъпка при първа покупка (спестявате 285 € годишно или 34.50 € месечно)',
      'Достъп до ВСИЧКИ заявки',
      '1 точка за SMS (50% отстъпка)',
      '0.13 €/точка за допълнителни',
      'VIP видимост',
      'Приоритетна поддръжка',
      'Разширена статистика',
    ],
  },
];

const POINTS_COSTS = {
  normal: [
    { range: '1-125 €', points: 15, price: '2.25 €' },
    { range: '126-250 €', points: 25, price: '3.75 €' },
    { range: '251-400 €', points: 35, price: '5.25 €' },
    { range: '401-500 €', points: 45, price: '6.75 €' },
    { range: '501-1000 €', points: 70, price: '10.50 €' },
  ],
  pro: [
    { range: '1-125 €', points: 12, price: '1.50 €' },
    { range: '126-250 €', points: 20, price: '2.50 €' },
    { range: '251-400 €', points: 28, price: '3.50 €' },
    { range: '401-500 €', points: 36, price: '4.50 €' },
    { range: '501-1000 €', points: 56, price: '7.00 €' },
    { range: '1001-1500 €', points: 100, price: '12.50 €' },
    { range: '1501-2000 €', points: 140, price: '17.50 €' },
    { range: '2001-2500 €', points: 180, price: '22.50 €' },
    { range: '2501-3000 €', points: 220, price: '27.50 €' },
    { range: '3001-3500 €', points: 260, price: '32.50 €' },
    { range: '3501-4000 €', points: 300, price: '37.50 €' },
    { range: '4001-4500 €', points: 340, price: '42.50 €' },
    { range: '4501-5000 €', points: 380, price: '47.50 €' },
  ],
};

export default function PricingScreen() {
  const { t } = useTranslation('common');
  const navigation = useNavigation<any>();
  const [currentTier, setCurrentTier] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'plans' | 'points'>('plans');

  useEffect(() => {
    loadUserTier();
  }, []);

  const loadUserTier = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setCurrentTier(user.subscription_tier_id || 'free');
      }
    } catch (error) {
      Logger.error('Error loading user tier:', error);
    } finally {
      setLoading(false);
    }
  };

  const openWebsite = () => {
    Linking.openURL('https://snapfix.bg/pricing');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💰 Цени и планове</Text>
        <Text style={styles.subtitle}>
          Изберете план, който отговаря на вашите нужди
        </Text>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'plans' && styles.tabActive]}
          onPress={() => setSelectedTab('plans')}
        >
          <Text style={[styles.tabText, selectedTab === 'plans' && styles.tabTextActive]}>
            Планове
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'points' && styles.tabActive]}
          onPress={() => setSelectedTab('points')}
        >
          <Text style={[styles.tabText, selectedTab === 'points' && styles.tabTextActive]}>
            Точки
          </Text>
        </TouchableOpacity>
      </View>

      {selectedTab === 'plans' ? (
        <>
          {/* Subscription Plans */}
          {SUBSCRIPTION_TIERS.map((tier) => (
            <View
              key={tier.id}
              style={[
                styles.planCard,
                tier.id === 'pro' && styles.planCardPro,
                currentTier === tier.id && styles.planCardCurrent,
              ]}
            >
              {tier.id === 'pro' && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>ПРЕПОРЪЧАН</Text>
                </View>
              )}
              
              <Text style={styles.planName}>{tier.name}</Text>
              <View style={styles.priceContainer}>
                <View style={styles.yearlyPriceSection}>
                  <Text style={styles.price}>{tier.price}</Text>
                  <Text style={styles.priceSuffix}>€/година</Text>
                  <Text style={styles.savingsText}>Спестявате {tier.id === 'normal' ? '460' : '860'} € годишно</Text>
                </View>
                <View style={styles.monthlyPriceSection}>
                  <Text style={styles.monthlyPrice}>{tier.id === 'normal' ? '130' : '230'} €</Text>
                  <Text style={styles.monthlyPriceSuffix}>на месец</Text>
                </View>
              </View>
              
              <View style={styles.featuresContainer}>
                {tier.features.map((feature, index) => (
                  <View key={index} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              {currentTier === tier.id ? (
                <View style={styles.currentPlanBadge}>
                  <Text style={styles.currentPlanText}>Текущ план</Text>
                </View>
              ) : (
                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.selectButton, tier.id === 'pro' && styles.selectButtonPro]}
                    onPress={() => navigation.navigate('Subscription', { tier: tier.id, plan: 'yearly' })}
                  >
                    <Text style={styles.selectButtonText}>Годишен - {tier.price} €</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.selectButtonMonthly}
                    onPress={() => navigation.navigate('Subscription', { tier: tier.id, plan: 'monthly' })}
                  >
                    <Text style={styles.selectButtonMonthlyText}>Месечен - {tier.id === 'normal' ? '130' : '230'} €</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}

          {/* Buy Points Button */}
          <TouchableOpacity
            style={styles.buyPointsButton}
            onPress={() => navigation.navigate('BuyPoints')}
          >
            <Text style={styles.buyPointsIcon}>💎</Text>
            <View style={styles.buyPointsTextContainer}>
              <Text style={styles.buyPointsTitle}>Купи допълнителни точки</Text>
              <Text style={styles.buyPointsSubtitle}>До 30% отстъпка за големи пакети</Text>
            </View>
            <Text style={styles.buyPointsArrow}>›</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Points Cost Table */}
          <View style={styles.pointsSection}>
            <Text style={styles.sectionTitle}>📊 Цена на точки по бюджет</Text>
            <Text style={styles.sectionSubtitle}>
              Точките се изразходват само когато приемете заявка
            </Text>

            {/* Normal Tier Table */}
            <View style={styles.tierTable}>
              <Text style={styles.tierTableTitle}>🟢 Normal план</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Бюджет</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Точки</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Цена</Text>
              </View>
              {POINTS_COSTS.normal.map((row, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{row.range}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.points}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.price}</Text>
                </View>
              ))}
            </View>

            {/* PRO Tier Table */}
            <View style={[styles.tierTable, styles.tierTablePro]}>
              <Text style={styles.tierTableTitle}>🟣 PRO план</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderText, { flex: 2 }]}>Бюджет</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Точки</Text>
                <Text style={[styles.tableHeaderText, { flex: 1 }]}>Цена</Text>
              </View>
              {POINTS_COSTS.pro.map((row, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={[styles.tableCell, { flex: 2 }]}>{row.range}</Text>
                  <Text style={[styles.tableCell, { flex: 1, color: '#a855f7' }]}>{row.points}</Text>
                  <Text style={[styles.tableCell, { flex: 1 }]}>{row.price}</Text>
                </View>
              ))}
            </View>

            {/* SMS Costs */}
            <View style={styles.smsSection}>
              <Text style={styles.sectionTitle}>📱 SMS точки</Text>
              <View style={styles.smsRow}>
                <View style={styles.smsCard}>
                  <Text style={styles.smsCardTitle}>Normal</Text>
                  <Text style={styles.smsCardPoints}>2 точки</Text>
                  <Text style={styles.smsCardPrice}>0.30 €/SMS</Text>
                </View>
                <View style={[styles.smsCard, styles.smsCardPro]}>
                  <Text style={styles.smsCardTitle}>PRO</Text>
                  <Text style={[styles.smsCardPoints, { color: '#a855f7' }]}>1 точка</Text>
                  <Text style={styles.smsCardPrice}>0.13 €/SMS</Text>
                </View>
              </View>
            </View>
          </View>
        </>
      )}

      {/* Payment Info Section */}
      {/* <View style={styles.paymentInfoSection}>
        <Text style={styles.paymentInfoTitle}>💳 Информация за плащане</Text>
        <View style={styles.paymentInfoCard}>
          <Text style={styles.paymentInfoText}>
            • Плащанията се обработват сигурно чрез Stripe
          </Text>
          <Text style={styles.paymentInfoText}>
            • Приемаме Visa, Mastercard, Apple Pay, Google Pay
          </Text>
          <Text style={styles.paymentInfoText}>
            • Абонаментът се подновява автоматично всяка година
          </Text>
          <Text style={styles.paymentInfoText}>
            • Можете да откажете по всяко време от настройките
          </Text>
        </View>
        <View style={styles.securityBadge}>
          <Text style={styles.securityIcon}>🔒</Text>
          <Text style={styles.securityText}>Защитено плащане с 256-bit SSL криптиране</Text>
        </View>
      </View> */}

      {/* Website Link */}
      {/* <TouchableOpacity style={styles.websiteLink} onPress={openWebsite}>
        <Text style={styles.websiteLinkText}>🌐 Виж пълна информация на сайта</Text>
      </TouchableOpacity> */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  planCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  planCardPro: {
    borderColor: '#a855f7',
    borderWidth: 2,
  },
  planCardCurrent: {
    borderColor: '#22c55e',
    borderWidth: 2,
  },
  proBadge: {
    position: 'absolute',
    top: -10,
    right: 16,
    backgroundColor: '#a855f7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  proBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  priceContainer: {
    marginBottom: 16,
  },
  yearlyPriceSection: {
    marginBottom: 12,
  },
  price: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  priceSuffix: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
  },
  savingsText: {
    fontSize: 12,
    color: '#22c55e',
    marginTop: 4,
  },
  monthlyPriceSection: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  monthlyPrice: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#94a3b8',
  },
  monthlyPriceSuffix: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  featuresContainer: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  featureCheck: {
    color: '#22c55e',
    fontSize: 16,
    marginRight: 8,
  },
  featureText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  currentPlanBadge: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  currentPlanText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonContainer: {
    gap: 8,
  },
  selectButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonPro: {
    backgroundColor: '#a855f7',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  selectButtonMonthly: {
    backgroundColor: '#475569',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  selectButtonMonthlyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buyPointsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  buyPointsIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  buyPointsTextContainer: {
    flex: 1,
  },
  buyPointsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buyPointsSubtitle: {
    color: '#94a3b8',
    fontSize: 12,
  },
  buyPointsArrow: {
    color: '#94a3b8',
    fontSize: 24,
  },
  pointsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 16,
  },
  tierTable: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  tierTablePro: {
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  tierTableTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
  },
  tableCell: {
    color: '#e2e8f0',
    fontSize: 13,
  },
  smsSection: {
    marginTop: 8,
  },
  smsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  smsCard: {
    flex: 1,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  smsCardPro: {
    borderWidth: 1,
    borderColor: '#a855f7',
  },
  smsCardTitle: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  smsCardPoints: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: 'bold',
  },
  smsCardPrice: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
  },
  websiteLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  websiteLinkText: {
    color: '#3b82f6',
    fontSize: 14,
  },
  paymentInfoSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  paymentInfoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  paymentInfoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  paymentInfoText: {
    color: '#94a3b8',
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

export default PricingScreen;
