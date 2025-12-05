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
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId: initialConversationId, providerId, providerName } = route.params as RouteParams;

  // Use state for the actual conversation ID (may change if we create a new conversation)
  const [actualConversationId, setActualConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState<'tradesperson' | 'customer' | 'admin'>('tradesperson');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCaseModal, setShowCaseModal] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyCaseId, setSurveyCaseId] = useState('');
  const [isNewConversation, setIsNewConversation] = useState(initialConversationId.startsWith('new_'));
  
  // Use refs to track initialization
  const isInitialized = useRef(false);
  const mountCount = useRef(0);
  
  const flatListRef = useRef<FlatList>(null);
  const socketService = SocketIOService.getInstance();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    mountCount.current += 1;
    console.log('🚀 ChatDetailScreen - Mount #' + mountCount.current, { initialConversationId, actualConversationId, isNewConversation });
    
    // Only initialize once
    if (!isInitialized.current) {
      isInitialized.current = true;
      initializeChat();
    }
    
    return () => {
      console.log('🧹 ChatDetailScreen - Unmounting');
    };
  }, []);

  // Handle socket room joining when actualConversationId changes
  useEffect(() => {
    // Don't join room if it's still a "new_" conversation
    if (actualConversationId.startsWith('new_')) {
      console.log('⏳ Waiting for real conversation ID before joining room...');
      return;
    }

    console.log('🔌 ChatDetailScreen - Joining conversation room:', actualConversationId);
    socketService.joinConversation(actualConversationId);

    // Listen for new messages
    const unsubscribeMessage = socketService.onNewMessage((message: any) => {
      console.log('💬 ChatDetailScreen - New message received:', message);
      
      // Only add if it belongs to this conversation
      if (message.conversationId === actualConversationId) {
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
      console.log('🧹 ChatDetailScreen - Leaving conversation:', actualConversationId);
      socketService.leaveConversation(actualConversationId);
      unsubscribeMessage();
    };
  }, [actualConversationId]);

  const initializeChat = async () => {
    console.log('🚀 ChatDetailScreen - Initializing chat for conversation:', initialConversationId);
    try {
      // Get current user
      console.log('👤 Getting current user...');
      const userResponse = await ApiService.getInstance().getCurrentUser();
      console.log('👤 User response:', userResponse);
      const userData: any = (userResponse.data as any)?.user || userResponse.data;
      
      if (userData) {
        setUserId(userData.id);
        setUserRole(userData.role);
        const name = `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'User';
        setUserName(name);
        setUserEmail(userData.email || '');
        setCustomerPhone(userData.phoneNumber || userData.phone_number || '');
      
        // Initialize Socket.IO if not already connected
        const token = await AsyncStorage.getItem('auth_token');
        if (token && !socketService.isConnected()) {
          await socketService.connect(token, userData.id);
        }

        // If this is a new conversation, create it now
        if (initialConversationId.startsWith('new_')) {
          console.log('📝 Creating new conversation with provider:', providerId);
          const createResponse = await ApiService.getInstance().createConversation({
            providerId: providerId,
            customerName: name,
            customerEmail: userData.email || 'unknown@customer.com',
            customerPhone: userData.phoneNumber || userData.phone_number,
            chatSource: 'searchchat'
          });
          
          if (createResponse.success && createResponse.data) {
            const realConversationId = (createResponse.data as any).conversation?.id || (createResponse.data as any).id;
            console.log('✅ Created conversation with ID:', realConversationId);
            setActualConversationId(realConversationId);
            setIsNewConversation(false);
            // Load messages for the new conversation
            await loadMessagesForConversation(realConversationId);
          } else {
            console.error('❌ Failed to create conversation:', createResponse.error);
            Alert.alert('Грешка', 'Не успяхме да създадем чат. Моля, опитайте отново.');
          }
        } else {
          // Load messages for existing conversation
          await loadMessagesForConversation(initialConversationId);
        }
      }

    } catch (error) {
      console.error('❌ ChatDetailScreen - Error initializing chat:', error);
      Alert.alert('Грешка', 'Не успяхме да заредим чата. Моля, опитайте отново.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessagesForConversation = async (convId: string) => {
    try {
      console.log('📥 Loading messages for conversation:', convId);
      const response = await ApiService.getInstance().getMessages(convId);
      
      if (response.success && response.data) {
        const loadedMessages = (response.data as any).messages || [];
        setMessages(loadedMessages);
        console.log(`✅ Loaded ${loadedMessages.length} messages`);
        
        // Scroll to bottom after messages load (with delays for layout)
        setTimeout(() => scrollToBottom(), 100);
        setTimeout(() => scrollToBottom(), 300);
        setTimeout(() => scrollToBottom(), 500);
        
        // Mark messages as read when entering the conversation
        await markMessagesAsReadForConversation(convId);
      } else {
        console.error('❌ Failed to load messages:', response.error);
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const markMessagesAsReadForConversation = async (convId: string) => {
    try {
      // Get the user role to determine senderType
      const userJson = await AsyncStorage.getItem('user');
      if (!userJson) return;
      
      const parsed = JSON.parse(userJson);
      const user = parsed.user || parsed;
      const role = user.role;
      
      // Determine senderType (opposite of what we are - we're reading their messages)
      const senderType = role === 'customer' ? 'customer' : 'provider';
      
      console.log('✅ Marking messages as read for conversation:', convId, 'senderType:', senderType);
      const response = await ApiService.getInstance().markMessagesAsRead(convId, senderType);
      
      if (response.success) {
        console.log('✅ Messages marked as read successfully');
      } else {
        console.warn('⚠️ Failed to mark messages as read:', response.error);
      }
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;
    
    // Don't allow sending to new_ conversations (should be created first)
    if (actualConversationId.startsWith('new_')) {
      console.warn('⚠️ Cannot send message - conversation not yet created');
      Alert.alert('Моля изчакайте', 'Чатът се създава...');
      return;
    }

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);
    Keyboard.dismiss();

    try {
      // Send via socket only (matches web app implementation)
      console.log('📤 Sending message via socket:', {
        conversationId: actualConversationId,
        messagePreview: messageText.substring(0, 50),
        type: 'text',
        senderType: userRole === 'customer' ? 'customer' : 'provider'
      });

      await socketService.sendMessage(
        actualConversationId,
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
          <TouchableOpacity 
            style={styles.headerActionButton}
            onPress={() => setShowCaseModal(true)}
          >
            <Text style={styles.headerActionIcon}>📋</Text>
            <Text style={styles.headerActionText}>Заявка</Text>
          </TouchableOpacity>
        </View>

        {/* Messages List - MUST have flex:1 to not push input off screen */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.messagesList, { paddingBottom: 80 }]}
          onContentSizeChange={() => scrollToBottom()}
          onLayout={() => setTimeout(() => scrollToBottom(), 100)}
          style={{ flex: 1 }}
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
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

      </KeyboardAvoidingView>

      {/* Modals */}
      <UnifiedCaseModal
        visible={showCaseModal}
        onClose={() => setShowCaseModal(false)}
        providerId={providerId}
        providerName={providerName}
        conversationId={actualConversationId}
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
  headerActionButton: {
    backgroundColor: '#6366F1',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  headerActionIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  headerActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default ChatDetailScreen;
