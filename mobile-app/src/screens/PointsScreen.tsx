import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  BackHandler,
  ScrollView,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface Transaction {
  id: string;
  transaction_type: 'earned' | 'spent' | 'refund';
  points_amount: number;
  balance_after: number;
  reason: string;
  case_id?: string;
  case_number?: number;
  created_at: string;
}

interface PointsBalance {
  current_balance: number;
  total_earned: number;
  total_spent: number;
  last_reset?: string;
  monthly_allowance: number;
  subscription_tier?: string;
}

interface PointsPackage {
  points: number;
  basePrice: number;
  discount: number;
  discountPercent: number;
  finalPrice: number;
  savings: number;
  label: string;
  pricePerPoint: number;
}

interface PackagesResponse {
  canPurchase: boolean;
  pricePerPoint: number | null;
  currency: string;
  tier: string;
  packages: PointsPackage[];
  message?: string;
}

type TabType = 'balance' | 'buy';

const PointsScreen: React.FC = () => {
  const { t } = useTranslation('common');
  const navigation = useNavigation();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  
  // Tab and purchase state
  const [activeTab, setActiveTab] = useState<TabType>('balance');
  const [packages, setPackages] = useState<PackagesResponse | null>(null);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  // Helper function to get tier display name
  const getTierDisplayName = (tier: string) => {
    switch (tier?.toLowerCase()) {
      case 'pro': return t('tierPro');
      case 'normal': return t('tierNormal');
      default: return t('tierFree');
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      loadUserTier();

      // Handle hardware back button
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return true; // Prevent default behavior (app exit)
        }
        return false; // Let default behavior happen
      });

      return () => backHandler.remove();
    }, [navigation])
  );

  const loadUserTier = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        setSubscriptionTier(user.subscription_tier_id || 'free');
      }
    } catch (error) {
      Logger.error('Error loading user tier:', error);
    }
  };

  const fetchData = async () => {
    try {
      const apiService = ApiService.getInstance();
      
      // Fetch balance, transactions, and packages in parallel
      const [balanceResponse, transactionsResponse, packagesResponse] = await Promise.all([
        apiService.getPointsBalance(),
        apiService.getPointsTransactions(20, 0),
        apiService.getPointsPackages(),
      ]);
      
      if (balanceResponse.success && balanceResponse.data) {
        setBalance(balanceResponse.data);
      }
      
      if (transactionsResponse.success && transactionsResponse.data) {
        setTransactions(transactionsResponse.data.transactions || transactionsResponse.data || []);
      }
      
      if (packagesResponse.success && packagesResponse.data) {
        setPackages(packagesResponse.data);
      }
    } catch (error) {
      Logger.error('Error fetching points data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePurchase = async (pkg: PointsPackage) => {
    Alert.alert(
      t('confirmPurchase'),
      `${t('purchaseConfirmMessage', { points: pkg.points, price: pkg.finalPrice.toFixed(2) })}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('purchaseBtn'),
          onPress: async () => {
            try {
              setPurchasing(pkg.points);
              
              const response = await ApiService.getInstance().purchasePoints(pkg.points);
              
              if (response.success && response.data) {
                Alert.alert(
                  t('success') + ' 🎉',
                  t('purchaseSuccess', { points: response.data.pointsAdded, balance: response.data.newBalance })
                );
                // Reload data
                fetchData();
              } else {
                Alert.alert(t('error'), response.error?.message || t('purchaseError'));
              }
            } catch (error: any) {
              Logger.error('Failed to purchase:', error);
              Alert.alert(t('error'), error.message || t('purchaseError'));
            } finally {
              setPurchasing(null);
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned':
        return '📈';
      case 'spent':
        return '💸';
      case 'refund':
        return '↩️';
      default:
        return '•';
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case 'earned':
        return '#10b981';
      case 'spent':
        return '#ef4444';
      case 'refund':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  // Category translations for VIP purchases
  const categoryTranslations: { [key: string]: string } = {
    'cat_electrician': 'Електротехник',
    'cat_plumber': 'Водопроводчик',
    'cat_hvac': 'Отопление и климатизация',
    'cat_carpenter': 'Дърводелец',
    'cat_painter': 'Бояджия',
    'cat_locksmith': 'Ключар',
    'cat_cleaner': 'Почистване',
    'cat_gardener': 'Градинар',
    'cat_handyman': 'Дребни ремонти',
    'cat_renovation': 'Цялостни ремонти',
    'cat_roofer': 'Ремонт на покриви',
    'cat_mover': 'Хамалски услуги',
    'cat_moving': 'Хамалски услуги',
    'cat_tiler': 'Майстор Фаянс',
    'cat_welder': 'Заварчик',
    'cat_appliance': 'Ремонт на уреди',
    'cat_appliance_repair': 'Ремонт на уреди',
    'cat_flooring': 'Подови настилки',
    'cat_plasterer': 'Шпакловане',
    'cat_glasswork': 'Стъкларски услуги',
    'cat_design': 'Дизайн',
  };

  // Translate transaction reasons from English to Bulgarian
  const translateReason = (reason: string, caseId?: string): string => {
    if (!reason) return 'Транзакция';
    
    const lowerReason = reason.toLowerCase();
    
    // Handle VIP Buyout patterns: "VIP Buyout - Начална страница - cat_locksmith"
    if (lowerReason.includes('vip buyout')) {
      const catMatch = reason.match(/cat_([a-z_]+)/i);
      if (catMatch) {
        const catKey = `cat_${catMatch[1]}`;
        const categoryName = categoryTranslations[catKey] || catMatch[1];
        return `VIP място - ${categoryName}`;
      }
      return 'VIP място';
    }
    
    // Handle SMS sent
    if (lowerReason === 'sms sent') {
      return 'Изпратен SMS';
    }
    
    // Handle Winning bid patterns: "Winning bid - full tier-based cost (14 points)"
    if (lowerReason.includes('winning bid')) {
      return 'Оферта';
    }
    
    // Common transaction reason translations
    const translations: { [key: string]: string } = {
      // Monthly/Initial allocation
      'Monthly points allowance': 'Месечен лимит точки',
      'Monthly allowance': 'Месечен лимит',
      'Monthly points reset': 'Месечно нулиране на точки',
      'Initial monthly points allocation': 'Начално разпределение на месечни точки',
      'Initial points allocation': 'Начално разпределение на точки',
      'Points allocation': 'Разпределение на точки',
      
      // Direct assignment
      'Direct assignment accepted': 'Приета директна заявка',
      'direct assignment accepted': 'Приета директна заявка',
      
      // Case related
      'Case accepted': 'Приета заявка',
      'Accepted case': 'Приета заявка',
      'Case completed': 'Завършена заявка',
      'Case cancelled': 'Отменена заявка',
      'Case declined': 'Отказана заявка',
      'Bid placed': 'Направена оферта',
      'Bid won': 'Спечелена оферта',
      'Bid lost': 'Загубена оферта',
      'Points spent on case': 'Точки изразходвани за заявка',
      'Points refunded': 'Възстановени точки',
      'Refund for cancelled case': 'Възстановяване за отменена заявка',
      'Refund for declined case': 'Възстановяване за отказана заявка',
      
      // Subscription related
      'Subscription upgrade': 'Надграждане на абонамент',
      'Subscription renewal': 'Подновяване на абонамент',
      'Subscription bonus': 'Бонус от абонамент',
      
      // Referral related
      'Referral bonus': 'Бонус от препоръка',
      'Referral signup bonus': 'Бонус за регистрация от препоръка',
      'Referral bonus: signed up via referral': 'Бонус за регистрация с препоръка',
      'Referral bonus: referred user': 'Бонус за препоръчан потребител',
      
      // Admin actions
      'Admin adjustment': 'Корекция от администратор',
      'Manual adjustment': 'Ръчна корекция',
      'Bonus points': 'Бонус точки',
      'Welcome bonus': 'Бонус добре дошли',
      
      // Trial
      'Trial period bonus': 'Бонус за пробен период',
      'Free trial': 'Безплатен пробен период',
      
      // Service categories (English to Bulgarian)
      'electrician': 'Електротехник',
      'Electrician': 'Електротехник',
      'plumber': 'Водопроводчик',
      'Plumber': 'Водопроводчик',
      'hvac': 'Отопление и климатизация',
      'HVAC': 'Отопление и климатизация',
      'carpenter': 'Дърводелец',
      'Carpenter': 'Дърводелец',
      'painter': 'Бояджия',
      'Painter': 'Бояджия',
      'locksmith': 'Ключар',
      'Locksmith': 'Ключар',
      'cleaner': 'Почистване',
      'Cleaner': 'Почистване',
      'gardener': 'Градинар',
      'Gardener': 'Градинар',
      'handyman': 'Дребни ремонти',
      'Handyman': 'Дребни ремонти',
      'renovation': 'Цялостни ремонти',
      'Renovation': 'Цялостни ремонти',
      'roofer': 'Ремонт на покриви',
      'Roofer': 'Ремонт на покриви',
      'mover': 'Хамалски услуги',
      'Mover': 'Хамалски услуги',
      'moving': 'Хамалски услуги',
      'Moving': 'Хамалски услуги',
      'tiler': 'Майстор Фаянс',
      'Tiler': 'Майстор Фаянс',
      'welder': 'Заварчик',
      'Welder': 'Заварчик',
      'appliance': 'Ремонт на уреди',
      'Appliance': 'Ремонт на уреди',
      'appliance_repair': 'Ремонт на уреди',
      'flooring': 'Подови настилки',
      'Flooring': 'Подови настилки',
      'plasterer': 'Шпакловане',
      'Plasterer': 'Шпакловане',
      'glasswork': 'Стъкларски услуги',
      'Glasswork': 'Стъкларски услуги',
      'design': 'Дизайн',
      'Design': 'Дизайн',
    };
    
    // Handle "direct assignment accepted-budget X-Y" pattern
    if (lowerReason.includes('direct assignment accepted')) {
      // Extract budget if present
      const budgetMatch = reason.match(/budget\s*(\d+[-–]\d+|\d+\+?)/i);
      if (budgetMatch) {
        return `Приета директна заявка - бюджет ${budgetMatch[1]} €`;
      }
      return 'Приета директна заявка';
    }
    
    // Handle initial allocation patterns
    if (lowerReason.includes('initial') && lowerReason.includes('allocation')) {
      return 'Начално разпределение на точки';
    }
    if (lowerReason.includes('initial') && lowerReason.includes('monthly')) {
      return 'Начално разпределение на месечни точки';
    }
    
    // Check for exact match first
    if (translations[reason]) {
      return translations[reason];
    }
    
    // Check for partial matches (case insensitive)
    for (const [key, value] of Object.entries(translations)) {
      if (lowerReason.includes(key.toLowerCase())) {
        return value;
      }
    }
    
    // Pattern-based translations
    if (lowerReason.includes('case') && lowerReason.includes('accept')) {
      return 'Приета заявка';
    }
    if (lowerReason.includes('case') && lowerReason.includes('complet')) {
      return 'Завършена заявка';
    }
    if (lowerReason.includes('case') && lowerReason.includes('cancel')) {
      return 'Отменена заявка';
    }
    if (lowerReason.includes('refund')) {
      return 'Възстановени точки';
    }
    if (lowerReason.includes('monthly') && lowerReason.includes('allowance')) {
      return 'Месечен лимит точки';
    }
    if (lowerReason.includes('allocation')) {
      return 'Разпределение на точки';
    }
    if (lowerReason.includes('bid')) {
      return 'Оферта';
    }
    if (lowerReason.includes('bonus')) {
      // Check for referral-specific bonuses
      if (lowerReason.includes('referral') && lowerReason.includes('signed up')) {
        return 'Бонус за регистрация с препоръка';
      }
      if (lowerReason.includes('referral') && lowerReason.includes('referred user')) {
        return 'Бонус за препоръчан потребител';
      }
      return 'Бонус точки';
    }
    
    // Return original if no translation found
    return reason;
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const translatedReason = translateReason(item.reason, item.case_id);
    const caseDisplay = item.case_number ? `#${item.case_number}` : '';
    const displayReason = item.case_number && !translatedReason.includes('#') 
      ? `${translatedReason} ${caseDisplay}` 
      : translatedReason;
    
    return (
    <View style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{getTransactionIcon(item.transaction_type)}</Text>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionReason} numberOfLines={2}>
            {displayReason}
          </Text>
          <Text style={styles.transactionDate}>
            {new Date(item.created_at).toLocaleString('bg-BG')}
          </Text>
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[
          styles.transactionAmount,
          { color: getTransactionColor(item.transaction_type) }
        ]}>
          {item.transaction_type === 'earned' || item.transaction_type === 'refund' ? '+' : '-'}
          {Math.abs(item.points_amount)}
        </Text>
        <Text style={styles.transactionBalance}>
          {t('balance')}: {item.balance_after}
        </Text>
      </View>
    </View>
  );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  const renderPackageCard = (pkg: PointsPackage) => (
    <TouchableOpacity
      key={pkg.points}
      style={[
        styles.packageCard,
        pkg.discountPercent >= 20 && styles.packageCardBest,
        pkg.discountPercent >= 10 && pkg.discountPercent < 20 && styles.packageCardGood,
      ]}
      onPress={() => handlePurchase(pkg)}
      disabled={purchasing !== null}
      activeOpacity={0.8}
    >
      {pkg.discountPercent > 0 && (
        <View style={[
          styles.discountBadge,
          pkg.discountPercent >= 20 ? styles.discountBadgeBest : styles.discountBadgeGood
        ]}>
          <Text style={styles.discountBadgeText}>-{pkg.discountPercent}%</Text>
        </View>
      )}
      <Text style={styles.packagePoints}>{pkg.points}</Text>
      <Text style={styles.packagePointsLabel}>{t('points')}</Text>
      {pkg.discountPercent > 0 && (
        <Text style={styles.packageOldPrice}>{pkg.basePrice.toFixed(2)} €</Text>
      )}
      <Text style={styles.packagePrice}>{pkg.finalPrice.toFixed(2)} €</Text>
      <Text style={styles.packagePricePerPoint}>{pkg.pricePerPoint.toFixed(3)} €/{t('point')}</Text>
      <View style={[styles.packageBuyButton, purchasing === pkg.points && styles.packageBuyButtonDisabled]}>
        {purchasing === pkg.points ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.packageBuyButtonText}>{t('purchaseBtn')}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>💰 {t('points')}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'balance' && styles.tabActive]}
          onPress={() => setActiveTab('balance')}
        >
          <Text style={[styles.tabText, activeTab === 'balance' && styles.tabTextActive]}>
            📊 {t('balanceTab')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'buy' && styles.tabActive]}
          onPress={() => setActiveTab('buy')}
        >
          <Text style={[styles.tabText, activeTab === 'buy' && styles.tabTextActive]}>
            🛒 {t('buyPointsTab')}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'balance' ? (
        <>
          {/* Balance Card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>{t('availablePoints')}</Text>
            <Text style={styles.balanceAmount}>{balance?.current_balance || 0}</Text>
            
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('earned')}</Text>
                <Text style={[styles.statValue, { color: '#10b981' }]}>
                  +{balance?.total_earned || 0}
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>{t('spent')}</Text>
                <Text style={[styles.statValue, { color: '#ef4444' }]}>
                  -{balance?.total_spent || 0}
                </Text>
              </View>
            </View>

            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionText} numberOfLines={1}>
                {getTierDisplayName(subscriptionTier)} {t('plan')}
              </Text>
              <Text style={styles.subscriptionText} numberOfLines={1}>
                {balance?.monthly_allowance || 50} {t('pointsPerYear')}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => navigation.navigate('Subscription' as never)}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                {t('upgradePlan') || 'Надградете плана'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Transactions List */}
          <View style={styles.transactionsHeader}>
            <Text style={styles.transactionsTitle}>{t('transactionHistory')}</Text>
            <Text style={styles.transactionsCount}>
              {transactions.length} {transactions.length === 1 ? t('transaction') : t('transactions')}
            </Text>
          </View>

          <FlatList
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>{t('noTransactionsYet')}</Text>
              </View>
            }
          />
        </>
      ) : (
        <ScrollView
          style={styles.buyScrollView}
          contentContainerStyle={styles.buyContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Current Balance Mini */}
          <View style={styles.balanceMini}>
            <Text style={styles.balanceMiniLabel}>{t('currentBalance')}:</Text>
            <Text style={styles.balanceMiniValue}>{balance?.current_balance || 0} {t('points')}</Text>
          </View>

          {packages?.canPurchase ? (
            <>
              <Text style={styles.tierInfo}>
                {t('basePricePerPoint', { price: packages.pricePerPoint, tier: packages.tier.toUpperCase() })}
              </Text>

              <View style={styles.packagesGrid}>
                {packages.packages.map(renderPackageCard)}
              </View>

              <View style={styles.infoCard}>
                <Text style={styles.infoTitle}>{t('howPointsWork')}</Text>
                <Text style={styles.infoText}>• {t('pointsInfo1')}</Text>
                <Text style={styles.infoText}>• {t('pointsInfo2')}</Text>
                <Text style={styles.infoText}>• {t('pointsInfo3')}</Text>
              </View>
            </>
          ) : (
            <View style={styles.cannotPurchase}>
              <Text style={styles.cannotPurchaseIcon}>🔒</Text>
              <Text style={styles.cannotPurchaseText}>
                {packages?.message || t('purchaseNotAvailableDesc')}
              </Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => navigation.navigate('Subscription' as never)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>
                  {t('upgradePlan') || 'Надградете плана'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  centerContainer: {
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
  balanceCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    padding: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  balanceLabel: {
    color: '#94a3b8', // slate-400
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    marginBottom: theme.spacing.sm,
  },
  balanceAmount: {
    color: '#cbd5e1', // slate-300
    fontSize: 48,
    fontWeight: theme.fontWeight.bold,
    marginBottom: theme.spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    marginHorizontal: theme.spacing.md,
  },
  statLabel: {
    color: '#94a3b8', // slate-400
    fontSize: theme.fontSize.xs,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
  },
  subscriptionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  subscriptionText: {
    color: '#94a3b8', // slate-400
    fontSize: theme.fontSize.sm,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  buyPointsButton: {
    flex: 1,
    backgroundColor: '#22c55e', // green-500
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  buyPointsButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  upgradeButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  transactionsHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    backgroundColor: '#1e293b', // slate-800
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  transactionsTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  transactionsCount: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 80,
  },
  transactionCard: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.md,
  },
  transactionIcon: {
    fontSize: 24,
    marginRight: theme.spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionReason: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  transactionDate: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    marginBottom: 2,
  },
  transactionBalance: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabTextActive: {
    color: '#fff',
  },
  // Buy tab styles
  buyScrollView: {
    flex: 1,
  },
  buyContent: {
    padding: 16,
    paddingBottom: 32,
  },
  balanceMini: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  balanceMiniLabel: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  balanceMiniValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  tierInfo: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 13,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  packageCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  packageCardGood: {
    borderColor: 'rgba(34, 197, 94, 0.4)',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  packageCardBest: {
    borderColor: 'rgba(234, 179, 8, 0.5)',
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  discountBadgeGood: {
    backgroundColor: '#22c55e',
  },
  discountBadgeBest: {
    backgroundColor: '#eab308',
  },
  discountBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  packagePoints: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  packagePointsLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  packageOldPrice: {
    fontSize: 12,
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  packagePrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  packagePricePerPoint: {
    fontSize: 10,
    color: '#64748b',
    marginBottom: 10,
  },
  packageBuyButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  packageBuyButtonDisabled: {
    opacity: 0.6,
  },
  packageBuyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 6,
    lineHeight: 20,
  },
  cannotPurchase: {
    alignItems: 'center',
    padding: 24,
  },
  cannotPurchaseIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  cannotPurchaseText: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
  },
});

export default PointsScreen;
