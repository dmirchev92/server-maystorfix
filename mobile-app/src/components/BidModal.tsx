import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/ApiService';
// import { useAuth } from '../contexts/AuthContext';

interface BidModalProps {
  visible: boolean;
  onClose: () => void;
  caseId: string;
  caseBudget: string;
  onBidPlaced?: () => void;
}

const BUDGET_RANGES = [
  { value: '1-250', label: '1-250 лв' },
  { value: '250-500', label: '250-500 лв' },
  { value: '500-750', label: '500-750 лв' },
  { value: '750-1000', label: '750-1000 лв' },
  { value: '1000-1250', label: '1000-1250 лв' },
  { value: '1250-1500', label: '1250-1500 лв' },
  { value: '1500-1750', label: '1500-1750 лв' },
  { value: '1750-2000', label: '1750-2000 лв' },
  { value: '2000+', label: '2000+ лв' },
];

const BidModal: React.FC<BidModalProps> = ({
  visible,
  onClose,
  caseId,
  caseBudget,
  onBidPlaced,
}) => {
  const [user] = useState<any>(null);
  const [proposedBudget, setProposedBudget] = useState('');
  const [loading, setLoading] = useState(false);

  // Calculate point cost based on proposed budget and user tier
  const calculatePointCost = (budgetRange: string): number => {
    const userTier = user?.subscription_tier_id || 'free';
    
    const budgetMidpoints: { [key: string]: number } = {
      '1-250': 125,
      '250-500': 375,
      '500-750': 625,
      '750-1000': 875,
      '1000-1250': 1125,
      '1250-1500': 1375,
      '1500-1750': 1625,
      '1750-2000': 1875,
      '2000+': 2500,
    };
    
    const midpoint = budgetMidpoints[budgetRange] || 500;
    
    // Point costs by tier and budget
    if (midpoint <= 250) {
      return userTier === 'free' ? 6 : userTier === 'normal' ? 4 : 3;
    } else if (midpoint <= 500) {
      return userTier === 'free' ? 10 : userTier === 'normal' ? 7 : 5;
    } else if (midpoint <= 750) {
      return userTier === 'normal' ? 12 : 8;
    } else if (midpoint <= 1000) {
      return userTier === 'normal' ? 18 : 12;
    } else if (midpoint <= 1500) {
      return userTier === 'normal' ? 25 : 18;
    } else if (midpoint <= 2000) {
      return 25;
    } else if (midpoint <= 3000) {
      return 35;
    } else if (midpoint <= 4000) {
      return 45;
    } else {
      return 55;
    }
  };

  const handleSubmit = async () => {
    if (!proposedBudget) {
      Alert.alert('Грешка', 'Моля, изберете предлагана цена');
      return;
    }

    const pointCost = calculatePointCost(proposedBudget);

    Alert.alert(
      'Потвърждение',
      `Сигурни ли сте, че искате да наддавате?\n\n💰 Предлагана цена: ${proposedBudget} лв\n⭐ Ако спечелите: ${pointCost} точки\n\nПродължавате ли?`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Наддай',
          onPress: async () => {
            setLoading(true);
            try {
              const apiService = ApiService.getInstance();
              const response = await apiService.placeBid(caseId, proposedBudget);
              
              if (response.success) {
                const message = (response as any).message || 'Офертата е подадена успешно!';
                Alert.alert(
                  'Успех!',
                  `✅ ${message}\n\nВие сте наддавач #${response.data?.bid_order}\nИзползвани точки: ${response.data?.points_spent || 0}`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        onClose();
                        onBidPlaced?.();
                      },
                    },
                  ]
                );
              } else {
                Alert.alert('Грешка', response.error?.message || 'Неуспешно наддаване');
              }
            } catch (error: any) {
              Alert.alert('Грешка', error.message || 'Възникна грешка');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  console.log('🎯 BidModal render:', { visible, caseBudget, proposedBudget });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalBackground}
      >
        <View style={styles.modalContainer}>
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <Text style={styles.title}>💰 Направете вашата оферта</Text>
            <Text style={styles.subtitle}>
              Изберете цена за вашата оферта
            </Text>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 <Text style={styles.infoBold}>Участие:</Text> Безплатно (0 точки){'\n'}
                💰 <Text style={styles.infoBold}>При печалба:</Text> Плащате според офертата{'\n'}
                ❌ <Text style={styles.infoBold}>При загуба:</Text> Не плащате нищо
              </Text>
              {proposedBudget && (
                <View style={styles.costPreview}>
                  <Text style={styles.costText}>
                    ⭐ Ако спечелите с оферта {proposedBudget} лв:{' '}
                    <Text style={styles.costHighlight}>
                      {calculatePointCost(proposedBudget)} точки
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            {/* Case Budget */}
            <View style={styles.field}>
              <Text style={styles.label}>Бюджет на клиента</Text>
              <Text style={styles.value}>{caseBudget}</Text>
            </View>

            {/* Budget Range Selection */}
            <View style={styles.field}>
              <Text style={styles.label}>
                Предлагана цена <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.pickerContainer}>
                <Picker
                  selectedValue={proposedBudget}
                  onValueChange={(value) => setProposedBudget(value)}
                  style={styles.picker}
                >
                  <Picker.Item label="Изберете ценови диапазон..." value="" />
                  {BUDGET_RANGES.map((range) => (
                    <Picker.Item
                      key={range.value}
                      label={range.label}
                      value={range.value}
                    />
                  ))}
                </Picker>
              </View>
              <Text style={styles.hint}>
                💡 Изберете реалистична цена за услугата
              </Text>
            </View>

            {/* Buttons */}
            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton, { marginRight: 8 }]}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Отказ</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  { marginLeft: 8 },
                  (!proposedBudget || loading) && styles.submitButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!proposedBudget || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>✅ Направи оферта</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  },
  modalContainer: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 20,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  infoText: {
    fontSize: 13,
    color: '#4338ca',
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600',
  },
  costPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#c7d2fe',
  },
  costText: {
    fontSize: 14,
    color: '#312e81',
    fontWeight: '500',
  },
  costHighlight: {
    color: '#f59e0b',
    fontWeight: '700',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#f9fafb',
  },
  picker: {
    height: 50,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 6,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#e5e7eb',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#6366f1',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BidModal;
