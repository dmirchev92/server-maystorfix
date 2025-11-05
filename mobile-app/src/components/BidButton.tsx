import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import ApiService from '../services/ApiService';

interface BidButtonProps {
  caseId: string;
  budget: number;
  currentBidders?: number;
  maxBidders?: number;
  onBidPlaced?: () => void;
  disabled?: boolean;
}

const BidButton: React.FC<BidButtonProps> = ({
  caseId,
  budget,
  currentBidders = 0,
  maxBidders = 3,
  onBidPlaced,
  disabled = false,
}) => {
  const [loading, setLoading] = useState(false);
  const [canBid, setCanBid] = useState(true);
  const [pointsCost, setPointsCost] = useState<string>('');

  useEffect(() => {
    checkCanBid();
    estimatePointsCost();
  }, [caseId]);

  const checkCanBid = async () => {
    try {
      const apiService = ApiService.getInstance();
      const response = await apiService.canBidOnCase(caseId);
      
      if (response.success && response.data) {
        setCanBid(response.data.allowed);
      }
    } catch (error) {
      console.error('Error checking bid eligibility:', error);
    }
  };

  const estimatePointsCost = () => {
    // Estimate based on budget (matches web logic)
    if (budget <= 500) setPointsCost('10-20');
    else if (budget <= 1000) setPointsCost('20-40');
    else if (budget <= 1500) setPointsCost('30-60');
    else if (budget <= 2000) setPointsCost('40-80');
    else if (budget <= 3000) setPointsCost('60-120');
    else if (budget <= 4000) setPointsCost('80-160');
    else if (budget <= 5000) setPointsCost('100-200');
    else setPointsCost('100+');
  };

  const handleBid = async () => {
    Alert.alert(
      'Потвърждение',
      `Искате ли да наддавате за тази заявка?\n\nБюджет: ${budget} BGN\nПриблизителни точки: ${pointsCost}\n\nТочките ще бъдат временно резервирани.`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Наддай',
          onPress: async () => {
            setLoading(true);
            try {
              const apiService = ApiService.getInstance();
              const response = await apiService.placeBid(caseId);
              
              if (response.success) {
                Alert.alert('Успех', 'Офертата е подадена успешно!');
                onBidPlaced?.();
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

  const isDisabled = disabled || !canBid || currentBidders >= maxBidders || loading;
  const buttonText = loading
    ? 'Наддаване...'
    : currentBidders >= maxBidders
    ? 'Пълно'
    : 'Наддай';

  return (
    <>
      <TouchableOpacity
        style={[styles.button, isDisabled && styles.buttonDisabled]}
        onPress={handleBid}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Text style={styles.icon}>💰</Text>
            <Text style={styles.buttonText}>{buttonText}</Text>
          </>
        )}
      </TouchableOpacity>
      {!loading && canBid && currentBidders < maxBidders && (
        <Text style={styles.pointsEstimate}>~{pointsCost} точки</Text>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  pointsEstimate: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default BidButton;
