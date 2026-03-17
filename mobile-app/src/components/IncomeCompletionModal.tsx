import { Logger } from '../utils/Logger';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('common');
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
      Logger.error('Error completing case:', error);
      Alert.alert(t('error'), t('incomeCompleteError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const paymentMethods = [
    { label: t('incomeSelectMethod'), value: '' },
    { label: `💵 ${t('incomeCash')}`, value: 'cash' },
    { label: `💳 ${t('incomeCard')}`, value: 'card' },
    { label: `🏦 ${t('incomeBankTransfer')}`, value: 'bank_transfer' },
    { label: '🌐 Revolut', value: 'online' },
    { label: `📝 ${t('incomeOther')}`, value: 'other' },
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
            <Text style={styles.headerTitle}>🏁 {t('incomeCompleteCase')}</Text>
            <Text style={styles.headerSubtitle}>{caseTitle}</Text>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Completion Notes */}
            <View style={styles.section}>
              <Text style={styles.label}>{t('incomeCompletionNotes')}</Text>
              <TextInput
                style={styles.textArea}
                value={completionNotes}
                onChangeText={setCompletionNotes}
                placeholder={t('incomeDescribeWork')}
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
                    💰 {t('incomeAddIncome')}
                  </Text>
                  <Text style={styles.incomeToggleSubtitle}>
                    {t('incomeTrackSubtitle')}
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
                    {t('incomeAmount')} <Text style={styles.required}>*</Text>
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
                    <Text style={styles.currency}>€</Text>
                  </View>
                </View>

                {/* Payment Method */}
                <View style={styles.section}>
                  <Text style={styles.label}>{t('incomePaymentMethod')}</Text>
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
                  <Text style={styles.label}>{t('incomeAdditionalNotes')}</Text>
                  <TextInput
                    style={styles.textArea}
                    value={incomeNotes}
                    onChangeText={setIncomeNotes}
                    placeholder={t('incomeNotesPlaceholder')}
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
                <Text style={styles.infoBold}>💡 {t('incomeTip')}:</Text> {t('incomeTipText')}
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
              <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
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
                {isSubmitting ? `⏳ ${t('incomeCompleting')}` : `✅ ${t('incomeComplete')}`}
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
    backgroundColor: '#1e293b', // slate-800 - dark theme
    borderRadius: theme.borderRadius.xl,
    width: '100%',
    maxHeight: '90%',
    ...theme.shadows.lg,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
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
    color: '#e2e8f0', // slate-200 - visible on dark
    marginBottom: theme.spacing.sm,
  },
  required: {
    color: theme.colors.danger.solid,
  },
  textArea: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: '#e2e8f0', // slate-200 - visible on dark
    backgroundColor: '#0f172a', // slate-900
    minHeight: 80,
    textAlignVertical: 'top',
  },
  incomeToggleContainer: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // blue tint for dark theme
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.4)',
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
    color: '#e2e8f0', // slate-200
  },
  incomeToggleSubtitle: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
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
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: '#0f172a', // slate-900
  },
  amountInput: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: '#e2e8f0', // slate-200
    paddingVertical: theme.spacing.sm,
  },
  currency: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.medium,
    color: '#94a3b8', // slate-400
  },
  pickerContainer: {
    gap: theme.spacing.sm,
  },
  paymentMethodButton: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: '#0f172a', // slate-900
  },
  paymentMethodButtonActive: {
    borderColor: '#22c55e', // green-500
    backgroundColor: 'rgba(34, 197, 94, 0.15)', // green tint
  },
  paymentMethodText: {
    fontSize: theme.fontSize.md,
    color: '#e2e8f0', // slate-200
  },
  paymentMethodTextActive: {
    color: theme.colors.success.solid,
    fontWeight: theme.fontWeight.semibold,
  },
  infoBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // amber tint
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: '#fbbf24', // amber-400
  },
  infoBold: {
    fontWeight: theme.fontWeight.bold,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  button: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    backgroundColor: '#334155', // slate-700
  },
  cancelButtonText: {
    fontSize: theme.fontSize.md,
    color: '#e2e8f0', // slate-200 - visible on dark
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
