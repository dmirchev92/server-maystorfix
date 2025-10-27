// Core types for ServiceText Pro

export interface CallRecord {
  id: string;
  phoneNumber: string;
  timestamp: number;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  contactName?: string;
  contactId?: string;
  isSpam?: boolean;
  metadata?: {
    source?: string;
    formattedTime?: string;
    [key: string]: any;
  };
}

export interface Contact {
  id: string;
  name: string;
  phoneNumbers: string[];
  category: ContactCategory;
  priority: ContactPriority;
  serviceHistory?: ServiceRecord[];
  preferences?: ContactPreferences;
  metadata?: ContactMetadata;
}

export type ContactCategory = 
  | 'existing_customer' 
  | 'new_prospect' 
  | 'supplier' 
  | 'emergency' 
  | 'personal'
  | 'blacklisted';

export type ContactPriority = 'low' | 'medium' | 'high' | 'vip';

export interface ServiceRecord {
  id: string;
  date: number;
  serviceType: ServiceType;
  description: string;
  cost: number;
  status: 'completed' | 'pending' | 'cancelled';
}

export type ServiceType = 
  | 'electrical' // електрически услуги
  | 'plumbing'   // ВиК услуги
  | 'hvac'       // отопление и климатизация
  | 'general';

export interface ContactPreferences {
  preferredPlatform: MessagingPlatform;
  preferredContactTime?: TimeRange;
  language: 'bg' | 'en';
}

export interface ContactMetadata {
  lastContactDate?: number;
  totalCalls: number;
  totalMissedCalls: number;
  responseRate: number;
  averageJobValue?: number;
}

export interface TimeRange {
  start: string; // HH:mm format
  end: string;   // HH:mm format
}

export type MessagingPlatform = 'whatsapp' | 'viber' | 'telegram';

export interface CallEvent {
  id: string;
  callRecord: CallRecord;
  contact?: Contact;
  timestamp: number;
  processed: boolean;
  responseTriggered: boolean;
}

export interface BusinessHours {
  enabled: boolean;
  isActive: boolean;
  schedule: WeeklySchedule;
  timezone: string;
}

export interface WeeklySchedule {
  monday?: TimeRange;
  tuesday?: TimeRange;
  wednesday?: TimeRange;
  thursday?: TimeRange;
  friday?: TimeRange;
  saturday?: TimeRange;
  sunday?: TimeRange;
}

export interface EmergencyKeyword {
  keyword: string;
  language: 'bg' | 'en';
  urgencyLevel: 'high' | 'critical';
}

// Bulgarian emergency keywords
export const BULGARIAN_EMERGENCY_KEYWORDS: EmergencyKeyword[] = [
  { keyword: 'спешно', language: 'bg', urgencyLevel: 'high' },
  { keyword: 'авария', language: 'bg', urgencyLevel: 'critical' },
  { keyword: 'парене', language: 'bg', urgencyLevel: 'critical' },
  { keyword: 'искри', language: 'bg', urgencyLevel: 'critical' },
  { keyword: 'току що', language: 'bg', urgencyLevel: 'high' },
  { keyword: 'веднага', language: 'bg', urgencyLevel: 'high' },
  { keyword: 'незабавно', language: 'bg', urgencyLevel: 'high' },
  { keyword: 'опасно', language: 'bg', urgencyLevel: 'critical' },
  { keyword: 'не работи', language: 'bg', urgencyLevel: 'high' },
];

export interface AppState {
  isEnabled: boolean;
  currentMode: AppMode;
  businessHours: BusinessHours;
  emergencyMode: boolean;
}

export type AppMode = 
  | 'normal'        // Normal operation
  | 'job_site'      // On job site - automatic unavailable responses
  | 'vacation'      // Vacation mode with alternative contacts
  | 'emergency_only'; // Only respond to emergency calls



