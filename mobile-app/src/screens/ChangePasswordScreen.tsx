import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import theme from '../styles/theme';

const ChangePasswordScreen: React.FC = () => {
  const navigation = useNavigation();
  const [saving, setSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSave = async () => {
    // Validation
    if (!formData.currentPassword) {
      Alert.alert('Грешка', 'Моля въведете текущата парола');
      return;
    }
    if (!formData.newPassword) {
      Alert.alert('Грешка', 'Моля въведете нова парола');
      return;
    }
    if (formData.newPassword.length < 6) {
      Alert.alert('Грешка', 'Паролата трябва да е поне 6 символа');
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      Alert.alert('Грешка', 'Паролите не съвпадат');
      return;
    }
    if (formData.currentPassword === formData.newPassword) {
      Alert.alert('Грешка', 'Новата парола трябва да е различна от текущата');
      return;
    }

    try {
      setSaving(true);
      
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const token = await AsyncStorage.getItem('auth_token');
      
      const response = await fetch('https://snapfix.bg/api/v1/users/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });

      if (response.ok) {
        Alert.alert(
          'Успех',
          'Паролата е променена успешно',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      } else {
        const errorData: any = await response.json();
        Alert.alert('Грешка', errorData.error?.message || 'Неуспешна промяна на паролата');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      Alert.alert('Грешка', 'Неуспешна промяна на паролата');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>‹ Назад</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Смени парола</Text>
          <Text style={styles.headerSubtitle}>
            Изберете силна парола за защита на профила си
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Current Password */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Текуща парола *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.currentPassword}
                onChangeText={(text) => setFormData({ ...formData, currentPassword: text })}
                placeholder="Въведете текуща парола"
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                <Text style={styles.eyeIcon}>{showCurrentPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* New Password */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Нова парола *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.newPassword}
                onChangeText={(text) => setFormData({ ...formData, newPassword: text })}
                placeholder="Въведете нова парола"
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                <Text style={styles.eyeIcon}>{showNewPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>Минимум 6 символа</Text>
          </View>

          {/* Confirm Password */}
          <View style={styles.formGroup}>
            <Text style={styles.label}>Потвърди нова парола *</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                placeholder="Потвърдете новата парола"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <Text style={styles.eyeIcon}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Password Requirements */}
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsTitle}>📋 Изисквания за парола:</Text>
            <Text style={[
              styles.requirement,
              formData.newPassword.length >= 6 && styles.requirementMet
            ]}>
              • Минимум 6 символа
            </Text>
            <Text style={[
              styles.requirement,
              formData.newPassword === formData.confirmPassword && formData.newPassword.length > 0 && styles.requirementMet
            ]}>
              • Паролите съвпадат
            </Text>
            <Text style={[
              styles.requirement,
              formData.currentPassword !== formData.newPassword && formData.newPassword.length > 0 && styles.requirementMet
            ]}>
              • Различна от текущата парола
            </Text>
          </View>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>🔒 Смени паролата</Text>
            )}
          </TouchableOpacity>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Отказ</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark slate background
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.1)', // Glass-morphism
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backButton: {
    marginBottom: theme.spacing.sm,
  },
  backButtonText: {
    fontSize: 18,
    color: theme.colors.primary.solid,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: theme.typography.h2.fontSize,
    fontWeight: theme.typography.h2.fontWeight,
    color: '#FFFFFF',
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.typography.body.fontSize,
    color: '#CBD5E1',
  },
  form: {
    padding: theme.spacing.lg,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: '#CBD5E1',
    marginBottom: theme.spacing.sm,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: theme.borderRadius.md,
  },
  passwordInput: {
    flex: 1,
    padding: theme.spacing.md,
    fontSize: theme.typography.body.fontSize,
    color: '#FFFFFF',
  },
  eyeButton: {
    padding: theme.spacing.md,
  },
  eyeIcon: {
    fontSize: 20,
  },
  hint: {
    fontSize: theme.typography.caption.fontSize,
    color: '#94A3B8',
    marginTop: theme.spacing.xs,
  },
  requirementsBox: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    marginBottom: theme.spacing.lg,
  },
  requirementsTitle: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: theme.spacing.sm,
  },
  requirement: {
    fontSize: theme.typography.bodySmall.fontSize,
    color: '#94A3B8',
    marginBottom: theme.spacing.xs,
  },
  requirementMet: {
    color: '#10B981',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#6366F1',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  cancelButton: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  cancelButtonText: {
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '500',
  },
});

export default ChangePasswordScreen;
