import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import SocketIOService from '../services/SocketIOService';

interface NotificationPreferences {
  // Push notifications
  push_enabled: boolean;
  push_new_cases: boolean;
  push_chat_messages: boolean;
  push_bid_won: boolean;
  push_new_bids: boolean;
  push_reviews: boolean;
  push_points_subscription: boolean;
  // Email notifications
  email_enabled: boolean;
  email_weekly_report: boolean;
  email_new_cases: boolean;
  email_bid_won: boolean;
  email_reviews: boolean;
  email_marketing: boolean;
}

const defaultPreferences: NotificationPreferences = {
  push_enabled: true,
  push_new_cases: true,
  push_chat_messages: true,
  push_bid_won: true,
  push_new_bids: true,
  push_reviews: true,
  push_points_subscription: true,
  email_enabled: true,
  email_weekly_report: true,
  email_new_cases: false,
  email_bid_won: true,
  email_reviews: true,
  email_marketing: false,
};

const NotificationSettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  const isCustomer = userRole === 'customer';
  const isProvider = userRole === 'tradesperson' || userRole === 'service_provider';

  const fetchUserAndPreferences = useCallback(async () => {
    try {
      // Fetch user info to determine role
      const userResponse = await ApiService.getInstance().get('/auth/me');
      if (userResponse.success && userResponse.data?.user) {
        setUserRole(userResponse.data.user.role);
      }

      // Fetch notification preferences
      const response = await ApiService.getInstance().get('/notification-preferences');
      if (response.success && response.data) {
        setPreferences(response.data);
      }
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на настройките');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUserAndPreferences();
  }, [fetchUserAndPreferences]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUserAndPreferences();
  }, [fetchUserAndPreferences]);

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    // Optimistic update
    const oldPreferences = { ...preferences };
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      setSaving(true);
      const response = await ApiService.getInstance().put('/notification-preferences', {
        [key]: value,
      });
      
      if (!response.success) {
        // Revert on failure
        setPreferences(oldPreferences);
        Alert.alert('Грешка', 'Неуспешно запазване на настройките');
      } else {
        // Refresh SocketIOService preferences cache so changes take effect immediately
        SocketIOService.getInstance().refreshNotificationPreferences();
      }
    } catch (error) {
      console.error('Error updating notification preference:', error);
      setPreferences(oldPreferences);
      Alert.alert('Грешка', 'Неуспешно запазване на настройките');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    Alert.alert(
      'Възстановяване',
      'Сигурни ли сте, че искате да възстановите настройките по подразбиране?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Да',
          onPress: async () => {
            try {
              setSaving(true);
              const response = await ApiService.getInstance().post('/notification-preferences/reset');
              if (response.success && response.data) {
                setPreferences(response.data);
                Alert.alert('Успех', 'Настройките са възстановени');
              }
            } catch (error) {
              console.error('Error resetting preferences:', error);
              Alert.alert('Грешка', 'Неуспешно възстановяване');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderSwitch = (
    label: string,
    description: string,
    key: keyof NotificationPreferences,
    disabled: boolean = false
  ) => (
    <View style={[styles.settingRow, disabled && styles.settingRowDisabled]}>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, disabled && styles.settingLabelDisabled]}>
          {label}
        </Text>
        <Text style={[styles.settingDescription, disabled && styles.settingDescriptionDisabled]}>
          {description}
        </Text>
      </View>
      <Switch
        value={preferences[key]}
        onValueChange={(value) => updatePreference(key, value)}
        disabled={disabled || saving}
        trackColor={{ false: '#374151', true: '#10B981' }}
        thumbColor={preferences[key] ? '#FFFFFF' : '#9CA3AF'}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.loadingText}>Зареждане...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10B981"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔔 Настройки за известия</Text>
          <Text style={styles.headerSubtitle}>
            Изберете кои известия искате да получавате
          </Text>
        </View>

        {/* Push Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📱 Push известия</Text>
            <Switch
              value={preferences.push_enabled}
              onValueChange={(value) => updatePreference('push_enabled', value)}
              disabled={saving}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor={preferences.push_enabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
          
          {preferences.push_enabled && (
            <View style={styles.sectionContent}>
              {/* Chat messages - available for both users */}
              {renderSwitch(
                'Съобщения в чата',
                isCustomer ? 'Известие при нови съобщения от майстори' : 'Известие при нови съобщения от клиенти',
                'push_chat_messages'
              )}
              
              {/* Нови оферти - ONLY for customers */}
              {isCustomer && renderSwitch(
                'Нови оферти',
                'Известие когато някой направи оферта за вашата заявка',
                'push_new_bids'
              )}
              
              {/* Provider-only options */}
              {isProvider && (
                <>
                  {renderSwitch(
                    'Нови заявки',
                    'Известие при нови заявки, съответстващи на услугите ви',
                    'push_new_cases'
                  )}
                  {renderSwitch(
                    'Спечелени оферти',
                    'Известие когато спечелите оферта',
                    'push_bid_won'
                  )}
                  {renderSwitch(
                    'Оценки и отзиви',
                    'Известие при нова оценка от клиент',
                    'push_reviews'
                  )}
                  {renderSwitch(
                    'Точки и абонамент',
                    'Напомняния за точки и абонамент',
                    'push_points_subscription'
                  )}
                </>
              )}
            </View>
          )}
          
          {!preferences.push_enabled && (
            <Text style={styles.disabledNote}>
              Push известията са изключени. Включете ги, за да персонализирате настройките.
            </Text>
          )}
        </View>

        {/* Email Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>📧 Email известия</Text>
            <Switch
              value={preferences.email_enabled}
              onValueChange={(value) => updatePreference('email_enabled', value)}
              disabled={saving}
              trackColor={{ false: '#374151', true: '#10B981' }}
              thumbColor={preferences.email_enabled ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
          
          {preferences.email_enabled && (
            <View style={styles.sectionContent}>
              {/* Only Marketing emails for both user types */}
              {renderSwitch(
                'Маркетинг и новини',
                'Промоции, съвети и новини от MaystorFix',
                'email_marketing'
              )}
            </View>
          )}
          
          {!preferences.email_enabled && (
            <Text style={styles.disabledNote}>
              Email известията са изключени. Включете ги, за да персонализирате настройките.
            </Text>
          )}
        </View>

        {/* Reset Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={resetToDefaults}
            disabled={saving}
          >
            <Text style={styles.resetButtonText}>
              🔄 Възстанови по подразбиране
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {isCustomer 
              ? '💡 Съвет: Препоръчваме да оставите включени известията за нови оферти и съобщения в чата, за да не пропускате отговори от майстори.'
              : '💡 Съвет: Препоръчваме да оставите включени известията за нови заявки и съобщения в чата, за да не пропускате възможности.'
            }
          </Text>
        </View>
      </ScrollView>

      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color="#10B981" />
          <Text style={styles.savingText}>Запазване...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#CBD5E1',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    fontSize: 14,
    color: '#CBD5E1',
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  sectionContent: {
    marginTop: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingRowDisabled: {
    opacity: 0.5,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  settingLabelDisabled: {
    color: '#6B7280',
  },
  settingDescription: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  settingDescriptionDisabled: {
    color: '#4B5563',
  },
  disabledNote: {
    color: '#9CA3AF',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetButtonText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '500',
  },
  infoSection: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 24,
    padding: 16,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  infoText: {
    color: '#10B981',
    fontSize: 13,
    lineHeight: 20,
  },
  savingOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  savingText: {
    color: '#10B981',
    marginLeft: 8,
    fontSize: 14,
  },
});

export default NotificationSettingsScreen;
