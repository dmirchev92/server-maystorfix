import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
  Modal,
  ScrollView,
  Dimensions,
  Linking,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import CategoryService, { Category } from '../services/CategoryService';

// Fallback cities (used while loading from API)
const FALLBACK_CITIES = [
  { value: 'София', label: 'София' },
  { value: 'Пловдив', label: 'Пловдив' },
  { value: 'Варна', label: 'Варна' },
  { value: 'Бургас', label: 'Бургас' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function SearchScreen() {
  const { t } = useTranslation('common');
  const navigation = useNavigation<any>();
  const [providers, setProviders] = useState<any[]>([]);
  const [vipProviders, setVipProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    city: '',
    neighborhood: '',
  });
  
  // Profile modal state
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [providerReviews, setProviderReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  
  // Dynamic data
  const [serviceTypes, setServiceTypes] = useState<Category[]>([]);
  const [cities, setCities] = useState<{value: string; label: string}[]>(FALLBACK_CITIES);
  const [neighborhoods, setNeighborhoods] = useState<{value: string; label: string}[]>([]);

  // Helper to get Bulgarian label for a service category
  const getServiceCategoryLabel = (category: string): string => {
    if (!category) return '';
    const found = serviceTypes.find((c: Category) => c.id?.toLowerCase() === category.toLowerCase());
    return found ? found.label : category;
  };

  // Load categories and cities on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load categories
        const categories = await CategoryService.getInstance().getCategories();
        setServiceTypes(categories);
        
        // Load cities
        const response = await ApiService.getInstance().getCities();
        if (response.success && response.data?.cities) {
          setCities(response.data.cities.slice(0, 30));
        }
      } catch (error) {
        Logger.error('Error loading data:', error);
      }
    };
    loadData();
  }, []);
  
  // Load neighborhoods when city changes
  useEffect(() => {
    if (filters.city) {
      const loadNeighborhoods = async () => {
        try {
          const response = await ApiService.getInstance().getNeighborhoods(filters.city);
          if (response.success && response.data?.neighborhoods) {
            setNeighborhoods(response.data.neighborhoods);
          } else {
            setNeighborhoods([]);
          }
        } catch (error) {
          Logger.error('Error loading neighborhoods:', error);
          setNeighborhoods([]);
        }
      };
      loadNeighborhoods();
    } else {
      setNeighborhoods([]);
    }
  }, [filters.city]);

  useEffect(() => {
    fetchProviders();
  }, [filters.category, filters.city, filters.neighborhood]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50, t: Date.now() };
      if (filters.category) params.category = filters.category;
      if (filters.city) params.city = filters.city;
      if (filters.neighborhood) params.neighborhood = filters.neighborhood;

      const response = await ApiService.getInstance().searchProviders(params);
      
      if (response.success && response.data) {
        // Filter valid providers
        const validProviders = Array.isArray(response.data) 
          ? response.data 
          : (response.data as any).data || [];
          
        setProviders(validProviders);
        
        // Get VIP providers from response (check both response.data.vipProviders and response.vipProviders)
        const vipData = (response.data as any)?.vipProviders || (response as any).vipProviders || [];
        setVipProviders(vipData);
      } else {
        setProviders([]);
        setVipProviders([]);
      }
    } catch (error) {
      Logger.error('Error fetching providers:', error);
      setProviders([]);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryLabel = (value: string) => {
    if (!value) return '';
    const type = serviceTypes.find(t => 
      t.value?.toLowerCase() === value.toLowerCase() ||
      t.id?.toLowerCase() === value.toLowerCase() ||
      t.id?.toLowerCase() === value.replace('cat_', '').toLowerCase()
    );
    return type ? type.label : value;
  };

  const handleInquiry = (provider: any) => {
    navigation.navigate('CreateCase', {
      providerId: provider.id,
      providerName: provider.businessName || provider.business_name || 
        `${provider.firstName || ''} ${provider.lastName || ''}`.trim(),
      providerCategory: provider.serviceCategory || provider.service_category,
    });
  };

  const handleViewProfile = async (provider: any) => {
    setSelectedProvider(provider);
    setProfileModalVisible(true);
    
    // Fetch reviews for this provider
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `https://snapfix.bg/api/v1/reviews/provider/${provider.id}`
      );
      const data = await response.json();
      if (data.success && data.data) {
        const reviews = data.data.reviews || data.data || [];
        setProviderReviews(reviews);
      } else {
        setProviderReviews([]);
      }
    } catch (error) {
      Logger.error('Error fetching reviews:', error);
      setProviderReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  const closeProfileModal = () => {
    setProfileModalVisible(false);
    setSelectedProvider(null);
    setProviderReviews([]);
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

  // Helper to render category chips
  // For VIP cards: show ONLY the VIP category (the one they purchased VIP for)
  // For regular cards: show all categories
  const renderCategoryChips = (item: any, isVip: boolean = false) => {
    const categories = item.serviceCategories || item.service_categories || [];
    const singleCategory = item.serviceCategory || item.service_category;
    
    // For VIP cards, show only the VIP category (serviceCategory field)
    if (isVip && singleCategory) {
      return (
        <View style={styles.categoryChipsContainer}>
          <View style={[styles.categoryChip, styles.vipCategoryChip]}>
            <Text style={[styles.categoryChipText, styles.vipCategoryChipText]} numberOfLines={1}>
              {getCategoryLabel(singleCategory)}
            </Text>
          </View>
        </View>
      );
    }
    
    // For regular cards, show all categories
    if (categories.length > 0) {
      return (
        <View style={styles.categoryChipsContainer}>
          {categories.slice(0, 3).map((cat: string, idx: number) => (
            <View key={idx} style={[styles.categoryChip, isVip && styles.vipCategoryChip]}>
              <Text style={[styles.categoryChipText, isVip && styles.vipCategoryChipText]} numberOfLines={1}>
                {getCategoryLabel(cat)}
              </Text>
            </View>
          ))}
          {categories.length > 3 && (
            <View style={[styles.categoryChip, isVip && styles.vipCategoryChip]}>
              <Text style={[styles.categoryChipText, isVip && styles.vipCategoryChipText]}>+{categories.length - 3}</Text>
            </View>
          )}
        </View>
      );
    }
    
    // Fallback to single category
    return (
      <Text style={styles.providerCategory}>{getCategoryLabel(singleCategory)}</Text>
    );
  };

  // Render VIP provider card (with gold badge)
  const renderVipProvider = (item: any, index: number) => {
    const displayName = item.businessName || item.business_name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Specialist';
    const rating = item.rating || 0;
    const reviewCount = item.totalReviews || item.total_reviews || 0;
    const description = item.description || item.bio || '';

    return (
      <TouchableOpacity 
        key={item.id || index} 
        style={[styles.card, styles.vipCard]}
        onPress={() => handleViewProfile(item)}
        activeOpacity={0.8}
      >
        {/* VIP Badge */}
        <View style={styles.vipBadge}>
          <Text style={styles.vipBadgeText}>👑 VIP • {t('vipPaidVisibility')}</Text>
        </View>
        
        <View style={styles.cardHeader}>
          {item.profileImageUrl || item.profile_image_url ? (
            <Image source={{ uri: item.profileImageUrl || item.profile_image_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, styles.vipAvatarPlaceholder]}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.providerName} numberOfLines={1}>{displayName}</Text>
            {renderCategoryChips(item, true)}
          </View>
          <View style={[styles.ratingBadge, styles.vipRatingBadge]}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <Text style={styles.statText} numberOfLines={1}>📍 {item.city || 'София'}{item.neighborhood ? `, ${item.neighborhood}` : ''}</Text>
          <Text style={styles.statText}>⭐ {rating} ({reviewCount} {t('reviews')})</Text>
        </View>

        {description ? (
          <Text style={styles.description} numberOfLines={2}>
            {description}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.profileBtn, styles.vipProfileBtn]} onPress={() => handleViewProfile(item)}>
            <Text style={styles.btnText}>{t('viewProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.chatBtn, styles.vipChatBtn]} onPress={() => handleInquiry(item)}>
            <Text style={styles.btnText}>{t('inquiry')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProvider = ({ item }: { item: any }) => {
    const displayName = item.businessName || item.business_name || `${item.firstName || ''} ${item.lastName || ''}`.trim() || 'Specialist';
    const rating = item.rating || 0;
    const reviewCount = item.totalReviews || item.total_reviews || 0;
    const description = item.description || item.bio || '';

    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => handleViewProfile(item)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          {item.profileImageUrl || item.profile_image_url ? (
            <Image source={{ uri: item.profileImageUrl || item.profile_image_url }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.providerName} numberOfLines={1}>{displayName}</Text>
            {renderCategoryChips(item, false)}
          </View>
          <View style={styles.ratingBadge}>
            <Text style={styles.star}>⭐</Text>
            <Text style={styles.ratingText}>{Number(rating).toFixed(1)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
           <Text style={styles.statText} numberOfLines={1}>📍 {item.city || 'София'}{item.neighborhood ? `, ${item.neighborhood}` : ''}</Text>
           <Text style={styles.statText}>⭐ {rating} ({reviewCount} {t('reviews')})</Text>
        </View>

        {description ? (
          <Text style={styles.description} numberOfLines={3}>
            {description}
          </Text>
        ) : null}

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.profileBtn} onPress={() => handleViewProfile(item)}>
             <Text style={styles.btnText}>{t('viewProfile')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.chatBtn} onPress={() => handleInquiry(item)}>
             <Text style={styles.btnText}>{t('inquiry')}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.background}>
        <StatusBar barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('common:foundServices')}</Text>
          <TouchableOpacity 
            style={styles.mapButton}
            onPress={() => navigation.navigate('MapSearch')}
          >
             <Text style={styles.mapButtonText}>🗺️ Карта</Text>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <View style={styles.pickerWrapper}>
            <Picker
              selectedValue={filters.category}
              onValueChange={(val) => setFilters(prev => ({ ...prev, category: val }))}
              style={styles.picker}
              dropdownIconColor="white"
              mode="dialog"
            >
              <Picker.Item label="Всички услуги" value="" color="#ffffff" />
              {serviceTypes.map((t: Category) => <Picker.Item key={t.value || t.id} label={t.label} value={t.value || `cat_${t.id}`} color="#ffffff" />)}
            </Picker>
          </View>

          <View style={styles.row}>
            <View style={[styles.pickerWrapper, { flex: 1, marginRight: 8 }]}>
              <Picker
                selectedValue={filters.city}
                onValueChange={(val) => setFilters(prev => ({ ...prev, city: val, neighborhood: '' }))}
                style={styles.picker}
                dropdownIconColor="white"
                mode="dialog"
              >
                <Picker.Item label="Град" value="" color="#ffffff" />
                {cities.map(c => <Picker.Item key={c.value} label={c.label} value={c.value} color="#ffffff" />)}
              </Picker>
            </View>

            {filters.city && neighborhoods.length > 0 && (
              <View style={[styles.pickerWrapper, { flex: 1 }]}>
                 <Picker
                  selectedValue={filters.neighborhood}
                  onValueChange={(val) => setFilters(prev => ({ ...prev, neighborhood: val }))}
                  style={styles.picker}
                  dropdownIconColor="white"
                  mode="dialog"
                >
                  <Picker.Item label="Квартал" value="" color="#ffffff" />
                  {neighborhoods.map(n => <Picker.Item key={n.value} label={n.label} value={n.value} color="#ffffff" />)}
                </Picker>
              </View>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsBar}>
           <Text style={styles.statsText}>📊 Намерени {providers.length + vipProviders.length} услуги</Text>
           {vipProviders.length > 0 && (
             <Text style={styles.vipStatsText}>👑 {vipProviders.length} VIP</Text>
           )}
        </View>

        {/* List */}
        {loading ? (
          <ActivityIndicator size="large" color="#818cf8" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={providers}
            renderItem={renderProvider}
            keyExtractor={(item) => item.id || Math.random().toString()}
            contentContainerStyle={styles.listContent}
            ListHeaderComponent={
              vipProviders.length > 0 ? (
                <View style={styles.vipSection}>
                  <View style={styles.vipSectionHeader}>
                    <Text style={styles.vipSectionTitle}>👑 {t('vipSpecialists')}</Text>
                    <Text style={styles.vipSectionSubtitle}>{t('vipPaidVisibility')}</Text>
                  </View>
                  {vipProviders.map((item, index) => renderVipProvider(item, index))}
                  {providers.length > 0 && (
                    <View style={styles.sectionDivider}>
                      <Text style={styles.sectionDividerText}>{t('allResults')}</Text>
                    </View>
                  )}
                </View>
              ) : null
            }
            ListEmptyComponent={
              vipProviders.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>{t('noServicesFound')}</Text>
                  <Text style={styles.emptySubText}>{t('tryOtherCriteria')}</Text>
                </View>
              ) : null
            }
          />
        )}

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
              </View>

              {selectedProvider && (
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {/* Profile Header */}
                  <View style={styles.profileHeader}>
                    {selectedProvider.profileImageUrl ? (
                      <Image source={{ uri: selectedProvider.profileImageUrl }} style={styles.profileAvatar} />
                    ) : (
                      <View style={styles.profileAvatarPlaceholder}>
                        <Text style={styles.profileAvatarText}>
                          {(selectedProvider.businessName || selectedProvider.firstName || 'S').charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>
                        {selectedProvider.businessName || selectedProvider.business_name || 
                         `${selectedProvider.firstName || ''} ${selectedProvider.lastName || ''}`.trim() || 'Специалист'}
                      </Text>
                      <Text style={styles.profileCategory}>
                        {getCategoryLabel(selectedProvider.serviceCategory || selectedProvider.service_category)}
                      </Text>
                      <Text style={styles.profileLocation}>
                        📍 {selectedProvider.city || 'София'}{selectedProvider.neighborhood ? `, ${selectedProvider.neighborhood}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Rating Section */}
                  <View style={styles.ratingSection}>
                    <Text style={styles.ratingStars}>{renderStars(selectedProvider.rating || 0)}</Text>
                    <Text style={styles.modalRatingText}>
                      {Number(selectedProvider.rating || 0).toFixed(1)} ({selectedProvider.totalReviews || selectedProvider.total_reviews || 0} отзива)
                    </Text>
                  </View>

                  {/* Quick Info */}
                  <View style={styles.quickInfoSection}>
                    <Text style={styles.sectionTitle}>Бърза информация</Text>
                    <View style={styles.quickInfoGrid}>
                      <View style={styles.quickInfoItem}>
                        <Text style={styles.quickInfoIcon}>⭐</Text>
                        <Text style={styles.quickInfoLabel}>Опит</Text>
                        <Text style={styles.quickInfoValue}>{selectedProvider.experienceYears || selectedProvider.experience_years || 0} год.</Text>
                      </View>
                      <View style={styles.quickInfoItem}>
                        <Text style={styles.quickInfoIcon}>✅</Text>
                        <Text style={styles.quickInfoLabel}>Проекти</Text>
                        <Text style={styles.quickInfoValue}>{selectedProvider.completedProjects || 0}</Text>
                      </View>
                      <View style={styles.quickInfoItem}>
                        <Text style={styles.quickInfoIcon}>📍</Text>
                        <Text style={styles.quickInfoLabel}>Град</Text>
                        <Text style={styles.quickInfoValue} numberOfLines={1}>{selectedProvider.city || 'София'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Description */}
                  <View style={styles.descriptionSection}>
                    <Text style={styles.sectionTitle}>За мен</Text>
                    <Text style={styles.descriptionText}>
                      {selectedProvider.description || `Професионални ${getCategoryLabel(selectedProvider.serviceCategory || selectedProvider.service_category).toLowerCase()} услуги с качество и гаранция.`}
                    </Text>
                  </View>

                  {/* Services */}
                  <View style={styles.servicesSection}>
                    <Text style={styles.sectionTitle}>Предлагани услуги</Text>
                    {selectedProvider.offeredServices && selectedProvider.offeredServices.length > 0 ? (
                      selectedProvider.offeredServices.map((service: string, idx: number) => (
                        <View key={idx} style={styles.serviceItem}>
                          <Text style={styles.serviceIcon}>🔧</Text>
                          <Text style={styles.serviceText}>{service}</Text>
                        </View>
                      ))
                    ) : (
                      <>
                        <View style={styles.serviceItem}>
                          <Text style={styles.serviceIcon}>🔧</Text>
                          <Text style={styles.serviceText}>Основни {getCategoryLabel(selectedProvider.serviceCategory || selectedProvider.service_category).toLowerCase()} услуги</Text>
                        </View>
                        <View style={styles.serviceItem}>
                          <Text style={styles.serviceIcon}>🚨</Text>
                          <Text style={styles.serviceText}>Спешни повиквания</Text>
                        </View>
                        <View style={styles.serviceItem}>
                          <Text style={styles.serviceIcon}>📋</Text>
                          <Text style={styles.serviceText}>Консултации и оценки</Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Gallery */}
                  {selectedProvider.gallery && selectedProvider.gallery.length > 0 && (
                    <View style={styles.gallerySection}>
                      <Text style={styles.sectionTitle}>📸 Галерия</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {selectedProvider.gallery.map((imgUrl: string, idx: number) => (
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
                            <Text style={styles.reviewerName}>{review.customer_name || review.customerName || 'Клиент'}</Text>
                            <Text style={styles.reviewRating}>{renderStars(review.rating || 0)}</Text>
                          </View>
                          {/* Category Ratings */}
                          {(review.service_quality || review.communication || review.timeliness || review.value_for_money) ? (
                            <View style={styles.reviewCategories}>
                              {review.service_quality ? <Text style={styles.reviewCatItem}>🔧 Качество: {review.service_quality}/5</Text> : null}
                              {review.communication ? <Text style={styles.reviewCatItem}>💬 Комуникация: {review.communication}/5</Text> : null}
                              {review.timeliness ? <Text style={styles.reviewCatItem}>⏱ В срок: {review.timeliness}/5</Text> : null}
                              {review.value_for_money ? <Text style={styles.reviewCatItem}>💰 Цена: {review.value_for_money}/5</Text> : null}
                            </View>
                          ) : null}
                          {review.would_recommend !== undefined && review.would_recommend !== null ? (
                            <Text style={styles.reviewRecommend}>{review.would_recommend ? '👍 Препоръчва' : '👎 Не препоръчва'}</Text>
                          ) : null}
                          <Text style={styles.reviewText}>{review.comment || 'Няма коментар'}</Text>
                          <Text style={styles.reviewDate}>
                            {(review.created_at || review.createdAt) ? new Date(review.created_at || review.createdAt).toLocaleDateString('bg-BG') : ''}
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
                      style={styles.chatButtonLarge} 
                      onPress={() => {
                        closeProfileModal();
                        handleInquiry(selectedProvider);
                      }}
                    >
                      <Text style={styles.actionButtonText}>� Пусни запитване</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Spacer at bottom */}
                  <View style={{ height: 40 }} />
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  mapButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pickerWrapper: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    color: 'white',
  },
  row: {
    flexDirection: 'row',
  },
  statsBar: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  statsText: {
    color: '#a5b4fc', // indigo-300
    fontSize: 14,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4f46e5', // indigo-600
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  providerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  providerCategory: {
    color: '#cbd5e1', // slate-300
    fontSize: 14,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  star: {
    fontSize: 12,
    marginRight: 4,
  },
  ratingText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  tag: {
    backgroundColor: 'rgba(79, 70, 229, 0.2)', // indigo-500/20
    borderColor: 'rgba(129, 140, 248, 0.3)', // indigo-400/30
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 6,
  },
  tagText: {
    color: '#a5b4fc', // indigo-300
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  statText: {
    color: '#cbd5e1', // slate-300
    fontSize: 13,
  },
  description: {
    color: '#e2e8f0', // slate-200
    fontSize: 14,
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 8,
    borderRadius: 8,
    fontStyle: 'italic',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  profileBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chatBtn: {
    flex: 1,
    backgroundColor: '#4f46e5', // indigo-600
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubText: {
    color: '#94a3b8', // slate-400
    fontSize: 14,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    paddingBottom: 16,
  },
  closeButton: {
    paddingVertical: 8,
  },
  closeButtonText: {
    color: '#a5b4fc',
    fontSize: 16,
    fontWeight: '600',
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
  servicesSection: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 8,
  },
  serviceIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  serviceText: {
    color: '#e2e8f0',
    fontSize: 14,
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
  reviewCategories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
    marginTop: 4,
  },
  reviewCatItem: {
    color: '#94a3b8',
    fontSize: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewRecommend: {
    color: '#a5b4fc',
    fontSize: 12,
    marginBottom: 6,
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
  callButton: {
    flex: 1,
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatButtonLarge: {
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
  // VIP Styles
  vipStatsText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  vipSection: {
    marginBottom: 8,
  },
  vipSectionHeader: {
    marginBottom: 12,
  },
  vipSectionTitle: {
    color: '#FFD700',
    fontSize: 18,
    fontWeight: 'bold',
  },
  vipSectionSubtitle: {
    color: '#a5b4fc',
    fontSize: 12,
    marginTop: 2,
  },
  sectionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionDividerText: {
    color: '#a5b4fc',
    fontSize: 14,
    fontWeight: '600',
  },
  vipCard: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
  },
  vipBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  vipBadgeText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
  },
  vipAvatarPlaceholder: {
    backgroundColor: '#B8860B',
  },
  vipRatingBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
  },
  vipProfileBtn: {
    backgroundColor: '#B8860B',
  },
  vipChatBtn: {
    backgroundColor: '#DAA520',
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  categoryChip: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  categoryChipText: {
    color: '#a5b4fc',
    fontSize: 11,
    fontWeight: '500',
  },
  vipCategoryChip: {
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  vipCategoryChipText: {
    color: '#FFD700',
  },
});

export default SearchScreen;
