import { Logger } from '../utils/Logger';
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
  { value: '251-400', label: '251-400 €' },
  { value: '500-750', label: '500-750 €' },
  { value: '751-1000', label: '751-1000 €' },
  { value: '1001-1500', label: '1001-1500 €' },
  { value: '1501-2000', label: '1501-2000 €' },
  { value: '2001-3000', label: '2001-3000 €' },
  { value: '3001-4000', label: '3001-4000 €' },
  { value: '4001-5000', label: '4001-5000 €' },
  { value: '5001-6000', label: '5001-6000 €' },
  { value: '6001-7000', label: '6001-7000 €' },
  { value: '7001-8000', label: '7001-8000 €' },
  { value: '8001-9000', label: '8001-9000 €' },
  { value: '9001-10000', label: '9001-10000 €' },
  { value: '10000+', label: '10000+ €' },
];

const BidModal: React.FC<BidModalProps> = ({
  visible,
  onClose,
  caseId,
  caseBudget,
  onBidPlaced,
}) => {
  const [user, setUser] = useState<any>(null);
  const [proposedBudget, setProposedBudget] = useState('');
  const [loading, setLoading] = useState(false);
  const [pointsBalance, setPointsBalance] = useState<number | null>(null);

  // Load user data and points balance when modal opens
  useEffect(() => {
    if (visible) {
      loadUserAndPoints();
    }
  }, [visible]);

  const loadUserAndPoints = async () => {
    try {
      const apiService = ApiService.getInstance();
      // Load points balance
      const balanceResponse = await apiService.getPointsBalance();
      if (balanceResponse.success && balanceResponse.data) {
        setPointsBalance(balanceResponse.data.current_balance);
        setUser({ subscription_tier_id: balanceResponse.data.subscription_tier || 'normal' });
      }
    } catch (error) {
      Logger.error('Error loading points balance:', error);
    }
  };

  // Calculate point cost based on proposed budget and user tier
  // Uses new budget ranges matching backend database
  // Note: Free tier max budget is 400, Normal tier max budget is 750, PRO tier has no limit
  const calculatePointCost = (budgetRange: string): { cost: number; tierRestricted: boolean } => {
    const userTier = user?.subscription_tier_id || 'free';
    
    // Points costs by tier (Free / Normal / PRO) - matches database budget ranges
    const pointsCosts: { [key: string]: { free: number; normal: number; pro: number } } = {
      '251-400': { free: 15, normal: 12, pro: 10 },
      '500-750': { free: 0, normal: 25, pro: 20 },
      '751-1000': { free: 0, normal: 35, pro: 28 },
      '1001-1500': { free: 0, normal: 45, pro: 36 },
      '1501-2000': { free: 0, normal: 70, pro: 56 },
      '2001-3000': { free: 0, normal: 0, pro: 100 },
      '3001-4000': { free: 0, normal: 0, pro: 140 },
      '4001-5000': { free: 0, normal: 0, pro: 180 },
      '5001-6000': { free: 0, normal: 0, pro: 220 },
      '6001-7000': { free: 0, normal: 0, pro: 260 },
      '7001-8000': { free: 0, normal: 0, pro: 300 },
      '8001-9000': { free: 0, normal: 0, pro: 340 },
      '9001-10000': { free: 0, normal: 0, pro: 380 },
      '10000+': { free: 0, normal: 0, pro: 380 },
    };
    
    const costs = pointsCosts[budgetRange];
    if (!costs) return { cost: 0, tierRestricted: false };
    
    let cost = 0;
    let tierRestricted = false;
    
    if (userTier === 'free') {
      cost = costs.free;
      tierRestricted = cost === 0;
    } else if (userTier === 'normal') {
      cost = costs.normal;
      tierRestricted = cost === 0;
    } else if (userTier === 'pro') {
      cost = costs.pro;
      tierRestricted = false; // Pro tier has no restrictions
    }
    
    return { cost, tierRestricted };
  };
  
  // Helper to get just the cost number for display
  const getPointCost = (budgetRange: string): number => {
    return calculatePointCost(budgetRange).cost;
  };
  
  // Check if budget range is restricted for current tier
  const isBudgetRestricted = (budgetRange: string): boolean => {
    return calculatePointCost(budgetRange).tierRestricted;
  };

  const handleSubmit = async () => {
    if (!proposedBudget) {
      Alert.alert('Грешка', 'Моля, изберете предлагана цена');
      return;
    }

    const { cost: pointCost, tierRestricted } = calculatePointCost(proposedBudget);

    if (tierRestricted) {
      Alert.alert(
        'Надградете плана си',
        'За да наддавате за този бюджет, ви е необходим Нормален или ПРО план.\n\n💰 Безплатен план: до 400 €\n⭐ Нормален план: до 750 €\n👑 ПРО план: неограничено',
        [
          { text: 'Отказ', style: 'cancel' },
          {
            text: 'Надгради',
            onPress: () => {
              // Navigate to subscription screen
              const navigation = require('@react-navigation/native').useNavigation();
              navigation.navigate('Subscription' as never);
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      'Потвърждение',
      `Сигурни ли сте, че искате да участвате?\n\n💰 Предлагана цена: ${proposedBudget} €\n⭐ Цена при спечелване: ${pointCost} точки\n\n⚠️ Точките ще бъдат удържани само ако спечелите офертата.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изпрати',
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

  Logger.debug('🎯 BidModal render:', { visible, caseBudget, proposedBudget });

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

            {/* Points Balance Display */}
            {pointsBalance !== null && (
              <View style={styles.balanceBox}>
                <Text style={styles.balanceText}>
                  ⭐ Налични точки: <Text style={styles.balanceValue}>{pointsBalance}</Text>
                </Text>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                💡 <Text style={styles.infoBold}>Участие:</Text> Безплатно (0 точки){'\n'}
                💰 <Text style={styles.infoBold}>При печалба:</Text> Плащате според офертата{'\n'}
                ❌ <Text style={styles.infoBold}>При загуба:</Text> Не плащате нищо
              </Text>
              {proposedBudget && (
                <View style={styles.costPreview}>
                  {isBudgetRestricted(proposedBudget) ? (
                    <Text style={styles.costText}>
                      ⚠️ <Text style={styles.restrictedText}>Изисква ПРО план</Text>
                    </Text>
                  ) : (
                    <Text style={styles.costText}>
                      ⭐ Цена при спечелване ({proposedBudget} €):{' '}
                      <Text style={styles.costHighlight}>
                        {getPointCost(proposedBudget)} точки
                      </Text>
                    </Text>
                  )}
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
                  <Text style={styles.submitButtonText}>Изпрати</Text>
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
  balanceBox: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  balanceText: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },
  balanceValue: {
    fontWeight: '700',
    color: '#d97706',
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
  restrictedText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
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
    color: '#1f2937',
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
