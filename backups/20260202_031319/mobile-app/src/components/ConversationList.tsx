import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface Conversation {
  id: string;
  customerPhone: string;
  customerName?: string;
  status: 'ai_active' | 'ivan_taken_over' | 'closed' | 'handoff_requested';
  messages: any[];
  lastActivity: string;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  platform: 'viber' | 'whatsapp' | 'telegram';
  aiConfidence?: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  onConversationSelect: (conversation: Conversation) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  onConversationSelect,
  isLoading = false,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');

  const filteredConversations = useMemo(() => {
    return conversations.filter(conversation => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        conversation.customerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conversation.customerPhone.includes(searchQuery);

      // Status filter
      const matchesStatus = statusFilter === 'all' || conversation.status === statusFilter;

      // Urgency filter
      const matchesUrgency = urgencyFilter === 'all' || conversation.urgency === urgencyFilter;

      return matchesSearch && matchesStatus && matchesUrgency;
    });
  }, [conversations, searchQuery, statusFilter, urgencyFilter]);

  const getStatusColor = (status: string): string => {
    const colors = {
      ai_active: '#3498db',
      ivan_taken_over: '#27ae60',
      closed: '#95a5a6',
      handoff_requested: '#f39c12',
    };
    return colors[status as keyof typeof colors] || '#95a5a6';
  };

  const getStatusLabel = (status: string): string => {
    const labels = {
      ai_active: 'AI активен',
      ivan_taken_over: 'Иван пое',
      closed: 'Затворен',
      handoff_requested: 'Изисква поемане',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getUrgencyColor = (urgency: string): string => {
    const colors = {
      low: '#27ae60',
      medium: '#f39c12',
      high: '#e67e22',
      emergency: '#e74c3c',
    };
    return colors[urgency as keyof typeof colors] || '#95a5a6';
  };

  const getUrgencyLabel = (urgency: string): string => {
    const labels = {
      low: 'Ниско',
      medium: 'Средно',
      high: 'Високо',
      emergency: 'Спешно',
    };
    return labels[urgency as keyof typeof labels] || urgency;
  };

  const getPlatformIcon = (platform: string): string => {
    const icons = {
      viber: '💜',
      whatsapp: '💚',
      telegram: '💙',
    };
    return icons[platform as keyof typeof icons] || '📱';
  };

  const formatLastActivity = (timestamp: string): string => {
    const now = new Date();
    const last = new Date(timestamp);
    const diffMs = now.getTime() - last.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Сега';
    if (diffMins < 60) return `${diffMins}м`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}ч`;
    return `${Math.floor(diffMins / 1440)}д`;
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={styles.conversationItem}
      onPress={() => onConversationSelect(item)}
    >
      <View style={styles.conversationHeader}>
        <View style={styles.customerInfo}>
          <Text style={styles.customerName}>
            {item.customerName || item.customerPhone}
          </Text>
          <Text style={styles.customerPhone}>
            {item.customerPhone}
          </Text>
        </View>
        
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>
              {getStatusLabel(item.status)}
            </Text>
          </View>
          
          {item.urgency && (
            <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor(item.urgency) }]}>
              <Text style={styles.urgencyText}>
                {getUrgencyLabel(item.urgency)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.conversationMeta}>
        <View style={styles.platformInfo}>
          <Text style={styles.platformIcon}>
            {getPlatformIcon(item.platform)}
          </Text>
          <Text style={styles.platformText}>
            {item.platform.toUpperCase()}
          </Text>
        </View>

        <View style={styles.activityInfo}>
          <Text style={styles.lastActivity}>
            {formatLastActivity(item.lastActivity)}
          </Text>
          {item.aiConfidence && (
            <Text style={styles.confidenceText}>
              AI: {Math.round(item.aiConfidence * 100)}%
            </Text>
          )}
        </View>
      </View>

      <View style={styles.messagePreview}>
        <Text style={styles.messagePreviewText} numberOfLines={2}>
          {item.messages[item.messages.length - 1]?.text || 'Няма съобщения'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFilterChips = () => (
    <View style={styles.filterContainer}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="🔍 Търси клиенти..."
          placeholderTextColor="#95a5a6"
        />
      </View>

      <View style={styles.filterChips}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'all' && styles.filterChipActive
          ]}
          onPress={() => setStatusFilter('all')}
        >
          <Text style={[
            styles.filterChipText,
            statusFilter === 'all' && styles.filterChipTextActive
          ]}>
            Всички
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'ai_active' && styles.filterChipActive
          ]}
          onPress={() => setStatusFilter('ai_active')}
        >
          <Text style={[
            styles.filterChipText,
            statusFilter === 'ai_active' && styles.filterChipTextActive
          ]}>
            AI активни
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'ivan_taken_over' && styles.filterChipActive
          ]}
          onPress={() => setStatusFilter('ivan_taken_over')}
        >
          <Text style={[
            styles.filterChipText,
            statusFilter === 'ivan_taken_over' && styles.filterChipTextActive
          ]}>
            Иван пое
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterChip,
            statusFilter === 'handoff_requested' && styles.filterChipActive
          ]}
          onPress={() => setStatusFilter('handoff_requested')}
        >
          <Text style={[
            styles.filterChipText,
            statusFilter === 'handoff_requested' && styles.filterChipTextActive
          ]}>
            Изискват поемане
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.urgencyFilters}>
        <TouchableOpacity
          style={[
            styles.urgencyChip,
            urgencyFilter === 'all' && styles.urgencyChipActive
          ]}
          onPress={() => setUrgencyFilter('all')}
        >
          <Text style={[
            styles.urgencyChipText,
            urgencyFilter === 'all' && styles.urgencyChipTextActive
          ]}>
            Всички
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.urgencyChip,
            urgencyFilter === 'emergency' && styles.urgencyChipEmergency
          ]}
          onPress={() => setUrgencyFilter('emergency')}
        >
          <Text style={[
            styles.urgencyChipText,
            urgencyFilter === 'emergency' && styles.urgencyChipTextActive
          ]}>
            🚨 Спешни
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
        <Text style={styles.loadingText}>Зареждане на разговори...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderFilterChips()}
      
      <View style={styles.statsContainer}>
        <Text style={styles.statsTitle}>
          {filteredConversations.length} разговора
        </Text>
        <Text style={styles.statsSubtitle}>
          {conversations.filter(c => c.status === 'ai_active').length} AI активни, 
          {conversations.filter(c => c.status === 'handoff_requested').length} изискват поемане
        </Text>
      </View>

      <FlatList
        data={filteredConversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Няма разговори, отговарящи на филтрите
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  filterContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
    marginBottom: 8,
  },
  filterChipActive: {
    backgroundColor: '#3498db',
  },
  filterChipText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  urgencyFilters: {
    flexDirection: 'row',
  },
  urgencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  urgencyChipActive: {
    backgroundColor: '#27ae60',
  },
  urgencyChipEmergency: {
    backgroundColor: '#e74c3c',
  },
  urgencyChipText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  urgencyChipTextActive: {
    color: '#fff',
  },
  statsContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 4,
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  listContainer: {
    padding: 16,
  },
  conversationItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  customerInfo: {
    flex: 1,
    marginRight: 12,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 4,
  },
  customerPhone: {
    fontSize: 14,
    color: '#7f8c8d',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  urgencyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  conversationMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  platformIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  platformText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontWeight: '600',
  },
  activityInfo: {
    alignItems: 'flex-end',
  },
  lastActivity: {
    fontSize: 12,
    color: '#95a5a6',
    marginBottom: 2,
  },
  confidenceText: {
    fontSize: 11,
    color: '#3498db',
    fontWeight: '600',
  },
  messagePreview: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  messagePreviewText: {
    fontSize: 14,
    color: '#7f8c8d',
    lineHeight: 18,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#7f8c8d',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#95a5a6',
    textAlign: 'center',
  },
});

export default ConversationList;




