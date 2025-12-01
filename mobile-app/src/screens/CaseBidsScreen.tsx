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
  Modal,
  Image,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/ApiService';
import { RootStackParamList } from '../navigation/types';
import { getCategoryLabel } from '../constants/serviceCategories';

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
  provider_service_category?: string | null;
  provider_city?: string | null;
  provider_neighborhood?: string | null;
  provider_description?: string | null;
  provider_experience_years?: number | null;
  provider_profile_image_url?: string | null;
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
  
  // Profile modal state
  const [selectedBid, setSelectedBid] = useState<Bid | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [providerReviews, setProviderReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [providerDetails, setProviderDetails] = useState<any>(null);

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

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 >= 0.5;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push('⭐');
    }
    if (hasHalf && stars.length < 5) {
      stars.push('⭐');
    }
    while (stars.length < 5) {
      stars.push('☆');
    }
    return stars.join('');
  };

  const handleViewProviderProfile = async (bid: Bid) => {
    setSelectedBid(bid);
    setProfileModalVisible(true);
    
    // Fetch full provider details
    try {
      const response = await ApiService.getInstance().searchProviders({ limit: 1 });
      // Try to find provider by ID in search results or fetch directly
      const providerRes = await fetch(
        `https://maystorfix.com/api/v1/marketplace/providers?id=${bid.provider_id}`
      );
      const providerData = await providerRes.json();
      if (providerData.success && providerData.data) {
        const providers = Array.isArray(providerData.data) ? providerData.data : [providerData.data];
        const found = providers.find((p: any) => p.id === bid.provider_id);
        if (found) {
          setProviderDetails(found);
        }
      }
    } catch (error) {
      console.error('Error fetching provider details:', error);
    }
    
    // Fetch reviews for this provider
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `https://maystorfix.com/api/v1/reviews/provider/${bid.provider_id}`
      );
      const data = await response.json();
      if (data.success && data.data) {
        const reviews = data.data.reviews || data.data || [];
        setProviderReviews(reviews);
      } else {
        setProviderReviews([]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setProviderReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalVisible(false);
    setSelectedBid(null);
    setProviderReviews([]);
    setProviderDetails(null);
  };

  const handleCallProvider = (phone: string | null | undefined) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Няма телефон', 'Този специалист не е предоставил телефонен номер.');
    }
  };

  const handleChatWithProvider = (bid: Bid) => {
    closeProfileModal();
    navigation.navigate('ChatDetail', {
      conversationId: `new_${bid.provider_id}`,
      providerName: getProviderDisplayName(bid),
      providerId: bid.provider_id
    });
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

              {/* Provider Info - Clickable to view profile */}
              <TouchableOpacity 
                style={styles.providerInfo}
                onPress={() => handleViewProviderProfile(bid)}
                activeOpacity={0.7}
              >
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
                <View style={styles.viewProfileBadge}>
                  <Text style={styles.viewProfileText}>👤 Профил</Text>
                </View>
              </TouchableOpacity>

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

      {/* Provider Profile Modal */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeProfileModal}
      >
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.modalGradient}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeProfileModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>← Назад</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Профил на специалист</Text>
            </View>

            {selectedBid && (
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                  {(providerDetails?.profileImageUrl || selectedBid.provider_profile_image_url) ? (
                    <Image 
                      source={{ uri: providerDetails?.profileImageUrl || selectedBid.provider_profile_image_url }} 
                      style={styles.profileAvatar} 
                    />
                  ) : (
                    <View style={styles.profileAvatarPlaceholder}>
                      <Text style={styles.profileAvatarText}>
                        {(getProviderDisplayName(selectedBid) || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>
                      {getProviderDisplayName(selectedBid)}
                    </Text>
                    <Text style={styles.profileCategory}>
                      {getCategoryLabel(providerDetails?.serviceCategory || selectedBid.provider_service_category || '')}
                    </Text>
                    <Text style={styles.profileLocation}>
                      📍 {providerDetails?.city || selectedBid.provider_city || 'София'}
                      {(providerDetails?.neighborhood || selectedBid.provider_neighborhood) 
                        ? `, ${providerDetails?.neighborhood || selectedBid.provider_neighborhood}` 
                        : ''}
                    </Text>
                  </View>
                </View>

                {/* Rating Section */}
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingStars}>
                    {renderStars(selectedBid.provider_rating || providerDetails?.rating || 0)}
                  </Text>
                  <Text style={styles.modalRatingText}>
                    {Number(selectedBid.provider_rating || providerDetails?.rating || 0).toFixed(1)} ({providerDetails?.totalReviews || 0} отзива)
                  </Text>
                </View>

                {/* Quick Info */}
                <View style={styles.quickInfoSection}>
                  <Text style={styles.sectionTitle}>Бърза информация</Text>
                  <View style={styles.quickInfoGrid}>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>⭐</Text>
                      <Text style={styles.quickInfoLabel}>Опит</Text>
                      <Text style={styles.quickInfoValue}>
                        {providerDetails?.experienceYears || selectedBid.provider_experience_years || 0} год.
                      </Text>
                    </View>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>📞</Text>
                      <Text style={styles.quickInfoLabel}>Телефон</Text>
                      <Text style={styles.quickInfoValue} numberOfLines={1}>
                        {selectedBid.provider_phone || providerDetails?.phoneNumber || 'Няма'}
                      </Text>
                    </View>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>💰</Text>
                      <Text style={styles.quickInfoLabel}>Оферта</Text>
                      <Text style={styles.quickInfoValue} numberOfLines={1}>
                        {selectedBid.proposed_budget_range || 'Не е посочена'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionTitle}>За мен</Text>
                  <Text style={styles.descriptionText}>
                    {providerDetails?.description || selectedBid.provider_description || 
                     `Професионални ${getCategoryLabel(providerDetails?.serviceCategory || selectedBid.provider_service_category || '').toLowerCase()} услуги с качество и гаранция.`}
                  </Text>
                </View>

                {/* Bid Comment */}
                {selectedBid.bid_comment && (
                  <View style={styles.bidCommentSection}>
                    <Text style={styles.sectionTitle}>💬 Коментар към офертата</Text>
                    <Text style={styles.bidCommentText}>"{selectedBid.bid_comment}"</Text>
                  </View>
                )}

                {/* Gallery */}
                {providerDetails?.gallery && providerDetails.gallery.length > 0 && (
                  <View style={styles.gallerySection}>
                    <Text style={styles.sectionTitle}>📸 Галерия</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {providerDetails.gallery.map((imgUrl: string, idx: number) => (
                        <TouchableOpacity key={idx} onPress={() => Linking.openURL(imgUrl)}>
                          <Image source={{ uri: imgUrl }} style={styles.galleryImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Reviews */}
                <View style={styles.reviewsSection}>
                  <Text style={styles.sectionTitle}>🌟 Отзиви</Text>
                  {reviewsLoading ? (
                    <ActivityIndicator color="#818cf8" style={{ marginVertical: 20 }} />
                  ) : providerReviews.length > 0 ? (
                    providerReviews.slice(0, 5).map((review: any, idx: number) => (
                      <View key={idx} style={styles.reviewCard}>
                        <View style={styles.reviewHeader}>
                          <Text style={styles.reviewerName}>{review.customerName || 'Клиент'}</Text>
                          <Text style={styles.reviewRating}>{renderStars(review.rating || 0)}</Text>
                        </View>
                        <Text style={styles.reviewText}>{review.comment || 'Няма коментар'}</Text>
                        <Text style={styles.reviewDate}>
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('bg-BG') : ''}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noReviewsText}>Все още няма отзиви</Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={styles.callButtonModal} 
                    onPress={() => handleCallProvider(selectedBid.provider_phone || providerDetails?.phoneNumber)}
                  >
                    <Text style={styles.actionButtonText}>📞 Обади се</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.chatButtonModal} 
                    onPress={() => handleChatWithProvider(selectedBid)}
                  >
                    <Text style={styles.actionButtonText}>💬 Чат</Text>
                  </TouchableOpacity>
                </View>

                {/* Spacer at bottom */}
                <View style={{ height: 40 }} />
              </ScrollView>
            )}
          </LinearGradient>
        </View>
      </Modal>
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
  // View Profile Badge
  viewProfileBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  viewProfileText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    gap: 12,
  },
  closeButton: {
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#4f46e5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileAvatarText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 16,
  },
  profileName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  profileCategory: {
    color: '#a5b4fc',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileLocation: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  ratingSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
  },
  ratingStars: {
    fontSize: 20,
    marginRight: 10,
  },
  modalRatingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  quickInfoSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  quickInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  quickInfoItem: {
    alignItems: 'center',
  },
  quickInfoIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  quickInfoLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },
  quickInfoValue: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  descriptionSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  descriptionText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  bidCommentSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  bidCommentText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  gallerySection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  galleryImage: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reviewsSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerName: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  reviewRating: {
    fontSize: 12,
  },
  reviewText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewDate: {
    color: '#64748b',
    fontSize: 12,
  },
  noReviewsText: {
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 20,
    fontStyle: 'italic',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  callButtonModal: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatButtonModal: {
    flex: 1,
    backgroundColor: '#4f46e5',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
