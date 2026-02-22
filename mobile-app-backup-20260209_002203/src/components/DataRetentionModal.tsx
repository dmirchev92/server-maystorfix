/**
 * DataRetentionModal - Prompts users to extend data retention when nearing expiry
 * GDPR compliance feature - allows users to consent to continued data storage
 */

import { Logger } from '../utils/Logger';
import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import ApiService from '../services/ApiService';

interface DataRetentionModalProps {
  visible: boolean;
  daysRemaining: number;
  onClose: () => void;
  onExtended: () => void;
}

const DataRetentionModal: React.FC<DataRetentionModalProps> = ({
  visible,
  daysRemaining,
  onClose,
  onExtended,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleYes = async () => {
    setLoading(true);
    try {
      const response = await ApiService.getInstance().extendDataRetention();
      if (response.success) {
        onExtended();
      } else {
        // Handle error silently - user can try again later
        onClose();
      }
    } catch (error) {
      Logger.error('Error extending data retention:', error);
      onClose();
    }
    setLoading(false);
  };

  const handleNo = () => {
    setShowWarning(true);
  };

  const handleConfirmNo = () => {
    setShowWarning(false);
    onClose();
  };

  const handleBackToChoice = () => {
    setShowWarning(false);
  };

  if (showWarning) {
    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.warningIcon}>⚠️</Text>
            <Text style={styles.warningTitle}>Внимание!</Text>
            <Text style={styles.warningText}>
              Ако не удължите периода за съхранение на данни:
            </Text>
            <View style={styles.consequencesList}>
              <Text style={styles.consequenceItem}>
                • Вашият акаунт ще бъде деактивиран след {daysRemaining} дни
              </Text>
              <Text style={styles.consequenceItem}>
                • Няма да можете да влезете в приложението
              </Text>
              <Text style={styles.consequenceItem}>
                • Всичките ви данни ще бъдат изтрити безвъзвратно
              </Text>
              <Text style={styles.consequenceItem}>
                • Историята на заявки и съобщения ще бъде загубена
              </Text>
            </View>
            <Text style={styles.warningQuestion}>
              Сигурни ли сте, че не искате да продължите?
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.backButton]}
                onPress={handleBackToChoice}
              >
                <Text style={styles.backButtonText}>← Назад</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.confirmNoButton]}
                onPress={handleConfirmNo}
              >
                <Text style={styles.confirmNoButtonText}>Да, сигурен съм</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.icon}>📋</Text>
          <Text style={styles.title}>Съхранение на данни</Text>
          <Text style={styles.message}>
            Периодът за съхранение на вашите данни изтича след{' '}
            <Text style={styles.highlight}>{daysRemaining} дни</Text>.
          </Text>
          <Text style={styles.subMessage}>
            Съгласно GDPR, трябва да потвърдите, че искате да продължим да 
            съхраняваме вашите данни за следващите 7 години.
          </Text>
          <Text style={styles.question}>
            Желаете ли да удължите периода за съхранение?
          </Text>
          
          {loading ? (
            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.noButton]}
                onPress={handleNo}
              >
                <Text style={styles.noButtonText}>Не</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.yesButton]}
                onPress={handleYes}
              >
                <Text style={styles.yesButtonText}>Да, удължи</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  warningIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  warningTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E53935',
    marginBottom: 16,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 24,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#E53935',
  },
  subMessage: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 24,
  },
  warningText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 16,
  },
  consequencesList: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  consequenceItem: {
    fontSize: 14,
    color: '#E65100',
    marginBottom: 8,
    lineHeight: 20,
  },
  warningQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  yesButton: {
    backgroundColor: '#4CAF50',
  },
  yesButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  noButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmNoButton: {
    backgroundColor: '#E53935',
  },
  confirmNoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loader: {
    marginVertical: 20,
  },
});

export default DataRetentionModal;
