import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface MonthlyIncome {
  month: string;
  total: number;
  count: number;
  average: number;
}

interface PaymentMethod {
  method: string;
  total: number;
  count: number;
}

interface IncomeStats {
  summary: {
    totalIncome: number;
    incomeCount: number;
    averageIncome: number;
  };
  monthlyIncome: MonthlyIncome[];
  paymentMethods: PaymentMethod[];
}

export default function DashboardScreen() {
  const [user, setUser] = useState<any>(null);
  const [incomeStats, setIncomeStats] = useState<IncomeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchAvailableYears();
      }
    }, [user])
  );

  useEffect(() => {
    if (user && selectedYear) {
      fetchIncomeStats();
    }
  }, [user, selectedYear]);

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data) {
        // Handle nested user object (common API pattern)
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        setUser(userData);
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableYears = async () => {
    try {
      console.log('📅 Dashboard - Fetching available years for user:', user.id);
      const response = await ApiService.getInstance().getIncomeYears(user.id);
      console.log('📅 Dashboard - Available years response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        const years = response.data || [];
        console.log('📅 Dashboard - Available years:', years);
        setAvailableYears(years);

        // Set selected year to current year if available
        const currentYear = new Date().getFullYear();
        if (years.includes(currentYear)) {
          console.log('📅 Dashboard - Setting selected year to current:', currentYear);
          setSelectedYear(currentYear);
        } else if (years.length > 0) {
          console.log('📅 Dashboard - Setting selected year to latest:', years[years.length - 1]);
          setSelectedYear(years[years.length - 1]);
        } else {
          console.log('📅 Dashboard - No years available, using current year:', currentYear);
          setSelectedYear(currentYear);
        }
      } else {
        console.error('📅 Dashboard - Failed to fetch years:', response.error);
      }
    } catch (error) {
      console.error('📅 Dashboard - Error fetching available years:', error);
    }
  };

  const fetchIncomeStats = async () => {
    try {
      const startDate = `${selectedYear}-01-01`;
      const endDate = `${selectedYear}-12-31`;

      console.log('📊 Dashboard - Fetching income stats:', {
        userId: user.id,
        startDate,
        endDate,
      });

      const response = await ApiService.getInstance().getIncomeStats(user.id, startDate, endDate);
      console.log('📊 Dashboard - Income stats response:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        console.log('📊 Dashboard - Setting income stats:', response.data);
        setIncomeStats(response.data);
      } else {
        console.error('📊 Dashboard - No data or error:', response.error);
        Alert.alert('Грешка', response.error?.message || 'Не успяхме да заредим статистиката');
      }
    } catch (error) {
      console.error('📊 Dashboard - Error fetching income stats:', error);
      Alert.alert('Грешка', 'Не успяхме да заредим статистиката');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchIncomeStats();
    setRefreshing(false);
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: { [key: string]: string } = {
      cash: '💵 Кеш',
      card: '💳 Карта',
      bank_transfer: '🏦 Банков път',
      online: '🌐 Revolut',
      other: '📝 Друго',
    };
    return labels[method] || method;
  };

  const getMonthName = (monthStr: string) => {
    const date = new Date(monthStr + '-01');
    return date.toLocaleDateString('bg-BG', { month: 'long', year: 'numeric' });
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Табло</Text>
        <Text style={styles.headerSubtitle}>Преглед на приходите</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Year Selector */}
        {availableYears.length > 0 && (
          <View style={styles.yearSelector}>
            <Text style={styles.sectionTitle}>Година:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.yearScroll}>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[styles.yearButton, selectedYear === year && styles.yearButtonActive]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text
                    style={[
                      styles.yearButtonText,
                      selectedYear === year && styles.yearButtonTextActive,
                    ]}
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {incomeStats ? (
          <>
            {/* Summary Cards */}
            <View style={styles.summaryContainer}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Общо приходи</Text>
                <Text style={styles.summaryValue}>
                  {incomeStats.summary.totalIncome.toFixed(2)} BGN
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Брой заявки</Text>
                <Text style={styles.summaryValue}>{incomeStats.summary.incomeCount}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Средно на заявка</Text>
                <Text style={styles.summaryValue}>
                  {incomeStats.summary.averageIncome.toFixed(2)} BGN
                </Text>
              </View>
            </View>

            {/* Monthly Income */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📅 Месечна разбивка</Text>
              {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 ? (
                incomeStats.monthlyIncome.map((month, index) => (
                  <View key={index} style={styles.monthCard}>
                    <View style={styles.monthHeader}>
                      <Text style={styles.monthName}>{getMonthName(month.month)}</Text>
                      <Text style={styles.monthTotal}>{month.total.toFixed(2)} BGN</Text>
                    </View>
                    <View style={styles.monthDetails}>
                      <Text style={styles.monthDetailText}>
                        {month.count} заявки • Средно: {month.average.toFixed(2)} BGN
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Няма данни за този период</Text>
                </View>
              )}
            </View>

            {/* Payment Methods */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💳 По метод на плащане</Text>
              {incomeStats.paymentMethods && incomeStats.paymentMethods.length > 0 ? (
                incomeStats.paymentMethods.map((pm, index) => {
                  const average = pm.count > 0 ? (pm.total / pm.count).toFixed(2) : '0.00';
                  return (
                    <View key={index} style={styles.paymentCard}>
                      <View style={styles.paymentHeader}>
                        <Text style={styles.paymentMethod}>{getPaymentMethodLabel(pm.method)}</Text>
                        <Text style={styles.paymentTotal}>{pm.total.toFixed(2)} BGN</Text>
                      </View>
                      <View style={styles.paymentDetails}>
                        <Text style={styles.paymentDetailText}>
                          {pm.count} заявки • Средно: {average} BGN
                        </Text>
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Няма данни за методи на плащане</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📊</Text>
            <Text style={styles.emptyStateText}>Няма данни за приходи</Text>
            <Text style={styles.emptyStateSubtext}>
              Завършете заявки с добавен приход, за да видите статистика
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
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
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
  },
  header: {
    backgroundColor: theme.colors.primary.solid,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text.inverse,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.inverse,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  yearSelector: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  yearScroll: {
    marginTop: theme.spacing.sm,
  },
  yearButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.gray[100],
    borderWidth: 1,
    borderColor: theme.colors.border.light,
  },
  yearButtonActive: {
    backgroundColor: theme.colors.primary.solid,
    borderColor: theme.colors.primary.solid,
  },
  yearButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  yearButtonTextActive: {
    color: theme.colors.text.inverse,
  },
  summaryContainer: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  summaryLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.primary.solid,
    textAlign: 'center',
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
  },
  monthCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  monthName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  monthTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.success.solid,
  },
  monthDetails: {
    marginTop: theme.spacing.xs,
  },
  monthDetailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  paymentCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  paymentMethod: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  paymentTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.success.solid,
  },
  paymentDetails: {
    marginTop: theme.spacing.xs,
  },
  paymentDetailText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyStateText: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
});
