import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
  Linking,
  Modal,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { updateConsent } from '../store/slices/appSlice';
import ApiService from '../services/ApiService';

interface ConsentItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  enabled: boolean;
  legalBasis: string;
}

interface ConsentScreenProps {
  onConsentComplete?: () => void;
}

const ConsentScreen: React.FC<ConsentScreenProps> = ({ onConsentComplete }) => {
  const dispatch = useDispatch();
  const { currentMode, businessHours } = useSelector((state: RootState) => state.app);
  
  const [consents, setConsents] = useState<ConsentItem[]>([
    {
      id: 'essential_service',
      title: 'Основни услуги',
      description: 'Обработка на данни за профил, настройки, SMS известия, push нотификации, заявки и аналитика. Необходимо за работата на приложението.',
      required: false,
      enabled: true,
      legalBasis: 'Договор / Легитимен интерес',
    },
    {
      id: 'data_sharing',
      title: 'Съхранение на съобщения',
      description: 'Съхранение на чат съобщенията и разговорите с клиенти за преглед и история. Без това съгласие няма да можете да изпращате или получавате съобщения.',
      required: false,
      enabled: false,
      legalBasis: 'Съгласие',
    },
  ]);

  const [showEssentialWarning, setShowEssentialWarning] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCurrentConsents();
  }, []);

  const loadCurrentConsents = async () => {
    try {
      setIsLoading(true);
      const response = await ApiService.getInstance().getConsents();
      
      if (response.success && response.data?.consents) {
        const backendConsents = response.data.consents as Array<{
          consentType: string;
          granted: boolean;
          legalBasis?: string;
        }>;
        
        // Update local state with backend values
        setConsents(prev => prev.map(consent => {
          const backendConsent = backendConsents.find(
            bc => bc.consentType === consent.id
          );
          if (backendConsent) {
            return { ...consent, enabled: backendConsent.granted };
          }
          return consent;
        }));
        
        Logger.debug('🔒 Loaded consents from backend:', backendConsents);
      }
    } catch (error) {
      Logger.error('Error loading consents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentChange = (consentId: string, enabled: boolean) => {
    // Show warning when turning off essential_service
    if (consentId === 'essential_service' && !enabled) {
      setShowEssentialWarning(true);
      return; // Don't change yet, wait for confirmation
    }

    setConsents(prev => 
      prev.map(consent => 
        consent.id === consentId 
          ? { ...consent, enabled }
          : consent
      )
    );
  };

  const confirmDisableEssential = () => {
    setConsents(prev => 
      prev.map(consent => 
        consent.id === 'essential_service' 
          ? { ...consent, enabled: false }
          : consent
      )
    );
    setShowEssentialWarning(false);
  };

  const cancelDisableEssential = () => {
    setShowEssentialWarning(false);
  };

  const handleSaveConsents = async () => {
    try {
      setIsLoading(true);
      
      // Validate required consents
      const requiredConsents = consents.filter(c => c.required);
      const missingRequired = requiredConsents.filter(c => !c.enabled);
      
      if (missingRequired.length > 0) {
        Alert.alert(
          'Задължителни съгласия',
          'Трябва да приемете всички задължителни съгласия за да продължите.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Save consents to backend
      const consentData = consents.map(consent => ({
        consentType: consent.id,
        granted: consent.enabled,
        legalBasis: consent.legalBasis,
      }));

      // Save to backend
      const response = await ApiService.getInstance().updateConsents(consentData);
      
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to save consents');
      }
      
      Logger.debug('🔒 Consents saved to backend:', response.data);

      // Update local Redux state (for UI consistency)
      const consentDetails = consents.map(consent => ({
        consentType: consent.id,
        status: (consent.enabled ? 'granted' : 'withdrawn') as 'granted' | 'withdrawn',
        legalBasis: consent.legalBasis,
        description: consent.description,
        timestamp: new Date().toISOString(),
      }));
      
      dispatch(updateConsent({ 
        hasGDPRConsent: true,
        consentTimestamp: new Date().toISOString(),
        consentDetails
      }));

      Alert.alert(
        'Успешно',
        'Вашите предпочитания за поверителност са запазени.',
        [{ text: 'OK', onPress: () => onConsentComplete?.() }]
      );

    } catch (error) {
      Logger.error('Error saving consents:', error);
      Alert.alert(
        'Грешка',
        'Възникна проблем при запазването на предпочитанията. Моля, опитайте отново.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://snapfix.bg/privacy-policy');
  };

  const openTerms = () => {
    Linking.openURL('https://snapfix.bg/terms');
  };

  const openDataRights = () => {
    Alert.alert(
      'Вашите права по GDPR',
      '✓ Достъп до данните си (чл. 15)\n✓ Коригиране на неточни данни (чл. 16)\n✓ Изтриване — право на забвене (чл. 17)\n✓ Преносимост на данните (чл. 20)\n✓ Оттегляне на съгласие по всяко време\n\nЗа упражняване на правата си:\nadmin@snapfix.bg',
      [
        { text: 'Изпрати имейл', onPress: () => Linking.openURL('mailto:admin@snapfix.bg') },
        { text: 'OK' }
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройки за поверителност</Text>
        <Text style={styles.subtitle}>
          Управлявайте как данните ви се използват и съхраняват
        </Text>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          В съответствие с GDPR, имате право да контролирате как данните ви се обработват. 
          Някои съгласия са задължителни за предоставяне на услугата.
        </Text>
      </View>

      <View style={styles.consentsContainer}>
        {consents.map((consent) => (
          <View key={consent.id} style={styles.consentItem}>
            <View style={styles.consentHeader}>
              <Text style={styles.consentTitle}>
                {consent.title}
                {consent.required && <Text style={styles.required}> *</Text>}
              </Text>
              <Switch
                value={consent.enabled}
                onValueChange={(enabled) => handleConsentChange(consent.id, enabled)}
                disabled={consent.required}
                trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
                thumbColor={consent.enabled ? '#fff' : '#f4f3f4'}
              />
            </View>
            
            <Text style={styles.consentDescription}>{consent.description}</Text>
            
            <View style={styles.consentMeta}>
              <Text style={styles.legalBasis}>
                Правно основание: {consent.legalBasis}
              </Text>
              {consent.required && (
                <Text style={styles.requiredText}>Задължително</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={openPrivacyPolicy}
        >
          <Text style={styles.actionButtonText}>📋 Политика за поверителност</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openTerms}
        >
          <Text style={styles.actionButtonText}>📄 Общи условия</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={openDataRights}
        >
          <Text style={styles.actionButtonText}>🔒 Права по GDPR</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSaveConsents}
          disabled={isLoading}
        >
          <Text style={styles.saveButtonText}>
            {isLoading ? 'Запазване...' : '💾 Запази предпочитанията'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          За въпроси относно поверителността: admin@snapfix.bg
        </Text>
      </View>

      {/* Warning Modal for Essential Service */}
      <Modal
        visible={showEssentialWarning}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDisableEssential}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>⚠️</Text>
            </View>
            
            <Text style={styles.modalTitle}>Внимание!</Text>
            
            <Text style={styles.modalMessage}>
              Ако изключите основните услуги, следните функции няма да работят правилно:
            </Text>
            
            <View style={styles.featureList}>
              <Text style={styles.featureItem}>❌ Профил и настройки</Text>
              <Text style={styles.featureItem}>❌ Push известия</Text>
              <Text style={styles.featureItem}>❌ Аналитика и статистики</Text>
              <Text style={styles.featureItem}>❌ Автоматични отговори</Text>
              <Text style={styles.featureItem}>❌ SMS услуги</Text>
            </View>
            
            <Text style={styles.modalWarning}>
              Приложението може да не функционира правилно без тези услуги.
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cancelDisableEssential}
              >
                <Text style={styles.modalCancelButtonText}>Отказ</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={confirmDisableEssential}
              >
                <Text style={styles.modalConfirmButtonText}>Изключи</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  infoSection: {
    padding: 20,
    backgroundColor: '#e8f5e8',
    margin: 20,
    borderRadius: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#2d5a2d',
    lineHeight: 20,
    textAlign: 'center',
  },
  consentsContainer: {
    padding: 20,
  },
  consentItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  consentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  consentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2c3e50',
    flex: 1,
    marginRight: 16,
  },
  required: {
    color: '#e74c3c',
    fontWeight: 'bold',
  },
  consentDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  consentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legalBasis: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
  requiredText: {
    fontSize: 12,
    color: '#e74c3c',
    fontWeight: '600',
  },
  actionsContainer: {
    padding: 20,
  },
  actionButton: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#27ae60',
    padding: 18,
    borderRadius: 8,
    marginTop: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#95a5a6',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    backgroundColor: '#fff',
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  footerText: {
    fontSize: 12,
    color: '#7f8c8d',
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fef3c7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 15,
    color: '#555',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  featureList: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 16,
  },
  featureItem: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 8,
    fontWeight: '500',
  },
  modalWarning: {
    fontSize: 13,
    color: '#b91c1c',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#e5e7eb',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConsentScreen;
