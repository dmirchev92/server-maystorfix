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
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, MapMarker } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width, height } = Dimensions.get('window');

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

  // Fetch providers on mount (using Sofia)
  useEffect(() => {
    fetchProviders(INITIAL_REGION);

    // Android fallback: Enforce zoom after a short delay
    if (Platform.OS === 'android') {
      const timer = setTimeout(() => {
        mapRef.current?.animateToRegion(INITIAL_REGION, 1500);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const onMapLayout = () => {
    if (!mapReady) {
      setMapReady(true);
      mapRef.current?.animateToRegion(INITIAL_REGION, 1000);
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
        radius: 10, // 10km default
        limit: 50,
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
      setFetchError('Грешка при връзката');
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
        Alert.alert('Грешка с локацията', 'Не успяхме да определим вашето местоположение.');
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
      {/* Map View */}
      <View style={[styles.mapContainer, viewMode === 'list' ? styles.hidden : null]}>
        <MapView
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
          onPress={() => setSelectedProvider(null)} // Deselect on map click
          onMapReady={() => {
            console.log('🗺️ MAP IS READY');
            setMapReady(true);
          }}
        >
          {/* TEST MARKER - Native pin */}
          <Marker
            coordinate={{
              latitude: 42.6977,
              longitude: 23.3219,
            }}
            pinColor="blue"
            title="TEST"
            description="Sofia Center"
            tracksViewChanges={true}
          />
          
          {providers.map((provider) => {
            const lat = parseCoord(provider.latitude);
            const lng = parseCoord(provider.longitude);

            console.log(`🗺️ Rendering marker for ${provider.businessName || provider.name}: lat=${lat}, lng=${lng}`);

            // Skip invalid coordinates
            if (lat === 0 || lng === 0) {
              console.warn(`⚠️ Skipping marker for ${provider.businessName || provider.name} - invalid coordinates`);
              return null;
            }

            return (
              <Marker
                key={provider.id}
                coordinate={{
                  latitude: lat,
                  longitude: lng,
                }}
                pinColor="#E53E3E"
                title={provider.businessName || provider.name}
                description={provider.serviceCategory}
                tracksViewChanges={true}
                onPress={() => {
                  console.log('📍 Marker pressed:', provider.businessName);
                  setSelectedProvider(provider);
                }}
              />
            );
          })}
        </MapView>

        {/* Floating Controls */}
        <View style={styles.floatingControls}>
          <TouchableOpacity
            style={styles.controlBtn}
            onPress={getCurrentLocation}
          >
            <Text style={styles.controlBtnText}>📍</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlBtn, styles.refreshBtn]}
            onPress={async () => {
              // Search in the current center of the map
              fetchProviders(region);
            }}
          >
            <Text style={styles.controlBtnText}>
              {isLoading ? 'Searching...' : '🔄 Search Here'}
            </Text>
          </TouchableOpacity>
        </View>

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
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Nearby Providers ({providers.length})
              {fetchError && <Text style={{ color: 'red', fontSize: 12 }}> ({fetchError})</Text>}
            </Text>
          </View>
          <FlatList
            data={providers}
            renderItem={renderProviderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>
                {isLoading ? 'Loading providers...' : 'No providers found in this area.'}
              </Text>
            }
          />
        </View>
      )}

      {/* Bottom Toggle Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.toggleViewBtn}
          onPress={() => setViewMode(viewMode === 'map' ? 'list' : 'map')}
        >
          <Text style={styles.toggleViewText}>
            {viewMode === 'map' ? `Show List (${providers.length})` : 'Show Map'}
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
  },
  listTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
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
    alignItems: 'center',
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
    fontSize: 16,
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
});

export default MapSearchScreen;
