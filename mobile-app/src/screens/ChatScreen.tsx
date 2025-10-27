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
  const [error, setError] = useState<string | null>(null);

  // Socket.IO is now initialized globally in App.tsx
  // No need to initialize here anymore

  // Load conversations when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      console.log('📱 ChatScreen - Screen focused, loading conversations');
      loadConversations();
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
        setError('No authentication token found');
        setIsLoading(false);
        return;
      }

      // Get current user
      console.log('📱 ChatScreen - Getting current user');
      const userResponse = await ApiService.getInstance().getCurrentUser();
      console.log('📱 ChatScreen - User response:', userResponse);
      
      const userData: any = userResponse.data?.user || userResponse.data;
      console.log('📱 ChatScreen - User data:', userData);

      if (!userData || !userData.id) {
        console.error('❌ No user ID found');
        setError('User data not available');
        setIsLoading(false);
        return;
      }

      // Load conversations from API using Chat API V2 (authenticated user)
      console.log('📱 ChatScreen - Loading conversations via Chat API V2');
      const response = await ApiService.getInstance().getConversations();
      
      console.log('📱 ChatScreen - Full API response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        // Chat API V2 returns: { success: true, data: { conversations: [...] } }
        const conversationsList = response.data.conversations || [];
        
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

  const handleConversationPress = (conversation: Conversation) => {
    navigation.navigate('ChatDetail', {
      conversationId: conversation.id,
      providerId: conversation.providerId,
      providerName: conversation.customerName || 'Customer',
    });
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

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => handleConversationPress(item)}
    >
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.customerName || 'C').charAt(0).toUpperCase()}
          </Text>
        </View>
        {(item.unreadCount || 0) > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unreadCount}</Text>
          </View>
        )}
      </View>

      <View style={styles.conversationContent}>
        <View style={styles.conversationHeader}>
          <Text style={styles.providerName} numberOfLines={1}>
            {item.customerName || 'Customer'}
          </Text>
          <Text style={styles.timestamp}>
            {formatTime(item.lastMessageAt)}
          </Text>
        </View>
        <Text style={styles.lastMessage} numberOfLines={2}>
          {typeof item.lastMessage === 'string' 
            ? item.lastMessage 
            : item.lastMessage?.body || item.lastMessage?.message || 'Няма съобщения'}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
    backgroundColor: '#0F172A',
  },
  header: {
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#CBD5E1',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  listContent: {
    paddingVertical: 8,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  providerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
    color: '#94A3B8',
  },
  lastMessage: {
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
});

export default ChatScreen;
