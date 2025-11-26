import React, { useState, useEffect } from 'react';
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

// Budget ranges matching web
const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв' },
  { value: '250-500', label: '250-500 лв' },
  { value: '500-750', label: '500-750 лв' },
  { value: '750-1000', label: '750-1000 лв' },
  { value: '1000-1500', label: '1000-1500 лв' },
  { value: '1500-2000', label: '1500-2000 лв' },
  { value: '2000+', label: '2000+ лв' },
];

// Fallback static data (used while loading from API)
const FALLBACK_CITIES = [
  { value: 'София', label: 'София' },
  { value: 'Пловдив', label: 'Пловдив' },
  { value: 'Варна', label: 'Варна' },
  { value: 'Бургас', label: 'Бургас' },
];

const TIME_OPTIONS = [
  { value: 'morning', label: 'Сутрин (8:00-12:00)' },
  { value: 'afternoon', label: 'Следобед (12:00-17:00)' },
  { value: 'evening', label: 'Вечер (17:00-20:00)' },
  { value: 'flexible', label: 'Гъвкаво време' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Нисък' },
  { value: 'normal', label: 'Нормален' },
  { value: 'urgent', label: 'Спешен' },
];

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
  
  // Dynamic location data from API
  const [cities, setCities] = useState<DropdownOption[]>(FALLBACK_CITIES);
  const [neighborhoods, setNeighborhoods] = useState<DropdownOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  useEffect(() => {
    loadUserData();
    getCurrentLocation();
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
        // Take top 30 cities by population
        const topCities = response.data.cities.slice(0, 30);
        setCities(topCities);
      }
    } catch (error) {
      console.error('Error loading cities:', error);
      // Keep fallback cities
    }
  };
  
  const loadNeighborhoods = async (city: string) => {
    setLoadingLocations(true);
    try {
      const response = await ApiService.getInstance().getNeighborhoods(city);
      if (response.success && response.data?.neighborhoods) {
        setNeighborhoods(response.data.neighborhoods);
      } else {
        setNeighborhoods([]);
      }
    } catch (error) {
      console.error('Error loading neighborhoods:', error);
      setNeighborhoods([]);
    } finally {
      setLoadingLocations(false);
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
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }));
      },
      (error) => console.log('Location error:', error.message),
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
    if (!formData.city) {
      Alert.alert('Грешка', 'Моля изберете град');
      return;
    }
    // Require neighborhood only if the city has neighborhoods available
    if (neighborhoods.length > 0 && !formData.neighborhood) {
      Alert.alert('Грешка', 'Моля изберете квартал');
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
        phone: formData.phone,
        preferredDate: formData.preferredDate.toISOString().split('T')[0],
        preferredTime: formData.preferredTime,
        priority: formData.priority,
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

          {/* City */}
          <Text style={styles.label}>Град *</Text>
          <Dropdown
            label="Град"
            value={formData.city}
            options={cities}
            onSelect={(v) => {
              updateField('city', v);
              updateField('neighborhood', ''); // Reset neighborhood when city changes
            }}
            placeholder="Изберете град..."
          />

          {/* Neighborhood - show for any city that has neighborhoods */}
          {formData.city && neighborhoods.length > 0 && (
            <>
              <Text style={styles.label}>Квартал {loadingLocations && <ActivityIndicator size="small" color="#3b82f6" />}</Text>
              <Dropdown
                label="Квартал"
                value={formData.neighborhood}
                options={neighborhoods}
                onSelect={(v) => updateField('neighborhood', v)}
                placeholder={loadingLocations ? "Зареждане..." : "Изберете квартал..."}
              />
            </>
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

          {/* Time */}
          <Text style={styles.label}>Предпочитано време</Text>
          <Dropdown
            label="Предпочитано време"
            value={formData.preferredTime}
            options={TIME_OPTIONS}
            onSelect={(v) => updateField('preferredTime', v)}
          />

          {/* Priority */}
          <Text style={styles.label}>Приоритет</Text>
          <Dropdown
            label="Приоритет"
            value={formData.priority}
            options={PRIORITY_OPTIONS}
            onSelect={(v) => updateField('priority', v)}
          />

          {/* Budget */}
          <Text style={styles.label}>Бюджет *</Text>
          <View style={styles.chipsWrap}>
            {BUDGET_RANGES.map((b) => (
              <TouchableOpacity
                key={b.value}
                style={[styles.chip, formData.budget === b.value && styles.chipActive]}
                onPress={() => updateField('budget', b.value)}
              >
                <Text style={[styles.chipText, formData.budget === b.value && styles.chipTextActive]}>
                  {b.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
  
  // Chips (for budget)
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#94a3b8' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  
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
