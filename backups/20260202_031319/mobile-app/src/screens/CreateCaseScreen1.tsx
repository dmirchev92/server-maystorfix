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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Geolocation from 'react-native-geolocation-service';
import ApiService from '../services/ApiService';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';

// Budget ranges matching web
const BUDGET_RANGES = [
  { value: '1-125', label: '1-125 €' },
  { value: '126-250', label: '126-250 €' },
  { value: '251-500', label: '251-500 €' },
  { value: '501-1000', label: '501-1000 €' },
  { value: '1001-2000', label: '1001-2000 €' },
  { value: '2001-5000', label: '2001-5000 €' },
  { value: '5000+', label: '5000+ €' },
];

const CITIES = ['София', 'Пловдив', 'Варна', 'Бургас'];

const SOFIA_NEIGHBORHOODS = [
  'Център', 'Лозенец', 'Витоша', 'Младост 1', 'Младост 2', 'Младост 3', 'Младост 4',
  'Люлин', 'Надежда', 'Красно село', 'Овча купел', 'Банишора', 'Илинден', 'Подуяне',
  'Слатина', 'Изгрев', 'Студентски град', 'Дружба', 'Дианабад', 'Гео Милев', 'Редута',
  'Хиподрума', 'Борово', 'Бояна', 'Драгалевци', 'Симеоново', 'Княжево', 'Горна баня',
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
    preferredDate: new Date().toISOString().split('T')[0],
    preferredTime: 'morning',
    priority: 'normal',
    budget: '',
    additionalDetails: '',
    latitude: null as number | null,
    longitude: null as number | null,
  });

  useEffect(() => {
    loadUserData();
    getCurrentLocation();
  }, []);

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
    if (formData.city === 'София' && !formData.neighborhood) {
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

      // Build case data matching backend expectations
      const caseData = {
        serviceType: formData.serviceType,
        description: formData.description,
        city: formData.city,
        neighborhood: formData.neighborhood,
        phone: formData.phone,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        priority: formData.priority,
        budget: formData.budget,
        additionalDetails: formData.additionalDetails,
        customerId: currentUser.id,
        customerName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim(),
        customerPhone: formData.phone,
        isOpenCase: true,
        assignmentType: 'open',
        latitude: formData.latitude,
        longitude: formData.longitude,
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {SERVICE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.chip, formData.serviceType === cat.value && styles.chipActive]}
                onPress={() => updateField('serviceType', cat.value)}
              >
                <Text style={[styles.chipText, formData.serviceType === cat.value && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
          <View style={styles.chipsWrap}>
            {CITIES.map((city) => (
              <TouchableOpacity
                key={city}
                style={[styles.chip, formData.city === city && styles.chipActive]}
                onPress={() => {
                  updateField('city', city);
                  if (city !== 'София') updateField('neighborhood', '');
                }}
              >
                <Text style={[styles.chipText, formData.city === city && styles.chipTextActive]}>{city}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Neighborhood (Sofia only) */}
          {formData.city === 'София' && (
            <>
              <Text style={styles.label}>Квартал *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {SOFIA_NEIGHBORHOODS.map((n) => (
                  <TouchableOpacity
                    key={n}
                    style={[styles.chip, formData.neighborhood === n && styles.chipActive]}
                    onPress={() => updateField('neighborhood', n)}
                  >
                    <Text style={[styles.chipText, formData.neighborhood === n && styles.chipTextActive]}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#64748b"
            value={formData.preferredDate}
            onChangeText={(t) => updateField('preferredDate', t)}
          />

          {/* Time */}
          <Text style={styles.label}>Предпочитано време</Text>
          <View style={styles.chipsWrap}>
            {TIME_OPTIONS.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.chip, formData.preferredTime === t.value && styles.chipActive]}
                onPress={() => updateField('preferredTime', t.value)}
              >
                <Text style={[styles.chipText, formData.preferredTime === t.value && styles.chipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Priority */}
          <Text style={styles.label}>Приоритет</Text>
          <View style={styles.chipsWrap}>
            {PRIORITY_OPTIONS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.chip, formData.priority === p.value && styles.chipActive]}
                onPress={() => updateField('priority', p.value)}
              >
                <Text style={[styles.chipText, formData.priority === p.value && styles.chipTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

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

          {/* Additional Details */}
          <Text style={styles.label}>Допълнителни детайли</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            numberOfLines={3}
            placeholder="Специални изисквания, достъп до обекта..."
            placeholderTextColor="#64748b"
            value={formData.additionalDetails}
            onChangeText={(t) => updateField('additionalDetails', t)}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleCreate}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
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
  chipsScroll: { marginBottom: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20,
    backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155', marginRight: 8, marginBottom: 8,
  },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontSize: 14, color: '#94a3b8' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  submitBtn: {
    backgroundColor: '#2563eb', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 24, marginBottom: 40,
  },
  submitBtnDisabled: { backgroundColor: '#475569' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
