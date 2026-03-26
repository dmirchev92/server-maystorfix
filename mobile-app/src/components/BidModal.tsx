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
  Image,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/ApiService';
import { BUDGET_RANGES } from '../constants/budgetRanges';
// import { useAuth } from '../contexts/AuthContext';

interface BidModalProps {
  visible: boolean;
  onClose: () => void;
  caseId: string;
  caseBudget: string;
  caseDetails?: {
    service_type?: string;
    category?: string;
    description?: string;
    city?: string;
    neighborhood?: string;
    images?: string[];
  };
  onBidPlaced?: () => void;
}

const BidModal: React.FC<BidModalProps> = ({
  visible,
  onClose,
  caseId,
  caseBudget,
  caseDetails,
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
  // Updated to match new database values (March 2026)
  const calculatePointCost = (budgetRange: string): { cost: number; tierRestricted: boolean } => {
    const userTier = user?.subscription_tier_id || 'free';
    
    // Points costs by tier (Free / Normal / PRO) - matches database
    // Free & Pro have same costs, Normal has higher costs and max 500 лв budget
    const pointsCosts: { [key: string]: { free: number; normal: number; pro: number } } = {
      '1-250': { free: 26, normal: 51, pro: 26 },
      '251-500': { free: 77, normal: 128, pro: 77 },
      '501-750': { free: 179, normal: 0, pro: 179 },
      '751-1000': { free: 383, normal: 0, pro: 383 },
      '1001-2000': { free: 614, normal: 0, pro: 614 },
      '2001-3000': { free: 997, normal: 0, pro: 997 },
      '3001-4000': { free: 1278, normal: 0, pro: 1278 },
      '4001-5000': { free: 1278, normal: 0, pro: 1278 },
      '5001-6000': { free: 1278, normal: 0, pro: 1278 },
      '6001-7000': { free: 1278, normal: 0, pro: 1278 },
      '7001-8000': { free: 1278, normal: 0, pro: 1278 },
      '8001-9000': { free: 1278, normal: 0, pro: 1278 },
      '9001-10000': { free: 1278, normal: 0, pro: 1278 },
    };
    
    const costs = pointsCosts[budgetRange];
    if (!costs) return { cost: 0, tierRestricted: false };
    
    let cost = 0;
    let tierRestricted = false;
    
    if (userTier === 'free') {
      cost = costs.free;
      tierRestricted = false;
    } else if (userTier === 'normal') {
      cost = costs.normal;
      tierRestricted = cost === 0; // Normal tier restricted above 500 лв
    } else if (userTier === 'pro') {
      cost = costs.pro;
      tierRestricted = false;
    }
    
    return { cost, tierRestricted };
  };
  
  // Calculate loser fee based on budget range (same for all tiers)
  // 5 лв = 26 pts, 8 лв = 41 pts, 12 лв = 61 pts, 15 лв = 77 pts
  const calculateLoserFee = (budgetRange: string): number => {
    const loserFees: { [key: string]: number } = {
      '1-250': 26,      // 5 лв
      '251-500': 26,    // 5 лв
      '501-750': 41,    // 8 лв
      '751-1000': 41,   // 8 лв
      '1001-2000': 61,  // 12 лв
      '2001-3000': 61,  // 12 лв
      '3001-4000': 61,  // 12 лв
      '4001-5000': 77,  // 15 лв
      '5001-6000': 77,  // 15 лв
      '6001-7000': 77,  // 15 лв
      '7001-8000': 77,  // 15 лв
      '8001-9000': 77,  // 15 лв
      '9001-10000': 77, // 15 лв
    };
    return loserFees[budgetRange] || 26;
  };
  
  // Helper to get just the cost number for display
  const getPointCost = (budgetRange: string): number => {
    return calculatePointCost(budgetRange).cost;
  };
  
  // Helper to get loser fee for display
  const getLoserFee = (budgetRange: string): number => {
    return calculateLoserFee(budgetRange);
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

    const loserFee = getLoserFee(proposedBudget);
    
    Alert.alert(
      'Потвърждение',
      `Сигурни ли сте, че искате да участвате?\n\n💰 Предлагана цена: ${proposedBudget} лв\n\n✅ При спечелване: ${pointCost} точки\n❌ При загуба: ${loserFee} точки\n\n⚠️ Точките се удържат след избор на победител.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Участвай',
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
              Прегледайте детайлите и изберете цена
            </Text>

            {/* Case Details Section */}
            {caseDetails && (
              <View style={styles.caseDetailsBox}>
                <Text style={styles.caseDetailsTitle}>📋 Информация за заявката</Text>
                
                {/* Service Type */}
                {caseDetails.service_type && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>🔧 Услуга:</Text>
                    <Text style={styles.detailValue}>{caseDetails.service_type}</Text>
                  </View>
                )}

                {/* Location (without street) */}
                {(caseDetails.city || caseDetails.neighborhood) && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📍 Локация:</Text>
                    <Text style={styles.detailValue}>
                      {caseDetails.city}{caseDetails.neighborhood ? `, ${caseDetails.neighborhood}` : ''}
                    </Text>
                  </View>
                )}

                {/* Description */}
                {caseDetails.description && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📝 Описание:</Text>
                    <Text style={styles.detailValue}>{caseDetails.description}</Text>
                  </View>
                )}

                {/* Images */}
                {caseDetails.images && caseDetails.images.length > 0 && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📷 Снимки:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                      {caseDetails.images.map((imageUrl, index) => (
                        <Image
                          key={index}
                          source={{ uri: imageUrl }}
                          style={styles.caseImage}
                          resizeMode="cover"
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

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
              <Text style={styles.infoTitle}>💡 Как работи наддаването?</Text>
              <Text style={styles.infoText}>
                Участвате безплатно. Точките се удържат само след като клиентът избере победител.
              </Text>
              {proposedBudget && (
                <View style={styles.costPreview}>
                  {isBudgetRestricted(proposedBudget) ? (
                    <Text style={styles.costText}>
                      ⚠️ <Text style={styles.restrictedText}>Този бюджет изисква ПРО план</Text>
                    </Text>
                  ) : (
                    <>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>✅ При спечелване:</Text>
                        <Text style={styles.costValueWin}>{getPointCost(proposedBudget)} точки</Text>
                      </View>
                      <View style={styles.costRow}>
                        <Text style={styles.costLabel}>❌ При загуба:</Text>
                        <Text style={styles.costValueLose}>{getLoserFee(proposedBudget)} точки</Text>
                      </View>
                    </>
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
  infoTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#312e81',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#4338ca',
    lineHeight: 20,
  },
  costPreview: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#c7d2fe',
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 14,
    color: '#4338ca',
    fontWeight: '500',
  },
  costValueWin: {
    fontSize: 16,
    color: '#059669',
    fontWeight: '700',
  },
  costValueLose: {
    fontSize: 16,
    color: '#dc2626',
    fontWeight: '700',
  },
  costText: {
    fontSize: 14,
    color: '#312e81',
    fontWeight: '500',
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
  caseDetailsBox: {
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  caseDetailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 12,
  },
  detailRow: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#1f2937',
    lineHeight: 20,
  },
  imagesScroll: {
    marginTop: 8,
  },
  caseImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
  },
});

export default BidModal;
