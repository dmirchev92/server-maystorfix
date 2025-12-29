import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MainTabParamList } from '../navigation/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SocketIOService from '../services/SocketIOService';
import ApiService from '../services/ApiService';
import { Conversation } from '../types/chat';
import theme from '../styles/theme';

type ChatScreenNavigationProp = StackNavigationProp<MainTabParamList, 'Chat'>;

function ChatScreen() {
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userId, setUserId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Socket.IO is now initialized globally in App.tsx
  // No need to initialize here anymore

  // Load conversations when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 ChatScreen - Screen focused, loading conversations');
      
      // Pre-load userId from storage to avoid "userId missing" errors
      AsyncStorage.getItem('user').then(userJson => {
        if (userJson) {
            const parsed = JSON.parse(userJson);
            // Handle both wrapped {user: {...}} and unwrapped {...} formats
            const user = parsed.user || parsed;
            
            if (user && user.id) {
                console.log('📱 ChatScreen - Pre-loaded user ID:', user.id);
                setUserId(user.id);
                setUserRole(user.role);
            }
        }
      });

      loadConversations();
      
      // Set up socket listener for conversation updates
      const socketService = SocketIOService.getInstance();
      
      // Listen for new messages
      const unsubscribeMessage = socketService.onNewMessage((message: any) => {
        console.log('📱 ChatScreen - New message received, updating conversation preview:', message);
        // Update the conversation's last message and timestamp
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === message.conversationId);
          if (index >= 0) {
            const updated = [...prev];
            const messageText = (message.body || message.message || '').toString();
            updated[index] = {
              ...updated[index],
              lastMessage: messageText,
              lastMessageAt: message.sentAt || message.timestamp || new Date().toISOString(),
            };
            // Move to top
            const [conversation] = updated.splice(index, 1);
            console.log('✅ ChatScreen - Conversation updated and moved to top:', conversation.id);
            return [conversation, ...updated];
          } else {
            console.log('⚠️ ChatScreen - Conversation not found in list:', message.conversationId);
          }
          return prev;
        });
      });
      
      // Listen for conversation updates (includes unread count changes)
      const unsubscribeConversation = socketService.onConversationUpdate((data: any) => {
        console.log('📱 ChatScreen - Conversation update received:', data);
        console.log('📱 ChatScreen - lastMessage from socket:', data.lastMessage);
        // Update conversation preview with socket data (includes unreadCount and lastMessage)
        setConversations(prev => {
          const index = prev.findIndex(c => c.id === data.conversationId);
          if (index >= 0) {
            const updated = [...prev];
            updated[index] = {
              ...updated[index],
              lastMessage: data.lastMessage || updated[index].lastMessage, // Keep existing if not provided
              lastMessageAt: data.lastMessageAt,
              unreadCount: data.unreadCount
            };
            // Move to top
            const [conversation] = updated.splice(index, 1);
            console.log('✅ ChatScreen - Conversation preview updated via socket:', conversation.id);
            console.log('✅ ChatScreen - Updated lastMessage:', conversation.lastMessage);
            return [conversation, ...updated];
          } else {
            console.log('⚠️ ChatScreen - Conversation not found in list:', data.conversationId);
          }
          return prev;
        });
      });
      
      return () => {
        unsubscribeMessage();
        unsubscribeConversation();
      };
    }, [])
  );


  const loadConversations = async (silent = false) => {
    try {
      if (!silent) {
        setIsLoading(true);
        setError(null);
      }

      console.log('📱 ChatScreen - Starting to load conversations');

      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        console.log('⚠️ No auth token');
        setError('Няма токен за автентикация');
        setIsLoading(false);
        return;
      }

      // Get current user
      console.log('📱 ChatScreen - Getting current user');
      const userResponse = await ApiService.getInstance().getCurrentUser();
      console.log('📱 ChatScreen - User response:', userResponse);
      
      const userData: any = (userResponse.data as any)?.user || userResponse.data;
      console.log('📱 ChatScreen - User data:', userData);

      if (!userData || !userData.id) {
        console.error('❌ No user ID found');
        setError('Данните за потребителя не са налични');
        setIsLoading(false);
        return;
      }

      // Update state and storage with fresh user data
      setUserId(userData.id);
      if (userData.role) {
        setUserRole(userData.role);
      }
      
      // Persist to storage to ensure handleConversationPress works even if state was lost
      AsyncStorage.setItem('user', JSON.stringify(userData)).catch(err => 
        console.error('Failed to update user in storage:', err)
      );

      // Load conversations from API using Chat API V2 (authenticated user)
      console.log('📱 ChatScreen - Loading conversations via Chat API V2');
      const response = await ApiService.getInstance().getConversations();
      
      console.log('📱 ChatScreen - Full API response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        // Chat API V2 returns: { success: true, data: { conversations: [...] } }
        const conversationsList = (response.data as any).conversations || [];
        
        console.log(`✅ Loaded ${conversationsList.length} conversations`);
        
        // Deduplicate conversations by ID
        const uniqueConversations = conversationsList.filter((conv: any, index: number, self: any[]) =>
          index === self.findIndex((c: any) => c.id === conv.id)
        );
        
        console.log(`✅ After deduplication: ${uniqueConversations.length} conversations`);
        
        // Debug: Log first conversation to see structure
        if (uniqueConversations.length > 0) {
          console.log('📱 ChatScreen - First conversation:', JSON.stringify(uniqueConversations[0], null, 2));
        }
        
        setConversations(uniqueConversations);

        // Save to AsyncStorage (deduplicated)
        await AsyncStorage.setItem('conversations', JSON.stringify(uniqueConversations));
      } else {
        console.error('❌ Failed to load conversations:', response.error);
        console.error('❌ Full response:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('❌ Error loading conversations:', error);
      
      // Try to load from cache
      const cached = await AsyncStorage.getItem('conversations');
      if (cached) {
        setConversations(JSON.parse(cached));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const updateConversationInList = (updatedConversation: Conversation) => {
    setConversations(prev => {
      const index = prev.findIndex(c => c.id === updatedConversation.id);
      if (index >= 0) {
        // Update existing
        const newList = [...prev];
        newList[index] = updatedConversation;
        return newList;
      } else {
        // Add new
        return [updatedConversation, ...prev];
      }
    });
  };

  const handleConversationPress = async (conversation: Conversation) => {
    let currentUserId = userId;
    
    if (!currentUserId) {
      console.log('⚠️ userId missing in state, trying to fetch from storage...');
      try {
        const userJson = await AsyncStorage.getItem('user');
        console.log('📱 ChatScreen - Storage "user" content:', userJson);
        
        if (userJson) {
          const parsed = JSON.parse(userJson);
          // Handle both wrapped {user: {...}} and unwrapped {...} formats
          const user = parsed.user || parsed;
          
          if (user && user.id) {
             console.log('✅ Found user in storage:', user.id);
             currentUserId = user.id;
             setUserId(user.id);
             setUserRole(user.role);
          } else {
             console.error('❌ User object in storage missing ID:', user);
          }
        } else {
           console.error('❌ Storage "user" key is empty');
        }
      } catch (storageError) {
        console.error('❌ Error reading user from storage:', storageError);
      }
    }

    // Last resort: Try to fetch from API if we have a token
    if (!currentUserId) {
       console.log('⚠️ userId still missing, attempting API fetch as last resort...');
       try {
         const userResponse = await ApiService.getInstance().getCurrentUser();
         const userData: any = (userResponse.data as any)?.user || userResponse.data;
         if (userData && userData.id) {
            console.log('✅ Fetched user via API just in time:', userData.id);
            currentUserId = userData.id;
            setUserId(userData.id);
            AsyncStorage.setItem('user', JSON.stringify(userData));
         }
       } catch (apiError) {
          console.error('❌ Failed to fetch user via API in handleConversationPress:', apiError);
       }
    }

    if (!currentUserId) {
      console.error('❌ Cannot handle press: userId is missing even after storage check and API fallback');
      // Show alert to user
      Alert.alert('Грешка', 'Не можем да идентифицираме потребителя. Моля, излезте и влезте отново.');
      return;
    }

    // Determine who the OTHER person is
    // If I am the provider (providerId matches my ID), I'm talking to the customer
    const isMeProvider = conversation.providerId === currentUserId;
    
    // If I am the provider, target is customer. If I am customer, target is provider.
    const targetName = isMeProvider ? (conversation.customerName || 'Клиент') : (conversation.providerName || 'Доставчик');
    const targetId = isMeProvider ? conversation.customerId : conversation.providerId;

    console.log('📱 Opening chat with:', {
      myId: currentUserId,
      isMeProvider,
      targetName,
      targetId,
      conversationId: conversation.id
    });

    try {
      console.log('👉 Navigating to ChatDetail...');
      // Cast to any to bypass strict type checking for root stack navigation
      (navigation as any).navigate('ChatDetail', {
        conversationId: conversation.id,
        providerId: targetId || '',
        providerName: targetName || '',
      });
      console.log('✅ Navigation command dispatched');
    } catch (navError) {
      console.error('❌ Navigation failed:', navError);
      Alert.alert('Грешка', 'Не успяхме да отворим чата. Моля, опитайте отново.');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadConversations(true);
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return 'NaN';
    
    // Handle "YYYY-MM-DD HH:MM:SS" format from backend
    const date = new Date(timestamp.replace(' ', 'T'));
    
    if (isNaN(date.getTime())) return 'NaN';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Сега';
    if (diffMins < 60) return `${diffMins}м`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}ч`;
    return `${Math.floor(diffMins / 1440)}д`;
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    // Determine display name based on who I am
    // Note: We might not have userId immediately on first render if it's loading, 
    // so we fallback to showing "Chat" or try to infer. 
    // Ideally we rely on `userRole` state.
    
    let displayName = 'Чат';
    if (userId) {
        const isMeProvider = item.providerId === userId;
        displayName = isMeProvider ? (item.customerName || 'Клиент') : (item.providerName || 'Доставчик');
    } else {
        // Fallback if userId not loaded yet (should be rare due to isLoading)
        displayName = item.providerName || item.customerName || 'Чат';
    }

    return (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.avatarContainer}>
        {item.providerProfileImageUrl ? (
          <Image source={{ uri: item.providerProfileImageUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        {(item.unreadCount || 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.providerName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.timestamp}>
            {formatTime(item.lastMessageAt)}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {typeof item.lastMessage === 'string' 
            ? item.lastMessage 
            : (item.lastMessage as any)?.body || (item.lastMessage as any)?.message || 'Няма съобщения'}
        </Text>
      </View>
    </TouchableOpacity>
  );
  };

  if (isLoading && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>Зареждане на разговори...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💬 Съобщения</Text>
        <Text style={styles.headerSubtitle}>
          {conversations.length} {conversations.length === 1 ? 'разговор' : 'разговора'}
        </Text>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>💬</Text>
          <Text style={styles.emptyTitle}>Няма разговори</Text>
          <Text style={styles.emptyText}>
            Започнете разговор с доставчик на услуги
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversationItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#6366F1"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // slate-900 - matches CasesScreen
  },
  header: {
    padding: theme.spacing.lg,
    backgroundColor: '#1e293b', // slate-800 - matches CasesScreen header
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
  },
  headerTitle: {
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.h1.fontWeight,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.fontSize.md,
    color: '#cbd5e1', // slate-300
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.semibold,
    color: '#cbd5e1', // slate-300
    marginBottom: theme.spacing.xs,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: '#94a3b8', // slate-400
    textAlign: 'center',
  },
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 80, // Extra padding for bottom tab bar
  },
  conversationItem: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    backgroundColor: '#1e293b', // slate-800 - matches CasesScreen cards
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(71, 85, 105, 0.5)', // slate-700/50
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1', // indigo-500 - accent like CasesScreen
  },
  avatarContainer: {
    position: 'relative',
    marginRight: theme.spacing.md,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(99, 102, 241, 0.3)', // indigo-500/30
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6366f1', // indigo-500
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#6366f1', // indigo-500
  },
  avatarText: {
    fontSize: 20,
    fontWeight: theme.fontWeight.bold,
    color: '#a5b4fc', // indigo-300
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444', // red-500
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#1e293b', // slate-800 - matches card background
  },
  unreadText: {
    fontSize: 11,
    fontWeight: theme.fontWeight.bold,
    color: '#ffffff',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  providerName: {
    flex: 1,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.bold,
    color: '#cbd5e1', // slate-300
    marginRight: theme.spacing.sm,
  },
  timestamp: {
    fontSize: theme.fontSize.xs,
    color: '#94a3b8', // slate-400
    fontWeight: theme.fontWeight.medium,
  },
  lastMessage: {
    fontSize: theme.fontSize.sm,
    color: '#94a3b8', // slate-400
    lineHeight: 20,
  },
});

export default ChatScreen;
