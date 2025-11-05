import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import ApiService from '../services/ApiService';

interface PointsBalanceWidgetProps {
  onPress?: () => void;
  compact?: boolean;
}

const PointsBalanceWidget: React.FC<PointsBalanceWidgetProps> = ({ onPress, compact = false }) => {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const apiService = ApiService.getInstance();
      const response = await apiService.getPointsBalance();
      
      if (response.success && response.data) {
        setBalance(response.data.current_balance || response.data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching points balance:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={[styles.container, compact && styles.containerCompact]} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <Text style={styles.icon}>💰</Text>
        <View style={styles.textContainer}>
          <Text style={styles.label}>Точки</Text>
          <Text style={styles.balance}>{balance ?? 0}</Text>
        </View>
      </View>
      {!compact && (
        <Text style={styles.arrow}>›</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  containerCompact: {
    padding: 12,
    borderRadius: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  textContainer: {
    flexDirection: 'column',
  },
  label: {
    color: '#e0e7ff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  balance: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  arrow: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '300',
  },
});

export default PointsBalanceWidget;
