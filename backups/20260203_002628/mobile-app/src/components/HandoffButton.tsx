import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from 'react-native';

interface HandoffButtonProps {
  onPress: () => void;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  disabled?: boolean;
}

const HandoffButton: React.FC<HandoffButtonProps> = ({ 
  onPress, 
  urgency = 'medium',
  disabled = false 
}) => {
  const getUrgencyConfig = (urgency: string) => {
    const configs = {
      low: {
        backgroundColor: '#27ae60',
        borderColor: '#2ecc71',
        icon: '🤝',
        text: 'Поеми',
        urgencyText: 'Ниско',
      },
      medium: {
        backgroundColor: '#f39c12',
        borderColor: '#f1c40f',
        icon: '⚡',
        text: 'Поеми сега',
        urgencyText: 'Средно',
      },
      high: {
        backgroundColor: '#e67e22',
        borderColor: '#d35400',
        icon: '🔥',
        text: 'Поеми веднага',
        urgencyText: 'Високо',
      },
      emergency: {
        backgroundColor: '#e74c3c',
        borderColor: '#c0392b',
        icon: '🚨',
        text: 'СПЕШНО!',
        urgencyText: 'Спешно',
      },
    };
    return configs[urgency as keyof typeof configs] || configs.medium;
  };

  const config = getUrgencyConfig(urgency);

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { 
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
        },
        disabled && styles.buttonDisabled,
        urgency === 'emergency' && styles.emergencyButton,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <View style={styles.buttonContent}>
        <Text style={styles.icon}>{config.icon}</Text>
        <View style={styles.textContainer}>
          <Text style={styles.mainText}>{config.text}</Text>
          <Text style={styles.urgencyText}>{config.urgencyText}</Text>
        </View>
      </View>
      
      {urgency === 'emergency' && (
        <View style={styles.emergencyIndicator}>
          <Text style={styles.emergencyIndicatorText}>!</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    minWidth: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emergencyButton: {
    transform: [{ scale: 1.05 }],
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  mainText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  urgencyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.9,
  },
  emergencyIndicator: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e74c3c',
  },
  emergencyIndicatorText: {
    color: '#e74c3c',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default HandoffButton;




