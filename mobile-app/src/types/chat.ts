export interface Message {
  id: string;
  conversationId: string;
  senderType: 'customer' | 'provider' | 'system';
  senderUserId?: string | null;  // Chat API V2 field
  senderName: string;
  type: 'text' | 'image' | 'file' | 'system' | 'case_template' | 'service_request' | 'case_created' | 'case_filled' | 'survey';  // Chat API V2
  body: string;  // Chat API V2 uses 'body' not 'message'
  sentAt: string;  // Chat API V2 uses 'sentAt' not 'timestamp'
  editedAt?: string | null;
  deletedAt?: string | null;
  isRead: boolean;
  // Legacy/compatibility fields
  message?: string;  // For backward compatibility, maps to body
  messageType?: string;  // Legacy field
  timestamp?: string;  // For backward compatibility, maps to sentAt
  data?: any;
  caseId?: string;
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
  providerServiceCategory?: string;
  status: 'active' | 'archived';
  lastMessageAt: string;  // Chat API V2 uses lastMessageAt
  createdAt: string;
  // Optional fields for UI
  lastMessage?: string;
  unreadCount?: number;
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
