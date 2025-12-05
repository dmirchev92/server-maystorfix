import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import DateTimePicker from '@react-native-community/datetimepicker';
import { launchImageLibrary, launchCamera, Asset } from 'react-native-image-picker';
import ApiService from '../services/ApiService';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';
import debounce from 'lodash/debounce';

// Budget ranges matching web (up to 10k)
const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв' },
  { value: '250-500', label: '250-500 лв' },
  { value: '500-750', label: '500-750 лв' },
  { value: '750-1000', label: '750-1000 лв' },
  { value: '1000-1500', label: '1000-1500 лв' },
  { value: '1500-2000', label: '1500-2000 лв' },
  { value: '2000-3000', label: '2000-3000 лв' },
  { value: '3000-4000', label: '3000-4000 лв' },
  { value: '4000-5000', label: '4000-5000 лв' },
  { value: '5000-7500', label: '5000-7500 лв' },
  { value: '7500-10000', label: '7500-10000 лв' },
  { value: '10000+', label: '10000+ лв' },
];

// City name mapping (English to Bulgarian)
const CITY_NAME_MAP: { [key: string]: string } = {
  'Sofia': 'София',
  'Plovdiv': 'Пловдив',
  'Varna': 'Варна',
  'Burgas': 'Бургас',
  'Ruse': 'Русе',
  'Stara Zagora': 'Стара Загора',
  'Pleven': 'Плевен',
  'Sliven': 'Сливен',
  'Dobrich': 'Добрич',
  'Shumen': 'Шумен',
  'Pernik': 'Перник',
  'Haskovo': 'Хасково',
  'Yambol': 'Ямбол',
  'Pazardzhik': 'Пазарджик',
  'Blagoevgrad': 'Благоевград',
  'Veliko Tarnovo': 'Велико Търново',
  'Vratsa': 'Враца',
  'Gabrovo': 'Габрово',
  'Asenovgrad': 'Асеновград',
  'Vidin': 'Видин',
  'Kazanlak': 'Казанлък',
  'Kyustendil': 'Кюстендил',
  'Montana': 'Монтана',
  'Dimitrovgrad': 'Димитровград',
  'Lovech': 'Ловеч',
  'Silistra': 'Силистра',
  'Targovishte': 'Търговище',
  'Dupnitsa': 'Дупница',
  'Smolyan': 'Смолян',
  'Petrich': 'Петрич',
  'Sandanski': 'Сандански',
  'Samokov': 'Самоков',
  'Sevlievo': 'Севлиево',
  'Karlovo': 'Карлово',
  'Velingrad': 'Велинград',
  'Troyan': 'Троян',
  'Botevgrad': 'Ботевград',
  'Gotse Delchev': 'Гоце Делчев',
};

// Google Places API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyAXQf53JEFPgoxHoCXz3lMKQ5itjHcTd4A';

interface PlacePrediction {
  place_id: string;
  description: string;
}

// const TIME_OPTIONS = [
//   { value: 'morning', label: 'Сутрин (8:00-12:00)' },
//   { value: 'afternoon', label: 'Следобед (12:00-17:00)' },
//   { value: 'evening', label: 'Вечер (17:00-20:00)' },
//   { value: 'flexible', label: 'Гъвкаво време' },
// ];

// const PRIORITY_OPTIONS = [
//   { value: 'low', label: 'Нисък' },
//   { value: 'normal', label: 'Нормален' },
//   { value: 'urgent', label: 'Спешен' },
// ];

// Dropdown component
interface DropdownOption {
  value: string;
  label: string;
  icon?: string;
}

interface DropdownProps {
  label: string;
  value: string;
  options: readonly DropdownOption[] | DropdownOption[];
  onSelect: (value: string) => void;
  placeholder?: string;
}

function Dropdown({ label, value, options, onSelect, placeholder = 'Изберете...' }: DropdownProps) {
  const [visible, setVisible] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <>
      <TouchableOpacity style={styles.dropdown} onPress={() => setVisible(true)}>
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {selectedOption?.label || placeholder}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalItem, item.value === value && styles.modalItemActive]}
                  onPress={() => {
                    onSelect(item.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.modalItemText, item.value === value && styles.modalItemTextActive]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Text style={styles.modalItemCheck}>✓</Text>}
                </TouchableOpacity>
              )}
              style={styles.modalList}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

export default function CreateCaseScreen() {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    serviceType: '',
    description: '',
    city: '',
    neighborhood: '',
    address: '',
    phone: '',
    preferredDate: new Date(),
    preferredTime: 'morning',
    priority: 'normal',
    budget: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [images, setImages] = useState<Asset[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // Google Places Autocomplete state
  const [addressInput, setAddressInput] = useState('');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [locationDetected, setLocationDetected] = useState(false);

  useEffect(() => {
    loadUserData();
    getCurrentLocation();
  }, []);
  
  // Debounced search for Google Places
  const searchPlaces = useCallback(
    debounce(async (input: string) => {
      if (input.length < 2) {
        setPredictions([]);
        setShowPredictions(false);
        return;
      }
      
      setLoadingPredictions(true);
      try {
        const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:bg&language=bg&key=${GOOGLE_MAPS_API_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.predictions) {
          setPredictions(data.predictions);
          setShowPredictions(true);
        }
      } catch (error) {
        console.error('Places autocomplete error:', error);
      } finally {
        setLoadingPredictions(false);
      }
    }, 300),
    []
  );
  
  const handleAddressInputChange = (text: string) => {
    setAddressInput(text);
    searchPlaces(text);
  };
  
  const handlePlaceSelect = async (prediction: PlacePrediction) => {
    setShowPredictions(false);
    setAddressInput(prediction.description);
    setLoadingPredictions(true);
    
    try {
      // Get place details to get lat/lng
      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;
      const detailsResponse = await fetch(detailsUrl);
      const detailsData = await detailsResponse.json();
      
      if (detailsData.result?.geometry?.location) {
        const { lat, lng } = detailsData.result.geometry.location;
        
        // Use reverse geocoding to get accurate city and neighborhood
        const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=bg`;
        const geoResponse = await fetch(geocodeUrl);
        const geoData = await geoResponse.json();
        
        let detectedCity = '';
        let detectedNeighborhood = '';
        let detectedSublocality = '';
        
        if (geoData.results?.[0]?.address_components) {
          for (const comp of geoData.results[0].address_components) {
            // City
            if (comp.types.includes('locality')) {
              const cityName = comp.long_name;
              detectedCity = CITY_NAME_MAP[cityName] || cityName;
            }
            // Fallback for Sofia
            if (comp.types.includes('administrative_area_level_1') && !detectedCity) {
              const areaName = comp.long_name;
              if (areaName === 'Sofia City Province' || areaName === 'Sofia-City' || areaName === 'София-град') {
                detectedCity = 'София';
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
        
        // Use neighborhood if found, otherwise fall back to sublocality
        const finalNeighborhood = detectedNeighborhood || detectedSublocality || '';
        
        console.log('📍 Location detected:', { city: detectedCity, neighborhood: finalNeighborhood, sublocality: detectedSublocality });
        
        setFormData(prev => ({
          ...prev,
          city: detectedCity,
          neighborhood: finalNeighborhood,
          address: prediction.description,
          latitude: lat,
          longitude: lng,
        }));
        setLocationDetected(true);
      }
    } catch (error) {
      console.error('Place details error:', error);
    } finally {
      setLoadingPredictions(false);
    }
  };

  const loadUserData = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      const user = (response.data as any)?.user || response.data;
      setCurrentUser(user);
      if (user?.phoneNumber || user?.phone_number) {
        setFormData(prev => ({ ...prev, phone: user.phoneNumber || user.phone_number }));
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const getCurrentLocation = () => {
    Geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        // Auto-detect city and neighborhood from coordinates
        try {
          const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=bg`;
          const geoResponse = await fetch(geocodeUrl);
          const geoData = await geoResponse.json();
          
          let detectedCity = '';
          let detectedNeighborhood = '';
          let detectedSublocality = '';
          let formattedAddress = '';
          
          if (geoData.results?.[0]) {
            formattedAddress = geoData.results[0].formatted_address || '';
            
            for (const comp of geoData.results[0].address_components) {
              // City
              if (comp.types.includes('locality')) {
                const cityName = comp.long_name;
                detectedCity = CITY_NAME_MAP[cityName] || cityName;
              }
              // Fallback for Sofia
              if (comp.types.includes('administrative_area_level_1') && !detectedCity) {
                const areaName = comp.long_name;
                if (areaName === 'Sofia City Province' || areaName === 'Sofia-City' || areaName === 'София-град') {
                  detectedCity = 'София';
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
          
          // Use neighborhood if found, otherwise fall back to sublocality
          const finalNeighborhood = detectedNeighborhood || detectedSublocality || '';
          
          // Update form with detected location
          if (detectedCity || finalNeighborhood) {
            setFormData(prev => ({
              ...prev,
              city: detectedCity,
              neighborhood: finalNeighborhood,
              address: formattedAddress,
              latitude,
              longitude,
            }));
            setAddressInput(formattedAddress);
            setLocationDetected(true);
          }
        } catch (error) {
          console.log('Auto-detect location error:', error);
        }
      },
      (error) => {
        console.log('Location error:', error.message);
        // Silent fail - user can manually enter address
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const pickImages = () => {
    Alert.alert(
      'Добави снимки',
      'Изберете източник',
      [
        {
          text: 'Камера',
          onPress: () => {
            launchCamera(
              { mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200 },
              (response) => {
                if (response.assets && response.assets.length > 0) {
                  setImages(prev => [...prev, ...response.assets!].slice(0, 5));
                }
              }
            );
          },
        },
        {
          text: 'Галерия',
          onPress: () => {
            launchImageLibrary(
              { mediaType: 'photo', quality: 0.8, maxWidth: 1200, maxHeight: 1200, selectionLimit: 5 - images.length },
              (response) => {
                if (response.assets && response.assets.length > 0) {
                  setImages(prev => [...prev, ...response.assets!].slice(0, 5));
                }
              }
            );
          },
        },
        { text: 'Отказ', style: 'cancel' },
      ]
    );
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];

    setUploadingImages(true);
    try {
      const formDataUpload = new FormData();
      images.forEach((image, index) => {
        formDataUpload.append('screenshots', {
          uri: image.uri,
          type: image.type || 'image/jpeg',
          name: image.fileName || `image_${index}.jpg`,
        } as any);
      });

      // Get auth token for authenticated upload
      const token = await ApiService.getInstance().getAuthToken();
      
      // Use correct endpoint: /api/v1/upload/case-screenshots
      const response = await fetch('https://maystorfix.com/api/v1/upload/case-screenshots', {
        method: 'POST',
        body: formDataUpload,
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      const result = await response.json();
      console.log('📸 Upload response:', result);
      
      if (result.success && result.data?.screenshots) {
        // Return array of URLs
        return result.data.screenshots.map((s: any) => s.url || s);
      }
      return [];
    } catch (error) {
      console.error('❌ Error uploading images:', error);
      return [];
    } finally {
      setUploadingImages(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!formData.serviceType) {
      Alert.alert('Грешка', 'Моля изберете тип услуга');
      return;
    }
    if (!formData.description) {
      Alert.alert('Грешка', 'Моля опишете проблема');
      return;
    }
    if (!formData.city || !formData.address) {
      Alert.alert('Грешка', 'Моля въведете адрес и изберете от предложенията');
      return;
    }
    if (!formData.phone) {
      Alert.alert('Грешка', 'Моля въведете телефон');
      return;
    }
    if (!formData.budget) {
      Alert.alert('Грешка', 'Моля изберете бюджет');
      return;
    }

    setLoading(true);
    try {
      if (!currentUser) {
        Alert.alert('Грешка', 'Моля влезте в профила си отново');
        setLoading(false);
        return;
      }

      // Upload images first if any
      let screenshotUrls: string[] = [];
      if (images.length > 0) {
        screenshotUrls = await uploadImages();
      }

      // Build case data matching backend expectations
      const caseData = {
        serviceType: formData.serviceType,
        description: formData.description,
        city: formData.city,
        neighborhood: formData.neighborhood,
        formattedAddress: formData.address, // Backend expects formattedAddress
        phone: formData.phone,
        preferredDate: formData.preferredDate.toISOString().split('T')[0],
        // preferredTime: formData.preferredTime, // Commented out
        // priority: formData.priority, // Commented out
        budget: formData.budget,
        customerId: currentUser.id,
        customerName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
        customerPhone: formData.phone,
        isOpenCase: true,
        assignmentType: 'open',
        latitude: formData.latitude,
        longitude: formData.longitude,
        screenshots: screenshotUrls,
      };

      console.log('📝 Creating case:', JSON.stringify(caseData, null, 2));

      const result = await ApiService.getInstance().createCase(caseData);

      if (result.success) {
        Alert.alert(
          'Успех!',
          'Заявката е публикувана. Специалистите ще се свържат с вас скоро.',
          [{ text: 'ОК', onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert('Грешка', result.error?.message || 'Неуспешно създаване');
      }
    } catch (error) {
      console.error('Create case error:', error);
      Alert.alert('Грешка', 'Възникна проблем при създаването');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Нова заявка</Text>
          <Text style={styles.subtitle}>Опишете от какво имате нужда</Text>
        </View>

        <View style={styles.form}>
          {/* Service Type */}
          <Text style={styles.label}>Тип услуга *</Text>
          <Dropdown
            label="Тип услуга"
            value={formData.serviceType}
            options={SERVICE_CATEGORIES}
            onSelect={(v) => updateField('serviceType', v)}
            placeholder="Изберете тип услуга..."
          />

          {/* Description */}
          <Text style={styles.label}>Описание на проблема *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={4}
            placeholder="Опишете подробно какво трябва да се направи..."
            placeholderTextColor="#64748b"
            value={formData.description}
            onChangeText={(t) => updateField('description', t)}
          />

          {/* Address with Google Places Autocomplete */}
          <Text style={styles.label}>📍 Адрес *</Text>
          <View style={styles.autocompleteContainer}>
            <TextInput
              style={styles.input}
              placeholder="Въведете адрес, квартал или град..."
              placeholderTextColor="#64748b"
              value={addressInput}
              onChangeText={handleAddressInputChange}
              onFocus={() => predictions.length > 0 && setShowPredictions(true)}
            />
            {loadingPredictions && (
              <ActivityIndicator size="small" color="#3b82f6" style={styles.autocompleteLoader} />
            )}
            
            {/* Predictions dropdown */}
            {showPredictions && predictions.length > 0 && (
              <View style={styles.predictionsContainer}>
                {predictions.map((prediction) => (
                  <TouchableOpacity
                    key={prediction.place_id}
                    style={styles.predictionItem}
                    onPress={() => handlePlaceSelect(prediction)}
                  >
                    <Text style={styles.predictionText}>{prediction.description}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <Text style={styles.hint}>💡 Започнете да пишете и изберете от предложенията</Text>
          
          {/* Show detected location */}
          {locationDetected && formData.city && (
            <View style={styles.detectedLocation}>
              <Text style={styles.detectedLocationIcon}>✓</Text>
              <Text style={styles.detectedLocationText}>
                {formData.city}
                {formData.neighborhood ? ` • ${formData.neighborhood}` : ''}
              </Text>
            </View>
          )}

          {/* Phone */}
          <Text style={styles.label}>Телефон за контакт *</Text>
          <TextInput
            style={styles.input}
            placeholder="0888 123 456"
            placeholderTextColor="#64748b"
            keyboardType="phone-pad"
            value={formData.phone}
            onChangeText={(t) => updateField('phone', t)}
          />

          {/* Date */}
          <Text style={styles.label}>Предпочитана дата *</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setShowDatePicker(true)}>
            <Text style={styles.dropdownText}>
              {formData.preferredDate.toLocaleDateString('bg-BG', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </Text>
            <Text style={styles.dropdownArrow}>📅</Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              value={formData.preferredDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={(event: any, selectedDate: Date | undefined) => {
                setShowDatePicker(Platform.OS === 'ios');
                if (selectedDate) {
                  updateField('preferredDate', selectedDate);
                }
              }}
            />
          )}

          {/* Time - Commented out
          <Text style={styles.label}>Предпочитано време</Text>
          <Dropdown
            label="Предпочитано време"
            value={formData.preferredTime}
            options={TIME_OPTIONS}
            onSelect={(v) => updateField('preferredTime', v)}
          />
          */}

          {/* Priority - Commented out
          <Text style={styles.label}>Приоритет</Text>
          <Dropdown
            label="Приоритет"
            value={formData.priority}
            options={PRIORITY_OPTIONS}
            onSelect={(v) => updateField('priority', v)}
          />
          */}

          {/* Budget */}
          <Text style={styles.label}>Бюджет *</Text>
          <Dropdown
            label="Бюджет"
            value={formData.budget}
            options={BUDGET_RANGES}
            onSelect={(v) => updateField('budget', v)}
            placeholder="Изберете бюджет..."
          />
          <Text style={styles.hint}>💡 Бюджетът помага на специалистите да оценят заявката</Text>

          {/* Images */}
          <Text style={styles.label}>Снимки (до 5)</Text>
          <View style={styles.imagesContainer}>
            {images.map((image, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageBtn}
                  onPress={() => removeImage(index)}
                >
                  <Text style={styles.removeImageText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
            {images.length < 5 && (
              <TouchableOpacity style={styles.addImageBtn} onPress={pickImages}>
                <Text style={styles.addImageIcon}>📷</Text>
                <Text style={styles.addImageText}>Добави</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.hint}>📸 Снимките помагат на специалистите да разберат проблема</Text>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, (loading || uploadingImages) && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading || uploadingImages}
          >
            {loading || uploadingImages ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.loadingText}>
                  {uploadingImages ? 'Качване на снимки...' : 'Създаване...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitBtnText}>Публикувай заявка</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scroll: { flex: 1 },
  header: { padding: 20, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#f8fafc', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#94a3b8' },
  form: { padding: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#cbd5e1', marginBottom: 8, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: '#334155', borderRadius: 10, padding: 14,
    fontSize: 16, color: '#f1f5f9', backgroundColor: '#1e293b',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  
  // Dropdown styles
  dropdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#1e293b',
  },
  dropdownText: { fontSize: 16, color: '#f1f5f9' },
  dropdownPlaceholder: { color: '#64748b' },
  dropdownArrow: { fontSize: 12, color: '#94a3b8' },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#f8fafc' },
  modalClose: { fontSize: 20, color: '#94a3b8', padding: 4 },
  modalList: { maxHeight: 400 },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  modalItemActive: { backgroundColor: 'rgba(37, 99, 235, 0.2)' },
  modalItemText: { fontSize: 16, color: '#e2e8f0' },
  modalItemTextActive: { color: '#3b82f6', fontWeight: '600' },
  modalItemCheck: { fontSize: 18, color: '#3b82f6' },
  
  // Google Places Autocomplete styles
  autocompleteContainer: {
    position: 'relative',
    zIndex: 1000,
  },
  autocompleteLoader: {
    position: 'absolute',
    right: 14,
    top: 14,
  },
  predictionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderTopWidth: 0,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    maxHeight: 200,
    zIndex: 1001,
  },
  predictionItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  predictionText: {
    fontSize: 14,
    color: '#e2e8f0',
  },
  detectedLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  detectedLocationIcon: {
    fontSize: 16,
    color: '#22c55e',
    marginRight: 8,
  },
  detectedLocationText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
  },
  
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  
  // Images
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  imageWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  addImageBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
  },
  addImageIcon: { fontSize: 24, marginBottom: 4 },
  addImageText: { fontSize: 12, color: '#94a3b8' },
  
  // Submit
  submitBtn: {
    backgroundColor: '#2563eb', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24, marginBottom: 40,
  },
  submitBtnDisabled: { backgroundColor: '#475569' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { color: '#fff', fontSize: 16, marginLeft: 8 },
});
