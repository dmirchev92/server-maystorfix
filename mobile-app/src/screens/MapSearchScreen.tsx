import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  TouchableOpacity,
  Platform,
  Alert,
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import Geolocation from 'react-native-geolocation-service';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';

const { width, height } = Dimensions.get('window');

// Dummy data for nearby providers (Replace with API call)
const MOCK_PROVIDERS = [
  {
    id: '1',
    name: 'Ivan Petrov',
    service: 'Plumber',
    rating: 4.8,
    latitude: 42.6977, // Sofia center approx
    longitude: 23.3219,
    avatar: 'https://i.pravatar.cc/150?u=1',
    phone: '+359888123456',
  },
  {
    id: '2',
    name: 'Georgi Ivanov',
    service: 'Electrician',
    rating: 4.9,
    latitude: 42.6950,
    longitude: 23.3250,
    avatar: 'https://i.pravatar.cc/150?u=2',
    phone: '+359888654321',
  },
  {
    id: '3',
    name: 'Maria Dimova',
    service: 'Cleaner',
    rating: 4.7,
    latitude: 42.7000,
    longitude: 23.3180,
    avatar: 'https://i.pravatar.cc/150?u=3',
    phone: '+359888999888',
  },
];

const MapSearchScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const mapRef = useRef<MapView>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  
  const [providers, setProviders] = useState(MOCK_PROVIDERS);

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setLocation({
          latitude,
          longitude,
          latitudeDelta: 0.05, // Zoom level
          longitudeDelta: 0.05,
        });
      },
      (error) => {
        console.error(error);
        // Fallback to Sofia center if location fails
        setLocation({
          latitude: 42.6977,
          longitude: 23.3219,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  const handleCallProvider = (provider: any) => {
    Alert.alert(
      'Call Provider',
      `Do you want to call ${provider.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call', onPress: () => console.log(`Calling ${provider.phone}`) },
      ]
    );
  };

  const handleChatProvider = (provider: any) => {
    // Navigate to ChatDetailScreen with this provider
    navigation.navigate('ChatDetail', {
      conversationId: `new_${provider.id}`, // Logic to find existing or create new conv
      recipientName: provider.name,
      recipientId: provider.id
    });
  };

  if (!location) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading Map...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE} // Use Google Maps
        style={styles.map}
        initialRegion={location}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {providers.map((provider) => (
          <Marker
            key={provider.id}
            coordinate={{
              latitude: provider.latitude,
              longitude: provider.longitude,
            }}
            title={provider.name}
            description={provider.service}
          >
            {/* Custom Marker View */}
            <View style={styles.markerContainer}>
              <View style={styles.markerBubble}>
                <Text style={styles.markerText}>{provider.service}</Text>
              </View>
              <View style={styles.markerArrow} />
            </View>

            <Callout tooltip onPress={() => handleChatProvider(provider)}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle}>{provider.name}</Text>
                <Text style={styles.calloutSubtitle}>{provider.service} • ⭐ {provider.rating}</Text>
                <View style={styles.calloutButtons}>
                  <TouchableOpacity style={[styles.btn, styles.btnChat]}>
                    <Text style={styles.btnText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.btn, styles.btnCall]}
                    onPress={() => handleCallProvider(provider)}
                  >
                    <Text style={styles.btnText}>Call</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Floating Search Bar (Visual Only for Demo) */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchText}>Find nearby professionals...</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    width: width,
    height: height,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerBubble: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
    width: 200,
    alignItems: 'center',
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
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
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  btn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  btnChat: {
    backgroundColor: '#007AFF',
  },
  btnCall: {
    backgroundColor: '#4CD964',
  },
  btnText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 25,
    padding: 15,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  searchText: {
    color: '#999',
    fontSize: 16,
  },
});

export default MapSearchScreen;
