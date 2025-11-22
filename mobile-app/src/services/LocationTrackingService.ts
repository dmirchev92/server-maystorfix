import Geolocation from 'react-native-geolocation-service';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import ApiService from './ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';

class LocationTrackingService {
  private static instance: LocationTrackingService;
  private watchId: number | null = null;
  private isTracking = false;
  private lastUpdate: number = 0;
  private UPDATE_INTERVAL = 15 * 1000; // 15 seconds interval for backend updates (more frequent for live tracking)

  private constructor() {}

  public static getInstance(): LocationTrackingService {
    if (!LocationTrackingService.instance) {
      LocationTrackingService.instance = new LocationTrackingService();
    }
    return LocationTrackingService.instance;
  }

  /**
   * Check if tracking is currently active
   */
  public isTrackingActive(): boolean {
    return this.isTracking;
  }

  /**
   * Get tracking preference
   */
  public async getTrackingPreference(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem('tracking_enabled');
      return value !== 'false'; // Default to true if not set
    } catch (error) {
      return true;
    }
  }

  /**
   * Set tracking preference
   */
  public async setTrackingPreference(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem('tracking_enabled', enabled.toString());
      if (enabled) {
        this.startTracking();
      } else {
        this.stopTracking();
      }
    } catch (error) {
      console.error('Error saving tracking preference:', error);
    }
  }

  /**
   * Request location permissions
   */
  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'ios') {
      const auth = await Geolocation.requestAuthorization('whenInUse');
      if (auth === 'granted') {
        // Try to upgrade to always
        // await Geolocation.requestAuthorization('always'); 
        return true;
      }
      return false;
    }

    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'ServiceTextPro Location Permission',
            message: 'ServiceTextPro needs access to your location to show you nearby jobs.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        
        // For background location on Android 10+
        if (granted === PermissionsAndroid.RESULTS.GRANTED && Platform.Version >= 29) {
           // We could request ACCESS_BACKGROUND_LOCATION here if needed for true background
           // await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
        }

        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }

    return false;
  }

  /**
   * Start location tracking
   */
  async startTracking(): Promise<void> {
    if (this.isTracking) return;

    // Check preference first
    const enabled = await this.getTrackingPreference();
    if (!enabled) {
      console.log('📍 Tracking disabled by user preference');
      return;
    }

    const hasPermission = await this.requestPermissions();
    if (!hasPermission) {
      console.log('❌ Location permission denied');
      return;
    }

    console.log('📍 Starting location tracking...');
    this.isTracking = true;

    // Get immediate position first
    this.getCurrentLocation(true);

    // Start watching
    this.watchId = Geolocation.watchPosition(
      (position) => {
        console.log('📍 Location update received:', position.coords.latitude, position.coords.longitude);
        this.handleLocationUpdate(position);
      },
      (error) => {
        console.error('❌ Location error:', error);
      },
      {
        enableHighAccuracy: true,
        distanceFilter: 50, // Update every 50 meters
        interval: 15000, 
        fastestInterval: 10000,
        showLocationDialog: true,
        forceRequestLocation: true,
      }
    );
  }

  /**
   * Stop location tracking
   */
  async stopTracking(): Promise<void> {
    if (this.watchId !== null) {
      Geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.isTracking = false;
    this.lastUpdate = 0; // Reset throttle
    console.log('📍 Location tracking stopped');
    
    // Clear location on backend
    await this.clearLocationOnBackend();
  }

  /**
   * Clear location on backend
   */
  private async clearLocationOnBackend(): Promise<void> {
    try {
      console.log('📍 Clearing location on backend...');
      await ApiService.getInstance().makeRequest('/tracking/location', {
        method: 'DELETE'
      });
      console.log('✅ Location cleared on backend');
    } catch (error) {
      console.error('❌ Error clearing location on backend:', error);
    }
  }

  /**
   * Force a one-time update
   */
  async getCurrentLocation(force = false): Promise<void> {
    Geolocation.getCurrentPosition(
      (position) => {
        this.handleLocationUpdate(position, force);
      },
      (error) => {
        console.error('❌ Error getting current location:', error);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  /**
   * Handle location update and send to backend
   */
  private async handleLocationUpdate(position: Geolocation.GeoPosition, force = false): Promise<void> {
    const now = Date.now();
    
    // Throttle updates to backend (unless it's the first one or forced)
    if (!force && this.lastUpdate > 0 && now - this.lastUpdate < this.UPDATE_INTERVAL) {
      console.log('📍 Skipping backend update (throttled)');
      return;
    }

    try {
      const { latitude, longitude, heading, speed } = position.coords;
      console.log(`📍 Sending location to backend: ${latitude}, ${longitude} (Force: ${force})`);
      
      // Send to backend
      const response = await ApiService.getInstance().makeRequest('/tracking/update', {
        method: 'POST',
        body: JSON.stringify({
          latitude,
          longitude,
          heading,
          speed
        })
      });

      if (response.success) {
        console.log('✅ Location updated on backend');
        this.lastUpdate = now;
      } else {
        console.warn('⚠️ Failed to update location on backend:', response.error);
      }

    } catch (error) {
      console.error('❌ Error sending location to backend:', error);
    }
  }
}

export default LocationTrackingService;
