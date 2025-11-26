import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

type UserType = 'customer' | 'provider';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);
  const [userType, setUserType] = useState<UserType>('customer');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phoneNumber: '',
    companyName: '',
    serviceCategory: '',
  });
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [receiveUpdates, setReceiveUpdates] = useState(false);
  const [showPasswordHint, setShowPasswordHint] = useState(false);
  const [serviceCategories, setServiceCategories] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    // Load saved credentials if any
    const loadSavedCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem('remember_email');
        const savedPassword = await AsyncStorage.getItem('remember_password');
        const savedFlag = await AsyncStorage.getItem('remember_flag');
        const shouldRemember = savedFlag === '1';
        if (shouldRemember && (savedEmail || savedPassword)) {
          setFormData(prev => ({
            ...prev,
            email: savedEmail || '',
            password: savedPassword || '',
          }));
          setRememberMe(true);
        }
      } catch (e) {
        // ignore
      }
    };
    
    // Load service categories
    const loadServiceCategories = async () => {
      try {
        const response = await ApiService.getInstance().getServiceCategories();
        if (response.success && response.data) {
          const categories = (response.data as any[]).map((cat: any) => ({
            id: cat.id,
            name: cat.name || cat.nameEn || cat.id
          }));
          setServiceCategories(categories);
        }
      } catch (error) {
        console.log('Failed to load service categories:', error);
        // Fallback categories - import from constants
        const { SERVICE_CATEGORIES } = require('../constants/serviceCategories');
        setServiceCategories(
          SERVICE_CATEGORIES.map((cat: any) => ({
            id: cat.value,
            name: cat.label
          }))
        );
      }
    };
    
    loadSavedCredentials();
    loadServiceCategories();
  }, []);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert('Грешка', 'Моля въведете имейл и парола');
      return;
    }

    setLoading(true);
    try {
      const response = await ApiService.getInstance().login(
        formData.email,
        formData.password
      );

      if (response.success) {
        console.log('AuthScreen - Login successful, setting token and calling onAuthSuccess');
        await ApiService.getInstance().setAuthToken(response.data?.tokens?.accessToken);
        console.log('AuthScreen - Token set, calling onAuthSuccess with user:', response.data?.user);
        // Remember credentials if requested
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('remember_email', formData.email);
            await AsyncStorage.setItem('remember_password', formData.password);
            await AsyncStorage.setItem('remember_flag', '1');
          } else {
            await AsyncStorage.setItem('remember_flag', '0');
            // keep old values if present; do not erase on a single login toggle
          }
        } catch {}

        // Navigate immediately; let /auth/me verify in background
        onAuthSuccess(response.data?.user || { id: 'local', email: formData.email } as any);
      } else {
        Alert.alert('Грешка', response.error?.message || 'Неуспешен вход');
      }
    } catch (error) {
      Alert.alert('Грешка', 'Възникна грешка при входа');
    } finally {
      setLoading(false);
    }
  };

  const validatePassword = (password: string): boolean => {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar && hasMinLength;
  };

  const handleForgotPassword = async () => {
    if (!forgotPasswordEmail.trim()) {
      Alert.alert('Грешка', 'Моля въведете имейл адрес');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail.trim())) {
      Alert.alert('Грешка', 'Моля въведете валиден имейл адрес');
      return;
    }

    setLoading(true);
    try {
      await ApiService.getInstance().requestPasswordReset(forgotPasswordEmail.trim());
      // Always show success for security
      setForgotPasswordSubmitted(true);
    } catch (error) {
      // Still show success for security
      setForgotPasswordSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Common validation
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.firstName || !formData.lastName || !formData.phoneNumber) {
      Alert.alert('Грешка', 'Моля попълнете всички задължителни полета');
      return;
    }

    // Provider-specific validation
    if (userType === 'provider' && (!formData.companyName || !formData.serviceCategory)) {
      Alert.alert('Грешка', 'Моля попълнете име на компанията и категория услуги');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      Alert.alert('Грешка', 'Паролите не съвпадат');
      return;
    }

    if (!validatePassword(formData.password)) {
      Alert.alert('Грешка', 'Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ');
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Грешка', 'Трябва да приемете условията за ползване');
      return;
    }

    setLoading(true);
    try {
      const registrationData: any = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        role: userType === 'provider' ? 'tradesperson' : 'customer',
        gdprConsents: ['essential_service'],
      };

      // Add provider-specific fields
      if (userType === 'provider') {
        registrationData.serviceCategory = formData.serviceCategory;
        registrationData.companyName = formData.companyName;
      }

      const response = await ApiService.getInstance().register(registrationData);

      console.log('Registration response:', JSON.stringify(response, null, 2));

      if (response.success) {
        console.log('Registration successful, tokens:', response.data?.tokens);
        await ApiService.getInstance().setAuthToken(response.data?.tokens?.accessToken);
        // Remember credentials if requested
        try {
          if (rememberMe) {
            await AsyncStorage.setItem('remember_email', formData.email);
            await AsyncStorage.setItem('remember_password', formData.password);
            await AsyncStorage.setItem('remember_flag', '1');
          } else {
            await AsyncStorage.setItem('remember_flag', '0');
          }
        } catch {}

        onAuthSuccess(response.data?.user || { id: 'local', email: formData.email } as any);
      } else {
        console.log('Registration failed:', response.error);
        Alert.alert('Грешка', response.error?.message || 'Неуспешна регистрация');
      }
    } catch (error) {
      console.log('Registration error:', error);
      Alert.alert('Грешка', `Възникна грешка при регистрацията: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // Forgot Password - Success Screen
  if (isForgotPassword && forgotPasswordSubmitted) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                <Text style={styles.icon}>✉️</Text>
              </View>
              <Text style={styles.title}>Проверете имейла си</Text>
              <Text style={styles.subtitle}>
                Ако съществува акаунт с имейл {forgotPasswordEmail}, ще получите линк за възстановяване на паролата.
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.infoBox}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📧</Text>
                  <Text style={styles.infoText}>Линкът е валиден <Text style={styles.bold}>1 час</Text></Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>📥</Text>
                  <Text style={styles.infoText}>Проверете и папката <Text style={styles.bold}>Спам</Text></Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.modernButton}
                onPress={() => {
                  setIsForgotPassword(false);
                  setForgotPasswordSubmitted(false);
                  setForgotPasswordEmail('');
                }}
              >
                <Text style={styles.modernButtonText}>🔓 Обратно към вход</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchContainer}
                onPress={() => {
                  setForgotPasswordSubmitted(false);
                  setForgotPasswordEmail('');
                }}
              >
                <Text style={styles.switchLink}>Опитайте с друг имейл</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </LinearGradient>
    );
  }

  // Forgot Password - Form Screen
  if (isForgotPassword) {
    return (
      <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView 
          style={styles.flex1} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setIsForgotPassword(false)}
            >
              <Text style={styles.backButtonText}>← Назад</Text>
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>🔑</Text>
              </View>
              <Text style={styles.title}>Забравена парола</Text>
              <Text style={styles.subtitle}>
                Въведете имейла си и ще ви изпратим линк за възстановяване
              </Text>
            </View>

            <View style={styles.form}>
              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Имейл адрес</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="ivan@example.com"
                  placeholderTextColor="#64748b"
                  value={forgotPasswordEmail}
                  onChangeText={setForgotPasswordEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />
              </View>

              <TouchableOpacity
                style={[styles.modernButton, loading && styles.buttonDisabled]}
                onPress={handleForgotPassword}
                disabled={loading}
              >
                <Text style={styles.modernButtonText}>
                  {loading ? '⏳ Изпращане...' : '📧 Изпратете линк'}
                </Text>
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <TouchableOpacity onPress={() => setIsForgotPassword(false)}>
                  <Text style={styles.switchLink}>Обратно към вход</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e293b', '#312e81']} style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        style={styles.flex1} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🔧</Text>
            </View>
            <Text style={styles.title}>
              {isLogin ? 'Влезте в ServiceText Pro' : 'Създайте акаунт'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Добре дошли отново!' : 'Започнете пътуването си с нас днес.'}
            </Text>
          </View>

          <View style={styles.form}>
            {/* User Type Selection - Only show for registration */}
            {!isLogin && (
              <View style={styles.userTypeContainer}>
                <Text style={styles.fieldLabel}>Регистрирай се като:</Text>
                <View style={styles.userTypeButtons}>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'customer' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('customer')}
                  >
                    <Text style={styles.userTypeIcon}>👤</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'customer' && styles.userTypeBtnTextActive]}>
                      Клиент
                    </Text>
                    <Text style={styles.userTypeDesc}>Търся услуги</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.userTypeBtn, userType === 'provider' && styles.userTypeBtnActive]}
                    onPress={() => setUserType('provider')}
                  >
                    <Text style={styles.userTypeIcon}>🔧</Text>
                    <Text style={[styles.userTypeBtnText, userType === 'provider' && styles.userTypeBtnTextActive]}>
                      Специалист
                    </Text>
                    <Text style={styles.userTypeDesc}>Предлагам услуги</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isLogin && (
              <>
                <View style={styles.row}>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>Име *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Иван"
                      placeholderTextColor="#64748b"
                      value={formData.firstName}
                      onChangeText={(value) => handleInputChange('firstName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                  <View style={styles.halfWidth}>
                    <Text style={styles.fieldLabel}>Фамилия *</Text>
                    <TextInput
                      style={styles.modernInput}
                      placeholder="Петров"
                      placeholderTextColor="#64748b"
                      value={formData.lastName}
                      onChangeText={(value) => handleInputChange('lastName', value)}
                      autoCapitalize="words"
                    />
                  </View>
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Имейл адрес *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="ivan@example.com"
                    placeholderTextColor="#64748b"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Телефон *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="+359xxxxxxxxx"
                    placeholderTextColor="#64748b"
                    value={formData.phoneNumber}
                    onChangeText={(value) => handleInputChange('phoneNumber', value)}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Provider-specific fields */}
                {userType === 'provider' && (
                  <>
                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>Име на компанията *</Text>
                      <TextInput
                        style={styles.modernInput}
                        placeholder="Вашата компания ООД"
                        placeholderTextColor="#64748b"
                        value={formData.companyName}
                        onChangeText={(value) => handleInputChange('companyName', value)}
                      />
                    </View>

                    <View style={styles.fieldContainer}>
                      <Text style={styles.fieldLabel}>Категория услуги *</Text>
                      <View style={styles.modernPickerWrapper}>
                        <Picker
                          selectedValue={formData.serviceCategory}
                          onValueChange={(value) => handleInputChange('serviceCategory', value)}
                          style={styles.modernPicker}
                          dropdownIconColor="#818cf8"
                        >
                          <Picker.Item label="Изберете категория" value="" color="#64748b" />
                          {serviceCategories.map((category) => (
                            <Picker.Item
                              key={category.id}
                              label={category.name}
                              value={category.id}
                              color="#1e293b"
                            />
                          ))}
                        </Picker>
                      </View>
                    </View>
                  </>
                )}

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Парола *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry
                    onFocus={() => setShowPasswordHint(true)}
                    onBlur={() => setShowPasswordHint(false)}
                  />
                  {showPasswordHint && (
                    <Text style={styles.passwordHint}>
                      Мин. 8 символа, главна буква, малка буква, цифра и специален символ
                    </Text>
                  )}
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Потвърдете паролата *</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.confirmPassword}
                    onChangeText={(value) => handleInputChange('confirmPassword', value)}
                    secureTextEntry
                  />
                </View>

                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setAcceptTerms(!acceptTerms)}
                  >
                    <View style={[styles.modernCheckbox, acceptTerms && styles.modernCheckboxChecked]}>
                      {acceptTerms && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxText}>
                      Съгласявам се с <Text style={styles.linkText}>Условията и правилата</Text>
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setReceiveUpdates(!receiveUpdates)}
                  >
                    <View style={[styles.modernCheckbox, receiveUpdates && styles.modernCheckboxChecked]}>
                      {receiveUpdates && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.checkboxText}>
                      Получавайте бюлетин и актуализации
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {isLogin && (
              <>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Имейл адрес</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="ivan@example.com"
                    placeholderTextColor="#64748b"
                    value={formData.email}
                    onChangeText={(value) => handleInputChange('email', value)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Парола</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="••••••••"
                    placeholderTextColor="#64748b"
                    value={formData.password}
                    onChangeText={(value) => handleInputChange('password', value)}
                    secureTextEntry
                  />
                </View>
              </>
            )}

            <TouchableOpacity
              style={[styles.modernButton, loading && styles.buttonDisabled]}
              onPress={isLogin ? handleLogin : handleRegister}
              disabled={loading}
            >
              <Text style={styles.modernButtonText}>
                {loading ? '⏳ Зареждане...' : (isLogin ? '🔓 Влезте' : '✨ Създайте акаунт')}
              </Text>
            </TouchableOpacity>

            {/* Remember Me & Forgot Password */}
            {isLogin && (
              <>
                <TouchableOpacity
                  style={styles.rememberRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.modernCheckbox, rememberMe && styles.modernCheckboxChecked]}>
                    {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkboxText}>Запомни ме</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.forgotPasswordBtn}
                  onPress={() => setIsForgotPassword(true)}
                >
                  <Text style={styles.forgotPasswordLink}>Забравена парола?</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.switchContainer}>
              <Text style={styles.switchText}>
                {isLogin ? 'Нямате акаунт? ' : 'Вече имате акаунт? '}
              </Text>
              <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                <Text style={styles.switchLink}>
                  {isLogin ? 'Регистрирайте се' : 'Влезте'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 72,
    height: 72,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
  },
  form: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // User Type Selection Styles
  userTypeContainer: {
    marginBottom: 24,
  },
  userTypeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  userTypeBtn: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  userTypeBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: '#818cf8',
  },
  userTypeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  userTypeBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 4,
  },
  userTypeBtnTextActive: {
    color: '#ffffff',
  },
  userTypeDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  halfWidth: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
  },
  modernInput: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    color: '#ffffff',
  },
  modernPickerWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  modernPicker: {
    height: 50,
    color: '#ffffff',
  },
  passwordHint: {
    fontSize: 12,
    color: '#818cf8',
    marginTop: 6,
    lineHeight: 16,
  },
  checkboxContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modernCheckbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  modernCheckboxChecked: {
    backgroundColor: '#818cf8',
    borderColor: '#818cf8',
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 14,
    color: '#cbd5e1',
    flex: 1,
    lineHeight: 20,
  },
  linkText: {
    color: '#818cf8',
    textDecorationLine: 'underline',
  },
  modernButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  modernButtonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  switchText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  switchLink: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '600',
  },
  // Legacy/utility styles
  buttonDisabled: {
    opacity: 0.6,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#818cf8',
    borderColor: '#818cf8',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 14,
    color: '#cbd5e1',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
    marginBottom: 8,
    marginTop: 10,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#f9f9f9',
    marginBottom: 15,
  },
  picker: {
    height: 50,
    color: '#2c3e50',
  },
  // Forgot Password styles
  loginOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  forgotPasswordBtn: {
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  forgotPasswordLink: {
    fontSize: 14,
    color: '#818cf8',
    fontWeight: '500',
    textAlign: 'center',
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#94a3b8',
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  bold: {
    fontWeight: '600',
    color: '#ffffff',
  },
});
