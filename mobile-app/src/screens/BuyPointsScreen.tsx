import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

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

interface PointsBalance {
  current_balance: number;
  monthly_allowance: number;
  total_earned: number;
  total_spent: number;
  tier: string;
}

const BuyPointsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [packages, setPackages] = useState<PackagesResponse | null>(null);
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [purchasing, setPurchasing] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [packagesRes, balanceRes] = await Promise.all([
        ApiService.getInstance().getPointsPackages(),
        ApiService.getInstance().getPointsBalance(),
      ]);
      
      if (packagesRes.success && packagesRes.data) {
        setPackages(packagesRes.data);
      }
      
      if (balanceRes.success && balanceRes.data) {
        setBalance(balanceRes.data);
      }
    } catch (error) {
      Logger.error('Failed to load data:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на данните');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handlePurchase = async (pkg: PointsPackage) => {
    Alert.alert(
      'Потвърдете покупката',
      `Искате ли да закупите ${pkg.points} точки за ${pkg.finalPrice.toFixed(2)} €?${pkg.discountPercent > 0 ? `\n\nСпестявате ${pkg.savings.toFixed(2)} € (${pkg.discountPercent}% отстъпка)` : ''}`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Купи',
          onPress: async () => {
            try {
              setPurchasing(pkg.points);
              
              const response = await ApiService.getInstance().purchasePoints(pkg.points);
              
              if (response.success && response.data) {
                Alert.alert(
                  'Успех! 🎉',
                  `Добавени ${response.data.pointsAdded} точки!\n\nНов баланс: ${response.data.newBalance} точки`,
                  [{ text: 'OK' }]
                );
                // Reload balance
                const balanceRes = await ApiService.getInstance().getPointsBalance();
                if (balanceRes.success && balanceRes.data) {
                  setBalance(balanceRes.data);
                }
              } else {
                Alert.alert('Грешка', response.error?.message || 'Неуспешна покупка');
              }
            } catch (error: any) {
              Logger.error('Failed to purchase:', error);
              Alert.alert('Грешка', error.message || 'Неуспешна покупка');
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
    loadData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>💰 Закупуване на точки</Text>
        <Text style={styles.subtitle}>
          Изберете пакет. По-големите пакети имат по-голяма отстъпка!
        </Text>
      </View>

      {/* Current Balance */}
      {balance && (
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Текущ баланс</Text>
          <Text style={styles.balanceValue}>{balance.current_balance}</Text>
          <Text style={styles.balanceUnit}>точки</Text>
          <View style={styles.balanceStats}>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Годишна квота</Text>
              <Text style={styles.balanceStatValue}>{balance.monthly_allowance}</Text>
            </View>
            <View style={styles.balanceStat}>
              <Text style={styles.balanceStatLabel}>Изхарчени</Text>
              <Text style={styles.balanceStatValue}>{balance.total_spent}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Packages */}
      {packages?.canPurchase ? (
        <>
          <Text style={styles.tierInfo}>
            Базова цена ({packages.tier.toUpperCase()}): {packages.pricePerPoint} €/точка
          </Text>

          <View style={styles.packagesGrid}>
            {packages.packages.map((pkg) => (
              <TouchableOpacity
                key={pkg.points}
                style={[
                  styles.packageCard,
                  pkg.discountPercent >= 20 && styles.packageCardBest,
                  pkg.discountPercent >= 10 && pkg.discountPercent < 20 && styles.packageCardGood,
                ]}
                onPress={() => handlePurchase(pkg)}
                disabled={purchasing !== null}
              >
                {/* Discount Badge */}
                {pkg.discountPercent > 0 && (
                  <View style={[
                    styles.discountBadge,
                    pkg.discountPercent >= 20 ? styles.discountBadgeBest : styles.discountBadgeGood
                  ]}>
                    <Text style={styles.discountBadgeText}>-{pkg.discountPercent}%</Text>
                  </View>
                )}

                {/* Points */}
                <Text style={styles.packagePoints}>{pkg.points}</Text>
                <Text style={styles.packagePointsLabel}>точки</Text>

                {/* Pricing */}
                {pkg.discountPercent > 0 ? (
                  <>
                    <Text style={styles.packageOldPrice}>{pkg.basePrice.toFixed(2)} €</Text>
                    <Text style={styles.packagePrice}>{pkg.finalPrice.toFixed(2)} €</Text>
                    <Text style={styles.packageSavings}>Спестявате {pkg.savings.toFixed(2)} €</Text>
                  </>
                ) : (
                  <Text style={styles.packagePrice}>{pkg.finalPrice.toFixed(2)} €</Text>
                )}

                {/* Price per point */}
                <Text style={styles.packagePricePerPoint}>
                  {pkg.pricePerPoint.toFixed(2)} €/точка
                </Text>

                {/* Buy Button */}
                {purchasing === pkg.points ? (
                  <View style={styles.buyButton}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <View style={[
                    styles.buyButton,
                    pkg.discountPercent >= 20 && styles.buyButtonBest
                  ]}>
                    <Text style={styles.buyButtonText}>Купи</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>ℹ️ Информация</Text>
            <Text style={styles.infoText}>• Точките се добавят веднага</Text>
            <Text style={styles.infoText}>• По-големите пакети = по-голяма отстъпка</Text>
            <Text style={styles.infoText}>• Точките нямат срок на валидност</Text>
            
            <View style={styles.testModeWarning}>
              <Text style={styles.testModeText}>
                ⚠️ Тестов режим: Плащанията са деактивирани. Бутонът "Купи" ще добави точките директно.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.cannotPurchase}>
          <Text style={styles.cannotPurchaseText}>
            {packages?.message || 'Не можете да закупувате точки с текущия план.'}
          </Text>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Text style={styles.upgradeButtonText}>Виж плановете</Text>
          </TouchableOpacity>
        </View>
      )}
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
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
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
  balanceCard: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceLabel: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
  },
  balanceUnit: {
    color: '#bfdbfe',
    fontSize: 16,
  },
  balanceStats: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 32,
  },
  balanceStat: {
    alignItems: 'center',
  },
  balanceStatLabel: {
    color: '#bfdbfe',
    fontSize: 12,
  },
  balanceStatValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  tierInfo: {
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 16,
    fontSize: 14,
  },
  packagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  packageCard: {
    width: '48%',
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 4,
  },
  packageCardGood: {
    borderColor: '#22c55e',
  },
  packageCardBest: {
    borderColor: '#eab308',
    borderWidth: 2,
  },
  discountBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  discountBadgeGood: {
    backgroundColor: '#22c55e',
  },
  discountBadgeBest: {
    backgroundColor: '#eab308',
  },
  discountBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: 'bold',
  },
  packagePoints: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  packagePointsLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  packageOldPrice: {
    color: '#64748b',
    fontSize: 14,
    textDecorationLine: 'line-through',
  },
  packagePrice: {
    color: '#22c55e',
    fontSize: 20,
    fontWeight: 'bold',
  },
  packageSavings: {
    color: '#22c55e',
    fontSize: 11,
    marginTop: 2,
  },
  packagePricePerPoint: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 12,
  },
  buyButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buyButtonBest: {
    backgroundColor: '#eab308',
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  infoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  testModeWarning: {
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  testModeText: {
    color: '#eab308',
    fontSize: 12,
  },
  cannotPurchase: {
    alignItems: 'center',
    padding: 32,
  },
  cannotPurchaseText: {
    color: '#94a3b8',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  upgradeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  upgradeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default BuyPointsScreen;
