import { Logger } from '../utils/Logger';
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
import { ModernCallDetectionService } from '../services/ModernCallDetectionService';
import { PermissionService } from '../services/PermissionService';
import theme from '../styles/theme';

interface SMSStats {
  isEnabled: boolean;
  sentCount: number;
  lastSentTime?: number;
  message: string;
  processedCalls: number;
  filterKnownContacts: boolean;
}

interface SMSPointsStatus {
  canSend: boolean;
  pointsCost: number;
  pointsBalance: number;
  tier: string;
  reason?: string;
  totalSmsSent?: number;
  pointsSpentOnSMS?: number;
}

// Helper function to calculate SMS segments
function calculateSMSSegments(text: string): { chars: number; segments: number; maxChars: number; isUnicode: boolean } {
  const gsmChars = /^[@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-.\/0-9:;<=>?¡A-ZÄÖÑܧ¿a-zäöñüà]*$/;
  const isUnicode = !gsmChars.test(text);
  
  const maxCharsPerSegment = isUnicode ? 70 : 160;
  const maxCharsMultipart = isUnicode ? 67 : 153;
  
  const chars = text.length;
  let segments = 1;
  
  if (chars > maxCharsPerSegment) {
    segments = Math.ceil(chars / maxCharsMultipart);
  }
  
  return { chars, segments, maxChars: maxCharsPerSegment, isUnicode };
}

export default function SMSScreen() {
  const { t } = useTranslation('sms');
  const [smsStats, setSmsStats] = useState<SMSStats>({
    isEnabled: false,
    sentCount: 0,
    message: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
    processedCalls: 0,
    filterKnownContacts: false, // Default to false until we verify permission
  });
  const [messageText, setMessageText] = useState('');
  const [displayText, setDisplayText] = useState(''); // For showing template with actual link
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [permissions, setPermissions] = useState<any>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<any>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<'latin' | 'bulgarian' | 'custom'>('latin');
  const [customText, setCustomText] = useState('');
  const [smsPointsStatus, setSmsPointsStatus] = useState<SMSPointsStatus | null>(null);
  const [saving, setSaving] = useState(false);

  const smsService = SMSService.getInstance();
  const socketService = SocketIOService.getInstance();

  // SMS Templates - defined inside component to access t()
  const getSmsTemplates = () => ({
    latin: {
      id: 'latin',
      name: t('smsTemplateLatin'),
      text: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]',
      description: t('smsTemplateLatinDesc'),
      badge: t('smsTemplateLatinBadge')
    },
    bulgarian: {
      id: 'bulgarian',
      name: t('smsTemplateBulgarian'),
      text: 'Зает съм, ще върна обаждане след няколко минути.\n\nЗапочнете чат тук:\n[chat_link]',
      description: t('smsTemplateBulgarianDesc'),
      badge: t('smsTemplateBulgarianBadge')
    },
    custom: {
      id: 'custom',
      name: t('smsTemplateCustom'),
      text: '',
      description: t('smsTemplateCustomDesc'),
      badge: t('smsTemplateCustomBadge')
    }
  });

  useEffect(() => {
    loadSMSData();
    
    // Set up Socket.IO listener for real-time SMS config updates
    const handleSMSConfigUpdate = async (data: any) => {
      Logger.debug('🔔 Received SMS config update via Socket.IO:', data);
      
      // Refresh config from API to get latest state
      await smsService.refreshConfigFromAPI();
      const stats = smsService.getStats();
      
      Logger.debug('✅ SMS config updated in real-time:', stats);
      setSmsStats(stats);
      
      // Also refresh the message with current link
      const messageWithLink = await smsService.getMessageWithCurrentLink();
      setDisplayText(messageWithLink);
    };
    
    socketService.onSMSConfigUpdate(handleSMSConfigUpdate);
    Logger.debug('👂 Socket.IO listener registered for SMS config updates');
    
    // Set up auto-refresh every 30 seconds to sync with marketplace (fallback)
    const interval = setInterval(async () => {
      Logger.debug('🔄 Auto-syncing SMS config from backend...');
      try {
        // Refresh config from API to sync with marketplace changes
        await smsService.refreshConfigFromAPI();
        const config = smsService.getConfig();
        const stats = smsService.getStats();
        
        Logger.debug('📊 Auto-sync - Old state:', smsStats.isEnabled);
        Logger.debug('📊 Auto-sync - New state:', stats.isEnabled);
        
        // Background permission check - verify permissions are still valid
        if (stats.isEnabled) {
          const callDetectionService = ModernCallDetectionService.getInstance();
          const permissionStatus = await callDetectionService.checkPermissions();
          
          if (!permissionStatus?.hasAllPermissions) {
            Logger.debug('⚠️ Background check: Permissions revoked while SMS was ON');
            await smsService.updateConfig({ isEnabled: false });
            await callDetectionService.stopDetection();
            stats.isEnabled = false;
            
            Alert.alert(
              t('permissionsRevoked'),
              t('permissionsRevokedMessage'),
              [{ text: t('ok') }]
            );
          } else {
            Logger.debug('✅ Permissions verified - SMS can work properly');
            // Sync settings to native for background operation
            await callDetectionService.syncSettingsToNative();
          }
        }
        
        setSmsStats(stats);
        
        // Also refresh the message with current link
        const messageWithLink = await smsService.getMessageWithCurrentLink();
        setDisplayText(messageWithLink);
        
        Logger.debug('✅ Auto-sync complete, state updated');
      } catch (error) {
        Logger.debug('⚠️ Auto-sync failed:', error);
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
      Logger.debug('📊 Loading SMS data...');
      
      // DO NOT reset template - preserve user's saved template (Bulgarian/Custom)
      // await smsService.resetMessageTemplate(); // REMOVED - was overwriting user templates!
      
      // Refresh config from API to sync with web app
      Logger.debug('🔄 Refreshing config from backend API...');
      await smsService.refreshConfigFromAPI();
      
      // Get config after refresh
      const config = smsService.getConfig();
      const stats = smsService.getStats();
      const perms = await smsService.checkPermissions();
      
      // IMPORTANT: Verify permissions if SMS is enabled
      // This catches cases where permissions were revoked after app update
      if (stats.isEnabled) {
        Logger.debug('🔍 SMS is enabled - verifying permissions...');
        const callDetectionService = ModernCallDetectionService.getInstance();
        const permissionStatus = await callDetectionService.checkPermissions();
        
        if (!permissionStatus?.hasAllPermissions) {
          Logger.debug('⚠️ Permissions revoked! SMS was ON but permissions are missing');
          
          // Auto-disable SMS since permissions are gone
          await smsService.updateConfig({ isEnabled: false });
          await callDetectionService.stopDetection();
          stats.isEnabled = false;
          
          // Alert user about the issue
          Alert.alert(
            t('permissionsRevoked'),
            t('permissionsRevokedMessage'),
            [{ text: t('ok') }]
          );
        } else {
          Logger.debug('✅ Permissions verified - SMS can work properly');
          // Sync settings to native for background operation
          await callDetectionService.syncSettingsToNative();
        }
      }
      
      Logger.debug('📊 SMS config loaded (synced with backend):', config);
      
      // Check if contacts permission is actually granted
      const permissionService = PermissionService.getInstance();
      const hasContactsPermission = await permissionService.hasContactsPermission();
      Logger.debug('📋 Contacts permission status:', hasContactsPermission);
      
      // If filter is ON but permission is NOT granted, disable the filter
      if (stats.filterKnownContacts && !hasContactsPermission) {
        Logger.debug('⚠️ Filter is ON but permission denied - disabling filter');
        await smsService.updateConfig({ filterKnownContacts: false });
        stats.filterKnownContacts = false;
      }
      
      setSmsStats(stats);
      setMessageText(config.message); // Template with [chat_link] placeholder for editing
      
      // Refresh token from backend first (this ensures we get the latest token)
      Logger.debug('🔄 Refreshing chat link from backend...');
      const currentLink = await smsService.getCurrentChatLink();
      Logger.debug('📱 Current chat link from backend:', currentLink);
      
      // If no chat link exists, try to generate one automatically
      if (currentLink === 'Generating chat link...' || currentLink === 'No link available') {
        Logger.debug('🔄 No chat link found, attempting automatic generation...');
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
            Logger.debug('✅ Chat link generated automatically:', newLink);
          } catch (error) {
            Logger.debug('⚠️ Automatic chat link generation failed:', error);
            setIsGeneratingLink(false);
            // Show fallback message
            setDisplayText(config.message.replace('[chat_link]', 'Chat link generation failed'));
          }
        }, 1000); // Wait 1 second before attempting generation
      }
      
      const messageWithLink = await smsService.getMessageWithCurrentLink();
      Logger.debug('📱 Message with current link:', messageWithLink);
      
      setDisplayText(messageWithLink);
      setPermissions(perms);
      
      Logger.debug('✅ SMS data loaded successfully');
      
      // Detect which template is being used
      const templates = getSmsTemplates();
      if (config.message === templates.latin.text) {
        setSelectedTemplate('latin');
      } else if (config.message === templates.bulgarian.text) {
        setSelectedTemplate('bulgarian');
      } else {
        setSelectedTemplate('custom');
        setCustomText(config.message);
      }
      
      // Load SMS points status
      await loadSMSPointsStatus();
    } catch (error) {
      Logger.error('❌ Error loading SMS data:', error);
    }
  };

  const loadSMSPointsStatus = async () => {
    try {
      const response = await ApiService.getInstance().makeRequest('/sms/limit-status');
      if (response.success && response.data) {
        setSmsPointsStatus(response.data as SMSPointsStatus);
      }
    } catch (error) {
      Logger.error('Error loading SMS points status:', error);
    }
  };

  const handleTemplateChange = async (templateId: 'latin' | 'bulgarian' | 'custom') => {
    setSelectedTemplate(templateId);
    const templates = getSmsTemplates();
    if (templateId === 'custom') {
      if (!customText) {
        setCustomText(messageText);
      }
      setMessageText(customText || messageText);
    } else {
      setMessageText(templates[templateId].text);
    }
    
    // Update preview
    const currentLink = smsService.getCurrentChatLinkSync();
    const newText = templateId === 'custom' ? (customText || messageText) : templates[templateId].text;
    setDisplayText(newText.replace('[chat_link]', currentLink));
  };

  const handleSaveTemplate = async () => {
    const templates = getSmsTemplates();
    const textToSave = selectedTemplate === 'custom' ? customText : templates[selectedTemplate].text;
    
    if (!textToSave.trim()) {
      Alert.alert(t('error'), t('templateCannotBeEmpty'));
      return;
    }
    
    if (!textToSave.includes('[chat_link]')) {
      Alert.alert(
        t('missingChatLink'),
        t('templateMustContainChatLink')
      );
      return;
    }
    
    try {
      setSaving(true);
      await smsService.updateConfig({ message: textToSave.trim() });
      Alert.alert(t('common:success'), t('templateSaved'));
    } catch (error) {
      Alert.alert(t('common:error'), t('templateSaveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    Logger.debug('🔄 SMSScreen - Manual refresh triggered');
    setIsRefreshing(true);
    await loadSMSData();
    Logger.debug('✅ SMSScreen - Manual refresh completed');
    setIsRefreshing(false);
  };

  const handleToggleSMS = async () => {
    try {
      const callDetectionService = ModernCallDetectionService.getInstance();
      const currentlyEnabled = smsStats.isEnabled;
      
      if (!currentlyEnabled) {
        // ENABLING: First request call detection permissions, then enable both
        const hasPermissions = await callDetectionService.requestPermissions();
        if (!hasPermissions) {
          Alert.alert(
            'Разрешения са необходими',
            'За автоматични SMS при пропуснати обаждания са необходими разрешения за:\n\n• Достъп до състоянието на телефона\n• Достъп до списъка с обаждания\n\nМоля отидете в Настройки > Приложения > SnapFix > Разрешения.',
            [{ text: 'OK' }]
          );
          return;
        }
        
        // Start call detection
        await callDetectionService.startDetection();
        
        // Enable SMS
        const newEnabled = await smsService.toggleEnabled();
        if (!newEnabled) {
          // SMS toggle failed, stop call detection too
          await callDetectionService.stopDetection();
          Alert.alert(t('common:error'), t('smsPermissionsNeeded'));
          return;
        }
        
        Alert.alert(
          `✅ ${t('autoSmsActivated')}`,
          t('autoSmsActivatedMessage'),
          [{ text: t('common:ok') }]
        );
      } else {
        // DISABLING: Stop call detection and disable SMS
        await callDetectionService.stopDetection();
        await smsService.toggleEnabled();
        // Sync to native to stop the foreground service
        await callDetectionService.syncSettingsToNative();
        Alert.alert('SMS Изключени', 'Автоматичното изпращане на SMS е изключено.');
      }
      
      await loadSMSData();
    } catch (error) {
      Logger.error('Error toggling SMS:', error);
      Alert.alert(t('common:error'), t('smsSettingsChangeFailed'));
    }
  };

  const handleToggleContactFiltering = async () => {
    try {
      Logger.debug('Current filterKnownContacts:', smsStats.filterKnownContacts);
      
      // Handle undefined case - default to false (include contacts)
      const currentFiltering = smsStats.filterKnownContacts ?? false;
      
      // Toggle the filtering state
      const newFiltering = !currentFiltering;
      Logger.debug('New filtering state:', newFiltering);
      
      // If enabling filtering, request contacts permission
      if (newFiltering) {
        const { ContactService } = await import('../services/ContactService');
        const contactService = ContactService.getInstance();
        const hasPermission = await contactService.requestContactsPermission();
        
        if (!hasPermission) {
          Alert.alert(
            t('permissionRequired'),
            t('contactFilteringPermission'),
            [{ text: t('common:ok') }]
          );
          return;
        }
      }
      
      // Update the SMS service config directly
      await smsService.updateConfig({ filterKnownContacts: newFiltering });
      
      if (newFiltering) {
        Alert.alert(
          `${t('contactFilteringEnabled')} 📞`,
          t('contactFilteringEnabledMessage'),
          [{ text: t('common:ok') }]
        );
      } else {
        Alert.alert(
          t('contactFilteringDisabled'),
          t('contactFilteringDisabledMessage'),
          [{ text: t('common:ok') }]
        );
      }
      
      // Update local state
      setSmsStats(prev => ({ ...prev, filterKnownContacts: newFiltering }));
      
      // Sync to native so background service uses new filter setting
      const callDetectionService = ModernCallDetectionService.getInstance();
      await callDetectionService.syncSettingsToNative();
      
    } catch (error) {
      Logger.error('Error toggling contact filtering:', error);
      Alert.alert(t('common:error'), t('filteringChangeFailed'));
    }
  };

  const formatLastSent = (timestamp?: number) => {
    if (!timestamp) return t('never');
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
        <Text style={styles.title}>{t('smsSettings')}</Text>
        <Text style={styles.subtitle}>{t('autoSmsOnMissedCalls')}</Text>
      </View>

      {/* Automation Settings Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>{t('automationSettings')}</Text>
        </View>

        {/* Enable/Disable Switch */}
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('enableAutoSms')}</Text>
          <Switch
            value={smsStats.isEnabled}
            onValueChange={handleToggleSMS}
            trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
            thumbColor={smsStats.isEnabled ? '#FFFFFF' : '#F4F3F4'}
          />
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>{t('sentMessages')}:</Text>
          <Text style={styles.statusValue}>{smsStats.sentCount}</Text>
        </View>

        <View style={styles.divider} />

        {/* Contact Filtering Section */}
        <View style={styles.statusRow}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.filterTitle}>{t('contactFiltering')}</Text>
            <Text style={styles.filterSubtitle}>
              {t('contactFilteringDesc')}
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
            ? t('filterOnMessage')
            : t('filterOffMessage')
          }
        </Text>
      </View>

      {/* SMS Template Selection */}
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>✏️ {t('smsTemplate')}</Text>
        <Text style={styles.messageSubtitle}>{t('selectTemplateForAutoMessage')}</Text>
        
        {/* Template Options */}
        <View style={styles.templateContainer}>
          {(() => {
            const templates = getSmsTemplates();
            return (
              <>
                {/* Latin Template */}
                <TouchableOpacity 
                  style={[styles.templateOption, selectedTemplate === 'latin' && styles.templateOptionSelected]}
                  onPress={() => handleTemplateChange('latin')}
                >
                  <View style={styles.templateRadio}>
                    {selectedTemplate === 'latin' && <View style={styles.templateRadioInner} />}
                  </View>
                  <View style={styles.templateContent}>
                    <View style={styles.templateHeader}>
                      <Text style={styles.templateName}>{templates.latin.name}</Text>
                      <View style={[styles.templateBadge, styles.templateBadgeGreen]}>
                        <Text style={styles.templateBadgeText}>{templates.latin.badge}</Text>
                      </View>
                    </View>
                    <Text style={styles.templateDescription}>{templates.latin.description}</Text>
                    <Text style={styles.templatePreview}>{templates.latin.text.replace('\n', ' ').substring(0, 45)}...</Text>
                  </View>
                </TouchableOpacity>

                {/* Bulgarian Template */}
                <TouchableOpacity 
                  style={[styles.templateOption, selectedTemplate === 'bulgarian' && styles.templateOptionSelectedBlue]}
                  onPress={() => handleTemplateChange('bulgarian')}
                >
                  <View style={styles.templateRadio}>
                    {selectedTemplate === 'bulgarian' && <View style={styles.templateRadioInnerBlue} />}
                  </View>
                  <View style={styles.templateContent}>
                    <View style={styles.templateHeader}>
                      <Text style={styles.templateName}>{templates.bulgarian.name}</Text>
                      <View style={[styles.templateBadge, styles.templateBadgeBlue]}>
                        <Text style={styles.templateBadgeText}>{templates.bulgarian.badge}</Text>
                      </View>
                    </View>
                    <Text style={styles.templateDescription}>{templates.bulgarian.description}</Text>
                    <Text style={styles.templatePreview}>{templates.bulgarian.text.replace('\n', ' ').substring(0, 45)}...</Text>
                  </View>
                </TouchableOpacity>

                {/* Custom Template */}
                <TouchableOpacity 
                  style={[styles.templateOption, selectedTemplate === 'custom' && styles.templateOptionSelectedPurple]}
                  onPress={() => handleTemplateChange('custom')}
                >
                  <View style={styles.templateRadio}>
                    {selectedTemplate === 'custom' && <View style={styles.templateRadioInnerPurple} />}
                  </View>
                  <View style={styles.templateContent}>
                    <Text style={styles.templateName}>{templates.custom.name}</Text>
                    <Text style={styles.templateDescription}>{templates.custom.description}</Text>
                  </View>
                </TouchableOpacity>
              </>
            );
          })()}
        </View>

        {/* Custom Text Input */}
        {selectedTemplate === 'custom' && (
          <View style={styles.customTextContainer}>
            <Text style={styles.customTextLabel}>{t('yourMessage')}:</Text>
            <TextInput
              style={styles.messageInput}
              value={customText}
              onChangeText={(text) => {
                setCustomText(text);
                const currentLink = smsService.getCurrentChatLinkSync();
                setDisplayText(text.replace('[chat_link]', currentLink));
              }}
              placeholder={t('writeYourMessageHere')}
              placeholderTextColor="#999999"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.customTextWarning}>
              <Text style={styles.customTextWarningText}>
                {t('chatLinkRequired')}
              </Text>
            </View>
          </View>
        )}

        {/* Character Counter */}
        {(() => {
          const smsInfo = calculateSMSSegments(displayText || messageText);
          return (
            <View style={[styles.charCounterContainer, smsInfo.isUnicode ? styles.charCounterWarning : styles.charCounterSuccess]}>
              <View style={styles.charCounterRow}>
                <Text style={styles.charCounterLabel}>{t('characterCount')}:</Text>
                <Text style={[styles.charCounterValue, smsInfo.isUnicode ? styles.charCounterValueWarning : styles.charCounterValueSuccess]}>
                  {smsInfo.chars}
                </Text>
              </View>
              <View style={styles.charCounterRow}>
                <Text style={styles.charCounterLabel}>{t('encodingType')}:</Text>
                <View style={[styles.encodingBadge, smsInfo.isUnicode ? styles.encodingBadgeWarning : styles.encodingBadgeSuccess]}>
                  <Text style={styles.encodingBadgeText}>
                    {smsInfo.isUnicode ? t('unicodeCyrillic') : t('gsmLatin')}
                  </Text>
                </View>
              </View>
              <View style={[styles.charCounterRow, styles.charCounterRowBorder]}>
                <Text style={styles.charCounterLabelBold}>{t('smsCount')}:</Text>
                <View style={styles.smsCountContainer}>
                  <Text style={[styles.smsCountValue, smsInfo.segments > 1 ? styles.charCounterValueWarning : styles.charCounterValueSuccess]}>
                    {smsInfo.segments}
                  </Text>
                  <Text style={styles.smsCountLabel}>SMS</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* SMS Preview */}
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>📱 {t('smsPreview')}:</Text>
          <Text style={styles.previewText}>{displayText || t('common:loading')}</Text>
          <Text style={styles.previewSubtitle}>{t('smsPreviewSubtitle')}</Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveTemplate}
          disabled={saving}
        >
          <Text style={styles.saveButtonText}>{saving ? `⏳ ${t('saving')}...` : `💾 ${t('saveTemplate')}`}</Text>
        </TouchableOpacity>
      </View>

      {/* SMS Points Widget */}
      {smsPointsStatus && (
        <View style={styles.smsLimitCard}>
          <View style={styles.smsLimitHeader}>
            <Text style={styles.smsLimitTitle}>💎 {t('smsAndPoints')}</Text>
            <View style={[styles.tierBadge, 
              smsPointsStatus.tier === 'pro' ? styles.tierPro : 
              smsPointsStatus.tier === 'normal' ? styles.tierNormal : styles.tierFree
            ]}>
              <Text style={styles.tierBadgeText}>
                {smsPointsStatus.tier === 'pro' ? '⭐ PRO' : smsPointsStatus.tier === 'normal' ? '💼 NORMAL' : '🆓 FREE'}
              </Text>
            </View>
          </View>
          <View style={styles.smsLimitRow}>
            <Text style={styles.smsLimitLabel}>{t('smsCost')}:</Text>
            <Text style={styles.smsLimitValue}>
              {smsPointsStatus.pointsCost} {t('common:points').toLowerCase()}
            </Text>
          </View>
          <View style={styles.smsLimitRow}>
            <Text style={styles.smsLimitLabel}>{t('pointsBalance')}:</Text>
            <Text style={[styles.smsLimitValue, { color: smsPointsStatus.canSend ? '#4ade80' : '#ef4444' }]}>
              {smsPointsStatus.pointsBalance} {t('common:points').toLowerCase()}
            </Text>
          </View>
          {smsPointsStatus.totalSmsSent !== undefined && (
            <View style={styles.smsLimitRow}>
              <Text style={styles.smsLimitLabel}>{t('sentMessages')}:</Text>
              <Text style={styles.smsLimitValue}>{smsPointsStatus.totalSmsSent}</Text>
            </View>
          )}
          {!smsPointsStatus.canSend && (
            <View style={styles.limitWarning}>
              <Text style={styles.limitWarningText}>❌ {t('insufficientPoints')}</Text>
            </View>
          )}
        </View>
      )}

      {/* How It Works / Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>💡 {t('howSmsWorks')}</Text>
        <Text style={styles.infoText}>
          {t('howSmsWorksText')}
        </Text>
        
        {/* Encoding Explanation */}
        <View style={styles.encodingExplanation}>
          <Text style={styles.encodingExplanationTitle}>📝 {t('whyCyrillicUsesMoreSms')}</Text>
          <Text style={styles.encodingExplanationText}>
            {t('encodingExplanationText')}
          </Text>
          <View style={styles.encodingGrid}>
            <View style={styles.encodingGridItemGreen}>
              <Text style={styles.encodingGridTitle}>{t('latinGsm7')}</Text>
              <Text style={styles.encodingGridValue}>{t('charsPerSmsLatin')}</Text>
              <Text style={styles.encodingGridDesc}>{t('latinCharsDesc')}</Text>
            </View>
            <View style={styles.encodingGridItemOrange}>
              <Text style={styles.encodingGridTitleOrange}>{t('cyrillicUnicode')}</Text>
              <Text style={styles.encodingGridValueOrange}>{t('charsPerSmsCyrillic')}</Text>
              <Text style={styles.encodingGridDesc}>{t('cyrillicCharsDesc')}</Text>
            </View>
          </View>
          <Text style={styles.encodingTip}>💡 {t('encodingTip')}</Text>
        </View>
      </View>

      <View style={{ height: 30 }} />
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
  // Template Styles
  templateContainer: { marginTop: 12 },
  templateOption: { flexDirection: 'row', padding: 12, marginBottom: 8, borderRadius: 12, backgroundColor: '#1e293b', borderWidth: 2, borderColor: 'rgba(71, 85, 105, 0.5)' },
  templateOptionSelected: { backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: '#22c55e' },
  templateOptionSelectedBlue: { backgroundColor: 'rgba(59, 130, 246, 0.15)', borderColor: '#3b82f6' },
  templateOptionSelectedPurple: { backgroundColor: 'rgba(168, 85, 247, 0.15)', borderColor: '#a855f7' },
  templateRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#64748b', alignItems: 'center', justifyContent: 'center', marginRight: 12, marginTop: 2 },
  templateRadioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  templateRadioInnerBlue: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6' },
  templateRadioInnerPurple: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#a855f7' },
  templateContent: { flex: 1 },
  templateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  templateName: { fontSize: 16, fontWeight: '600', color: '#fff' },
  templateBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  templateBadgeGreen: { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
  templateBadgeBlue: { backgroundColor: 'rgba(59, 130, 246, 0.3)' },
  templateBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  templateDescription: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  templatePreview: { fontSize: 11, color: '#64748b', marginTop: 4, fontFamily: 'monospace' },
  // Custom text
  customTextContainer: { marginTop: 12, padding: 12, backgroundColor: 'rgba(168, 85, 247, 0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.3)' },
  customTextLabel: { fontSize: 13, color: '#c4b5fd', marginBottom: 8 },
  customTextWarning: { backgroundColor: 'rgba(245, 158, 11, 0.15)', padding: 8, borderRadius: 8, marginTop: 8, borderLeftWidth: 3, borderLeftColor: '#f59e0b' },
  customTextWarningText: { fontSize: 12, color: '#fbbf24' },
  // Character counter
  charCounterContainer: { padding: 12, borderRadius: 12, marginTop: 12, borderWidth: 1 },
  charCounterSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)' },
  charCounterWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' },
  charCounterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  charCounterRowBorder: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 4 },
  charCounterLabel: { fontSize: 13, color: '#94a3b8' },
  charCounterLabelBold: { fontSize: 14, color: '#fff', fontWeight: '600' },
  charCounterValue: { fontSize: 16, fontWeight: '700' },
  charCounterValueSuccess: { color: '#22c55e' },
  charCounterValueWarning: { color: '#f59e0b' },
  encodingBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  encodingBadgeSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.3)' },
  encodingBadgeWarning: { backgroundColor: 'rgba(245, 158, 11, 0.3)' },
  encodingBadgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  smsCountContainer: { flexDirection: 'row', alignItems: 'baseline' },
  smsCountValue: { fontSize: 24, fontWeight: '700' },
  smsCountLabel: { fontSize: 12, color: '#94a3b8', marginLeft: 4 },
  // Preview
  previewContainer: { backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#6366f1' },
  previewTitle: { fontSize: 14, fontWeight: '600', color: '#a5b4fc', marginBottom: 8 },
  previewText: { fontSize: 13, color: '#c4b5fd', lineHeight: 20 },
  previewSubtitle: { fontSize: 11, color: '#818cf8', marginTop: 8, fontStyle: 'italic' },
  // Save button
  saveButton: { backgroundColor: '#6366f1', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 16 },
  saveButtonDisabled: { backgroundColor: '#4b5563' },
  saveButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  // SMS Limit Card
  smsLimitCard: { backgroundColor: '#1e293b', margin: 16, marginTop: 0, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  smsLimitHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  smsLimitTitle: { fontSize: 18, fontWeight: '700', color: '#fff' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tierPro: { backgroundColor: 'rgba(168, 85, 247, 0.2)', borderWidth: 1, borderColor: 'rgba(168, 85, 247, 0.4)' },
  tierNormal: { backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.4)' },
  tierFree: { backgroundColor: 'rgba(107, 114, 128, 0.2)', borderWidth: 1, borderColor: 'rgba(107, 114, 128, 0.4)' },
  tierBadgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  smsLimitRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  smsLimitLabel: { fontSize: 13, color: '#94a3b8' },
  smsLimitValue: { fontSize: 13, color: '#fff', fontWeight: '500' },
  smsLimitProgressBar: { height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  smsLimitProgressFill: { height: '100%', borderRadius: 4 },
  progressSuccess: { backgroundColor: '#22c55e' },
  progressWarning: { backgroundColor: '#f59e0b' },
  progressDanger: { backgroundColor: '#ef4444' },
  smsLimitTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(99, 102, 241, 0.1)', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.3)' },
  smsLimitTotalLabel: { fontSize: 14, color: '#a5b4fc', fontWeight: '500' },
  smsLimitTotalValue: { fontSize: 24, fontWeight: '700', color: '#a5b4fc' },
  limitWarning: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 8, marginTop: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  limitWarningText: { fontSize: 14, color: '#fca5a5', textAlign: 'center', fontWeight: '500' },
  // Encoding explanation
  encodingExplanation: { marginTop: 16, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  encodingExplanationTitle: { fontSize: 14, fontWeight: '600', color: '#fff', marginBottom: 8 },
  encodingExplanationText: { fontSize: 12, color: '#94a3b8', marginBottom: 12 },
  encodingGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  encodingGridItemGreen: { flex: 1, padding: 10, marginRight: 4, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  encodingGridItemOrange: { flex: 1, padding: 10, marginLeft: 4, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  encodingGridTitle: { fontSize: 12, fontWeight: '600', color: '#22c55e', marginBottom: 2 },
  encodingGridTitleOrange: { fontSize: 12, fontWeight: '600', color: '#f59e0b', marginBottom: 2 },
  encodingGridValue: { fontSize: 14, fontWeight: '700', color: '#86efac' },
  encodingGridValueOrange: { fontSize: 14, fontWeight: '700', color: '#fbbf24' },
  encodingGridDesc: { fontSize: 10, color: '#94a3b8', marginTop: 2 },
  encodingTip: { fontSize: 12, color: '#94a3b8', marginTop: 12, textAlign: 'center' },
});

export default SMSScreen;
