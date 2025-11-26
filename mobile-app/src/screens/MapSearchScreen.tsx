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
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, MapMarker, Region } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width, height } = Dimensions.get('window');

// Service categories from database
const SERVICE_CATEGORIES = [
  { value: '', label: 'Всички категории' },
  { value: 'electrician', label: 'Електротехник' },
  { value: 'plumber', label: 'Водопроводчик' },
  { value: 'handyman', label: 'Майстор' },
  { value: 'painter', label: 'Бояджия' },
  { value: 'hvac', label: 'Климатици' },
  { value: 'cleaner', label: 'Чистач' },
  { value: 'gardener', label: 'Градинар' },
  { value: 'mason', label: 'Зидар' },
  { value: 'tiler', label: 'Фаянсаджия' },
  { value: 'flooring', label: 'Подови настилки' },
  { value: 'welder', label: 'Заварчик' },
  { value: 'plasterer', label: 'Мазач' },
  { value: 'furniture_assembly', label: 'Монтаж мебели' },
  { value: 'appliance_repair', label: 'Ремонт уреди' },
  { value: 'moving', label: 'Хамали' },
  { value: 'Друго', label: 'Друго' },
];

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

  // Separate state for map view region vs search location
  // Use region state to control the map view (fixes zoom issue)
  const [region, setRegion] = useState(INITIAL_REGION);

  // Keep track of where we last searched to avoid loops if we wanted to optimize
  const [lastSearchLocation, setLastSearchLocation] = useState(INITIAL_REGION);

  const [providers, setProviders] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  
  // Filter states
  const [selectedRadius, setSelectedRadius] = useState<number>(10);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Auto-zoom to user location on mount
  useEffect(() => {
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
        console.log('📍 Got user location:', latitude, longitude);
        setRegion(userLocation);
        
        // Animate to user location after map is ready
        setTimeout(() => {
          mapRef.current?.animateToRegion(userLocation, 1000);
        }, 500);
        
        // Fetch providers around user's location
        fetchProviders(userLocation);
      },
      (error) => {
        console.log('📍 Location error, using Sofia default:', error.message);
        // Fallback to Sofia if location fails
        fetchProviders(INITIAL_REGION);
        
        if (Platform.OS === 'android') {
          setTimeout(() => {
            mapRef.current?.animateToRegion(INITIAL_REGION, 1000);
          }, 500);
        }
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000 // Cache location for 1 minute
      }
    );
  }, []);

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
        radius: 10,
        limit: 50
      });

      const response = await ApiService.getInstance().searchProviders({
        lat: searchRegion.latitude,
        lng: searchRegion.longitude,
        radius: selectedRadius,
        limit: PROVIDER_LIMIT,
        ...(selectedCategory ? { category: selectedCategory } : {}),
        // @ts-ignore
        t: Date.now()
      });

      console.log('📡 MapSearchScreen - API Response:', {
        success: response.success,
        dataLength: response.data ? response.data.length : 0,
        data: response.data
      });

      if (response.success && response.data) {
        console.log('📊 MapSearchScreen - Raw providers:', response.data);
        
        const validProviders = (response.data as any[]).filter(p => {
          const lat = parseCoord(p.latitude);
          const lng = parseCoord(p.longitude);
          const isValid = lat !== 0 && lng !== 0;
          console.log(`🔍 Provider ${p.businessName || p.name}: lat=${lat}, lng=${lng}, valid=${isValid}`);
          return isValid;
        });
        
        console.log('✅ MapSearchScreen - Valid providers count:', validProviders.length);
        console.log('✅ MapSearchScreen - Valid providers:', validProviders);
        
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
      setFetchError('Connection error');
    } finally {
      setIsLoading(false);
    }
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
        fetchProviders(newLocation);
      },
      (error) => {
        console.error(error);
        Alert.alert('Location Error', 'Could not determine your location.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleViewProfile = (provider: any) => {
    Alert.alert(
      'Provider Profile',
      `View profile for ${provider.businessName || provider.name}\n(Feature coming soon)`,
      [{ text: 'OK' }]
    );
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
          <Text style={styles.providerCategory}>{item.serviceCategory}</Text>
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
          <Text style={styles.profileBtnText}>View Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.chatBtn]}
          onPress={() => handleChatProvider(item)}
        >
          <Text style={styles.actionBtnText}>Chat</Text>
        </TouchableOpacity>
      </View>
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
          onPress={() => setSelectedProvider(null)}
          onMapReady={() => {
            console.log('🗺️ MAP IS READY');
            setMapReady(true);
          }}
          // Clustering options - match web settings
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
          renderCluster={(cluster) => {
            const { id, geometry, onPress, properties } = cluster;
            const points = properties.point_count;
            
            // Size based on count
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
                <View style={[styles.clusterContainer, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Text style={styles.clusterText}>{points}</Text>
                </View>
              </Marker>
            );
          }}
        >
          {providers.map((provider) => {
            const lat = parseCoord(provider.latitude);
            const lng = parseCoord(provider.longitude);

            // Skip invalid coordinates
            if (lat === 0 || lng === 0) {
              return null;
            }

            return (
              <Marker
                key={provider.id}
                coordinate={{
                  latitude: lat,
                  longitude: lng,
                }}
                tracksViewChanges={false}
                pinColor="#E53E3E"
                title={provider.businessName || provider.name}
                onPress={() => {
                  setSelectedProvider(provider);
                }}
              />
            );
          })}
        </ClusteredMapView>


        {/* Provider Preview Card (Absolute Positioned) */}
        {selectedProvider && (
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
                  <Text style={styles.providerCategory}>{selectedProvider.serviceCategory}</Text>
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
                  <Text style={styles.profileBtnText}>View Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.chatBtn, { marginLeft: 8 }]}
                  onPress={() => handleChatProvider(selectedProvider)}
                >
                  <Text style={styles.actionBtnText}>Chat</Text>
                </TouchableOpacity>
              </View>
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
              Майстори наблизо ({providers.length})
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
                {/* Distance Filter */}
                <Text style={styles.filterLabel}>Разстояние (км)</Text>
                <View style={styles.filterChips}>
                  {DISTANCE_OPTIONS.map((km) => (
                    <TouchableOpacity
                      key={km}
                      style={[
                        styles.filterChip,
                        selectedRadius === km && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedRadius(km)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedRadius === km && styles.filterChipTextActive,
                        ]}
                      >
                        {km}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Category Filter */}
                <Text style={styles.filterLabel}>Категория</Text>
                <View style={styles.filterChipsWrap}>
                  {SERVICE_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.value}
                      style={[
                        styles.filterChipCategory,
                        selectedCategory === cat.value && styles.filterChipActive,
                      ]}
                      onPress={() => setSelectedCategory(cat.value)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          selectedCategory === cat.value && styles.filterChipTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Apply Button */}
                <TouchableOpacity
                  style={styles.applyFilterBtn}
                  onPress={() => {
                    setShowFilters(false);
                    fetchProviders(region);
                  }}
                >
                  <Text style={styles.applyFilterBtnText}>Приложи филтри</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

          <FlatList
            data={providers}
            renderItem={renderProviderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {isLoading ? 'Зареждане...' : 'Няма намерени майстори в този район.'}
              </Text>
            }
          />
        </View>
      )}

      {/* Bottom Bar with Nearest + Toggle */}
      <View style={styles.bottomBar}>
        {/* Nearest Button - only in map view with providers */}
        {viewMode === 'map' && providers.length > 0 && (
          <TouchableOpacity
            style={styles.nearestBtn}
            onPress={() => {
              // Find provider with smallest distance from filtered list
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
            }}
          >
            <Text style={styles.nearestBtnText}>🎯 Най-близък</Text>
          </TouchableOpacity>
        )}

        {/* Toggle View Button */}
        <TouchableOpacity
          style={styles.toggleViewBtn}
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          <Text style={styles.toggleViewText}>
            {viewMode === 'map' ? `Покажи списък (${providers.length})` : 'Покажи карта'}
          </Text>
        </TouchableOpacity>
      </View>
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
});

export default MapSearchScreen;
