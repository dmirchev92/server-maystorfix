import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
  images?: string[];
}

export default function PlaceBidScreen() {
  const { t } = useTranslation('common');
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
        Alert.alert(t('common:error'), t('common:loadCaseInfoFailed'));
        navigation.goBack();
      }
    } catch (error) {
      Logger.error('Error loading case:', error);
      Alert.alert(t('common:error'), t('common:loadingError'));
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
        <Text style={styles.loadingText}>{t('loading')}</Text>
      </View>
    );
  }

  if (!caseDetails) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{t('caseNotFound')}</Text>
      </View>
    );
  }

  const budgetRange = caseDetails.budget 
    ? `${caseDetails.budget} €` 
    : t('notSpecified');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('makeOffer')}</Text>
          <Text style={styles.subtitle}>{caseDetails.service_type}</Text>
        </View>

        <View style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📍 {t('location')}:</Text>
            <Text style={styles.detailValue}>
              {caseDetails.city || t('notSpecified')}
              {caseDetails.neighborhood ? `, ${caseDetails.neighborhood}` : ''}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📝 {t('description')}:</Text>
            <Text style={styles.detailValue}>{caseDetails.description}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>💰 {t('clientBudget')}:</Text>
            <Text style={styles.detailValue}>{budgetRange}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>📅 {t('preferredDate')}:</Text>
            <Text style={styles.detailValue}>
              {new Date(caseDetails.preferred_date).toLocaleDateString('bg-BG')}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>🕐 {t('preferredTime')}:</Text>
            <Text style={styles.detailValue}>{caseDetails.preferred_time}</Text>
          </View>

          {caseDetails.current_bidders !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>👥 {t('bidders')}:</Text>
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
          caseDetails={{
            service_type: caseDetails.service_type,
            category: caseDetails.category,
            description: caseDetails.description,
            city: caseDetails.city,
            neighborhood: caseDetails.neighborhood,
            images: caseDetails.images,
          }}
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
