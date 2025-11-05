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
    backgroundColor: '#f9fafb',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterTabActive: {
    borderBottomColor: '#6366f1',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#6366f1',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  bidCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bidHeaderLeft: {
    flex: 1,
    marginRight: 12,
  },
  bidOrder: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '600',
    marginBottom: 4,
  },
  bidDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  bidDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 13,
    color: '#111827',
    fontWeight: '500',
  },
  pointsWon: {
    color: '#ef4444',
    fontWeight: '600',
  },
  pointsLost: {
    color: '#f59e0b',
    fontWeight: '600',
  },
  pointsPending: {
    color: '#6b7280',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default MyBidsScreen;
