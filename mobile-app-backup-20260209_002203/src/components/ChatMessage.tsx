import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface ChatMessageProps {
  message: {
    id: string;
    text: string;
    sender: 'customer' | 'ai' | 'ivan';
    timestamp: string;
    isTyping?: boolean;
    isRead?: boolean;
    metadata?: {
      platform: 'viber' | 'whatsapp' | 'telegram';
      messageId?: string;
      deliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
    };
  };
  isOwnMessage: boolean;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, isOwnMessage }) => {
  const getSenderLabel = (sender: string): string => {
    const labels = {
      customer: 'Клиент',
      ai: 'AI Асистент',
      ivan: 'Вие',
    };
    return labels[sender as keyof typeof labels] || sender;
  };

  const getSenderColor = (sender: string): string => {
    const colors = {
      customer: '#2c3e50',
      ai: '#3498db',
      ivan: '#27ae60',
    };
    return colors[sender as keyof typeof colors] || '#7f8c8d';
  };

  const getDeliveryStatusIcon = (status?: string): string => {
    const icons = {
      sent: '✓',
      delivered: '✓✓',
      read: '✓✓',
      failed: '✗',
    };
    return icons[status as keyof typeof icons] || '';
  };

  const getDeliveryStatusColor = (status?: string): string => {
    const colors = {
      sent: '#95a5a6',
      delivered: '#3498db',
      read: '#27ae60',
      failed: '#e74c3c',
    };
    return colors[status as keyof typeof colors] || '#95a5a6';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Сега';
    if (diffMins < 60) return `${diffMins}м`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}ч`;
    return date.toLocaleDateString('bg-BG', { 
      day: '2-digit', 
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPlatformIcon = (platform?: string): string => {
    const icons = {
      viber: '💜',
      whatsapp: '💚',
      telegram: '💙',
    };
    return icons[platform as keyof typeof icons] || '📱';
  };

  if (message.isTyping) {
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
        <View style={[styles.typingIndicator, isOwnMessage && styles.ownTypingIndicator]}>
          <Text style={styles.typingText}>Пише...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.messageContainer, isOwnMessage && styles.ownMessageContainer]}>
      {!isOwnMessage && (
        <View style={styles.senderInfo}>
          <Text style={[styles.senderLabel, { color: getSenderColor(message.sender) }]}>
            {getSenderLabel(message.sender)}
          </Text>
          {message.metadata?.platform && (
            <Text style={styles.platformIcon}>
              {getPlatformIcon(message.metadata.platform)}
            </Text>
          )}
        </View>
      )}
      
      <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
        <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
          {message.text}
        </Text>
      </View>
      
      <View style={styles.messageMeta}>
        <Text style={styles.timestamp}>
          {formatTimestamp(message.timestamp)}
        </Text>
        
        {isOwnMessage && message.metadata?.deliveryStatus && (
          <View style={styles.deliveryStatus}>
            <Text style={[
              styles.deliveryStatusIcon,
              { color: getDeliveryStatusColor(message.metadata.deliveryStatus) }
            ]}>
              {getDeliveryStatusIcon(message.metadata.deliveryStatus)}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  messageContainer: {
    marginBottom: 16,
    maxWidth: '85%',
    minWidth: 120,
    alignSelf: 'flex-start',
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  senderLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  platformIcon: {
    fontSize: 14,
  },
  messageBubble: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    minWidth: 100,
    flexShrink: 1,
  },
  ownMessageBubble: {
    backgroundColor: '#3498db',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
    minWidth: 100,
    flexShrink: 1,
  },
  messageText: {
    fontSize: 16,
    color: '#2c3e50',
    lineHeight: 22,
    flexWrap: 'wrap',
    flexShrink: 1,
  },
  ownMessageText: {
    color: '#fff',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  timestamp: {
    fontSize: 11,
    color: '#95a5a6',
  },
  deliveryStatus: {
    marginLeft: 8,
  },
  deliveryStatusIcon: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  typingIndicator: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
  },
  ownTypingIndicator: {
    backgroundColor: '#3498db',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  typingText: {
    fontSize: 14,
    color: '#7f8c8d',
    fontStyle: 'italic',
  },
});

export default ChatMessage;
