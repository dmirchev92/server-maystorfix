import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import ApiService from '../services/ApiService';
import LocationTrackingService from '../services/LocationTrackingService';

interface ScheduleSettings {
  schedule_enabled: boolean;
  start_time: string;
  end_time: string;
  disable_weekends: boolean;
  monday_enabled: boolean;
  tuesday_enabled: boolean;
  wednesday_enabled: boolean;
  thursday_enabled: boolean;
  friday_enabled: boolean;
  saturday_enabled: boolean;
  sunday_enabled: boolean;
}

const DEFAULT_SETTINGS: ScheduleSettings = {
  schedule_enabled: false,
  start_time: '08:00',
  end_time: '21:00',
  disable_weekends: false,
  monday_enabled: true,
  tuesday_enabled: true,
  wednesday_enabled: true,
  thursday_enabled: true,
  friday_enabled: true,
  saturday_enabled: true,
  sunday_enabled: true,
};

// Time options for picker (every 30 minutes)
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    TIME_OPTIONS.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
  }
}

const DAYS = [
  { key: 'monday_enabled', label: 'Понеделник', short: 'Пон' },
  { key: 'tuesday_enabled', label: 'Вторник', short: 'Вт' },
  { key: 'wednesday_enabled', label: 'Сряда', short: 'Ср' },
  { key: 'thursday_enabled', label: 'Четвъртък', short: 'Чет' },
  { key: 'friday_enabled', label: 'Петък', short: 'Пет' },
  { key: 'saturday_enabled', label: 'Събота', short: 'Съб' },
  { key: 'sunday_enabled', label: 'Неделя', short: 'Нед' },
];

const LocationScheduleScreen: React.FC = () => {
  const navigation = useNavigation();
  const [settings, setSettings] = useState<ScheduleSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await ApiService.getInstance().getLocationSchedule();
      if (response.success && response.data) {
        setSettings({
          ...DEFAULT_SETTINGS,
          ...response.data,
        });
      }
    } catch (error) {
      console.error('Error loading schedule settings:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на настройките');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const response = await ApiService.getInstance().updateLocationSchedule(settings);
      if (response.success) {
        Alert.alert('Успех', 'Настройките са запазени успешно');
        // Trigger schedule check to apply changes immediately
        await LocationTrackingService.getInstance().checkAndApplySchedule();
      } else {
        Alert.alert('Грешка', response.error?.message || 'Неуспешно запазване');
      }
    } catch (error) {
      console.error('Error saving schedule settings:', error);
      Alert.alert('Грешка', 'Неуспешно запазване на настройките');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof ScheduleSettings>(key: K, value: ScheduleSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const toggleDay = (dayKey: string) => {
    setSettings(prev => ({
      ...prev,
      [dayKey]: !prev[dayKey as keyof ScheduleSettings],
    }));
  };

  const formatTimeDisplay = (time: string) => {
    return time;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Зареждане...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📅 График за споделяне</Text>
          <Text style={styles.headerSubtitle}>
            Настройте автоматично включване и изключване на споделянето на локация
          </Text>
        </View>

        {/* Enable Schedule Toggle */}
        <View style={styles.section}>
          <View style={styles.mainToggleContainer}>
            <View style={styles.toggleInfo}>
              <Text style={styles.mainToggleTitle}>Активирай график</Text>
              <Text style={styles.mainToggleSubtitle}>
                {settings.schedule_enabled 
                  ? 'Локацията ще се споделя само в зададените часове'
                  : 'Локацията се споделя постоянно (когато е включена)'}
              </Text>
            </View>
            <Switch
              value={settings.schedule_enabled}
              onValueChange={(value) => updateSetting('schedule_enabled', value)}
              trackColor={{ false: '#767577', true: '#4F46E5' }}
              thumbColor={settings.schedule_enabled ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {settings.schedule_enabled && (
          <>
            {/* Time Window Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>⏰ Работно време</Text>
              <Text style={styles.sectionSubtitle}>
                Локацията ще се споделя само между тези часове
              </Text>

              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>От</Text>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => setShowStartTimePicker(!showStartTimePicker)}
                  >
                    <Text style={styles.timeButtonText}>{formatTimeDisplay(settings.start_time)}</Text>
                  </TouchableOpacity>
                </View>
                
                <Text style={styles.timeSeparator}>—</Text>
                
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>До</Text>
                  <TouchableOpacity 
                    style={styles.timeButton}
                    onPress={() => setShowEndTimePicker(!showEndTimePicker)}
                  >
                    <Text style={styles.timeButtonText}>{formatTimeDisplay(settings.end_time)}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Start Time Picker */}
              {showStartTimePicker && (
                <View style={styles.timePickerContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timePickerContent}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <TouchableOpacity
                        key={`start-${time}`}
                        style={[
                          styles.timeOption,
                          settings.start_time === time && styles.timeOptionSelected,
                        ]}
                        onPress={() => {
                          updateSetting('start_time', time);
                          setShowStartTimePicker(false);
                        }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          settings.start_time === time && styles.timeOptionTextSelected,
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* End Time Picker */}
              {showEndTimePicker && (
                <View style={styles.timePickerContainer}>
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.timePickerContent}
                  >
                    {TIME_OPTIONS.map((time) => (
                      <TouchableOpacity
                        key={`end-${time}`}
                        style={[
                          styles.timeOption,
                          settings.end_time === time && styles.timeOptionSelected,
                        ]}
                        onPress={() => {
                          updateSetting('end_time', time);
                          setShowEndTimePicker(false);
                        }}
                      >
                        <Text style={[
                          styles.timeOptionText,
                          settings.end_time === time && styles.timeOptionTextSelected,
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Weekend Toggle */}
            <View style={styles.section}>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingTitle}>🏖️ Изключи през уикенда</Text>
                  <Text style={styles.settingSubtitle}>
                    Автоматично спиране в събота и неделя
                  </Text>
                </View>
                <Switch
                  value={settings.disable_weekends}
                  onValueChange={(value) => updateSetting('disable_weekends', value)}
                  trackColor={{ false: '#767577', true: '#4F46E5' }}
                  thumbColor={settings.disable_weekends ? '#fff' : '#f4f3f4'}
                />
              </View>
            </View>

            {/* Days of Week Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📆 Работни дни</Text>
              <Text style={styles.sectionSubtitle}>
                Изберете в кои дни да се споделя локацията
              </Text>

              <View style={styles.daysGrid}>
                {DAYS.map((day) => {
                  const isEnabled = settings[day.key as keyof ScheduleSettings] as boolean;
                  const isWeekend = day.key === 'saturday_enabled' || day.key === 'sunday_enabled';
                  const isDisabledByWeekend = settings.disable_weekends && isWeekend;
                  
                  return (
                    <TouchableOpacity
                      key={day.key}
                      style={[
                        styles.dayButton,
                        isEnabled && !isDisabledByWeekend && styles.dayButtonActive,
                        isDisabledByWeekend && styles.dayButtonDisabled,
                      ]}
                      onPress={() => !isDisabledByWeekend && toggleDay(day.key)}
                      disabled={isDisabledByWeekend}
                    >
                      <Text style={[
                        styles.dayButtonText,
                        isEnabled && !isDisabledByWeekend && styles.dayButtonTextActive,
                        isDisabledByWeekend && styles.dayButtonTextDisabled,
                      ]}>
                        {day.short}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoIcon}>💡</Text>
              <Text style={styles.infoText}>
                Когато графикът е активен, локацията ви ще се споделя автоматично 
                само в зададените часове и дни. Извън тези периоди клиентите няма 
                да виждат текущата ви позиция на картата.
              </Text>
            </View>
          </>
        )}

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={saveSettings}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>💾 Запази настройките</Text>
          )}
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 16,
  },
  mainToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  mainToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  mainToggleSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeBlock: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  timeButton: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  timeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4F46E5',
  },
  timeSeparator: {
    fontSize: 20,
    color: '#9CA3AF',
    marginHorizontal: 16,
  },
  timePickerContainer: {
    marginTop: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 8,
  },
  timePickerContent: {
    paddingHorizontal: 8,
  },
  timeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  timeOptionSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  timeOptionText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  timeOptionTextSelected: {
    color: '#fff',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayButton: {
    width: '13%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayButtonActive: {
    backgroundColor: '#4F46E5',
  },
  dayButtonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.5,
  },
  dayButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  dayButtonTextActive: {
    color: '#fff',
  },
  dayButtonTextDisabled: {
    color: '#9CA3AF',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 20,
  },
  saveButton: {
    backgroundColor: '#4F46E5',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
});

export default LocationScheduleScreen;
