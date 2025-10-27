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
import NotificationService from '../services/NotificationService';
import { SocketIOService } from '../services/SocketIOService';

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

  const testNotifications = async () => {
    try {
      const notificationService = NotificationService.getInstance();
      
      // Test chat notification
      await notificationService.showChatNotification({
        conversationId: 'test_123',
        senderName: 'Test Customer',
        message: 'This is a test notification message!',
        timestamp: new Date().toISOString(),
      });
      
      Alert.alert('✅ Success', 'Test chat notification sent!');
      
      // Test case notification after 3 seconds
      setTimeout(async () => {
        await notificationService.showCaseNotification({
          caseId: 'case_456',
          customerName: 'Jane Doe',
          serviceType: 'Plumbing',
          description: 'Need urgent plumbing repair',
          priority: 'urgent',
        });
      }, 3000);
      
    } catch (error) {
      console.error('❌ Error testing notifications:', error);
      Alert.alert('❌ Error', 'Failed to send test notification');
    }
  };

  const handleToggleSMS = async () => {
    try {
      const newEnabled = await smsService.toggleEnabled();
      if (newEnabled) {
        Alert.alert(
          'SMS Enabled! 📱',
          'Automatic SMS will now be sent when you miss calls.\n\nMake sure to test with a missed call!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('SMS Disabled', 'Automatic SMS sending has been turned off.');
      }
      await loadSMSData();
    } catch (error) {
      console.error('Error toggling SMS:', error);
      Alert.alert('Error', 'Failed to toggle SMS settings');
    }
  };

  const handleUpdateMessage = async () => {
    if (messageText.trim().length === 0) {
      Alert.alert('Error', 'Message cannot be empty');
      return;
    }

    try {
      await smsService.updateMessage(messageText.trim());
      Alert.alert('Message Updated! ✅', 'Your SMS message has been saved.');
      await loadSMSData();
    } catch (error) {
      console.error('Error updating message:', error);
      Alert.alert('Error', 'Failed to update message');
    }
  };

  const handleTestChatLink = async () => {
    try {
      console.log('🧪 BUTTON PRESSED: Testing chat link generation...');
      
      // Get current user ID first
      const userResponse = await ApiService.getInstance().getCurrentUser();
      const currentUser = (userResponse.data as any)?.user || userResponse.data; // Handle both formats
      const currentUserId = currentUser?.id;
      
      if (!currentUserId) {
        Alert.alert('Error', 'Could not get current user ID');
        return;
      }
      
      console.log('👤 Using current user ID for SMS test:', currentUserId);
      
      // Generate real SMS text with actual current user token
      const result = await smsService.testGenerateChatLink(currentUserId, '+359888123456');
      
      Alert.alert(
        '🧪 Real SMS Text Generated!',
        `This is the actual SMS that would be sent:\n\n${result.message}\n\nToken: ${result.token}\nURL: ${result.url}\n\nThe link is now LIVE and ready to test!\n\nUser ID: ${currentUserId}`,
        [
          { text: 'Copy URL', onPress: () => {
            // You can manually copy the URL from the alert
            console.log('🔗 Copy this URL to test:', result.url);
          }},
          { text: 'OK' }
        ]
      );
      
    } catch (error) {
      console.error('❌ Error testing chat link:', error);
      Alert.alert('Error', 'Failed to generate test chat link');
    }
  };



  const handleClearHistory = async () => {
    Alert.alert(
      'Clear SMS History',
      'This will clear the history of processed calls. Only NEW missed calls will get SMS after this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear History',
          style: 'destructive',
          onPress: async () => {
            try {
              await smsService.clearSMSSentHistory();
              Alert.alert('History Cleared! ✅', 'SMS history has been cleared. Only new missed calls will get SMS.');
              await loadSMSData();
            } catch (error) {
              console.error('Error clearing history:', error);
              Alert.alert('Error', 'Failed to clear SMS history');
            }
          }
        }
      ]
    );
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
            'Permission Required',
            'Contact filtering requires access to your contacts. Please grant the permission to continue.',
            [{ text: 'OK' }]
          );
          return;
        }
      }
      
      // Update the SMS service config directly
      await smsService.updateConfig({ filterKnownContacts: newFiltering });
      
      if (newFiltering) {
        Alert.alert(
          'Contact Filtering Enabled! 📞',
          'SMS will only be sent to unknown numbers (not in your contacts).\n\nThis helps avoid sending SMS to family members and friends.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Contact Filtering Disabled',
          'SMS will be sent to all missed calls, including contacts.',
          [{ text: 'OK' }]
        );
      }
      
      // Update local state
      setSmsStats(prev => ({ ...prev, filterKnownContacts: newFiltering }));
      
    } catch (error) {
      console.error('Error toggling contact filtering:', error);
      Alert.alert('Error', 'Failed to toggle contact filtering');
    }
  };

  const formatLastSent = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString('bg-BG');
  };

  const testMissedCallDetection = async () => {
    try {
      const { ModernCallDetectionService } = await import('../services/ModernCallDetectionService');
      const callService = ModernCallDetectionService.getInstance();
      
      // Use safe test method that only checks filtering without sending SMS
      const result = await callService.testContactFiltering();
      
      Alert.alert(
        'Test Complete', 
        'Check the console logs for contact filtering results. No SMS was sent.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Error', `Test failed: ${error}`);
      console.error('Test error:', error);
    }
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
        <Text style={styles.title}>SMS Settings</Text>
        <Text style={styles.subtitle}>Automatic SMS for missed calls</Text>
      </View>

      {/* Test Notifications Button */}
      <TouchableOpacity
        style={styles.testButton}
        onPress={testNotifications}
      >
        <Text style={styles.testButtonText}>🔔 Test Notifications</Text>
      </TouchableOpacity>

      {/* Status Card */}
      <View style={styles.statusCard}>
        <View style={styles.statusHeader}>
          <Text style={styles.statusTitle}>SMS Status</Text>
          <View style={[
            styles.statusIndicator,
            smsStats.isEnabled ? styles.statusActive : styles.statusInactive
          ]}>
            <Text style={styles.statusText}>
              {smsStats.isEnabled ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Permission:</Text>
          <Text style={[
            styles.statusValue,
            { color: permissions?.hasAllPermissions ? '#4CAF50' : '#F44336' }
          ]}>
            {permissions?.hasAllPermissions ? 'Granted' : 'Not Granted'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Messages Sent:</Text>
          <Text style={styles.statusValue}>{smsStats.sentCount}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Last Sent:</Text>
          <Text style={styles.statusValue}>{formatLastSent(smsStats.lastSentTime)}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Processed Calls:</Text>
          <Text style={styles.statusValue}>{smsStats.processedCalls}</Text>
        </View>
      </View>

      {/* Test Button */}
      <TouchableOpacity 
        style={styles.testButton}
        onPress={testMissedCallDetection}
      >
        <Text style={styles.testButtonText}>🧪 Test Missed Call Detection</Text>
      </TouchableOpacity>

      {/* Toggle Switch */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleHeader}>
          <Text style={styles.toggleTitle}>Enable Automatic SMS</Text>
          <Text style={styles.toggleSubtitle}>
            Send SMS automatically when you miss a call
          </Text>
        </View>
        <Switch
          value={smsStats.isEnabled}
          onValueChange={handleToggleSMS}
          trackColor={{ false: '#E0E0E0', true: '#4CAF50' }}
          thumbColor={smsStats.isEnabled ? '#FFFFFF' : '#F4F3F4'}
        />
      </View>

      {/* Contact Filtering Checkbox */}
      <View style={styles.filterCard}>
        <Text style={styles.filterTitle}>Contact Filtering</Text>
        <Text style={styles.filterSubtitle}>
          Choose whether to send SMS to people in your contacts
        </Text>
        
        <TouchableOpacity 
          style={styles.checkboxContainer}
          onPress={handleToggleContactFiltering}
        >
          <View style={styles.checkboxRow}>
            <View style={[
              styles.checkbox,
              !(smsStats.filterKnownContacts ?? false) ? styles.checkboxChecked : styles.checkboxUnchecked
            ]}>
              {!(smsStats.filterKnownContacts ?? false) && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.checkboxText}>
              Include existing contacts {(smsStats.filterKnownContacts ?? false) ? '(OFF)' : '(ON)'}
            </Text>
          </View>
        </TouchableOpacity>
        
        <Text style={styles.filterDescription}>
          {!(smsStats.filterKnownContacts ?? false)
            ? '✅ SMS will be sent to ALL missed calls (including family, friends, and strangers)'
            : '🚫 SMS will only be sent to unknown numbers (strangers only, not family/friends)'
          }
        </Text>
      </View>

      {/* Message Configuration */}
      <View style={styles.messageCard}>
        <Text style={styles.messageTitle}>SMS Message Template</Text>
        <Text style={styles.messageSubtitle}>
          This template will be sent when you miss a call. Use [chat_link] for the auto-updating chat URL.
        </Text>
        
        <View style={[styles.statusRow, { marginBottom: 10, padding: 10, backgroundColor: '#f0f8ff', borderRadius: 8 }]}>
          <Text style={[styles.statusLabel, { fontWeight: 'bold' }]}>Current Chat Link:</Text>
          <Text style={[styles.statusValue, { fontSize: 12, color: smsService.getCurrentChatLinkSync().includes('http') ? '#0066cc' : isGeneratingLink ? '#999' : '#ff6b35' }]} numberOfLines={1}>
            {isGeneratingLink ? '🔄 Auto-generating chat link...' : smsService.getCurrentChatLinkSync()}
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
          💡 Tip: Use [chat_link] where you want the auto-updating chat link to appear. Link refreshes automatically when used.
        </Text>
        
        {/* SMS Preview */}
        <View style={{ marginTop: 15, padding: 12, backgroundColor: '#f8f9fa', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#007bff' }}>
          <Text style={[styles.statusLabel, { fontSize: 14, fontWeight: 'bold', marginBottom: 8 }]}>📱 SMS Preview:</Text>
          <Text style={{ fontSize: 13, lineHeight: 18, color: '#333' }}>
            {displayText || 'Loading SMS preview...'}
          </Text>
          <Text style={[styles.messageSubtitle, { fontSize: 11, marginTop: 5, fontStyle: 'italic' }]}>
            This is what customers will receive
          </Text>
        </View>
        
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            style={[styles.updateButton, { flex: 1 }]}
            onPress={handleUpdateMessage}
          >
            <Text style={styles.updateButtonText}>Update Template</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: '#28a745', flex: 0.48 }]}
            onPress={async () => {
              try {
                await smsService.regenerateChatLink();
                Alert.alert('✅ Success', 'New chat link generated!');
                await loadSMSData(); // Refresh to show new link
                // Update display text with new link
                const currentLink = smsService.getCurrentChatLinkSync();
                setDisplayText(messageText.replace('[chat_link]', currentLink));
              } catch (error) {
                Alert.alert('❌ Error', 'Failed to generate new chat link');
              }
            }}
          >
            <Text style={styles.updateButtonText}>🔄 New Link</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.updateButton, { backgroundColor: '#9B59B6', flex: 0.48 }]}
            onPress={async () => {
              try {
                Alert.alert('🔄 Generating...', 'Please wait while we generate your chat link');
                await smsService.initializeChatLink();
                await loadSMSData(); // Refresh to show new link
                Alert.alert('✅ Success', 'Chat link generated successfully!');
              } catch (error) {
                Alert.alert('❌ Error', 'Failed to generate chat link. Please make sure you are logged in.');
              }
            }}
          >
            <Text style={styles.updateButtonText}>🔗 Generate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Test Chat Link */}
      <View style={[styles.messageCard, { backgroundColor: '#FFF3E0', borderColor: '#FF9800', borderWidth: 2 }]}>
        <Text style={styles.messageTitle}>🧪 Test Chat Link</Text>
        <Text style={styles.messageSubtitle}>
          Generate real SMS text with working chat link for testing
        </Text>
        
        <TouchableOpacity
          style={[styles.updateButton, { backgroundColor: '#FF9800' }]}
          onPress={handleTestChatLink}
        >
          <Text style={styles.updateButtonText}>🧪 Generate Test SMS Link</Text>
        </TouchableOpacity>
      </View>

      {/* Clear History */}
      <View style={styles.clearCard}>
        <Text style={styles.clearTitle}>Clear SMS History</Text>
        <Text style={styles.clearSubtitle}>
          Clear processed calls history. Only NEW missed calls will get SMS after this.
        </Text>
        
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearHistory}
        >
          <Text style={styles.clearButtonText}>Clear History</Text>
        </TouchableOpacity>
      </View>

      {/* Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works:</Text>
        <Text style={styles.infoText}>
          1. Enable automatic SMS above{'\n'}
          2. Enable contact filtering to avoid SMS to family/friends{'\n'}
          3. Grant SMS and contacts permissions when prompted{'\n'}
          4. Only NEW missed calls will get SMS (not old ones){'\n'}
          5. Each call gets only 1 SMS (no duplicates){'\n'}
          6. Use "Clear History" to reset for new calls
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2E7D32',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusActive: {
    backgroundColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#F44336',
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  toggleCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggleHeader: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  toggleSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  filterCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  filterSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  checkboxContainer: {
    marginBottom: 12,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkboxUnchecked: {
    backgroundColor: 'transparent',
    borderColor: '#E0E0E0',
  },
  checkmark: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    flex: 1,
  },
  filterDescription: {
    fontSize: 14,
    color: '#4CAF50',
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
    lineHeight: 20,
  },
  messageCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  messageSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 12,
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  updateButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  updateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },

  clearCard: {
    backgroundColor: 'white',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  clearTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  clearSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  clearButton: {
    backgroundColor: '#F44336',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  testButton: {
    backgroundColor: '#9C27B0',
    margin: 16,
    marginTop: 0,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  testButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },
});

export default SMSScreen;
