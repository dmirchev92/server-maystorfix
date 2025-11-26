import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import ApiService from '../services/ApiService';
import { RootStackParamList } from '../navigation/types';

type CaseBidsRouteProp = RouteProp<RootStackParamList, 'CaseBids'>;
type NavigationProp = StackNavigationProp<RootStackParamList>;

interface Bid {
  id: string;
  provider_id: string;
  provider_name?: string | null;
  provider_first_name?: string | null;
  provider_last_name?: string | null;
  provider_company?: string | null;
  provider_phone?: string | null;
  provider_rating?: number | null;
  proposed_budget_range?: string | null;
  bid_comment?: string | null;
  bid_status?: 'pending' | 'won' | 'lost' | null;
  created_at?: string | null;
}

interface CaseDetails {
  id: string;
  description: string;
  category: string;
  status: string;
  budget?: number;
  city?: string;
  neighborhood?: string;
  winning_bid_id?: string;
}

export default function CaseBidsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CaseBidsRouteProp>();
  const { caseId, caseDescription } = route.params;

  const [bids, setBids] = useState<Bid[]>([]);
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, caseId]);

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      const userData = (response.data as any)?.user || response.data;
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch case details
      const casesResponse = await ApiService.getInstance().getCasesWithFilters({
        customerId: user?.id,
      });
      
      if (casesResponse.success && casesResponse.data) {
        const cases = (casesResponse.data as any).cases || [];
        const foundCase = cases.find((c: any) => c.id === caseId);
        if (foundCase) {
          setCaseDetails(foundCase);
        }
      }

      // Fetch bids with provider info
      const bidsResponse = await ApiService.getInstance().getCaseBids(caseId, true);
      console.log('Bids response:', bidsResponse);

      if (bidsResponse.success && bidsResponse.data) {
        const bidsData = (bidsResponse.data as any)?.bids || bidsResponse.data;
        setBids(Array.isArray(bidsData) ? bidsData : []);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на офертите');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleSelectWinner = async (bidId: string, providerName: string) => {
    Alert.alert(
      'Потвърждение',
      `Сигурни ли сте, че искате да изберете ${providerName} за изпълнител? Това действие не може да бъде отменено.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Избери',
          style: 'default',
          onPress: async () => {
            try {
              setSelecting(bidId);
              const response = await ApiService.getInstance().selectWinningBid(caseId, bidId);

              if (response.success) {
                Alert.alert('Успех', 'Изпълнителят беше избран успешно!', [
                  {
                    text: 'OK',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                const errorMsg = (response.error as any)?.message || 'Възникна грешка';
                Alert.alert('Грешка', errorMsg);
              }
            } catch (error: any) {
              console.error('Error selecting winner:', error);
              Alert.alert('Грешка', 'Неуспешен избор на изпълнител');
            } finally {
              setSelecting(null);
            }
          },
        },
      ]
    );
  };

  const getProviderDisplayName = (bid: Bid): string => {
    if (bid.provider_name) return String(bid.provider_name);
    if (bid.provider_first_name && bid.provider_last_name) {
      return `${bid.provider_first_name} ${bid.provider_last_name}`.trim();
    }
    if (bid.provider_first_name) return String(bid.provider_first_name);
    if (bid.provider_company) return String(bid.provider_company);
    return 'Неизвестен';
  };

  const getBidStatusColor = (status: string | undefined | null): string => {
    switch (status) {
      case 'won':
        return '#22c55e';
      case 'lost':
        return '#ef4444';
      default:
        return '#f59e0b';
    }
  };

  const getBidStatusText = (status: string | undefined | null): string => {
    switch (status) {
      case 'won':
        return 'Избран';
      case 'lost':
        return 'Неизбран';
      default:
        return 'Чакащ';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  const hasWinner = caseDetails?.winning_bid_id || bids.some((b) => b.bid_status === 'won');

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Оферти за заявка</Text>
      </View>

      {/* Case Info */}
      <View style={styles.caseInfo}>
        <Text style={styles.caseDescription} numberOfLines={2}>
          {caseDescription || caseDetails?.description || 'Заявка'}
        </Text>
        {caseDetails?.budget && (
          <Text style={styles.caseBudget}>Бюджет: {caseDetails.budget} лв.</Text>
        )}
        <Text style={styles.bidsCount}>
          {bids.length} {bids.length === 1 ? 'оферта' : 'оферти'}
        </Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.list}
      >
        {bids.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Все още няма оферти за тази заявка</Text>
            <Text style={styles.emptySubtext}>
              Специалистите ще могат да направят оферти скоро
            </Text>
          </View>
        ) : (
          bids.map((bid, index) => (
            <View key={bid.id} style={styles.bidCard}>
              {/* Bid Header */}
              <View style={styles.bidHeader}>
                <View style={styles.bidOrderBadge}>
                  <Text style={styles.bidOrderText}>#{index + 1}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getBidStatusColor(bid.bid_status) },
                  ]}
                >
                  <Text style={styles.statusText}>{getBidStatusText(bid.bid_status)}</Text>
                </View>
              </View>

              {/* Provider Info */}
              <View style={styles.providerInfo}>
                <View style={styles.providerAvatar}>
                  <Text style={styles.providerAvatarText}>
                    {(getProviderDisplayName(bid) || 'N').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.providerDetails}>
                  <Text style={styles.providerName}>{getProviderDisplayName(bid)}</Text>
                  {bid.provider_rating != null && bid.provider_rating > 0 ? (
                    <Text style={styles.providerRating}>
                      ⭐ {bid.provider_rating.toFixed(1)}
                    </Text>
                  ) : null}
                </View>
              </View>

              {/* Bid Details */}
              <View style={styles.bidDetails}>
                <View style={styles.bidPriceRow}>
                  <Text style={styles.bidPriceLabel}>Предложена цена:</Text>
                  <Text style={styles.bidPrice}>{bid.proposed_budget_range || 'Не е посочена'}</Text>
                </View>

                {bid.bid_comment ? (
                  <View style={styles.bidCommentContainer}>
                    <Text style={styles.bidCommentLabel}>Коментар:</Text>
                    <Text style={styles.bidComment}>{bid.bid_comment}</Text>
                  </View>
                ) : null}

                <Text style={styles.bidDate}>
                  Подадена на: {bid.created_at ? new Date(bid.created_at).toLocaleDateString('bg-BG') : 'Неизвестно'}
                </Text>
              </View>

              {/* Action Button */}
              {!hasWinner && (bid.bid_status === 'pending' || !bid.bid_status) && (
                <TouchableOpacity
                  style={[
                    styles.selectButton,
                    selecting === bid.id && styles.selectButtonDisabled,
                  ]}
                  onPress={() => handleSelectWinner(bid.id, getProviderDisplayName(bid))}
                  disabled={selecting !== null}
                >
                  {selecting === bid.id ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.selectButtonText}>✓ Избери този изпълнител</Text>
                  )}
                </TouchableOpacity>
              )}

              {bid.bid_status === 'won' && (
                <View style={styles.winnerBadge}>
                  <Text style={styles.winnerBadgeText}>🏆 Избран изпълнител</Text>
                </View>
              )}
            </View>
          ))
        )}

        {/* Info Card */}
        {bids.length > 0 && !hasWinner && (
          <View style={styles.infoCard}>
            <Text style={styles.infoIcon}>💡</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Как да изберете?</Text>
              <Text style={styles.infoText}>
                • Прегледайте предложените цени и коментари{'\n'}
                • Изберете изпълнител, който отговаря на вашите нужди{'\n'}
                • След избор ще можете да се свържете директно
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 50,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8fafc',
    flex: 1,
  },
  caseInfo: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
  },
  caseDescription: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 8,
  },
  caseBudget: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginBottom: 4,
  },
  bidsCount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  bidCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  bidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  bidOrderBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  bidOrderText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  providerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  providerAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  providerDetails: {
    flex: 1,
  },
  providerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f8fafc',
    marginBottom: 4,
  },
  providerRating: {
    fontSize: 14,
    color: '#fbbf24',
  },
  bidDetails: {
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  bidPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  bidPriceLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  bidPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  bidCommentContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.3)',
  },
  bidCommentLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 4,
  },
  bidComment: {
    fontSize: 14,
    color: '#e2e8f0',
    fontStyle: 'italic',
  },
  bidDate: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  selectButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  selectButtonDisabled: {
    backgroundColor: '#64748b',
  },
  selectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  winnerBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  winnerBadgeText: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
});
