import { Logger } from '../utils/Logger';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  PermissionsAndroid,
  Modal,
  FlatList,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import Geolocation from 'react-native-geolocation-service';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TESTING_CONFIG } from '../config/testingConfig';
import { Linking } from 'react-native';

// City name mapping (English -> Bulgarian)
const CITY_NAME_MAP: Record<string, string> = {
  'Sofia': 'София',
  'Plovdiv': 'Пловдив',
  'Varna': 'Варна',
  'Burgas': 'Бургас',
  'Rousse': 'Русе',
  'Stara Zagora': 'Стара Загора',
  'Pleven': 'Плевен',
  'Sliven': 'Сливен',
  'Dobrich': 'Добрич',
  'Shumen': 'Шумен',
};

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

type UserType = 'customer' | 'provider';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const { t } = useTranslation('auth');
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);
  const [userType, setUserType] = useState<UserType>('customer');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    companyName: '',
    serviceCategory: '',
    city: '',
    neighborhood: '',
    address: '',
  });
  
  // Location state
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const [showNeighborhoodPicker, setShowNeighborhoodPicker] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<any[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [receiveUpdates, setReceiveUpdates] = useState(false);
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTier, setSelectedTier] = useState<'free' | 'normal' | 'pro'>('free');
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('yearly');
  const [showTierModal, setShowTierModal] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // Load saved credentials if any
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('remember_email');
        const savedPassword = await AsyncStorage.getItem('remember_password');
        const savedFlag = await AsyncStorage.getItem('remember_flag');
        const shouldRemember = savedFlag === '1';
        if (shouldRemember && (savedEmail || savedPassword)) {
          setFormData(prev => ({
            ...prev,
            email: savedEmail || '',
            password: savedPassword || '',
          }));
          setRememberMe(true);
        }
      } catch (e) {
        // ignore
      }
    };
    
    // Load service categories
    const loadServiceCategories = async () => {
      try {
        const response = await ApiService.getInstance().getServiceCategories();
        if (response.success && response.data) {
          const categories = (response.data as any[]).map((cat: any) => ({
            id: cat.id,
            name: cat.label || cat.name_bg || cat.name || cat.id
          }));
          setServiceCategories(categories);
        }
      } catch (error) {
        Logger.debug('Failed to load service categories:', error);
        // Fallback categories - import from constants
        const { SERVICE_CATEGORIES } = require('../constants/serviceCategories');
        setServiceCategories(
          SERVICE_CATEGORIES.map((cat: any) => ({
            id: cat.value,
            name: cat.label
          }))
        );
      }
    };
    
    loadSavedCredentials();
    loadServiceCategories();
    loadCities();
  }, []);

  // Load neighborhoods when city changes
  useEffect(() => {
    if (formData.city) {
      loadNeighborhoods(formData.city);
    } else {
      setNeighborhoods([]);
    }
  }, [formData.city]);

  const loadCities = async () => {
    try {
      const response = await ApiService.getInstance().getCities();
      if (response.success && response.data?.cities) {
        setCities(response.data.cities.map((c: any) => c.label || c.value));
      }
    } catch (error) {
      Logger.error('Failed to load cities:', error);
      setCities(['София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора']);
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

  // Google Places address autocomplete
  const searchAddress = async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&types=address&components=country:bg&language=bg&key=AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A`
      );
      const data = await response.json();
      if (data.predictions) {
        setAddressSuggestions(data.predictions);
        setShowAddressSuggestions(true);
      }
    } catch (error) {
      Logger.error('Address search error:', error);
    }
  };

  // Select address from suggestions
  const selectAddress = async (placeId: string, description: string) => {
    setShowAddressSuggestions(false);
    setFormData(prev => ({ ...prev, address: description }));

    try {
      // Get place details to extract city and neighborhood
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=address_components,geometry&language=bg&key=AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A`
      );
      const detailsData = await detailsResponse.json();

      if (detailsData.result?.geometry?.location) {
        const { lat, lng } = detailsData.result.geometry.location;
        
        // Save coordinates for registration
        setLocationCoords({ latitude: lat, longitude: lng });
        
        // Use REVERSE geocoding to get accurate neighborhood (same as GPS auto-detect)
        const reverseGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A&language=bg`;
        const reverseResponse = await fetch(reverseGeocodeUrl);
        const reverseData = await reverseResponse.json();

        let city = '';
        let neighborhood = '';

        if (reverseData.results?.[0]?.address_components) {
          for (const comp of reverseData.results[0].address_components) {
            // City
            if (comp.types.includes('locality')) {
              city = CITY_NAME_MAP[comp.long_name] || comp.long_name;
            }
            // Neighborhood - reverse geocoding has accurate neighborhood data
            if (comp.types.includes('sublocality_level_1') || 
                comp.types.includes('sublocality') || 
                comp.types.includes('neighborhood')) {
              neighborhood = comp.long_name;
            }
          }
        }

        setFormData(prev => ({
          ...prev,
          city: city || prev.city,
          neighborhood: neighborhood || prev.neighborhood,
        }));
      }
    } catch (error) {
      Logger.error('Error getting place details:', error);
    }
  };

  // Auto-detect location from GPS
  const detectLocation = async () => {
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
        Alert.alert('Грешка', t('locationPermissionDenied'));
        return;
      }
    }

    setDetectingLocation(true);

    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          // Use Google reverse geocoding
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A&language=bg`;
          const geoResponse = await fetch(geocodeUrl);
          const geoData = await geoResponse.json();

          let detectedCity = '';
          let detectedNeighborhood = '';
          let detectedSublocality = '';
          let detectedAddress = '';
          
          if (geoData.results?.[0]) {
            detectedAddress = geoData.results[0].formatted_address || '';
            
            // TESTING: If AUTO_DETECT_LOCATION enabled, accept any location worldwide
            if (TESTING_CONFIG.AUTO_DETECT_LOCATION) {
              Logger.info('🌍 International location detection enabled');
            }
            
            // Extract city and neighborhood directly from Google's address_components
            for (const comp of geoData.results[0].address_components) {
              // City
              if (comp.types.includes('locality')) {
                // TESTING: For international locations, keep original city name
                if (TESTING_CONFIG.AUTO_DETECT_LOCATION) {
                  detectedCity = comp.long_name; // London, Paris, etc.
                } else {
                  detectedCity = CITY_NAME_MAP[comp.long_name] || comp.long_name;
                }
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
          // TESTING: For international mode, don't force Sofia as default
          const finalCity = detectedCity || (TESTING_CONFIG.AUTO_DETECT_LOCATION ? 'Unknown' : 'София');
          const finalNeighborhood = detectedNeighborhood || detectedSublocality;

          if (finalCity || finalNeighborhood) {
            setFormData(prev => ({
              ...prev,
              city: finalCity || prev.city,
              neighborhood: finalNeighborhood || prev.neighborhood,
              address: detectedAddress || prev.address,
            }));
            // Save coordinates for registration
            setLocationCoords({ latitude, longitude });

            Alert.alert(
              `📍 ${t('locationDetected')}`,
              t('locationDetectedMessage', { city: finalCity || t('unknown'), neighborhood: finalNeighborhood || t('unknown') }),
              [{ text: 'Добре' }]
            );
          } else {
            Alert.alert('Предупреждение', t('locationDetectFailed'));
          }
        } catch (error) {
          Logger.error('Auto-detect location error:', error);
          Alert.alert('Грешка', t('locationError'));
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        Logger.error('Geolocation error:', error.message);
        setDetectingLocation(false);
        Alert.alert('Грешка', t('gpsError'));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Грешка', t('errorEmailPassword'));
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.getInstance().login(
        formData.email,
        formData.password
      );

      if (response.success) {
        Logger.debug('AuthScreen - Login successful, setting token and calling onAuthSuccess');
        await ApiService.getInstance().setAuthToken(response.data?.tokens?.accessToken);
        if (response.data?.tokens?.refreshToken) {
          await ApiService.getInstance().setRefreshToken(response.data.tokens.refreshToken);
        }
        Logger.debug('AuthScreen - Token set, calling onAuthSuccess with user:', response.data?.user);
        // Remember credentials if requested
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('remember_email', formData.email);
            await AsyncStorage.setItem('remember_password', formData.password);
            await AsyncStorage.setItem('remember_flag', '1');
          } else {
            await AsyncStorage.setItem('remember_flag', '0');
            // keep old values if present; do not erase on a single login toggle
          }
        } catch {}

        // Navigate immediately; let /auth/me verify in background
        onAuthSuccess(response.data?.user || { id: 'local', email: formData.email } as any);
      } else {
        Alert.alert('Грешка', response.error?.message || t('errorLoginFailed'));
      }
    } catch (error) {
      Alert.alert('Грешка', t('errorLoginError'));
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    // TESTING: Allow international phones if flag enabled
    if (TESTING_CONFIG.ALLOW_INTERNATIONAL_PHONES) {
      // Accept any international format: +XXX followed by digits
      const internationalFormat = /^\+[1-9][0-9]{7,14}$/;
      return internationalFormat.test(phone);
    }
    
    // Production: Bulgaria only
    // Accept +359 format or 0 format for Bulgarian numbers
    const plusFormat = /^\+359[0-9]{8,9}$/;
    const zeroFormat = /^0[0-9]{8,9}$/;
    return plusFormat.test(phone) || zeroFormat.test(phone);
  };

  const formatPhoneNumber = (phone: string): string => {
    // If already has +, return as-is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    // Convert 0 format to +359 format (Bulgaria only)
    if (phone.startsWith('0')) {
      return '+359' + phone.substring(1);
    }
    
    return phone;
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      Alert.alert('Грешка', t('errorEnterEmail'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      Alert.alert('Грешка', t('errorValidEmail'));
      return;
    }

    setLoading(true);
    try {
      await ApiService.getInstance().requestPasswordReset(forgotPasswordEmail.trim());
      // Always show success for security
      setForgotPasswordSubmitted(true);
    } catch (error) {
      // Still show success for security
      setForgotPasswordSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Common validation
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.firstName || !formData.lastName || !formData.phoneNumber) {
      Alert.alert('Грешка', t('errorAllFieldsRequired'));
      return;
    }

    // Provider-specific validation - only serviceCategory is required, companyName is optional
    if (userType === 'provider' && !formData.serviceCategory) {
      Alert.alert('Грешка', t('errorSelectCategory'));
      return;
    }

    // Location is mandatory for providers
    if (userType === 'provider' && (!formData.city || !locationCoords)) {
      Alert.alert(
        t('locationRequired'),
        t('locationRequiredMessage')
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Грешка', t('errorPasswordMismatch'));
      return;
    }

    if (!validatePassword(formData.password)) {
      Alert.alert('Грешка', t('errorPasswordWeak'));
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Грешка', t('errorTermsRequired'));
      return;
    }

    // Phone number validation
    if (!validatePhoneNumber(formData.phoneNumber)) {
      const errorMessage = TESTING_CONFIG.ALLOW_INTERNATIONAL_PHONES
        ? t('errorPhoneFormatIntl')
        : t('errorPhoneFormatBG');
      
      Alert.alert(t('errorInvalidPhone'), errorMessage);
      return;
    }

    setLoading(true);
    try {
      // Format phone number to +359 format
      const formattedPhone = formatPhoneNumber(formData.phoneNumber);

      const registrationData: any = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formattedPhone,
        role: userType === 'provider' ? 'tradesperson' : 'customer',
        gdprConsents: ['essential_service'],
      };

      // Add provider-specific fields
      if (userType === 'provider') {
        registrationData.serviceCategory = formData.serviceCategory;
        registrationData.companyName = formData.companyName;
        registrationData.subscription_tier_id = selectedTier;
        registrationData.city = formData.city;
        registrationData.neighborhood = formData.neighborhood;
        registrationData.address = formData.address;
        // Include coordinates for search visibility
        if (locationCoords) {
          registrationData.latitude = locationCoords.latitude;
          registrationData.longitude = locationCoords.longitude;
        }
      }

      const response = await ApiService.getInstance().register(registrationData);

      Logger.debug('Registration response:', JSON.stringify(response, null, 2));

      if (response.success) {
        Logger.debug('Registration successful, tokens:', response.data?.tokens);
        await ApiService.getInstance().setAuthToken(response.data?.tokens?.accessToken);
        if (response.data?.tokens?.refreshToken) {
          await ApiService.getInstance().setRefreshToken(response.data.tokens.refreshToken);
        }
        // Remember credentials if requested
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('remember_email', formData.email);
            await AsyncStorage.setItem('remember_password', formData.password);
            await AsyncStorage.setItem('remember_flag', '1');
          } else {
            await AsyncStorage.setItem('remember_flag', '0');
          }
        } catch {}

        onAuthSuccess(response.data?.user || { id: 'local', email: formData.email } as any);
      } else {
        Logger.debug('Registration failed:', response.error);
        Alert.alert('Грешка', response.error?.message || t('errorRegistrationFailed'));
      }
    } catch (error) {
      Logger.debug('Registration error:', error);
      Alert.alert('Грешка', `${t('errorRegistrationError')}: ${error instanceof Error ? error.message : t('errorUnknown')}`);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Success Screen
  if (isForgotPassword && forgotPasswordSubmitted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <Text style={styles.icon}>✉️</Text>
              </View>
              <Text style={styles.title}>{t('checkYourEmail')}</Text>
              <Text style={styles.subtitle}>
                {t('passwordResetSent', { email: forgotPasswordEmail })}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📧</Text>
                  <Text style={styles.infoText}>{t('linkValidFor')} <Text style={styles.bold}>{t('oneHour')}</Text></Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📥</Text>
                  <Text style={styles.infoText}>{t('checkSpam')} <Text style={styles.bold}>{t('spam')}</Text></Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modernButton}
                onPress={() => {
                  setIsForgotPassword(false);
                  setForgotPasswordSubmitted(false);
                  setForgotPasswordEmail('');
                }}
              >
                <Text style={styles.modernButtonText}>🔓 {t('backToSignIn')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchContainer}
                onPress={() => {
                  setForgotPasswordSubmitted(false);
                  setForgotPasswordEmail('');
                }}
              >
                <Text style={styles.switchLink}>{t('tryAnotherEmail')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    );
  }

  // Forgot Password - Form Screen
  if (isForgotPassword) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView 
          style={styles.flex1} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setIsForgotPassword(false)}
            >
              <Text style={styles.backButtonText}>← {t('back')}</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>🔑</Text>
              </View>
              <Text style={styles.title}>{t('forgotPasswordTitle')}</Text>
              <Text style={styles.subtitle}>
                {t('forgotPasswordSubtitle')}
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>{t('emailAddress')}</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="ivan@example.com"
                  placeholderTextColor="#64748b"
                  value={forgotPasswordEmail}
                  onChangeText={setForgotPasswordEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.modernButton, loading && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.modernButtonText}>
                  {loading ? `⏳ ${t('sending')}` : `📧 ${t('sendLink')}`}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <TouchableOpacity onPress={() => setIsForgotPassword(false)}>
                  <Text style={styles.switchLink}>{t('backToLogin')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        style={styles.flex1} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔧</Text>
            </View>
            <Text style={styles.title}>
              {isLogin ? t('loginToSnapFix') : t('createAccount')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? t('welcomeBack') : t('startJourney')}
            </Text>
          </View>

          <View style={styles.form}>
            {/* User Type Selection - Only show for registration */}
            {!isLogin && (
              <View style={styles.userTypeContainer}>
                <Text style={styles.fieldLabel}>{t('registerAs')}</Text>
                <View style={styles.userTypeButtons}>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'customer' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('customer')}
                  >
                    <Text style={styles.userTypeIcon}>👤</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'customer' && styles.userTypeBtnTextActive]}>
                      {t('customer')}
                    </Text>
                    <Text style={styles.userTypeDesc}>{t('lookingForServices')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'provider' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('provider')}
                  >
                    <Text style={styles.userTypeIcon}>🔧</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'provider' && styles.userTypeBtnTextActive]}>
                      {t('specialist')}
                    </Text>
                    <Text style={styles.userTypeDesc}>{t('offeringServices')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isLogin && (
              <>
                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>{t('firstName')} *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder={t('ivanov')}
                      placeholderTextColor="#64748b"
                      value={formData.firstName}
                      onChangeText={(value) => handleInputChange('firstName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>{t('lastName')} *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder={t('petrov')}
                      placeholderTextColor="#64748b"
                      value={formData.lastName}
                      onChangeText={(value) => handleInputChange('lastName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('emailAddress')} *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="ivan@example.com"
                    placeholderTextColor="#64748b"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('phoneLabel')} *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="+359xxxxxxxxx"
                    placeholderTextColor="#64748b"
                    value={formData.phoneNumber}
                    onChangeText={(value) => handleInputChange('phoneNumber', value)}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Provider-specific fields */}
                {userType === 'provider' && (
                  <>
                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>{t('companyName')} ({t('optional')})</Text>
                      <TextInput
                        style={styles.modernInput}
                        placeholder={t('yourCompanyLLC')}
                        placeholderTextColor="#64748b"
                        value={formData.companyName}
                        onChangeText={(value) => handleInputChange('companyName', value)}
                      />
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>{t('serviceCategory')} *</Text>
                      <View style={styles.modernPickerWrapper}>
                        <Picker
                          selectedValue={formData.serviceCategory}
                          onValueChange={(value) => handleInputChange('serviceCategory', value)}
                          style={styles.modernPicker}
                          dropdownIconColor="#818cf8"
                        >
                          <Picker.Item label={t('selectCategory')} value="" color="#64748b" />
                          {serviceCategories.map((category) => (
                            <Picker.Item
                              key={category.id}
                              label={category.name}
                              value={category.id}
                              color="#ffffff"
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>

                    {/* Tier Selection - Production Mode: Show all 3 tiers */}
                    <View style={styles.tierSelectionContainer}>
                      <Text style={styles.fieldLabel}>{t('selectTier')} *</Text>
                      <TouchableOpacity
                        style={styles.tierDisplayBox}
                        onPress={() => setShowTierModal(true)}
                      >
                        <View style={styles.tierInfo}>
                          <Text style={styles.tierName}>
                            {selectedTier === 'free' && `🆓 ${t('tierFree')}`}
                            {selectedTier === 'normal' && `⭐ ${t('tierNormal')}`}
                            {selectedTier === 'pro' && `👑 ${t('tierPro')}`}
                          </Text>
                          <Text style={styles.tierPrice}>
                            {selectedTier === 'free' && `0 € - ${t('trialPeriod')}`}
                            {selectedTier === 'normal' && (billingPeriod === 'yearly' ? '1,400 €/година' : '130 €/месец')}
                            {selectedTier === 'pro' && (billingPeriod === 'yearly' ? '1,900 €/година' : '230 €/месец')}
                          </Text>
                        </View>
                        <Text style={styles.pickerArrow}>▼</Text>
                      </TouchableOpacity>
                      <Text style={styles.tierHint}>
                        {selectedTier === 'free' && `🆓 ${t('freeTierHint')}`}
                        {selectedTier === 'normal' && `⭐ ${t('recommendedForSmall')}`}
                        {selectedTier === 'pro' && `👑 ${t('bestForProfessionals')}`}
                      </Text>
                    </View>

                    {/* Location Section */}
                    <View style={styles.locationSection}>
                      <Text style={styles.sectionLabel}>📍 {t('location')}</Text>
                      
                      {/* Locate Me Button */}
                      <TouchableOpacity
                        style={[styles.locateButton, detectingLocation && styles.locateButtonDisabled]}
                        onPress={detectLocation}
                        disabled={detectingLocation}
                      >
                        {detectingLocation ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.locateButtonText}>📍 {t('detectLocation')}</Text>
                        )}
                      </TouchableOpacity>

                      <Text style={styles.orText}>{t('orEnterAddress')}</Text>

                      {/* Address Input with Autocomplete */}
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>{t('address')}</Text>
                        <TextInput
                          style={styles.modernInput}
                          placeholder={t('startTypingAddress')}
                          placeholderTextColor="#64748b"
                          value={formData.address}
                          onChangeText={(value) => {
                            handleInputChange('address', value);
                            searchAddress(value);
                          }}
                          onFocus={() => formData.address.length >= 3 && setShowAddressSuggestions(true)}
                        />
                        
                        {/* Address Suggestions */}
                        {showAddressSuggestions && addressSuggestions.length > 0 && (
                          <View style={styles.suggestionsContainer}>
                            {addressSuggestions.slice(0, 5).map((suggestion, index) => (
                              <TouchableOpacity
                                key={suggestion.place_id || index}
                                style={styles.suggestionItem}
                                onPress={() => selectAddress(suggestion.place_id, suggestion.description)}
                              >
                                <Text style={styles.suggestionText} numberOfLines={2}>
                                  {suggestion.description}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* City and Neighborhood Row */}
                      <View style={styles.row}>
                        <View style={styles.halfWidth}>
                          <Text style={styles.fieldLabel}>{t('city')}</Text>
                          <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowCityPicker(true)}
                          >
                            <Text style={[styles.pickerButtonText, !formData.city && styles.pickerPlaceholder]}>
                              {formData.city || t('selectCity')}
                            </Text>
                            <Text style={styles.pickerArrow}>▼</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.halfWidth}>
                          <Text style={styles.fieldLabel}>{t('neighborhood')}</Text>
                          <TouchableOpacity
                            style={[styles.pickerButton, !formData.city && styles.pickerDisabled]}
                            onPress={() => formData.city && setShowNeighborhoodPicker(true)}
                            disabled={!formData.city}
                          >
                            <Text style={[styles.pickerButtonText, !formData.neighborhood && styles.pickerPlaceholder]}>
                              {formData.neighborhood || t('selectNeighborhood')}
                            </Text>
                            <Text style={styles.pickerArrow}>▼</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.locationHint}>💡 {t('locationHelps')}</Text>
                    </View>
                  </>
                )}

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('common:password')} *</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor="#64748b"
                      value={formData.password}
                      onChangeText={(value) => handleInputChange('password', value)}
                      secureTextEntry={!showPassword}
                      onFocus={() => setShowPasswordHint(true)}
                      onBlur={() => setShowPasswordHint(false)}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                  {showPasswordHint && (
                    <Text style={styles.passwordHint}>
                      {t('passwordHint')}
                    </Text>
                  )}
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('confirmPassword')} *</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor="#64748b"
                      value={formData.confirmPassword}
                      onChangeText={(value) => handleInputChange('confirmPassword', value)}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <Text style={styles.eyeIcon}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.checkboxContainer}>
                  <View style={styles.checkboxRow}>
                    <TouchableOpacity
                      style={styles.modernCheckbox}
                      onPress={() => setAcceptTerms(!acceptTerms)}
                    >
                      <View style={[styles.modernCheckbox, acceptTerms && styles.modernCheckboxChecked]}>
                        {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                    <Text style={styles.checkboxText}>
                      Съгласявам се с{' '}
                      <Text 
                        style={styles.linkText}
                        onPress={() => Linking.openURL('https://snapfix.bg/terms')}
                      >
                        условията
                      </Text>
                      {' '}и{' '}
                      <Text 
                        style={styles.linkText}
                        onPress={() => Linking.openURL('https://snapfix.bg/privacy-policy')}
                      >
                        правилата
                      </Text>
                    </Text>
                  </View>
                </View>
              </>
            )}

            {isLogin && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('emailAddress')}</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="ivan@example.com"
                    placeholderTextColor="#64748b"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>{t('common:password')}</Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="••••••••"
                      placeholderTextColor="#64748b"
                      value={formData.password}
                      onChangeText={(value) => handleInputChange('password', value)}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setShowPassword(!showPassword)}
                    >
                      <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.modernButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
            >
              <Text style={styles.modernButtonText}>
                {loading ? `⏳ ${t('loading')}` : (isLogin ? `🔓 ${t('signIn')}` : `✨ ${t('createAccount')}`)}
              </Text>
            </TouchableOpacity>

            {/* Remember Me & Forgot Password */}
            {isLogin && (
              <>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modernCheckbox, rememberMe && styles.modernCheckboxChecked]}>
                    {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>{t('rememberMe')}</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.forgotPasswordBtn}
                  onPress={() => setIsForgotPassword(true)}
                >
                  <Text style={styles.forgotPasswordLink}>{t('forgotPassword')}</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin ? t('dontHaveAccount') + ' ' : t('alreadyHaveAccount') + ' '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={styles.switchLink}>
                  {isLogin ? t('signUpNow') : t('signInNow')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Tier Selection Modal */}
      {showTierModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.tierModalContent}>
            <View style={styles.tierModalHeader}>
              <Text style={styles.tierModalTitle}>{t('selectYourPlan')}</Text>
              <TouchableOpacity onPress={() => setShowTierModal(false)}>
                <Text style={styles.tierModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Free Tier */}
            <TouchableOpacity
              style={[styles.tierOption, selectedTier === 'free' && styles.tierOptionSelected]}
              onPress={() => { setSelectedTier('free'); setShowTierModal(false); }}
            >
              <View style={[styles.tierRadio, selectedTier === 'free' && styles.tierRadioSelected]}>
                {selectedTier === 'free' && <View style={styles.tierRadioDot} />}
              </View>
              <View style={styles.tierOptionContent}>
                <Text style={styles.tierOptionName}>🆓 {t('tierFree')}</Text>
                <Text style={styles.tierOptionPrice}>0 €</Text>
                <Text style={styles.tierFeature}>• Временен достъп до всички услуги на платформата</Text>
              </View>
            </TouchableOpacity>

            {/* Normal Tier */}
            <TouchableOpacity
              style={[styles.tierOption, selectedTier === 'normal' && styles.tierOptionSelected]}
              onPress={() => { setSelectedTier('normal'); }}
            >
              <View style={[styles.tierRadio, selectedTier === 'normal' && styles.tierRadioSelected]}>
                {selectedTier === 'normal' && <View style={styles.tierRadioDot} />}
              </View>
              <View style={styles.tierOptionContent}>
                <Text style={styles.tierOptionName}>⭐ {t('tierNormal')}</Text>
                
                {/* Billing Period Selection for Normal */}
                {selectedTier === 'normal' && (
                  <View style={styles.billingPeriodContainer}>
                    <TouchableOpacity
                      style={[styles.billingPeriodButton, billingPeriod === 'yearly' && styles.billingPeriodButtonActive]}
                      onPress={() => setBillingPeriod('yearly')}
                    >
                      <Text style={[styles.billingPeriodText, billingPeriod === 'yearly' && styles.billingPeriodTextActive]}>
                        Годишно: 1,400 €
                      </Text>
                      <Text style={styles.billingPeriodSavings}>🎁 10% отстъпка</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.billingPeriodButton, billingPeriod === 'monthly' && styles.billingPeriodButtonActive]}
                      onPress={() => setBillingPeriod('monthly')}
                    >
                      <Text style={[styles.billingPeriodText, billingPeriod === 'monthly' && styles.billingPeriodTextActive]}>
                        Месечно: 130 €
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text style={styles.tierFeature}>• {billingPeriod === 'yearly' ? '1,000' : '50'} {t('points')}/{billingPeriod === 'yearly' ? t('perYear') : t('perMonth')}</Text>
                <Text style={styles.tierFeature}>• Заявки до 1,000 €</Text>
                <Text style={styles.tierFeature}>• SMS: 2 точки/съобщение</Text>
                <Text style={styles.tierFeature}>• 3 снимки в галерията</Text>
              </View>
            </TouchableOpacity>

            {/* Pro Tier */}
            <TouchableOpacity
              style={[styles.tierOption, selectedTier === 'pro' && styles.tierOptionSelected]}
              onPress={() => { setSelectedTier('pro'); }}
            >
              <View style={[styles.tierRadio, selectedTier === 'pro' && styles.tierRadioSelected]}>
                {selectedTier === 'pro' && <View style={styles.tierRadioDot} />}
              </View>
              <View style={styles.tierOptionContent}>
                <View style={styles.tierNameRow}>
                  <Text style={styles.tierOptionName}>👑 {t('tierPro')}</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>{t('recommended')}</Text>
                  </View>
                </View>
                
                {/* Billing Period Selection for Pro */}
                {selectedTier === 'pro' && (
                  <View style={styles.billingPeriodContainer}>
                    <TouchableOpacity
                      style={[styles.billingPeriodButton, billingPeriod === 'yearly' && styles.billingPeriodButtonActive]}
                      onPress={() => setBillingPeriod('yearly')}
                    >
                      <Text style={[styles.billingPeriodText, billingPeriod === 'yearly' && styles.billingPeriodTextActive]}>
                        Годишно: 1,900 €
                      </Text>
                      <Text style={styles.billingPeriodSavings}>🎁 15% отстъпка</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.billingPeriodButton, billingPeriod === 'monthly' && styles.billingPeriodButtonActive]}
                      onPress={() => setBillingPeriod('monthly')}
                    >
                      <Text style={[styles.billingPeriodText, billingPeriod === 'monthly' && styles.billingPeriodTextActive]}>
                        Месечно: 230 €
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
                
                <Text style={styles.tierFeature}>• {billingPeriod === 'yearly' ? '2,000' : '100'} {t('points')}/{billingPeriod === 'yearly' ? t('perYear') : t('perMonth')}</Text>
                <Text style={styles.tierFeature}>• Всички бюджети (до 10,000 €)</Text>
                <Text style={styles.tierFeature}>• SMS: 1 точка/съобщение</Text>
                <Text style={styles.tierFeature}>• До 100 снимки</Text>
                <Text style={styles.tierFeature}>• PRO значка + VIP видимост</Text>
                <Text style={styles.tierFeature}>• Приоритетна поддръжка</Text>
              </View>
            </TouchableOpacity>
            
            {/* Confirm Button */}
            <TouchableOpacity
              style={styles.tierModalConfirmButton}
              onPress={() => setShowTierModal(false)}
            >
              <Text style={styles.tierModalConfirmText}>Избери {selectedTier === 'free' ? 'безплатен' : selectedTier === 'normal' ? 'нормален' : 'професионален'} план</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* City Picker Modal */}
      <Modal
        visible={showCityPicker}
/* ... */
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{t('selectCity')}</Text>
              <TouchableOpacity onPress={() => setShowCityPicker(false)}>
                <Text style={styles.pickerModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={cities}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerModalItem}
                  onPress={() => {
                    setFormData(prev => ({ ...prev, city: item, neighborhood: '' }));
                    setShowCityPicker(false);
                  }}
                >
                  <Text style={[styles.pickerModalItemText, formData.city === item && styles.pickerModalItemSelected]}>
                    {item}
                  </Text>
                  {formData.city === item && <Text style={styles.pickerModalCheck}>✓</Text>}
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
        <View style={styles.pickerModal}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>{t('selectNeighborhood')}</Text>
              <TouchableOpacity onPress={() => setShowNeighborhoodPicker(false)}>
                <Text style={styles.pickerModalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {neighborhoods.length > 0 ? (
              <FlatList
                data={neighborhoods}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerModalItem}
                    onPress={() => {
                      setFormData(prev => ({ ...prev, neighborhood: item }));
                      setShowNeighborhoodPicker(false);
                    }}
                  >
                    <Text style={[styles.pickerModalItemText, formData.neighborhood === item && styles.pickerModalItemSelected]}>
                      {item}
                    </Text>
                    {formData.neighborhood === item && <Text style={styles.pickerModalCheck}>✓</Text>}
                  </TouchableOpacity>
                )}
              />
            ) : (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <Text style={{ color: '#94a3b8', textAlign: 'center' }}>
                  {t('noNeighborhoods')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // User Type Selection Styles
  userTypeContainer: {
    marginBottom: 24,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  userTypeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userTypeBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#818cf8',
  },
  userTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  userTypeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  userTypeBtnTextActive: {
    color: '#ffffff',
  },
  userTypeDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  modernInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#ffffff',
  },
  eyeButton: {
    padding: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eyeIcon: {
    fontSize: 18,
  },
  modernPickerWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  modernPicker: {
    height: 50,
    color: '#ffffff',
  },
  passwordHint: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 6,
    lineHeight: 16,
  },
  checkboxContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modernCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modernCheckboxChecked: {
    backgroundColor: '#818cf8',
    borderColor: '#818cf8',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 20,
  },
  linkText: {
    color: '#818cf8',
    textDecorationLine: 'underline',
  },
  modernButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modernButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  switchLink: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '600',
  },
  // Legacy/utility styles
  buttonDisabled: {
    opacity: 0.6,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#818cf8',
    borderColor: '#818cf8',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
    marginTop: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
  },
  picker: {
    height: 50,
    color: '#2c3e50',
  },
  // Forgot Password styles
  loginOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  forgotPasswordBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '500',
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  bold: {
    fontWeight: '600',
    color: '#ffffff',
  },
  // Tier Selection Styles
  tierSelectionContainer: {
    marginBottom: 16,
  },
  tierDisplayBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderRadius: 12,
    padding: 16,
  },
  tierInfo: {
    flex: 1,
  },
  tierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  tierPrice: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '500',
  },
  tierChangeText: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '500',
  },
  tierHint: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 8,
  },
  // Launch Mode Badge
  launchBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  launchBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  // Tier Modal Styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tierModalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  tierModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  tierModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  tierModalClose: {
    fontSize: 24,
    color: '#94a3b8',
    padding: 4,
  },
  tierOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  tierOptionSelected: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#818cf8',
  },
  tierRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#64748b',
    marginRight: 14,
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierRadioSelected: {
    borderColor: '#818cf8',
    backgroundColor: '#818cf8',
  },
  tierRadioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ffffff',
  },
  tierOptionContent: {
    flex: 1,
  },
  tierNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tierOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  tierOptionPrice: {
    fontSize: 14,
    fontWeight: '500',
    color: '#818cf8',
    marginBottom: 8,
  },
  tierFeature: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 2,
  },
  tierFeatureHighlight: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendedBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  recommendedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  billingPeriodContainer: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 8,
  },
  billingPeriodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#1e293b',
  },
  billingPeriodButtonActive: {
    borderColor: '#818cf8',
    backgroundColor: '#818cf8/20',
  },
  billingPeriodText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  billingPeriodTextActive: {
    color: '#818cf8',
  },
  billingPeriodSavings: {
    fontSize: 10,
    color: '#10b981',
    textAlign: 'center',
    marginTop: 2,
  },
  tierModalConfirmButton: {
    backgroundColor: '#818cf8',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  tierModalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Location Section Styles
  locationSection: {
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.2)',
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 12,
  },
  locateButton: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  locateButtonDisabled: {
    opacity: 0.6,
  },
  locateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  orText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
  },
  suggestionsContainer: {
    backgroundColor: 'rgba(30, 41, 59, 0.98)',
    borderRadius: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    maxHeight: 200,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  suggestionText: {
    color: '#e2e8f0',
    fontSize: 14,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  pickerPlaceholder: {
    color: '#64748b',
  },
  pickerArrow: {
    color: '#818cf8',
    fontSize: 12,
  },
  pickerDisabled: {
    opacity: 0.5,
  },
  locationHint: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 8,
  },
  // City/Neighborhood Picker Modal Styles
  pickerModal: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  pickerModalClose: {
    fontSize: 24,
    color: '#94a3b8',
    padding: 4,
  },
  pickerModalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerModalItemText: {
    fontSize: 16,
    color: '#e2e8f0',
  },
  pickerModalItemSelected: {
    color: '#818cf8',
    fontWeight: '600',
  },
  pickerModalCheck: {
    fontSize: 16,
    color: '#818cf8',
  },
});
