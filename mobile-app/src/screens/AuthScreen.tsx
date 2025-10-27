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
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
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
        // Fallback categories
        setServiceCategories([
          { id: 'electrician', name: 'Електротехник' },
          { id: 'plumber', name: 'Водопроводчик' },
          { id: 'painter', name: 'Бояджия' },
          { id: 'carpenter', name: 'Дърводелец' },
          { id: 'locksmith', name: 'Ключар' },
          { id: 'cleaner', name: 'Почистване' },
          { id: 'handyman', name: 'Майстор за всичко' },
          { id: 'general', name: 'Общи услуги' }
        ]);
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

  const handleRegister = async () => {
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.firstName || !formData.lastName || !formData.phoneNumber || !formData.companyName || !formData.serviceCategory) {
      Alert.alert('Грешка', 'Моля попълнете всички полета');
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
      const response = await ApiService.getInstance().register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phoneNumber: formData.phoneNumber,
        serviceCategory: formData.serviceCategory,
        companyName: formData.companyName,
        role: 'tradesperson',
        gdprConsents: ['essential_service'],
      });

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

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>💻</Text>
          </View>
          <Text style={styles.title}>
            {isLogin ? 'Влезте в ServiceText Pro' : 'Създайте ServiceText Pro акаунт'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Добре дошли отново!' : 'Започнете пътуването си с нас днес.'}
          </Text>
        </View>

        <View style={styles.form}>
          {!isLogin && (
            <>
              <View style={styles.row}>
                <View style={styles.halfWidth}>
                  <Text style={styles.fieldLabel}>Име</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Иван"
                    placeholderTextColor="#9CA3AF"
                    value={formData.firstName}
                    onChangeText={(value) => handleInputChange('firstName', value)}
                    autoCapitalize="words"
                  />
                </View>
                <View style={styles.halfWidth}>
                  <Text style={styles.fieldLabel}>Фамилия</Text>
                  <TextInput
                    style={styles.modernInput}
                    placeholder="Петров"
                    placeholderTextColor="#9CA3AF"
                    value={formData.lastName}
                    onChangeText={(value) => handleInputChange('lastName', value)}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Имейл адрес</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="ivan@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={formData.email}
                  onChangeText={(value) => handleInputChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Име на компанията</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="Вашата компания ООД"
                  placeholderTextColor="#9CA3AF"
                  value={formData.companyName}
                  onChangeText={(value) => handleInputChange('companyName', value)}
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Телефон</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="+359xxxxxxxxx"
                  placeholderTextColor="#9CA3AF"
                  value={formData.phoneNumber}
                  onChangeText={(value) => handleInputChange('phoneNumber', value)}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Индустрия</Text>
                <View style={styles.modernPickerWrapper}>
                  <Picker
                    selectedValue={formData.serviceCategory}
                    onValueChange={(value) => handleInputChange('serviceCategory', value)}
                    style={styles.modernPicker}
                  >
                    <Picker.Item label="Изберете вашата индустрия" value="" />
                    {serviceCategories.map((category) => (
                      <Picker.Item
                        key={category.id}
                        label={category.name}
                        value={category.id}
                      />
                    ))}
                  </Picker>
                </View>
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Парола</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
                  value={formData.password}
                  onChangeText={(value) => handleInputChange('password', value)}
                  secureTextEntry
                  onFocus={() => setShowPasswordHint(true)}
                  onBlur={() => setShowPasswordHint(false)}
                />
                {showPasswordHint && (
                  <Text style={styles.passwordHint}>
                    Паролата трябва да съдържа поне 8 символа, главна буква, малка буква, цифра и специален символ
                  </Text>
                )}
              </View>

              <View style={styles.fieldContainer}>
                <Text style={styles.fieldLabel}>Потвърдете паролата</Text>
                <TextInput
                  style={styles.modernInput}
                  placeholder="••••••••"
                  placeholderTextColor="#9CA3AF"
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
                  placeholderTextColor="#9CA3AF"
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
                  placeholderTextColor="#9CA3AF"
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
              👤 {loading ? 'Зареждане...' : (isLogin ? 'Влезте' : 'Създайте акаунт')}
            </Text>
          </TouchableOpacity>

          {/* Remember Me */}
          {isLogin && (
            <TouchableOpacity
              style={styles.rememberRow}
              onPress={() => setRememberMe(!rememberMe)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={styles.rememberText}>Запомни ме</Text>
            </TouchableOpacity>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    width: 64,
    height: 64,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  halfWidth: {
    flex: 0.48,
  },
  fieldContainer: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  modernInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    color: '#111827',
  },
  modernPickerWrapper: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  modernPicker: {
    height: 48,
    color: '#111827',
  },
  passwordHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 3,
    marginRight: 8,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  modernCheckboxChecked: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 14,
    color: '#6B7280',
    flex: 1,
    lineHeight: 20,
  },
  linkText: {
    color: '#6366F1',
    textDecorationLine: 'underline',
  },
  modernButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  modernButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
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
    color: '#6B7280',
  },
  switchLink: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  // Legacy styles for compatibility
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  button: {
    backgroundColor: '#3498db',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#bdc3c7',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    color: '#3498db',
    fontSize: 16,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: 3,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3498db',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  rememberText: {
    fontSize: 16,
    color: '#2c3e50',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
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
});
