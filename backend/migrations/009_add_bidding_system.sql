-- Migration 009: Add Bidding System
-- Implements points-based bidding for cases with max 3 bidders per case

-- Create case_bids table to track all bids
CREATE TABLE IF NOT EXISTS sp_case_bids (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    case_id TEXT NOT NULL REFERENCES marketplace_service_cases(id) ON DELETE CASCADE,
    provider_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    points_bid INTEGER NOT NULL, -- Points spent to bid
    bid_status TEXT NOT NULL DEFAULT 'pending' CHECK (bid_status IN ('pending', 'won', 'lost', 'refunded')),
    bid_order INTEGER NOT NULL, -- 1st, 2nd, or 3rd bidder
    points_deducted INTEGER NOT NULL DEFAULT 0, -- Actual points deducted (100% for winner, 20% for losers)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(case_id, provider_id) -- One bid per provider per case
);

-- Add bidding-related columns to marketplace_service_cases
ALTER TABLE marketplace_service_cases 
ADD COLUMN IF NOT EXISTS bidding_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS max_bidders INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS current_bidders INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bidding_closed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS winning_bid_id TEXT REFERENCES sp_case_bids(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS bidding_closed_at TIMESTAMP;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_case_bids_case_id ON sp_case_bids(case_id);
CREATE INDEX IF NOT EXISTS idx_case_bids_provider_id ON sp_case_bids(provider_id);
CREATE INDEX IF NOT EXISTS idx_case_bids_status ON sp_case_bids(bid_status);
CREATE INDEX IF NOT EXISTS idx_case_bids_created ON sp_case_bids(created_at);
CREATE INDEX IF NOT EXISTS idx_cases_bidding_enabled ON marketplace_service_cases(bidding_enabled) WHERE bidding_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_cases_current_bidders ON marketplace_service_cases(current_bidders);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_case_bids_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_case_bids_updated_at
    BEFORE UPDATE ON sp_case_bids
    FOR EACH ROW
    EXECUTE FUNCTION update_case_bids_updated_at();

-- Function to get available bidding slots for a case
CREATE OR REPLACE FUNCTION get_available_bid_slots(p_case_id TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_max_bidders INTEGER;
    v_current_bidders INTEGER;
BEGIN
    SELECT max_bidders, current_bidders 
    INTO v_max_bidders, v_current_bidders
    FROM marketplace_service_cases
    WHERE id = p_case_id;
    
    RETURN GREATEST(0, v_max_bidders - v_current_bidders);
END;
$$ LANGUAGE plpgsql;

-- Function to check if provider can bid on case
CREATE OR REPLACE FUNCTION can_provider_bid(p_case_id TEXT, p_provider_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_case_record RECORD;
    v_existing_bid_count INTEGER;
    v_provider_points INTEGER;
    v_required_points INTEGER;
BEGIN
    -- Get case details
    SELECT 
        bidding_enabled,
        bidding_closed,
        current_bidders,
        max_bidders,
        budget,
        customer_id
    INTO v_case_record
    FROM marketplace_service_cases
    WHERE id = p_case_id;
    
    -- Check if case exists
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider is the customer (can't bid on own case)
    IF v_case_record.customer_id = p_provider_id THEN
        RETURN FALSE;
    END IF;
    
    -- Check if bidding is enabled and not closed
    IF NOT v_case_record.bidding_enabled OR v_case_record.bidding_closed THEN
        RETURN FALSE;
    END IF;
    
    -- Check if slots available
    IF v_case_record.current_bidders >= v_case_record.max_bidders THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider already bid
    SELECT COUNT(*) INTO v_existing_bid_count
    FROM sp_case_bids
    WHERE case_id = p_case_id AND provider_id = p_provider_id;
    
    IF v_existing_bid_count > 0 THEN
        RETURN FALSE;
    END IF;
    
    -- Check if provider has enough points
    SELECT points_balance INTO v_provider_points
    FROM users
    WHERE id = p_provider_id;
    
    -- Calculate required points based on budget (reuse points cost logic)
    -- This will be validated in the application layer
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE sp_case_bids IS 'Tracks all bids placed by service providers on cases';
COMMENT ON COLUMN sp_case_bids.bid_order IS 'Order of bid placement (1-3), determines priority';
COMMENT ON COLUMN sp_case_bids.points_deducted IS 'Actual points deducted: 100% for winner, 20% for losers';
COMMENT ON COLUMN marketplace_service_cases.bidding_enabled IS 'Whether bidding is enabled for this case';
COMMENT ON COLUMN marketplace_service_cases.max_bidders IS 'Maximum number of bidders allowed (default 3)';
COMMENT ON COLUMN marketplace_service_cases.current_bidders IS 'Current number of active bidders';
COMMENT ON COLUMN marketplace_service_cases.winning_bid_id IS 'Reference to the winning bid after customer selection';
