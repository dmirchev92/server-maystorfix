import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import ApiService from '../services/ApiService';
import BidModal from './BidModal';

interface BidButtonProps {
  caseId: string;
  budget: string; // Changed to string for budget range
  currentBidders?: number;
  maxBidders?: number;
  onBidPlaced?: () => void;
  disabled?: boolean;
  showCostPreview?: boolean; // Show cost preview below button
}

// Calculate costs based on budget range (matches BidModal and backend)
const getCostsForBudget = (budget: string): { winCost: number; loseCost: number } => {
  // Winner costs (Free/Pro tier)
  const winnerCosts: { [key: string]: number } = {
    '1-250': 26, '251-500': 77, '501-750': 179, '751-1000': 383,
    '1001-2000': 614, '2001-3000': 997, '3001-4000': 1278,
    '4001-5000': 1278, '5001-6000': 1278, '6001-7000': 1278,
    '7001-8000': 1278, '8001-9000': 1278, '9001-10000': 1278,
  };
  
  // Loser fees (same for all tiers)
  const loserFees: { [key: string]: number } = {
    '1-250': 26, '251-500': 26, '501-750': 41, '751-1000': 41,
    '1001-2000': 61, '2001-3000': 61, '3001-4000': 61,
    '4001-5000': 77, '5001-6000': 77, '6001-7000': 77,
    '7001-8000': 77, '8001-9000': 77, '9001-10000': 77,
  };
  
  // Try to match budget to a range
  const normalizedBudget = budget.replace(/\s/g, '');
  
  // Direct match
  if (winnerCosts[normalizedBudget]) {
    return { winCost: winnerCosts[normalizedBudget], loseCost: loserFees[normalizedBudget] };
  }
  
  // Parse budget to find matching range
  const match = normalizedBudget.match(/(\d+)/);
  if (match) {
    const value = parseInt(match[1]);
    if (value <= 250) return { winCost: 26, loseCost: 26 };
    if (value <= 500) return { winCost: 77, loseCost: 26 };
    if (value <= 750) return { winCost: 179, loseCost: 41 };
    if (value <= 1000) return { winCost: 383, loseCost: 41 };
    if (value <= 2000) return { winCost: 614, loseCost: 61 };
    if (value <= 3000) return { winCost: 997, loseCost: 61 };
    if (value <= 4000) return { winCost: 1278, loseCost: 61 };
    return { winCost: 1278, loseCost: 77 };
  }
  
  return { winCost: 26, loseCost: 26 }; // Default
};

const BidButton: React.FC<BidButtonProps> = ({
  caseId,
  budget,
  currentBidders = 0,
  maxBidders = 3,
  onBidPlaced,
  disabled = false,
  showCostPreview = true,
}) => {
  const [canBid, setCanBid] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  
  const costs = getCostsForBudget(budget);

  useEffect(() => {
    checkCanBid();
  }, [caseId]);

  const checkCanBid = async () => {
    try {
      const apiService = ApiService.getInstance();
      const response = await apiService.canBidOnCase(caseId);
      
      if (response.success && response.data) {
        setCanBid(response.data.allowed);
      }
    } catch (error) {
      Logger.error('Error checking bid eligibility:', error);
    }
  };

  const handlePress = () => {
    Logger.debug('🔵 BidButton: Opening modal for case:', caseId);
    setModalVisible(true);
    Logger.debug('🔵 BidButton: Modal state set to true');
  };

  const handleBidPlaced = () => {
    setModalVisible(false);
    onBidPlaced?.();
  };

  const isDisabled = disabled || !canBid || currentBidders >= maxBidders;
  const buttonText = currentBidders >= maxBidders ? 'Пълно' : 'Кандидатствай';

  return (
    <View>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isDisabled}
        activeOpacity={0.7}
      >
        {isDisabled ? (
          <View style={[styles.button, styles.buttonDisabled]}>
            <Text style={styles.icon}>💰</Text>
            <Text style={styles.buttonText}>{buttonText}</Text>
          </View>
        ) : (
          <LinearGradient
            colors={['#3CCB72', '#0C544A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.6 }}
            style={styles.button}
          >
            <Text style={styles.icon}>💰</Text>
            <Text style={styles.buttonText}>{buttonText}</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
      
      {/* Cost Preview */}
      {showCostPreview && !isDisabled && (
        <View style={styles.costPreview}>
          <Text style={styles.costPreviewText}>
            ✅ {costs.winCost} / ❌ {costs.loseCost} точки
          </Text>
        </View>
      )}
      
      <BidModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        caseId={caseId}
        caseBudget={budget}
        onBidPlaced={handleBidPlaced}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 120,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50 - dark theme disabled
    borderColor: 'rgba(100, 116, 139, 0.5)', // slate-600/50
    opacity: 0.8,
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
  costPreview: {
    marginTop: 4,
    alignItems: 'center',
  },
  costPreviewText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '500',
  },
});

export default BidButton;
