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
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';
import { PointsBalance } from '../components/PointsBalance';

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
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [monthTransactions, setMonthTransactions] = useState<any[]>([]);
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [selectedMonthName, setSelectedMonthName] = useState('');

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

  const handleMonthClick = async (month: string) => {
    try {
      setSelectedMonthName(getMonthName(month));
      const response = await ApiService.getInstance().getIncomeTransactionsByMonth(user.id, month);
      if (response.success && response.data) {
        setMonthTransactions(response.data);
        setShowTransactionsModal(true);
      } else {
        Alert.alert('Грешка', 'Не могат да се заредят транзакциите');
      }
    } catch (error) {
      console.error('Error fetching month transactions:', error);
      Alert.alert('Грешка', 'Възникна грешка при зареждането на транзакциите');
    }
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
        {/* Points Balance */}
        <View style={styles.pointsSection}>
          <PointsBalance />
        </View>

        {incomeStats ? (
          <>
            {/* Main Income Card - Matching Web Design */}
            <View style={styles.incomeCard}>
              <View style={styles.incomeHeader}>
                <View style={styles.incomeHeaderLeft}>
                  <Text style={styles.incomeEmoji}>💰</Text>
                  <Text style={styles.incomeTitle}>Приходи</Text>
                </View>
              </View>

              {/* Two Column Layout - Month and Total */}
              <View style={styles.twoColumnContainer}>
                {/* Selected Month Card - Purple Gradient */}
                {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 && (
                  <TouchableOpacity 
                    style={styles.monthCard}
                    onPress={() => setShowMonthPicker(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.cardLabel}>Избран месец</Text>
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => setShowMonthPicker(true)}
                    >
                      <Text style={styles.dropdownText}>
                        {getMonthName(selectedMonth || incomeStats.monthlyIncome[0]?.month)}
                      </Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                    {(() => {
                      const currentMonth = incomeStats.monthlyIncome.find(
                        (m: any) => m.month === (selectedMonth || incomeStats.monthlyIncome[0]?.month)
                      ) || incomeStats.monthlyIncome[0];
                      return (
                        <>
                          <Text style={styles.monthValue}>
                            {currentMonth.total.toFixed(2)} BGN
                          </Text>
                          <Text style={styles.cardDetails}>
                            {currentMonth.count} заявки • Средно: {currentMonth.average.toFixed(2)} BGN
                          </Text>
                        </>
                      );
                    })()}
                  </TouchableOpacity>
                )}

                {/* Total Income Card - Green Gradient */}
                <TouchableOpacity 
                  style={styles.totalCard}
                  onPress={() => setShowYearPicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cardLabel}>Общо приходи</Text>
                  {availableYears.length > 0 && (
                    <TouchableOpacity 
                      style={styles.dropdownButton}
                      onPress={() => setShowYearPicker(true)}
                    >
                      <Text style={styles.dropdownText}>{selectedYear} г.</Text>
                      <Text style={styles.dropdownArrow}>▼</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.totalValue}>
                    {incomeStats.summary.totalIncome.toFixed(2)} BGN
                  </Text>
                  <Text style={styles.cardDetails}>
                    {incomeStats.summary.incomeCount} заявки • Средно: {incomeStats.summary.averageIncome.toFixed(2)} BGN
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Monthly Income */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>📅 Месечна разбивка</Text>
                {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 1 && (
                  <TouchableOpacity 
                    style={styles.toggleButton}
                    onPress={() => setShowAllMonths(!showAllMonths)}
                  >
                    <Text style={styles.toggleButtonText}>
                      {showAllMonths ? 'Текущ месец' : `Всички (${incomeStats.monthlyIncome.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {incomeStats.monthlyIncome && incomeStats.monthlyIncome.length > 0 ? (
                (showAllMonths ? incomeStats.monthlyIncome : incomeStats.monthlyIncome.slice(0, 1)).map((month, index) => (
                  <TouchableOpacity 
                    key={index} 
                    style={styles.monthListCard}
                    onPress={() => handleMonthClick(month.month)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.monthListHeader}>
                      <View style={styles.monthListLeft}>
                        <Text style={styles.monthListName}>{getMonthName(month.month)}</Text>
                        <Text style={styles.monthListCount}>{month.count} заявки</Text>
                      </View>
                      <View style={styles.monthListRight}>
                        <Text style={styles.monthListTotal}>{month.total.toFixed(2)} BGN</Text>
                        <Text style={styles.monthListArrow}>👆</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Няма данни за този период</Text>
                </View>
              )}
            </View>

            {/* Payment Methods - Grid Layout */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💳 По метод на плащане</Text>
              {incomeStats.paymentMethods && incomeStats.paymentMethods.length > 0 ? (
                <View style={styles.paymentGrid}>
                  {incomeStats.paymentMethods.map((pm, index) => {
                    const average = pm.count > 0 ? (pm.total / pm.count).toFixed(2) : '0.00';
                    return (
                      <View key={index} style={styles.paymentGridCard}>
                        <Text style={styles.paymentGridLabel}>{getPaymentMethodLabel(pm.method)}</Text>
                        <Text style={styles.paymentGridValue}>{pm.total.toFixed(2)} BGN</Text>
                        <Text style={styles.paymentGridDetails}>{pm.count} заявки</Text>
                      </View>
                    );
                  })}
                </View>
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

      {/* Year Picker Modal */}
      <Modal
        visible={showYearPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowYearPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowYearPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Изберете година</Text>
              <TouchableOpacity onPress={() => setShowYearPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {availableYears.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.pickerItem,
                    selectedYear === year && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedYear(year);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    selectedYear === year && styles.pickerItemTextSelected
                  ]}>
                    {year} г.
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Month Picker Modal */}
      <Modal
        visible={showMonthPicker}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowMonthPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMonthPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalContent}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Изберете месец</Text>
              <TouchableOpacity onPress={() => setShowMonthPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerScroll}>
              {incomeStats?.monthlyIncome?.map((month) => (
                <TouchableOpacity
                  key={month.month}
                  style={[
                    styles.pickerItem,
                    (selectedMonth || incomeStats.monthlyIncome[0]?.month) === month.month && styles.pickerItemSelected
                  ]}
                  onPress={() => {
                    setSelectedMonth(month.month);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[
                    styles.pickerItemText,
                    (selectedMonth || incomeStats.monthlyIncome[0]?.month) === month.month && styles.pickerItemTextSelected
                  ]}>
                    {getMonthName(month.month)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Transactions Modal */}
      <Modal
        visible={showTransactionsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTransactionsModal(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowTransactionsModal(false)}
        >
          <TouchableOpacity 
            style={[styles.modalContent, styles.transactionsModalContent]}
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMonthName}</Text>
              <TouchableOpacity onPress={() => setShowTransactionsModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.transactionsScroll}>
              {monthTransactions.length > 0 ? (
                monthTransactions.map((transaction: any, index: number) => (
                  <View key={index} style={styles.transactionCard}>
                    <View style={styles.transactionHeader}>
                      <Text style={styles.transactionTitle}>
                        {transaction.case_description || `Заявка #${transaction.case_id?.substring(0, 8)}`}
                      </Text>
                      <Text style={styles.transactionAmount}>
                        {parseFloat(transaction.amount || 0).toFixed(2)} BGN
                      </Text>
                    </View>
                    <View style={styles.transactionDetails}>
                      <Text style={styles.transactionDetail}>
                        💳 {getPaymentMethodLabel(transaction.payment_method)}
                      </Text>
                      <Text style={styles.transactionDetail}>
                        📅 {new Date(transaction.recorded_at).toLocaleDateString('bg-BG')}
                      </Text>
                    </View>
                    {transaction.notes && (
                      <Text style={styles.transactionNotes}>📝 {transaction.notes}</Text>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>Няма транзакции за този месец</Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.transactionsSummary}>
              <Text style={styles.transactionsSummaryLabel}>Общо транзакции:</Text>
              <Text style={styles.transactionsSummaryValue}>{monthTransactions.length}</Text>
            </View>
            <View style={styles.transactionsSummary}>
              <Text style={styles.transactionsSummaryLabel}>Обща сума:</Text>
              <Text style={styles.transactionsSummaryValue}>
                {monthTransactions.reduce((sum: number, t: any) => sum + parseFloat(t.amount || 0), 0).toFixed(2)} BGN
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  pointsSection: {
    padding: theme.spacing.md,
  },
  // Main Income Card (Dark gradient like web)
  incomeCard: {
    margin: theme.spacing.md,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 2,
    borderColor: 'rgba(34, 197, 94, 0.3)', // green-500/30
    ...theme.shadows.lg,
  },
  incomeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  incomeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  incomeEmoji: {
    fontSize: 28,
  },
  incomeTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    color: '#ffffff',
  },
  // Two column layout for month and total
  twoColumnContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  // Month Card - Purple Gradient
  monthCard: {
    flex: 1,
    backgroundColor: 'rgba(168, 85, 247, 0.2)', // purple-500/20
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(192, 132, 252, 0.3)', // purple-400/30
  },
  monthValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#c084fc', // purple-400
    marginTop: theme.spacing.xs,
  },
  // Total Card - Green Gradient
  totalCard: {
    flex: 1,
    backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500/20
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.3)', // green-400/30
  },
  totalValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ade80', // green-400
    marginTop: theme.spacing.xs,
  },
  cardLabel: {
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
  },
  cardDetails: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
    marginTop: theme.spacing.xs,
  },
  section: {
    padding: theme.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  toggleButton: {
    backgroundColor: 'rgba(51, 65, 85, 0.7)', // slate-700
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.5)', // slate-600
  },
  toggleButtonText: {
    fontSize: theme.fontSize.xs,
    color: '#cbd5e1', // slate-200
    fontWeight: theme.fontWeight.medium,
  },
  // Monthly list cards (clickable with better colors)
  monthListCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  monthListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  monthListLeft: {
    flex: 1,
  },
  monthListName: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300 (lighter, not gray)
    marginBottom: 4,
  },
  monthListCount: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
  },
  monthListRight: {
    alignItems: 'flex-end',
  },
  monthListTotal: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#4ade80', // green-400 (bright green, not gray!)
    marginBottom: 4,
  },
  monthListArrow: {
    fontSize: 12,
    color: '#4ade80', // green-400
  },
  // Payment methods grid
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  paymentGridCard: {
    width: '48%',
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    alignItems: 'center',
  },
  paymentGridLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  paymentGridValue: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#cbd5e1', // slate-200
    marginBottom: theme.spacing.xs,
    textAlign: 'center',
  },
  paymentGridDetails: {
    fontSize: theme.fontSize.xs,
    color: '#64748b', // slate-500
    textAlign: 'center',
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
  // Dropdown button styles
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(51, 65, 85, 0.7)', // slate-700/70
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.3)', // slate-400/30
  },
  dropdownText: {
    fontSize: theme.fontSize.xs,
    color: '#cbd5e1', // slate-200
    flex: 1,
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#cbd5e1', // slate-200
    marginLeft: theme.spacing.xs,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.background.secondary,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  modalTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: theme.colors.text.primary,
  },
  modalClose: {
    fontSize: 24,
    color: theme.colors.text.secondary,
    fontWeight: 'bold',
  },
  pickerScroll: {
    maxHeight: 300,
  },
  pickerItem: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  pickerItemSelected: {
    backgroundColor: theme.colors.primary.light,
  },
  pickerItemText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  pickerItemTextSelected: {
    color: theme.colors.primary.solid,
    fontWeight: theme.fontWeight.bold,
  },
  // Transactions Modal
  transactionsModalContent: {
    maxHeight: '80%',
  },
  transactionsScroll: {
    maxHeight: 400,
  },
  transactionCard: {
    backgroundColor: 'rgba(30, 41, 59, 0.5)', // slate-800/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  transactionTitle: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginRight: theme.spacing.sm,
  },
  transactionAmount: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: '#4ade80', // green-400
  },
  transactionDetails: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  transactionDetail: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
  },
  transactionNotes: {
    fontSize: theme.fontSize.xs,
    color: '#cbd5e1', // slate-300
    fontStyle: 'italic',
    marginTop: theme.spacing.xs,
  },
  transactionsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  transactionsSummaryLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
  },
  transactionsSummaryValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: '#4ade80', // green-400
  },
});
