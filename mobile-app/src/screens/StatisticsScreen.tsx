// Statistics Screen
// Combines SMS Statistics and Cases Statistics (Статистика за заявки)
// With customizable, reorderable stat boxes

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import theme from '../styles/theme';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  businessId?: string;
}

interface DashboardStats {
  totalCalls: number;
  missedCalls: number;
  avgResponseTime: string;
  smsSent: number;
  smsChatCases?: number;
  searchChatCases?: number;
}

interface ProviderStats {
  available: number;
  accepted: number;
  completedCases: number;
  averageRating: number;
  totalReviews: number;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  createdAt: string;
}

interface FilteredStats {
  missedCalls: number;
  smsSent: number;
  acceptedCases: number;
  completedCases: number;
  smsChatCases: number;
  searchChatCases: number;
}

// Stat box configuration
interface StatBoxConfig {
  id: string;
  icon: string;
  label: string;
  colorStyle: string;
  description?: string;
}

// All available stat boxes for cases section
const ALL_STAT_BOXES: StatBoxConfig[] = [
  { id: 'available', icon: '📋', label: 'Налични', colorStyle: 'statsCardBlue' },
  { id: 'ratingReviews', icon: '⭐', label: 'Оценка', colorStyle: 'statsCardYellow', description: 'Натиснете за да видите отзивите' },
  { id: 'accepted', icon: '✅', label: 'Приети', colorStyle: 'statsCardTeal' },
  { id: 'completed', icon: '🏁', label: 'Завършени', colorStyle: 'statsCardPurple' },
  { id: 'smsRequests', icon: '📱', label: 'SMS Заявки', colorStyle: 'statsCardCyan', description: 'Заявки от клиенти чрез SMS линк след пропуснато обаждане.' },
  { id: 'webRequests', icon: '🌐', label: 'Уеб Заявки', colorStyle: 'statsCardIndigo', description: 'Заявки от клиенти намерили ви чрез търсачката.' },
];

// Default order of boxes
const DEFAULT_BOX_ORDER = ['available', 'ratingReviews', 'accepted', 'completed', 'smsRequests', 'webRequests'];

// Storage key for box order
const BOX_ORDER_STORAGE_KEY = 'statistics_box_order';

// Month names in Bulgarian
const MONTH_NAMES = [
  'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни',
  'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември'
];

function StatisticsScreen() {
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    missedCalls: 0,
    avgResponseTime: '0m 0s',
    smsSent: 0,
    smsChatCases: 0,
    searchChatCases: 0,
  });
  const [providerStats, setProviderStats] = useState<ProviderStats | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Customization state
  const [boxOrder, setBoxOrder] = useState<string[]>(DEFAULT_BOX_ORDER);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  
  // Filter state for SMS stats
  const [smsFilterMonth, setSmsFilterMonth] = useState<number | null>(null);
  const [smsFilterYear, setSmsFilterYear] = useState<number | null>(null);
  const [filteredSmsStats, setFilteredSmsStats] = useState<FilteredStats | null>(null);
  const [showSmsMonthPicker, setShowSmsMonthPicker] = useState(false);
  
  // Filter state for Cases stats
  const [casesFilterMonth, setCasesFilterMonth] = useState<number | null>(null);
  const [casesFilterYear, setCasesFilterYear] = useState<number | null>(null);
  const [filteredCasesStats, setFilteredCasesStats] = useState<FilteredStats | null>(null);
  const [showCasesMonthPicker, setShowCasesMonthPicker] = useState(false);
  
  // Reviews modal state
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);

  useEffect(() => {
    loadUserData();
    loadBoxOrder();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadDashboardData();
        loadProviderStats(user.id);
      }
    }, [user?.id])
  );

  // Load saved box order from AsyncStorage
  const loadBoxOrder = async () => {
    try {
      const savedOrder = await AsyncStorage.getItem(BOX_ORDER_STORAGE_KEY);
      if (savedOrder) {
        const parsedOrder = JSON.parse(savedOrder);
        // Validate that all boxes are present
        const validOrder = parsedOrder.filter((id: string) => 
          ALL_STAT_BOXES.some(box => box.id === id)
        );
        // Add any missing boxes
        const missingBoxes = DEFAULT_BOX_ORDER.filter(id => !validOrder.includes(id));
        setBoxOrder([...validOrder, ...missingBoxes]);
      }
    } catch (error) {
      console.error('Error loading box order:', error);
    }
  };

  // Save box order to AsyncStorage
  const saveBoxOrder = async (order: string[]) => {
    try {
      await AsyncStorage.setItem(BOX_ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch (error) {
      console.error('Error saving box order:', error);
    }
  };

  // Handle box tap in edit mode
  const handleBoxTap = (index: number) => {
    if (!isEditMode) return;
    
    if (selectedBoxIndex === null) {
      // First tap - select this box
      setSelectedBoxIndex(index);
    } else if (selectedBoxIndex === index) {
      // Tapped same box - deselect
      setSelectedBoxIndex(null);
    } else {
      // Second tap - swap boxes
      const newOrder = [...boxOrder];
      const temp = newOrder[selectedBoxIndex];
      newOrder[selectedBoxIndex] = newOrder[index];
      newOrder[index] = temp;
      setBoxOrder(newOrder);
      saveBoxOrder(newOrder);
      setSelectedBoxIndex(null);
    }
  };

  // Load reviews for modal
  const loadReviews = async () => {
    if (!user?.id) return;
    setIsLoadingReviews(true);
    try {
      const response = await ApiService.getInstance().makeRequest(
        `/reviews/provider/${user.id}?page=1&limit=50`
      );
      const data = response.data as any;
      if (response.success && data?.reviews) {
        setReviews(data.reviews.map((r: any) => ({
          id: r.id,
          rating: r.rating,
          comment: r.comment || '',
          customerName: r.customer_name || r.customerName || 'Клиент',
          createdAt: r.created_at || r.createdAt
        })));
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
    setIsLoadingReviews(false);
  };

  // Open reviews modal
  const openReviewsModal = () => {
    setShowReviewsModal(true);
    loadReviews();
  };

  // Render stars
  const renderStars = (rating: number) => {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  };

  // Get value for a stat box
  const getBoxValue = (boxId: string): string | number => {
    const useFiltered = casesFilterMonth && filteredCasesStats;
    
    switch (boxId) {
      case 'available':
        return providerStats?.available || 0;
      case 'ratingReviews':
        const rating = Number(providerStats?.averageRating || 0).toFixed(1);
        const reviewCount = providerStats?.totalReviews || 0;
        return `${rating} (${reviewCount})`;
      case 'accepted':
        return useFiltered ? filteredCasesStats!.acceptedCases : providerStats?.accepted || 0;
      case 'completed':
        return useFiltered ? filteredCasesStats!.completedCases : providerStats?.completedCases || 0;
      case 'smsRequests':
        return useFiltered ? filteredCasesStats!.smsChatCases : stats.smsChatCases || 0;
      case 'webRequests':
        return useFiltered ? filteredCasesStats!.searchChatCases : stats.searchChatCases || 0;
      default:
        return 0;
    }
  };

  // Reset to default order
  const resetToDefault = () => {
    setBoxOrder(DEFAULT_BOX_ORDER);
    saveBoxOrder(DEFAULT_BOX_ORDER);
    setSelectedBoxIndex(null);
    Alert.alert('Готово', 'Подредбата е нулирана по подразбиране.');
  };

  const loadUserData = async () => {
    try {
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        // Load data after setting user
        loadDashboardData(parsedUser.id);
        loadProviderStats(parsedUser.id);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadProviderStats = async (userId: string) => {
    try {
      console.log('📊 Loading provider stats for user:', userId);
      const [statsResponse, providerResponse] = await Promise.all([
        ApiService.getInstance().makeRequest(`/cases/stats?providerId=${userId}`),
        ApiService.getInstance().makeRequest(`/marketplace/providers/${userId}`)
      ]);

      const statsData: any = statsResponse.data || {};
      const providerData: any = providerResponse.data || {};

      const loadedStats: ProviderStats = {
        available: Number(statsData.available) || 0,
        accepted: Number(statsData.accepted) || 0,
        completedCases: Number(statsData.completed) || 0,
        averageRating: Number(providerData.rating) || 0,
        totalReviews: Number(providerData.totalReviews || providerData.total_reviews) || 0
      };

      console.log('✅ Provider stats loaded:', loadedStats);
      setProviderStats(loadedStats);
    } catch (error) {
      console.error('❌ Error loading provider stats:', error);
    }
  };

  const loadDashboardData = async (userId?: string) => {
    try {
      const id = userId || user?.id;
      if (!id) return;

      const response = await ApiService.getInstance().getDashboardStats(id);
      
      // Get chat source stats
      let chatSourceStats = { smsChatCases: 0, searchChatCases: 0 };
      try {
        const chatSourceResponse = await ApiService.getInstance().getCaseStatsByChatSource(id);
        if (chatSourceResponse.success && chatSourceResponse.data) {
          const totals = chatSourceResponse.data.totals || chatSourceResponse.data;
          chatSourceStats = {
            smsChatCases: totals.smschat || 0,
            searchChatCases: totals.searchchat || 0,
          };
        }
      } catch (error) {
        console.error('Error loading chat source stats:', error);
      }
      
      if (response.success && response.data) {
        setStats({
          ...response.data,
          ...chatSourceStats,
        });
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  // Load filtered SMS stats
  const loadFilteredSmsStats = async (userId: string, month: number, year: number) => {
    try {
      const response = await ApiService.getInstance().makeRequest(
        `/dashboard/sms-stats?providerId=${userId}&month=${month}&year=${year}`
      );
      
      if (response.success && response.data) {
        const data = response.data as any;
        setFilteredSmsStats({
          missedCalls: Number(data.missedCalls) || 0,
          smsSent: Number(data.smsSent) || 0,
          acceptedCases: 0,
          completedCases: 0,
          smsChatCases: 0,
          searchChatCases: 0,
        });
      } else {
        setFilteredSmsStats({
          missedCalls: 0,
          smsSent: 0,
          acceptedCases: 0,
          completedCases: 0,
          smsChatCases: 0,
          searchChatCases: 0,
        });
      }
    } catch (error) {
      console.error('Error loading filtered SMS stats:', error);
      setFilteredSmsStats({
        missedCalls: 0,
        smsSent: 0,
        acceptedCases: 0,
        completedCases: 0,
        smsChatCases: 0,
        searchChatCases: 0,
      });
    }
  };

  // Load filtered cases stats
  const loadFilteredCasesStats = async (userId: string, month: number, year: number) => {
    try {
      const response = await ApiService.getInstance().makeRequest(
        `/dashboard/cases-stats?providerId=${userId}&month=${month}&year=${year}`
      );
      
      if (response.success && response.data) {
        const data = response.data as any;
        setFilteredCasesStats({
          missedCalls: Number(data.missedCalls) || 0,
          smsSent: Number(data.smsSent) || 0,
          acceptedCases: Number(data.acceptedCases) || 0,
          completedCases: Number(data.completedCases) || 0,
          smsChatCases: Number(data.smsChatCases) || 0,
          searchChatCases: Number(data.searchChatCases) || 0
        });
      } else {
        setFilteredCasesStats({
          missedCalls: 0,
          smsSent: 0,
          acceptedCases: providerStats?.accepted || 0,
          completedCases: providerStats?.completedCases || 0,
          smsChatCases: 0,
          searchChatCases: 0
        });
      }
    } catch (error) {
      console.error('Error loading filtered cases stats:', error);
      setFilteredCasesStats({
        missedCalls: 0,
        smsSent: 0,
        acceptedCases: providerStats?.accepted || 0,
        completedCases: providerStats?.completedCases || 0,
        smsChatCases: 0,
        searchChatCases: 0
      });
    }
  };

  // Get available months for picker (last 12 months including current)
  const getAvailableMonths = (): Array<{month: number, year: number, label: string}> => {
    const months: Array<{month: number, year: number, label: string}> = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    for (let i = 0; i < 12; i++) {
      let m = currentMonth - i;
      let y = currentYear;
      if (m < 1) {
        m += 12;
        y--;
      }
      months.push({
        month: m,
        year: y,
        label: `${MONTH_NAMES[m - 1]} ${y}`
      });
    }
    return months;
  };

  // Select a specific month for SMS filter
  const selectSmsMonth = (month: number, year: number) => {
    setSmsFilterMonth(month);
    setSmsFilterYear(year);
    setShowSmsMonthPicker(false);
    if (user?.id) {
      loadFilteredSmsStats(user.id, month, year);
    }
  };

  // Clear SMS filter
  const clearSmsFilter = () => {
    setSmsFilterMonth(null);
    setSmsFilterYear(null);
    setFilteredSmsStats(null);
  };

  // Select a specific month for Cases filter
  const selectCasesMonth = (month: number, year: number) => {
    setCasesFilterMonth(month);
    setCasesFilterYear(year);
    setShowCasesMonthPicker(false);
    if (user?.id) {
      loadFilteredCasesStats(user.id, month, year);
    }
  };

  // Clear Cases filter
  const clearCasesFilter = () => {
    setCasesFilterMonth(null);
    setCasesFilterYear(null);
    setFilteredCasesStats(null);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadDashboardData();
      if (user?.id) {
        await loadProviderStats(user.id);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
    setIsRefreshing(false);
  };

  // Render a single stat box
  const renderStatBox = (boxId: string, index: number) => {
    const boxConfig = ALL_STAT_BOXES.find(b => b.id === boxId);
    if (!boxConfig) return null;

    const isSelected = isEditMode && selectedBoxIndex === index;
    const value = getBoxValue(boxId);
    const colorStyle = (styles as any)[boxConfig.colorStyle];

    return (
      <TouchableOpacity
        key={boxId}
        style={[
          styles.statsCardSmall,
          colorStyle,
          isSelected && styles.statsCardSelected,
          isEditMode && styles.statsCardEditable,
        ]}
        onPress={() => {
          if (isEditMode) {
            handleBoxTap(index);
          } else if (boxId === 'ratingReviews') {
            openReviewsModal();
          }
        }}
        onLongPress={() => {
          if (boxConfig.description && !isEditMode && boxId !== 'ratingReviews') {
            Alert.alert(`${boxConfig.icon} ${boxConfig.label}`, boxConfig.description);
          }
        }}
        activeOpacity={isEditMode ? 0.7 : 0.9}
      >
        {isEditMode && (
          <View style={styles.editBadge}>
            <Text style={styles.editBadgeText}>{index + 1}</Text>
          </View>
        )}
        <Text style={styles.statsCardIconSmall}>{boxConfig.icon}</Text>
        <Text style={styles.statsCardValueSmall}>{value}</Text>
        <Text style={styles.statsCardLabelSmall}>{boxConfig.label}</Text>
      </TouchableOpacity>
    );
  };

  // Split boxes into rows of 3
  const getBoxRows = () => {
    const rows: string[][] = [];
    for (let i = 0; i < boxOrder.length; i += 3) {
      rows.push(boxOrder.slice(i, i + 3));
    }
    return rows;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Статистики</Text>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => {
            if (isEditMode) {
              setSelectedBoxIndex(null);
            }
            setIsEditMode(!isEditMode);
          }}
        >
          <Text style={styles.editButtonText}>{isEditMode ? '✓' : '✎'}</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Mode Instructions */}
      {isEditMode && (
        <View style={styles.editInstructions}>
          <Text style={styles.editInstructionsText}>
            Натиснете 2 кутии за да ги разменим местата
          </Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetToDefault}>
            <Text style={styles.resetButtonText}>Нулиране</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* SMS Statistics Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Text style={styles.statsSectionTitle}>📱 SMS Статистика</Text>
            <View style={styles.filterBadgeContainer}>
              {smsFilterMonth ? (
                <TouchableOpacity style={styles.filterBadge} onPress={clearSmsFilter}>
                  <Text style={styles.filterBadgeText}>
                    {MONTH_NAMES[smsFilterMonth - 1].substring(0, 3)} {smsFilterYear}
                  </Text>
                  <Text style={styles.filterBadgeClose}>✕</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.filterButton} 
                  onPress={() => setShowSmsMonthPicker(true)}
                >
                  <Text style={styles.filterButtonIcon}>📅</Text>
                  <Text style={styles.filterButtonText}>Филтър</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={styles.statsCardsRow}>
            <View style={[styles.statsCard, styles.statsCardOrange]}>
              <Text style={styles.statsCardIcon}>📞</Text>
              <Text style={styles.statsCardValue}>
                {smsFilterMonth && filteredSmsStats ? filteredSmsStats.missedCalls : stats.missedCalls}
              </Text>
              <Text style={styles.statsCardLabel}>Пропуснати обаждания</Text>
            </View>
            <View style={[styles.statsCard, styles.statsCardGreen]}>
              <Text style={styles.statsCardIcon}>💬</Text>
              <Text style={styles.statsCardValue}>
                {smsFilterMonth && filteredSmsStats ? filteredSmsStats.smsSent : stats.smsSent}
              </Text>
              <Text style={styles.statsCardLabel}>Изпратени SMS</Text>
            </View>
          </View>
        </View>

        {/* SMS Month Picker Modal */}
        <Modal
          visible={showSmsMonthPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowSmsMonthPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowSmsMonthPicker(false)}
          >
            <View style={styles.monthPickerModal}>
              <Text style={styles.monthPickerTitle}>Избери месец</Text>
              <ScrollView style={styles.monthPickerScroll}>
                {getAvailableMonths().map((item) => (
                  <TouchableOpacity
                    key={`${item.month}-${item.year}`}
                    style={styles.monthPickerItem}
                    onPress={() => selectSmsMonth(item.month, item.year)}
                  >
                    <Text style={styles.monthPickerItemText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Cases Statistics Section - Customizable */}
        <View style={styles.statsSection}>
          <View style={styles.statsSectionHeader}>
            <Text style={styles.statsSectionTitle}>📊 Статистика за заявки</Text>
            <View style={styles.filterBadgeContainer}>
              {casesFilterMonth ? (
                <TouchableOpacity style={styles.filterBadge} onPress={clearCasesFilter}>
                  <Text style={styles.filterBadgeText}>
                    {MONTH_NAMES[casesFilterMonth - 1].substring(0, 3)} {casesFilterYear}
                  </Text>
                  <Text style={styles.filterBadgeClose}>✕</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.filterButton} 
                  onPress={() => setShowCasesMonthPicker(true)}
                >
                  <Text style={styles.filterButtonIcon}>📅</Text>
                  <Text style={styles.filterButtonText}>Филтър</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {/* Dynamically rendered stat boxes */}
          {getBoxRows().map((row, rowIndex) => (
            <View key={rowIndex} style={styles.statsCardsRow}>
              {row.map((boxId, boxIndex) => 
                renderStatBox(boxId, rowIndex * 3 + boxIndex)
              )}
              {/* Fill empty spaces in last row */}
              {row.length < 3 && Array(3 - row.length).fill(null).map((_, i) => (
                <View key={`empty-${i}`} style={styles.statsCardSmallEmpty} />
              ))}
            </View>
          ))}
        </View>

        {/* Cases Month Picker Modal */}
        <Modal
          visible={showCasesMonthPicker}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCasesMonthPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay} 
            activeOpacity={1} 
            onPress={() => setShowCasesMonthPicker(false)}
          >
            <View style={styles.monthPickerModal}>
              <Text style={styles.monthPickerTitle}>Избери месец</Text>
              <ScrollView style={styles.monthPickerScroll}>
                {getAvailableMonths().map((item) => (
                  <TouchableOpacity
                    key={`cases-${item.month}-${item.year}`}
                    style={styles.monthPickerItem}
                    onPress={() => selectCasesMonth(item.month, item.year)}
                  >
                    <Text style={styles.monthPickerItemText}>{item.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Reviews Modal */}
        <Modal
          visible={showReviewsModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowReviewsModal(false)}
        >
          <View style={styles.reviewsModalContainer}>
            <View style={styles.reviewsModal}>
              {/* Header */}
              <View style={styles.reviewsModalHeader}>
                <View style={styles.reviewsModalTitleRow}>
                  <Text style={styles.reviewsModalTitle}>⭐ Оценки и Отзиви</Text>
                  <TouchableOpacity onPress={() => setShowReviewsModal(false)}>
                    <Text style={styles.reviewsModalClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.reviewsModalSummary}>
                  <Text style={styles.reviewsModalRating}>
                    {Number(providerStats?.averageRating || 0).toFixed(1)}
                  </Text>
                  <Text style={styles.reviewsModalStars}>
                    {renderStars(providerStats?.averageRating || 0)}
                  </Text>
                  <Text style={styles.reviewsModalCount}>
                    ({providerStats?.totalReviews || 0} отзива)
                  </Text>
                </View>
              </View>
              
              {/* Reviews List */}
              <ScrollView style={styles.reviewsList}>
                {isLoadingReviews ? (
                  <Text style={styles.reviewsLoading}>Зареждане...</Text>
                ) : reviews.length === 0 ? (
                  <View style={styles.noReviews}>
                    <Text style={styles.noReviewsIcon}>📝</Text>
                    <Text style={styles.noReviewsText}>Все още нямате отзиви</Text>
                  </View>
                ) : (
                  reviews.map((review) => (
                    <View key={review.id} style={styles.reviewItem}>
                      <View style={styles.reviewHeader}>
                        <Text style={styles.reviewCustomer}>{review.customerName}</Text>
                        <Text style={styles.reviewStars}>
                          {renderStars(review.rating)}
                        </Text>
                      </View>
                      {review.comment ? (
                        <Text style={styles.reviewComment}>"{review.comment}"</Text>
                      ) : (
                        <Text style={styles.reviewNoComment}>Без коментар</Text>
                      )}
                      <Text style={styles.reviewDate}>
                        {new Date(review.createdAt).toLocaleDateString('bg-BG')}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    backgroundColor: '#1e293b',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.3)',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '300',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  statsSection: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  statsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  filterBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterButtonIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  filterButtonText: {
    color: '#a5b4fc',
    fontSize: 13,
    fontWeight: '500',
  },
  filterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  filterBadgeClose: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 6,
    opacity: 0.8,
  },
  statsCardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statsCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statsCardOrange: {
    backgroundColor: 'rgba(249, 115, 22, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(249, 115, 22, 0.3)',
  },
  statsCardGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  statsCardIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statsCardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statsCardLabel: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  statsCardSmall: {
    flex: 1,
    borderRadius: 10,
    padding: 12,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  statsCardBlue: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  statsCardYellow: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  statsCardPink: {
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.3)',
  },
  statsCardTeal: {
    backgroundColor: 'rgba(20, 184, 166, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20, 184, 166, 0.3)',
  },
  statsCardPurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.3)',
  },
  statsCardCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.3)',
  },
  statsCardIndigo: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  statsCardIconSmall: {
    fontSize: 18,
    marginBottom: 4,
  },
  statsCardValueSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  statsCardLabelSmall: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthPickerModal: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxHeight: '60%',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  monthPickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
  monthPickerScroll: {
    maxHeight: 300,
  },
  monthPickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  monthPickerItemText: {
    fontSize: 16,
    color: '#e2e8f0',
    textAlign: 'center',
  },
  // Edit mode styles
  editButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 20,
  },
  editButtonText: {
    color: '#a5b4fc',
    fontSize: 18,
  },
  editInstructions: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editInstructionsText: {
    color: '#a5b4fc',
    fontSize: 13,
    flex: 1,
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 10,
  },
  resetButtonText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '500',
  },
  statsCardSelected: {
    borderWidth: 2,
    borderColor: '#22c55e',
    transform: [{ scale: 1.02 }],
  },
  statsCardEditable: {
    opacity: 0.95,
  },
  editBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#4F46E5',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsCardSmallEmpty: {
    flex: 1,
    marginHorizontal: 3,
  },
  bottomPadding: {
    height: 40,
  },
  // Reviews Modal Styles
  reviewsModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  reviewsModal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  reviewsModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  reviewsModalTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  reviewsModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  reviewsModalClose: {
    fontSize: 24,
    color: '#94a3b8',
    padding: 4,
  },
  reviewsModalSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  reviewsModalRating: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#eab308',
  },
  reviewsModalStars: {
    fontSize: 20,
    color: '#eab308',
  },
  reviewsModalCount: {
    fontSize: 14,
    color: '#94a3b8',
  },
  reviewsList: {
    padding: 16,
    maxHeight: 400,
  },
  reviewsLoading: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 20,
  },
  noReviews: {
    alignItems: 'center',
    padding: 40,
  },
  noReviewsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  noReviewsText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  reviewItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewCustomer: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  reviewStars: {
    fontSize: 14,
    color: '#eab308',
  },
  reviewComment: {
    fontSize: 14,
    color: '#cbd5e1',
    fontStyle: 'italic',
    marginBottom: 8,
    lineHeight: 20,
  },
  reviewNoComment: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  reviewDate: {
    fontSize: 12,
    color: '#64748b',
  },
});

export default StatisticsScreen;
