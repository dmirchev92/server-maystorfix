import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Image,
  Dimensions,
  Modal,
  FlatList,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from '../services/ApiService';
import theme from '../styles/theme';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';

// Helper function to get auth token
const getStoredToken = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('auth_token');
};

// City name mapping (English -> Bulgarian)
const cityNameMapping: Record<string, string> = {
  'Sofia': 'София',
  'Plovdiv': 'Пловдив',
  'Varna': 'Варна',
  'Burgas': 'Бургас',
  'Rousse': 'Русе',
  'Stara Zagora': 'Стара Загора',
};

const { width } = Dimensions.get('window');

const serviceCategories = SERVICE_CATEGORIES.map(cat => ({
  value: cat.value,
  label: cat.label
}));

interface ProfileData {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  businessName?: string;
  serviceCategory?: string;
  description?: string;
  experienceYears?: number;
  hourlyRate?: number;
  city?: string;
  neighborhood?: string;
  address?: string;
  profileImageUrl?: string;
  offeredServices?: string[];
  latitude?: number;
  longitude?: number;
}

const EditProfileScreen: React.FC = () => {
  const { t } = useTranslation('common');
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userRole, setUserRole] = useState<string>('customer');
  
  const [profileData, setProfileData] = useState<ProfileData>({
    firstName: '',
    lastName: '',
    phoneNumber: '',
    email: '',
    businessName: '',
    serviceCategory: '',
    description: '',
    experienceYears: 0,
    hourlyRate: 0,
    city: '',
    neighborhood: '',
    address: '',
    profileImageUrl: '',
    latitude: undefined,
    longitude: undefined
  });

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [offeredServices, setOfferedServices] = useState<string[]>([]);
  const [newService, setNewService] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showNeighborhoodPicker, setShowNeighborhoodPicker] = useState(false);
  
  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Location data from API
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);

  useEffect(() => {
    loadProfileData();
    loadCities();
  }, []);

  const isProvider = userRole === 'provider' || userRole === 'tradesperson' || userRole === 'service_provider';

  // Load neighborhoods when city changes
  useEffect(() => {
    if (profileData.city) {
      loadNeighborhoods(profileData.city);
    } else {
      setNeighborhoods([]);
    }
  }, [profileData.city]);

  const loadCities = async () => {
    try {
      const response = await ApiService.getInstance().getCities();
      if (response.success && response.data?.cities) {
        setCities(response.data.cities.map((c: any) => c.label || c.value));
      }
    } catch (error) {
      Logger.error('Failed to load cities:', error);
      // Fallback to default cities
      setCities(['София', 'Пловдив', 'Варна', 'Бургас']);
    }
  };

  const loadNeighborhoods = async (city: string) => {
    try {
      const response = await ApiService.getInstance().getNeighborhoods(city);
      if (response.success && response.data?.neighborhoods) {
        setNeighborhoods(response.data.neighborhoods.map((n: any) => n.label || n.value));
      } else {
        setNeighborhoods([]);
      }
    } catch (error) {
      Logger.error('Failed to load neighborhoods:', error);
      setNeighborhoods([]);
    }
  };

  // Auto-detect location from GPS
  const [detectingLocation, setDetectingLocation] = useState(false);
  
  const detectLocation = async () => {
    // Request permission on Android
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: t('locationPermissionTitle'),
          message: t('locationPermissionMessage'),
          buttonNeutral: t('askLater'),
          buttonNegative: t('deny'),
          buttonPositive: t('allow'),
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(t('error'), t('locationPermissionDenied'));
        return;
      }
    }

    setDetectingLocation(true);
    
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Use Google reverse geocoding to get city and neighborhood directly
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A&language=bg`;
          const geoResponse = await fetch(geocodeUrl);
          const geoData = await geoResponse.json();
          
          let detectedCity = '';
          let detectedNeighborhood = '';
          let detectedSublocality = '';
          
          if (geoData.results?.[0]?.address_components) {
            for (const comp of geoData.results[0].address_components) {
              // City
              if (comp.types.includes('locality')) {
                detectedCity = cityNameMapping[comp.long_name] || comp.long_name;
              }
              // Neighborhood type is most specific - prioritize it
              if (comp.types.includes('neighborhood')) {
                detectedNeighborhood = comp.long_name;
              }
              // Sublocality is broader (district) - use only as fallback
              if (comp.types.includes('sublocality_level_1') || comp.types.includes('sublocality')) {
                detectedSublocality = comp.long_name;
              }
            }
          }
          
          // Prioritize neighborhood over sublocality
          const finalCity = detectedCity || '';
          const finalNeighborhood = detectedNeighborhood || detectedSublocality || '';
          
          // Update profile with detected location AND coordinates
          if (finalCity || finalNeighborhood) {
            setProfileData(prev => ({
              ...prev,
              city: finalCity || prev.city,
              neighborhood: finalNeighborhood || prev.neighborhood,
              latitude: latitude,
              longitude: longitude,
            }));
            
            Alert.alert(
              t('locationDetected'),
              `${t('city')}: ${finalCity || t('unknown')}\n${t('neighborhood')}: ${detectedNeighborhood || t('unknown')}`,
              [{ text: t('ok') }]
            );
          } else {
            // Still save coordinates even if city/neighborhood couldn't be determined
            setProfileData(prev => ({
              ...prev,
              latitude: latitude,
              longitude: longitude,
            }));
            Alert.alert(t('warning'), t('locationNotDetected'));
          }
        } catch (error) {
          Logger.error('Auto-detect location error:', error);
          Alert.alert(t('error'), t('locationDetectionError'));
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        Logger.error('Geolocation error:', error.message);
        setDetectingLocation(false);
        Alert.alert(t('error'), t('profileUpdateError'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getInstance().getCurrentUser();
      
      if (response.success && response.data) {
        const rawData: any = response.data;
        const userData: any = rawData.user || rawData;
        
        // Set user role from API response
        const role = userData.role || userData.user_role || 'customer';
        setUserRole(role);
        
        // Try to load provider profile for additional fields
        try {
          const providerResponse = await fetch(`https://snapfix.bg/api/v1/marketplace/providers/${userData.id}`, {
            headers: {
              'Authorization': `Bearer ${await getStoredToken()}`,
            },
          });
          
          if (providerResponse.ok) {
            const providerResult: any = await providerResponse.json();
            const providerData = providerResult.data;
            
            setProfileData({
              firstName: providerData.firstName || userData.firstName || userData.first_name || '',
              lastName: providerData.lastName || userData.lastName || userData.last_name || '',
              phoneNumber: providerData.phoneNumber || userData.phoneNumber || userData.phone_number || '',
              email: providerData.email || userData.email || '',
              businessName: providerData.businessName || '',
              serviceCategory: providerData.serviceCategory || '',
              description: providerData.description || '',
              experienceYears: providerData.experienceYears || 0,
              hourlyRate: providerData.hourlyRate || 0,
              city: providerData.city || '',
              neighborhood: providerData.neighborhood || '',
              address: providerData.address || '',
              profileImageUrl: providerData.profileImageUrl || '',
              latitude: providerData.latitude ? parseFloat(providerData.latitude) : undefined,
              longitude: providerData.longitude ? parseFloat(providerData.longitude) : undefined
            });
            
            if (providerData.gallery && Array.isArray(providerData.gallery)) {
              setGalleryImages(providerData.gallery);
            }
            
            if (providerData.offeredServices && Array.isArray(providerData.offeredServices)) {
              setOfferedServices(providerData.offeredServices);
            }
          } else {
            // Fallback to basic user data
            setProfileData({
              firstName: userData.firstName || userData.first_name || '',
              lastName: userData.lastName || userData.last_name || '',
              phoneNumber: userData.phoneNumber || userData.phone_number || '',
              email: userData.email || '',
              businessName: '',
              serviceCategory: '',
              description: '',
              experienceYears: 0,
              hourlyRate: 0,
              city: '',
              neighborhood: '',
              address: '',
              profileImageUrl: ''
            });
          }
        } catch (providerError) {
          Logger.error('Error loading provider profile:', providerError);
          // Use basic user data
          setProfileData({
            firstName: userData.firstName || userData.first_name || '',
            lastName: userData.lastName || userData.last_name || '',
            phoneNumber: userData.phoneNumber || userData.phone_number || '',
            email: userData.email || '',
            businessName: '',
            serviceCategory: '',
            description: '',
            experienceYears: 0,
            hourlyRate: 0,
            city: '',
            neighborhood: '',
            address: '',
            profileImageUrl: ''
          });
        }
      }
    } catch (error) {
      Logger.error('Error loading profile:', error);
      setError(t('profileLoadingError'));
    } finally {
      setLoading(false);
    }
  };

  const getStoredToken = async (): Promise<string | null> => {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return await AsyncStorage.getItem('auth_token');
    } catch (error) {
      return null;
    }
  };

  const getNeighborhoods = () => {
    return neighborhoods;
  };

  const handleImageUpload = async () => {
    try {
      // Use react-native's built-in ImagePicker alternative
      const { launchImageLibrary } = require('react-native-image-picker');
      
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: true,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Alert.alert(t('error'), t('imageSelectionError'));
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        return;
      }

      // Check file size (max 5MB)
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert(t('error'), t('imageFileSizeError'));
        return;
      }

      setSaving(true);
      setError('');

      // Convert to base64
      const base64Data = asset.base64;
      if (!base64Data) {
        Alert.alert(t('error'), t('imageReadingError'));
        setSaving(false);
        return;
      }

      // Get user ID
      const response = await ApiService.getInstance().getCurrentUser();
      const userData: any = response.data?.user || response.data;

      // Upload image
      const uploadResponse = await fetch('https://snapfix.bg/api/v1/uploads/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`,
        },
        body: JSON.stringify({
          userId: userData.id,
          filename: `avatar-${Date.now()}.jpg`,
          data: base64Data,
        }),
      });

      const uploadResult: any = await uploadResponse.json();

      if (uploadResult.success) {
        const baseUrl = 'https://snapfix.bg';
        const imageUrl = `${baseUrl}${uploadResult.data.url}`;
        setProfileData({ ...profileData, profileImageUrl: imageUrl });
        setSuccess(t('imageUploadSuccess'));
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(uploadResult.error?.message || t('imageUploadError'));
      }
    } catch (error: any) {
      Logger.error('Error uploading image:', error);
      Alert.alert(t('error'), t('imageUploadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleGalleryImageUpload = async () => {
    if (galleryImages.length >= 3) {
      Alert.alert(t('error'), t('galleryImageLimitError'));
      return;
    }

    try {
      const { launchImageLibrary } = require('react-native-image-picker');
      
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 900,
        includeBase64: true,
      });

      if (result.didCancel || result.errorCode) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        return;
      }

      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert(t('error'), t('imageFileSizeError'));
        return;
      }

      setSaving(true);
      setError('');

      const base64Data = asset.base64;
      if (!base64Data) {
        Alert.alert(t('error'), t('imageReadingError'));
        setSaving(false);
        return;
      }

      const response = await ApiService.getInstance().getCurrentUser();
      const userData: any = response.data?.user || response.data;

      const uploadResponse = await fetch('https://snapfix.bg/api/v1/uploads/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`,
        },
        body: JSON.stringify({
          userId: userData.id,
          filename: `gallery-${Date.now()}.jpg`,
          data: base64Data,
        }),
      });

      const uploadResult: any = await uploadResponse.json();

      if (uploadResult.success) {
        const baseUrl = 'https://snapfix.bg';
        const imageUrl = `${baseUrl}${uploadResult.data.url}`;
        setGalleryImages([...galleryImages, imageUrl]);
        setSuccess(t('galleryImageUploadSuccess'));
        setTimeout(() => setSuccess(''), 5000);
      } else {
        throw new Error(uploadResult.error?.message || t('galleryImageUploadError'));
      }
    } catch (error: any) {
      Logger.error('Error uploading gallery image:', error);
      Alert.alert(t('error'), t('galleryImageUploadError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profileData.firstName.trim()) {
      setError(t('firstNameRequired'));
      return;
    }
    if (!profileData.lastName.trim()) {
      setError(t('lastNameRequired'));
      return;
    }
    if (!profileData.phoneNumber.trim()) {
      setError(t('phoneNumberRequired'));
      return;
    }
    
    // Phone number validation
    const phone = profileData.phoneNumber.trim();
    const plusFormat = /^\+359[0-9]{8,9}$/;
    const zeroFormat = /^0[0-9]{8,9}$/;
    if (!plusFormat.test(phone) && !zeroFormat.test(phone)) {
      setError(t('phoneNumberInvalid'));
      return;
    }

    // Location validation for providers - coordinates are mandatory
    const isProvider = userRole === 'tradesperson' || userRole === 'service_provider';
    if (isProvider && (!profileData.latitude || !profileData.longitude)) {
      setError(t('locationRequired'));
      return;
    }

    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const response = await ApiService.getInstance().getCurrentUser();
      const userData: any = response.data?.user || response.data;
      
      // Use the same endpoint as web
      const payload = {
        userId: userData.id,
        profile: {
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          phoneNumber: phone.startsWith('0') ? '+359' + phone.substring(1) : phone,
          businessName: profileData.businessName,
          serviceCategory: profileData.serviceCategory,
          description: profileData.description,
          experienceYears: profileData.experienceYears,
          hourlyRate: profileData.hourlyRate,
          city: profileData.city,
          neighborhood: profileData.neighborhood,
          address: profileData.address,
          email: profileData.email,
          profileImageUrl: profileData.profileImageUrl,
          offeredServices: offeredServices,
          latitude: profileData.latitude,
          longitude: profileData.longitude
        },
        gallery: galleryImages
      };

      const updateResponse = await fetch('https://snapfix.bg/api/v1/marketplace/providers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await updateResponse.json();

      if (result.success) {
        setSuccess(t('profileUpdateSuccess'));
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        throw new Error(result.error?.message || t('profileUpdateError'));
      }
    } catch (error: any) {
      Logger.error('Error saving profile:', error);
      setError(error.message || t('profileUpdateError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('editProfile')}</Text>
        </View>

        {/* Success/Error Messages */}
        {success ? (
          <View style={styles.successMessage}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}
        {error ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form Container */}
        <View style={styles.formContainer}>
          {/* Profile Picture Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profilePicture')}</Text>
            <View style={styles.profilePictureContainer}>
              <View style={styles.avatarContainer}>
                {profileData.profileImageUrl ? (
                  <Image
                    source={{ uri: profileData.profileImageUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarInitials}>
                      {profileData.firstName?.charAt(0)}{profileData.lastName?.charAt(0)}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.avatarActions}>
                <TouchableOpacity 
                  style={styles.uploadButton}
                  onPress={handleImageUpload}
                  disabled={saving}
                >
                  <Text style={styles.uploadButtonText}>{t('uploadImage')}</Text>
                </TouchableOpacity>
                <Text style={styles.hint}>{t('imageHint')}</Text>
                {profileData.profileImageUrl ? (
                  <TouchableOpacity
                    onPress={() => setProfileData({ ...profileData, profileImageUrl: '' })}
                  >
                    <Text style={styles.removePhotoText}>{t('removeImage')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Gallery Section - Provider only */}
          {isProvider && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('gallery')}</Text>
              <Text style={styles.sectionDescription}>{t('galleryDescription')}</Text>
              <View style={styles.galleryGrid}>
                {galleryImages.map((imageUrl, index) => (
                  <View key={index} style={styles.galleryItem}>
                    <Image source={{ uri: imageUrl }} style={styles.galleryImage} />
                    <TouchableOpacity
                      style={styles.removeGalleryButton}
                      onPress={() => {
                        const newGallery = galleryImages.filter((_, i) => i !== index);
                        setGalleryImages(newGallery);
                      }}
                    >
                      <Text style={styles.removeGalleryButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                {galleryImages.length < 3 && (
                  <TouchableOpacity 
                    style={styles.addGalleryButton}
                    onPress={handleGalleryImageUpload}
                    disabled={saving}
                  >
                    <Text style={styles.addGalleryIcon}>📸</Text>
                    <Text style={styles.addGalleryText}>{t('addGalleryImage')}</Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={styles.hint}>{t('galleryHint')}</Text>
            </View>
          )}

          {/* Offered Services Section - Provider only */}
          {isProvider && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('offeredServices')}</Text>
              <Text style={styles.sectionDescription}>{t('offeredServicesDescription')}</Text>
              
              {/* Add new service input */}
              <View style={styles.addServiceRow}>
                <TextInput
                  style={styles.addServiceInput}
                  value={newService}
                  onChangeText={setNewService}
                  placeholder={t('addServicePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  maxLength={50}
                />
                <TouchableOpacity
                  style={[styles.addServiceButton, (!newService.trim() || offeredServices.length >= 10) && styles.addServiceButtonDisabled]}
                  onPress={() => {
                    if (newService.trim() && offeredServices.length < 10) {
                      setOfferedServices([...offeredServices, newService.trim()]);
                      setNewService('');
                    }
                  }}
                  disabled={!newService.trim() || offeredServices.length >= 10}
                >
                  <Text style={styles.addServiceButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* List of services */}
              <View style={styles.servicesList}>
                {offeredServices.map((service, index) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text style={styles.serviceItemText}>🔧 {service}</Text>
                    <TouchableOpacity
                      style={styles.removeServiceButton}
                      onPress={() => {
                        setOfferedServices(offeredServices.filter((_, i) => i !== index));
                      }}
                    >
                      <Text style={styles.removeServiceButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {offeredServices.length === 0 && (
                <Text style={styles.noServicesText}>{t('noServices')}</Text>
              )}

              <Text style={styles.hint}>{t('offeredServicesHint')}</Text>
            </View>
          )}

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('personalInfo')}</Text>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>{t('firstName')}</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.firstName}
                  onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
                  placeholder={t('firstNamePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>{t('lastName')}</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.lastName}
                  onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
                  placeholder={t('lastNamePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('phoneNumber')}</Text>
              <TextInput
                style={styles.input}
                value={profileData.phoneNumber}
                onChangeText={(text) => setProfileData({ ...profileData, phoneNumber: text })}
                placeholder={t('phoneNumberPlaceholder')}
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>{t('email')}</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profileData.email}
                editable={false}
              />
            </View>
          </View>

          {/* Business Information - Provider only */}
          {isProvider && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('businessInfo')}</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('businessName')}</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.businessName}
                  onChangeText={(text) => setProfileData({ ...profileData, businessName: text })}
                  placeholder={t('businessNamePlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('serviceCategory')}</Text>
                <TouchableOpacity 
                  style={styles.pickerContainer}
                  onPress={() => setShowCategoryPicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {serviceCategories.find(c => c.value === profileData.serviceCategory)?.label || t('selectServiceCategory')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('description')}</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={profileData.description}
                  onChangeText={(text) => setProfileData({ ...profileData, description: text })}
                  placeholder={t('descriptionPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.label}>{t('experienceYears')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.experienceYears?.toString() || ''}
                    onChangeText={(text) => setProfileData({ ...profileData, experienceYears: parseInt(text) || 0 })}
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.label}>{t('hourlyRate')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.hourlyRate?.toString() || ''}
                    onChangeText={(text) => setProfileData({ ...profileData, hourlyRate: parseFloat(text) || 0 })}
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          )}

          {/* Location - Provider only */}
          {isProvider && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('location')}</Text>
              
              {/* Auto-detect location button */}
              <TouchableOpacity
                style={[styles.detectLocationButton, detectingLocation && styles.detectLocationButtonDisabled]}
                onPress={detectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.detectLocationButtonText}>{t('detectLocation')}</Text>
                )}
              </TouchableOpacity>
              
              <View style={styles.formRow}>
                <View style={styles.formHalf}>
                  <Text style={styles.label}>{t('city')}</Text>
                  <TouchableOpacity 
                    style={styles.pickerContainer}
                    onPress={() => setShowCityPicker(true)}
                  >
                    <Text style={styles.pickerText}>
                      {profileData.city || t('selectCity')}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.formHalf}>
                  <Text style={styles.label}>{t('neighborhood')}</Text>
                  <TouchableOpacity 
                    style={[styles.pickerContainer, !profileData.city && styles.pickerDisabled]}
                    onPress={() => profileData.city && setShowNeighborhoodPicker(true)}
                    disabled={!profileData.city}
                  >
                    <Text style={styles.pickerText}>
                      {!profileData.city ? t('selectCityFirst') : (profileData.neighborhood || t('selectNeighborhood'))}
                    </Text>
                  </TouchableOpacity>
                  {profileData.city && getNeighborhoods().length === 0 && (
                    <Text style={styles.hint}>{t('neighborhoodsComingSoon')}</Text>
                  )}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('address')}</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.address}
                  onChangeText={(text) => setProfileData({ ...profileData, address: text })}
                  placeholder={t('addressPlaceholder')}
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>{t('saveChanges')}</Text>
            )}
          </TouchableOpacity>

          {/* Delete Account Section */}
          <View style={styles.dangerSection}>
            <Text style={styles.dangerSectionTitle}>{t('dangerZone')}</Text>
            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => {
                Alert.alert(
                  t('deleteAccount'),
                  t('deleteAccountWarning'),
                  [
                    { text: t('cancel'), style: 'cancel' },
                    {
                      text: t('proceed'),
                      style: 'destructive',
                      onPress: () => {
                        setShowDeleteModal(true);
                      }
                    }
                  ]
                );
              }}
            >
              <Text style={styles.deleteAccountButtonText}>🗑️ Изтрий акаунта ми</Text>
            </TouchableOpacity>
            <Text style={styles.dangerHint}>
              Изтриването на акаунта е необратимо и всички данни ще бъдат загубени.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Category Picker Modal */}
      <Modal
        visible={showCategoryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectCategory')}</Text>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={serviceCategories}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setProfileData({ ...profileData, serviceCategory: item.value });
                    setShowCategoryPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {profileData.serviceCategory === item.value && (
                    <Text style={styles.modalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* City Picker Modal */}
      <Modal
        visible={showCityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectCity')}</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setProfileData({ ...profileData, city: item, neighborhood: '' });
                    setShowCityPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {profileData.city === item && (
                    <Text style={styles.modalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Neighborhood Picker Modal */}
      <Modal
        visible={showNeighborhoodPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNeighborhoodPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('selectNeighborhood')}</Text>
              <TouchableOpacity onPress={() => setShowNeighborhoodPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={getNeighborhoods()}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalItem}
                  onPress={() => {
                    setProfileData({ ...profileData, neighborhood: item });
                    setShowNeighborhoodPicker(false);
                  }}
                >
                  <Text style={styles.modalItemText}>{item}</Text>
                  {profileData.neighborhood === item && (
                    <Text style={styles.modalItemCheck}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Delete Account Password Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.deleteModalOverlay}>
          <View style={styles.deleteModalContent}>
            <Text style={styles.deleteModalTitle}>🔐 {t('confirmDeletion')}</Text>
            <Text style={styles.deleteModalSubtitle}>
              {t('enterPasswordToConfirm')}
            </Text>
            
            <TextInput
              style={styles.deletePasswordInput}
              placeholder="Вашата парола"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={deletePassword}
              onChangeText={setDeletePassword}
              autoCapitalize="none"
            />
            
            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  setDeletePassword('');
                }}
              >
                <Text style={styles.deleteModalCancelText}>Отказ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.deleteModalConfirmButton, deleting && { opacity: 0.6 }]}
                disabled={deleting || !deletePassword}
                onPress={async () => {
                  if (!deletePassword) {
                    Alert.alert(t('error'), t('enterPassword'));
                    return;
                  }
                  setDeleting(true);
                  try {
                    const token = await getStoredToken();
                    const response = await fetch('https://snapfix.bg/api/v1/auth/delete-account', {
                      method: 'DELETE',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                      },
                      body: JSON.stringify({ password: deletePassword }),
                    });
                    const result = await response.json();
                    if (result.success) {
                      setShowDeleteModal(false);
                      setDeletePassword('');
                      Alert.alert(
                        'Акаунтът е изтрит',
                        'Вашият акаунт беше изтрит успешно.',
                        [{ text: 'OK', onPress: () => {
                          const { AuthBus } = require('../utils/AuthBus');
                          AuthBus.emit('logout');
                        }}]
                      );
                    } else {
                      Alert.alert(t('error'), result.error?.message || t('deleteAccountError'));
                    }
                  } catch (error) {
                    Alert.alert(t('error'), t('deleteProblem'));
                  } finally {
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.deleteModalConfirmText}>Изтрий акаунта</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark slate background
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#CBD5E1',
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backButton: {
    marginBottom: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6366F1',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  successMessage: {
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.5)',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  successText: {
    color: '#6EE7B7',
    fontSize: 14,
  },
  errorMessage: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
    padding: 12,
    margin: 16,
    borderRadius: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  formContainer: {
    padding: 16,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#CBD5E1',
    marginBottom: 12,
  },
  profilePictureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 96,
    height: 96,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  avatarInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  avatarActions: {
    flex: 1,
  },
  uploadButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  removePhotoText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 4,
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  galleryItem: {
    width: (width - 80) / 3,
    height: 100,
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  removeGalleryButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeGalleryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  addGalleryButton: {
    width: (width - 80) / 3,
    height: 100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  addGalleryIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  addGalleryText: {
    fontSize: 10,
    color: '#CBD5E1',
  },
  addServiceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  addServiceInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#FFFFFF',
  },
  addServiceButton: {
    width: 48,
    height: 48,
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addServiceButtonDisabled: {
    backgroundColor: 'rgba(79, 70, 229, 0.3)',
  },
  addServiceButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  servicesList: {
    gap: 8,
    marginBottom: 8,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  serviceItemText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  removeServiceButton: {
    width: 28,
    height: 28,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeServiceButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  noServicesText: {
    color: '#94A3B8',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 12,
  },
  formGroup: {
    marginBottom: 16,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formHalf: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#FFFFFF',
  },
  inputDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: '#94A3B8',
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: 12,
  },
  pickerDisabled: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  pickerText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  saveButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalClose: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalItemText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  modalItemCheck: {
    fontSize: 20,
    color: '#10B981',
    fontWeight: '700',
  },
  detectLocationButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  detectLocationButtonDisabled: {
    opacity: 0.6,
  },
  detectLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Danger Zone / Delete Account Styles
  dangerSection: {
    marginTop: 32,
    padding: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  dangerSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
    marginBottom: 12,
  },
  deleteAccountButton: {
    backgroundColor: '#EF4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerHint: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  // Delete Modal Styles
  deleteModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  deleteModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  deleteModalSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
  deletePasswordInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  deleteModalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  deleteModalCancelButton: {
    flex: 1,
    backgroundColor: 'rgba(100, 116, 139, 0.3)',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalCancelText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteModalConfirmButton: {
    flex: 1,
    backgroundColor: '#EF4444',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteModalConfirmText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditProfileScreen;
