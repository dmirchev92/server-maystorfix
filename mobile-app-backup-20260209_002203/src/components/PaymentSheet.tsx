/**
 * Payment Sheet Component
 * Placeholder component for Stripe payment integration
 * 
 * IMPORTANT: This component is prepared but NOT FUNCTIONAL until:
 * 1. @stripe/stripe-react-native is installed
 * 2. Stripe is configured on the backend
 * 
 * To enable:
 * 1. npm install @stripe/stripe-react-native
 * 2. Uncomment the Stripe imports and implementation
 * 3. Wrap your app with StripeProvider in App.tsx
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import theme from '../styles/theme';

// Uncomment when Stripe is installed:
// import { useStripe } from '@stripe/stripe-react-native';

interface PaymentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
  clientSecret?: string;
  amount: number;
  currency: string;
  description: string;
}

const PaymentSheet: React.FC<PaymentSheetProps> = ({
  visible,
  onClose,
  onSuccess,
  clientSecret,
  amount,
  currency,
  description,
}) => {
  const [loading, setLoading] = useState(false);
  
  // Uncomment when Stripe is installed:
  // const { initPaymentSheet, presentPaymentSheet } = useStripe();

  const handlePayment = async () => {
    if (!clientSecret) {
      Alert.alert('Грешка', 'Плащането не е налично в момента');
      return;
    }

    setLoading(true);

    try {
      // Uncomment when Stripe is installed:
      // const { error: initError } = await initPaymentSheet({
      //   paymentIntentClientSecret: clientSecret,
      //   merchantDisplayName: 'ServiceTextPro',
      //   style: 'automatic',
      // });

      // if (initError) {
      //   Alert.alert('Грешка', initError.message);
      //   return;
      // }

      // const { error: presentError } = await presentPaymentSheet();

      // if (presentError) {
      //   if (presentError.code !== 'Canceled') {
      //     Alert.alert('Грешка', presentError.message);
      //   }
      //   return;
      // }

      // Payment successful
      // onSuccess();

      // Placeholder behavior - show not available message
      Alert.alert(
        'Плащането не е налично',
        'Онлайн плащанията ще бъдат активирани скоро. Моля, свържете се с нас за ръчно плащане.',
        [{ text: 'OK', onPress: onClose }]
      );

    } catch (error: any) {
      Alert.alert('Грешка', error.message || 'Възникна грешка при плащането');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return `${amount.toFixed(2)} ${currency === 'EUR' ? '€' : currency}`;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Плащане</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <Text style={styles.description}>{description}</Text>
            
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>Сума за плащане:</Text>
              <Text style={styles.price}>{formatPrice(amount, currency)}</Text>
            </View>

            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                Онлайн плащанията ще бъдат активирани скоро. 
                За момента можете да се свържете с нас за ръчно плащане.
              </Text>
            </View>

            <View style={styles.securityNote}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                Плащанията се обработват сигурно чрез Stripe
              </Text>
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Отказ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.payButton, loading && styles.payButtonDisabled]}
              onPress={handlePayment}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.payButtonText}>
                  Плати {formatPrice(amount, currency)}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#94a3b8',
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 16,
    color: '#e2e8f0',
    marginBottom: 20,
    textAlign: 'center',
  },
  priceContainer: {
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  priceLabel: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 8,
  },
  price: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#93c5fd',
    lineHeight: 20,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#64748b',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  payButton: {
    flex: 2,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  payButtonDisabled: {
    opacity: 0.7,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PaymentSheet;
