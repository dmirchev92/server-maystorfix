import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface Transaction {
  id: string;
  transaction_type: 'earned' | 'spent' | 'refund';
  points_amount: number;
  balance_after: number;
  reason: string;
  case_id?: string;
  created_at: string;
}

interface PointsBalance {
  current_balance: number;
  total_earned: number;
  total_spent: number;
  last_reset?: string;
  monthly_allowance: number;
}

const PointsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      const apiService = ApiService.getInstance();
      
      // Fetch balance
      const balanceResponse = await apiService.getPointsBalance();
      if (balanceResponse.success && balanceResponse.data) {
        setBalance(balanceResponse.data);
      }
      
      // Fetch transactions
      const transactionsResponse = await apiService.getPointsTransactions(20, 0);
      if (transactionsResponse.success && transactionsResponse.data) {
        setTransactions(transactionsResponse.data.transactions || transactionsResponse.data || []);
      }
    } catch (error) {
      console.error('Error fetching points data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{getTransactionIcon(item.transaction_type)}</Text>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionReason} numberOfLines={2}>
            {item.reason}
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
          Баланс: {item.balance_after}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Налични точки</Text>
        <Text style={styles.balanceAmount}>{balance?.current_balance || 0}</Text>
        
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Спечелени</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>
              +{balance?.total_earned || 0}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Изразходвани</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>
              -{balance?.total_spent || 0}
            </Text>
          </View>
        </View>

        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionText}>
            📦 Free план
          </Text>
          <Text style={styles.subscriptionText}>
            🔄 {balance?.monthly_allowance || 50} точки/месец
          </Text>
        </View>

        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => navigation.navigate('Subscription' as never)}
        >
          <Text style={styles.upgradeButtonText}>⬆️ Надградете плана</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <View style={styles.transactionsHeader}>
        <Text style={styles.transactionsTitle}>История на транзакциите</Text>
        <Text style={styles.transactionsCount}>
          {transactions.length} {transactions.length === 1 ? 'транзакция' : 'транзакции'}
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
            <Text style={styles.emptyText}>Все още няма транзакции</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
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
  upgradeButton: {
    backgroundColor: '#6366f1', // indigo-500
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
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
});

export default PointsScreen;
