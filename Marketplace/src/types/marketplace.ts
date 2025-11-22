export type CaseStatus = 'pending' | 'accepted' | 'declined' | 'completed' | 'cancelled' | 'wip' | 'closed';

export interface CaseScreenshot {
  id: string;
  url: string;
  createdAt: string;
}

export interface Case {
  id: string;
  service_type: string;
  description: string;
  status: CaseStatus;
  category: string;
  priority: string;
  budget?: number;
  city?: string;
  neighborhood?: string;
  address?: string;
  phone: string;
  phone_masked?: boolean;
  preferred_date: string;
  preferred_time: string;
  provider_id?: string;
  provider_name?: string;
  customer_id?: string;
  assignment_type?: 'open' | 'specific';
  bidding_enabled?: boolean;
  current_bidders?: number;
  max_bidders?: number;
  bidding_closed?: boolean;
  square_meters?: number;
  created_at: string;
  updated_at: string;
  winning_bid_id?: string;
  winning_bid_price?: number;
  screenshots?: CaseScreenshot[];
}

export type BidStatus = 'pending' | 'won' | 'lost' | 'undeclined';

export interface Bid {
  id: string;
  case_id: string;
  bid_order: number | string;
  bid_status: BidStatus;
  description?: string;
  service_type?: string;
  proposed_budget_range: string;
  budget?: number;
  city?: string;
  case_status?: CaseStatus;
  created_at: string;
  points_bid: number;
  points_deducted?: number;
  bidding_closed?: boolean;
  bid_comment?: string;
}

export interface DashboardStats {
  available: number;
  accepted: number;
  declined: number;
  completed: number;
}

export interface FilterParams {
  status: string;
  category: string;
  city: string;
  neighborhood: string;
  viewMode: 'available' | 'assigned' | 'declined' | 'bids';
  page: number;
  limit: number;
  providerId?: string;
  customerId?: string;
  onlyUnassigned?: string;
  excludeDeclinedBy?: string;
}

export interface User {
  id: string;
  role: 'customer' | 'tradesperson' | 'service_provider' | 'admin';
  firstName: string;
  lastName: string;
}
