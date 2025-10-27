export interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'provider' | 'system';
  senderId?: string;  // ID of the user who sent the message
  senderName: string;
  message: string;
  messageType?: 'text' | 'system' | 'survey_request' | 'case_created' | 'case_template' | 'service_request';
  timestamp: string;
  data?: any;
  caseId?: string;
  isRead?: boolean;
}

export interface Conversation {
  id: string;
  customerId: string;
  providerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  providerName?: string;
  providerBusinessName?: string;
  status: 'active' | 'closed';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceProvider {
  id: string;
  businessName?: string;
  firstName?: string;
  lastName?: string;
  serviceCategory?: string;
  description?: string;
  experienceYears?: number;
  hourlyRate?: number;
  city: string;
  neighborhood?: string;
  phoneNumber?: string;
  email?: string;
  rating: number;
  totalReviews?: number;
}

export interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  role: 'customer' | 'service_provider' | 'tradesperson';
}
