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
  const [viewMode, setViewMode] = useState<'available' | 'assigned' | 'declined'>('available');
  const [statusFilter, setStatusFilter] = useState<string>('');

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
      let filterParams: any = {
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      };

      console.log('📋 CasesScreen - Fetching cases for viewMode:', viewMode);
      console.log('📋 CasesScreen - User ID:', user.id);

      if (viewMode === 'assigned') {
        // Show cases assigned to this provider
        filterParams.providerId = user.id;
        console.log('📋 CasesScreen - Filtering by providerId:', user.id);
      } else if (viewMode === 'declined') {
        // Show cases declined by this provider
        console.log('📋 CasesScreen - Fetching declined cases');
        const response = await ApiService.getInstance().getDeclinedCases(user.id);
        console.log('📋 CasesScreen - Declined cases response:', response);
        if (response.success && response.data) {
          setCases(response.data.data || []);
        } else {
          console.error('📋 CasesScreen - Failed to fetch declined cases:', response.error);
          setCases([]);
        }
        return;
      } else {
        // Available cases - show ALL unassigned cases, excluding ones this provider declined
        filterParams.onlyUnassigned = 'true';
        filterParams.excludeDeclinedBy = user.id;
        console.log('📋 CasesScreen - Fetching available cases (unassigned, excluding declined)');
      }

      console.log('📋 CasesScreen - Filter params:', filterParams);
      const response = await ApiService.getInstance().getCasesWithFilters(filterParams);
      console.log('📋 CasesScreen - API response:', response);
      console.log('📋 CasesScreen - Response.data:', response.data);
      
      if (response.success && response.data) {
        // Backend returns { success: true, data: { cases: [...], pagination: {...} } }
        const cases = response.data.cases || [];
        console.log('📋 CasesScreen - Cases found:', cases.length);
        console.log('📋 CasesScreen - First case:', cases[0]);
        
        // Debug: Log ALL case statuses
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
      pending: { label: '🟡 Чакаща', color: theme.colors.warning.solid },
      accepted: { label: '🟢 Приета', color: theme.colors.success.solid },
      wip: { label: '⚡ В процес', color: theme.colors.status.info },
      completed: { label: '🏁 Завършена', color: theme.colors.gray[600] },
      declined: { label: '❌ Отказана', color: theme.colors.danger.solid },
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
          <Text style={styles.assignmentBadgeText}>🌐 Отворена заявка</Text>
        </View>
      );
    }
  };

  const getCategoryDisplayName = (category: string) => {
    const categoryNames: { [key: string]: string } = {
      'electrician': 'Електричество',
      'plumber': 'Водопровод',
      'hvac': 'Климатик',
      'carpenter': 'Дърводелство',
      'painter': 'Боядисване',
      'locksmith': 'Ключарство',
      'cleaner': 'Почистване',
      'gardener': 'Градинарство',
      'handyman': 'Многопрофилен',
      'appliance_repair': 'Ремонти',
      'general': 'Общи'
    };
    return categoryNames[category] || category;
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

      {/* View Mode Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'available' && styles.activeTab]}
          onPress={() => setViewMode('available')}
        >
          <Text style={[styles.tabText, viewMode === 'available' && styles.activeTabText]}>
            Налични
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'assigned' && styles.activeTab]}
          onPress={() => setViewMode('assigned')}
        >
          <Text style={[styles.tabText, viewMode === 'assigned' && styles.activeTabText]}>
            Моите
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, viewMode === 'declined' && styles.activeTab]}
          onPress={() => setViewMode('declined')}
        >
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
        {cases.length === 0 ? (
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
                  <View style={styles.caseHeader}>
                    <View style={styles.caseHeaderLeft}>
                      <Text style={styles.caseCategory}>
                        {getCategoryDisplayName(caseItem.category)}
                      </Text>
                      {getStatusBadge(caseItem.status)}
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                  
                  {/* Assignment Type Badge */}
                  {getAssignmentBadge(caseItem)}
                  
                  <Text style={styles.caseDescription} numberOfLines={isExpanded ? undefined : 2}>
                    {caseItem.description}
                  </Text>
                  
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
                          <Text style={styles.detailValue}>{caseItem.phone}</Text>
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
                      viewMode={viewMode}, status={caseItem.status}, assignType={caseItem.assignment_type}
                    </Text>
                  )}
                  
                  {/* Available tab: Show Accept/Decline for pending cases */}
                  {viewMode === 'available' && caseItem.status === 'pending' && (
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
                  
                  {/* Assigned tab: Show Complete button for accepted/wip cases */}
                  {viewMode === 'assigned' && (caseItem.status === 'accepted' || caseItem.status === 'wip') && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => {
                        console.log('🏁 Complete button pressed for case:', caseItem.id, 'status:', caseItem.status);
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
    backgroundColor: theme.colors.primary.solid,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text.inverse,
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
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    ...theme.shadows.md,
  },
  primaryCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary.solid,
  },
  warningCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.warning.solid,
  },
  successCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success.solid,
  },
  statNumber: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text.primary,
  },
  statLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    ...theme.shadows.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: theme.colors.primary.solid,
  },
  tabText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeight.medium,
  },
  activeTabText: {
    color: theme.colors.primary.solid,
    fontWeight: theme.fontWeight.semibold,
  },
  filterContainer: {
    backgroundColor: theme.colors.background.secondary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    maxHeight: 60,
  },
  filterChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
    marginRight: theme.spacing.sm,
  },
  activeFilterChip: {
    backgroundColor: theme.colors.primary.solid,
  },
  filterChipText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeight.medium,
  },
  activeFilterChipText: {
    color: theme.colors.text.inverse,
  },
  casesList: {
    flex: 1,
    padding: theme.spacing.md,
    paddingBottom: 80, // Extra padding for bottom tab bar
  },
  caseCard: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.md,
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
    color: theme.colors.text.tertiary,
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
    borderTopColor: theme.colors.border.light,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  detailLabel: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.fontWeight.medium,
    width: 100,
  },
  detailValue: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.primary,
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
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtext: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  assignmentBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  directAssignmentBadge: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  openAssignmentBadge: {
    backgroundColor: '#F3E5F5',
    borderWidth: 1,
    borderColor: '#9C27B0',
  },
  assignmentBadgeText: {
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
    color: theme.colors.text.primary,
  },
});
