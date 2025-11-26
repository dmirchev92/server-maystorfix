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
  Keyboard,
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
  providerId: string; // This is now generic recipientId
  providerName: string; // This is now generic recipientName
}

function ChatDetailScreen() {
  console.log('🚀 ChatDetailScreen - Component Mounting');
  const route = useRoute();
  const navigation = useNavigation();
  console.log('🚀 ChatDetailScreen - Params:', route.params);
  const { conversationId, providerId, providerName } = route.params as RouteParams;

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'tradesperson' | 'customer' | 'admin'>('tradesperson');
  const [userName, setUserName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyCaseId, setSurveyCaseId] = useState('');
  
  const flatListRef = useRef<FlatList>(null);
  const socketService = SocketIOService.getInstance();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ... normalizeMessage helper ...

  useEffect(() => {
    initializeChat();
    
    // Join conversation room
    console.log('🔌 ChatDetailScreen - Joining conversation room:', conversationId);
    socketService.joinConversation(conversationId);

    // Listen for new messages
    const unsubscribeMessage = socketService.onNewMessage((message: any) => {
      console.log('💬 ChatDetailScreen - New message received:', message);
      
      // Only add if it belongs to this conversation
      if (message.conversationId === conversationId) {
        setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === message.id)) return prev;
            // Add to list
            return [...prev, message];
        });
        
        // Scroll to bottom on new message
        setTimeout(() => scrollToBottom(), 100);
      }
    });

    return () => {
      console.log('🧹 ChatDetailScreen - Unmounting, leaving conversation');
      socketService.leaveConversation(conversationId);
      unsubscribeMessage();
    };
  }, [conversationId]);

  const initializeChat = async () => {
    console.log('🚀 ChatDetailScreen - Initializing chat for conversation:', conversationId);
    try {
      // Get current user
      console.log('👤 Getting current user...');
      const userResponse = await ApiService.getInstance().getCurrentUser();
      console.log('👤 User response:', userResponse);
      const userData: any = (userResponse.data as any)?.user || userResponse.data;
      
      if (userData) {
        setUserId(userData.id);
        setUserRole(userData.role);
        setUserName(`${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User');
        setCustomerPhone(userData.phoneNumber || userData.phone_number || '');
      
        // Initialize Socket.IO if not already connected
        const token = await AsyncStorage.getItem('auth_token');
        if (token && !socketService.isConnected()) {
          // ... connection logic ...
          await socketService.connect(token, userData.id);
        }
      }

      // Load messages
      await loadMessages();

    } catch (error) {
      console.error('❌ ChatDetailScreen - Error initializing chat:', error);
      Alert.alert('Error', 'Failed to load chat. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      console.log('📥 Loading messages for conversation:', conversationId);
      const response = await ApiService.getInstance().getMessages(conversationId);
      
      if (response.success && response.data) {
        const loadedMessages = (response.data as any).messages || [];
        setMessages(loadedMessages);
        console.log(`✅ Loaded ${loadedMessages.length} messages`);
      } else {
        console.error('❌ Failed to load messages:', response.error);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

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
        type: 'text',
        senderType: userRole === 'customer' ? 'customer' : 'provider'
      });

      await socketService.sendMessage(
        conversationId,
        messageText,
        userRole === 'customer' ? 'customer' : 'provider',
        userName,
        'text'
      );

      // ... rest of send logic ...
    } catch (error) {
      // ... error handling ...
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
    // Check if message is from current user
    // Simplified logic: If sender role matches my role, it's me.
    // This assumes a strict 1:1 Customer-Provider relationship in chat.
    let isOwnMessage = false;
    
    if (userRole === 'customer') {
      // I am customer -> messages from 'customer' are mine
      isOwnMessage = item.senderType === 'customer';
    } else {
      // I am provider/admin -> messages from 'provider' are mine
      isOwnMessage = item.senderType === 'provider';
    }
    
    // Fallback/Safety: specific ID check if roles are ambiguous (e.g. admin chatting)
    if (item.senderUserId && userId && item.senderUserId === userId) {
      isOwnMessage = true;
    }
                        
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
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
          contentContainerStyle={[styles.messagesList, { paddingBottom: 80 }]}
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
            onSubmitEditing={handleSendMessage}
            onFocus={() => setTimeout(() => scrollToBottom(), 300)}
            returnKeyType="send"
            blurOnSubmit={false}
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
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    alignSelf: 'flex-end',
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
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 16,
    backgroundColor: '#1E293B',
    borderTopWidth: 2,
    borderTopColor: '#6366F1',
    alignItems: 'flex-end',
    marginBottom: 65,  // Space for tab bar
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
    bottom: 165,  // Above input area + tab bar
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
