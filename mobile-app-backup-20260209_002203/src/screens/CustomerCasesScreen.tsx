import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import { getCategoryLabel } from '../constants/serviceCategories';
import CategoryIcon from '../components/CategoryIcon';
import ReviewModal from '../components/ReviewModal';

interface Case {
  id: string;
  case_number?: number;
  service_type: string;
  description: string;
  status: string;
  category: string;
  budget?: number;
  city?: string;
  neighborhood?: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  provider_id?: string;
  provider_name?: string;
  bidding_enabled?: boolean;
  current_bidders?: number;
  max_bidders?: number;
  winning_bid_id?: string;
  created_at: string;
  // Negotiation fields
  negotiation_status?: string;
  assigned_sp_id?: string;
  customer_budget?: string;
  sp_counter_budget?: string;
  counter_message?: string;
  // Review fields
  has_review?: boolean;
}

type StatusFilter = 'active' | 'completed';

export default function CustomerCasesScreen() {
  const navigation = useNavigation<any>();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  
  // Review modal state
  const [reviewModal, setReviewModal] = useState<{
    visible: boolean;
    caseId: string;
    providerId: string;
    providerName: string;
  }>({ visible: false, caseId: '', providerId: '', providerName: '' });

  useEffect(() => {
    loadUser();
  }, []);

  // Handle customer response to counter-offer
  const handleCounterOfferResponse = async (caseId: string, accept: boolean) => {
    setActionLoading(caseId);
    try {
      const response = await ApiService.getInstance().customerRespondToCounterOffer(caseId, accept ? 'accept' : 'decline');
      if (response.success) {
        Alert.alert('Успех', accept ? 'Офертата е приета!' : 'Офертата е отказана.');
        fetchCases();
      } else {
        Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
      }
    } catch (error: any) {
      Alert.alert('Грешка', error.message || 'Възникна грешка');
    } finally {
      setActionLoading(null);
    }
  };

  // Send case to marketplace
  const handleSendToMarketplace = async (caseId: string) => {
    Alert.alert(
      'Изпращане към marketplace',
      'Искате ли да изпратите заявката към други специалисти?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Да',
          onPress: async () => {
            setActionLoading(caseId);
            try {
              const response = await ApiService.getInstance().sendCaseToMarketplace(caseId);
              if (response.success) {
                Alert.alert('Успех', 'Заявката е изпратена към marketplace!');
                fetchCases();
              } else {
                Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
              }
            } catch (error: any) {
              Alert.alert('Грешка', error.message || 'Възникна грешка');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  // Cancel case
  const handleCancelCase = async (caseId: string) => {
    Alert.alert(
      'Отмяна на заявка',
      'Сигурни ли сте, че искате да отмените тази заявка?',
      [
        { text: 'Не', style: 'cancel' },
        {
          text: 'Да, отмени',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(caseId);
            try {
              const response = await ApiService.getInstance().cancelCase(caseId);
              if (response.success) {
                Alert.alert('Успех', 'Заявката е отменена.');
                fetchCases();
              } else {
                Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
              }
            } catch (error: any) {
              Alert.alert('Грешка', error.message || 'Възникна грешка');
            } finally {
              setActionLoading(null);
            }
          }
        }
      ]
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchCases();
      }
    }, [user])
  );

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      const userData = (response.data as any)?.user || response.data;
      setUser(userData);
    } catch (error) {
      Logger.error('Error loading user:', error);
    }
  };

  const fetchCases = async () => {
    if (!user) return;
    try {
      const response = await ApiService.getInstance().getCasesWithFilters({
        customerId: user.id,
        limit: 100, // Fetch more cases to include completed ones
      });
      if (response.success && response.data) {
        setCases((response.data as any).cases || []);
      }
    } catch (error) {
      Logger.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#22c55e';
      case 'wip': return '#3b82f6';
      case 'completed': return '#6b7280';
      case 'declined': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Чакаща';
      case 'accepted': return 'Приета';
      case 'wip': return 'В процес';
      case 'completed': return 'Завършена';
      case 'declined': return 'Отказана';
      case 'cancelled': return 'Отменена';
      default: return status;
    }
  };

  // CategoryIcon component is imported from components/CategoryIcon

  // Use centralized category labels from serviceCategories.ts
  // This handles both 'cat_' prefix and non-prefix formats
  const getCategoryName = (category: string) => {
    return getCategoryLabel(category) || category;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  // Filter cases based on status filter
  const filteredCases = cases.filter(c => {
    if (statusFilter === 'active') {
      return c.status === 'pending' || c.status === 'accepted' || c.status === 'wip';
    } else {
      return c.status === 'completed';
    }
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Моите заявки</Text>
        <Text style={styles.subtitle}>Преглед на вашите заявки и оферти</Text>
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === 'active' && styles.filterTabActive]}
          onPress={() => setStatusFilter('active')}
        >
          <Text style={[styles.filterTabText, statusFilter === 'active' && styles.filterTabTextActive]}>
            📋 Активни ({cases.filter(c => c.status !== 'completed').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, statusFilter === 'completed' && styles.filterTabActive]}
          onPress={() => setStatusFilter('completed')}
        >
          <Text style={[styles.filterTabText, statusFilter === 'completed' && styles.filterTabTextActive]}>
            ✅ Завършени ({cases.filter(c => c.status === 'completed').length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        contentContainerStyle={styles.list}
      >
        {filteredCases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>{statusFilter === 'active' ? '📭' : '✅'}</Text>
            <Text style={styles.emptyText}>
              {statusFilter === 'active' ? 'Нямате активни заявки' : 'Нямате завършени заявки'}
            </Text>
            <Text style={styles.emptySubtext}>
              {statusFilter === 'active' 
                ? 'Създайте първата си заявка и получете оферти от специалисти'
                : 'Когато завършите заявка, тя ще се появи тук'}
            </Text>
            {statusFilter === 'active' && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => navigation.navigate('CreateCase')}
              >
                <Text style={styles.createButtonText}>➕ Създай нова заявка</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {filteredCases.map((item) => (
              <View key={item.id} style={styles.card}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.categoryContainer}>
                    <View style={styles.categoryIconWrapper}>
                      <CategoryIcon category={item.category} size={44} color="#a5b4fc" />
                    </View>
                    {item.case_number && (
                      <View style={styles.caseNumberBadge}>
                        <Text style={styles.caseNumberText}>#{item.case_number}</Text>
                      </View>
                    )}
                    <Text style={styles.category}>{getCategoryName(item.category)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

                {/* Meta Info */}
                <View style={styles.metaRow}>
                  {item.city && (
                    <Text style={styles.metaText}>📍 {item.city}</Text>
                  )}
                  <Text style={styles.metaText}>
                    📅 {new Date(item.created_at).toLocaleDateString('bg-BG')}
                  </Text>
                  {item.budget && (
                    <Text style={styles.budgetText}>💰 {item.budget} €</Text>
                  )}
                </View>

                {/* Negotiation Status */}
                {item.negotiation_status && item.negotiation_status !== 'none' && (
                  <View style={styles.negotiationSection}>
                    {item.negotiation_status === 'pending_sp_review' && (
                      <View style={styles.negotiationBadge}>
                        <Text style={styles.negotiationBadgeText}>⏳ Чака преглед от специалист</Text>
                      </View>
                    )}
                    {item.negotiation_status === 'counter_offered' && (
                      <View style={styles.counterOfferSection}>
                        <View style={[styles.negotiationBadge, styles.counterOfferBadge]}>
                          <Text style={styles.counterOfferBadgeText}>💰 Нова оферта!</Text>
                        </View>
                        <Text style={styles.counterOfferAmount}>
                          Предложена цена: {item.sp_counter_budget} €
                        </Text>
                        {item.counter_message && (
                          <Text style={styles.counterOfferMessage}>"{item.counter_message}"</Text>
                        )}
                        <View style={styles.counterOfferActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.acceptBtn]}
                            onPress={() => handleCounterOfferResponse(item.id, true)}
                            disabled={actionLoading === item.id}
                          >
                            <Text style={styles.actionBtnText}>
                              {actionLoading === item.id ? '...' : '✅ Приеми'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.declineBtn]}
                            onPress={() => handleCounterOfferResponse(item.id, false)}
                            disabled={actionLoading === item.id}
                          >
                            <Text style={styles.actionBtnText}>❌ Откажи</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                    {(item.negotiation_status === 'sp_declined' || item.negotiation_status === 'customer_declined') && (
                      <View style={styles.declinedSection}>
                        <View style={[styles.negotiationBadge, styles.declinedBadge]}>
                          <Text style={styles.declinedBadgeText}>
                            {item.negotiation_status === 'sp_declined' ? '❌ Специалистът отказа' : 'Офертата отказана'}
                          </Text>
                        </View>
                        <View style={styles.declinedActions}>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.marketplaceBtn]}
                            onPress={() => handleSendToMarketplace(item.id)}
                            disabled={actionLoading === item.id}
                          >
                            <Text style={styles.actionBtnText}>
                              {actionLoading === item.id ? '...' : '📢 Други специалисти'}
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionBtn, styles.cancelBtn]}
                            onPress={() => handleCancelCase(item.id)}
                            disabled={actionLoading === item.id}
                          >
                            <Text style={styles.actionBtnText}>🗑️ Отмени</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                )}

                {/* Bidding Info */}
                {item.bidding_enabled && (
                  <View style={styles.biddingInfo}>
                    <View style={styles.biddingBadge}>
                      <Text style={styles.biddingText}>
                        👥 {item.current_bidders || 0}/{item.max_bidders || 3} оферти
                      </Text>
                    </View>
                    {item.winning_bid_id && (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerText}>✅ Избран изпълнител</Text>
                      </View>
                    )}
                    {item.provider_name && (
                      <Text style={styles.providerName}>Изпълнител: {item.provider_name}</Text>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {/* View Bids Button - Show if has bidders and no winner yet */}
                  {item.bidding_enabled && (item.current_bidders || 0) > 0 && !item.winning_bid_id && (
                    <TouchableOpacity
                      style={styles.viewBidsButton}
                      onPress={() => {
                        // Navigate to root stack's CaseBids screen
                        navigation.navigate('CaseBids' as never, {
                          caseId: item.id,
                          caseDescription: item.description,
                        } as never);
                      }}
                    >
                      <Text style={styles.viewBidsButtonText}>
                        👥 Виж оферти ({item.current_bidders})
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* View Details Button - Always show for cases with winner */}
                  {item.winning_bid_id && (
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={() => {
                        // Navigate to root stack's CaseBids screen
                        navigation.navigate('CaseBids' as never, {
                          caseId: item.id,
                          caseDescription: item.description,
                        } as never);
                      }}
                    >
                      <Text style={styles.detailsButtonText}>👁️ Детайли</Text>
                    </TouchableOpacity>
                  )}

                  {/* Review Button - Show for completed cases that haven't been reviewed */}
                  {item.status === 'completed' && !item.has_review && (item.provider_id || item.assigned_sp_id) && (
                    <TouchableOpacity
                      style={styles.reviewButton}
                      onPress={() => {
                        const providerId = item.provider_id || item.assigned_sp_id || '';
                        const providerName = item.provider_name || 'Специалист';
                        setReviewModal({
                          visible: true,
                          caseId: item.id,
                          providerId,
                          providerName,
                        });
                      }}
                    >
                      <Text style={styles.reviewButtonText}>⭐ Оценете</Text>
                    </TouchableOpacity>
                  )}

                  {/* Already Reviewed Badge */}
                  {item.status === 'completed' && item.has_review && (
                    <View style={styles.reviewedBadge}>
                      <Text style={styles.reviewedBadgeText}>✅ Оценено</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>💡</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Как работи системата?</Text>
                <Text style={styles.infoText}>
                  • Когато създадете заявка, специалистите могат да предложат оферти{'\n'}
                  • Максимум 3 специалисти могат да предложат оферти{'\n'}
                  • Вие избирате кой да изпълни заявката
                </Text>
              </View>
            </View>

            {/* Create New Button */}
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('CreateCase');
                } else {
                  navigation.navigate('CreateCase');
                }
              }}
            >
              <Text style={styles.floatingButtonText}>➕ Нова заявка</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Review Modal */}
      <ReviewModal
        visible={reviewModal.visible}
        onClose={() => setReviewModal({ visible: false, caseId: '', providerId: '', providerName: '' })}
        caseId={reviewModal.caseId}
        providerId={reviewModal.providerId}
        providerName={reviewModal.providerName}
        onSubmitSuccess={() => {
          fetchCases(); // Refresh cases to update has_review status
        }}
      />
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
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  filterTabTextActive: {
    color: '#fff',
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
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  caseNumberBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 6,
  },
  caseNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a5b4fc',
  },
  category: {
    fontWeight: '600',
    color: '#e2e8f0',
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 12,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  budgetText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  biddingInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.3)',
  },
  biddingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  biddingText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  winnerBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winnerText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  providerName: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  viewBidsButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewBidsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsButton: {
    flex: 1,
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
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
  floatingButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  floatingButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  // Negotiation styles
  negotiationSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  negotiationBadge: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  negotiationBadgeText: {
    fontSize: 12,
    color: '#f97316',
    fontWeight: '600',
  },
  counterOfferSection: {
    gap: 8,
  },
  counterOfferBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  counterOfferBadgeText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '700',
  },
  counterOfferAmount: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '700',
  },
  counterOfferMessage: {
    fontSize: 13,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  counterOfferActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  declinedSection: {
    gap: 8,
  },
  declinedBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  declinedBadgeText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
  },
  declinedActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#22c55e',
  },
  declineBtn: {
    backgroundColor: '#ef4444',
  },
  marketplaceBtn: {
    backgroundColor: '#3b82f6',
  },
  cancelBtn: {
    backgroundColor: '#64748b',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  reviewButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  reviewedBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.4)',
  },
  reviewedBadgeText: {
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
