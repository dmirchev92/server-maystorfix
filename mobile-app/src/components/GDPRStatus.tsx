import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateConsent } from '../store/slices/appSlice';

interface GDPRStatusProps {
  onNavigateToConsent: () => void;
  onNavigateToPrivacy: () => void;
  onNavigateToDataRights: () => void;
}

const GDPRStatus: React.FC<GDPRStatusProps> = ({
  onNavigateToConsent,
  onNavigateToPrivacy,
  onNavigateToDataRights,
}) => {
  const dispatch = useDispatch();
  const { hasGDPRConsent, consentTimestamp, consentDetails } = useSelector((state: RootState) => state.app);

  const getComplianceScore = (): number => {
    if (!hasGDPRConsent) return 0;
    
    const requiredConsents = ['data_processing'];
    const optionalConsents = ['ai_communication', 'data_storage', 'analytics'];
    
    let score = 0;
    const total = requiredConsents.length + optionalConsents.length;
    
    // Required consents are mandatory
    if (consentDetails?.some(c => c.consentType === 'data_processing' && c.status === 'granted')) {
      score += requiredConsents.length;
    }
    
    // Optional consents add to score
    optionalConsents.forEach(consentType => {
      if (consentDetails?.some(c => c.consentType === consentType && c.status === 'granted')) {
        score += 1;
      }
    });
    
    return Math.round((score / total) * 100);
  };

  const getComplianceColor = (score: number): string => {
    if (score >= 80) return '#27ae60';
    if (score >= 60) return '#f39c12';
    if (score >= 40) return '#e67e22';
    return '#e74c3c';
  };

  const getComplianceLabel = (score: number): string => {
    if (score >= 80) return 'Отлично';
    if (score >= 60) return 'Добре';
    if (score >= 40) return 'Задоволително';
    return 'Недостатъчно';
  };

  const getConsentSummary = () => {
    if (!consentDetails || consentDetails.length === 0) {
      return 'Няма данни за съгласия';
    }

    const granted = consentDetails.filter(c => c.status === 'granted').length;
    const total = consentDetails.length;
    
    return `${granted} от ${total} съгласия са предоставени`;
  };

  const formatConsentDate = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('bg-BG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleQuickConsent = () => {
    Alert.alert(
      'Бързо съгласие',
      'Искате ли да приемете всички основни съгласия за GDPR?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Приемам',
          onPress: () => {
            dispatch(updateConsent({
              hasGDPRConsent: true,
              consentTimestamp: new Date().toISOString(),
              consentDetails: [
                {
                  consentType: 'data_processing',
                  status: 'granted',
                  legalBasis: 'Съгласие',
                  description: 'Обработка на данни за услугата',
                  timestamp: new Date().toISOString(),
                },
                {
                  consentType: 'ai_communication',
                  status: 'granted',
                  legalBasis: 'Съгласие',
                  description: 'AI автоматични отговори',
                  timestamp: new Date().toISOString(),
                },
                {
                  consentType: 'data_storage',
                  status: 'granted',
                  legalBasis: 'Съгласие',
                  description: 'Съхранение на разговори',
                  timestamp: new Date().toISOString(),
                },
              ]
            }));
          },
        },
      ]
    );
  };

  const complianceScore = getComplianceScore();
  const complianceColor = getComplianceColor(complianceScore);
  const complianceLabel = getComplianceLabel(complianceScore);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔒 GDPR Статус</Text>
        <Text style={styles.subtitle}>
          Съответствие с правилата за защита на данните
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View style={styles.scoreContainer}>
          <View style={[styles.scoreCircle, { borderColor: complianceColor }]}>
            <Text style={[styles.scoreText, { color: complianceColor }]}>
              {complianceScore}%
            </Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreLabel}>{complianceLabel}</Text>
            <Text style={styles.scoreDescription}>
              Ниво на съответствие
            </Text>
          </View>
        </View>

        <View style={styles.complianceDetails}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Съгласия:</Text>
            <Text style={styles.detailValue}>
              {getConsentSummary()}
            </Text>
          </View>
          
          {consentTimestamp && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Последна актуализация:</Text>
              <Text style={styles.detailValue}>
                {formatConsentDate(consentTimestamp)}
              </Text>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Статус:</Text>
            <View style={[styles.statusIndicator, { backgroundColor: hasGDPRConsent ? '#27ae60' : '#e74c3c' }]}>
              <Text style={styles.statusIndicatorText}>
                {hasGDPRConsent ? 'Съответства' : 'Не съответства'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {!hasGDPRConsent && (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleQuickConsent}
          >
            <Text style={styles.primaryButtonText}>✅ Бързо съгласие</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onNavigateToConsent}
        >
          <Text style={styles.secondaryButtonText}>⚙️ Управлявай съгласия</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onNavigateToPrivacy}
        >
          <Text style={styles.secondaryButtonText}>📋 Политика за поверителност</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onNavigateToDataRights}
        >
          <Text style={styles.secondaryButtonText}>🔐 Права на данните</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ За GDPR</Text>
        <Text style={styles.infoText}>
          GDPR (General Data Protection Regulation) е европейският регламент за защита на данните. 
          Вашите клиенти имат право да знаят как данните им се обработват и да контролират този процес.
        </Text>
        
        <Text style={styles.infoText}>
          Нашата система автоматично информира клиентите, че AI отговаря на тяхно място, 
          и съхранява всички разговори за вашата референция.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
  },
  statusCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreInfo: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  complianceDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#7f8c8d',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 20,
  },
  primaryButton: {
    backgroundColor: '#27ae60',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#3498db',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
});

export default GDPRStatus;
