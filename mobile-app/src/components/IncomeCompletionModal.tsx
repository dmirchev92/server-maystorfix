import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
} from 'react-native';
import theme from '../styles/theme';

interface IncomeCompletionModalProps {
  visible: boolean;
  caseTitle: string;
  onClose: () => void;
  onComplete: (data: {
    completionNotes: string;
    income?: {
      amount: number;
      paymentMethod?: string;
      notes?: string;
    };
  }) => void;
}

export default function IncomeCompletionModal({
  visible,
  caseTitle,
  onClose,
  onComplete,
}: IncomeCompletionModalProps) {
  const [completionNotes, setCompletionNotes] = useState('');
  const [includeIncome, setIncludeIncome] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [incomeNotes, setIncomeNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const data: any = {
        completionNotes,
      };

      if (includeIncome && amount && parseFloat(amount) > 0) {
        data.income = {
          amount: parseFloat(amount),
          paymentMethod: paymentMethod || undefined,
          notes: incomeNotes || undefined,
        };
      }

      await onComplete(data);

      // Reset form
      setCompletionNotes('');
      setIncludeIncome(false);
      setAmount('');
      setPaymentMethod('');
      setIncomeNotes('');
    } catch (error) {
      console.error('Error completing case:', error);
      Alert.alert('Грешка', 'Възникна грешка при завършването на заявката');
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    { label: 'Изберете метод', value: '' },
    { label: '💵 Кеш', value: 'cash' },
    { label: '💳 Картово плащане', value: 'card' },
    { label: '🏦 Банков път', value: 'bank_transfer' },
    { label: '🌐 Revolut', value: 'online' },
    { label: '📝 Друго', value: 'other' },
  ];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>🏁 Завършване на заявка</Text>
            <Text style={styles.headerSubtitle}>{caseTitle}</Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Completion Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>Бележки за завършване</Text>
              <TextInput
                style={styles.textArea}
                value={completionNotes}
                onChangeText={setCompletionNotes}
                placeholder="Опишете какво е направено..."
                placeholderTextColor={theme.colors.text.tertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Income Tracking Toggle */}
            <View style={styles.incomeToggleContainer}>
              <View style={styles.incomeToggleContent}>
                <View style={styles.incomeToggleTextContainer}>
                  <Text style={styles.incomeToggleTitle}>
                    💰 Добави приход от тази заявка
                  </Text>
                  <Text style={styles.incomeToggleSubtitle}>
                    Проследявайте приходите си за по-добро управление на бизнеса
                  </Text>
                </View>
                <Switch
                  value={includeIncome}
                  onValueChange={setIncludeIncome}
                  trackColor={{ false: theme.colors.gray[300], true: theme.colors.success.solid }}
                  thumbColor={includeIncome ? theme.colors.success.solid : theme.colors.gray[400]}
                />
              </View>
            </View>

            {/* Income Details */}
            {includeIncome && (
              <View style={styles.incomeDetailsContainer}>
                {/* Amount */}
                <View style={styles.section}>
                  <Text style={styles.label}>
                    Сума <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.amountInputContainer}>
                    <TextInput
                      style={styles.amountInput}
                      value={amount}
                      onChangeText={setAmount}
                      placeholder="0.00"
                      placeholderTextColor={theme.colors.text.tertiary}
                      keyboardType="decimal-pad"
                    />
                    <Text style={styles.currency}>BGN</Text>
                  </View>
                </View>

                {/* Payment Method */}
                <View style={styles.section}>
                  <Text style={styles.label}>Метод на плащане</Text>
                  <View style={styles.pickerContainer}>
                    {paymentMethods.map((method) => (
                      <TouchableOpacity
                        key={method.value}
                        style={[
                          styles.paymentMethodButton,
                          paymentMethod === method.value && styles.paymentMethodButtonActive,
                        ]}
                        onPress={() => setPaymentMethod(method.value)}
                      >
                        <Text
                          style={[
                            styles.paymentMethodText,
                            paymentMethod === method.value && styles.paymentMethodTextActive,
                          ]}
                        >
                          {method.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Income Notes */}
                <View style={styles.section}>
                  <Text style={styles.label}>Допълнителни бележки</Text>
                  <TextInput
                    style={styles.textArea}
                    value={incomeNotes}
                    onChangeText={setIncomeNotes}
                    placeholder="Напр. частично плащане, бонус и т.н..."
                    placeholderTextColor={theme.colors.text.tertiary}
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </View>
            )}

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                <Text style={styles.infoBold}>💡 Съвет:</Text> Добавянето на приход ви помага да
                проследявате месечните си приходи и да анализирате бизнеса си по-добре.
              </Text>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelButtonText}>Отказ</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.submitButton,
                (isSubmitting || (includeIncome && (!amount || parseFloat(amount) <= 0))) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting || (includeIncome && (!amount || parseFloat(amount) <= 0))}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? '⏳ Завършване...' : '✅ Завърши заявката'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.md,
  },
  modalContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxHeight: '90%',
    ...theme.shadows.lg,
  },
  header: {
    backgroundColor: theme.colors.success.solid,
    padding: theme.spacing.lg,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: theme.colors.text.inverse,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text.inverse,
    marginTop: theme.spacing.xs,
    opacity: 0.9,
  },
  scrollView: {
    padding: theme.spacing.lg,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.danger.solid,
  },
  textArea: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  incomeToggleContainer: {
    backgroundColor: '#E3F2FD',
    borderWidth: 1,
    borderColor: '#2196F3',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  incomeToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  incomeToggleTextContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  incomeToggleTitle: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.primary,
  },
  incomeToggleSubtitle: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing.xs,
  },
  incomeDetailsContainer: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success.solid,
    paddingLeft: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  amountInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.sm,
  },
  currency: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.text.secondary,
  },
  pickerContainer: {
    gap: theme.spacing.sm,
  },
  paymentMethodButton: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background.secondary,
  },
  paymentMethodButtonActive: {
    borderColor: theme.colors.success.solid,
    backgroundColor: '#E8F5E9',
  },
  paymentMethodText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
  },
  paymentMethodTextActive: {
    color: theme.colors.success.solid,
    fontWeight: theme.fontWeight.semibold,
  },
  infoBox: {
    backgroundColor: '#FFF9C4',
    borderWidth: 1,
    borderColor: '#FBC02D',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: '#F57F17',
  },
  infoBold: {
    fontWeight: theme.fontWeight.bold,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    backgroundColor: theme.colors.background.secondary,
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.primary,
    fontWeight: theme.fontWeight.medium,
  },
  submitButton: {
    backgroundColor: theme.colors.success.solid,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text.inverse,
    fontWeight: theme.fontWeight.semibold,
  },
});
