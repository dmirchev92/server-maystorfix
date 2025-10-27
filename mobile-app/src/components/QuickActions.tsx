import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { setCurrentMode } from '../store/slices/appSlice';

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  action: () => void;
  badge?: number;
  disabled?: boolean;
}

interface QuickActionsProps {
  onNavigateToChat: () => void;
  onNavigateToContacts: () => void;
  onNavigateToSettings: () => void;
}

const QuickActions: React.FC<QuickActionsProps> = ({
  onNavigateToChat,
  onNavigateToContacts,
  onNavigateToSettings,
}) => {
  const dispatch = useDispatch();
  const { currentMode, businessHours } = useSelector((state: RootState) => state.app);
  const { calls } = useSelector((state: RootState) => state.calls);

  const handleModeChange = (mode: string) => {
    Alert.alert(
      'Промяна на режим',
      `Искате ли да преминете в режим "${getModeLabel(mode)}"?`,
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Промени',
          onPress: () => {
            dispatch(setCurrentMode(mode as any));
            Alert.alert('Успешно', `Режимът е променен на "${getModeLabel(mode)}"`);
          },
        },
      ]
    );
  };

  const getModeLabel = (mode: string): string => {
    const labels = {
      normal: 'Нормален',
      job_site: 'На обект',
      vacation: 'Ваканция',
      emergency_only: 'Само спешни',
    };
    return labels[mode as keyof typeof labels] || mode;
  };

  const getCurrentModeColor = (): string => {
    const colors = {
      normal: '#27ae60',
      job_site: '#f39c12',
      vacation: '#3498db',
      emergency_only: '#e74c3c',
    };
    return colors[currentMode as keyof typeof colors] || '#27ae60';
  };

  const handleEmergencyMode = () => {
    Alert.alert(
      '🚨 Спешен режим',
      'В спешния режим ще получавате известия само за спешни обаждания и AI ще отговаря автоматично на всички останали.',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: 'Активирай',
          style: 'destructive',
          onPress: () => {
            dispatch(setCurrentMode('emergency_only'));
            Alert.alert('Активиран', 'Спешният режим е активиран!');
          },
        },
      ]
    );
  };

  const handleBusinessHoursToggle = () => {
    Alert.alert(
      'Работно време',
      businessHours.isActive 
        ? 'Искате ли да деактивирате работното време?' 
        : 'Искате ли да активирате работното време?',
      [
        { text: 'Отказ', style: 'cancel' },
        {
          text: businessHours.isActive ? 'Деактивирай' : 'Активирай',
          onPress: () => {
            // TODO: Toggle business hours
            Alert.alert(
              'Успешно', 
              `Работното време е ${businessHours.isActive ? 'деактивирано' : 'активирано'}!`
            );
          },
        },
      ]
    );
  };

  const quickActions: QuickAction[] = [
    {
      id: 'chat',
      title: '💬 Разговори',
      description: 'Прегледай AI разговори и поеми чатове',
      icon: '💬',
      color: '#3498db',
      action: onNavigateToChat,
      badge: calls.length > 0 ? calls.length : undefined,
    },
    {
      id: 'contacts',
      title: '👥 Контакти',
      description: 'Управлявай клиентски контакти',
      icon: '👥',
      color: '#27ae60',
      action: onNavigateToContacts,
    },
    {
      id: 'mode_normal',
      title: '✅ Нормален режим',
      description: 'Стандартен режим на работа',
      icon: '✅',
      color: '#27ae60',
      action: () => handleModeChange('normal'),
      disabled: currentMode === 'normal',
    },
    {
      id: 'mode_job_site',
      title: '🏗️ На обект',
      description: 'Режим за работа на обект',
      icon: '🏗️',
      color: '#f39c12',
      action: () => handleModeChange('job_site'),
      disabled: currentMode === 'job_site',
    },
    {
      id: 'mode_vacation',
      title: '🏖️ Ваканция',
      description: 'Режим за ваканция',
      icon: '🏖️',
      color: '#3498db',
      action: () => handleModeChange('vacation'),
      disabled: currentMode === 'vacation',
    },
    {
      id: 'emergency_mode',
      title: '🚨 Спешен режим',
      description: 'Само за спешни обаждания',
      icon: '🚨',
      color: '#e74c3c',
      action: handleEmergencyMode,
      disabled: currentMode === 'emergency_only',
    },
    {
      id: 'business_hours',
      title: businessHours.isActive ? '🕐 Работно време' : '⏰ Извън работно време',
      description: businessHours.isActive 
        ? 'Активно работно време' 
        : 'Неактивно работно време',
      icon: businessHours.isActive ? '🕐' : '⏰',
      color: businessHours.isActive ? '#27ae60' : '#95a5a6',
      action: handleBusinessHoursToggle,
    },
    {
      id: 'settings',
      title: '⚙️ Настройки',
      description: 'Конфигурирай приложението',
      icon: '⚙️',
      color: '#7f8c8d',
      action: onNavigateToSettings,
    },

  ];

  const renderQuickAction = (action: QuickAction) => (
    <TouchableOpacity
      key={action.id}
      style={[
        styles.actionCard,
        { borderLeftColor: action.color },
        action.disabled && styles.actionCardDisabled,
      ]}
      onPress={action.action}
      disabled={action.disabled}
    >
      <View style={styles.actionHeader}>
        <Text style={styles.actionIcon}>{action.icon}</Text>
        <View style={styles.actionInfo}>
          <Text style={[
            styles.actionTitle,
            action.disabled && styles.actionTitleDisabled
          ]}>
            {action.title}
          </Text>
          <Text style={[
            styles.actionDescription,
            action.disabled && styles.actionDescriptionDisabled
          ]}>
            {action.description}
          </Text>
        </View>
        {action.badge && action.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {action.badge > 99 ? '99+' : action.badge}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚡ Бързи действия</Text>
        <Text style={styles.subtitle}>
          Бърз достъп до основните функции
        </Text>
      </View>

      <View style={styles.currentModeCard}>
        <Text style={styles.currentModeTitle}>Текущ режим:</Text>
        <View style={styles.currentModeInfo}>
          <View style={[styles.modeIndicator, { backgroundColor: getCurrentModeColor() }]}>
            <Text style={styles.modeIndicatorText}>
              {getModeLabel(currentMode)}
            </Text>
          </View>
          <Text style={styles.currentModeDescription}>
            {currentMode === 'normal' && 'Стандартен режим на работа'}
            {currentMode === 'job_site' && 'Работа на обект - ограничени уведомления'}
            {currentMode === 'vacation' && 'Ваканция - минимални уведомления'}
            {currentMode === 'emergency_only' && 'Само спешни обаждания'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.actionsContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.actionsGrid}>
          {quickActions.map(renderQuickAction)}
        </View>
      </ScrollView>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>💡 Съвети</Text>
        <Text style={styles.infoText}>
          • Използвайте "На обект" режима, когато работите на строителна площадка
        </Text>
        <Text style={styles.infoText}>
          • "Ваканция" режимът намалява уведомленията до минимум
        </Text>
        <Text style={styles.infoText}>
          • "Спешен режим" е за ситуации, когато можете да отговаряте само на спешни случаи
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    lineHeight: 22,
  },
  currentModeCard: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3498db',
  },
  currentModeTitle: {
    fontSize: 14,
    color: '#7f8c8d',
    marginBottom: 8,
  },
  currentModeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 12,
  },
  modeIndicatorText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  currentModeDescription: {
    fontSize: 14,
    color: '#2c3e50',
    flex: 1,
    lineHeight: 20,
  },
  actionsContainer: {
    flex: 1,
  },
  actionsGrid: {
    padding: 20,
  },
  actionCard: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  actionTitleDisabled: {
    color: '#95a5a6',
  },
  actionDescription: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 18,
  },
  actionDescriptionDisabled: {
    color: '#bdc3c7',
  },
  badge: {
    backgroundColor: '#e74c3c',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#f39c12',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 8,
  },
});

export default QuickActions;
