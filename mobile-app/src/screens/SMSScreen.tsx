import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { SMSService } from '../services/SMSService';
import { ApiService } from '../services/ApiService';
import { SocketIOService } from '../services/SocketIOService';
import theme from '../styles/theme';

interface SMSStats {
  isEnabled: boolean;
  sentCount: number;
  lastSentTime?: number;
  message: string;
  processedCalls: number;
  filterKnownContacts: boolean;
}

function SMSScreen() {
  const [smsStats, setSmsStats] = useState<SMSStats>({
    isEnabled: false,
    sentCount: 0,
    message: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
    processedCalls: 0,
    filterKnownContacts: true,
  });
  const [messageText, setMessageText] = useState('');
  const [displayText, setDisplayText] = useState(''); // For showing template with actual link
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<any>(null);

  const smsService = SMSService.getInstance();
  const socketService = SocketIOService.getInstance();

  useEffect(() => {
    loadSMSData();
    
    // Set up Socket.IO listener for real-time SMS config updates
    const handleSMSConfigUpdate = async (data: any) => {
      console.log('🔔 Received SMS config update via Socket.IO:', data);
      
      // Refresh config from API to get latest state
      await smsService.refreshConfigFromAPI();
      const stats = smsService.getStats();
      
      console.log('✅ SMS config updated in real-time:', stats);
      setSmsStats(stats);
      
      // Also refresh the message with current link
      const messageWithLink = await smsService.getMessageWithCurrentLink();
      setDisplayText(messageWithLink);
    };
    
    socketService.onSMSConfigUpdate(handleSMSConfigUpdate);
    console.log('👂 Socket.IO listener registered for SMS config updates');
    
    // Set up auto-refresh every 30 seconds to sync with marketplace (fallback)
    const interval = setInterval(async () => {
      console.log('🔄 Auto-syncing SMS config from backend...');
      try {
        // Refresh config from API to sync with marketplace changes
        await smsService.refreshConfigFromAPI();
        const config = smsService.getConfig();
        const stats = smsService.getStats();
        
        console.log('📊 Auto-sync - Old state:', smsStats.isEnabled);
        console.log('📊 Auto-sync - New state:', stats.isEnabled);
        
        setSmsStats(stats);
        
        // Also refresh the message with current link
        const messageWithLink = await smsService.getMessageWithCurrentLink();
        setDisplayText(messageWithLink);
        
        console.log('✅ Auto-sync complete, state updated');
      } catch (error) {
        console.log('⚠️ Auto-sync failed:', error);
      }
    }, 30000); // 30 seconds
    
    setAutoRefreshInterval(interval);
    
    // Cleanup interval on unmount
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []);
  
  // Cleanup interval when component unmounts
  useEffect(() => {
    return () => {
      if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
      }
    };
  }, [autoRefreshInterval]);

  const loadSMSData = async () => {
    try {
      console.log('📊 Loading SMS data...');
      
      // Reset template to Latin version (this is fast)
      await smsService.resetMessageTemplate();
      
      // Refresh config from API to sync with web app
      console.log('🔄 Refreshing config from backend API...');
      await smsService.refreshConfigFromAPI();
      
      // Get config after refresh
      const config = smsService.getConfig();
      const stats = smsService.getStats();
      const perms = await smsService.checkPermissions();
      
      console.log('📊 SMS config loaded (synced with backend):', config);
      
      setSmsStats(stats);
      setMessageText(config.message); // Template with [chat_link] placeholder for editing
      
      // Refresh token from backend first (this ensures we get the latest token)
      console.log('🔄 Refreshing chat link from backend...');
      const currentLink = await smsService.getCurrentChatLink();
      console.log('📱 Current chat link from backend:', currentLink);
      
      // If no chat link exists, try to generate one automatically
      if (currentLink === 'Generating chat link...' || currentLink === 'No link available') {
        console.log('🔄 No chat link found, attempting automatic generation...');
        setIsGeneratingLink(true);
        
        // Try to generate chat link in background (with timeout)
        setTimeout(async () => {
          try {
            await smsService.initializeChatLink();
            // Refresh display after successful generation
            const newLink = await smsService.getCurrentChatLink();
            const newMessageWithLink = await smsService.getMessageWithCurrentLink();
            setDisplayText(newMessageWithLink);
            setIsGeneratingLink(false);
            console.log('✅ Chat link generated automatically:', newLink);
          } catch (error) {
            console.log('⚠️ Automatic chat link generation failed:', error);
            setIsGeneratingLink(false);
            // Show fallback message
            setDisplayText(config.message.replace('[chat_link]', 'Chat link generation failed'));
          }
        }, 1000); // Wait 1 second before attempting generation
      }
      
      const messageWithLink = await smsService.getMessageWithCurrentLink();
      console.log('📱 Message with current link:', messageWithLink);
      
      setDisplayText(messageWithLink);
      setPermissions(perms);
      
      console.log('✅ SMS data loaded successfully');
    } catch (error) {
      console.error('❌ Error loading SMS data:', error);
    }
  };

  const handleRefresh = async () => {
    console.log('🔄 SMSScreen - Manual refresh triggered');
    setIsRefreshing(true);
    await loadSMSData();
    console.log('✅ SMSScreen - Manual refresh completed');
    setIsRefreshing(false);
  };

  const handleToggleSMS = async () => {
    try {
      const newEnabled = await smsService.toggleEnabled();
      if (newEnabled) {
        Alert.alert(
          'SMS Включени! 📱',
          'Автоматични SMS ще се изпращат при пропуснати повиквания.\n\nТествайте с пропуснато повикване!',
          [{ text: 'Добре' }]
        );
      } else {
        Alert.alert('SMS Изключени', 'Автоматичното изпращане на SMS е изключено.');
      }
      await loadSMSData();
    } catch (error) {
      console.error('Error toggling SMS:', error);
      Alert.alert('Грешка', 'Неуспешна промяна на SMS настройките');
    }
  };

  const handleToggleContactFiltering = async () => {
    try {
      console.log('Current filterKnownContacts:', smsStats.filterKnownContacts);
      
      // Handle undefined case - default to false (include contacts)
      const currentFiltering = smsStats.filterKnownContacts ?? false;
      
      // Toggle the filtering state
      const newFiltering = !currentFiltering;
      console.log('New filtering state:', newFiltering);
      
      // If enabling filtering, request contacts permission
      if (newFiltering) {
        const { ContactService } = await import('../services/ContactService');
        const contactService = ContactService.getInstance();
        const hasPermission = await contactService.requestContactsPermission();
        
        if (!hasPermission) {
          Alert.alert(
            'Изисква се разрешение',
            'Филтрирането на контакти изисква достъп до контактите. Моля, разрешете достъпа.',
            [{ text: 'Добре' }]
          );
          return;
        }
      }
      
      // Update the SMS service config directly
      await smsService.updateConfig({ filterKnownContacts: newFiltering });
      
      if (newFiltering) {
        Alert.alert(
          'Филтрирането на контакти е включено! 📞',
          'SMS ще се изпращат само до непознати номера.\n\nТова предотвратява пращането на SMS до близки.',
          [{ text: 'Добре' }]
        );
      } else {
        Alert.alert(
          'Филтрирането на контакти е изключено',
          'SMS ще се изпращат до всички пропуснати повиквания, включително контакти.',
          [{ text: 'Добре' }]
        );
      }
      
      // Update local state
      setSmsStats(prev => ({ ...prev, filterKnownContacts: newFiltering }));
      
    } catch (error) {
      console.error('Error toggling contact filtering:', error);
      Alert.alert('Грешка', 'Неуспешна промяна на филтрирането');
    }
  };

  const formatLastSent = (timestamp?: number) => {
    if (!timestamp) return 'Никога';
    const date = new Date(timestamp);
    return date.toLocaleString('bg-BG');
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>SMS Настройки</Text>
        <Text style={styles.subtitle}>Автоматични SMS при пропуснати повиквания</Text>
      </View>

      {/* Automation Settings Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>Настройки за автоматизация</Text>
        </View>

        {/* Enable/Disable Switch */}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Включи автоматични SMS</Text>
          <Switch
            value={smsStats.isEnabled}
            onValueChange={handleToggleSMS}
            trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
            thumbColor={smsStats.isEnabled ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Изпратени съобщения:</Text>
          <Text style={styles.statusValue}>{smsStats.sentCount}</Text>
        </View>

        <View style={styles.divider} />

        {/* Contact Filtering Section */}
        <View style={styles.statusRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.filterTitle}>Филтриране на контакти</Text>
            <Text style={styles.filterSubtitle}>
              Изберете дали да пращате SMS на хора от контактите си
            </Text>
          </View>
          <Switch
            value={smsStats.filterKnownContacts ?? false}
            onValueChange={handleToggleContactFiltering}
            trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
            thumbColor={(smsStats.filterKnownContacts ?? false) ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>
        
        <Text style={styles.filterDescription}>
          {(smsStats.filterKnownContacts ?? false)
            ? '✅ Филтърът е ВКЛЮЧЕН: SMS ще се изпращат само до непознати номера (не на семейство/приятели)'
            : '🚫 Филтърът е ИЗКЛЮЧЕН: SMS ще се изпращат до ВСИЧКИ пропуснати повиквания (вкл. семейство и приятели)'
          }
        </Text>
      </View>

      {/* Message Configuration */}
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>Шаблон за SMS съобщение</Text>
        <Text style={styles.messageSubtitle}>
          Този шаблон ще се изпраща при пропуснато повикване. Използвайте [chat_link] за автоматичния линк за чат.
        </Text>
        
        <View style={[styles.statusRow, { marginBottom: 10, padding: 10, backgroundColor: '#f0f8ff', borderRadius: 8 }]}>
          <Text style={[styles.statusLabel, { fontWeight: 'bold' }]}>Текущ линк за чат:</Text>
          <Text style={[styles.statusValue, { fontSize: 12, color: smsService.getCurrentChatLinkSync().includes('http') ? '#0066cc' : isGeneratingLink ? '#999' : '#ff6b35' }]} numberOfLines={1}>
            {isGeneratingLink ? '🔄 Генериране на линк...' : smsService.getCurrentChatLinkSync()}
          </Text>
        </View>
        
        <TextInput
          style={styles.messageInput}
          value={messageText}
          onChangeText={(text) => {
            setMessageText(text);
            // Update preview in real-time
            const currentLink = smsService.getCurrentChatLinkSync();
            setDisplayText(text.replace('[chat_link]', currentLink));
          }}
          placeholder="Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n"
          placeholderTextColor="#999999"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
        
        <Text style={[styles.messageSubtitle, { fontSize: 12, marginTop: 8, fontStyle: 'italic' }]}>
          💡 Съвет: Използвайте [chat_link] там, където искате да се покаже линкът. Той се обновява автоматично при ползване.
        </Text>
        
        {/* SMS Preview */}
        <View style={{ marginTop: 15, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#007bff' }}>
          <Text style={[styles.statusLabel, { fontSize: 14, fontWeight: 'bold', marginBottom: 8 }]}>📱 Преглед на SMS:</Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: '#333' }}>
            {displayText || 'Зареждане на преглед...'}
          </Text>
          <Text style={[styles.messageSubtitle, { fontSize: 11, marginTop: 5, fontStyle: 'italic' }]}>
            Това ще получат клиентите
          </Text>
        </View>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Как работи:</Text>
        <Text style={styles.infoText}>
          1. Включете автоматичните SMS отгоре{'\n'}
          2. Включете филтрирането на контакти, за да избегнете SMS до близки{'\n'}
          3. Разрешете достъп до контактите, когато бъде поискан{'\n'}
          4. Само НОВИ пропуснати повиквания получават SMS{'\n'}
          5. Всяко повикване получава само 1 SMS (без дубликати)
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900
  },
  header: {
    backgroundColor: '#1e293b', // slate-800
    padding: theme.spacing.lg,
    paddingTop: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  title: {
    color: '#cbd5e1', // slate-300
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
  },
  subtitle: {
    color: '#94a3b8', // slate-400
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.xs,
  },
  statusCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statusTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.bold,
    color: '#cbd5e1', // slate-300
  },
  statusIndicator: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.full,
  },
  statusActive: {
    backgroundColor: '#4ade80', // green-400
  },
  statusInactive: {
    backgroundColor: '#ef4444', // red-500
  },
  statusText: {
    color: '#ffffff',
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    marginVertical: theme.spacing.md,
  },
  statusLabel: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
  },
  statusValue: {
    fontSize: theme.fontSize.sm,
    color: '#cbd5e1', // slate-300
    fontWeight: theme.fontWeight.medium,
  },
  toggleCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleHeader: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
  },
  toggleSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginTop: theme.spacing.xs,
  },
  filterCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  filterTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  filterSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  checkboxContainer: {
    marginBottom: theme.spacing.md,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#6366f1', // indigo-500
    borderColor: '#6366f1',
  },
  checkboxUnchecked: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  checkmark: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: theme.fontWeight.bold,
  },
  checkboxText: {
    fontSize: theme.fontSize.md,
    color: '#cbd5e1', // slate-300
    fontWeight: theme.fontWeight.medium,
    flex: 1,
  },
  filterDescription: {
    fontSize: theme.fontSize.sm,
    color: '#4ade80', // green-400
    backgroundColor: 'rgba(34, 197, 94, 0.15)', // green-500/15
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: '#4ade80', // green-400
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500
  },
  messageTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  messageSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.md,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: theme.fontSize.md,
    minHeight: 80,
    marginBottom: theme.spacing.md,
    color: '#cbd5e1', // slate-300
    backgroundColor: '#0f172a', // slate-900
  },
  updateButton: {
    backgroundColor: '#6366f1', // indigo-500
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  updateButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },

  clearCard: {
    backgroundColor: '#1e293b', // slate-800
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#ef4444', // red-500
  },
  clearTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  clearSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    marginBottom: theme.spacing.md,
  },
  clearButton: {
    backgroundColor: '#ef4444', // red-500
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  infoCard: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)', // indigo-500/15
    margin: theme.spacing.md,
    marginTop: 0,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: '#6366f1', // indigo-500
  },
  infoTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
    color: '#a5b4fc', // indigo-300
    marginBottom: theme.spacing.sm,
  },
  testButton: {
    backgroundColor: '#c084fc', // purple-400
    margin: theme.spacing.md,
    marginTop: 0,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#ffffff',
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: '#a5b4fc', // indigo-300
    lineHeight: 20,
  },
});

export default SMSScreen;
