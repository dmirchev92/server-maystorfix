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
  Linking,
  Platform,
  Image,
  Modal,
  TextInput,
} from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';
import IncomeCompletionModal from '../components/IncomeCompletionModal';
import BidButton from '../components/BidButton';
import PointsBalanceWidget from '../components/PointsBalanceWidget';
import { SERVICE_CATEGORIES, CATEGORY_LABELS } from '../constants/serviceCategories';
import CategoryIcon from '../components/CategoryIcon';

interface Case {
  id: string;
  case_number?: number;
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
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  screenshots?: Array<{ id?: string; url: string; createdAt?: string }>;
  // Direct assignment negotiation fields
  negotiation_status?: string;
  assigned_sp_id?: string;
  customer_budget?: string;
  sp_counter_budget?: string;
  counter_message?: string;
  // Winning bid info (for assigned cases) - from backend JOIN with sp_case_bids
  winning_bid_price?: string;
  winning_provider_id?: string;
}

interface CaseStats {
  total: number;
  pending: number;
  accepted: number;
  wip: number;
  completed: number;
  declined: number;
}

// Helper function to clean formatted address (remove postal code, city, country suffix)
const cleanFormattedAddress = (address: string | undefined, city?: string): string => {
  if (!address) return '';
  
  // Common patterns to remove from the end of Bulgarian addresses:
  // - Postal codes (4 digits)
  // - City names (София, Пловдив, etc.)
  // - Country (България)
  // Example: "Ж.К Илинден, ул конжовица 65, 1309 София, България" -> "Ж.К Илинден, ул конжовица 65"
  
  let cleaned = address;
  
  // Remove ", България" or "България" at the end
  cleaned = cleaned.replace(/,?\s*България\s*$/i, '');
  
  // Remove city name at the end if it matches the case's city
  if (city) {
    const cityPattern = new RegExp(`,?\\s*${city}\\s*$`, 'i');
    cleaned = cleaned.replace(cityPattern, '');
  }
  
  // Remove common city names at the end
  cleaned = cleaned.replace(/,?\s*(София|Пловдив|Варна|Бургас|Русе|Стара Загора|Плевен|Сливен|Добрич|Шумен)\s*$/i, '');
  
  // Remove postal code (4 digits) at the end or before city
  cleaned = cleaned.replace(/,?\s*\d{4}\s*$/g, '');
  cleaned = cleaned.replace(/,?\s*\d{4}\s*,/g, ',');
  
  // Clean up any trailing commas or extra spaces
  cleaned = cleaned.replace(/,\s*$/, '').trim();
  
  return cleaned;
};

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
  
  // Tracking state
  const [isTracking, setIsTracking] = useState(false);
  const [trackingCaseId, setTrackingCaseId] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  // Filters
  const [viewMode, setViewMode] = useState<'available' | 'assigned' | 'declined' | 'bids' | 'reviews'>('available');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [myBids, setMyBids] = useState<any[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Case[]>([]);
  const [reviewActionLoading, setReviewActionLoading] = useState<string | null>(null);
  
  // Advanced filters - category supports multiple selection
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [budgetFilter, setBudgetFilter] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showBudgetDropdown, setShowBudgetDropdown] = useState(false);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  
  const toggleCategory = (value: string) => {
    setSelectedCategories(prev => 
      prev.includes(value) 
        ? prev.filter(c => c !== value)
        : [...prev, value]
    );
  };
  
  // Get unique cities from current cases
  const getAvailableCities = () => {
    const cities = cases
      .map(c => c.city)
      .filter((city): city is string => !!city && city.trim() !== '');
    return [...new Set(cities)].sort();
  };
  
  // Budget ranges from database
  const BUDGET_RANGES = [
    { value: '', label: 'Всички' },
    { value: '1-250', label: 'До 250 лв' },
    { value: '250-500', label: '250 - 500 лв' },
    { value: '500-750', label: '500 - 750 лв' },
    { value: '750-1000', label: '750 - 1000 лв' },
    { value: '1000-1500', label: '1000 - 1500 лв' },
    { value: '1500-2000', label: '1500 - 2000 лв' },
    { value: '4000-5000', label: '4000 - 5000 лв' },
  ];

  useEffect(() => {
    loadUserAndCases();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchCases();
        fetchStats();
        fetchPendingReviews();
      }
    }, [user, viewMode])
  );
  
  // Refetch when statusFilter changes (separate from focus effect)
  useEffect(() => {
    if (user && viewMode === 'assigned') {
      fetchCases();
    }
  }, [statusFilter]);

  const fetchPendingReviews = async () => {
    if (!user?.id) return;
    try {
      const response = await ApiService.getInstance().getCasesWithFilters({
        assignedSpId: user.id,
        negotiationStatus: 'pending_sp_review',
      });
      if (response.success && response.data?.cases) {
        setPendingReviews(response.data.cases);
      }
    } catch (error) {
      console.error('Error fetching pending reviews:', error);
    }
  };

  const handleReviewResponse = async (caseId: string, action: 'accept' | 'decline' | 'counter', counterBudget?: string, message?: string) => {
    setReviewActionLoading(caseId);
    try {
      const response = await ApiService.getInstance().spRespondToDirectAssignment(caseId, action, counterBudget, message);
      
      if (response.success) {
        const messages: Record<string, string> = {
          accept: 'Заявката е приета! Точките са удържани.',
          decline: 'Заявката е отказана.',
          counter: 'Офертата е изпратена към клиента.',
        };
        Alert.alert('Успех', messages[action]);
        fetchPendingReviews();
        fetchCases();
        fetchStats();
      } else {
        Alert.alert('Грешка', response.error?.message || 'Възникна грешка');
      }
    } catch (error: any) {
      Alert.alert('Грешка', error.message || 'Възникна грешка');
    } finally {
      setReviewActionLoading(null);
    }
  };

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
          // 'wip' filter should include both 'accepted' and 'wip' statuses (both are "in progress")
          if (statusFilter === 'wip') {
            filterParams.status = 'accepted,wip';
          } else {
            filterParams.status = statusFilter;
          }
        }
      } else if (viewMode === 'declined') {
        console.log('❌ Fetching declined cases for user:', user?.id);
        // Use dedicated endpoint for declined cases
        const declinedResponse = await ApiService.getInstance().getDeclinedCases(user.id);
        console.log('❌ Declined cases response:', declinedResponse);
        if (declinedResponse.success && declinedResponse.data) {
          setCases(declinedResponse.data);
        } else {
          setCases([]);
        }
        setLoading(false);
        return;
      } else {
        console.log('🆕 Fetching available cases');
        filterParams.status = 'pending';
        filterParams.onlyUnassigned = 'true';
        filterParams.excludeDeclinedBy = user.id;
        filterParams.excludeBiddedBy = user.id;  // Exclude cases already bid on
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

  const openMap = (lat: number, lng: number, label: string) => {
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${latLng}(${label})`
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const startTracking = async (caseId: string) => {
    if (isTracking) {
      // Stop tracking
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
        setWatchId(null);
      }
      setIsTracking(false);
      setTrackingCaseId(null);
      Alert.alert('Проследяване спряно', 'Вече не споделяте локацията си с клиента.');
      return;
    }

    // Start tracking
    Alert.alert(
      'Споделяне на локация',
      'Ще започнем да споделяме вашата локация с клиента, докато пътувате към адреса. Съгласни ли сте?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Да, тръгвам',
          onPress: () => {
            const id = Geolocation.watchPosition(
              (position) => {
                const { latitude, longitude, heading, speed } = position.coords;
                console.log('📍 New location:', latitude, longitude);
                ApiService.getInstance().updateLocation({
                  caseId,
                  latitude,
                  longitude,
                  heading: heading || 0,
                  speed: speed || 0
                });
              },
              (error) => {
                console.error('Geolocation error:', error);
              },
              { enableHighAccuracy: true, distanceFilter: 10, interval: 10000, fastestInterval: 5000 }
            );
            setWatchId(id);
            setIsTracking(true);
            setTrackingCaseId(caseId);
            Alert.alert('Приятен път!', 'Клиентът вече вижда къде се намирате.');
          }
        }
      ]
    );
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
    // Otherwise it's an open case - no badge needed (obvious from tab)
    else {
      return null;
    }
  };

  const getCategoryDisplayName = (category: string) => {
    const found = SERVICE_CATEGORIES.find(cat => cat.value === category);
    return found ? found.label : category;
  };

  // CategoryIcon component is imported from components/CategoryIcon

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.solid} />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  // Filter cases based on category, budget and city
  const getFilteredCases = () => {
    let filtered = cases;
    
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(c => 
        selectedCategories.includes(c.category) || selectedCategories.includes(c.service_type)
      );
    }
    if (budgetFilter) {
      filtered = filtered.filter(c => String(c.budget) === budgetFilter);
    }
    if (cityFilter) {
      filtered = filtered.filter(c => c.city === cityFilter);
    }
    
    return filtered;
  };
  
  const getCategoryLabel = () => {
    if (selectedCategories.length === 0) return 'Категория';
    if (selectedCategories.length === 1) {
      const cat = SERVICE_CATEGORIES.find(c => c.value === selectedCategories[0]);
      return cat ? cat.label : 'Категория';
    }
    return `${selectedCategories.length} избрани`;
  };
  
  const getBudgetLabel = () => {
    if (!budgetFilter) return 'Бюджет';
    const range = BUDGET_RANGES.find(r => r.value === budgetFilter);
    return range ? range.label : 'Бюджет';
  };
  
  const getCityLabel = () => {
    if (!cityFilter) return 'Град';
    return cityFilter;
  };

  return (
    <View style={styles.container}>
      {/* Header - Centered Title */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Заявки</Text>
      </View>
      
      {/* View Mode Tabs - Compact Single Row */}
      <View style={styles.tabsWrapper}>
        {/* Pending Reviews Tab - Only show if there are pending reviews */}
        {pendingReviews.length > 0 && (
          <TouchableOpacity
            style={[styles.tab, viewMode === 'reviews' && styles.activeTab, styles.reviewsTab]}
            onPress={() => setViewMode('reviews')}
          >
            <View style={styles.tabContentWithBadge}>
              <Text style={styles.tabIcon}>📩</Text>
              <Text style={[styles.tabText, viewMode === 'reviews' && styles.activeTabText]}>
                Преглед
              </Text>
            </View>
            <View style={styles.reviewBadgeAbsolute}>
              <Text style={styles.reviewBadgeText}>{pendingReviews.length}</Text>
            </View>
          </TouchableOpacity>
        )}
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

      {/* Filter Row - Glued to Tabs, centered */}
      <View style={styles.filterRow}>
        <TouchableOpacity 
          style={[styles.filterButton, selectedCategories.length > 0 && styles.filterButtonActive]}
          onPress={() => setShowCategoryDropdown(true)}
        >
          <Text style={styles.filterButtonText}>{getCategoryLabel()} ▼</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, budgetFilter && styles.filterButtonActive]}
          onPress={() => setShowBudgetDropdown(true)}
        >
          <Text style={styles.filterButtonText}>{getBudgetLabel()} ▼</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.filterButton, cityFilter && styles.filterButtonActive]}
          onPress={() => setShowCityDropdown(true)}
        >
          <Text style={styles.filterButtonText}>{getCityLabel()} ▼</Text>
        </TouchableOpacity>
        
        {/* Status Filter - Only in "Моите" tab */}
        {viewMode === 'assigned' && (
          <TouchableOpacity 
            style={[styles.filterButton, statusFilter && styles.filterButtonActive]}
            onPress={() => setShowStatusDropdown(true)}
          >
            <Text style={styles.filterButtonText}>
              {statusFilter === '' ? 'Статус' : 
               statusFilter === 'wip' ? 'В процес' : 
               statusFilter === 'completed' ? 'Завършени' : 'Статус'} ▼
            </Text>
          </TouchableOpacity>
        )}
      </View>
      
      {/* Category Filter Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Избери категории</Text>
              <TouchableOpacity onPress={() => setShowCategoryDropdown(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {selectedCategories.length > 0 && (
                <TouchableOpacity 
                  style={styles.clearAllButton}
                  onPress={() => setSelectedCategories([])}
                >
                  <Text style={styles.clearAllText}>✕ Изчисти всички ({selectedCategories.length})</Text>
                </TouchableOpacity>
              )}
              {SERVICE_CATEGORIES.map(cat => {
                const isSelected = selectedCategories.includes(cat.value);
                return (
                  <TouchableOpacity 
                    key={cat.value}
                    style={[styles.modalItem, isSelected && styles.modalItemActive]}
                    onPress={() => toggleCategory(cat.value)}
                  >
                    <View style={styles.checkboxRow}>
                      <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.modalItemText, isSelected && styles.modalItemTextActive]}>{cat.label}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity 
              style={styles.modalDoneButton}
              onPress={() => setShowCategoryDropdown(false)}
            >
              <Text style={styles.modalDoneText}>Готово</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Budget Filter Modal */}
      <Modal
        visible={showBudgetDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowBudgetDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Избери бюджет</Text>
              <TouchableOpacity onPress={() => setShowBudgetDropdown(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {BUDGET_RANGES.map(range => (
                <TouchableOpacity 
                  key={range.value || 'all'}
                  style={[styles.modalItem, budgetFilter === range.value && styles.modalItemActive]}
                  onPress={() => { setBudgetFilter(range.value); setShowBudgetDropdown(false); }}
                >
                  <Text style={[styles.modalItemText, budgetFilter === range.value && styles.modalItemTextActive]}>
                    {range.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* City Filter Modal */}
      <Modal
        visible={showCityDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCityDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Избери град</Text>
              <TouchableOpacity onPress={() => setShowCityDropdown(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity 
                style={[styles.modalItem, !cityFilter && styles.modalItemActive]}
                onPress={() => { setCityFilter(''); setShowCityDropdown(false); }}
              >
                <Text style={[styles.modalItemText, !cityFilter && styles.modalItemTextActive]}>
                  Всички градове
                </Text>
              </TouchableOpacity>
              {getAvailableCities().map(city => (
                <TouchableOpacity 
                  key={city}
                  style={[styles.modalItem, cityFilter === city && styles.modalItemActive]}
                  onPress={() => { setCityFilter(city); setShowCityDropdown(false); }}
                >
                  <Text style={[styles.modalItemText, cityFilter === city && styles.modalItemTextActive]}>
                    {city}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Status Filter Modal - Only for "Моите" tab */}
      <Modal
        visible={showStatusDropdown}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowStatusDropdown(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Филтър по статус</Text>
              <TouchableOpacity onPress={() => setShowStatusDropdown(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity 
                style={[styles.modalItem, statusFilter === '' && styles.modalItemActive]}
                onPress={() => { setStatusFilter(''); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.modalItemText, statusFilter === '' && styles.modalItemTextActive]}>
                  Всички
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalItem, statusFilter === 'wip' && styles.modalItemActive]}
                onPress={() => { setStatusFilter('wip'); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.modalItemText, statusFilter === 'wip' && styles.modalItemTextActive]}>
                  ⚡ В процес
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalItem, statusFilter === 'completed' && styles.modalItemActive]}
                onPress={() => { setStatusFilter('completed'); setShowStatusDropdown(false); }}
              >
                <Text style={[styles.modalItemText, statusFilter === 'completed' && styles.modalItemTextActive]}>
                  🏁 Завършени
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>


      {/* Cases List */}
      <ScrollView
        style={styles.casesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Reviews View */}
        {viewMode === 'reviews' ? (
          pendingReviews.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📭</Text>
              <Text style={styles.emptyStateText}>Няма заявки за преглед</Text>
              <Text style={styles.emptyStateSubtext}>
                Когато клиент ви изпрати директна заявка, тя ще се появи тук
              </Text>
            </View>
          ) : (
            pendingReviews.map((review) => (
              <View key={review.id} style={[styles.caseCard, styles.reviewCard]}>
                <View style={styles.caseHeader}>
                  <View style={styles.reviewHeaderLeft}>
                    <View style={styles.categoryIconSmall}>
                      <CategoryIcon category={review.category} size={20} color="#fb923c" />
                    </View>
                    <Text style={styles.caseTitle}>{review.service_type || CATEGORY_LABELS[review.category] || review.category || 'Заявка'}</Text>
                  </View>
                  <View style={styles.reviewBadgeSmall}>
                    <Text style={styles.reviewBadgeSmallText}>📩 За преглед</Text>
                  </View>
                </View>
                
                <Text style={styles.reviewDescription} numberOfLines={3}>{review.description}</Text>
                
                <View style={styles.reviewInfoRow}>
                  {review.city && (
                    <Text style={styles.reviewInfoText}>📍 {review.city}</Text>
                  )}
                  {(review.customer_budget || review.budget) && (
                    <Text style={styles.reviewInfoBudget}>💰 {review.customer_budget || review.budget} лв</Text>
                  )}
                </View>
                
                {/* Action Buttons */}
                <View style={styles.reviewActions}>
                  <TouchableOpacity
                    style={[styles.reviewActionBtn, styles.acceptBtn]}
                    onPress={() => handleReviewResponse(review.id, 'accept')}
                    disabled={reviewActionLoading === review.id}
                  >
                    <Text style={styles.reviewActionBtnText}>
                      {reviewActionLoading === review.id ? '...' : '✅ Приеми'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.reviewActionBtn, styles.counterBtn]}
                    onPress={() => {
                      Alert.prompt(
                        'Предложи бюджет',
                        'Въведете вашата оферта (напр. 250-500)',
                        [
                          { text: 'Отказ', style: 'cancel' },
                          { 
                            text: 'Изпрати', 
                            onPress: (budget: string | undefined) => budget && handleReviewResponse(review.id, 'counter', budget) 
                          }
                        ],
                        'plain-text',
                        review.customer_budget || review.budget?.toString() || ''
                      );
                    }}
                    disabled={reviewActionLoading === review.id}
                  >
                    <Text style={styles.reviewActionBtnText}>💰 Друга цена</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.reviewActionBtn, styles.declineBtn]}
                    onPress={() => handleReviewResponse(review.id, 'decline')}
                    disabled={reviewActionLoading === review.id}
                  >
                    <Text style={styles.reviewActionBtnText}>❌ Откажи</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : viewMode === 'bids' ? (
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
          getFilteredCases().map((caseItem) => {
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
                  {/* Header: Icon + Title + Case Number + Status Badge (for Моите tab) */}
                  <View style={styles.compactHeader}>
                    <View style={styles.categoryIconContainer}>
                      <CategoryIcon category={caseItem.category} size={48} color="#ffffff" />
                    </View>
                    <View style={styles.headerContent}>
                      {/* Title first */}
                      <Text style={styles.caseTitle} numberOfLines={1}>
                        {CATEGORY_LABELS[caseItem.service_type] || CATEGORY_LABELS[caseItem.category] || caseItem.service_type || caseItem.category || 'Заявка'}
                      </Text>
                      {/* Case number + Status badge below title */}
                      <View style={styles.headerBottomRow}>
                        {caseItem.case_number && (
                          <Text style={styles.caseNumberLabel}>Заявка #{caseItem.case_number}</Text>
                        )}
                        {getAssignmentBadge(caseItem)}
                        {/* Status Badge - Only in "Моите" tab */}
                        {viewMode === 'assigned' && (
                          <View style={[
                            styles.caseStatusBadge,
                            caseItem.status === 'wip' && styles.caseStatusWip,
                            caseItem.status === 'accepted' && styles.caseStatusWip,
                            caseItem.status === 'completed' && styles.caseStatusCompleted,
                          ]}>
                            <Text style={styles.caseStatusBadgeText}>
                              {caseItem.status === 'wip' || caseItem.status === 'accepted' ? '⚡ В процес' : 
                               caseItem.status === 'completed' ? '🏁 Завършена' : caseItem.status}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  </View>
                  
                  {/* 1. Description - Most important */}
                  {caseItem.description && (
                    <View style={styles.descriptionSection}>
                      <Text style={styles.descriptionLabel}>Описание:</Text>
                      <Text style={styles.descriptionText} numberOfLines={isExpanded ? undefined : 2}>
                        {caseItem.description}
                      </Text>
                    </View>
                  )}
                  
                  {/* 2. Key Info - Clean inline format */}
                  <View style={styles.infoRow}>
                    {/* Show agreed price for assigned cases, otherwise show original budget */}
                    {(caseItem.winning_bid_price || caseItem.sp_counter_budget || caseItem.budget) && (
                      <Text style={styles.infoText}>
                        <Text style={styles.infoHighlight}>
                          💰 {caseItem.winning_bid_price || caseItem.sp_counter_budget || caseItem.budget} лв
                          {(viewMode === 'assigned' && (caseItem.winning_bid_price || caseItem.sp_counter_budget)) ? ' (договорена)' : ''}
                        </Text>
                      </Text>
                    )}
                    {caseItem.bidding_enabled && (
                      <Text style={styles.infoText}>
                        <Text style={styles.infoIcon}>👥 </Text>
                        {caseItem.current_bidders || 0}/{caseItem.max_bidders || 3} оферти
                      </Text>
                    )}
                    {(caseItem.preferred_date || caseItem.created_at) && (
                      <Text style={styles.infoText}>
                        <Text style={styles.infoIcon}>📅 </Text>
                        {(() => { const d = new Date(caseItem.preferred_date || caseItem.created_at); return `${d.getDate()}.${d.getMonth()+1}.${String(d.getFullYear()).slice(-2)}`; })()}
                      </Text>
                    )}
                  </View>
                  
                  {/* 3. Location - Full address visible */}
                  {(caseItem.city || caseItem.formatted_address || caseItem.address) && (
                    <View style={styles.locationSection}>
                      <Text style={styles.locationFullText} numberOfLines={2}>
                        📍 {caseItem.city}{caseItem.city && (caseItem.formatted_address || caseItem.address) ? ', ' : ''}
                        {cleanFormattedAddress(caseItem.formatted_address || caseItem.address, caseItem.city)}
                      </Text>
                      {caseItem.latitude && caseItem.longitude && (
                        <TouchableOpacity 
                          onPress={() => openMap(caseItem.latitude!, caseItem.longitude!, 'Адрес на клиента')}
                          style={styles.navButton}
                        >
                          <Text style={styles.navButtonText}>🗺️ Отвори в карти</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                  
                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={styles.caseDetails}>
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
                              <Text style={{fontSize: 10, color: '#64748b', fontStyle: 'italic'}}>
                                Видим след спечелване
                              </Text>
                            )}
                          </View>
                        </View>
                      )}
                      {caseItem.square_meters && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>📏 Площ:</Text>
                          <Text style={styles.detailValue}>{caseItem.square_meters} кв.м</Text>
                        </View>
                      )}
                      {/* COMMENTED OUT: priority - feature not needed for now
                      {caseItem.priority && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>⚡ Приоритет:</Text>
                          <Text style={styles.detailValue}>
                            {caseItem.priority === 'normal' ? 'Нормален' : 
                             caseItem.priority === 'high' ? 'Висок' : 
                             caseItem.priority === 'urgent' ? 'Спешен' : caseItem.priority}
                          </Text>
                        </View>
                      )}
                      */}
                      {/* Screenshots */}
                      {caseItem.screenshots && caseItem.screenshots.length > 0 && (
                        <View style={styles.screenshotsSection}>
                          <Text style={styles.detailLabel}>📷 Снимки:</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.screenshotsScroll}>
                            {caseItem.screenshots.map((screenshot, index) => (
                              <TouchableOpacity 
                                key={screenshot.id || index} 
                                style={styles.screenshotWrapper}
                                onPress={() => {
                                  // Open full screen image viewer
                                  Linking.openURL(screenshot.url);
                                }}
                              >
                                <Image 
                                  source={{ uri: screenshot.url }} 
                                  style={styles.screenshotImage}
                                  resizeMode="cover"
                                />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
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
                  
                  {/* Available tab: Always show Bid + Decline (no direct accept to ensure points are used) */}
                  {viewMode === 'available' && caseItem.status === 'pending' && (
                    <View style={styles.buttonRow}>
                      {/* Bid Button - for all cases with budget */}
                      {caseItem.budget ? (
                        <View style={styles.buttonWrapper}>
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
                        </View>
                      ) : null}
                      {/* Decline Button - hide case from available */}
                      <TouchableOpacity
                        style={[styles.actionButton, styles.declineButton, styles.buttonWrapper]}
                        onPress={() => {
                          console.log('❌ Decline button pressed for case:', caseItem.id);
                          handleDeclineCase(caseItem.id);
                        }}
                      >
                        <Text style={styles.actionButtonText}>Откажи</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Assigned tab: Show Complete button for accepted cases OR pending cases with bidding */}
                  {viewMode === 'assigned' && 
                   (caseItem.status === 'accepted' || 
                    caseItem.status === 'wip' ||
                    (caseItem.status === 'pending' && caseItem.bidding_enabled)) && (
                    <View style={{flexDirection: 'column', gap: 8, width: '100%'}}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.completeButton]}
                        onPress={() => {
                          handleCompleteCase(caseItem.id);
                        }}
                      >
                        <Text style={styles.actionButtonText}>🏁 Завърши</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {/* Declined tab: Show only Restore button - case goes back to available for bidding */}
                  {viewMode === 'declined' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.undeclineButton]}
                      onPress={() => {
                        console.log('↩️ Restore button pressed for case:', caseItem.id);
                        handleUndeclineCase(caseItem.id);
                      }}
                    >
                      <Text style={styles.actionButtonText}>↩️ Върни в налични</Text>
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
    alignItems: 'center',
    backgroundColor: '#1e293b', // slate-800
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.3)', // indigo-500/30
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: '#cbd5e1', // slate-300
    textAlign: 'center',
  },
  // Filter styles
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: '#0f172a',
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  filterButtonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  clearFiltersButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearFiltersText: {
    fontSize: 12,
    color: '#ef4444',
  },
  filterPanel: {
    backgroundColor: '#1e293b',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.3)',
  },
  filterLabel: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
    fontWeight: '500',
  },
  categoryScroll: {
    marginBottom: 4,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(71, 85, 105, 0.3)',
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#6366f1',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  categoryChipTextActive: {
    color: '#a5b4fc',
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  budgetInput: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#e2e8f0',
  },
  budgetDash: {
    color: '#64748b',
    fontSize: 14,
  },
  // Dropdown filter styles - glued to tabs
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingTop: 4,
    paddingBottom: 8,
    backgroundColor: '#1e293b', // Same as tabs for seamless look
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    gap: 6,
  },
  dropdownContainer: {
    flex: 1,
    position: 'relative',
    zIndex: 100,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownActive: {
    borderColor: '#6366f1',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  dropdownText: {
    fontSize: 13,
    color: '#94a3b8',
    flex: 1,
  },
  dropdownTextActive: {
    color: '#a5b4fc',
  },
  dropdownArrow: {
    fontSize: 10,
    color: '#64748b',
    marginLeft: 8,
  },
  dropdownMenu: {
    position: 'absolute',
    top: 44,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
    borderRadius: 8,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    overflow: 'hidden',
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.2)',
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  dropdownItemText: {
    fontSize: 13,
    color: '#cbd5e1',
  },
  dropdownItemTextActive: {
    color: '#a5b4fc',
    fontWeight: '600',
  },
  // Checkbox styles for multi-select
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#64748b',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  clearAllItem: {
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
  },
  clearAllText: {
    color: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
  },
  // Modal styles for filter dropdowns
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.3)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  modalClose: {
    fontSize: 24,
    color: '#94a3b8',
    padding: 4,
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.2)',
  },
  modalItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  modalItemText: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  modalItemTextActive: {
    color: '#a5b4fc',
    fontWeight: '600',
  },
  modalDoneButton: {
    backgroundColor: '#6366f1',
    marginHorizontal: 16,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
    // No bottom border - filters are glued directly below
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
  reviewsTab: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)', // orange-500/15
    borderRadius: 8,
  },
  tabWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tabContentWithBadge: {
    alignItems: 'center',
  },
  reviewBadgeAbsolute: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#ef4444', // red-500
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  reviewBadge: {
    backgroundColor: '#ef4444', // red-500
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  reviewBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reviewCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#f97316', // orange-500
    backgroundColor: 'rgba(249, 115, 22, 0.1)',
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  reviewBadgeSmall: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  reviewBadgeSmallText: {
    color: '#fb923c', // orange-400
    fontSize: 11,
    fontWeight: '600',
  },
  reviewDescription: {
    color: '#cbd5e1', // slate-300
    fontSize: 14,
    marginVertical: 8,
  },
  reviewInfoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  reviewInfoText: {
    color: '#94a3b8', // slate-400
    fontSize: 13,
  },
  reviewInfoBudget: {
    color: '#4ade80', // green-400
    fontSize: 13,
    fontWeight: '600',
  },
  reviewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewActionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#22c55e', // green-500
  },
  counterBtn: {
    backgroundColor: '#f59e0b', // amber-500
  },
  declineBtn: {
    backgroundColor: '#ef4444', // red-500
  },
  reviewActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
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
    width: 56,
    height: 56,
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
  categoryIconSmall: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
  caseNumberBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  caseNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#a5b4fc',
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
  // New cleaner layout styles
  headerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  caseNumberLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  descriptionSection: {
    paddingTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  descriptionLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: theme.spacing.xs,
  },
  infoText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoHighlight: {
    color: '#10b981',
    fontWeight: '600',
  },
  infoIcon: {
    fontSize: 13,
  },
  locationSection: {
    backgroundColor: 'rgba(30, 41, 59, 0.4)',
    borderRadius: 8,
    padding: 10,
    marginBottom: theme.spacing.xs,
  },
  locationFullText: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
  // Keep old styles for backward compatibility
  metricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderRadius: 8,
    padding: 12,
    marginBottom: theme.spacing.sm,
    gap: 16,
  },
  metricItem: {
    alignItems: 'center',
    minWidth: 60,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
  },
  metricLabel: {
    fontSize: 10,
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: theme.spacing.xs,
  },
  locationIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    color: '#94a3b8',
  },
  locationLink: {
    color: '#60a5fa',
    textDecorationLine: 'underline',
  },
  navButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.3)',
  },
  navButtonText: {
    fontSize: 12,
    color: '#60a5fa',
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#64748b', // slate-500 default
  },
  pendingBadge: {
    backgroundColor: '#f59e0b', // amber-500
  },
  wonBadge: {
    backgroundColor: '#22c55e', // green-500
  },
  lostBadge: {
    backgroundColor: '#ef4444', // red-500
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
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
    width: '100%',
  },
  buttonWrapper: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
  },
  mapButton: {
    marginTop: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  mapButtonText: {
    color: '#a5b4fc',
    fontWeight: '600',
    fontSize: 12,
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
  // Case status badges for "Моите" tab
  caseStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(100, 116, 139, 0.3)', // default slate
  },
  caseStatusWip: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)', // blue-400/20
    borderWidth: 1,
    borderColor: '#60a5fa', // blue-400
  },
  caseStatusCompleted: {
    backgroundColor: 'rgba(100, 116, 139, 0.2)', // slate-500/20
    borderWidth: 1,
    borderColor: '#64748b', // slate-500
  },
  caseStatusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#e2e8f0', // slate-200
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
  // Screenshots styles
  screenshotsSection: {
    marginTop: theme.spacing.md,
  },
  screenshotsScroll: {
    marginTop: theme.spacing.sm,
  },
  screenshotWrapper: {
    marginRight: theme.spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  screenshotImage: {
    width: 120,
    height: 90,
    borderRadius: 8,
  },
});
