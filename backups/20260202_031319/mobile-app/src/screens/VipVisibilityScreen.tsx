import React, { useState, useCallback } from 'react';
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
} from 'react-native';
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

const VipVisibilityScreen: React.FC = () => {
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

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    try {
      // Fetch config
      const configRes = await apiService.getVipConfig();
      if (configRes.success && configRes.data) {
        setConfig(configRes.data);
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
      console.error('Error fetching VIP data:', error);
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
    return date.toLocaleDateString('bg-BG', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
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
      console.error('Error fetching leaderboard:', error);
      setLeaderboard([]);
    }
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction || !bidAmount) return;
    
    const increment = parseInt(bidAmount);
    if (isNaN(increment) || increment < (config?.minBidIncrement || 5)) {
      Alert.alert('Грешка', `Минималното увеличение е ${config?.minBidIncrement || 5} точки.`);
      return;
    }

    setActionLoading(true);
    try {
      const res = await apiService.placeVipBid(
        selectedAuction.vipType,
        selectedAuction.categoryId,
        increment
      );

      if (res.success) {
        Alert.alert('Успех', res.data?.message || 'Офертата е успешно повишена.');
        setBidModalVisible(false);
        fetchData();
      } else {
        Alert.alert('Грешка', res.error?.message || 'Възникна грешка при наддаването.');
      }
    } catch (error) {
      Alert.alert('Грешка', 'Възникна грешка при наддаването.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBuyout = async (auction: VipAuction) => {
    const buyoutPoints = auction.vipType === 'HOMEPAGE_VIP' 
      ? config?.homepageVip.buyoutPoints 
      : config?.searchVip.buyoutPoints;

    Alert.alert(
      'Потвърждение',
      `Сигурен ли си, че искаш да закупиш VIP слот за ${buyoutPoints} точки?\n\nТочките ще бъдат удържани веднага.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Закупи',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await apiService.buyoutVipSlot(auction.vipType, auction.categoryId);
              if (res.success) {
                Alert.alert('Успех', res.data?.message || 'VIP слотът е закупен успешно!');
                fetchData();
              } else {
                Alert.alert('Грешка', res.error?.message || 'Възникна грешка при закупуването.');
              }
            } catch (error) {
              Alert.alert('Грешка', 'Възникна грешка при закупуването.');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.emptyText}>VIP функцията не е активна</Text>
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
          <Text style={styles.headerTitle}>VIP Видимост</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Points Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <View>
              <Text style={styles.balanceLabel}>Налични точки</Text>
              <Text style={styles.balanceValue}>{pointsBalance}</Text>
            </View>
            <View style={styles.auctionStatus}>
              {config.isAuctionOpen ? (
                <>
                  <View style={[styles.statusDot, { backgroundColor: theme.colors.success.solid }]} />
                  <Text style={styles.statusText}>Търгът е отворен</Text>
                </>
              ) : (
                <>
                  <View style={[styles.statusDot, { backgroundColor: theme.colors.gray[400] }]} />
                  <Text style={styles.statusText}>Търгът е затворен</Text>
                </>
              )}
            </View>
          </View>
          {!config.isAuctionOpen && config.nextAuction?.startsAt && (
            <Text style={styles.nextAuction}>
              Следващ търг: {formatDate(config.nextAuction.startsAt)}
            </Text>
          )}
        </View>

        {/* Current Placements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            👑 Активни VIP слотове
          </Text>
          {placements.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Нямате активни VIP слотове</Text>
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
                      {placement.vipType === 'HOMEPAGE_VIP' ? 'Начална' : 'Търсене'}
                    </Text>
                  </View>
                  <Text style={styles.placementRank}>#{placement.rank}</Text>
                </View>
                <Text style={styles.placementCategory}>{placement.categoryLabelBg}</Text>
                {placement.city && (
                  <Text style={styles.placementCity}>{placement.city}</Text>
                )}
                <View style={styles.placementFooter}>
                  <Text style={styles.placementPoints}>{placement.pointsSpent} точки</Text>
                  <Text style={styles.placementExpires}>
                    до {formatDate(placement.expiresAt)}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Available Auctions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            🔨 Налични търгове
          </Text>
          {auctions.length === 0 ? (
            <View style={styles.emptySection}>
              <Text style={styles.emptySectionText}>Няма налични търгове</Text>
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
                      {auction.vipType === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'}
                    </Text>
                  </View>
                  <Text style={styles.slotsRemaining}>
                    {auction.slotsRemaining} свободни
                  </Text>
                </View>
                
                <Text style={styles.auctionCategory}>{auction.categoryLabelBg}</Text>
                {auction.city && (
                  <Text style={styles.auctionCity}>{auction.city}</Text>
                )}

                <View style={styles.auctionInfo}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Начална цена</Text>
                    <Text style={styles.infoValue}>{auction.startBidPoints} т.</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Buyout</Text>
                    <Text style={styles.infoValue}>{auction.buyoutPoints} т.</Text>
                  </View>
                  {auction.currentBid && (
                    <View style={styles.infoItem}>
                      <Text style={styles.infoLabel}>Твоята оферта</Text>
                      <Text style={[styles.infoValue, { color: theme.colors.success.solid }]}>
                        {auction.currentBid} т. (#{auction.currentRank})
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
                        <Text style={styles.actionButtonText}>➕ Кандидатствай</Text>
                      </TouchableOpacity>
                      
                      {auction.slotsRemaining > 0 && (
                        <TouchableOpacity
                          style={[styles.actionButton, styles.buyoutButton]}
                          onPress={() => handleBuyout(auction)}
                          disabled={actionLoading}
                        >
                          <Text style={styles.actionButtonText}>⚡ Buyout</Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                  
                  <TouchableOpacity
                    style={[styles.actionButton, styles.leaderboardButton]}
                    onPress={() => openLeaderboard(auction)}
                  >
                    <Text style={styles.actionButtonText}>🏆 Класация</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Как работи VIP?</Text>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>📅</Text>
            <Text style={styles.infoText}>Търгът е отворен всяка неделя от 00:00 до 22:00</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>👑</Text>
            <Text style={styles.infoText}>VIP се показва от понеделник до неделя (7 дни)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
            <Text style={styles.infoText}>Топ 3 оферти печелят VIP слот за седмицата</Text>
          </View>
        </View>

        {/* Button Explanations */}
        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>Какво правят бутоните?</Text>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>➕</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>Кандидатствай</Text> - Участвай в търга с оферта. Точките се удържат само ако спечелиш.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>⚡</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>Buyout</Text> - Мигновено закупуване на VIP слот. Точките се удържат веднага и гарантирано получаваш слот.
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🏆</Text>
            <Text style={styles.infoText}>
              <Text style={{ fontWeight: '600', color: '#fff' }}>Класация</Text> - Виж текущото класиране на всички оферти за този търг.
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
            <Text style={styles.modalTitle}>Наддаване</Text>
            <Text style={styles.modalSubtitle}>
              {selectedAuction?.categoryLabelBg} - {selectedAuction?.vipType === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'}
            </Text>
            
            {selectedAuction?.currentBid ? (
              <Text style={styles.currentBidText}>
                Твоята текуща оферта: {selectedAuction.currentBid} точки
              </Text>
            ) : (
              <Text style={styles.currentBidText}>
                Нямаш оферта за този търг
              </Text>
            )}

            <Text style={styles.inputLabel}>
              {selectedAuction?.currentBid 
                ? `Увеличение (мин. ${config?.minBidIncrement} точки)` 
                : `Оферта в точки`}
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
                <Text style={styles.cancelButtonText}>Отказ</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handlePlaceBid}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmButtonText}>Изпрати</Text>
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
            <Text style={styles.modalTitle}>Класация</Text>
            <Text style={styles.modalSubtitle}>
              {selectedAuction?.categoryLabelBg}
            </Text>

            {!config?.isAuctionOpen ? (
              <Text style={styles.leaderboardClosed}>Търгът не е активен</Text>
            ) : leaderboard.length === 0 ? (
              <Text style={styles.leaderboardEmpty}>Няма оферти</Text>
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
                      <Text style={styles.leaderboardBidAmount}>{entry.bidAmount} т.</Text>
                      {entry.isBuyout && (
                        <View style={styles.buyoutBadge}>
                          <Text style={styles.buyoutBadgeText}>Buyout</Text>
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
              <Text style={styles.closeButtonText}>Затвори</Text>
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
  nextAuction: {
    fontSize: 13,
    color: theme.colors.gray[300],
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
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
});

export default VipVisibilityScreen;
