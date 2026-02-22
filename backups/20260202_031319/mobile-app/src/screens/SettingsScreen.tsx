import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '../navigation/types';
import { AuthBus } from '../utils/AuthBus';
import ApiService from '../services/ApiService';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SettingsScreenNavigationProp = BottomTabNavigationProp<MainTabParamList, 'Settings'>;

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<SettingsScreenNavigationProp>();
  const [userRole, setUserRole] = useState<string>('customer');

  useEffect(() => {
    const loadUserRole = async () => {
      try {
        // Fetch user role from API
        const response = await ApiService.getInstance().getCurrentUser();
        if (response.success && response.data) {
          const rawData: any = response.data;
          const userData: any = rawData.user || rawData;
          const role = userData.role || userData.user_role || 'customer';
          setUserRole(role);
        }
      } catch (error) {
        console.error('Error loading user role:', error);
      }
    };
    loadUserRole();
  }, []);

  const isProvider = userRole === 'provider';

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const handleChangePassword = () => {
    navigation.navigate('ChangePassword');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Изход',
      'Сигурни ли сте, че искате да излезете?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Изход',
          style: 'destructive',
          onPress: async () => {
            try {
              // Use ApiService to logout - this clears in-memory token and storage
              await ApiService.getInstance().logout();
              
              // Emit logout event to trigger app-wide logout (App.tsx listener)
              AuthBus.emit('logout');
              
              // Show success message
              // Alert.alert('Успех', 'Излязохте успешно от профила си'); 
            } catch (error) {
              console.error('Error logging out:', error);
              // Force logout locally even if API fails
              AuthBus.emit('logout');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Настройки</Text>
          <Text style={styles.headerSubtitle}>Управлявайте вашия профил и настройки</Text>
        </View>

        {/* Settings Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Профил</Text>
          <TouchableOpacity style={styles.settingItem} onPress={handleEditProfile}>
            <Text style={styles.settingItemText}>Редактирай профил</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={handleChangePassword}>
            <Text style={styles.settingItemText}>Смени парола</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {isProvider && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💳 Абонамент</Text>
            <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Subscription')}>
              <Text style={styles.settingItemText}>Абонаментни планове</Text>
              <Text style={styles.settingItemArrow}>›</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔔 Известия</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('NotificationSettings')}>
            <Text style={styles.settingItemText}>Настройки за известия</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔒 Поверителност и GDPR</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => navigation.navigate('Consent')}>
            <Text style={styles.settingItemText}>Настройки за поверителност</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://snapfix.bg/privacy-policy')}>
            <Text style={styles.settingItemText}>Политика за поверителност</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://snapfix.bg/terms')}>
            <Text style={styles.settingItemText}>Общи условия</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => {
            Alert.alert(
              'Вашите права по GDPR',
              '✓ Достъп до данните си\n✓ Коригиране на неточни данни\n✓ Изтриване на данни\n✓ Преносимост на данните\n✓ Оттегляне на съгласие\n\nКонтакт: admin@snapfix.bg',
              [
                { text: 'Изпрати имейл', onPress: () => Linking.openURL('mailto:admin@snapfix.bg') },
                { text: 'OK' }
              ]
            );
          }}>
            <Text style={styles.settingItemText}>Права по GDPR</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ℹ️ Информация</Text>
          <TouchableOpacity style={styles.settingItem} onPress={() => {
            Alert.alert(
              'SnapFix',
              'Версия: 1.0.0\n\nПлатформа за свързване на клиенти с майстори в България.\n\n📧 Контакт: admin@snapfix.bg\n🌐 Уебсайт: snapfix.bg\n\n© 2025 SnapFix. Всички права запазени.',
              [
                { text: 'Уебсайт', onPress: () => Linking.openURL('https://snapfix.bg') },
                { text: 'Затвори' }
              ]
            );
          }}>
            <Text style={styles.settingItemText}>За приложението</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('mailto:support@snapfix.bg')}>
            <Text style={styles.settingItemText}>Свържи се с нас</Text>
            <Text style={styles.settingItemArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>🚪 Изход</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A', // Dark slate background matching web
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)', // Glass-morphism effect
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#CBD5E1',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.1)', // Glass-morphism
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  settingItemText: {
    fontSize: 16,
    color: '#CBD5E1',
  },
  settingItemArrow: {
    fontSize: 18,
    color: '#94A3B8',
  },
  logoutButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SettingsScreen;
