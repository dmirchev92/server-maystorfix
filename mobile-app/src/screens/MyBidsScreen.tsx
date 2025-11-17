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
import { useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface Bid {
  id: string;
  case_id: string;
  points_bid: number;
  bid_status: 'pending' | 'won' | 'lost' | 'refunded';
  bid_order: number;
  points_deducted: number;
  created_at: string;
  case_description?: string;
  case_budget?: number;
  case_city?: string;
  customer_name?: string;
}

const MyBidsScreen: React.FC = () => {
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'won' | 'lost'>('all');

  useFocusEffect(
    useCallback(() => {
      fetchBids();
    }, [])
  );

  const fetchBids = async () => {
    try {
      const apiService = ApiService.getInstance();
      const response = await apiService.getMyBids();
      
      if (response.success && response.data) {
        const myBids = response.data.bids || response.data || [];
        setBids(myBids);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBids();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      pending: { label: 'Чакаща', color: '#f59e0b', icon: '⏳' },
      won: { label: 'Спечелена', color: '#10b981', icon: '🎉' },
      lost: { label: 'Загубена', color: '#ef4444', icon: '❌' },
      refunded: { label: 'Възстановена', color: '#6b7280', icon: '↩️' },
    };
    
    const config = statusConfig[status] || { label: status, color: '#6b7280', icon: '•' };
    
    return (
      <View style={[styles.badge, { backgroundColor: config.color }]}>
        <Text style={styles.badgeText}>
          {config.icon} {config.label}
        </Text>
      </View>
    );
  };

  const filteredBids = bids.filter((bid) => {
    if (filter === 'all') return true;
    return bid.bid_status === filter;
  });

  const renderBid = ({ item }: { item: Bid }) => (
    <View style={styles.bidCard}>
      <View style={styles.bidHeader}>
        <View style={styles.bidHeaderLeft}>
          <Text style={styles.bidOrder}>#{item.bid_order}</Text>
          <Text style={styles.bidDescription} numberOfLines={2}>
            {item.case_description || 'Заявка'}
          </Text>
        </View>
        {getStatusBadge(item.bid_status)}
      </View>

      <View style={styles.bidDetails}>
        {item.case_budget && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>💰 Бюджет:</Text>
            <Text style={styles.detailValue}>{item.case_budget} BGN</Text>
          </View>
        )}
        
        {item.case_city && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍 Град:</Text>
            <Text style={styles.detailValue}>{item.case_city}</Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>💎 Точки:</Text>
          <Text style={[
            styles.detailValue,
            item.bid_status === 'won' ? styles.pointsWon : 
            item.bid_status === 'lost' ? styles.pointsLost : 
            styles.pointsPending
          ]}>
            {item.bid_status === 'won' ? `-${item.points_bid}` :
             item.bid_status === 'lost' ? `-${item.points_deducted} (${Math.round((item.points_bid - item.points_deducted) / item.points_bid * 100)}% възстановени)` :
             `-${item.points_bid} (резервирани)`}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>📅 Дата:</Text>
          <Text style={styles.detailValue}>
            {new Date(item.created_at).toLocaleDateString('bg-BG')}
          </Text>
        </View>
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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Моите оферти</Text>
        <Text style={styles.headerSubtitle}>
          {bids.length} {bids.length === 1 ? 'оферта' : 'оферти'}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Всички ({bids.length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterText, filter === 'pending' && styles.filterTextActive]}>
            Чакащи ({bids.filter(b => b.bid_status === 'pending').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'won' && styles.filterTabActive]}
          onPress={() => setFilter('won')}
        >
          <Text style={[styles.filterText, filter === 'won' && styles.filterTextActive]}>
            Спечелени ({bids.filter(b => b.bid_status === 'won').length})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.filterTab, filter === 'lost' && styles.filterTabActive]}
          onPress={() => setFilter('lost')}
        >
          <Text style={[styles.filterText, filter === 'lost' && styles.filterTextActive]}>
            Загубени ({bids.filter(b => b.bid_status === 'lost').length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filteredBids}
        renderItem={renderBid}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'Все още нямате оферти'
                : `Няма ${filter === 'pending' ? 'чакащи' : filter === 'won' ? 'спечелени' : 'загубени'} оферти`}
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900 - matches CasesScreen
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
  header: {
    backgroundColor: '#1e293b', // slate-800 - matches CasesScreen header
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  headerTitle: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b', // slate-800
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  filterTab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#6366f1', // indigo-500
  },
  filterText: {
    fontSize: 11,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },
  filterTextActive: {
    color: '#a5b4fc', // indigo-300
    fontWeight: theme.fontWeight.bold,
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 80, // Extra padding for bottom tab bar
  },
  bidCard: {
    backgroundColor: '#1e293b', // slate-800 - matches CasesScreen cards
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500 - accent like CasesScreen
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  bidHeaderLeft: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  bidOrder: {
    fontSize: theme.fontSize.xs,
    color: '#a5b4fc', // indigo-300
    fontWeight: theme.fontWeight.semibold,
    marginBottom: theme.spacing.xs,
  },
  bidDescription: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#cbd5e1', // slate-300
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  bidDetails: {
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  detailValue: {
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
    fontWeight: theme.fontWeight.medium,
  },
  pointsWon: {
    color: '#ef4444', // red-500
    fontWeight: theme.fontWeight.semibold,
  },
  pointsLost: {
    color: '#fbbf24', // amber-400
    fontWeight: theme.fontWeight.semibold,
  },
  pointsPending: {
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.semibold,
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
    textAlign: 'center',
  },
});

export default MyBidsScreen;
