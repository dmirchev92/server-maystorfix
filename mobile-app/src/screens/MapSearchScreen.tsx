import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
  Alert,
  FlatList,
  Image,
  ScrollView,
  ActivityIndicator,
  Modal,
  Linking,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import LinearGradient from 'react-native-linear-gradient';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, MapMarker, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from '../services/ApiService';
import CategoryService, { Category } from '../services/CategoryService';
import BidButton from '../components/BidButton';

const { width, height } = Dimensions.get('window');

// Distance options in km
const DISTANCE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

// Increase provider limit since we have clustering now
const PROVIDER_LIMIT = 150;

// Sofia Center
const INITIAL_REGION = {
  latitude: 42.6977,
  longitude: 23.3219,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);

  // User role detection
  const [isProvider, setIsProvider] = useState(false);
  const [userLoaded, setUserLoaded] = useState(false);
  const [subscriptionTier, setSubscriptionTier] = useState<string>('free');
  
  // All tiers can now view cases on map
  const canViewCasesOnMap = true;

  // Separate state for map view region vs search location
  const [region, setRegion] = useState(INITIAL_REGION);
  const [lastSearchLocation, setLastSearchLocation] = useState(INITIAL_REGION);

  const [providers, setProviders] = useState<any[]>([]);
  const [cases, setCases] = useState<any[]>([]); // For provider view
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<any>(null); // For provider view
  const [bidding, setBidding] = useState(false);
  
  // Filter states
  const [selectedRadius, setSelectedRadius] = useState<number>(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<Category[]>([]);

  // Helper to get Bulgarian label for a service category
  const getServiceCategoryLabel = (category: string): string => {
    if (!category) return '';
    const found = serviceCategories.find((c: Category) => 
      c.id?.toLowerCase() === category.toLowerCase() || 
      c.value?.toLowerCase() === category.toLowerCase()
    );
    return found ? found.label : category;
  };

  // Free Inspection states (for customers)
  const [freeInspectionAlertsEnabled, setFreeInspectionAlertsEnabled] = useState(false);
  const [freeInspectionRadius, setFreeInspectionRadius] = useState<number>(3);
  const [freeInspectionCategory, setFreeInspectionCategory] = useState<string>(''); // Separate category for free inspection
  const [showOnlyFreeInspection, setShowOnlyFreeInspection] = useState(false);
  const [freeInspectionPrefsLoaded, setFreeInspectionPrefsLoaded] = useState(false);

  // Profile modal state
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profileProvider, setProfileProvider] = useState<any>(null);
  const [providerReviews, setProviderReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // Load user role and subscription tier on mount
  useEffect(() => {
    const loadUserRole = async () => {
      try {
        // Try 'user' key first (main storage), then 'user_data' as fallback
        let userData = await AsyncStorage.getItem('user');
        if (!userData) {
          userData = await AsyncStorage.getItem('user_data');
        }
        console.log('🔍 MapSearchScreen - Raw user data:', userData);
        if (userData) {
          const user = JSON.parse(userData);
          console.log('🔍 MapSearchScreen - User role:', user.role);
          console.log('🔍 MapSearchScreen - Subscription tier:', user.subscription_tier_id);
          // Check for both tradesperson and service_provider roles
          const isProviderRole = user.role === 'tradesperson' || user.role === 'service_provider';
          console.log('🔍 MapSearchScreen - Is Provider:', isProviderRole);
          setIsProvider(isProviderRole);
          // Set subscription tier
          setSubscriptionTier(user.subscription_tier_id || 'free');
        } else {
          console.log('🔍 MapSearchScreen - No user data found, defaulting to customer view');
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      } finally {
        setUserLoaded(true);
      }
    };
    loadUserRole();
  }, []);

  // Load service categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        const categories = await CategoryService.getInstance().getCategories();
        setServiceCategories(categories);
      } catch (error) {
        console.error('Error loading categories:', error);
      }
    };
    loadCategories();
  }, []);

  // Load free inspection preferences for customers
  useEffect(() => {
    const loadFreeInspectionPrefs = async () => {
      if (isProvider || !userLoaded) return;
      
      try {
        console.log('🔧 MapSearchScreen - Loading free inspection preferences');
        const response = await ApiService.getInstance().getFreeInspectionPreferences();
        if (response.success && response.data) {
          setFreeInspectionAlertsEnabled(response.data.enabled || false);
          setFreeInspectionRadius(response.data.radiusKm || 3);
          // Handle categories - take first one if array, or use as-is if string
          const cats = response.data.categories;
          setFreeInspectionCategory(Array.isArray(cats) && cats.length > 0 ? cats[0] : '');
          setShowOnlyFreeInspection(response.data.showOnlyFreeInspection || false);
          console.log('🔧 Free inspection prefs loaded:', response.data);
        }
      } catch (error) {
        console.error('Error loading free inspection preferences:', error);
      } finally {
        setFreeInspectionPrefsLoaded(true);
      }
    };
    
    if (userLoaded && !isProvider) {
      loadFreeInspectionPrefs();
    }
  }, [userLoaded, isProvider]);

  // Auto-zoom to user location on mount - wait for user role to be loaded
  useEffect(() => {
    if (!userLoaded) return;
    
    // Try to get user's location first
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userLocation = {
          latitude,
          longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        };
        console.log('📍 Got user location:', latitude, longitude, 'isProvider:', isProvider);
        setRegion(userLocation);
        
        // Animate to user location after map is ready
        setTimeout(() => {
          mapRef.current?.animateToRegion(userLocation, 1000);
        }, 500);
        
        // Fetch data based on user role and tier
        // Only PRO providers can view cases on map
        if (isProvider && canViewCasesOnMap) {
          fetchCases(userLocation);
        } else if (!isProvider) {
          fetchProviders(userLocation);
        }
        // Free/Normal providers: don't fetch cases, just show map for location sharing
      },
      (error) => {
        console.log('📍 Location error, using Sofia default:', error.message);
        // Fallback to Sofia if location fails
        if (isProvider && canViewCasesOnMap) {
          fetchCases(INITIAL_REGION);
        } else if (!isProvider) {
          fetchProviders(INITIAL_REGION);
        }
        
        if (Platform.OS === 'android') {
          setTimeout(() => {
            mapRef.current?.animateToRegion(INITIAL_REGION, 1000);
          }, 500);
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000
      }
    );
  }, [userLoaded, isProvider, canViewCasesOnMap]);

  const onMapLayout = () => {
    if (!mapReady) {
      setMapReady(true);
      // Don't override - let useEffect handle the initial region based on user location
    }
  };

  // Helper for safe coordinate parsing
  const parseCoord = (val: any) => {
    let res = 0;
    if (typeof val === 'number') res = val;
    else if (typeof val === 'string') res = Number(val.replace(',', '.'));

    if (isNaN(res)) return 0;
    return res;
  };

  const fetchProviders = async (searchRegion: typeof INITIAL_REGION) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      console.log('🔍 MapSearchScreen - Fetching providers with params:', {
        lat: searchRegion.latitude,
        lng: searchRegion.longitude,
        radius: selectedRadius,
        freeInspectionOnly: showOnlyFreeInspection
      });

      // Use the free inspection API which supports filtering
      // When showing only free inspection, use the separate freeInspectionCategory filter
      const categoryToUse = showOnlyFreeInspection ? freeInspectionCategory : selectedCategory;
      
      const response = await ApiService.getInstance().getProvidersForMap({
        latitude: searchRegion.latitude,
        longitude: searchRegion.longitude,
        radiusKm: selectedRadius,
        category: categoryToUse || undefined,
        freeInspectionOnly: showOnlyFreeInspection,
      });

      console.log('📡 MapSearchScreen - API Response:', {
        success: response.success,
        dataLength: response.data?.providers?.length || 0,
        data: response.data
      });

      if (response.success && response.data?.providers) {
        console.log('📊 MapSearchScreen - Raw providers:', response.data.providers);
        
        const validProviders = (response.data.providers as any[]).filter(p => {
          const lat = parseCoord(p.latitude);
          const lng = parseCoord(p.longitude);
          const isValid = lat !== 0 && lng !== 0;
          return isValid;
        });
        
        console.log('✅ MapSearchScreen - Valid providers count:', validProviders.length);
        console.log('✅ MapSearchScreen - Valid providers (first 3):', validProviders.slice(0, 3));
        
        setProviders(validProviders);
        setLastSearchLocation(searchRegion);

        // Fit map to show all markers
        if (validProviders.length > 0 && mapRef.current) {
          const coordinates = validProviders.map(p => ({
            latitude: parseCoord(p.latitude),
            longitude: parseCoord(p.longitude),
          }));
          
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            });
          }, 500);
        }
      } else {
        console.warn('⚠️ MapSearchScreen - No data returned or unsuccessful response');
        setFetchError('No data returned');
      }
    } catch (error) {
      console.error('❌ MapSearchScreen - Error fetching providers:', error);
      setFetchError('Грешка при връзката');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch cases for providers
  const fetchCases = async (searchRegion: typeof INITIAL_REGION) => {
    setIsLoading(true);
    setFetchError(null);
    try {
      console.log('🔍 MapSearchScreen - Fetching cases for provider with params:', {
        lat: searchRegion.latitude,
        lng: searchRegion.longitude,
        radius: selectedRadius
      });

      const response = await ApiService.getInstance().getCasesForMap(
        searchRegion.latitude,
        searchRegion.longitude,
        selectedRadius,
        selectedCategory || undefined
      );

      console.log('📡 MapSearchScreen - Cases API Response:', response);

      if (response.success && response.data?.cases) {
        const validCases = response.data.cases.filter((c: any) => {
          const lat = parseCoord(c.latitude);
          const lng = parseCoord(c.longitude);
          return lat !== 0 && lng !== 0;
        });
        
        console.log('✅ MapSearchScreen - Valid cases count:', validCases.length);
        setCases(validCases);
        setLastSearchLocation(searchRegion);

        // Fit map to show all markers
        if (validCases.length > 0 && mapRef.current) {
          const coordinates = validCases.map((c: any) => ({
            latitude: parseCoord(c.latitude),
            longitude: parseCoord(c.longitude),
          }));
          
          setTimeout(() => {
            mapRef.current?.fitToCoordinates(coordinates, {
              edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
              animated: true,
            });
          }, 500);
        }
      } else {
        console.warn('⚠️ MapSearchScreen - No cases returned');
        setCases([]);
      }
    } catch (error) {
      console.error('❌ MapSearchScreen - Error fetching cases:', error);
      setFetchError('Грешка при зареждане на заявките');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle bid on a case
  const handleBid = (caseItem: any) => {
    Alert.alert(
      '💰 Направи оферта',
      `Искате ли да направите оферта за тази заявка?\n\n${getCategoryLabel(caseItem.serviceType || caseItem.category)}\n📍 ${caseItem.neighborhood || caseItem.city}\n💵 Бюджет: ${caseItem.budget} лв`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Наддай',
          onPress: () => {
            // Navigate to provider cases screen with bid parameter
            navigation.navigate('ProviderDashboard', { bidCaseId: caseItem.id });
          }
        }
      ]
    );
  };

  // Get priority styling
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#EF4444';
      case 'normal': return '#3B82F6';
      case 'low': return '#6B7280';
      default: return '#6B7280';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'Спешно';
      case 'normal': return 'Нормално';
      case 'low': return 'Нисък';
      default: return priority;
    }
  };

  const getCategoryLabel = (categoryId: string) => {
    if (!categoryId) return '';
    // Use the constant helper that handles both 'cat_' prefix and without
    return getServiceCategoryLabel(categoryId);
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newLocation = {
          latitude,
          longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
        setRegion(newLocation);
        mapRef.current?.animateToRegion(newLocation, 1000);
        if (isProvider && canViewCasesOnMap) {
          fetchCases(newLocation);
        } else if (!isProvider) {
          fetchProviders(newLocation);
        }
      },
      (error) => {
        console.error(error);
        Alert.alert('Грешка с локацията', 'Не успяхме да определим вашето местоположение.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleViewProfile = async (provider: any) => {
    setProfileProvider(provider);
    setProfileModalVisible(true);
    setSelectedProvider(null); // Close the preview card
    
    // Fetch reviews for this provider
    setReviewsLoading(true);
    try {
      const response = await fetch(
        `https://maystorfix.com/api/v1/reviews/provider/${provider.id}`
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
    setProfileProvider(null);
    setProviderReviews([]);
  };

  const handleCallProvider = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    } else {
      Alert.alert('Няма телефон', 'Този специалист не е предоставил телефонен номер.');
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

  const handleChatProvider = (provider: any) => {
    navigation.navigate('ChatDetail', {
      conversationId: `new_${provider.id}`,
      recipientName: provider.businessName || provider.name,
      recipientId: provider.id
    });
  };

  const renderProviderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.providerItem}
      onPress={() => {
        setViewMode('map');
        setSelectedProvider(item); // Select provider
        const lat = parseCoord(item.latitude);
        const lng = parseCoord(item.longitude);
        const newLocation = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newLocation);
        mapRef.current?.animateToRegion(newLocation, 1000);
      }}
    >
      <View style={styles.providerHeader}>
        <View style={styles.avatarContainer}>
          {item.profileImageUrl ? (
            <Image source={{ uri: item.profileImageUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {(item.businessName || item.name || 'P').charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.providerInfo}>
          <Text style={styles.providerName}>{item.businessName || item.name}</Text>
          <Text style={styles.providerCategory}>{getServiceCategoryLabel(item.serviceCategory)}</Text>
          <View style={styles.ratingContainer}>
            <Text style={styles.starIcon}>⭐</Text>
            <Text style={styles.ratingText}>{item.rating || '0.0'}</Text>
            <Text style={styles.distanceText}>
              {item.distance ? ` • ${Number(item.distance).toFixed(1)} km` : ''}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.profileBtn]}
          onPress={() => handleViewProfile(item)}
        >
          <Text style={styles.profileBtnText}>Виж профил</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={() => handleChatProvider(item)}
        >
          <Text style={styles.actionBtnText}>Чат</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Render case item for list view (providers only)
  const renderCaseItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.providerItem, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}
      onPress={() => {
        setViewMode('map');
        setSelectedCase(item);
        setSelectedProvider(null);
        const lat = parseCoord(item.latitude);
        const lng = parseCoord(item.longitude);
        const newLocation = {
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newLocation);
        mapRef.current?.animateToRegion(newLocation, 1000);
      }}
    >
      {/* Header with priority */}
      <View style={styles.caseHeader}>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
          <Text style={styles.priorityText}>{getPriorityLabel(item.priority)}</Text>
        </View>
        <Text style={styles.distanceText}>{item.distanceKm} км</Text>
      </View>

      {/* Case Number & Category */}
      <View style={styles.caseTitleRow}>
        {item.caseNumber && (
          <View style={styles.caseNumberBadge}>
            <Text style={styles.caseNumberText}>#{item.caseNumber}</Text>
          </View>
        )}
        <Text style={styles.caseCategory}>
          {getCategoryLabel(item.serviceType || item.category)}
        </Text>
      </View>

      {/* Description */}
      <View style={styles.descriptionContainer}>
        <Text style={styles.descriptionLabel}>📝 Описание:</Text>
        <Text style={styles.caseDescription} numberOfLines={2}>
          {item.description}
        </Text>
      </View>

      {/* Location & Budget */}
      <View style={styles.caseDetails}>
        <Text style={styles.caseLocation}>📍 {item.neighborhood || item.city}</Text>
        <Text style={styles.caseBudget}>💰 {item.budget} лв</Text>
      </View>

      {/* Screenshots */}
      {item.screenshots && item.screenshots.length > 0 && (
        <View style={styles.screenshotsSection}>
          <Text style={styles.screenshotsLabel}>📷 Снимки:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.screenshotsScroll}>
            {item.screenshots.map((screenshot: any, index: number) => (
              <TouchableOpacity 
                key={screenshot.id || index} 
                style={styles.screenshotWrapper}
                onPress={() => Linking.openURL(screenshot.url)}
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

      {/* Bidding Info & Button */}
      {(item.biddingEnabled || item.bidding_enabled) && (
        <View style={styles.biddingSection}>
          <Text style={styles.biddingText}>
            👥 Оферти: {item.currentBidders || item.current_bidders || 0}/{item.maxBidders || item.max_bidders || 5}
          </Text>
          <BidButton
            caseId={item.id}
            budget={String(item.budget)}
            currentBidders={item.currentBidders || item.current_bidders}
            maxBidders={item.maxBidders || item.max_bidders}
            onBidPlaced={() => {
              fetchCases(region);
            }}
            disabled={item.biddingClosed || item.bidding_closed}
          />
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Map View with Clustering */}
      <View style={[styles.mapContainer, viewMode === 'list' ? styles.hidden : null]}>
        <ClusteredMapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          initialRegion={INITIAL_REGION}
          onLayout={onMapLayout}
          showsUserLocation={true}
          showsMyLocationButton={false}
          minZoomLevel={5}
          maxZoomLevel={20}
          zoomEnabled={true}
          scrollEnabled={true}
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}
          loadingEnabled={true}
          moveOnMarkerPress={false}
          onPress={() => {
            setSelectedProvider(null);
            setSelectedCase(null);
          }}
          onMapReady={() => {
            console.log('🗺️ MAP IS READY');
            setMapReady(true);
          }}
          // Clustering options - red for cases (SP view), red for providers (customer view)
          clusterColor="#E53E3E"
          clusterTextColor="#FFFFFF"
          clusterFontFamily="System"
          radius={80}
          extent={512}
          minPoints={2}
          maxZoom={15}
          animationEnabled={true}
          preserveClusterPressBehavior={true}
          spiderLineColor="#E53E3E"
          onClusterPress={(cluster, markers) => {
            // Zoom into the cluster
            const { geometry } = cluster;
            const coords = markers?.map((m: any) => ({
              latitude: m.geometry?.coordinates?.[1] || m.properties?.coordinate?.latitude,
              longitude: m.geometry?.coordinates?.[0] || m.properties?.coordinate?.longitude,
            })).filter((c: any) => c.latitude && c.longitude);
            
            if (coords && coords.length > 0 && mapRef.current) {
              mapRef.current.fitToCoordinates(coords, {
                edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
                animated: true,
              });
            } else if (mapRef.current) {
              // Fallback: zoom to cluster center
              mapRef.current.animateToRegion({
                latitude: geometry.coordinates[1],
                longitude: geometry.coordinates[0],
                latitudeDelta: region.latitudeDelta / 2,
                longitudeDelta: region.longitudeDelta / 2,
              }, 500);
            }
          }}
          renderCluster={(cluster) => {
            const { id, geometry, onPress, properties } = cluster;
            const points = properties.point_count;
            const size = points < 10 ? 36 : points < 50 ? 44 : 52;
            
            return (
              <Marker
                key={`cluster-${id}`}
                coordinate={{
                  longitude: geometry.coordinates[0],
                  latitude: geometry.coordinates[1],
                }}
                onPress={onPress}
                tracksViewChanges={false}
              >
                <View style={[
                  styles.clusterContainer, 
                  { 
                    width: size, 
                    height: size, 
                    borderRadius: size / 2,
                    backgroundColor: '#E53E3E',
                  }
                ]}>
                  <Text style={styles.clusterText}>{points}</Text>
                </View>
              </Marker>
            );
          }}
        >
          {/* Render cases for PRO providers only */}
          {isProvider && canViewCasesOnMap && cases.map((caseItem) => {
            const lat = parseCoord(caseItem.latitude);
            const lng = parseCoord(caseItem.longitude);
            if (lat === 0 || lng === 0) return null;

            return (
              <Marker
                key={caseItem.id}
                coordinate={{ latitude: lat, longitude: lng }}
                tracksViewChanges={false}
                title={getCategoryLabel(caseItem.serviceType || caseItem.category)}
                onPress={() => {
                  setSelectedCase(caseItem);
                  setSelectedProvider(null);
                }}
              />
            );
          })}

          {/* Render providers for customers - different colors for free inspection */}
          {!isProvider && providers.map((provider) => {
            const lat = parseCoord(provider.latitude);
            const lng = parseCoord(provider.longitude);
            if (lat === 0 || lng === 0) return null;

            // Purple for free inspection active, red for regular
            const markerColor = provider.freeInspectionActive ? '#7C3AED' : '#E53E3E';

            return (
              <Marker
                key={provider.id}
                coordinate={{ latitude: lat, longitude: lng }}
                tracksViewChanges={false}
                title={provider.businessName || provider.name}
                pinColor={markerColor}
                onPress={() => {
                  setSelectedProvider(provider);
                  setSelectedCase(null);
                }}
              />
            );
          })}
        </ClusteredMapView>


        {/* Provider Preview Card (for customers) */}
        {selectedProvider && !isProvider && (
          <View style={styles.previewCardContainer}>
            <View style={styles.previewCard}>
              <View style={styles.providerHeader}>
                <View style={styles.avatarContainer}>
                  {selectedProvider.profileImageUrl ? (
                    <Image source={{ uri: selectedProvider.profileImageUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Text style={styles.avatarText}>
                        {(selectedProvider.businessName || selectedProvider.name || 'P').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.providerInfo}>
                  <Text style={styles.providerName}>{selectedProvider.businessName || selectedProvider.name}</Text>
                  <Text style={styles.providerCategory}>{getServiceCategoryLabel(selectedProvider.serviceCategory)}</Text>
                  <View style={styles.ratingContainer}>
                    <Text style={styles.starIcon}>⭐</Text>
                    <Text style={styles.ratingText}>{selectedProvider.rating || '0.0'}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedProvider(null)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.profileBtn]}
                  onPress={() => handleViewProfile(selectedProvider)}
                >
                  <Text style={styles.profileBtnText}>Виж профил</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.chatBtn, { marginLeft: 8 }]}
                  onPress={() => handleChatProvider(selectedProvider)}
                >
                  <Text style={styles.actionBtnText}>Чат</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Case Preview Card (for providers) */}
        {selectedCase && isProvider && (
          <View style={styles.previewCardContainer}>
            <View style={[styles.previewCard, { borderLeftWidth: 4, borderLeftColor: '#10B981' }]}>
              {/* Header with priority and close */}
              <View style={styles.caseHeader}>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(selectedCase.priority) }]}>
                  <Text style={styles.priorityText}>{getPriorityLabel(selectedCase.priority)}</Text>
                </View>
                <Text style={styles.distanceText}>{selectedCase.distanceKm} км</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedCase(null)}>
                  <Text style={styles.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Case Number & Category */}
              <View style={styles.caseTitleRow}>
                {selectedCase.caseNumber && (
                  <View style={styles.caseNumberBadge}>
                    <Text style={styles.caseNumberText}>#{selectedCase.caseNumber}</Text>
                  </View>
                )}
                <Text style={styles.caseCategory}>
                  {getCategoryLabel(selectedCase.serviceType || selectedCase.category)}
                </Text>
              </View>

              {/* Description */}
              <View style={styles.descriptionContainer}>
                <Text style={styles.descriptionLabel}>📝 Описание:</Text>
                <Text style={styles.caseDescription} numberOfLines={2}>
                  {selectedCase.description}
                </Text>
              </View>

              {/* Location & Budget */}
              <View style={styles.caseDetails}>
                <Text style={styles.caseLocation}>📍 {selectedCase.neighborhood || selectedCase.city}</Text>
                <Text style={styles.caseBudget}>💰 {selectedCase.budget} лв</Text>
              </View>

              {/* Screenshots */}
              {selectedCase.screenshots && selectedCase.screenshots.length > 0 && (
                <View style={styles.screenshotsSection}>
                  <Text style={styles.screenshotsLabel}>📷 Снимки:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.screenshotsScroll}>
                    {selectedCase.screenshots.map((screenshot: any, index: number) => (
                      <TouchableOpacity 
                        key={screenshot.id || index} 
                        style={styles.screenshotWrapper}
                        onPress={() => Linking.openURL(screenshot.url)}
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

              {/* Bidding Info & BidButton */}
              {selectedCase.biddingEnabled || selectedCase.bidding_enabled ? (
                <View style={styles.biddingSection}>
                  <View style={styles.biddingInfo}>
                    <Text style={styles.biddingText}>
                      👥 Оферти: {selectedCase.currentBidders || selectedCase.current_bidders || 0}/{selectedCase.maxBidders || selectedCase.max_bidders || 5}
                    </Text>
                  </View>
                  <BidButton
                    caseId={selectedCase.id}
                    budget={String(selectedCase.budget)}
                    currentBidders={selectedCase.currentBidders || selectedCase.current_bidders}
                    maxBidders={selectedCase.maxBidders || selectedCase.max_bidders}
                    onBidPlaced={() => {
                      setSelectedCase(null);
                      fetchCases(region);
                    }}
                    disabled={selectedCase.biddingClosed || selectedCase.bidding_closed}
                  />
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.bidButton}
                  onPress={() => handleBid(selectedCase)}
                >
                  <Text style={styles.bidButtonText}>💰 Направи оферта</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* List View */}
      {viewMode === 'list' && (
        <View style={styles.listContainer}>
          {/* List Header with Filters */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              {isProvider ? `Заявки наблизо (${cases.length})` : `Майстори наблизо (${providers.length})`}
              {fetchError && <Text style={{ color: 'red', fontSize: 12 }}> ({fetchError})</Text>}
            </Text>
            <TouchableOpacity
              style={styles.listFilterBtn}
              onPress={() => setShowFilters(!showFilters)}
            >
              <Text style={styles.listFilterBtnText}>
                🔍 Филтри {selectedCategory || selectedRadius !== 10 ? '•' : ''}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filter Panel in List View */}
          {showFilters && (
            <View style={styles.listFilterPanel}>
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Distance Filter - Dropdown */}
                <Text style={styles.filterLabel}>Разстояние (км)</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedRadius}
                    onValueChange={(value) => setSelectedRadius(value)}
                    style={styles.picker}
                    dropdownIconColor="#374151"
                  >
                    {DISTANCE_OPTIONS.map((km) => (
                      <Picker.Item key={km} label={`${km} км`} value={km} />
                    ))}
                  </Picker>
                </View>

                {/* Category Filter - Dropdown */}
                <Text style={styles.filterLabel}>Категория</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={selectedCategory}
                    onValueChange={(value) => setSelectedCategory(value)}
                    style={styles.picker}
                    dropdownIconColor="#374151"
                  >
                    <Picker.Item key="all" label="Всички категории" value="" />
                    {serviceCategories.map((cat: Category) => (
                      <Picker.Item key={cat.value || cat.id} label={cat.label} value={cat.id} />
                    ))}
                  </Picker>
                </View>

                {/* Free Inspection Filter (customers only) */}
                {!isProvider && (
                  <View style={styles.freeInspectionSection}>
                    <Text style={styles.filterLabel}>🔧 Безплатен оглед</Text>
                    
                    {/* Show only free inspection checkbox */}
                    <TouchableOpacity
                      style={styles.freeInspectionToggle}
                      onPress={async () => {
                        const newValue = !showOnlyFreeInspection;
                        setShowOnlyFreeInspection(newValue);
                        await ApiService.getInstance().updateFreeInspectionPreferences({
                          showOnlyFreeInspection: newValue,
                        });
                      }}
                    >
                      <View style={[
                        styles.checkbox,
                        showOnlyFreeInspection && styles.checkboxActivePurple
                      ]}>
                        {showOnlyFreeInspection && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.freeInspectionToggleText}>
                        Покажи само с безплатен оглед
                      </Text>
                    </TouchableOpacity>

                    {/* Separate category filter for free inspection */}
                    {showOnlyFreeInspection && (
                      <>
                        <Text style={styles.filterSubLabel}>Тип майстор (безплатен оглед)</Text>
                        <View style={styles.pickerContainerPurple}>
                          <Picker
                            selectedValue={freeInspectionCategory}
                            onValueChange={async (value) => {
                              setFreeInspectionCategory(value);
                              await ApiService.getInstance().updateFreeInspectionPreferences({
                                categories: value ? [value] : [],
                              });
                            }}
                            style={styles.picker}
                            dropdownIconColor="#7C3AED"
                          >
                            <Picker.Item key="all" label="Всички категории" value="" />
                            {serviceCategories.map((cat: Category) => (
                              <Picker.Item key={cat.value || cat.id} label={cat.label} value={cat.id} />
                            ))}
                          </Picker>
                        </View>
                      </>
                    )}

                    {/* Toggle for alerts */}
                    <View style={styles.alertsSectionDivider} />
                    <TouchableOpacity
                      style={styles.freeInspectionToggle}
                      onPress={async () => {
                        const newValue = !freeInspectionAlertsEnabled;
                        setFreeInspectionAlertsEnabled(newValue);
                        await ApiService.getInstance().updateFreeInspectionPreferences({
                          enabled: newValue,
                          latitude: region.latitude,
                          longitude: region.longitude,
                        });
                      }}
                    >
                      <View style={[
                        styles.checkbox,
                        freeInspectionAlertsEnabled && styles.checkboxActive
                      ]}>
                        {freeInspectionAlertsEnabled && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <View style={styles.alertsTextContainer}>
                        <Text style={styles.freeInspectionToggleText}>
                          Известия за безплатен оглед
                        </Text>
                        <Text style={styles.alertsExplanation}>
                          Когато има майстор в селектирания радиус, ще получите известие
                        </Text>
                      </View>
                    </TouchableOpacity>

                    {/* Radius for free inspection alerts - only 1-3 km */}
                    {freeInspectionAlertsEnabled && (
                      <>
                        <Text style={styles.filterSubLabel}>Радиус за известия (км)</Text>
                        <View style={styles.filterChips}>
                          {[1, 2, 3].map((km) => (
                            <TouchableOpacity
                              key={km}
                              style={[
                                styles.filterChip,
                                freeInspectionRadius === km && styles.filterChipActivePurple,
                              ]}
                              onPress={async () => {
                                setFreeInspectionRadius(km);
                                await ApiService.getInstance().updateFreeInspectionPreferences({
                                  radiusKm: km,
                                  latitude: region.latitude,
                                  longitude: region.longitude,
                                });
                              }}
                            >
                              <Text
                                style={[
                                  styles.filterChipText,
                                  freeInspectionRadius === km && styles.filterChipTextActive,
                                ]}
                              >
                                {km}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}

                    {/* Legend */}
                    <View style={styles.legendContainer}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#7C3AED' }]} />
                        <Text style={styles.legendText}>Предлага безплатен оглед</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: '#E53E3E' }]} />
                        <Text style={styles.legendText}>Стандартен майстор</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* Apply Button */}
                <TouchableOpacity
                  style={styles.applyFilterBtn}
                  onPress={() => {
                    setShowFilters(false);
                    if (isProvider && canViewCasesOnMap) {
                      fetchCases(region);
                    } else if (!isProvider) {
                      fetchProviders(region);
                    }
                  }}
                >
                  <Text style={styles.applyFilterBtnText}>Приложи филтри</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          <FlatList
            data={isProvider ? cases : providers}
            renderItem={isProvider ? renderCaseItem : renderProviderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {isLoading ? 'Зареждане...' : isProvider ? 'Няма намерени заявки в този район.' : 'Няма намерени майстори в този район.'}
              </Text>
            }
          />
        </View>
      )}

      {/* Bottom Bar with Nearest + Toggle */}
      <View style={styles.bottomBar}>
        {/* Nearest Button - different for providers vs customers */}
        {viewMode === 'map' && ((isProvider && cases.length > 0) || (!isProvider && providers.length > 0)) && (
          <TouchableOpacity
            style={[styles.nearestBtn, isProvider && { backgroundColor: '#10B981' }]}
            onPress={() => {
              if (isProvider) {
                // Find nearest case
                const nearest = cases.reduce((prev, curr) => {
                  const prevDist = parseFloat(prev.distanceKm) || Infinity;
                  const currDist = parseFloat(curr.distanceKm) || Infinity;
                  return currDist < prevDist ? curr : prev;
                }, cases[0]);
                
                if (nearest) {
                  const lat = parseCoord(nearest.latitude);
                  const lng = parseCoord(nearest.longitude);
                  mapRef.current?.animateToRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }, 800);
                  setSelectedCase(nearest);
                }
              } else {
                // Find nearest provider
                const nearest = providers.reduce((prev, curr) => {
                  const prevDist = prev.distance || Infinity;
                  const currDist = curr.distance || Infinity;
                  return currDist < prevDist ? curr : prev;
                }, providers[0]);
                
                if (nearest) {
                  const lat = parseCoord(nearest.latitude);
                  const lng = parseCoord(nearest.longitude);
                  mapRef.current?.animateToRegion({
                    latitude: lat,
                    longitude: lng,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                  }, 800);
                  setSelectedProvider(nearest);
                }
              }
            }}
          >
            <Text style={styles.nearestBtnText}>🎯 Най-близък</Text>
          </TouchableOpacity>
        )}

        {/* Toggle View Button */}
        <TouchableOpacity
          style={[styles.toggleViewBtn, isProvider && { backgroundColor: '#10B981' }]}
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          <Text style={styles.toggleViewText}>
            {viewMode === 'map' 
              ? isProvider ? `Покажи списък (${cases.length})` : `Покажи списък (${providers.length})` 
              : 'Покажи карта'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Provider Profile Modal */}
      <Modal
        visible={profileModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={closeProfileModal}
      >
        <View style={modalStyles.modalContainer}>
          <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={modalStyles.modalGradient}>
            {/* Modal Header */}
            <View style={modalStyles.modalHeader}>
              <TouchableOpacity onPress={closeProfileModal} style={modalStyles.closeButton}>
                <Text style={modalStyles.closeButtonText}>← Назад</Text>
              </TouchableOpacity>
            </View>

            {profileProvider && (
              <ScrollView style={modalStyles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Profile Header */}
                <View style={modalStyles.profileHeader}>
                  {profileProvider.profileImageUrl ? (
                    <Image source={{ uri: profileProvider.profileImageUrl }} style={modalStyles.profileAvatar} />
                  ) : (
                    <View style={modalStyles.profileAvatarPlaceholder}>
                      <Text style={modalStyles.profileAvatarText}>
                        {(profileProvider.businessName || profileProvider.firstName || 'S').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={modalStyles.profileInfo}>
                    <Text style={modalStyles.profileName}>
                      {profileProvider.businessName || profileProvider.business_name || 
                       `${profileProvider.firstName || ''} ${profileProvider.lastName || ''}`.trim() || 'Специалист'}
                    </Text>
                    <Text style={modalStyles.profileCategory}>
                      {getCategoryLabel(profileProvider.serviceCategory || profileProvider.service_category)}
                    </Text>
                    <Text style={modalStyles.profileLocation}>
                      📍 {profileProvider.city || 'София'}{profileProvider.neighborhood ? `, ${profileProvider.neighborhood}` : ''}
                    </Text>
                  </View>
                </View>

                {/* Rating Section */}
                <View style={modalStyles.ratingSection}>
                  <Text style={modalStyles.ratingStars}>{renderStars(profileProvider.rating || 0)}</Text>
                  <Text style={modalStyles.modalRatingText}>
                    {Number(profileProvider.rating || 0).toFixed(1)} ({profileProvider.totalReviews || profileProvider.total_reviews || 0} отзива)
                  </Text>
                </View>

                {/* Quick Info */}
                <View style={modalStyles.quickInfoSection}>
                  <Text style={modalStyles.sectionTitle}>Бърза информация</Text>
                  <View style={modalStyles.quickInfoGrid}>
                    <View style={modalStyles.quickInfoItem}>
                      <Text style={modalStyles.quickInfoIcon}>⭐</Text>
                      <Text style={modalStyles.quickInfoLabel}>Опит</Text>
                      <Text style={modalStyles.quickInfoValue}>{profileProvider.experienceYears || profileProvider.experience_years || 0} год.</Text>
                    </View>
                    <View style={modalStyles.quickInfoItem}>
                      <Text style={modalStyles.quickInfoIcon}>📞</Text>
                      <Text style={modalStyles.quickInfoLabel}>Телефон</Text>
                      <Text style={modalStyles.quickInfoValue} numberOfLines={1}>
                        {profileProvider.phoneNumber || profileProvider.phone_number || 'Няма'}
                      </Text>
                    </View>
                    <View style={modalStyles.quickInfoItem}>
                      <Text style={modalStyles.quickInfoIcon}>✅</Text>
                      <Text style={modalStyles.quickInfoLabel}>Проекти</Text>
                      <Text style={modalStyles.quickInfoValue}>{profileProvider.completedProjects || 0}</Text>
                    </View>
                  </View>
                </View>

                {/* Description */}
                <View style={modalStyles.descriptionSection}>
                  <Text style={modalStyles.sectionTitle}>За мен</Text>
                  <Text style={modalStyles.descriptionText}>
                    {profileProvider.description || `Професионални ${getCategoryLabel(profileProvider.serviceCategory || profileProvider.service_category).toLowerCase()} услуги с качество и гаранция.`}
                  </Text>
                </View>

                {/* Services */}
                <View style={modalStyles.servicesSection}>
                  <Text style={modalStyles.sectionTitle}>Предлагани услуги</Text>
                  <View style={modalStyles.serviceItem}>
                    <Text style={modalStyles.serviceIcon}>🔧</Text>
                    <Text style={modalStyles.serviceText}>Основни {getCategoryLabel(profileProvider.serviceCategory || profileProvider.service_category).toLowerCase()} услуги</Text>
                  </View>
                  <View style={modalStyles.serviceItem}>
                    <Text style={modalStyles.serviceIcon}>🚨</Text>
                    <Text style={modalStyles.serviceText}>Спешни повиквания</Text>
                  </View>
                  <View style={modalStyles.serviceItem}>
                    <Text style={modalStyles.serviceIcon}>📋</Text>
                    <Text style={modalStyles.serviceText}>Консултации и оценки</Text>
                  </View>
                </View>

                {/* Gallery */}
                {profileProvider.gallery && profileProvider.gallery.length > 0 && (
                  <View style={modalStyles.gallerySection}>
                    <Text style={modalStyles.sectionTitle}>📸 Галерия</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {profileProvider.gallery.map((imgUrl: string, idx: number) => (
                        <TouchableOpacity key={idx} onPress={() => Linking.openURL(imgUrl)}>
                          <Image source={{ uri: imgUrl }} style={modalStyles.galleryImage} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Reviews */}
                <View style={modalStyles.reviewsSection}>
                  <Text style={modalStyles.sectionTitle}>🌟 Отзиви</Text>
                  {reviewsLoading ? (
                    <ActivityIndicator color="#818cf8" style={{ marginVertical: 20 }} />
                  ) : providerReviews.length > 0 ? (
                    providerReviews.slice(0, 5).map((review: any, idx: number) => (
                      <View key={idx} style={modalStyles.reviewCard}>
                        <View style={modalStyles.reviewHeader}>
                          <Text style={modalStyles.reviewerName}>{review.customerName || 'Клиент'}</Text>
                          <Text style={modalStyles.reviewRating}>{renderStars(review.rating || 0)}</Text>
                        </View>
                        <Text style={modalStyles.reviewText}>{review.comment || 'Няма коментар'}</Text>
                        <Text style={modalStyles.reviewDate}>
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString('bg-BG') : ''}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={modalStyles.noReviewsText}>Все още няма отзиви</Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={modalStyles.modalActions}>
                  <TouchableOpacity 
                    style={modalStyles.callButton} 
                    onPress={() => handleCallProvider(profileProvider.phoneNumber || profileProvider.phone_number)}
                  >
                    <Text style={modalStyles.actionButtonText}>📞 Обади се</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={modalStyles.chatButtonLarge} 
                    onPress={() => {
                      closeProfileModal();
                      handleChatProvider(profileProvider);
                    }}
                  >
                    <Text style={modalStyles.actionButtonText}>💬 Чат</Text>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listHeader: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    flex: 1,
  },
  listFilterBtn: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  listFilterBtnText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  listFilterPanel: {
    backgroundColor: 'white',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
    maxHeight: height * 0.5,
  },
  listContent: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    color: '#666',
  },
  providerItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  providerHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e1effe',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  providerCategory: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    fontSize: 12,
    marginRight: 4,
    color: '#fbbf24',
  },
  ratingText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  distanceText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBtn: {
    backgroundColor: '#10B981', // Emerald
  },
  profileBtn: {
    backgroundColor: '#4F46E5', // Indigo
  },
  actionBtnText: {
    fontWeight: '600',
    fontSize: 14,
    color: 'white',
  },
  profileBtnText: {
    fontWeight: '600',
    fontSize: 14,
    color: 'white',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  nearestBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nearestBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  toggleViewBtn: {
    backgroundColor: '#1e40af',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  toggleViewText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  floatingControls: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    alignItems: 'flex-end',
  },
  controlBtn: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 30,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  refreshBtn: {
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterBtn: {
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  filterPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: height * 0.6,
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  filterCloseBtn: {
    fontSize: 18,
    color: '#6b7280',
    padding: 4,
  },
  filterScrollView: {
    maxHeight: height * 0.4,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
    marginTop: 12,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterChipCategory: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 4,
  },
  filterChipActive: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  filterChipText: {
    fontSize: 14,
    color: '#374151',
  },
  filterChipTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  applyFilterBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  applyFilterBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  // Free Inspection styles
  freeInspectionSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  freeInspectionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  freeInspectionToggleText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#d1d5db',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxActivePurple: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkmark: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  filterSubLabel: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 8,
    marginTop: 4,
  },
  filterChipActivePurple: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  legendContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Picker/Dropdown styles
  pickerContainer: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
    overflow: 'hidden',
  },
  pickerContainerPurple: {
    backgroundColor: '#f5f3ff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#c4b5fd',
    marginBottom: 12,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    color: '#374151',
  },
  alertsSectionDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  alertsTextContainer: {
    flex: 1,
  },
  alertsExplanation: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
    lineHeight: 14,
  },
  controlBtnText: {
    fontWeight: '600',
    color: '#1a1a1a',
    fontSize: 14,
  },
  customMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#E53E3E',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerText: {
    fontSize: 20,
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#007AFF',
  },
  calloutContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    width: 220,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  calloutSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  calloutButtons: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  calloutBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCardContainer: {
    position: 'absolute',
    bottom: 90, // Above floating controls/tab bar
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  previewCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 10,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
  closeBtnText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  previewActions: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  // Cluster styles
  clusterContainer: {
    backgroundColor: '#E53E3E',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
  clusterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Provider marker styles
  markerBubbleProvider: {
    backgroundColor: '#4F46E5',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerInitial: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  // Case-specific styles for provider view
  caseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginRight: 8,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  caseCategory: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  caseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  caseNumberBadge: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  caseNumberText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6366f1',
  },
  descriptionContainer: {
    marginBottom: 8,
  },
  descriptionLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  caseDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  caseDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  caseLocation: {
    fontSize: 13,
    color: '#666',
  },
  caseBudget: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10B981',
  },
  biddingInfo: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
  },
  biddingText: {
    fontSize: 13,
    color: '#666',
  },
  bidButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  bidButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  bidButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  caseListBidRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  caseListBidBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  caseListBidBtnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 13,
  },
  // Screenshot styles for case preview
  screenshotsSection: {
    marginTop: 10,
    marginBottom: 10,
  },
  screenshotsLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    fontWeight: '500',
  },
  screenshotsScroll: {
    flexDirection: 'row',
  },
  screenshotWrapper: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  screenshotImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  biddingSection: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});

// Modal styles for provider profile
const modalStyles = StyleSheet.create({
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
  // Upgrade Banner Styles
  upgradeBanner: {
    position: 'absolute',
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(165, 180, 252, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  upgradeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  upgradeBannerIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  upgradeBannerText: {
    flex: 1,
  },
  upgradeBannerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  upgradeBannerSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 13,
    lineHeight: 18,
  },
  upgradeBannerButton: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  upgradeBannerButtonText: {
    color: '#4f46e5',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default MapSearchScreen;
