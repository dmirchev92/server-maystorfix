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
}

const BidButton: React.FC<BidButtonProps> = ({
  caseId,
  budget,
  currentBidders = 0,
  maxBidders = 3,
  onBidPlaced,
  disabled = false,
}) => {
  const [canBid, setCanBid] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

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
      console.error('Error checking bid eligibility:', error);
    }
  };

  const handlePress = () => {
    console.log('🔵 BidButton: Opening modal for case:', caseId);
    setModalVisible(true);
    console.log('🔵 BidButton: Modal state set to true');
  };

  const handleBidPlaced = () => {
    setModalVisible(false);
    onBidPlaced?.();
  };

  const isDisabled = disabled || !canBid || currentBidders >= maxBidders;
  const buttonText = currentBidders >= maxBidders ? 'Пълно' : 'Наддай';

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
});

export default BidButton;
