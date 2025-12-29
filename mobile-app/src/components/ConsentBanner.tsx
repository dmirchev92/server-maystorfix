import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { updateConsent } from '../store/slices/appSlice';

interface ConsentBannerProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
  onCustomize: () => void;
}

const ConsentBanner: React.FC<ConsentBannerProps> = ({
  visible,
  onAccept,
  onDecline,
  onCustomize,
}) => {
  const dispatch = useDispatch();
  const { hasGDPRConsent } = useSelector((state: RootState) => state.app);
  
  const [showDetails, setShowDetails] = useState(false);

  if (!visible || hasGDPRConsent) {
    return null;
  }

  const handleAcceptAll = () => {
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
        {
          consentType: 'analytics',
          status: 'granted',
          legalBasis: 'Съгласие',
          description: 'Аналитични данни',
          timestamp: new Date().toISOString(),
        },
      ]
    }));
    onAccept();
  };

  const handleDecline = () => {
    dispatch(updateConsent({
      hasGDPRConsent: false,
      consentTimestamp: new Date().toISOString(),
      consentDetails: []
    }));
    onDecline();
  };

  const openPrivacyPolicy = () => {
    Linking.openURL('https://snapfix.bg/privacy-policy');
  };

  const openTerms = () => {
    Linking.openURL('https://snapfix.bg/terms');
  };

  return (
    <>
      <View style={styles.banner}>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>🍪 Поверителност и бисквитки</Text>
          <Text style={styles.bannerText}>
            Използваме бисквитки и подобни технологии за подобряване на услугата, 
            персонализиране на съдържанието и анализ на трафика. 
            Съгласявайки се, вие приемате нашата{' '}
            <Text style={styles.link} onPress={openPrivacyPolicy}>
              Политика за поверителност
            </Text>{' '}
            и{' '}
            <Text style={styles.link} onPress={openTerms}>
              Условия за ползване
            </Text>
            .
          </Text>
          
          <View style={styles.bannerActions}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={handleDecline}
            >
              <Text style={styles.declineButtonText}>Отказ</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.customizeButton}
              onPress={onCustomize}
            >
              <Text style={styles.customizeButtonText}>Персонализирай</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={handleAcceptAll}
            >
              <Text style={styles.acceptButtonText}>Приемам всички</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => setShowDetails(true)}
          >
            <Text style={styles.detailsButtonText}>
              ℹ️ Какво означава това?
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showDetails}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Какво означават бисквитките?
            </Text>
            
            <ScrollView style={styles.modalScroll}>
              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>🍪 Необходими бисквитки</Text>
                <Text style={styles.detailText}>
                  Тези бисквитки са необходими за основната функционалност на приложението. 
                  Без тях не можем да предоставим услугата.
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>🤖 AI комуникация</Text>
                <Text style={styles.detailText}>
                  Съхраняваме информация за пропуснати обаждания и AI разговори, 
                  за да можете да ги преглеждате и поемате.
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>📊 Аналитични бисквитки</Text>
                <Text style={styles.detailText}>
                  Помогат ни да разберем как използвате приложението и 
                  да го подобрим за вас.
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>🔒 Вашите данни</Text>
                <Text style={styles.detailText}>
                  Всички данни се съхраняват сигурно в ЕС според GDPR. 
                  Можете да ги изтриете по всяко време.
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailTitle}>📱 Как да управлявате</Text>
                <Text style={styles.detailText}>
                  В настройките можете да промените предпочитанията си 
                  за бисквитките по всяко време.
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowDetails(false)}
            >
              <Text style={styles.modalCloseButtonText}>Затвори</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    padding: 16,
    zIndex: 1000,
  },
  bannerContent: {
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
    textAlign: 'center',
  },
  bannerText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  link: {
    color: '#3498db',
    textDecorationLine: 'underline',
  },
  bannerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  declineButton: {
    flex: 1,
    padding: 12,
    marginRight: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#7f8c8d',
    fontSize: 14,
    fontWeight: '600',
  },
  customizeButton: {
    flex: 1,
    padding: 12,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#f39c12',
    alignItems: 'center',
  },
  customizeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    padding: 12,
    marginLeft: 8,
    borderRadius: 6,
    backgroundColor: '#27ae60',
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  detailsButton: {
    alignItems: 'center',
    padding: 8,
  },
  detailsButtonText: {
    color: '#3498db',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  modalCloseButton: {
    backgroundColor: '#3498db',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 16,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ConsentBanner;
