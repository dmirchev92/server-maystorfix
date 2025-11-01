import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export interface TierData {
  id: 'free' | 'normal' | 'pro';
  name: string;
  nameBg: string;
  price: number;
  features: string[];
  recommended?: boolean;
}

interface TierSelectionCardProps {
  tier: TierData;
  selected: boolean;
  onSelect: (tierId: string) => void;
}

export const TierSelectionCard: React.FC<TierSelectionCardProps> = ({
  tier,
  selected,
  onSelect
}) => {
  const getBorderColor = () => {
    if (selected) return '#3B82F6';
    if (tier.recommended) return '#10B981';
    return '#E5E7EB';
  };

  const getBackgroundColor = () => {
    if (selected) return '#EFF6FF';
    if (tier.recommended) return '#F0FDF4';
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          borderWidth: selected ? 2 : 1
        }
      ]}
      onPress={() => onSelect(tier.id)}
      activeOpacity={0.7}
    >
      {tier.recommended && (
        <View style={styles.recommendedBadge}>
          <Text style={styles.recommendedText}>Препоръчан</Text>
        </View>
      )}

      <View style={styles.header}>
        <Text style={styles.tierName}>{tier.nameBg}</Text>
        <View style={styles.priceContainer}>
          {tier.price === 0 ? (
            <Text style={styles.freeText}>Безплатен</Text>
          ) : (
            <>
              <Text style={styles.price}>{tier.price}</Text>
              <Text style={styles.currency}>лв/месец</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.featuresContainer}>
        {tier.features.map((feature, index) => (
          <View key={index} style={styles.featureRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.featureText}>{feature}</Text>
          </View>
        ))}
      </View>

      {selected && (
        <View style={styles.selectedIndicator}>
          <Text style={styles.selectedText}>Избран</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    position: 'relative'
  },
  recommendedBadge: {
    position: 'absolute',
    top: -8,
    right: 16,
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1
  },
  recommendedText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600'
  },
  header: {
    marginBottom: 16
  },
  tierName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3B82F6'
  },
  currency: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4
  },
  freeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10B981'
  },
  featuresContainer: {
    marginTop: 8
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  checkmark: {
    color: '#10B981',
    fontSize: 16,
    marginRight: 8,
    fontWeight: 'bold'
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20
  },
  selectedIndicator: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center'
  },
  selectedText: {
    color: '#3B82F6',
    fontWeight: '600',
    fontSize: 14
  }
});
