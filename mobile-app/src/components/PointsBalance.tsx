import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface PointsData {
  current_balance: number;
  total_earned: number;
  total_spent: number;
  monthly_allowance: number;
  last_reset?: string;
}

export const PointsBalance: React.FC = () => {
  const [points, setPoints] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.getInstance().getPoints();
      
      if (response.success && response.data) {
        setPoints(response.data);
      } else {
        setError('Не може да се заредят точките');
      }
    } catch (err) {
      console.error('Error loading points:', err);
      setError('Грешка при зареждане на точките');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={theme.colors.primary.solid} />
      </View>
    );
  }

  if (error || !points) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error || 'Няма данни'}</Text>
      </View>
    );
  }

  // Calculate progress towards monthly allowance
  const progress = points.monthly_allowance > 0
    ? (points.current_balance / points.monthly_allowance) * 100 
    : 0;

  return (
    <TouchableOpacity style={styles.container} onPress={loadPoints} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.emoji}>⭐</Text>
        <View style={styles.headerText}>
          <Text style={styles.title}>Точки</Text>
          <Text style={styles.tier}>Месечен лимит: {points.monthly_allowance}</Text>
        </View>
      </View>
      
      <View style={styles.pointsContainer}>
        <Text style={styles.pointsValue}>{points.current_balance}</Text>
        <Text style={styles.pointsLabel}>точки</Text>
      </View>

      {points.monthly_allowance > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min(progress, 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {points.current_balance} от {points.monthly_allowance} точки използвани
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Спечелени</Text>
          <Text style={styles.statValue}>{points.total_earned}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>Изразходвани</Text>
          <Text style={styles.statValue}>{points.total_spent}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  emoji: {
    fontSize: 32,
    marginRight: theme.spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.text.primary,
  },
  tier: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 2,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.md,
  },
  pointsValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary.solid,
    marginRight: theme.spacing.xs,
  },
  pointsLabel: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
  },
  progressContainer: {
    marginTop: theme.spacing.sm,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.background.tertiary,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary.solid,
  },
  progressText: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  errorText: {
    fontSize: theme.typography.body.fontSize,
    color: '#ef4444', // red color for errors
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  statValue: {
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.h3.fontWeight,
    color: theme.colors.primary.solid,
  },
});
