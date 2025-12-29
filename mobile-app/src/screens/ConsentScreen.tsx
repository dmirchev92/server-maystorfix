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

const ConsentScreen: React.FC = () => {
  const dispatch = useDispatch();
  const { currentMode, businessHours } = useSelector((state: RootState) => state.app);
  
  const [consents, setConsents] = useState<ConsentItem[]>([
    {
      id: 'data_processing',
      title: 'Обработка на данни',
      description: 'Съгласявам се данните ми да бъдат обработвани за целите на услугата',
      required: true,
      enabled: true,
      legalBasis: 'Договор',
    },
    {
      id: 'ai_communication',
      title: 'AI комуникация',
      description: 'Съгласявам се да получавам автоматични отговори от AI система',
      required: false,
      enabled: false,
      legalBasis: 'Съгласие',
    },
    {
      id: 'data_storage',
      title: 'Съхранение на данни',
      description: 'Съгласявам се разговорите ми да бъдат съхранявани за подобряване на услугата',
      required: false,
      enabled: false,
      legalBasis: 'Съгласие',
    },
    {
      id: 'analytics',
      title: 'Аналитика',
      description: 'Съгласявам се данните ми да бъдат използвани за аналитични цели',
      required: false,
      enabled: false,
      legalBasis: 'Съгласие',
    },
    {
      id: 'third_party',
      title: 'Трети страни',
      description: 'Съгласявам се данните ми да бъдат споделяни с партньори за предоставяне на услугата',
      required: false,
      enabled: false,
      legalBasis: 'Съгласие',
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadCurrentConsents();
  }, []);

  const loadCurrentConsents = async () => {
    try {
      setIsLoading(true);
      // TODO: Load current consents from backend
      // const currentConsents = await ApiService.getConsents();
      // setConsents(currentConsents);
    } catch (error) {
      console.error('Error loading consents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConsentChange = (consentId: string, enabled: boolean) => {
    setConsents(prev => 
      prev.map(consent => 
        consent.id === consentId 
          ? { ...consent, enabled }
          : consent
      )
    );
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
        status: (consent.enabled ? 'granted' : 'withdrawn') as 'granted' | 'withdrawn',
        legalBasis: consent.legalBasis,
        description: consent.description,
        timestamp: new Date().toISOString(),
      }));

      // TODO: Save to backend
      // await ApiService.updateConsents(consentData);

      // Update local state
      dispatch(updateConsent({ 
        hasGDPRConsent: true,
        consentTimestamp: new Date().toISOString(),
        consentDetails: consentData
      }));

      Alert.alert(
        'Успешно',
        'Вашите предпочитания за поверителност са запазени.',
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error('Error saving consents:', error);
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
      '✓ Достъп до данните си\n✓ Коригиране на неточни данни\n✓ Изтриване ("право да бъдеш забравен")\n✓ Преносимост на данните\n✓ Оттегляне на съгласие\n\nЗа упражняване на правата си:\ndpo@snapfix.bg',
      [
        { text: 'Изпрати имейл', onPress: () => Linking.openURL('mailto:dpo@snapfix.bg') },
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
          За въпроси относно поверителността: dpo@snapfix.bg
        </Text>
      </View>
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
});

export default ConsentScreen;
