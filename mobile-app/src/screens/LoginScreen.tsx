// Login Screen for ServiceText Pro
// Handles user authentication and navigation to main app

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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import theme from '../styles/theme';

interface LoginScreenProps {}

const LoginScreen: React.FC<LoginScreenProps> = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    checkBackendConnection();
  }, []);

  const checkBackendConnection = async () => {
    try {
      const isConnected = await ApiService.testConnection();
      setBackendStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
      setBackendStatus('disconnected');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Грешка', 'Моля, попълнете всички полета');
      return;
    }

    setIsLoading(true);
    try {
      const { user } = await ApiService.login({ email: email.trim(), password });
      if (user) {
        // Navigate to main app
        navigation.replace('Main');
      }
    } catch (error: any) {
      Alert.alert(
        'Грешка при влизане',
        error.message || 'Неуспешно влизане в системата'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestLogin = async () => {
    setIsLoading(true);
    try {
      const { user } = await ApiService.login({ email: 'ivan@example.com', password: 'Test123!@#' });
      if (user) {
        // Navigate to main app
        navigation.replace('Main');
      }
    } catch (error: any) {
      // Fallback to mock user if backend fails
      console.log('Backend login failed, using mock user');
      const mockUser = {
        id: '1',
        email: 'ivan@example.com',
        firstName: 'Иван',
        lastName: 'Петров',
        role: 'business_owner'
      };
      // Store mock user in AsyncStorage or similar
      navigation.replace('Main');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = () => {
    Alert.alert(
      'Регистрация',
      'Регистрацията ще бъде добавена в следващата фаза.\n\nЗа тестване използвайте:\nИмейл: ivan@example.com\nПарола: Test123!@#',
      [{ text: 'OK' }]
    );
  };

  const getBackendStatusText = () => {
    switch (backendStatus) {
      case 'checking':
        return 'Проверяване на връзката...';
      case 'connected':
        return '✅ Свързан с backend';
      case 'disconnected':
        return '❌ Няма връзка с backend';
      default:
        return 'Неизвестен статус';
    }
  };

  const getBackendStatusColor = () => {
    switch (backendStatus) {
      case 'connected':
        return '#4CAF50';
      case 'disconnected':
        return '#F44336';
      default:
        return '#FF9800';
    }
  };

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
          <Text style={styles.logo}>🔧</Text>
          <Text style={styles.title}>ServiceText Pro</Text>
          <Text style={styles.subtitle}>
            Управление на пропуснати обаждания за български занаятчии
          </Text>
        </View>

        {/* Backend Status */}
        <View style={styles.statusContainer}>
          <Text style={[styles.statusText, { color: getBackendStatusColor() }]}>
            {getBackendStatusText()}
          </Text>
        </View>

        {/* Login Form */}
        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Имейл адрес</Text>
            <TextInput
              style={styles.input}
              placeholder="Въведете вашия имейл"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Парола</Text>
            <TextInput
              style={styles.input}
              placeholder="Въведете вашата парола"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Влизане...' : 'Влизане'}
            </Text>
          </TouchableOpacity>

          {/* Test Login Button */}
          <TouchableOpacity
            style={[styles.testLoginButton, isLoading && styles.testLoginButtonDisabled]}
            onPress={handleTestLogin}
            disabled={isLoading}
          >
            <Text style={styles.testLoginButtonText}>
              {isLoading ? 'Тестване...' : 'Тестов вход'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.createAccountButton}
            onPress={handleCreateAccount}
          >
            <Text style={styles.createAccountText}>
              Нямате акаунт? Създайте такъв
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2024 ServiceText Pro. Всички права запазени.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  title: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.body.fontSize,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.secondary,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.sm,
  },
  statusConnected: {
    backgroundColor: theme.colors.status.success,
  },
  statusDisconnected: {
    backgroundColor: theme.colors.status.danger,
  },
  statusChecking: {
    backgroundColor: theme.colors.status.warning,
  },
  statusText: {
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: '500',
  },
  statusTextConnected: {
    color: theme.colors.status.success,
  },
  statusTextDisconnected: {
    color: theme.colors.status.danger,
  },
  statusTextChecking: {
    color: theme.colors.status.warning,
  },
  form: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
  inputContainer: {
    marginBottom: theme.spacing.lg,
  },
  inputLabel: {
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.sm,
  },
  input: {
    ...theme.commonStyles.input,
  },
  loginButton: {
    ...theme.commonStyles.button,
    ...theme.commonStyles.buttonPrimary,
    marginBottom: theme.spacing.md,
  },
  loginButtonDisabled: {
    backgroundColor: theme.colors.gray[400],
  },
  loginButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  testLoginButton: {
    ...theme.commonStyles.button,
    ...theme.commonStyles.buttonSuccess,
    marginBottom: theme.spacing.lg,
  },
  testLoginButtonDisabled: {
    backgroundColor: theme.colors.gray[400],
  },
  testLoginButtonText: {
    color: theme.colors.text.inverse,
    fontSize: theme.typography.body.fontSize,
    fontWeight: '600',
  },
  createAccountButton: {
    alignItems: 'center',
  },
  createAccountText: {
    color: theme.colors.primary.solid,
    fontSize: theme.typography.body.fontSize,
    textDecorationLine: 'underline',
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.spacing.xxl,
  },
  footerText: {
    color: theme.colors.text.tertiary,
    fontSize: theme.typography.bodySmall.fontSize,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.xxl,
    backgroundColor: theme.colors.primary.solid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  formContainer: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    ...theme.shadows.lg,
  },
});

export { LoginScreen };
