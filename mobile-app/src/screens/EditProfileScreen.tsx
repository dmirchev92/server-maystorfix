import React, { useState, useEffect } from 'react';
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
}

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
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
    profileImageUrl: ''
  });

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
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
      console.error('Failed to load cities:', error);
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
      console.error('Failed to load neighborhoods:', error);
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
          title: 'Достъп до местоположение',
          message: 'Приложението се нуждае от достъп до вашето местоположение за автоматично определяне на града и квартала.',
          buttonNeutral: 'Питай ме по-късно',
          buttonNegative: 'Откажи',
          buttonPositive: 'Разреши',
        }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Грешка', 'Нямате разрешение за достъп до местоположението');
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
          
          // Update profile with detected location
          if (finalCity || finalNeighborhood) {
            setProfileData(prev => ({
              ...prev,
              city: finalCity || prev.city,
              neighborhood: finalNeighborhood || prev.neighborhood,
            }));
            
            Alert.alert(
              '📍 Местоположение открито',
              `Град: ${finalCity || 'Неизвестен'}\nКвартал: ${detectedNeighborhood || 'Неизвестен'}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Внимание', 'Не успяхме да определим местоположението. Моля изберете ръчно.');
          }
        } catch (error) {
          console.error('Auto-detect location error:', error);
          Alert.alert('Грешка', 'Възникна проблем при определяне на местоположението');
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        setDetectingLocation(false);
        Alert.alert('Грешка', 'Не можахме да определим местоположението ви. Проверете GPS настройките.');
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
        
        // Try to load provider profile for additional fields
        try {
          const providerResponse = await fetch(`https://maystorfix.com/api/v1/marketplace/providers/${userData.id}`, {
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
              profileImageUrl: providerData.profileImageUrl || ''
            });
            
            if (providerData.gallery && Array.isArray(providerData.gallery)) {
              setGalleryImages(providerData.gallery);
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
          console.error('Error loading provider profile:', providerError);
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
      console.error('Error loading profile:', error);
      setError('Грешка при зареждане на профила');
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
        Alert.alert('Грешка', 'Неуспешно избиране на снимка');
        return;
      }

      const asset = result.assets?.[0];
      if (!asset || !asset.uri) {
        return;
      }

      // Check file size (max 5MB)
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Грешка', 'Файлът е твърде голям. Максимален размер: 5MB');
        return;
      }

      setSaving(true);
      setError('');

      // Convert to base64
      const base64Data = asset.base64;
      if (!base64Data) {
        Alert.alert('Грешка', 'Неуспешно четене на снимката');
        setSaving(false);
        return;
      }

      // Get user ID
      const response = await ApiService.getInstance().getCurrentUser();
      const userData: any = response.data?.user || response.data;

      // Upload image
      const uploadResponse = await fetch('https://maystorfix.com/api/v1/uploads/image', {
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
        const baseUrl = 'https://maystorfix.com';
        const imageUrl = `${baseUrl}${uploadResult.data.url}`;
        setProfileData({ ...profileData, profileImageUrl: imageUrl });
        setSuccess('✅ Снимката е качена успешно!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        throw new Error(uploadResult.error?.message || 'Failed to upload image');
      }
    } catch (error: any) {
      console.error('Error uploading image:', error);
      Alert.alert('Грешка', 'Неуспешно качване на снимката');
    } finally {
      setSaving(false);
    }
  };

  const handleGalleryImageUpload = async () => {
    if (galleryImages.length >= 3) {
      Alert.alert('Грешка', 'Можете да качите максимум 3 снимки');
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
        Alert.alert('Грешка', 'Файлът е твърде голям. Максимален размер: 5MB');
        return;
      }

      setSaving(true);
      setError('');

      const base64Data = asset.base64;
      if (!base64Data) {
        Alert.alert('Грешка', 'Неуспешно четене на снимката');
        setSaving(false);
        return;
      }

      const response = await ApiService.getInstance().getCurrentUser();
      const userData: any = response.data?.user || response.data;

      const uploadResponse = await fetch('https://maystorfix.com/api/v1/uploads/image', {
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
        const baseUrl = 'https://maystorfix.com';
        const imageUrl = `${baseUrl}${uploadResult.data.url}`;
        setGalleryImages([...galleryImages, imageUrl]);
        setSuccess('✅ Снимката е качена успешно! Не забравяйте да запазите промените.');
        setTimeout(() => setSuccess(''), 5000);
      } else {
        throw new Error(uploadResult.error?.message || 'Failed to upload image');
      }
    } catch (error: any) {
      console.error('Error uploading gallery image:', error);
      Alert.alert('Грешка', 'Неуспешно качване на снимката');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!profileData.firstName.trim()) {
      setError('Моля въведете име');
      return;
    }
    if (!profileData.lastName.trim()) {
      setError('Моля въведете фамилия');
      return;
    }
    if (!profileData.phoneNumber.trim()) {
      setError('Моля въведете телефонен номер');
      return;
    }
    
    // Phone number validation
    const phone = profileData.phoneNumber.trim();
    const plusFormat = /^\+359[0-9]{8,9}$/;
    const zeroFormat = /^0[0-9]{8,9}$/;
    if (!plusFormat.test(phone) && !zeroFormat.test(phone)) {
      setError('Телефонният номер трябва да започва с +359 или 0 (напр. 0888123456 или +359888123456)');
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
          profileImageUrl: profileData.profileImageUrl
        },
        gallery: galleryImages
      };

      const updateResponse = await fetch('https://maystorfix.com/api/v1/marketplace/providers/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getStoredToken()}`,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await updateResponse.json();

      if (result.success) {
        setSuccess('✅ Профилът е актуализиран успешно!');
        setTimeout(() => {
          navigation.goBack();
        }, 2000);
      } else {
        throw new Error(result.error?.message || 'Неуспешна актуализация');
      }
    } catch (error: any) {
      console.error('Error saving profile:', error);
      setError(error.message || 'Грешка при актуализация на профила');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Зареждане...</Text>
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
            <Text style={styles.backButtonText}>← Назад</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>✏️ Редактирай профил</Text>
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
            <Text style={styles.sectionTitle}>Профилна снимка</Text>
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
                  <Text style={styles.uploadButtonText}>📷 Качи снимка</Text>
                </TouchableOpacity>
                <Text style={styles.hint}>Макс. 5MB. Препоръчително: 400x400px</Text>
                {profileData.profileImageUrl ? (
                  <TouchableOpacity
                    onPress={() => setProfileData({ ...profileData, profileImageUrl: '' })}
                  >
                    <Text style={styles.removePhotoText}>🗑️ Премахни снимката</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Gallery Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Галерия с работи ({galleryImages.length}/3)</Text>
            <Text style={styles.sectionDescription}>Качете до 3 снимки на завършени проекти</Text>
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
                  <Text style={styles.addGalleryText}>Качи снимка</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.hint}>Макс. 5MB на снимка. Препоръчително: 800x600px</Text>
          </View>

          {/* Personal Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Лична информация</Text>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Име *</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.firstName}
                  onChangeText={(text) => setProfileData({ ...profileData, firstName: text })}
                  placeholder="Въведете име"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Фамилия *</Text>
                <TextInput
                  style={styles.input}
                  value={profileData.lastName}
                  onChangeText={(text) => setProfileData({ ...profileData, lastName: text })}
                  placeholder="Въведете фамилия"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Телефон *</Text>
              <TextInput
                style={styles.input}
                value={profileData.phoneNumber}
                onChangeText={(text) => setProfileData({ ...profileData, phoneNumber: text })}
                placeholder="+359..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email (не може да се променя)</Text>
              <TextInput
                style={[styles.input, styles.inputDisabled]}
                value={profileData.email}
                editable={false}
              />
            </View>
          </View>

          {/* Business Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Бизнес информация</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.label}>Име на бизнеса</Text>
              <TextInput
                style={styles.input}
                value={profileData.businessName}
                onChangeText={(text) => setProfileData({ ...profileData, businessName: text })}
                placeholder="Напр. Електро Експерт ЕООД"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Категория услуга</Text>
              <TouchableOpacity 
                style={styles.pickerContainer}
                onPress={() => setShowCategoryPicker(true)}
              >
                <Text style={styles.pickerText}>
                  {serviceCategories.find(c => c.value === profileData.serviceCategory)?.label || 'Изберете категория'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Описание</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={profileData.description}
                onChangeText={(text) => setProfileData({ ...profileData, description: text })}
                placeholder="Опишете вашите услуги и опит..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Години опит</Text>
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
                <Text style={styles.label}>Цена на час (лв)</Text>
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

          {/* Location */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Локация</Text>
            
            {/* Auto-detect location button */}
            <TouchableOpacity
              style={[styles.detectLocationButton, detectingLocation && styles.detectLocationButtonDisabled]}
              onPress={detectLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.detectLocationButtonText}>📍 Открий автоматично</Text>
              )}
            </TouchableOpacity>
            
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Град</Text>
                <TouchableOpacity 
                  style={styles.pickerContainer}
                  onPress={() => setShowCityPicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {profileData.city || 'Изберете град'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Квартал</Text>
                <TouchableOpacity 
                  style={[styles.pickerContainer, !profileData.city && styles.pickerDisabled]}
                  onPress={() => profileData.city && setShowNeighborhoodPicker(true)}
                  disabled={!profileData.city}
                >
                  <Text style={styles.pickerText}>
                    {!profileData.city ? 'Първо изберете град' : (profileData.neighborhood || 'Изберете квартал')}
                  </Text>
                </TouchableOpacity>
                {profileData.city && getNeighborhoods().length === 0 && (
                  <Text style={styles.hint}>Кварталите за {profileData.city} скоро ще бъдат добавени</Text>
                )}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Адрес</Text>
              <TextInput
                style={styles.input}
                value={profileData.address}
                onChangeText={(text) => setProfileData({ ...profileData, address: text })}
                placeholder="ул. Примерна 123"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>💾 Запази промените</Text>
            )}
          </TouchableOpacity>

          {/* Delete Account Section */}
          <View style={styles.dangerSection}>
            <Text style={styles.dangerSectionTitle}>⚠️ Опасна зона</Text>
            <TouchableOpacity
              style={styles.deleteAccountButton}
              onPress={() => {
                Alert.alert(
                  '⚠️ Изтриване на акаунт',
                  'Сигурни ли сте, че искате да изтриете акаунта си?\n\n❌ Всички ваши данни ще бъдат изтрити завинаги\n❌ Всички заявки, чатове и история ще бъдат загубени\n❌ Това действие е необратимо!',
                  [
                    { text: 'Отказ', style: 'cancel' },
                    {
                      text: 'Продължи',
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
              <Text style={styles.modalTitle}>Изберете категория</Text>
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
              <Text style={styles.modalTitle}>Изберете град</Text>
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
              <Text style={styles.modalTitle}>Изберете квартал</Text>
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
            <Text style={styles.deleteModalTitle}>🔐 Потвърдете изтриването</Text>
            <Text style={styles.deleteModalSubtitle}>
              Въведете паролата си за да потвърдите изтриването на акаунта:
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
                    Alert.alert('Грешка', 'Моля въведете парола');
                    return;
                  }
                  setDeleting(true);
                  try {
                    const token = await getStoredToken();
                    const response = await fetch('https://maystorfix.com/api/v1/auth/delete-account', {
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
                      Alert.alert('Грешка', result.error?.message || 'Неуспешно изтриване на акаунта');
                    }
                  } catch (error) {
                    Alert.alert('Грешка', 'Възникна проблем при изтриването');
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
