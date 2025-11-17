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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';
import IncomeCompletionModal from '../components/IncomeCompletionModal';
import BidButton from '../components/BidButton';
import PointsBalanceWidget from '../components/PointsBalanceWidget';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';

interface Case {
  id: string;
  service_type: string;
  description: string;
  status: 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'wip';
  category: string;
  priority: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  assignment_type?: 'open' | 'specific';
  created_at: string;
  updated_at: string;
  budget?: number;
  bidding_enabled?: boolean;
  current_bidders?: number;
  max_bidders?: number;
  winning_bid_id?: string;
  square_meters?: number;
}

interface CaseStats {
  total: number;
  pending: number;
  accepted: number;
  wip: number;
  completed: number;
  declined: number;
}

export default function CasesScreen() {
  const navigation = useNavigation<any>();
  const [cases, setCases] = useState<Case[]>([]);
  const [stats, setStats] = useState<CaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [completionModal, setCompletionModal] = useState<{
    visible: boolean;
    caseId: string;
    caseTitle: string;
  }>({ visible: false, caseId: '', caseTitle: '' });
  
  // Filters
  const [viewMode, setViewMode] = useState<'available' | 'assigned' | 'declined' | 'bids'>('available');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [myBids, setMyBids] = useState<any[]>([]);

  useEffect(() => {
    loadUserAndCases();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchCases();
        fetchStats();
      }
    }, [user, viewMode, statusFilter])
  );

  const loadUserAndCases = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data) {
        // Handle nested user object (common API pattern)
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        setUser(userData);
        await fetchCases();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCases = async () => {
    if (!user) return;

    try {
      setLoading(true);
      console.log('🔍 Fetching cases with filters:', { viewMode, statusFilter });

      // Handle bids view mode separately
      if (viewMode === 'bids') {
        console.log('💰 Fetching my bids');
        const bidsResponse = await ApiService.getInstance().getMyBids();
        console.log('💰 Bids response:', bidsResponse);
        if (bidsResponse.success && bidsResponse.data?.bids) {
          setMyBids(bidsResponse.data.bids);
        } else {
          console.error('💰 Failed to fetch bids:', bidsResponse.error);
          setMyBids([]);
        }
        setLoading(false);
        return;
      }
      
      // Reset bids when not in bids view
      setMyBids([]);

      // Build filter params for other view modes
      const filterParams: any = {};
      
      if (viewMode === 'assigned') {
        console.log('📋 Fetching assigned cases for user:', user?.id);
        filterParams.providerId = user?.id;
        if (statusFilter) {
          filterParams.status = statusFilter;
        }
      } else if (viewMode === 'declined') {
        console.log('❌ Fetching declined cases for user:', user?.id);
        filterParams.providerId = user?.id;
        filterParams.status = 'declined';
      } else {
        console.log('🆕 Fetching available cases');
        filterParams.status = 'pending';
        filterParams.onlyUnassigned = 'true';
        filterParams.excludeDeclinedBy = user.id;
      }

      console.log('📋 CasesScreen - Filter params:', filterParams);
      const response = await ApiService.getInstance().getCasesWithFilters(filterParams);
      console.log('📋 CasesScreen - API response:', response);
      console.log('📋 CasesScreen - Response.data:', response.data);
      
      if (response.success && response.data) {
        const cases = response.data.cases || [];
        console.log('📋 CasesScreen - Cases found:', cases.length);
        console.log('📋 CasesScreen - First case:', cases[0]);
        
        cases.forEach((c: any, idx: number) => {
          console.log(`📋 Case ${idx + 1}: id=${c.id}, status="${c.status}", viewMode=${viewMode}`);
        });
        
        setCases(cases);
      } else {
        console.error('📋 CasesScreen - Failed to fetch cases:', response.error);
        Alert.alert('Грешка', response.error?.message || 'Не успяхме да заредим заявките');
        setCases([]);
      }
    } catch (error) {
      console.error('📋 CasesScreen - Error fetching cases:', error);
      Alert.alert('Грешка', 'Не успяхме да заредим заявките');
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!user) return;

    try {
      const response = await ApiService.getInstance().getCaseStats(user.id);
      console.log('📊 CasesScreen - Stats response:', response);
      if (response.success && response.data) {
        // Backend returns { success: true, data: { total, pending, accepted, ... } }
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    await fetchStats();
    setRefreshing(false);
  };

  const handleAcceptCase = async (caseId: string) => {
    if (!user) return;

    Alert.alert(
      'Приемане на заявка',
      'Сигурни ли сте, че искате да приемете тази заявка?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Приеми',
          onPress: async () => {
            try {
              const response = await ApiService.getInstance().acceptCase(
                caseId,
                user.id,
                `${user.firstName} ${user.lastName}`
              );
              
              if (response.success) {
                Alert.alert('Успех', 'Заявката беше приета успешно!');
                await fetchCases();
                await fetchStats();
              } else {
                // Check if trial expired
                if (response.error?.code === 'TRIAL_EXPIRED') {
                  const details = response.error?.details || {};
                  const message = `${response.error?.message}\n\n${details.reason || ''}`;
                  
                  Alert.alert(
                    'Безплатният период изтече',
                    message,
                    [
                      { text: 'По-късно', style: 'cancel' },
                      {
                        text: 'Надстрой сега',
                        onPress: () => {
                          navigation.navigate('Subscription');
                        }
                      }
                    ]
                  );
                } else {
                  Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
                }
              }
            } catch (error) {
              console.error('Error accepting case:', error);
              Alert.alert('Грешка', 'Не успяхме да приемем заявката');
            }
          },
        },
      ]
    );
  };

  const handleDeclineCase = async (caseId: string) => {
    if (!user) return;

    Alert.alert(
      'Отказване на заявка',
      'Сигурни ли сте, че искате да откажете тази заявка?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Откажи',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await ApiService.getInstance().declineCase(
                caseId,
                user.id,
                'Declined by provider'
              );
              
              if (response.success) {
                Alert.alert('Успех', 'Заявката беше отказана');
                await fetchCases();
                await fetchStats();
              } else {
                Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
              }
            } catch (error) {
              console.error('Error declining case:', error);
              Alert.alert('Грешка', 'Не успяхме да откажем заявката');
            }
          },
        },
      ]
    );
  };

  const handleCompleteCase = async (caseId: string) => {
    if (!user) return;

    // Find the case to get its title
    const caseToComplete = cases.find(c => c.id === caseId);
    if (!caseToComplete) return;

    // Open the income completion modal
    setCompletionModal({
      visible: true,
      caseId: caseId,
      caseTitle: caseToComplete.description || caseToComplete.service_type,
    });
  };

  const handleModalComplete = async (data: {
    completionNotes: string;
    income?: {
      amount: number;
      paymentMethod?: string;
      notes?: string;
    };
  }) => {
    try {
      const response = await ApiService.getInstance().completeCase(
        completionModal.caseId,
        data.completionNotes,
        data.income
      );

      if (response.success) {
        Alert.alert('Успех', 'Заявката беше завършена успешно!');
        setCompletionModal({ visible: false, caseId: '', caseTitle: '' });

        // Refresh data
        setTimeout(() => {
          fetchCases();
          fetchStats();
        }, 500);
      } else {
        Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
      }
    } catch (error) {
      console.error('Error completing case:', error);
      Alert.alert('Грешка', 'Не успяхме да завършим заявката');
    }
  };

  const handleUndeclineCase = async (caseId: string) => {
    if (!user) return;

    try {
      const response = await ApiService.getInstance().undeclineCase(caseId, user.id);
      
      if (response.success) {
        Alert.alert('Успех', 'Заявката беше възстановена!');
        await fetchCases();
        await fetchStats();
      } else {
        Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
      }
    } catch (error) {
      console.error('Error un-declining case:', error);
      Alert.alert('Грешка', 'Не успяхме да възстановим заявката');
    }
  };

  const toggleCaseExpansion = (caseId: string) => {
    setExpandedCases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(caseId)) {
        newSet.delete(caseId);
      } else {
        newSet.add(caseId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      pending: { label: '🟡 Чакаща', color: '#fbbf24' }, // amber-400 - logical for pending/waiting
      accepted: { label: '🟢 Приета', color: '#4ade80' }, // green-400 - success
      wip: { label: '⚡ В процес', color: '#60a5fa' }, // blue-400 - in progress
      completed: { label: '🏁 Завършена', color: '#64748b' }, // slate-500 - neutral/done
      declined: { label: '❌ Отказана', color: '#f87171' }, // red-400 - error/declined
    };

    const config = statusConfig[status] || { label: status, color: theme.colors.gray[500] };
    
    return (
      <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
        <Text style={styles.statusBadgeText}>{config.label}</Text>
      </View>
    );
  };

  const getAssignmentBadge = (caseItem: Case) => {
    // Only show badges in "Available" tab
    if (viewMode !== 'available') {
      return null;
    }

    // Debug logging
    console.log('📋 Case assignment check:', {
      caseId: caseItem.id,
      assignment_type: caseItem.assignment_type,
      provider_id: caseItem.provider_id,
      provider_name: caseItem.provider_name,
      user_id: user?.id
    });

    // In "Налични" tab, we only see unassigned cases (provider_id = null)
    // But we need to distinguish between:
    // 1. Cases created for a specific provider (assignment_type='specific') - show "Директна заявка"
    // 2. Cases open for all providers (assignment_type='open' or null) - show "Отворена заявка"
    
    const assignmentType = caseItem.assignment_type;
    const hasProviderId = !!caseItem.provider_id;
    
    console.log('📋 Badge decision:', {
      assignmentType,
      hasProviderId,
      provider_id: caseItem.provider_id,
      provider_name: caseItem.provider_name
    });

    // If case has assignment_type='specific', it's a direct request
    if (assignmentType === 'specific') {
      return (
        <View style={[styles.assignmentBadge, styles.directAssignmentBadge]}>
          <Text style={styles.assignmentBadgeText}>👤 Директна заявка</Text>
        </View>
      );
    } 
    // Otherwise it's an open case
    else {
      return (
        <View style={[styles.assignmentBadge, styles.openAssignmentBadge]}>
          <Text style={styles.assignmentBadgeText}>👥 Публична заявка</Text>
        </View>
      );
    }
  };

  const getCategoryDisplayName = (category: string) => {
    const found = SERVICE_CATEGORIES.find(cat => cat.value === category);
    return found ? found.label : category;
  };

  const getCategoryIcon = (category: string) => {
    const iconMap: { [key: string]: string } = {
      'electrician': '⚡',
      'plumber': '🚰',
      'hvac': '❄️',
      'carpenter': '🔨',
      'painter': '🎨',
      'locksmith': '🔑',
      'cleaner': '✨',
      'gardener': '🌱',
      'handyman': '🔧',
      'roofer': '🏠',
      'moving': '🚚',
      'tiler': '🧱',
      'welder': '🔥',
      'design': '🎭'
    };
    return iconMap[category] || '🔧';
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
        <Text style={styles.headerTitle}>Заявки</Text>
      </View>

      {/* Points Balance Widget */}
      <View style={styles.pointsWidgetContainer}>
        <PointsBalanceWidget 
          onPress={() => navigation.navigate('Points' as never)}
          compact={false}
        />
      </View>

      {/* Stats Cards */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.primaryCard]}>
              <Text style={styles.statNumber}>{stats.total || 0}</Text>
              <Text style={styles.statLabel}>Общо</Text>
            </View>
            <View style={[styles.statCard, styles.warningCard]}>
              <Text style={styles.statNumber}>{stats.pending || 0}</Text>
              <Text style={styles.statLabel}>Чакащи</Text>
            </View>
            <View style={[styles.statCard, styles.successCard]}>
              <Text style={styles.statNumber}>{stats.accepted || 0}</Text>
              <Text style={styles.statLabel}>Приети</Text>
            </View>
          </View>
        </View>
      )}

      {/* View Mode Tabs - Compact Single Row */}
      <View style={styles.tabsWrapper}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'available' && styles.activeTab]}
          onPress={() => setViewMode('available')}
        >
          <Text style={styles.tabIcon}>🆕</Text>
          <Text style={[styles.tabText, viewMode === 'available' && styles.activeTabText]}>
            Налични
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'assigned' && styles.activeTab]}
          onPress={() => setViewMode('assigned')}
        >
          <Text style={styles.tabIcon}>✅</Text>
          <Text style={[styles.tabText, viewMode === 'assigned' && styles.activeTabText]}>
            Моите
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'bids' && styles.activeTab]}
          onPress={() => setViewMode('bids')}
        >
          <Text style={styles.tabIcon}>💰</Text>
          <Text style={[styles.tabText, viewMode === 'bids' && styles.activeTabText]}>
            Оферти
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'declined' && styles.activeTab]}
          onPress={() => setViewMode('declined')}
        >
          <Text style={styles.tabIcon}>❌</Text>
          <Text style={[styles.tabText, viewMode === 'declined' && styles.activeTabText]}>
            Отказани
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter - Only show in "Моите" (assigned) tab */}
      {viewMode === 'assigned' && (
        <ScrollView horizontal style={styles.filterContainer} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === '' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('')}
          >
            <Text style={[styles.filterChipText, statusFilter === '' && styles.activeFilterChipText]}>
              Всички
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'pending' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('pending')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'pending' && styles.activeFilterChipText]}>
              Чакащи
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'wip' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('wip')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'wip' && styles.activeFilterChipText]}>
              В процес
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, statusFilter === 'completed' && styles.activeFilterChip]}
            onPress={() => setStatusFilter('completed')}
          >
            <Text style={[styles.filterChipText, statusFilter === 'completed' && styles.activeFilterChipText]}>
              Завършени
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Cases List */}
      <ScrollView
        style={styles.casesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {viewMode === 'bids' ? (
          myBids.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>💰</Text>
              <Text style={styles.emptyStateText}>Няма кандидатури</Text>
              <Text style={styles.emptyStateSubtext}>
                Все още не сте подали кандидатури за заявки
              </Text>
            </View>
          ) : (
            myBids.map((bid: any) => (
              <View key={bid.id} style={styles.caseCard}>
                <View style={styles.caseHeader}>
                  <Text style={styles.caseTitle}>{bid.description || bid.service_type || 'Заявка'}</Text>
                  <View style={[
                    styles.statusBadge,
                    bid.bid_status === 'pending' && styles.pendingBadge,
                    bid.bid_status === 'won' && styles.wonBadge,
                    bid.bid_status === 'lost' && styles.lostBadge,
                  ]}>
                    <Text style={styles.statusBadgeText}>
                      {bid.bid_status === 'pending' ? '⏳ Чакаща' :
                       bid.bid_status === 'won' ? '✅ Спечелена' :
                       bid.bid_status === 'lost' ? '❌ Загубена' : bid.bid_status}
                    </Text>
                  </View>
                </View>
                <View style={styles.caseDetails}>
                  <Text style={styles.detailText}>💰 Предложена цена: {bid.proposed_budget_range} лв</Text>
                  {bid.city && (
                    <Text style={styles.detailText}>📍 Град: {bid.city}</Text>
                  )}
                  {bid.budget && (
                    <Text style={styles.detailText}>💵 Бюджет на клиента: {bid.budget} лв</Text>
                  )}
                  {bid.bid_comment && (
                    <Text style={styles.detailText}>💬 Коментар: {bid.bid_comment}</Text>
                  )}
                  {bid.case_status && (
                    <Text style={styles.detailText}>📋 Статус на заявката: {
                      bid.case_status === 'pending' ? 'Чакаща' :
                      bid.case_status === 'accepted' ? 'Приета' :
                      bid.case_status === 'completed' ? 'Завършена' : bid.case_status
                    }</Text>
                  )}
                </View>
              </View>
            ))
          )
        ) : cases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📋</Text>
            <Text style={styles.emptyStateText}>Няма заявки</Text>
            <Text style={styles.emptyStateSubtext}>
              {viewMode === 'available' && 'Няма налични заявки в момента'}
              {viewMode === 'assigned' && 'Нямате приети заявки'}
              {viewMode === 'declined' && 'Нямате отказани заявки'}
            </Text>
          </View>
        ) : (
          cases.map((caseItem) => {
            const isExpanded = expandedCases.has(caseItem.id);
            
            // Debug logging for button visibility
            console.log('📋 Case render:', {
              id: caseItem.id,
              status: caseItem.status,
              viewMode: viewMode,
              shouldShowButtons: viewMode === 'available' && caseItem.status === 'pending'
            });
            
            return (
              <View key={caseItem.id} style={styles.caseCard}>
                <TouchableOpacity onPress={() => toggleCaseExpansion(caseItem.id)}>
                  {/* Compact Header with Icon */}
                  <View style={styles.compactHeader}>
                    <View style={styles.categoryIconContainer}>
                      <Text style={styles.categoryIcon}>{getCategoryIcon(caseItem.category)}</Text>
                    </View>
                    <View style={styles.headerContent}>
                      <View style={styles.headerTopRow}>
                        {viewMode !== 'available' && getStatusBadge(caseItem.status)}
                        {getAssignmentBadge(caseItem)}
                      </View>
                      <Text style={styles.compactDescription} numberOfLines={2}>
                        {caseItem.description}
                      </Text>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                  
                  {/* Key Info Row - Always Visible */}
                  <View style={styles.keyInfoRow}>
                    {caseItem.budget && (
                      <View style={styles.keyInfoItem}>
                        <Text style={styles.keyInfoLabel}>💰 Бюджет:</Text>
                        <Text style={styles.keyInfoValue}>{caseItem.budget} BGN</Text>
                      </View>
                    )}
                    {caseItem.bidding_enabled && (
                      <View style={styles.keyInfoItem}>
                        <Text style={styles.keyInfoLabel}>👥 Оферти:</Text>
                        <Text style={styles.keyInfoValue}>
                          {caseItem.current_bidders || 0}/{caseItem.max_bidders || 3}
                        </Text>
                      </View>
                    )}
                    {caseItem.city && (
                      <View style={styles.keyInfoItem}>
                        <Text style={styles.keyInfoLabel}>📍</Text>
                        <Text style={styles.keyInfoValue}>{caseItem.city}</Text>
                      </View>
                    )}
                  </View>
                  
                  {isExpanded && (
                    <View style={styles.caseDetails}>
                      {caseItem.address && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>📍 Адрес:</Text>
                          <Text style={styles.detailValue}>{caseItem.address}</Text>
                        </View>
                      )}
                      {caseItem.phone && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>📞 Телефон:</Text>
                          <View style={{flex: 1}}>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: (caseItem as any).phone_masked ? 8 : 0}}>
                              <Text style={[styles.detailValue, (caseItem as any).phone_masked && {color: '#94a3b8'}]}>
                                {caseItem.phone}
                              </Text>
                              {(caseItem as any).phone_masked && (
                                <View style={{backgroundColor: 'rgba(251, 191, 36, 0.1)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4}}>
                                  <Text style={{fontSize: 10, color: '#fbbf24'}}>
                                    🔒 Скрит
                                  </Text>
                                </View>
                              )}
                            </View>
                            {(caseItem as any).phone_masked && (
                              <View style={{backgroundColor: 'rgba(59, 130, 246, 0.1)', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(96, 165, 250, 0.2)'}}>
                                <Text style={{fontSize: 11, color: '#93c5fd'}}>
                                  💡 <Text style={{fontWeight: '600'}}>Спечелете наддаването</Text>, за да получите достъп до телефонния номер
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      )}
                      {caseItem.preferred_date && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>📅 Дата:</Text>
                          <Text style={styles.detailValue}>
                            {new Date(caseItem.preferred_date).toLocaleDateString('bg-BG')}
                            {caseItem.preferred_time && ` в ${caseItem.preferred_time}`}
                          </Text>
                        </View>
                      )}
                      {caseItem.square_meters && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>📏 Площ:</Text>
                          <Text style={styles.detailValue}>{caseItem.square_meters} кв.м</Text>
                        </View>
                      )}
                      {caseItem.priority && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>⚡ Приоритет:</Text>
                          <Text style={styles.detailValue}>{caseItem.priority}</Text>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>

                {/* Action Buttons - Always visible */}
                <View style={styles.actionButtons}>
                  {/* Debug: Show what we're checking */}
                  {__DEV__ && (
                    <Text style={{ fontSize: 10, color: 'red', marginBottom: 4 }}>
                      viewMode={viewMode}, status={caseItem.status}, bidding={caseItem.bidding_enabled ? 'YES' : 'NO'}
                    </Text>
                  )}
                  
                  {/* Available tab: Show Bid button OR Accept/Decline */}
                  {viewMode === 'available' && caseItem.status === 'pending' && (
                    <>
                      {caseItem.bidding_enabled && caseItem.budget ? (
                        <BidButton
                          caseId={caseItem.id}
                          budget={String(caseItem.budget)}
                          currentBidders={caseItem.current_bidders}
                          maxBidders={caseItem.max_bidders}
                          onBidPlaced={() => {
                            fetchCases();
                            fetchStats();
                          }}
                        />
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.acceptButton]}
                            onPress={() => {
                              console.log('✅ Accept button pressed for case:', caseItem.id, 'status:', caseItem.status);
                              handleAcceptCase(caseItem.id);
                            }}
                          >
                            <Text style={styles.actionButtonText}>✅ Приеми</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.actionButton, styles.declineButton]}
                            onPress={() => {
                              console.log('❌ Decline button pressed for case:', caseItem.id, 'status:', caseItem.status);
                              handleDeclineCase(caseItem.id);
                            }}
                          >
                            <Text style={styles.actionButtonText}>❌ Откажи</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </>
                  )}
                  
                  {/* Assigned tab: Show Complete button for accepted cases OR pending cases with bidding */}
                  {viewMode === 'assigned' && 
                   (caseItem.status === 'accepted' || 
                    caseItem.status === 'wip' ||
                    (caseItem.status === 'pending' && caseItem.bidding_enabled)) && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => {
                        handleCompleteCase(caseItem.id);
                      }}
                    >
                      <Text style={styles.actionButtonText}>🏁 Завърши</Text>
                    </TouchableOpacity>
                  )}
                  
                  {/* Declined tab: Show Restore button */}
                  {viewMode === 'declined' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.undeclineButton]}
                      onPress={() => {
                        console.log('↩️ Undecline button pressed for case:', caseItem.id);
                        handleUndeclineCase(caseItem.id);
                      }}
                    >
                      <Text style={styles.actionButtonText}>↩️ Възстанови</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Income Completion Modal */}
      <IncomeCompletionModal
        visible={completionModal.visible}
        caseTitle={completionModal.caseTitle}
        onClose={() => setCompletionModal({ visible: false, caseId: '', caseTitle: '' })}
        onComplete={handleModalComplete}
      />
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
    backgroundColor: '#1e293b', // slate-800
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.3)', // indigo-500/30
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: '#cbd5e1', // slate-300
  },
  pointsWidgetContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  statsContainer: {
    padding: theme.spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  primaryCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // indigo-500/15
  },
  warningCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#c084fc', // purple-400
    backgroundColor: 'rgba(168, 85, 247, 0.15)', // purple-500/15
  },
  successCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#4ade80', // green-400
    backgroundColor: 'rgba(34, 197, 94, 0.15)', // green-500/15
  },
  statNumber: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: '#cbd5e1', // slate-300
  },
  statLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginTop: theme.spacing.xs,
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#1e293b', // slate-800
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  tabsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1e293b', // slate-800
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    gap: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: 2,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#6366f1', // indigo-500
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#a5b4fc', // indigo-300
    fontWeight: theme.fontWeight.bold,
  },
  filterContainer: {
    backgroundColor: '#1e293b', // slate-800
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: 'rgba(30, 41, 59, 0.7)', // slate-800/70
    marginRight: theme.spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  activeFilterChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)', // indigo-500/30
    borderColor: '#6366f1', // indigo-500
  },
  filterChipText: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  activeFilterChipText: {
    color: '#a5b4fc', // indigo-300
  },
  casesList: {
    flex: 1,
    padding: theme.spacing.md,
    paddingBottom: 80, // Extra padding for bottom tab bar
  },
  caseCard: {
    backgroundColor: '#1e293b', // slate-800
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  compactHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.3)', // indigo-400/30
  },
  categoryIcon: {
    fontSize: 28,
  },
  headerContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  headerTopRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  compactDescription: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#cbd5e1', // slate-300
    lineHeight: 20,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  caseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  caseCategory: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
  keyInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    marginBottom: theme.spacing.xs,
  },
  keyInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  keyInfoLabel: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  keyInfoValue: {
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
    fontWeight: theme.fontWeight.semibold,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusBadgeText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.inverse,
    fontWeight: theme.fontWeight.semibold,
  },
  expandIcon: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
  },
  caseDescription: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
  caseDetails: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: theme.colors.success.solid,
  },
  declineButton: {
    backgroundColor: theme.colors.danger.solid,
  },
  completeButton: {
    backgroundColor: theme.colors.primary.solid,
  },
  undeclineButton: {
    backgroundColor: theme.colors.status.info,
  },
  actionButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
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
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
  },
  assignmentBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  directAssignmentBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500/20
    borderWidth: 1,
    borderColor: '#60a5fa', // blue-400
  },
  openAssignmentBadge: {
    backgroundColor: 'rgba(168, 85, 247, 0.2)', // purple-500/20
    borderWidth: 1,
    borderColor: '#c084fc', // purple-400
  },
  assignmentBadgeText: {
    fontSize: 10,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
  },
  budgetContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  budgetLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  budgetValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.success.solid,
    fontWeight: theme.fontWeight.semibold,
  },
  biddingInfo: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginLeft: 'auto',
  },
  tabsScrollContainer: {
    maxHeight: 60,
  },
  caseTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.sm,
  },
  detailText: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.xs,
  },
  pendingBadge: {
    backgroundColor: 'rgba(251, 191, 36, 0.2)', // amber-400/20
    borderColor: '#fbbf24', // amber-400
  },
  wonBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500/20
    borderColor: '#4ade80', // green-400
  },
  lostBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)', // red-500/20
    borderColor: '#f87171', // red-400
  },
});
