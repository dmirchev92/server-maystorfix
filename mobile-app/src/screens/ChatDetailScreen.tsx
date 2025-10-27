import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketIOService from '../services/SocketIOService';
import ApiService from '../services/ApiService';
import { Message } from '../types/chat';
import theme from '../styles/theme';
import UnifiedCaseModal from '../components/UnifiedCaseModal';
import SurveyModal from '../components/SurveyModal';

interface RouteParams {
  conversationId: string;
  providerId: string;
  providerName: string;
}

function ChatDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId, providerId, providerName } = route.params as RouteParams;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyCaseId, setSurveyCaseId] = useState('');
  
  const flatListRef = useRef<FlatList>(null);
  const socketService = SocketIOService.getInstance();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Helper to normalize message fields (Chat API V2 uses body/sentAt, old uses message/timestamp)
  const normalizeMessage = (msg: any): Message => {
    try {
      return {
        ...msg,
        id: msg.id || msg.messageId || '',
        conversationId: msg.conversationId || conversationId,
        senderType: msg.senderType || 'system',
        senderName: msg.senderName || 'Unknown',
        body: msg.body || msg.message || '',
        message: msg.message || msg.body || '',
        sentAt: msg.sentAt || msg.timestamp || new Date().toISOString(),
        timestamp: msg.timestamp || msg.sentAt || new Date().toISOString(),
        type: msg.type || msg.messageType || 'text',
        messageType: msg.messageType || msg.type || 'text',
        isRead: msg.isRead ?? false,
        senderUserId: msg.senderUserId || msg.senderId || null,
        editedAt: msg.editedAt || null,
        deletedAt: msg.deletedAt || null,
      };
    } catch (error) {
      console.error('❌ Error normalizing message:', error, msg);
      // Return a safe default message
      return {
        id: msg?.id || 'error',
        conversationId: conversationId,
        senderType: 'system',
        senderName: 'System',
        body: 'Error loading message',
        message: 'Error loading message',
        sentAt: new Date().toISOString(),
        timestamp: new Date().toISOString(),
        type: 'text',
        messageType: 'text',
        isRead: false,
      } as Message;
    }
  };

  useEffect(() => {
    initializeChat();
    return () => {
      // Clean up socket listener
      if (unsubscribeRef.current) {
        console.log('🧹 Cleaning up message listener');
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      // Leave conversation room on unmount
      console.log('🚪 Leaving conversation room:', conversationId);
      socketService.leaveConversation(conversationId);
    };
  }, []);

  const initializeChat = async () => {
    console.log('🚀 ChatDetailScreen - Initializing chat for conversation:', conversationId);
    try {
      // Get current user
      console.log('👤 Getting current user...');
      const userResponse = await ApiService.getInstance().getCurrentUser();
      console.log('👤 User response:', userResponse);
      const userData: any = userResponse.data;
      setUserId(userData.id);
      setUserName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User');
      setCustomerPhone(userData.phoneNumber || userData.phone_number || '');

      // Initialize Socket.IO if not already connected
      const token = await AsyncStorage.getItem('auth_token');
      if (token && !socketService.isConnected()) {
        console.log('🔌 Socket.IO not connected, connecting now...');
        await socketService.connect(token, userData.id);
      }

      // Join conversation room
      console.log('🚪 Joining conversation room:', conversationId);
      socketService.joinConversation(conversationId);

      // Listen for new messages, updates, and deletions
      console.log('👂 Setting up message listener for conversation:', conversationId);
      const unsubscribe = socketService.onNewMessage((message) => {
        console.log('📨 Received message via Socket.IO:', message);
        if (message.conversationId === conversationId) {
          console.log('✅ Message matches current conversation');
          
          // Handle deleted messages
          if (message.deletedAt) {
            console.log('🗑️ Message deleted, removing from list:', message.id);
            setMessages(prev => prev.filter(m => m.id !== message.id));
            return;
          }
          
          // Handle updated messages
          const normalized = normalizeMessage(message);
          setMessages(prev => {
            const existingIndex = prev.findIndex(m => m.id === message.id);
            if (existingIndex >= 0) {
              console.log('✏️ Message updated, replacing in list:', message.id);
              const updated = [...prev];
              updated[existingIndex] = normalized;
              return updated;
            } else {
              console.log('➕ New message, adding to list:', message.id);
              return [...prev, normalized];
            }
          });
        } else {
          console.log('⚠️ Message for different conversation:', message.conversationId);
        }
      });

      // Store unsubscribe function for cleanup
      unsubscribeRef.current = unsubscribe;
      console.log('✅ Message listener set up and stored for cleanup');

      // Load messages
      await loadMessages();
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      Alert.alert('Грешка', 'Неуспешно зареждане на чата');
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);

      // Use ApiService to get messages
      const response = await ApiService.getInstance().getConversationMessages(
        conversationId,
        'marketplace'
      );

      console.log('📱 ChatDetail - Messages response:', response);
      
      if (response.success && response.data) {
        const messagesList = response.data.messages || response.data || [];
        console.log(`✅ Loaded ${messagesList.length} messages`);
        // Normalize messages to handle Chat API V2 field names
        const normalized = messagesList.map((m: any) => normalizeMessage({
          ...m,
          id: m.id || m.messageId,
        }));
        // Merge with any messages that may have arrived via Socket while loading
        setMessages(prev => {
          console.log('🔄 ========== MERGING MESSAGES ==========');
          console.log('🔄 Messages from socket (prev):', prev.length);
          console.log('🔄 Messages from API (normalized):', normalized.length);
          
          const map = new Map<string, Message>();
          // Keep existing first
          prev.forEach(m => {
            console.log('🔄 Adding socket message to map:', m.id);
            map.set(m.id, m);
          });
          // Add/overwrite with loaded messages
          normalized.forEach((m: Message) => {
            console.log('🔄 Adding API message to map:', m.id);
            map.set(m.id, m);
          });
          const merged = Array.from(map.values());
          console.log('🔄 Total unique messages after merge:', merged.length);
          
          // Maintain chronological order by sentAt/timestamp
          return merged.sort((a, b) => 
            new Date(a.sentAt || a.timestamp || 0).getTime() - new Date(b.sentAt || b.timestamp || 0).getTime()
          );
        });

        // Save to cache
        await AsyncStorage.setItem(
          `conversation_${conversationId}`,
          JSON.stringify(normalized)
        );

        // Scroll to bottom
        setTimeout(() => scrollToBottom(), 100);
      } else {
        console.error('❌ Failed to load messages:', response.error);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      
      // Try to load from cache
      const cached = await AsyncStorage.getItem(`conversation_${conversationId}`);
      if (cached) {
        setMessages(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Note: addMessage function removed - messages are now handled directly in socket listener
  // This ensures proper handling of new, updated, and deleted messages

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      // Send via socket only (matches web app implementation)
      console.log('📤 Sending message via socket:', {
        conversationId,
        messagePreview: messageText.substring(0, 50),
        type: 'text'
      });

      await socketService.sendMessage(
        conversationId,
        messageText,
        'provider',
        userName,
        'text'
      );

      console.log('✅ Message sent via socket, waiting for confirmation via message:new');
      // Message will be received via Socket.IO listener (no optimistic update)
    } catch (error) {
      console.error('❌ Error sending message:', error);
      Alert.alert('Грешка', 'Неуспешно изпращане на съобщението');
      setNewMessage(messageText); // Restore message
    } finally {
      setIsSending(false);
    }
  };

  const scrollToBottom = () => {
    if (flatListRef.current && messages.length > 0) {
      flatListRef.current.scrollToEnd({ animated: true });
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.senderType === 'provider' && item.senderName === userName;
    const isSystemMessage = item.senderType === 'system';

    if (isSystemMessage) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessage}>
            <Text style={styles.systemMessageText}>{item.body || item.message}</Text>
          </View>
        </View>
      );
    }

    // Survey request message
    if (item.messageType === 'survey_request') {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.surveyMessage}>
            <Text style={styles.surveyText}>{item.body || item.message}</Text>
            <TouchableOpacity
              style={styles.surveyButton}
              onPress={() => {
                setSurveyCaseId(item.caseId || '');
                setShowSurveyModal(true);
              }}
            >
              <Text style={styles.surveyButtonText}>⭐ Оценете услугата</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        {!isOwnMessage && (
          <Text style={styles.senderName}>{item.senderName}</Text>
        )}
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble
        ]}>
          <Text style={[
            styles.messageText,
            isOwnMessage && styles.ownMessageText
          ]}>
            {item.body || item.message}
          </Text>
        </View>
        <Text style={[
          styles.messageTime,
          isOwnMessage && styles.ownMessageTime
        ]}>
          {new Date(item.sentAt || item.timestamp || 0).toLocaleTimeString('bg-BG', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Зареждане...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>{providerName}</Text>
            <Text style={styles.headerSubtitle}>
              {socketService.isConnected() ? '🟢 Онлайн' : '⚪ Офлайн'}
            </Text>
          </View>
        </View>

        {/* Messages List - MUST have flex:1 to not push input off screen */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messagesList, { paddingBottom: 150 }]}
          onContentSizeChange={() => scrollToBottom()}
          style={{ flex: 1 }}
        />

        {/* Input Area - FIXED: Now always visible at bottom */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Напишете съобщение..."
            placeholderTextColor="#94A3B8"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
            maxLength={1000}
            editable={true}
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!newMessage.trim() || isSending) && styles.sendButtonDisabled
            ]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
            activeOpacity={0.7}
          >
            {isSending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>📤</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Floating Action Button - Create Case */}
        <TouchableOpacity
          style={styles.createCaseButton}
          onPress={() => setShowCaseModal(true)}
        >
          <Text style={styles.createCaseIcon}>📋</Text>
          <Text style={styles.createCaseText}>Създай заявка</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>

      {/* Modals */}
      <UnifiedCaseModal
        visible={showCaseModal}
        onClose={() => setShowCaseModal(false)}
        providerId={providerId}
        providerName={providerName}
        conversationId={conversationId}
        customerPhone={customerPhone}
      />

      <SurveyModal
        visible={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        caseId={surveyCaseId}
        providerId={providerId}
        providerName={providerName}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#CBD5E1',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  backButtonText: {
    fontSize: 28,
    color: '#6366F1',
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '75%',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  senderName: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  ownMessageBubble: {
    backgroundColor: '#6366F1',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    marginHorizontal: 12,
  },
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessage: {
    backgroundColor: 'rgba(59,130,246,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '80%',
  },
  systemMessageText: {
    fontSize: 13,
    color: '#93C5FD',
    textAlign: 'center',
  },
  surveyMessage: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    padding: 16,
    borderRadius: 16,
    maxWidth: '90%',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  surveyText: {
    fontSize: 14,
    color: '#E9D5FF',
    marginBottom: 12,
    textAlign: 'center',
  },
  surveyButton: {
    backgroundColor: '#A855F7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  surveyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 65,  // Position ABOVE the navigation bar (65px tall)
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#1E293B',  // Back to normal dark background
    borderTopWidth: 2,
    borderTopColor: '#6366F1',  // Blue border
    alignItems: 'flex-end',
    zIndex: 999,
  },
  messageInput: {
    flex: 1,
    backgroundColor: '#334155',  // Normal gray background
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    color: '#FFFFFF',  // White text
    maxHeight: 100,
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#475569',  // Subtle border
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendIcon: {
    fontSize: 20,
  },
  createCaseButton: {
    position: 'absolute',
    bottom: 150,  // Above input (which is at 65) + input height (~85)
    right: 20,
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1,
  },
  createCaseIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  createCaseText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ChatDetailScreen;
