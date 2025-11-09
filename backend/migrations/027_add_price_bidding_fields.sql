-- Migration: Add price bidding fields to sp_case_bids table
-- New bidding flow:
-- 1. SP pays 5 points to participate in bid
-- 2. SP proposes a budget range (e.g., "250-500")
-- 3. Customer reviews all bids and selects winner
-- 4. Winner pays full points based on their proposed range
-- 5. Losers keep only 5 points deducted (participation fee)

-- Add new columns for price bidding
ALTER TABLE sp_case_bids 
ADD COLUMN IF NOT EXISTS proposed_budget_range TEXT,
ADD COLUMN IF NOT EXISTS bid_comment TEXT,
ADD COLUMN IF NOT EXISTS participation_points INTEGER DEFAULT 5;

-- Add comments for documentation
COMMENT ON COLUMN sp_case_bids.proposed_budget_range IS 'SP proposed budget range (e.g., "250-500", "500-750", "2000+")';
COMMENT ON COLUMN sp_case_bids.bid_comment IS 'SP explanation of their approach and pricing';
COMMENT ON COLUMN sp_case_bids.participation_points IS 'Points paid to participate in bidding (default 5)';
COMMENT ON COLUMN sp_case_bids.points_bid IS 'Full points cost based on proposed budget range (charged only to winner)';
COMMENT ON COLUMN sp_case_bids.points_deducted IS 'Actual points deducted: 5 for losers, full amount for winner';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sp_case_bids_proposed_range ON sp_case_bids(proposed_budget_range);
