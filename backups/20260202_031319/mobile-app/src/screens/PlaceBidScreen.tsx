import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import BidModal from '../components/BidModal';
import theme from '../styles/theme';

interface RouteParams {
  caseId: string;
}

interface CaseDetails {
  id: string;
  service_type: string;
  description: string;
  category: string;
  priority: string;
  city?: string;
  neighborhood?: string;
  address?: string;
  phone: string;
  preferred_date: string;
  preferred_time: string;
  budget?: number;
  bidding_enabled?: boolean;
  current_bidders?: number;
  max_bidders?: number;
  square_meters?: number;
}

export default function PlaceBidScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { caseId } = route.params as RouteParams;
  
  const [caseDetails, setCaseDetails] = useState<CaseDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showBidModal, setShowBidModal] = useState(false);

  useEffect(() => {
    loadCaseDetails();
  }, [caseId]);

  const loadCaseDetails = async () => {
    try {
      setLoading(true);
      const apiService = ApiService.getInstance();
      const response = await apiService.getCase(caseId);
      
      if (response.success && response.data) {
        setCaseDetails(response.data);
        // Auto-open bid modal once case is loaded
        setShowBidModal(true);
      } else {
        Alert.alert('Грешка', 'Не може да се зареди информацията за заявката');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading case:', error);
      Alert.alert('Грешка', 'Възникна грешка при зареждането');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleBidPlaced = () => {
    // Navigate back to Cases screen after successful bid
    navigation.navigate('Cases' as never);
  };

  const handleModalClose = () => {
    setShowBidModal(false);
    // Navigate back when modal is closed
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.solid} />
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  if (!caseDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Заявката не е намерена</Text>
      </View>
    );
  }

  const budgetRange = caseDetails.budget 
    ? `${caseDetails.budget} €` 
    : 'Не е посочен';

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Направете оферта</Text>
          <Text style={styles.subtitle}>{caseDetails.service_type}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍 Локация:</Text>
            <Text style={styles.detailValue}>
              {caseDetails.city || 'Не е посочена'}
              {caseDetails.neighborhood ? `, ${caseDetails.neighborhood}` : ''}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📝 Описание:</Text>
            <Text style={styles.detailValue}>{caseDetails.description}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>💰 Бюджет на клиента:</Text>
            <Text style={styles.detailValue}>{budgetRange}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📅 Предпочитана дата:</Text>
            <Text style={styles.detailValue}>
              {new Date(caseDetails.preferred_date).toLocaleDateString('bg-BG')}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🕐 Предпочитано време:</Text>
            <Text style={styles.detailValue}>{caseDetails.preferred_time}</Text>
          </View>

          {caseDetails.current_bidders !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>👥 Наддавачи:</Text>
              <Text style={styles.detailValue}>
                {caseDetails.current_bidders} / {caseDetails.max_bidders || '∞'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bid Modal */}
      {caseDetails && (
        <BidModal
          visible={showBidModal}
          onClose={handleModalClose}
          caseId={caseDetails.id}
          caseBudget={budgetRange}
          onBidPlaced={handleBidPlaced}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.primary.solid,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
  },
  detailsCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  detailRow: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
});
