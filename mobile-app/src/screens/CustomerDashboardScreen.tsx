import { Logger } from '../utils/Logger';
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Dimensions,
  Alert,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getCategoryLabel } from '../constants/serviceCategories';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import { AuthBus } from '../utils/AuthBus';
import theme from '../styles/theme';

const { width } = Dimensions.get('window');

export default function CustomerDashboardScreen() {
  const { t } = useTranslation('dashboard');
  const navigation = useNavigation<any>();
  const [user, setUser] = useState<any>(null);
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [activeCasesCount, setActiveCasesCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [vipProviders, setVipProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // VIP Profile Modal state
  const [selectedVip, setSelectedVip] = useState<any>(null);
  const [vipModalVisible, setVipModalVisible] = useState(false);
  const [vipReviews, setVipReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchDashboardData();
      }
    }, [user])
  );

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      if (response.success && response.data) {
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        setUser(userData);
      }
    } catch (error) {
      Logger.error('Error loading user:', error);
    }
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    
    try {
      // Fetch active cases
      const casesResponse = await ApiService.getInstance().getCasesWithFilters({
        customerId: user.id,
        limit: 10,
      });

      if (casesResponse.success && casesResponse.data) {
        const cases = casesResponse.data.cases || [];
        setRecentCases(cases);
        // Count active (not completed/cancelled)
        const active = cases.filter((c: any) => 
          ['pending', 'accepted', 'in_progress'].includes(c.status)
        ).length;
        setActiveCasesCount(active);
      }

      // Fetch unread messages (mock or real API)
      // For now, we'll just set it to 0 or fetch if endpoint exists
      // const messagesResponse = await ApiService.getInstance().getUnreadCount();
      // setUnreadMessagesCount(messagesResponse.count);

      // Fetch VIP providers for homepage
      try {
        const vipResponse = await ApiService.getInstance().getVipHomepageProviders();
        if (vipResponse.success && vipResponse.data) {
          setVipProviders(vipResponse.data.slice(0, 6));
        }
      } catch (vipError) {
        Logger.debug('VIP providers not available:', vipError);
      }

    } catch (error) {
      Logger.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
    setRefreshing(false);
  };

  const handleViewVipProfile = async (provider: any) => {
    setSelectedVip(provider);
    setVipModalVisible(true);
    
    // Fetch reviews for this provider
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `https://snapfix.bg/api/v1/reviews/provider/${provider.userId || provider.id}`
      );
      const data = await response.json();
      if (data.success && data.data) {
        const reviews = data.data.reviews || data.data || [];
        setVipReviews(reviews);
      } else {
        setVipReviews([]);
      }
    } catch (error) {
      Logger.error('Error fetching reviews:', error);
      setVipReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const closeVipModal = () => {
    setVipModalVisible(false);
    setSelectedVip(null);
    setVipReviews([]);
  };

  const handleCallProvider = (phone: string | null | undefined) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert(t('noPhone'), t('noPhoneMessage'));
    }
  };

  const handleChatWithProvider = (provider: any) => {
    closeVipModal();
    navigation.navigate('ChatDetail', {
      conversationId: `new_${provider.userId || provider.id}`,
      providerName: provider.businessName || provider.providerName || 'Специалист',
      providerId: provider.userId || provider.id
    });
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

  const handleLogout = async () => {
    Alert.alert(
      t('logout'),
      t('logoutConfirm'),
      [
        { text: t('cancel'), style: 'cancel' },
        { 
          text: t('logout'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await ApiService.getInstance().logout();
            } catch (error) {
              Logger.error('Logout error:', error);
            }
            // Emit logout event to trigger app-wide logout
            AuthBus.emit('logout');
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
    <ScrollView
      style={styles.scrollContainer}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}` : 'CL'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.welcomeText}>{t('welcome')}</Text>
            <Text style={styles.userName}>
              {user ? `${user.firstName} ${user.lastName}` : t('client')}
            </Text>
            <View style={styles.serviceTypesContainer}>
              <Text style={styles.userRole}>{t('client')}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.settingsIconButton} onPress={handleLogout}>
          <Text style={styles.settingsIcon}>🚪</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <View style={styles.kpiRowNew}>
        <View style={[styles.kpiCard, styles.kpiActive]}>
          <Text style={styles.kpiValue}>{activeCasesCount}</Text>
          <View style={styles.kpiLabelRow}>
            <Text style={styles.kpiIcon}>📋</Text>
            <Text style={styles.kpiLabelText}>{t('activeCases')}</Text>
          </View>
        </View>
        <View style={[styles.kpiCard, styles.kpiMessages]}>
          <Text style={styles.kpiValue}>{unreadMessagesCount}</Text>
          <View style={styles.kpiLabelRow}>
            <Text style={styles.kpiIcon}>💬</Text>
            <Text style={styles.kpiLabelText}>{t('messages')}</Text>
          </View>
        </View>
      </View>

      {/* Quick Actions Grid */}
      <View style={styles.navigationGrid}>
        <Text style={styles.navigationTitle}>{t('quickActions')}</Text>
        
        <View style={styles.navigationRow}>
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('CreateCase')}
          >
            <Text style={styles.navIcon}>➕</Text>
            <Text style={styles.navLabel}>{t('newCase')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('MyCases')}
          >
            <Text style={styles.navIcon}>📋</Text>
            <Text style={styles.navLabel}>{t('myCases')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Search')}
          >
            <Text style={styles.navIcon}>🔍</Text>
            <Text style={styles.navLabel}>{t('search')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.navigationRow}>
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Chat')}
          >
            <Text style={styles.navIcon}>💬</Text>
            <Text style={styles.navLabel}>{t('chat')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.navCard, styles.navCardMap]} 
            onPress={() => navigation.getParent()?.navigate('MapSearch')}
          >
            <Text style={styles.navIcon}>🗺️</Text>
            <Text style={styles.navLabel}>{t('map')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.navCard} 
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.navIcon}>⚙️</Text>
            <Text style={styles.navLabel}>{t('settings')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VIP Providers Section */}
      {vipProviders.length > 0 && (
        <View style={styles.vipSection}>
          <View style={styles.vipHeader}>
            <Text style={styles.vipTitle}>👑 {t('vipSpecialists')}</Text>
            <Text style={styles.vipSubtitle}>{t('paidVisibility')}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vipScroll}>
            {vipProviders.map((provider, index) => (
              <TouchableOpacity 
                key={provider.userId || index} 
                style={styles.vipProviderCard}
                onPress={() => handleViewVipProfile(provider)}
              >
                <View style={styles.vipBadge}>
                  <Text style={styles.vipBadgeText}>👑 VIP</Text>
                </View>
                <View style={styles.vipAvatar}>
                  {provider.profileImageUrl ? (
                    <Image source={{ uri: provider.profileImageUrl }} style={styles.vipAvatarImage} />
                  ) : (
                    <Text style={styles.vipAvatarText}>
                      {(provider.businessName || provider.providerName || 'S').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.vipProviderName} numberOfLines={2}>
                  {provider.businessName || provider.providerName || 'Специалист'}
                </Text>
                <Text style={styles.vipProviderCategory} numberOfLines={1}>
                  {provider.categoryLabelBg || provider.categoryId || ''}
                </Text>
                <View style={styles.vipRating}>
                  <Text style={styles.vipRatingText}>⭐ {(provider.rating || 0).toFixed(1)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Recent Activity / Tips could go here */}
      <View style={styles.promoCard}>
        <Text style={styles.promoTitle}>{t('findProfessional')}</Text>
        <Text style={styles.promoText}>
          {t('findProfessionalText')}
        </Text>
      </View>

    </ScrollView>

      {/* VIP Profile Modal */}
      <Modal
        visible={vipModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeVipModal}
      >
        <View style={styles.modalContainer}>
          <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.modalGradient}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={closeVipModal} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>← {t('back')}</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>👑 {t('vipProfile')}</Text>
            </View>

            {selectedVip && (
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={styles.profileHeader}>
                  {selectedVip.profileImageUrl ? (
                    <Image 
                      source={{ uri: selectedVip.profileImageUrl }} 
                      style={styles.profileAvatar} 
                    />
                  ) : (
                    <View style={styles.profileAvatarPlaceholder}>
                      <Text style={styles.profileAvatarText}>
                        {(selectedVip.businessName || selectedVip.providerName || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <View style={styles.vipBadgeModal}>
                      <Text style={styles.vipBadgeTextModal}>👑 VIP</Text>
                    </View>
                    <Text style={styles.profileName}>
                      {selectedVip.businessName || selectedVip.providerName || 'Специалист'}
                    </Text>
                    <Text style={styles.profileCategory}>
                      {getCategoryLabel(selectedVip.categoryId || selectedVip.serviceCategory || '')}
                    </Text>
                    <Text style={styles.profileLocation}>
                      📍 {selectedVip.city || 'София'}
                      {selectedVip.neighborhood ? `, ${selectedVip.neighborhood}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Rating Section */}
                <View style={styles.ratingSection}>
                  <Text style={styles.ratingStars}>
                    {renderStars(selectedVip.rating || 0)}
                  </Text>
                  <Text style={styles.modalRatingText}>
                    {Number(selectedVip.rating || 0).toFixed(1)} ({selectedVip.totalReviews || 0} отзива)
                  </Text>
                </View>

                {/* Quick Info */}
                <View style={styles.quickInfoSection}>
                  <Text style={styles.sectionTitle}>{t('quickInfo')}</Text>
                  <View style={styles.quickInfoGrid}>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>⭐</Text>
                      <Text style={styles.quickInfoLabel}>{t('experience')}</Text>
                      <Text style={styles.quickInfoValue}>
                        {selectedVip.experienceYears || 0} {t('years')}
                      </Text>
                    </View>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>📞</Text>
                      <Text style={styles.quickInfoLabel}>{t('phone')}</Text>
                      <Text style={styles.quickInfoValue} numberOfLines={1}>
                        {selectedVip.phoneNumber || t('common:none')}
                      </Text>
                    </View>
                    <View style={styles.quickInfoItem}>
                      <Text style={styles.quickInfoIcon}>💰</Text>
                      <Text style={styles.quickInfoLabel}>{t('pricePerHour')}</Text>
                      <Text style={styles.quickInfoValue} numberOfLines={1}>
                        {selectedVip.hourlyRate ? `${selectedVip.hourlyRate} €` : t('negotiable')}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <View style={styles.descriptionSection}>
                  <Text style={styles.sectionTitle}>{t('aboutMe')}</Text>
                  <Text style={styles.descriptionText}>
                    {selectedVip.description || 
                     `Професионални ${getCategoryLabel(selectedVip.categoryId || selectedVip.serviceCategory || '').toLowerCase()} услуги с качество и гаранция.`}
                  </Text>
                </View>

                {/* Gallery */}
                {selectedVip.gallery && selectedVip.gallery.length > 0 && (
                  <View style={styles.gallerySection}>
                    <Text style={styles.sectionTitle}>📸 {t('gallery')}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {selectedVip.gallery.map((imgUrl: string, idx: number) => (
                        <TouchableOpacity key={idx} onPress={() => Linking.openURL(imgUrl)}>
                          <Image source={{ uri: imgUrl }} style={styles.galleryImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Reviews */}
                <View style={styles.reviewsSection}>
                  <Text style={styles.sectionTitle}>🌟 {t('reviews')}</Text>
                  {reviewsLoading ? (
                    <ActivityIndicator color="#818cf8" style={{ marginVertical: 20 }} />
                  ) : vipReviews.length > 0 ? (
                    vipReviews.slice(0, 5).map((review: any, idx: number) => (
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
                    onPress={() => handleCallProvider(selectedVip.phoneNumber)}
                  >
                    <Text style={styles.actionButtonText}>📞 Обади се</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.chatButtonModal} 
                    onPress={() => handleChatWithProvider(selectedVip)}
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
    backgroundColor: '#0f172a', // slate-900
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#1e293b', // slate-800
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo-500/20
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#6366f1', // indigo-500
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#a5b4fc', // indigo-300
  },
  userInfo: {
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 12,
    color: '#94a3b8', // slate-400
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff', // white
  },
  serviceTypesContainer: {
    flexDirection: 'row',
    marginTop: 4,
  },
  userRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981', // emerald-500
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // emerald-500/15
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)', // emerald-500/30
    alignSelf: 'flex-start',
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 20,
  },
  
  // KPI Cards
  kpiRowNew: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  kpiActive: {
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6', // blue-500
  },
  kpiMessages: {
    borderLeftWidth: 4,
    borderLeftColor: '#8B5CF6', // violet-500
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff', // white
    marginBottom: 4,
  },
  kpiLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  kpiIcon: {
    fontSize: 14,
    marginRight: 6,
    color: '#94a3b8', // slate-400
  },
  kpiLabelText: {
    fontSize: 14,
    color: '#94a3b8', // slate-400
    fontWeight: '500',
  },

  // Navigation Grid
  navigationGrid: {
    padding: 16,
  },
  navigationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#cbd5e1', // slate-300
    marginBottom: 12,
    marginLeft: 4,
  },
  navigationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  navCard: {
    flex: 1,
    backgroundColor: '#1e293b', // slate-800
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    aspectRatio: 1, // Make it square
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  navCardMap: {
    borderColor: '#10b981', // emerald-500
    borderWidth: 2,
  },
  navCardEmpty: {
    flex: 1,
  },
  navIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  navLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#cbd5e1', // slate-300
    textAlign: 'center',
  },

  // Promo Card
  promoCard: {
    margin: 16,
    marginTop: 0,
    backgroundColor: '#4f46e5', // indigo-600
    borderRadius: 16,
    padding: 20,
    shadowColor: '#4f46e5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  promoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  promoText: {
    fontSize: 14,
    color: '#e0e7ff', // indigo-100
    lineHeight: 20,
  },
  // VIP Styles
  vipSection: {
    margin: 16,
    marginBottom: 8,
  },
  vipHeader: {
    marginBottom: 12,
  },
  vipTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  vipSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  vipScroll: {
    marginLeft: -4,
  },
  vipProviderCard: {
    width: 160,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFD700',
    alignItems: 'center',
  },
  vipBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginBottom: 8,
  },
  vipBadgeText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  vipAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8860B',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  vipAvatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  vipAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  vipProviderName: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 2,
    lineHeight: 16,
  },
  vipProviderCategory: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  vipRating: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  vipRatingText: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
  },
  // Modal styles
  scrollContainer: {
    flex: 1,
  },
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
    backgroundColor: '#B8860B',
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
  vipBadgeModal: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  vipBadgeTextModal: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: 'bold',
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
