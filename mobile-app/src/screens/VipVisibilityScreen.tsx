import { Logger } from '../utils/Logger';
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  Share,
  Vibration,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

// Types
interface VipConfig {
  enabled: boolean;
  homepageVip: {
    startBidPoints: number;
    buyoutPoints: number;
    slotsPerCategory: number;
    labelBg: string;
  };
  searchVip: {
    startBidPoints: number;
    buyoutPoints: number;
    slotsPerCategory: number;
    labelBg: string;
  };
  minBidIncrement: number;
  maxBidPoints: number;
  isAuctionOpen: boolean;
  nextAuction: {
    startsAt: string;
    endsAt: string;
    coverageStart: string;
    coverageEnd: string;
  };
}

interface VipPlacement {
  vipType: 'HOMEPAGE_VIP' | 'SEARCH_VIP';
  categoryId: string;
  categoryLabelBg: string;
  city: string | null;
  pointsSpent: number;
  rank: number;
  expiresAt: string;
}

interface VipAuction {
  vipType: 'HOMEPAGE_VIP' | 'SEARCH_VIP';
  categoryId: string;
  categoryLabelBg: string;
  city: string | null;
  startBidPoints: number;
  buyoutPoints: number;
  currentBid: number | null;
  currentRank: number | null;
  slotsRemaining: number;
  buyoutsTaken: number;
}

interface LeaderboardEntry {
  rank: number;
  providerName: string;
  businessName: string;
  city: string;
  bidAmount: number;
  isCurrentUser: boolean;
  isBuyout: boolean;
}


// Haptic feedback helper using Vibration API
const triggerHaptic = (type: 'notificationSuccess' | 'notificationError' | 'notificationWarning' | 'impactLight' | 'impactMedium') => {
  try {
    const patterns: Record<string, number | number[]> = {
      notificationSuccess: [0, 50, 50, 50],
      notificationError: [0, 100, 50, 100],
      notificationWarning: [0, 50],
      impactLight: 30,
      impactMedium: 50,
    };
    Vibration.vibrate(patterns[type] || 50);
  } catch (error) {
    // Silently fail if vibration not available
  }
};

const VipVisibilityScreen: React.FC = () => {
  const { t, i18n } = useTranslation('common');
  const navigation = useNavigation();
  const apiService = ApiService.getInstance();

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [config, setConfig] = useState<VipConfig | null>(null);
  const [placements, setPlacements] = useState<VipPlacement[]>([]);
  const [auctions, setAuctions] = useState<VipAuction[]>([]);
  const [pointsBalance, setPointsBalance] = useState(0);
  const [bidModalVisible, setBidModalVisible] = useState(false);
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [selectedAuction, setSelectedAuction] = useState<VipAuction | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [providerCategories, setProviderCategories] = useState<{id: string; label: string}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedVipType, setSelectedVipType] = useState<'HOMEPAGE_VIP' | 'SEARCH_VIP'>('HOMEPAGE_VIP');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Countdown timer for auction
  useEffect(() => {
    if (!config?.isAuctionOpen || !config?.nextAuction?.endsAt) return;
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const end = new Date(config.nextAuction.endsAt).getTime();
      const diff = end - now;
      
      if (diff <= 0) {
        setTimeLeft(t('vipEnding'));
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      
      setTimeLeft(`${hours}${t('hourAbbr')} ${minutes}${t('minAbbr')} ${seconds}${t('secAbbr')}`);
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [config?.isAuctionOpen, config?.nextAuction?.endsAt, t]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      // Fetch config FIRST (doesn't require auth)
      const configRes = await apiService.getVipConfig();
      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
      }

      // Fetch provider's selected categories
      try {
        const categoriesRes = await apiService.getProviderCategories();
        const categoriesData = categoriesRes.data?.categories || categoriesRes.data || categoriesRes.categories;
        if (categoriesRes.success && categoriesData && Array.isArray(categoriesData)) {
          const cats = categoriesData.map((c: any) => ({
            id: c.category_id || c.id,
            label: c.category_label_bg || c.label || c.category_id || c.id
          }));
          setProviderCategories(cats);
          if (!selectedCategory && cats.length > 0) {
            setSelectedCategory(cats[0].id);
          }
        }
      } catch (catError) {
        Logger.warn('Failed to fetch provider categories:', catError);
      }

      // Fetch cities from API for consistency with search page
      try {
        const citiesRes = await apiService.getCities();
        if (citiesRes.success && citiesRes.data?.cities && Array.isArray(citiesRes.data.cities)) {
          const cityNames = citiesRes.data.cities.map((c: any) => c.value || c.label || c.name_bg || c.name);
          setAvailableCities(cityNames);
          if (!selectedCity && cityNames.length > 0) {
            setSelectedCity(cityNames[0]);
          }
        }
      } catch (cityError) {
        Logger.warn('Failed to fetch cities:', cityError);
      }

      // Fetch overview
      const overviewRes = await apiService.getVipOverview();
      if (overviewRes.success && overviewRes.data) {
        setPlacements(overviewRes.data.currentPlacements || []);
        setPointsBalance(overviewRes.data.pointsBalance || 0);
      }

      // Fetch auctions
      const auctionsRes = await apiService.getVipAuctions();
      if (auctionsRes.success && auctionsRes.data) {
        setAuctions(auctionsRes.data.auctions || []);
      }
    } catch (error) {
      Logger.error('Error fetching VIP data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const locale = i18n.language === 'en' ? 'en-US' : 'bg-BG';
    return date.toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryLabel = (categoryId: string, fallbackLabel: string) => {
    // Backend already provides the translated Bulgarian label in categoryLabelBg
    return fallbackLabel;
  };

  const getCityLabel = (city: string) => {
    return city;
  };

  const openBidModal = (auction: VipAuction) => {
    setSelectedAuction(auction);
    // For new bidders, suggest the start bid; for existing bidders, suggest min increment
    const suggestedAmount = auction.currentBid 
      ? (config?.minBidIncrement || 5).toString()
      : (auction.startBidPoints || config?.homepageVip?.startBidPoints || 50).toString();
    setBidAmount(suggestedAmount);
    setBidModalVisible(true);
  };

  const openLeaderboard = async (auction: VipAuction) => {
    setSelectedAuction(auction);
    setLeaderboardVisible(true);
    
    try {
      const res = await apiService.getVipLeaderboard(
        auction.vipType,
        auction.categoryId,
        auction.city || undefined
      );
      if (res.success && res.data?.bids) {
        setLeaderboard(res.data.bids);
      } else {
        setLeaderboard([]);
      }
    } catch (error) {
      Logger.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    }
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction || !bidAmount) return;
    
    const increment = parseInt(bidAmount);
    if (isNaN(increment) || increment < (config?.minBidIncrement || 5)) {
      Alert.alert(t('error'), `${t('vipMinBidIncrement')} ${config?.minBidIncrement || 5} ${t('points').toLowerCase()}.`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiService.placeVipBid(
        selectedAuction.vipType,
        selectedAuction.categoryId,
        increment,
        selectedAuction.city || undefined
      );

      if (res.success) {
        // Haptic feedback on success
        triggerHaptic('notificationSuccess');
        Alert.alert(t('success'), res.data?.message || t('vipBidSuccess'));
        setBidModalVisible(false);
        fetchData();
      } else {
        triggerHaptic('notificationError');
        Alert.alert(t('error'), res.error?.message || t('vipBidError'));
      }
    } catch (error) {
      triggerHaptic('notificationError');
      Alert.alert(t('error'), t('vipBidError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyout = async (auction: VipAuction) => {
    const buyoutPoints = auction.vipType === 'HOMEPAGE_VIP' 
      ? config?.homepageVip.buyoutPoints 
      : config?.searchVip.buyoutPoints;

    Alert.alert(
      t('confirm'),
      `${t('vipBuyoutConfirm')} ${buyoutPoints} ${t('points').toLowerCase()}?\n\n${t('vipPointsDeductedImmediately')}`,
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('vipBuyoutBtn'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await apiService.buyoutVipSlot(auction.vipType, auction.categoryId, auction.city || undefined);
              if (res.success) {
                // Haptic feedback on success
                triggerHaptic('notificationSuccess');
                Alert.alert(t('success'), res.data?.message || t('vipBuyoutSuccess'));
                fetchData();
              } else {
                triggerHaptic('notificationError');
                Alert.alert(t('error'), res.error?.message || t('vipBuyoutError'));
              }
            } catch (error) {
              triggerHaptic('notificationError');
              Alert.alert(t('error'), t('vipBuyoutError'));
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareVipStatus = async () => {
    if (placements.length === 0) return;
    
    triggerHaptic('impactLight');
    
    const vipDetails = placements.map(p => {
      const type = p.vipType === 'HOMEPAGE_VIP' ? '🏠 Начална страница' : '🔍 Търсене';
      return `${type} - ${p.categoryLabelBg} (#${p.rank})`;
    }).join('\n');
    
    const message = `👑 VIP Статус в SnapFix!\n\n${vipDetails}\n\n🚀 Присъединете се към SnapFix - най-добрата платформа за майстори в България!\n\nhttps://snapfix.bg`;
    
    try {
      await Share.share({
        message,
        title: 'Моят VIP статус в SnapFix',
      });
    } catch (error) {
      Logger.error('Error sharing VIP status:', error);
    }
  };

  if (loading) {
    return (
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#312e81']}
        style={styles.container}
      >
        <ActivityIndicator size="large" color={theme.colors.primary.solid} style={{ flex: 1 }} />
      </LinearGradient>
    );
  }

  if (!config?.enabled) {
    return (
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#312e81']}
        style={styles.container}
      >
        <View style={styles.emptyContainer}>
          <Text style={{ fontSize: 64 }}>👑</Text>
          <Text style={styles.emptyText}>{t('vipNotActive')}</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#0f172a', '#1e293b', '#312e81']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={{ fontSize: 24, color: '#fff' }}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('vipVisibility')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Points Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>{t('availablePoints')}</Text>
              <Text style={styles.balanceValue}>{pointsBalance}</Text>
            </View>
            <View style={styles.auctionStatus}>
              {config.isAuctionOpen ? (
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.statusDot, { backgroundColor: theme.colors.success.solid }]} />
                    <Text style={styles.statusText}>{t('vipAuctionOpen')}</Text>
                  </View>
                  {timeLeft ? (
                    <Text style={styles.countdownText}>⏱️ {t('vipTimeLeft')}: {timeLeft}</Text>
                  ) : null}
                </View>
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: theme.colors.gray[400] }]} />
                  <Text style={styles.statusText}>{t('vipAuctionClosed')}</Text>
                </>
              )}
            </View>
          </View>
          {!config.isAuctionOpen && config.nextAuction?.startsAt && (
            <Text style={styles.nextAuction}>
              {t('vipNextAuction')}: {formatDate(config.nextAuction.startsAt)}
            </Text>
          )}
        </View>

        {/* Low Points Warning */}
        {pointsBalance < 50 && (
          <TouchableOpacity 
            style={styles.lowPointsWarning}
            onPress={() => navigation.navigate('Points' as never)}
          >
            <View style={styles.lowPointsContent}>
              <Text style={{ fontSize: 24 }}>⚠️</Text>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.lowPointsTitle}>{t('vipLowPoints')}</Text>
                <Text style={styles.lowPointsText}>
                  {t('vipLowPointsDesc', { points: pointsBalance })}
                </Text>
              </View>
              <View style={styles.buyPointsButton}>
                <Text style={styles.buyPointsText}>{t('buyPoints')}</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Current Placements */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              👑 {t('vipActiveSlots')}
            </Text>
            {placements.length > 0 && (
              <TouchableOpacity 
                style={styles.shareButton}
                onPress={() => handleShareVipStatus()}
              >
                <Text style={styles.shareButtonText}>📤 {t('share')}</Text>
              </TouchableOpacity>
            )}
          </View>
          {placements.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t('vipNoActiveSlots')}</Text>
            </View>
          ) : (
            placements.map((placement, index) => (
              <View key={index} style={styles.placementCard}>
                <View style={styles.placementHeader}>
                  <View style={[
                    styles.vipTypeBadge,
                    { backgroundColor: placement.vipType === 'HOMEPAGE_VIP' ? '#FFD700' : '#C0C0C0' }
                  ]}>
                    <Text style={styles.vipTypeBadgeText}>
                      {placement.vipType === 'HOMEPAGE_VIP' ? t('homepage') : t('search')}
                    </Text>
                  </View>
                  <Text style={styles.placementRank}>#{placement.rank}</Text>
                </View>
                <Text style={styles.placementCategory}>{getCategoryLabel(placement.categoryId, placement.categoryLabelBg)}</Text>
                {placement.city && (
                  <Text style={styles.placementCity}>{getCityLabel(placement.city)}</Text>
                )}
                <View style={styles.placementFooter}>
                  <Text style={styles.placementPoints}>{placement.pointsSpent} {t('points').toLowerCase()}</Text>
                  <Text style={styles.placementExpires}>
                    {t('vipUntil')} {formatDate(placement.expiresAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Category & VIP Type Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🎯 {t('vipBuyVisibility')}
          </Text>
          
          {providerCategories.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t('vipNoCategoriesSelected')}</Text>
            </View>
          ) : (
            <>
              {/* Category Picker */}
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerLabel}>{t('vipSelectCategory')}:</Text>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedCategory}
                    onValueChange={(val) => setSelectedCategory(val)}
                    style={styles.picker}
                    dropdownIconColor="#fff"
                  >
                    {providerCategories.map((cat) => (
                      <Picker.Item key={cat.id} label={cat.label} value={cat.id} color="#fff" />
                    ))}
                  </Picker>
                </View>
              </View>

              {/* VIP Type Selector */}
              <View style={styles.vipTypeSelector}>
                <TouchableOpacity
                  style={[
                    styles.vipTypeButton,
                    selectedVipType === 'HOMEPAGE_VIP' && styles.vipTypeButtonActive
                  ]}
                  onPress={() => setSelectedVipType('HOMEPAGE_VIP')}
                >
                  <Text style={styles.vipTypeIcon}>🏠</Text>
                  <Text style={[
                    styles.vipTypeText,
                    selectedVipType === 'HOMEPAGE_VIP' && styles.vipTypeTextActive
                  ]}>{t('homepage')}</Text>
                  <Text style={styles.vipTypePrice}>{config?.homepageVip?.startBidPoints || 80} - {config?.homepageVip?.buyoutPoints || 150} {t('pointsAbbr')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.vipTypeButton,
                    selectedVipType === 'SEARCH_VIP' && styles.vipTypeButtonActive
                  ]}
                  onPress={() => {
                    setSelectedVipType('SEARCH_VIP');
                    if (!selectedCity && availableCities.length > 0) {
                      setSelectedCity(availableCities[0]);
                    }
                  }}
                >
                  <Text style={styles.vipTypeIcon}>🔍</Text>
                  <Text style={[
                    styles.vipTypeText,
                    selectedVipType === 'SEARCH_VIP' && styles.vipTypeTextActive
                  ]}>{t('search')}</Text>
                  <Text style={styles.vipTypePrice}>{config?.searchVip?.startBidPoints || 80} - {config?.searchVip?.buyoutPoints || 150} {t('pointsAbbr')}</Text>
                </TouchableOpacity>
              </View>

              {/* City Picker - Only for Search VIP */}
              {selectedVipType === 'SEARCH_VIP' && (
                <View style={styles.pickerContainer}>
                  <Text style={styles.pickerLabel}>{t('vipSelectCity')}:</Text>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedCity}
                      onValueChange={(val) => setSelectedCity(val)}
                      style={styles.picker}
                      dropdownIconColor="#fff"
                    >
                      {availableCities.map((city) => (
                        <Picker.Item key={city} label={city} value={city} color="#fff" />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              {/* Selection Summary */}
              {selectedCategory && (selectedVipType === 'HOMEPAGE_VIP' || selectedCity) && (
                <View style={styles.selectionSummary}>
                  <Text style={styles.selectionSummaryTitle}>📋 {t('vipSelected')}:</Text>
                  <Text style={styles.selectionSummaryText}>
                    {selectedVipType === 'HOMEPAGE_VIP' ? `🏠 ${t('homepage')}` : `🔍 ${t('search')}`} • {providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory}
                    {selectedVipType === 'SEARCH_VIP' && selectedCity ? ` • ${selectedCity}` : ''}
                  </Text>
                </View>
              )}

              {/* Quick Action Buttons */}
              {selectedCategory && (selectedVipType === 'HOMEPAGE_VIP' || selectedCity) && (
                <View style={styles.quickActions}>
                  {config?.isAuctionOpen ? (
                    <>
                      <TouchableOpacity
                        style={[styles.quickActionBtn, styles.bidQuickBtn]}
                        onPress={() => {
                          const auction: VipAuction = {
                            vipType: selectedVipType,
                            categoryId: selectedCategory,
                            categoryLabelBg: providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory,
                            city: selectedVipType === 'SEARCH_VIP' ? selectedCity : null,
                            startBidPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.startBidPoints || 80) : (config?.searchVip?.startBidPoints || 80),
                            buyoutPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.buyoutPoints || 150) : (config?.searchVip?.buyoutPoints || 150),
                            currentBid: null,
                            currentRank: null,
                            slotsRemaining: 3,
                            buyoutsTaken: 0
                          };
                          openBidModal(auction);
                        }}
                        disabled={actionLoading}
                      >
                        <Text style={styles.quickActionText}>➕ {t('vipApply')}</Text>
                      </TouchableOpacity>
                      
                      <TouchableOpacity
                        style={[styles.quickActionBtn, styles.buyoutQuickBtn]}
                        onPress={() => {
                          const auction: VipAuction = {
                            vipType: selectedVipType,
                            categoryId: selectedCategory,
                            categoryLabelBg: providerCategories.find(c => c.id === selectedCategory)?.label || selectedCategory,
                            city: selectedVipType === 'SEARCH_VIP' ? selectedCity : null,
                            startBidPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.startBidPoints || 80) : (config?.searchVip?.startBidPoints || 80),
                            buyoutPoints: selectedVipType === 'HOMEPAGE_VIP' ? (config?.homepageVip?.buyoutPoints || 150) : (config?.searchVip?.buyoutPoints || 150),
                            currentBid: null,
                            currentRank: null,
                            slotsRemaining: 3,
                            buyoutsTaken: 0
                          };
                          handleBuyout(auction);
                        }}
                        disabled={actionLoading}
                      >
                        <Text style={styles.quickActionText}>⚡ {t('vipBuyoutBtn')} ({selectedVipType === 'HOMEPAGE_VIP' ? config?.homepageVip?.buyoutPoints : config?.searchVip?.buyoutPoints} {t('pointsAbbr')})</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={styles.auctionClosedNotice}>
                      <Text style={styles.auctionClosedIcon}>🔒</Text>
                      <Text style={styles.auctionClosedText}>{t('vipAuctionClosed')}</Text>
                      {config?.nextAuction?.startsAt && (
                        <Text style={styles.auctionClosedSubtext}>
                          {t('vipNextAuction')}: {formatDate(config.nextAuction.startsAt)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </View>

        {/* Available Auctions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔨 {t('vipAvailableAuctions')}
          </Text>
          {auctions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>{t('vipNoAuctions')}</Text>
            </View>
          ) : (
            auctions.map((auction, index) => (
              <View key={index} style={styles.auctionCard}>
                <View style={styles.auctionHeader}>
                  <View style={[
                    styles.vipTypeBadge,
                    { backgroundColor: auction.vipType === 'HOMEPAGE_VIP' ? '#FFD700' : '#C0C0C0' }
                  ]}>
                    <Text style={styles.vipTypeBadgeText}>
                      {auction.vipType === 'HOMEPAGE_VIP' ? t('homepage') : t('search')}
                    </Text>
                  </View>
                  <Text style={styles.slotsRemaining}>
                    {auction.slotsRemaining} {t('vipSlotsAvailable')}
                  </Text>
                </View>
                
                <Text style={styles.auctionCategory}>{getCategoryLabel(auction.categoryId, auction.categoryLabelBg)}</Text>
                {auction.city && (
                  <Text style={styles.auctionCity}>{getCityLabel(auction.city)}</Text>
                )}

                <View style={styles.auctionInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>{t('vipStartPrice')}</Text>
                    <Text style={styles.infoValue}>{auction.startBidPoints} {t('pointsAbbr')}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>{t('vipBuyoutLabel')}</Text>
                    <Text style={styles.infoValue}>{auction.buyoutPoints} {t('pointsAbbr')}</Text>
                  </View>
                  {auction.currentBid && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>{t('yourOffer')}</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.success.solid }]}>
                        {auction.currentBid} {t('pointsAbbr')} (#{auction.currentRank})
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.auctionActions}>
                  {config.isAuctionOpen && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.bidButton]}
                        onPress={() => openBidModal(auction)}
                        disabled={actionLoading}
                      >
                        <Text style={styles.actionButtonText}>{t('vipApply')}</Text>
                      </TouchableOpacity>
                      
                      {auction.slotsRemaining > 0 && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.buyoutButton]}
                          onPress={() => handleBuyout(auction)}
                          disabled={actionLoading}
                        >
                          <Text style={styles.actionButtonText}>⚡ {t('vipBuyoutBtn')}</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.leaderboardButton]}
                    onPress={() => openLeaderboard(auction)}
                  >
                    <Text style={styles.actionButtonText}>🏆 {t('ranking')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{t('vipHowItWorks')}</Text>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>📅</Text>
            <Text style={styles.infoText}>{t('vipInfo1')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>👑</Text>
            <Text style={styles.infoText}>{t('vipInfo2')}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
            <Text style={styles.infoText}>{t('vipInfo3')}</Text>
          </View>
        </View>

        {/* Button Explanations */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>{t('vipButtonsTitle')}</Text>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>➕</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>{t('vipApply')}</Text> - {t('vipApplyDesc')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}></Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>{t('vipBuyoutBtn')}</Text> - {t('vipBuyoutDesc')}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>{t('ranking')}</Text> - {t('vipRankingDesc')}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Bid Modal */}
      <Modal
        visible={bidModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBidModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('bidding')}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedAuction ? getCategoryLabel(selectedAuction.categoryId, selectedAuction.categoryLabelBg) : ''} - {selectedAuction?.vipType === 'HOMEPAGE_VIP' ? t('homepage') : t('search')}
            </Text>
            
            {selectedAuction?.currentBid ? (
              <Text style={styles.currentBidText}>
                {t('vipYourCurrentBid')}: {selectedAuction.currentBid} {t('points').toLowerCase()}
              </Text>
            ) : (
              <Text style={styles.currentBidText}>
                {t('vipNoBidYet')}
              </Text>
            )}

            <Text style={styles.inputLabel}>
              {selectedAuction?.currentBid 
                ? `${t('vipIncrement')} (${t('vipMin')} ${config?.minBidIncrement} ${t('points').toLowerCase()})` 
                : t('vipBidInPoints')}
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={bidAmount}
              onChangeText={setBidAmount}
              placeholder="5"
              placeholderTextColor={theme.colors.gray[400]}
            />

            <View style={styles.quickBids}>
              {[5, 10, 25, 50].map(amount => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickBidButton}
                  onPress={() => setBidAmount(amount.toString())}
                >
                  <Text style={styles.quickBidText}>+{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setBidModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handlePlaceBid}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>{t('send')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Leaderboard Modal */}
      <Modal
        visible={leaderboardVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLeaderboardVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '70%' }]}>
            <Text style={styles.modalTitle}>{t('ranking')}</Text>
            <Text style={styles.modalSubtitle}>
              {selectedAuction ? getCategoryLabel(selectedAuction.categoryId, selectedAuction.categoryLabelBg) : ''}
            </Text>

            {!config?.isAuctionOpen ? (
              <Text style={styles.leaderboardClosed}>{t('vipAuctionNotActive')}</Text>
            ) : leaderboard.length === 0 ? (
              <Text style={styles.leaderboardEmpty}>{t('vipNoBids')}</Text>
            ) : (
              <ScrollView style={styles.leaderboardList}>
                {leaderboard.map((entry, index) => (
                  <View
                    key={index}
                    style={[
                      styles.leaderboardEntry,
                      entry.isCurrentUser && styles.leaderboardEntryHighlight,
                    ]}
                  >
                    <Text style={styles.leaderboardRank}>#{entry.rank}</Text>
                    <View style={styles.leaderboardInfo}>
                      <Text style={styles.leaderboardName}>{entry.providerName}</Text>
                      <Text style={styles.leaderboardBusiness}>{entry.businessName}</Text>
                    </View>
                    <View style={styles.leaderboardBid}>
                      <Text style={styles.leaderboardBidAmount}>{entry.bidAmount} {t('pointsAbbr')}</Text>
                      {entry.isBuyout && (
                        <View style={styles.buyoutBadge}>
                          <Text style={styles.buyoutBadgeText}>{t('vipBuyoutBtn')}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.modalButton, styles.closeButton]}
              onPress={() => setLeaderboardVisible(false)}
            >
              <Text style={styles.closeButtonText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingTop: 8,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  balanceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: theme.colors.gray[300],
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
  },
  auctionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  countdownText: {
    fontSize: 12,
    color: '#FBBF24',
    marginTop: 4,
  },
  lowPointsWarning: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  lowPointsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lowPointsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FBBF24',
  },
  lowPointsText: {
    fontSize: 12,
    color: theme.colors.gray[300],
    marginTop: 2,
  },
  buyPointsButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buyPointsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  nextAuction: {
    fontSize: 13,
    color: theme.colors.gray[300],
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  shareButton: {
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  shareButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#818CF8',
  },
  emptySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  emptySectionText: {
    color: theme.colors.gray[400],
    fontSize: 14,
  },
  placementCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  placementHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vipTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  vipTypeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
  },
  placementRank: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFD700',
  },
  placementCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  placementCity: {
    fontSize: 14,
    color: theme.colors.gray[300],
    marginTop: 4,
  },
  placementFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  placementPoints: {
    fontSize: 14,
    color: theme.colors.success.light,
  },
  placementExpires: {
    fontSize: 13,
    color: theme.colors.gray[400],
  },
  auctionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  auctionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  slotsRemaining: {
    fontSize: 13,
    color: theme.colors.success.light,
  },
  auctionCategory: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  auctionCity: {
    fontSize: 14,
    color: theme.colors.gray[300],
    marginTop: 4,
  },
  auctionInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  infoItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    minWidth: '30%',
    marginRight: 10,
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 11,
    color: theme.colors.gray[400],
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginTop: 2,
  },
  auctionActions: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bidButton: {
    backgroundColor: theme.colors.primary.solid,
  },
  buyoutButton: {
    backgroundColor: theme.colors.warning.solid,
  },
  leaderboardButton: {
    backgroundColor: theme.colors.gray[600],
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  infoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.gray[300],
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: theme.colors.gray[400],
    fontSize: 16,
    marginTop: 16,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.gray[300],
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  currentBidText: {
    fontSize: 14,
    color: theme.colors.success.light,
    textAlign: 'center',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: theme.colors.gray[300],
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 14,
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
  },
  quickBids: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
  },
  quickBidButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  quickBidText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: theme.colors.primary.solid,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  closeButton: {
    backgroundColor: theme.colors.gray[600],
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Leaderboard Styles
  leaderboardClosed: {
    color: theme.colors.gray[400],
    textAlign: 'center',
    marginVertical: 20,
  },
  leaderboardEmpty: {
    color: theme.colors.gray[400],
    textAlign: 'center',
    marginVertical: 20,
  },
  leaderboardList: {
    maxHeight: 300,
    marginTop: 12,
  },
  leaderboardEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    marginBottom: 8,
  },
  leaderboardEntryHighlight: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderWidth: 1,
    borderColor: theme.colors.primary.solid,
  },
  leaderboardRank: {
    width: 40,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFD700',
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  leaderboardBusiness: {
    fontSize: 12,
    color: theme.colors.gray[400],
  },
  leaderboardBid: {
    alignItems: 'flex-end',
  },
  leaderboardBidAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  buyoutBadge: {
    backgroundColor: theme.colors.warning.solid,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  buyoutBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#000',
  },
  // Category & VIP Type Selection Styles
  pickerContainer: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  picker: {
    color: '#fff',
    height: 50,
  },
  vipTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  vipTypeButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  vipTypeButtonActive: {
    borderColor: '#FFD700',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
  },
  vipTypeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  vipTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.gray[300],
    textAlign: 'center',
    marginBottom: 4,
  },
  vipTypeTextActive: {
    color: '#FFD700',
  },
  vipTypePrice: {
    fontSize: 11,
    color: theme.colors.gray[400],
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  bidQuickBtn: {
    backgroundColor: theme.colors.primary.solid,
  },
  buyoutQuickBtn: {
    backgroundColor: '#D97706',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  selectionSummary: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(79, 70, 229, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  selectionSummaryTitle: {
    fontSize: 12,
    color: theme.colors.gray[400],
    marginBottom: 4,
  },
  selectionSummaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  auctionClosedNotice: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  auctionClosedIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  auctionClosedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  auctionClosedSubtext: {
    fontSize: 12,
    color: theme.colors.gray[400],
    marginTop: 4,
  },
});

export default VipVisibilityScreen;
