import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { requiresSquareMeters } from '../constants/serviceMetrics';
import { SERVICE_CATEGORIES } from '../constants/serviceCategories';
import { BUDGET_RANGES } from '../constants/budgetRanges';

interface UnifiedCaseModalProps {
  visible: boolean;
  onClose: () => void;
  providerId: string;
  providerName: string;
  conversationId: string;
  customerPhone: string;
}

const serviceTypes = SERVICE_CATEGORIES.map(cat => ({
  value: cat.value,
  label: cat.label
}));

const priorities = [
  { value: 'low', label: 'Ниска' },
  { value: 'medium', label: 'Средна' },
  { value: 'high', label: 'Висока' },
];

export default function UnifiedCaseModal({
  visible,
  onClose,
  providerId,
  providerName,
  conversationId,
  customerPhone,
}: UnifiedCaseModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    assignmentType: 'specific' as 'specific' | 'open',
    serviceType: '',
    description: '',
    address: '',
    phone: customerPhone,
    preferredDate: '',
    preferredTime: '',
    priority: 'medium',
    squareMeters: '',
    budget: '',
  });

  const handleSubmit = async () => {
    // Validation
    if (!formData.serviceType) {
      Alert.alert('Грешка', 'Моля изберете тип услуга');
      return;
    }
    if (!formData.description.trim()) {
      Alert.alert('Грешка', 'Моля опишете проблема');
      return;
    }
    if (!formData.address.trim()) {
      Alert.alert('Грешка', 'Моля въведете адрес');
      return;
    }
    if (!formData.phone.trim()) {
      Alert.alert('Грешка', 'Моля въведете телефон');
      return;
    }
    if (!formData.budget) {
      Alert.alert('Грешка', 'Моля изберете бюджет');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');

      // Get current user info
      const userResponse = await fetch('https://maystorfix.com/api/v1/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const userData: any = await userResponse.json();
      const user = userData.data?.user || userData.data;

      // Create case
      const payload = {
        serviceType: formData.serviceType,
        description: formData.description,
        address: formData.address,
        phone: formData.phone,
        preferredDate: formData.preferredDate,
        preferredTime: formData.preferredTime,
        priority: formData.priority,
        providerId: formData.assignmentType === 'specific' ? providerId : null,
        assignmentType: formData.assignmentType,
        conversationId: conversationId,
        customerName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        customerEmail: user.email,
        customerPhone: formData.phone,
        squareMeters: formData.squareMeters || null,
      };

      console.log('📤 Creating case:', payload);

      const response = await fetch('https://maystorfix.com/api/v1/marketplace/cases', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result: any = await response.json();

      if (result.success) {
        Alert.alert(
          'Успех',
          `Заявката е създадена успешно!\n\n${
            formData.assignmentType === 'specific'
              ? `Изпратена директно до ${providerName}`
              : 'Изпратена до всички специалисти'
          }`,
          [{ text: 'OK', onPress: () => onClose() }]
        );
        
        // Reset form
        setFormData({
          assignmentType: 'specific',
          serviceType: '',
          description: '',
          address: '',
          phone: customerPhone,
          preferredDate: '',
          preferredTime: '',
          priority: 'medium',
          squareMeters: '',
          budget: '',
        });
      } else {
        throw new Error(result.error?.message || 'Failed to create case');
      }
    } catch (error: any) {
      console.error('❌ Error creating case:', error);
      Alert.alert('Грешка', error.message || 'Неуспешно създаване на заявка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>📋 Създай заявка</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Assignment Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Тип заявка</Text>
              <View style={styles.radioGroup}>
                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    formData.assignmentType === 'specific' && styles.radioOptionSelected
                  ]}
                  onPress={() => setFormData({ ...formData, assignmentType: 'specific' })}
                >
                  <View style={styles.radio}>
                    {formData.assignmentType === 'specific' && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.radioLabel}>
                    <Text style={styles.radioLabelText}>Директно до {providerName}</Text>
                    <Text style={styles.radioLabelSubtext}>Само този специалист ще види заявката</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.radioOption,
                    formData.assignmentType === 'open' && styles.radioOptionSelected
                  ]}
                  onPress={() => setFormData({ ...formData, assignmentType: 'open' })}
                >
                  <View style={styles.radio}>
                    {formData.assignmentType === 'open' && <View style={styles.radioInner} />}
                  </View>
                  <View style={styles.radioLabel}>
                    <Text style={styles.radioLabelText}>Отворена заявка</Text>
                    <Text style={styles.radioLabelSubtext}>Всички специалисти ще видят заявката</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Service Type */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Тип услуга *</Text>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerText}>
                  {serviceTypes.find(s => s.value === formData.serviceType)?.label || 'Изберете услуга'}
                </Text>
              </View>
            </View>

            {/* Square Meters (conditional) - Moved right after Service Type */}
            {requiresSquareMeters(formData.serviceType) && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Квадратни метри (кв.м)</Text>
                <TextInput
                  style={styles.input}
                  value={formData.squareMeters}
                  onChangeText={(text) => setFormData({ ...formData, squareMeters: text })}
                  placeholder="Въведете площ в кв.м"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  keyboardType="decimal-pad"
                />
                <Text style={styles.helperText}>
                  📏 Площта помага на специалистите да оценят обема на работата
                </Text>
              </View>
            )}

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Описание на проблема *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Опишете подробно какво трябва да се направи..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            {/* Address */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Адрес *</Text>
              <TextInput
                style={styles.input}
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
                placeholder="ул. Примерна 123, София"
                placeholderTextColor="rgba(255,255,255,0.4)"
              />
            </View>

            {/* Phone */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Телефон *</Text>
              <TextInput
                style={styles.input}
                value={formData.phone}
                onChangeText={(text) => setFormData({ ...formData, phone: text })}
                placeholder="+359..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                keyboardType="phone-pad"
              />
            </View>

            {/* Date & Time */}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Предпочитана дата</Text>
                <TextInput
                  style={styles.input}
                  value={formData.preferredDate}
                  onChangeText={(text) => setFormData({ ...formData, preferredDate: text })}
                  placeholder="дд.мм.гггг"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Предпочитан час</Text>
                <TextInput
                  style={styles.input}
                  value={formData.preferredTime}
                  onChangeText={(text) => setFormData({ ...formData, preferredTime: text })}
                  placeholder="чч:мм"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                />
              </View>
            </View>

            {/* Priority */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Приоритет</Text>
              <View style={styles.priorityButtons}>
                {priorities.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[
                      styles.priorityButton,
                      formData.priority === p.value && styles.priorityButtonSelected
                    ]}
                    onPress={() => setFormData({ ...formData, priority: p.value })}
                  >
                    <Text style={[
                      styles.priorityButtonText,
                      formData.priority === p.value && styles.priorityButtonTextSelected
                    ]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Budget Range */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>Бюджет *</Text>
              <View style={styles.pickerContainer}>
                <Text style={styles.pickerText}>
                  {BUDGET_RANGES.find(r => r.value === formData.budget)?.label || 'Изберете бюджет...'}
                </Text>
              </View>
              <Text style={styles.helperText}>
                💡 Бюджетът определя колко точки ще струва заявката
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>📋 Създай заявка</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#94A3B8',
    fontWeight: '600',
  },
  modalContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  radioOptionSelected: {
    borderColor: '#6366F1',
    backgroundColor: 'rgba(99,102,241,0.1)',
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#94A3B8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6366F1',
  },
  radioLabel: {
    flex: 1,
  },
  radioLabelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  radioLabelSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
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
    fontSize: 15,
    color: '#FFFFFF',
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
  pickerText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
  },
  priorityButtonSelected: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  helperText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 6,
  },
  priorityButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  priorityButtonTextSelected: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: '#6366F1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
