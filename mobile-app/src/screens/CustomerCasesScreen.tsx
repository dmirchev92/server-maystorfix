import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import ApiService from '../services/ApiService';

interface Case {
  id: string;
  service_type: string;
  description: string;
  status: string;
  category: string;
  budget?: number;
  city?: string;
  neighborhood?: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  provider_name?: string;
  bidding_enabled?: boolean;
  current_bidders?: number;
  max_bidders?: number;
  winning_bid_id?: string;
  created_at: string;
}

export default function CustomerCasesScreen() {
  const navigation = useNavigation<any>();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchCases();
      }
    }, [user])
  );

  const loadUser = async () => {
    try {
      const response = await ApiService.getInstance().getCurrentUser();
      const userData = (response.data as any)?.user || response.data;
      setUser(userData);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchCases = async () => {
    if (!user) return;
    try {
      const response = await ApiService.getInstance().getCasesWithFilters({
        customerId: user.id,
      });
      if (response.success && response.data) {
        setCases((response.data as any).cases || []);
      }
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCases();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#22c55e';
      case 'wip': return '#3b82f6';
      case 'completed': return '#6b7280';
      case 'declined': return '#ef4444';
      case 'cancelled': return '#64748b';
      default: return '#94a3b8';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Чакаща';
      case 'accepted': return 'Приета';
      case 'wip': return 'В процес';
      case 'completed': return 'Завършена';
      case 'declined': return 'Отказана';
      case 'cancelled': return 'Отменена';
      default: return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'electrician': return '⚡';
      case 'plumber': return '🔧';
      case 'hvac': return '❄️';
      case 'carpenter': return '🪚';
      case 'painter': return '🎨';
      case 'locksmith': return '🔐';
      case 'cleaner': return '🧹';
      case 'gardener': return '🌱';
      case 'handyman': return '🔨';
      case 'appliance_repair': return '🔌';
      default: return '🔧';
    }
  };

  const getCategoryName = (category: string) => {
    const names: { [key: string]: string } = {
      'electrician': 'Електричество',
      'plumber': 'Водопровод',
      'hvac': 'Климатик',
      'carpenter': 'Дърводелство',
      'painter': 'Боядисване',
      'locksmith': 'Ключарство',
      'cleaner': 'Почистване',
      'gardener': 'Градинарство',
      'handyman': 'Многопрофилен',
      'appliance_repair': 'Ремонти',
      'general': 'Общи'
    };
    return names[category] || category;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Моите заявки</Text>
        <Text style={styles.subtitle}>Преглед на вашите заявки и оферти</Text>
      </View>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        contentContainerStyle={styles.list}
      >
        {cases.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Все още нямате заявки</Text>
            <Text style={styles.emptySubtext}>Създайте първата си заявка и получете оферти от специалисти</Text>
            <TouchableOpacity 
              style={styles.createButton}
              onPress={() => navigation.navigate('CreateCase')}
            >
              <Text style={styles.createButtonText}>➕ Създай нова заявка</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {cases.map((item) => (
              <View key={item.id} style={styles.card}>
                {/* Card Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.categoryContainer}>
                    <Text style={styles.categoryIcon}>{getCategoryIcon(item.category)}</Text>
                    <Text style={styles.category}>{getCategoryName(item.category)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.description} numberOfLines={2}>{item.description}</Text>

                {/* Meta Info */}
                <View style={styles.metaRow}>
                  {item.city && (
                    <Text style={styles.metaText}>📍 {item.city}</Text>
                  )}
                  <Text style={styles.metaText}>
                    📅 {new Date(item.created_at).toLocaleDateString('bg-BG')}
                  </Text>
                  {item.budget && (
                    <Text style={styles.budgetText}>💰 {item.budget} лв.</Text>
                  )}
                </View>

                {/* Bidding Info */}
                {item.bidding_enabled && (
                  <View style={styles.biddingInfo}>
                    <View style={styles.biddingBadge}>
                      <Text style={styles.biddingText}>
                        👥 {item.current_bidders || 0}/{item.max_bidders || 3} оферти
                      </Text>
                    </View>
                    {item.winning_bid_id && (
                      <View style={styles.winnerBadge}>
                        <Text style={styles.winnerText}>✅ Избран изпълнител</Text>
                      </View>
                    )}
                    {item.provider_name && (
                      <Text style={styles.providerName}>Изпълнител: {item.provider_name}</Text>
                    )}
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.actionRow}>
                  {/* View Bids Button - Show if has bidders and no winner yet */}
                  {item.bidding_enabled && (item.current_bidders || 0) > 0 && !item.winning_bid_id && (
                    <TouchableOpacity
                      style={styles.viewBidsButton}
                      onPress={() => {
                        // Navigate to root stack's CaseBids screen
                        const parent = navigation.getParent();
                        if (parent) {
                          parent.navigate('CaseBids', {
                            caseId: item.id,
                            caseDescription: item.description,
                          });
                        } else {
                          // Fallback: try direct navigation
                          navigation.navigate('CaseBids', {
                            caseId: item.id,
                            caseDescription: item.description,
                          });
                        }
                      }}
                    >
                      <Text style={styles.viewBidsButtonText}>
                        👥 Виж оферти ({item.current_bidders})
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* View Details Button - Always show for cases with winner */}
                  {item.winning_bid_id && (
                    <TouchableOpacity
                      style={styles.detailsButton}
                      onPress={() => {
                        // Navigate to root stack's CaseBids screen
                        const parent = navigation.getParent();
                        if (parent) {
                          parent.navigate('CaseBids', {
                            caseId: item.id,
                            caseDescription: item.description,
                          });
                        } else {
                          navigation.navigate('CaseBids', {
                            caseId: item.id,
                            caseDescription: item.description,
                          });
                        }
                      }}
                    >
                      <Text style={styles.detailsButtonText}>👁️ Детайли</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>💡</Text>
              <View style={styles.infoContent}>
                <Text style={styles.infoTitle}>Как работи системата?</Text>
                <Text style={styles.infoText}>
                  • Когато създадете заявка, специалистите могат да наддават{'\n'}
                  • Максимум 3 специалисти могат да наддадат{'\n'}
                  • Вие избирате кой да изпълни заявката
                </Text>
              </View>
            </View>

            {/* Create New Button */}
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('CreateCase');
                } else {
                  navigation.navigate('CreateCase');
                }
              }}
            >
              <Text style={styles.floatingButtonText}>➕ Нова заявка</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  header: {
    padding: 20,
    paddingTop: 50,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8fafc',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#e2e8f0',
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 32,
  },
  createButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  category: {
    fontWeight: '600',
    color: '#e2e8f0',
    fontSize: 15,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#f1f5f9',
    marginBottom: 12,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  budgetText: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  biddingInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.3)',
  },
  biddingBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  biddingText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
  },
  winnerBadge: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  winnerText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  providerName: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    width: '100%',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  viewBidsButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  viewBidsButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  detailsButton: {
    flex: 1,
    backgroundColor: 'rgba(71, 85, 105, 0.5)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  detailsButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  infoIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 22,
  },
  floatingButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  floatingButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
