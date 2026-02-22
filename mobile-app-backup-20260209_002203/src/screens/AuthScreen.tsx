import { Logger } from '../utils/Logger';
import React, { useEffect, useState } from 'react';
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
  const [showTierModal, setShowTierModal] = useState(false);
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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
            
            // Extract city and neighborhood directly from Google's address_components
            for (const comp of geoData.results[0].address_components) {
              // City
              if (comp.types.includes('locality')) {
                detectedCity = CITY_NAME_MAP[comp.long_name] || comp.long_name;
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
          const finalCity = detectedCity || 'София';
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
              '📍 Местоположение открито',
              `Град: ${finalCity || 'Неизвестен'}\nКвартал: ${finalNeighborhood || 'Неизвестен'}`,
              [{ text: 'OK' }]
            );
          } else {
            Alert.alert('Внимание', 'Не успяхме да определим местоположението. Моля изберете ръчно.');
          }
        } catch (error) {
          Logger.error('Auto-detect location error:', error);
          Alert.alert('Грешка', 'Възникна проблем при определяне на местоположението');
        } finally {
          setDetectingLocation(false);
        }
      },
      (error) => {
        Logger.error('Geolocation error:', error.message);
        setDetectingLocation(false);
        Alert.alert('Грешка', 'Не можахме да определим местоположението ви. Проверете GPS настройките.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    );
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Грешка', 'Моля въведете имейл и парола');
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
        Alert.alert('Грешка', response.error?.message || 'Неуспешен вход');
      }
    } catch (error) {
      Alert.alert('Грешка', 'Възникна грешка при входа');
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
    // Accept +359 format or 0 format for Bulgarian numbers
    const plusFormat = /^\+359[0-9]{8,9}$/;
    const zeroFormat = /^0[0-9]{8,9}$/;
    return plusFormat.test(phone) || zeroFormat.test(phone);
  };

  const formatPhoneNumber = (phone: string): string => {
    // Convert 0 format to +359 format
    if (phone.startsWith('0')) {
      return '+359' + phone.substring(1);
    }
    return phone;
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      Alert.alert('Грешка', 'Моля въведете имейл адрес');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      Alert.alert('Грешка', 'Моля въведете валиден имейл адрес');
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
      Alert.alert('Грешка', 'Моля попълнете всички задължителни полета');
      return;
    }

    // Provider-specific validation - only serviceCategory is required, companyName is optional
    if (userType === 'provider' && !formData.serviceCategory) {
      Alert.alert('Грешка', 'Моля изберете категория услуги');
      return;
    }

    // Location is mandatory for providers
    if (userType === 'provider' && (!formData.city || !locationCoords)) {
      Alert.alert(
        'Локацията е задължителна',
        'Моля използвайте бутона "Открий локацията ми" или въведете адрес ръчно, за да можете да бъдете намерени от клиенти.'
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Грешка', 'Паролите не съвпадат');
      return;
    }

    if (!validatePassword(formData.password)) {
      Alert.alert('Грешка', 'Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ');
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Грешка', 'Трябва да приемете условията за ползване');
      return;
    }

    // Phone number validation
    if (!validatePhoneNumber(formData.phoneNumber)) {
      Alert.alert(
        'Невалиден телефонен номер',
        'Телефонният номер трябва да започва с +359 или 0\n\nПримери:\n• 0888123456\n• +359888123456'
      );
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
        Alert.alert('Грешка', response.error?.message || 'Неуспешна регистрация');
      }
    } catch (error) {
      Logger.debug('Registration error:', error);
      Alert.alert('Грешка', `Възникна грешка при регистрацията: ${error instanceof Error ? error.message : 'Неизвестна грешка'}`);
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
              <Text style={styles.title}>Проверете имейла си</Text>
              <Text style={styles.subtitle}>
                Ако съществува акаунт с имейл {forgotPasswordEmail}, ще получите линк за възстановяване на паролата.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📧</Text>
                  <Text style={styles.infoText}>Линкът е валиден <Text style={styles.bold}>1 час</Text></Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📥</Text>
                  <Text style={styles.infoText}>Проверете и папката <Text style={styles.bold}>Спам</Text></Text>
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
                <Text style={styles.modernButtonText}>🔓 Обратно към вход</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchContainer}
                onPress={() => {
                  setForgotPasswordSubmitted(false);
                  setForgotPasswordEmail('');
                }}
              >
                <Text style={styles.switchLink}>Опитайте с друг имейл</Text>
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
              <Text style={styles.backButtonText}>← Назад</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>🔑</Text>
              </View>
              <Text style={styles.title}>Забравена парола</Text>
              <Text style={styles.subtitle}>
                Въведете имейла си и ще ви изпратим линк за възстановяване
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Имейл адрес</Text>
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
                  {loading ? '⏳ Изпращане...' : '📧 Изпратете линк'}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <TouchableOpacity onPress={() => setIsForgotPassword(false)}>
                  <Text style={styles.switchLink}>Обратно към вход</Text>
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
              {isLogin ? 'Влезте в SnapFix' : 'Създайте акаунт'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Добре дошли отново!' : 'Започнете пътуването си с нас днес.'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* User Type Selection - Only show for registration */}
            {!isLogin && (
              <View style={styles.userTypeContainer}>
                <Text style={styles.fieldLabel}>Регистрирай се като:</Text>
                <View style={styles.userTypeButtons}>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'customer' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('customer')}
                  >
                    <Text style={styles.userTypeIcon}>👤</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'customer' && styles.userTypeBtnTextActive]}>
                      Клиент
                    </Text>
                    <Text style={styles.userTypeDesc}>Търся услуги</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'provider' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('provider')}
                  >
                    <Text style={styles.userTypeIcon}>🔧</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'provider' && styles.userTypeBtnTextActive]}>
                      Специалист
                    </Text>
                    <Text style={styles.userTypeDesc}>Предлагам услуги</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isLogin && (
              <>
                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>Име *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Иван"
                      placeholderTextColor="#64748b"
                      value={formData.firstName}
                      onChangeText={(value) => handleInputChange('firstName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>Фамилия *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Петров"
                      placeholderTextColor="#64748b"
                      value={formData.lastName}
                      onChangeText={(value) => handleInputChange('lastName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Имейл адрес *</Text>
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
                  <Text style={styles.fieldLabel}>Телефон *</Text>
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
                      <Text style={styles.fieldLabel}>Име на фирма (по избор)</Text>
                      <TextInput
                        style={styles.modernInput}
                        placeholder="Вашата компания ООД"
                        placeholderTextColor="#64748b"
                        value={formData.companyName}
                        onChangeText={(value) => handleInputChange('companyName', value)}
                      />
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>Категория услуги *</Text>
                      <View style={styles.modernPickerWrapper}>
                        <Picker
                          selectedValue={formData.serviceCategory}
                          onValueChange={(value) => handleInputChange('serviceCategory', value)}
                          style={styles.modernPicker}
                          dropdownIconColor="#818cf8"
                        >
                          <Picker.Item label="Изберете категория" value="" color="#64748b" />
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

                    {/* Tier Selection - LAUNCH MODE: Show only Free tier with special benefits */}
                    <View style={styles.tierSelectionContainer}>
                      <Text style={styles.fieldLabel}>Избран план</Text>
                      <View style={styles.tierDisplayBox}>
                        <View style={styles.tierInfo}>
                          <Text style={styles.tierName}>🎁 Безплатен (Промо)</Text>
                          <Text style={styles.tierPrice}>0 € - Пълен достъп</Text>
                        </View>
                        <View style={styles.launchBadge}>
                          <Text style={styles.launchBadgeText}>LAUNCH</Text>
                        </View>
                      </View>
                      <Text style={styles.tierHint}>🚀 Специална оферта: 50 безплатни SMS + пълен достъп до всички функции!</Text>
                    </View>

                    {/* Location Section */}
                    <View style={styles.locationSection}>
                      <Text style={styles.sectionLabel}>📍 Локация</Text>
                      
                      {/* Locate Me Button */}
                      <TouchableOpacity
                        style={[styles.locateButton, detectingLocation && styles.locateButtonDisabled]}
                        onPress={detectLocation}
                        disabled={detectingLocation}
                      >
                        {detectingLocation ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.locateButtonText}>📍 Открий автоматично</Text>
                        )}
                      </TouchableOpacity>

                      <Text style={styles.orText}>или въведете адрес</Text>

                      {/* Address Input with Autocomplete */}
                      <View style={styles.fieldContainer}>
                        <Text style={styles.fieldLabel}>Адрес</Text>
                        <TextInput
                          style={styles.modernInput}
                          placeholder="Започнете да пишете адрес..."
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
                          <Text style={styles.fieldLabel}>Град</Text>
                          <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowCityPicker(true)}
                          >
                            <Text style={[styles.pickerButtonText, !formData.city && styles.pickerPlaceholder]}>
                              {formData.city || 'Изберете град'}
                            </Text>
                            <Text style={styles.pickerArrow}>▼</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.halfWidth}>
                          <Text style={styles.fieldLabel}>Квартал</Text>
                          <TouchableOpacity
                            style={[styles.pickerButton, !formData.city && styles.pickerDisabled]}
                            onPress={() => formData.city && setShowNeighborhoodPicker(true)}
                            disabled={!formData.city}
                          >
                            <Text style={[styles.pickerButtonText, !formData.neighborhood && styles.pickerPlaceholder]}>
                              {!formData.city ? 'Първо изберете град' : (formData.neighborhood || 'Изберете квартал')}
                            </Text>
                            <Text style={styles.pickerArrow}>▼</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={styles.locationHint}>💡 Локацията помага на клиентите да ви намерят</Text>
                    </View>
                  </>
                )}

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Парола *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry
                    onFocus={() => setShowPasswordHint(true)}
                    onBlur={() => setShowPasswordHint(false)}
                  />
                  {showPasswordHint && (
                    <Text style={styles.passwordHint}>
                      Мин. 8 символа, главна буква, малка буква, цифра и специален символ
                    </Text>
                  )}
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Потвърдете паролата *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    secureTextEntry
                  />
                </View>

                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAcceptTerms(!acceptTerms)}
                  >
                    <View style={[styles.modernCheckbox, acceptTerms && styles.modernCheckboxChecked]}>
                      {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxText}>
                      Съгласявам се с <Text style={styles.linkText}>Условията и правилата</Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setReceiveUpdates(!receiveUpdates)}
                  >
                    <View style={[styles.modernCheckbox, receiveUpdates && styles.modernCheckboxChecked]}>
                      {receiveUpdates && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxText}>
                      Получавайте бюлетин и актуализации
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {isLogin && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Имейл адрес</Text>
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
                  <Text style={styles.fieldLabel}>Парола</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.modernButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
            >
              <Text style={styles.modernButtonText}>
                {loading ? '⏳ Зареждане...' : (isLogin ? '🔓 Влезте' : '✨ Създайте акаунт')}
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
                  <Text style={styles.checkboxText}>Запомни ме</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.forgotPasswordBtn}
                  onPress={() => setIsForgotPassword(true)}
                >
                  <Text style={styles.forgotPasswordLink}>Забравена парола?</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin ? 'Нямате акаунт? ' : 'Вече имате акаунт? '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={styles.switchLink}>
                  {isLogin ? 'Регистрирайте се' : 'Влезте'}
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
              <Text style={styles.tierModalTitle}>Изберете вашия план</Text>
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
                <Text style={styles.tierOptionName}>🆓 Безплатен</Text>
                <Text style={styles.tierOptionPrice}>0 €</Text>
                <Text style={styles.tierFeature}>• 14 дни пробен период</Text>
                <Text style={styles.tierFeature}>• 5 заявки безплатно</Text>
                <Text style={styles.tierFeature}>• Бюджети до 250 €</Text>
              </View>
            </TouchableOpacity>

            {/* Normal Tier */}
            <TouchableOpacity
              style={[styles.tierOption, selectedTier === 'normal' && styles.tierOptionSelected]}
              onPress={() => { setSelectedTier('normal'); setShowTierModal(false); }}
            >
              <View style={[styles.tierRadio, selectedTier === 'normal' && styles.tierRadioSelected]}>
                {selectedTier === 'normal' && <View style={styles.tierRadioDot} />}
              </View>
              <View style={styles.tierOptionContent}>
                <View style={styles.tierNameRow}>
                  <Text style={styles.tierOptionName}>⭐ Нормален</Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Препоръчан</Text>
                  </View>
                </View>
                <Text style={styles.tierOptionPrice}>179 €/година (с ДДС)</Text>
                <Text style={styles.tierFeature}>• 350 точки/година</Text>
                <Text style={styles.tierFeature}>• Бюджети до 1000 €</Text>
                <Text style={styles.tierFeature}>• Пълен достъп до заявки</Text>
              </View>
            </TouchableOpacity>

            {/* Pro Tier */}
            <TouchableOpacity
              style={[styles.tierOption, selectedTier === 'pro' && styles.tierOptionSelected]}
              onPress={() => { setSelectedTier('pro'); setShowTierModal(false); }}
            >
              <View style={[styles.tierRadio, selectedTier === 'pro' && styles.tierRadioSelected]}>
                {selectedTier === 'pro' && <View style={styles.tierRadioDot} />}
              </View>
              <View style={styles.tierOptionContent}>
                <Text style={styles.tierOptionName}>👑 Професионален</Text>
                <Text style={styles.tierOptionPrice}>249 €/година (с ДДС)</Text>
                <Text style={styles.tierFeature}>• 500 точки/година</Text>
                <Text style={styles.tierFeature}>• Неограничени бюджети</Text>
                <Text style={styles.tierFeature}>• 20% отстъпка на точки</Text>
                <Text style={styles.tierFeature}>• Приоритетна поддръжка</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* City Picker Modal */}
      <Modal
        visible={showCityPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCityPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>Изберете град</Text>
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
              <Text style={styles.pickerModalTitle}>Изберете квартал</Text>
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
                  Няма налични квартали за избрания град
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
