// Reset Password Screen for ServiceText Pro
// Allows users to set a new password using a reset token

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import ApiService from '../services/ApiService';

type ResetPasswordRouteParams = {
  ResetPassword: {
    token: string;
  };
};

const ResetPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ResetPasswordRouteParams, 'ResetPassword'>>();
  const token = route.params?.token;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password validations
  const validations = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[@$!%*?&]/.test(password),
    passwordsMatch: password === confirmPassword && password.length > 0,
  };

  const isValidPassword = Object.values(validations).every((v) => v);

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Грешка', 'Невалиден или липсващ токен за възстановяване');
      return;
    }

    if (!isValidPassword) {
      Alert.alert('Грешка', 'Моля уверете се, че паролата отговаря на всички изисквания');
      return;
    }

    setIsLoading(true);
    try {
      const response = await ApiService.getInstance().resetPassword(token, password);
      if (response.success) {
        setSuccess(true);
      } else {
        Alert.alert(
          'Грешка',
          response.error?.message || 'Възникна грешка. Моля опитайте отново.'
        );
      }
    } catch (error: any) {
      Alert.alert('Грешка', error.message || 'Възникна грешка при свързване със сървъра');
    } finally {
      setIsLoading(false);
    }
  };

  // No token provided
  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>❌</Text>
          </View>
          <Text style={styles.errorTitle}>Невалиден линк</Text>
          <Text style={styles.errorText}>
            Линкът за възстановяване на парола е невалиден или изтекъл.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={styles.actionButtonText}>Заявете нов линк</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Success state
  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Паролата е променена!</Text>
          <Text style={styles.successText}>
            Вашата парола беше успешно обновена. Вече можете да влезете с новата
            си парола.
          </Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.actionButtonText}>Влезте в акаунта си</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Нова парола</Text>
          <Text style={styles.subtitle}>Въведете новата си парола</Text>
        </View>

        {/* Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Нова парола</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                style={styles.passwordInput}
                placeholder="••••••••"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Потвърдете паролата</Text>
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#999"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!isLoading}
            />
          </View>

          {/* Password requirements */}
          <View style={styles.requirementsBox}>
            <Text style={styles.requirementsTitle}>Изисквания за парола:</Text>
            <View style={styles.requirementsGrid}>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.minLength && styles.requirementMet,
                  ]}
                >
                  {validations.minLength ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.minLength && styles.requirementTextMet,
                  ]}
                >
                  Минимум 8 символа
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.hasUppercase && styles.requirementMet,
                  ]}
                >
                  {validations.hasUppercase ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.hasUppercase && styles.requirementTextMet,
                  ]}
                >
                  Главна буква (A-Z)
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.hasLowercase && styles.requirementMet,
                  ]}
                >
                  {validations.hasLowercase ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.hasLowercase && styles.requirementTextMet,
                  ]}
                >
                  Малка буква (a-z)
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.hasNumber && styles.requirementMet,
                  ]}
                >
                  {validations.hasNumber ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.hasNumber && styles.requirementTextMet,
                  ]}
                >
                  Цифра (0-9)
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.hasSpecial && styles.requirementMet,
                  ]}
                >
                  {validations.hasSpecial ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.hasSpecial && styles.requirementTextMet,
                  ]}
                >
                  Специален символ (@$!%*?&)
                </Text>
              </View>
              <View style={styles.requirementRow}>
                <Text
                  style={[
                    styles.requirementCheck,
                    validations.passwordsMatch && styles.requirementMet,
                  ]}
                >
                  {validations.passwordsMatch ? '✓' : '○'}
                </Text>
                <Text
                  style={[
                    styles.requirementText,
                    validations.passwordsMatch && styles.requirementTextMet,
                  ]}
                >
                  Паролите съвпадат
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.submitButton,
              (!isValidPassword || isLoading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!isValidPassword || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>🔐 Запазете новата парола</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  iconContainer: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#a0a0a0',
    textAlign: 'center',
  },
  formContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e0e0e0',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
    color: '#fff',
  },
  eyeButton: {
    padding: 15,
  },
  eyeIcon: {
    fontSize: 18,
  },
  requirementsBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a0a0a0',
    marginBottom: 12,
  },
  requirementsGrid: {},
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementCheck: {
    fontSize: 14,
    color: '#666',
    marginRight: 10,
    width: 18,
  },
  requirementMet: {
    color: '#10b981',
  },
  requirementText: {
    fontSize: 13,
    color: '#666',
  },
  requirementTextMet: {
    color: '#10b981',
  },
  submitButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  submitButtonDisabled: {
    backgroundColor: '#4a4a6a',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Success state styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  successIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  successIconText: {
    fontSize: 40,
    color: '#fff',
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  successText: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  // Error state styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 25,
  },
  errorIconText: {
    fontSize: 40,
  },
  errorTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  errorText: {
    fontSize: 15,
    color: '#a0a0a0',
    textAlign: 'center',
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 40,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
