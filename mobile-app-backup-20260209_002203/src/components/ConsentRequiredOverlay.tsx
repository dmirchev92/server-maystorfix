import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface ConsentRequiredOverlayProps {
  title?: string;
  message?: string;
  consentType: 'data_sharing' | 'essential_service';
}

const ConsentRequiredOverlay: React.FC<ConsentRequiredOverlayProps> = ({
  title = 'Необходимо е съгласие',
  message,
  consentType,
}) => {
  const navigation = useNavigation<any>();

  const getDefaultMessage = () => {
    if (consentType === 'data_sharing') {
      return 'За да използвате чат функцията, е необходимо да дадете съгласие за съхранение на съобщенията. Без това съгласие не можем да запазваме вашите разговори.';
    }
    return 'За да използвате тази функция, е необходимо да дадете съгласие в настройките за поверителност.';
  };

  const handleGoToConsent = () => {
    navigation.navigate('Consent');
  };

  return (
    <View style={styles.container}>
      {/* Dark overlay background */}
      <View style={styles.overlay} />
      
      {/* Content overlay */}
      <View style={styles.contentContainer}>
        <View style={styles.card}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔒</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>
            {message || getDefaultMessage()}
          </Text>

          {/* Info box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <Text style={styles.infoText}>
              Вашите данни се обработват в съответствие с GDPR и се съхраняват сигурно в ЕС.
            </Text>
          </View>

          {/* Action button */}
          <TouchableOpacity
            style={styles.button}
            onPress={handleGoToConsent}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Отвори настройки за поверителност</Text>
          </TouchableOpacity>

          {/* Secondary link */}
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Назад</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.92)', // slate-900 with high opacity
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: 'rgba(30, 41, 59, 0.95)', // slate-800 with opacity
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-600
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.2)', // indigo with opacity
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f1f5f9', // slate-100
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)', // blue with opacity
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 10,
    marginTop: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#93c5fd', // blue-300
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#6366f1', // indigo-500
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    color: '#64748b', // slate-500
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ConsentRequiredOverlay;
