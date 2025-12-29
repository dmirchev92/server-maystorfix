/**
 * VIP Visibility Service
 * Manages VIP auctions, bidding, buyouts, and visibility for Service Providers
 */

import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';

// VIP Types
export type VipType = 'HOMEPAGE_VIP' | 'SEARCH_VIP';

// VIP Configuration (backend-driven, no hardcoded values in frontend)
export interface VipConfig {
  homepageVip: {
    startBidPoints: number;
    buyoutPoints: number;
    slotsPerCategory: number;
    labelBg: string;
  };
  searchVip: {
    startBidPoints: number;
    buyoutPoints: number;
    slotsPerCategory: number;
    labelBg: string;
  };
  minBidIncrement: number;
  maxBidPoints: number;
  auctionWindow: {
    dayOfWeek: number; // 0 = Sunday
    startHour: number;
    endHour: number;
    timezone: string;
    labelBg: string;
  };
  settlementWindow: {
    dayOfWeek: number;
    startHour: number;
    endHour: number;
    labelBg: string;
  };
  coverageWindow: {
    startDay: number; // 1 = Monday
    endDay: number;   // 0 = Sunday
    labelBg: string;
  };
  nextAuction: {
    startsAt: string;
    endsAt: string;
    settlementAt: string;
    coverageStart: string;
    coverageEnd: string;
  };
  isAuctionOpen: boolean;
  isSettlementInProgress: boolean;
}

export interface VipBid {
  id: string;
  user_id: string;
  service_category: string;
  city: string;
  bid_amount: number;
  currency: string; // 'HOMEPAGE_VIP' or 'SEARCH_VIP'
  status: 'open' | 'won' | 'lost' | 'buyout' | 'cancelled';
  priority_score: number;
  started_at: Date;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface VipPlacement {
  vipType: VipType;
  categoryId: string;
  categoryLabelBg: string;
  city: string | null;
  pointsSpent: number;
  rank: number;
  expiresAt: string;
}

export interface VipOverview {
  currentPlacements: VipPlacement[];
  pointsBalance: number;
  nextAuction: VipConfig['nextAuction'];
}

export interface VipAuction {
  vipType: VipType;
  categoryId: string;
  categoryLabelBg: string;
  city: string | null;
  startBidPoints: number;
  buyoutPoints: number;
  currentBid: number | null;
  currentRank: number | null;
  slotsRemaining: number;
  buyoutsTaken: number;
}

export interface LeaderboardEntry {
  rank: number;
  providerName: string;
  businessName: string;
  city: string;
  bidAmount: number;
  isCurrentUser: boolean;
  isBuyout: boolean;
}

export interface LeaderboardResponse {
  isAuctionOpen: boolean;
  bids: LeaderboardEntry[];
  buyoutsTaken: number;
  slotsRemaining: number;
}

export interface BidResult {
  success: boolean;
  bidId?: string;
  newBidAmount?: number;
  rank?: number;
  message: string;
  error?: { code: string; message: string };
}

export interface BuyoutResult {
  success: boolean;
  bidId?: string;
  pointsDeducted?: number;
  newPointsBalance?: number;
  message: string;
  error?: { code: string; message: string };
}

export class VipService {
  private database: PostgreSQLDatabase;
  private pool: Pool;

  // VIP Configuration Constants
  private readonly CONFIG = {
    HOMEPAGE_VIP: {
      startBidPoints: 50,
      buyoutPoints: 120,
      slotsPerCategory: 3
    },
    SEARCH_VIP: {
      startBidPoints: 25,
      buyoutPoints: 100,
      slotsPerCategory: 3
    },
    minBidIncrement: 5,
    maxBidPoints: 500,
    timezone: 'Europe/Sofia'
  };

  constructor(pool?: Pool) {
    this.database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
    this.pool = pool || this.database.getPool();
  }

  /**
   * Check if VIP feature is enabled
   */
  isVipEnabled(): boolean {
    return process.env.VIP_ENABLED !== 'false';
  }

  /**
   * Get current BG time
   */
  private getBgTime(): Date {
    // Get current time in Europe/Sofia timezone
    const now = new Date();
    const bgTimeStr = now.toLocaleString('en-US', { timeZone: 'Europe/Sofia' });
    return new Date(bgTimeStr);
  }

  /**
   * Check if auction is currently open (Sunday 00:00-21:59:59 BG time)
   * In test mode (VIP_TEST_MODE=true), auction is always open
   */
  isAuctionOpen(): boolean {
    // Test mode: always open for testing
    if (process.env.VIP_TEST_MODE === 'true') {
      return true;
    }
    
    const bgTime = this.getBgTime();
    const dayOfWeek = bgTime.getDay(); // 0 = Sunday
    const hour = bgTime.getHours();
    
    return dayOfWeek === 0 && hour >= 0 && hour < 22;
  }

  /**
   * Check if settlement is in progress (Sunday 22:00-23:59:59 BG time)
   */
  isSettlementInProgress(): boolean {
    const bgTime = this.getBgTime();
    const dayOfWeek = bgTime.getDay();
    const hour = bgTime.getHours();
    
    return dayOfWeek === 0 && hour >= 22;
  }

  /**
   * Get next auction dates
   */
  getNextAuctionDates(): VipConfig['nextAuction'] {
    const bgTime = this.getBgTime();
    const dayOfWeek = bgTime.getDay();
    
    // Find next Sunday
    let daysUntilSunday = (7 - dayOfWeek) % 7;
    if (daysUntilSunday === 0 && bgTime.getHours() >= 22) {
      // It's Sunday after 22:00, next auction is next Sunday
      daysUntilSunday = 7;
    }
    
    const nextSunday = new Date(bgTime);
    nextSunday.setDate(bgTime.getDate() + daysUntilSunday);
    nextSunday.setHours(0, 0, 0, 0);
    
    const auctionEnd = new Date(nextSunday);
    auctionEnd.setHours(21, 59, 59, 999);
    
    const settlementStart = new Date(nextSunday);
    settlementStart.setHours(22, 0, 0, 0);
    
    // Coverage starts Monday after the auction
    const coverageStart = new Date(nextSunday);
    coverageStart.setDate(nextSunday.getDate() + 1);
    coverageStart.setHours(0, 0, 0, 0);
    
    // Coverage ends Sunday of that week
    const coverageEnd = new Date(coverageStart);
    coverageEnd.setDate(coverageStart.getDate() + 6);
    coverageEnd.setHours(23, 59, 59, 999);
    
    return {
      startsAt: nextSunday.toISOString(),
      endsAt: auctionEnd.toISOString(),
      settlementAt: settlementStart.toISOString(),
      coverageStart: coverageStart.toISOString(),
      coverageEnd: coverageEnd.toISOString()
    };
  }

  /**
   * Get current coverage week dates
   */
  getCurrentCoverageWeek(): { start: Date; end: Date } | null {
    const bgTime = this.getBgTime();
    const dayOfWeek = bgTime.getDay();
    
    // Find Monday of this week
    const daysFromMonday = (dayOfWeek + 6) % 7; // Monday = 0, Sunday = 6
    const monday = new Date(bgTime);
    monday.setDate(bgTime.getDate() - daysFromMonday);
    monday.setHours(0, 0, 0, 0);
    
    // Sunday of this week
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    
    return { start: monday, end: sunday };
  }

  /**
   * Get VIP configuration for frontend
   */
  async getConfig(): Promise<VipConfig> {
    const nextAuction = this.getNextAuctionDates();
    
    return {
      homepageVip: {
        startBidPoints: this.CONFIG.HOMEPAGE_VIP.startBidPoints,
        buyoutPoints: this.CONFIG.HOMEPAGE_VIP.buyoutPoints,
        slotsPerCategory: this.CONFIG.HOMEPAGE_VIP.slotsPerCategory,
        labelBg: 'Начална страница VIP'
      },
      searchVip: {
        startBidPoints: this.CONFIG.SEARCH_VIP.startBidPoints,
        buyoutPoints: this.CONFIG.SEARCH_VIP.buyoutPoints,
        slotsPerCategory: this.CONFIG.SEARCH_VIP.slotsPerCategory,
        labelBg: 'Търсене VIP'
      },
      minBidIncrement: this.CONFIG.minBidIncrement,
      maxBidPoints: this.CONFIG.maxBidPoints,
      auctionWindow: {
        dayOfWeek: 0,
        startHour: 0,
        endHour: 22,
        timezone: this.CONFIG.timezone,
        labelBg: 'Неделя 00:00 – 22:00'
      },
      settlementWindow: {
        dayOfWeek: 0,
        startHour: 22,
        endHour: 24,
        labelBg: 'Неделя 22:00 – 00:00 (обработка)'
      },
      coverageWindow: {
        startDay: 1,
        endDay: 0,
        labelBg: 'Понеделник – Неделя (7 дни)'
      },
      nextAuction,
      isAuctionOpen: this.isAuctionOpen(),
      isSettlementInProgress: this.isSettlementInProgress()
    };
  }

  /**
   * Get SP's current VIP overview
   */
  async getOverview(userId: string): Promise<VipOverview> {
    const client = await this.pool.connect();
    
    try {
      // Get current placements (won/buyout bids for current coverage week)
      const coverageWeek = this.getCurrentCoverageWeek();
      
      const placementsQuery = `
        SELECT 
          spb.id,
          spb.service_category,
          spb.city,
          spb.bid_amount,
          spb.currency as vip_type,
          spb.status,
          spb.priority_score,
          spb.expires_at,
          sc.name_bg as category_label_bg,
          (
            SELECT COUNT(*) + 1
            FROM sp_premium_bids spb2
            WHERE spb2.service_category = spb.service_category
              AND spb2.city = spb.city
              AND spb2.currency = spb.currency
              AND spb2.status IN ('won', 'buyout')
              AND spb2.expires_at >= NOW()
              AND spb2.bid_amount > spb.bid_amount
          ) as rank
        FROM sp_premium_bids spb
        LEFT JOIN service_categories sc ON sc.id = spb.service_category
        WHERE spb.user_id = $1
          AND spb.status IN ('won', 'buyout')
          AND spb.expires_at >= NOW()
        ORDER BY spb.currency, spb.service_category
      `;
      
      const placementsResult = await client.query(placementsQuery, [userId]);
      
      // Get points balance
      const balanceQuery = `
        SELECT points_balance FROM users WHERE id = $1
      `;
      const balanceResult = await client.query(balanceQuery, [userId]);
      const pointsBalance = balanceResult.rows[0]?.points_balance || 0;
      
      const placements: VipPlacement[] = placementsResult.rows.map(row => ({
        vipType: row.vip_type as VipType,
        categoryId: row.service_category,
        categoryLabelBg: row.category_label_bg || row.service_category,
        city: row.city === 'GLOBAL' ? null : row.city,
        pointsSpent: Number(row.bid_amount),
        rank: Number(row.rank),
        expiresAt: row.expires_at?.toISOString() || ''
      }));
      
      return {
        currentPlacements: placements,
        pointsBalance: Number(pointsBalance),
        nextAuction: this.getNextAuctionDates()
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get available auctions for SP
   */
  async getAuctions(userId: string, filters?: { vipType?: VipType; categoryId?: string }): Promise<VipAuction[]> {
    const client = await this.pool.connect();
    
    try {
      // Get SP's profile to determine their category and city
      const profileQuery = `
        SELECT service_category, city FROM service_provider_profiles WHERE user_id = $1
      `;
      const profileResult = await client.query(profileQuery, [userId]);
      
      if (profileResult.rows.length === 0) {
        return [];
      }
      
      const profile = profileResult.rows[0];
      const spCategory = profile.service_category;
      const spCity = profile.city;
      
      // Get all categories for homepage VIP
      const categoriesQuery = `SELECT id, name_bg FROM service_categories`;
      const categoriesResult = await client.query(categoriesQuery);
      
      const auctions: VipAuction[] = [];
      const nextAuction = this.getNextAuctionDates();
      const coverageEnd = new Date(nextAuction.coverageEnd);
      
      for (const category of categoriesResult.rows) {
        // Homepage VIP (only for SP's own category)
        // Handle ID mismatch: service_categories has 'cat_electrician', profiles have 'electrician'
        const categoryMatch = category.id === spCategory || 
                              category.id === `cat_${spCategory}` || 
                              category.id.replace('cat_', '') === spCategory;
        if (categoryMatch) {
          if (!filters?.vipType || filters.vipType === 'HOMEPAGE_VIP') {
            if (!filters?.categoryId || filters.categoryId === category.id) {
              const homepageAuction = await this.getAuctionDetails(
                client, userId, 'HOMEPAGE_VIP', category.id, 'GLOBAL', coverageEnd
              );
              auctions.push({
                ...homepageAuction,
                categoryLabelBg: category.name_bg
              });
            }
          }
          
          // Search VIP (for SP's category + city)
          if (!filters?.vipType || filters.vipType === 'SEARCH_VIP') {
            if (!filters?.categoryId || filters.categoryId === category.id) {
              const searchAuction = await this.getAuctionDetails(
                client, userId, 'SEARCH_VIP', category.id, spCity, coverageEnd
              );
              auctions.push({
                ...searchAuction,
                categoryLabelBg: category.name_bg
              });
            }
          }
        }
      }
      
      return auctions;
    } finally {
      client.release();
    }
  }

  /**
   * Get auction details for a specific scope
   */
  private async getAuctionDetails(
    client: PoolClient,
    userId: string,
    vipType: VipType,
    categoryId: string,
    city: string,
    coverageEnd: Date
  ): Promise<VipAuction> {
    const config = vipType === 'HOMEPAGE_VIP' ? this.CONFIG.HOMEPAGE_VIP : this.CONFIG.SEARCH_VIP;
    
    // Get current user's bid
    const coverageEndStr = coverageEnd.toISOString();
    const userBidQuery = `
      SELECT bid_amount, status
      FROM sp_premium_bids
      WHERE user_id = $1
        AND service_category = $2
        AND city = $3
        AND currency = $4
        AND expires_at = $5::timestamp
    `;
    const userBidResult = await client.query(userBidQuery, [
      userId, categoryId, city, vipType, coverageEndStr
    ]);
    
    const currentBid = userBidResult.rows[0]?.bid_amount 
      ? Number(userBidResult.rows[0].bid_amount) 
      : null;
    
    // Get buyouts count
    const buyoutsQuery = `
      SELECT COUNT(*) as count
      FROM sp_premium_bids
      WHERE service_category = $1
        AND city = $2
        AND currency = $3
        AND expires_at = $4::timestamp
        AND status = 'buyout'
    `;
    const buyoutsResult = await client.query(buyoutsQuery, [
      categoryId, city, vipType, coverageEndStr
    ]);
    const buyoutsTaken = Number(buyoutsResult.rows[0]?.count || 0);
    
    // Get current rank if user has a bid
    let currentRank: number | null = null;
    if (currentBid !== null) {
      const rankQuery = `
        SELECT COUNT(*) + 1 as rank
        FROM sp_premium_bids
        WHERE service_category = $1
          AND city = $2
          AND currency = $3
          AND expires_at = $4::timestamp
          AND status IN ('open', 'buyout')
          AND bid_amount > $5::numeric
      `;
      const rankResult = await client.query(rankQuery, [
        categoryId, city, vipType, coverageEndStr, currentBid
      ]);
      currentRank = Number(rankResult.rows[0]?.rank || 1);
    }
    
    return {
      vipType,
      categoryId,
      categoryLabelBg: '', // Will be filled by caller
      city: city === 'GLOBAL' ? null : city,
      startBidPoints: config.startBidPoints,
      buyoutPoints: config.buyoutPoints,
      currentBid,
      currentRank,
      slotsRemaining: config.slotsPerCategory - buyoutsTaken,
      buyoutsTaken
    };
  }

  /**
   * Place or increase a VIP bid
   */
  async placeBid(
    userId: string,
    vipType: VipType,
    categoryId: string,
    pointsIncrement: number
  ): Promise<BidResult> {
    if (!this.isVipEnabled()) {
      return {
        success: false,
        message: 'VIP функцията не е активна.',
        error: { code: 'FEATURE_DISABLED', message: 'VIP feature is disabled' }
      };
    }
    
    if (!this.isAuctionOpen()) {
      return {
        success: false,
        message: 'Търгът не е отворен. Търгът е активен всяка неделя от 00:00 до 22:00.',
        error: { code: 'AUCTION_CLOSED', message: 'Auction is not open' }
      };
    }
    
    if (pointsIncrement < this.CONFIG.minBidIncrement) {
      return {
        success: false,
        message: `Минималното увеличение е ${this.CONFIG.minBidIncrement} точки.`,
        error: { code: 'INVALID_INCREMENT', message: `Minimum increment is ${this.CONFIG.minBidIncrement}` }
      };
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get SP's profile
      const profileQuery = `
        SELECT service_category, city FROM service_provider_profiles WHERE user_id = $1
      `;
      const profileResult = await client.query(profileQuery, [userId]);
      
      if (profileResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Профилът не е намерен.',
          error: { code: 'PROFILE_NOT_FOUND', message: 'Service provider profile not found' }
        };
      }
      
      const profile = profileResult.rows[0];
      
      // Validate category matches SP's category
      // Handle ID mismatch: service_categories has 'cat_electrician', profiles have 'electrician'
      const categoryMatch = categoryId === profile.service_category || 
                            categoryId === `cat_${profile.service_category}` || 
                            categoryId.replace('cat_', '') === profile.service_category;
      if (!categoryMatch) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Можете да наддавате само за вашата категория.',
          error: { code: 'INVALID_CATEGORY', message: 'Can only bid for your own category' }
        };
      }
      
      const city = vipType === 'HOMEPAGE_VIP' ? 'GLOBAL' : profile.city;
      const config = vipType === 'HOMEPAGE_VIP' ? this.CONFIG.HOMEPAGE_VIP : this.CONFIG.SEARCH_VIP;
      const nextAuction = this.getNextAuctionDates();
      const coverageEnd = new Date(nextAuction.coverageEnd);
      const coverageEndStr = coverageEnd.toISOString();
      
      // Check for existing bid
      const existingBidQuery = `
        SELECT id, bid_amount, status
        FROM sp_premium_bids
        WHERE user_id = $1
          AND service_category = $2
          AND city = $3
          AND currency = $4
          AND expires_at = $5::timestamp
        FOR UPDATE
      `;
      const existingBidResult = await client.query(existingBidQuery, [
        userId, categoryId, city, vipType, coverageEndStr
      ]);
      
      let newBidAmount: number;
      let bidId: string;
      
      if (existingBidResult.rows.length > 0) {
        const existingBid = existingBidResult.rows[0];
        
        if (existingBid.status === 'buyout') {
          await client.query('ROLLBACK');
          return {
            success: false,
            message: 'Вече сте закупили VIP слот за тази категория.',
            error: { code: 'ALREADY_BUYOUT', message: 'Already bought out this slot' }
          };
        }
        
        if (existingBid.status === 'cancelled') {
          await client.query('ROLLBACK');
          return {
            success: false,
            message: 'Офертата е отменена. Създайте нова.',
            error: { code: 'BID_CANCELLED', message: 'Bid was cancelled' }
          };
        }
        
        newBidAmount = Number(existingBid.bid_amount) + pointsIncrement;
        bidId = existingBid.id;
      } else {
        // New bid - must be at least start price OR higher than current highest bid
        // Get current highest bid for this auction
        const highestBidQuery = `
          SELECT MAX(bid_amount) as highest_bid
          FROM sp_premium_bids
          WHERE service_category = $1
            AND city = $2
            AND currency = $3
            AND expires_at = $4::timestamp
            AND status IN ('open', 'buyout')
        `;
        const highestBidResult = await client.query(highestBidQuery, [
          categoryId, city, vipType, coverageEndStr
        ]);
        const currentHighestBid = Number(highestBidResult.rows[0]?.highest_bid || 0);
        
        // New bid must be higher than current highest bid (or at least startBidPoints if no bids)
        const minimumBid = currentHighestBid > 0 
          ? currentHighestBid + this.CONFIG.minBidIncrement 
          : config.startBidPoints;
        
        if (pointsIncrement < minimumBid) {
          await client.query('ROLLBACK');
          return {
            success: false,
            message: currentHighestBid > 0 
              ? `Минималната оферта е ${minimumBid} точки (текуща най-висока: ${currentHighestBid}).`
              : `Минималната начална оферта е ${minimumBid} точки.`,
            error: { code: 'BID_TOO_LOW', message: `Minimum bid is ${minimumBid}` }
          };
        }
        
        newBidAmount = pointsIncrement;
        bidId = uuidv4();
      }
      
      // Check max bid
      if (newBidAmount > this.CONFIG.maxBidPoints) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Максималната оферта е ${this.CONFIG.maxBidPoints} точки.`,
          error: { code: 'MAX_BID_EXCEEDED', message: `Maximum bid is ${this.CONFIG.maxBidPoints}` }
        };
      }
      
      // Soft check: verify user has enough points
      const balanceQuery = `SELECT points_balance FROM users WHERE id = $1`;
      const balanceResult = await client.query(balanceQuery, [userId]);
      const pointsBalance = Number(balanceResult.rows[0]?.points_balance || 0);
      
      if (pointsBalance < newBidAmount) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Недостатъчно точки. Нужни: ${newBidAmount}, Налични: ${pointsBalance}`,
          error: { code: 'INSUFFICIENT_POINTS', message: 'Insufficient points' }
        };
      }
      
      // Insert or update bid
      if (existingBidResult.rows.length > 0) {
        await client.query(`
          UPDATE sp_premium_bids
          SET bid_amount = $1::numeric,
              priority_score = $2::integer,
              updated_at = NOW()
          WHERE id = $3
        `, [newBidAmount, newBidAmount, bidId]);
      } else {
        await client.query(`
          INSERT INTO sp_premium_bids (
            id, user_id, service_category, city, bid_amount, currency, 
            status, priority_score, started_at, expires_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5::numeric, $6, 'open', $7::integer, $8::timestamp, $9::timestamp, NOW(), NOW())
        `, [
          bidId, userId, categoryId, city, newBidAmount, vipType,
          newBidAmount, new Date(nextAuction.startsAt).toISOString(), coverageEndStr
        ]);
      }
      
      // Calculate rank
      const rankQuery = `
        SELECT COUNT(*) + 1 as rank
        FROM sp_premium_bids
        WHERE service_category = $1
          AND city = $2
          AND currency = $3
          AND expires_at = $4::timestamp
          AND status IN ('open', 'buyout')
          AND bid_amount > $5::numeric
      `;
      const rankResult = await client.query(rankQuery, [
        categoryId, city, vipType, coverageEndStr, newBidAmount
      ]);
      const rank = Number(rankResult.rows[0]?.rank || 1);
      
      await client.query('COMMIT');
      
      logger.info('VIP bid placed', { userId, vipType, categoryId, city, newBidAmount, rank });
      
      return {
        success: true,
        bidId,
        newBidAmount,
        rank,
        message: 'Офертата е успешно повишена.'
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ VIP BID ERROR:', error);
      console.error('❌ VIP BID ERROR DETAILS:', JSON.stringify({
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
        position: error?.position,
        query: error?.query
      }));
      logger.error('Failed to place VIP bid', { userId, vipType, categoryId, error: error?.message });
      return {
        success: false,
        message: 'Възникна грешка при наддаването.',
        error: { code: 'INTERNAL_ERROR', message: error?.message || String(error) }
      };
    } finally {
      client.release();
    }
  }

  /**
   * Buyout a VIP slot (immediate point deduction)
   */
  async buyout(userId: string, vipType: VipType, categoryId: string): Promise<BuyoutResult> {
    if (!this.isVipEnabled()) {
      return {
        success: false,
        message: 'VIP функцията не е активна.',
        error: { code: 'FEATURE_DISABLED', message: 'VIP feature is disabled' }
      };
    }
    
    if (!this.isAuctionOpen()) {
      return {
        success: false,
        message: 'Търгът не е отворен. Търгът е активен всяка неделя от 00:00 до 22:00.',
        error: { code: 'AUCTION_CLOSED', message: 'Auction is not open' }
      };
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Get SP's profile
      const profileQuery = `
        SELECT service_category, city FROM service_provider_profiles WHERE user_id = $1
      `;
      const profileResult = await client.query(profileQuery, [userId]);
      
      if (profileResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Профилът не е намерен.',
          error: { code: 'PROFILE_NOT_FOUND', message: 'Service provider profile not found' }
        };
      }
      
      const profile = profileResult.rows[0];
      
      // Handle ID mismatch: service_categories has 'cat_electrician', profiles have 'electrician'
      const categoryMatch = categoryId === profile.service_category || 
                            categoryId === `cat_${profile.service_category}` || 
                            categoryId.replace('cat_', '') === profile.service_category;
      if (!categoryMatch) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Можете да закупите VIP само за вашата категория.',
          error: { code: 'INVALID_CATEGORY', message: 'Can only buyout for your own category' }
        };
      }
      
      const city = vipType === 'HOMEPAGE_VIP' ? 'GLOBAL' : profile.city;
      const config = vipType === 'HOMEPAGE_VIP' ? this.CONFIG.HOMEPAGE_VIP : this.CONFIG.SEARCH_VIP;
      const buyoutPoints = config.buyoutPoints;
      const nextAuction = this.getNextAuctionDates();
      const coverageEnd = new Date(nextAuction.coverageEnd);
      const coverageEndStr = coverageEnd.toISOString();
      
      // Check if slots are available
      // Note: FOR UPDATE cannot be used with COUNT(), so we count without lock
      // The transaction isolation provides sufficient protection here
      const buyoutsQuery = `
        SELECT COUNT(*) as count
        FROM sp_premium_bids
        WHERE service_category = $1
          AND city = $2
          AND currency = $3
          AND expires_at = $4::timestamp
          AND status = 'buyout'
      `;
      const buyoutsResult = await client.query(buyoutsQuery, [
        categoryId, city, vipType, coverageEndStr
      ]);
      const buyoutsTaken = Number(buyoutsResult.rows[0]?.count || 0);
      
      if (buyoutsTaken >= config.slotsPerCategory) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Всички VIP слотове са заети.',
          error: { code: 'NO_SLOTS_AVAILABLE', message: 'All slots are taken' }
        };
      }
      
      // Check if user already has a buyout
      const existingBuyoutQuery = `
        SELECT id FROM sp_premium_bids
        WHERE user_id = $1
          AND service_category = $2
          AND city = $3
          AND currency = $4
          AND expires_at = $5::timestamp
          AND status = 'buyout'
      `;
      const existingBuyoutResult = await client.query(existingBuyoutQuery, [
        userId, categoryId, city, vipType, coverageEndStr
      ]);
      
      if (existingBuyoutResult.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Вече сте закупили VIP слот за тази категория.',
          error: { code: 'ALREADY_BUYOUT', message: 'Already bought out' }
        };
      }
      
      // Check points balance
      const balanceQuery = `SELECT points_balance FROM users WHERE id = $1 FOR UPDATE`;
      const balanceResult = await client.query(balanceQuery, [userId]);
      const pointsBalance = Number(balanceResult.rows[0]?.points_balance || 0);
      
      if (pointsBalance < buyoutPoints) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: `Недостатъчно точки. Нужни: ${buyoutPoints}, Налични: ${pointsBalance}`,
          error: { code: 'INSUFFICIENT_POINTS', message: 'Insufficient points' }
        };
      }
      
      // Check for existing bid and update or create
      const existingBidQuery = `
        SELECT id FROM sp_premium_bids
        WHERE user_id = $1
          AND service_category = $2
          AND city = $3
          AND currency = $4
          AND expires_at = $5::timestamp
      `;
      const existingBidResult = await client.query(existingBidQuery, [
        userId, categoryId, city, vipType, coverageEndStr
      ]);
      
      let bidId: string;
      
      if (existingBidResult.rows.length > 0) {
        bidId = existingBidResult.rows[0].id;
        await client.query(`
          UPDATE sp_premium_bids
          SET bid_amount = $1::numeric,
              status = 'buyout',
              priority_score = $2::integer,
              updated_at = NOW()
          WHERE id = $3
        `, [buyoutPoints, buyoutPoints, bidId]);
      } else {
        bidId = uuidv4();
        await client.query(`
          INSERT INTO sp_premium_bids (
            id, user_id, service_category, city, bid_amount, currency,
            status, priority_score, started_at, expires_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5::numeric, $6, 'buyout', $7::integer, $8::timestamp, $9::timestamp, NOW(), NOW())
        `, [
          bidId, userId, categoryId, city, buyoutPoints, vipType,
          buyoutPoints, new Date(nextAuction.startsAt).toISOString(), coverageEndStr
        ]);
      }
      
      // Deduct points immediately
      const newBalance = pointsBalance - buyoutPoints;
      await client.query(`
        UPDATE users
        SET points_balance = $1,
            points_total_spent = points_total_spent + $2
        WHERE id = $3
      `, [newBalance, buyoutPoints, userId]);
      
      // Record transaction
      await client.query(`
        INSERT INTO sp_points_transactions (
          id, user_id, transaction_type, points_amount, balance_after, reason, metadata, created_at
        ) VALUES ($1, $2, 'spent', $3, $4, $5, $6, NOW())
      `, [
        uuidv4(),
        userId,
        buyoutPoints,
        newBalance,
        `VIP Buyout - ${vipType === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'} - ${categoryId}`,
        JSON.stringify({
          feature: `vip_${vipType.toLowerCase()}`,
          vipType,
          categoryId,
          city,
          bidId
        })
      ]);
      
      await client.query('COMMIT');
      
      logger.info('VIP buyout completed', { userId, vipType, categoryId, city, buyoutPoints, newBalance });
      
      return {
        success: true,
        bidId,
        pointsDeducted: buyoutPoints,
        newPointsBalance: newBalance,
        message: 'VIP слотът е закупен успешно!'
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('❌ VIP BUYOUT ERROR:', error);
      console.error('❌ VIP BUYOUT ERROR DETAILS:', JSON.stringify({
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        hint: error?.hint,
        position: error?.position,
        query: error?.query
      }));
      logger.error('Failed to buyout VIP slot', { userId, vipType, categoryId, error: error?.message });
      return {
        success: false,
        message: 'Възникна грешка при закупуването.',
        error: { code: 'INTERNAL_ERROR', message: error?.message || String(error) }
      };
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a VIP bid
   */
  async cancelBid(userId: string, bidId: string): Promise<BidResult> {
    if (!this.isAuctionOpen()) {
      return {
        success: false,
        message: 'Търгът не е отворен.',
        error: { code: 'AUCTION_CLOSED', message: 'Auction is not open' }
      };
    }
    
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const bidQuery = `
        SELECT id, status FROM sp_premium_bids
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `;
      const bidResult = await client.query(bidQuery, [bidId, userId]);
      
      if (bidResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Офертата не е намерена.',
          error: { code: 'BID_NOT_FOUND', message: 'Bid not found' }
        };
      }
      
      const bid = bidResult.rows[0];
      
      if (bid.status === 'buyout') {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Не можете да отмените закупен VIP слот.',
          error: { code: 'CANNOT_CANCEL_BUYOUT', message: 'Cannot cancel buyout' }
        };
      }
      
      if (bid.status === 'cancelled') {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Офертата вече е отменена.',
          error: { code: 'ALREADY_CANCELLED', message: 'Already cancelled' }
        };
      }
      
      await client.query(`
        UPDATE sp_premium_bids
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [bidId]);
      
      await client.query('COMMIT');
      
      logger.info('VIP bid cancelled', { userId, bidId });
      
      return {
        success: true,
        bidId,
        message: 'Офертата е отменена.'
      };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cancel VIP bid', { userId, bidId, error });
      return {
        success: false,
        message: 'Възникна грешка при отмяната.',
        error: { code: 'INTERNAL_ERROR', message: String(error) }
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get leaderboard for a VIP auction
   */
  async getLeaderboard(
    userId: string,
    vipType: VipType,
    categoryId: string,
    city?: string
  ): Promise<LeaderboardResponse> {
    if (!this.isAuctionOpen()) {
      return {
        isAuctionOpen: false,
        bids: [],
        buyoutsTaken: 0,
        slotsRemaining: 0
      };
    }
    
    const client = await this.pool.connect();
    
    try {
      const effectiveCity = vipType === 'HOMEPAGE_VIP' ? 'GLOBAL' : (city || 'GLOBAL');
      const config = vipType === 'HOMEPAGE_VIP' ? this.CONFIG.HOMEPAGE_VIP : this.CONFIG.SEARCH_VIP;
      const nextAuction = this.getNextAuctionDates();
      const coverageEnd = new Date(nextAuction.coverageEnd);
      const coverageEndStr = coverageEnd.toISOString();
      
      const bidsQuery = `
        SELECT 
          spb.id,
          spb.user_id,
          spb.bid_amount,
          spb.status,
          u.first_name,
          u.last_name,
          spp.business_name,
          spp.city
        FROM sp_premium_bids spb
        LEFT JOIN users u ON u.id = spb.user_id
        LEFT JOIN service_provider_profiles spp ON spp.user_id = spb.user_id
        WHERE spb.service_category = $1
          AND spb.city = $2
          AND spb.currency = $3
          AND spb.expires_at = $4::timestamp
          AND spb.status IN ('open', 'buyout')
        ORDER BY spb.bid_amount DESC, spb.updated_at ASC
      `;
      
      const bidsResult = await client.query(bidsQuery, [
        categoryId, effectiveCity, vipType, coverageEndStr
      ]);
      
      let buyoutsTaken = 0;
      const bids: LeaderboardEntry[] = bidsResult.rows.map((row, index) => {
        if (row.status === 'buyout') buyoutsTaken++;
        return {
          rank: index + 1,
          providerName: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Неизвестен',
          businessName: row.business_name || '',
          city: row.city || '',
          bidAmount: Number(row.bid_amount),
          isCurrentUser: row.user_id === userId,
          isBuyout: row.status === 'buyout'
        };
      });
      
      return {
        isAuctionOpen: true,
        bids,
        buyoutsTaken,
        slotsRemaining: config.slotsPerCategory - buyoutsTaken
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get VIP providers for homepage display
   */
  async getHomepageVipProviders(categoryId?: string): Promise<any[]> {
    if (!this.isVipEnabled()) {
      return [];
    }
    
    const client = await this.pool.connect();
    
    try {
      let query = `
        SELECT 
          spb.service_category,
          spb.bid_amount,
          spp.id as profile_id,
          spp.user_id,
          spp.business_name,
          spp.city,
          spp.rating,
          spp.total_reviews,
          spp.profile_image_url,
          sc.name_bg as category_label_bg,
          u.first_name,
          u.last_name
        FROM sp_premium_bids spb
        JOIN service_provider_profiles spp ON spp.user_id = spb.user_id
        JOIN users u ON u.id = spb.user_id
        LEFT JOIN service_categories sc ON sc.id = spb.service_category
        WHERE spb.currency = 'HOMEPAGE_VIP'
          AND spb.city = 'GLOBAL'
          AND spb.status IN ('won', 'buyout')
          AND spb.expires_at >= NOW()
          AND spp.is_active = true
      `;
      
      const params: any[] = [];
      
      if (categoryId) {
        // Handle both 'locksmith' and 'cat_locksmith' formats
        const catWithPrefix = categoryId.startsWith('cat_') ? categoryId : `cat_${categoryId}`;
        const catWithoutPrefix = categoryId.startsWith('cat_') ? categoryId.replace('cat_', '') : categoryId;
        params.push(catWithPrefix);
        params.push(catWithoutPrefix);
        query += ` AND (spb.service_category = $${params.length - 1} OR spb.service_category = $${params.length})`;
      }
      
      query += ` ORDER BY spb.service_category, spb.bid_amount DESC, spb.updated_at ASC`;
      
      const result = await client.query(query, params);
      
      // Group by category, max 3 per category
      const grouped: { [key: string]: any[] } = {};
      
      for (const row of result.rows) {
        const cat = row.service_category;
        if (!grouped[cat]) grouped[cat] = [];
        if (grouped[cat].length < 3) {
          grouped[cat].push({
            userId: row.user_id,
            profileId: row.profile_id,
            businessName: row.business_name,
            providerName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            city: row.city,
            rating: Number(row.rating) || 0,
            totalReviews: Number(row.total_reviews) || 0,
            profileImageUrl: row.profile_image_url,
            categoryId: row.service_category,
            categoryLabelBg: row.category_label_bg,
            isVip: true,
            vipType: 'HOMEPAGE_VIP'
          });
        }
      }
      
      // Flatten to array
      return Object.values(grouped).flat();
    } finally {
      client.release();
    }
  }

  /**
   * Get VIP providers for search results
   */
  async getSearchVipProviders(categoryId: string, city: string): Promise<any[]> {
    if (!this.isVipEnabled()) {
      return [];
    }
    
    const client = await this.pool.connect();
    
    try {
      // Handle both 'locksmith' and 'cat_locksmith' formats
      const catWithPrefix = categoryId.startsWith('cat_') ? categoryId : `cat_${categoryId}`;
      const catWithoutPrefix = categoryId.startsWith('cat_') ? categoryId.replace('cat_', '') : categoryId;
      
      const query = `
        SELECT 
          spp.id as profile_id,
          spp.user_id,
          spp.business_name,
          spp.city,
          spp.neighborhood,
          spp.rating,
          spp.total_reviews,
          spp.profile_image_url,
          spp.description,
          spp.experience_years,
          sc.name_bg as category_label_bg,
          u.first_name,
          u.last_name,
          u.phone
        FROM sp_premium_bids spb
        JOIN service_provider_profiles spp ON spp.user_id = spb.user_id
        JOIN users u ON u.id = spb.user_id
        LEFT JOIN service_categories sc ON sc.id = spb.service_category
        WHERE spb.currency = 'SEARCH_VIP'
          AND (spb.service_category = $1 OR spb.service_category = $2)
          AND spb.city = $3
          AND spb.status IN ('won', 'buyout')
          AND spb.expires_at >= NOW()
          AND spp.is_active = true
        ORDER BY spb.bid_amount DESC, spb.updated_at ASC
        LIMIT 3
      `;
      
      const result = await client.query(query, [catWithPrefix, catWithoutPrefix, city]);
      
      return result.rows.map(row => ({
        userId: row.user_id,
        profileId: row.profile_id,
        businessName: row.business_name,
        providerName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        city: row.city,
        neighborhood: row.neighborhood,
        rating: Number(row.rating) || 0,
        totalReviews: Number(row.total_reviews) || 0,
        profileImageUrl: row.profile_image_url,
        description: row.description,
        experienceYears: row.experience_years,
        categoryLabelBg: row.category_label_bg,
        phone: row.phone,
        isVip: true,
        vipType: 'SEARCH_VIP'
      }));
    } finally {
      client.release();
    }
  }

  /**
   * Settlement: Process auction winners (called by scheduler at Sunday 22:00)
   */
  async settleAuctions(): Promise<{ processed: number; winners: number; errors: number }> {
    const client = await this.pool.connect();
    let processed = 0;
    let winners = 0;
    let errors = 0;
    
    try {
      const nextAuction = this.getNextAuctionDates();
      const coverageEnd = new Date(nextAuction.coverageEnd);
      
      // Get all distinct scopes with open bids
      const scopesQuery = `
        SELECT DISTINCT service_category, city, currency
        FROM sp_premium_bids
        WHERE expires_at = $1 AND status = 'open'
      `;
      const scopesResult = await client.query(scopesQuery, [coverageEnd]);
      
      for (const scope of scopesResult.rows) {
        try {
          await client.query('BEGIN');
          
          const config = scope.currency === 'HOMEPAGE_VIP' 
            ? this.CONFIG.HOMEPAGE_VIP 
            : this.CONFIG.SEARCH_VIP;
          
          // Count existing buyouts
          const buyoutsQuery = `
            SELECT COUNT(*) as count
            FROM sp_premium_bids
            WHERE service_category = $1 AND city = $2 AND currency = $3
              AND expires_at = $4 AND status = 'buyout'
          `;
          const buyoutsResult = await client.query(buyoutsQuery, [
            scope.service_category, scope.city, scope.currency, coverageEnd
          ]);
          const buyoutsTaken = Number(buyoutsResult.rows[0]?.count || 0);
          const slotsRemaining = config.slotsPerCategory - buyoutsTaken;
          
          if (slotsRemaining <= 0) {
            // Mark all open bids as lost
            await client.query(`
              UPDATE sp_premium_bids
              SET status = 'lost', updated_at = NOW()
              WHERE service_category = $1 AND city = $2 AND currency = $3
                AND expires_at = $4 AND status = 'open'
            `, [scope.service_category, scope.city, scope.currency, coverageEnd]);
            
            await client.query('COMMIT');
            processed++;
            continue;
          }
          
          // Get top bidders (order by bid_amount DESC, updated_at ASC for tie-break)
          const bidsQuery = `
            SELECT spb.id, spb.user_id, spb.bid_amount
            FROM sp_premium_bids spb
            JOIN users u ON u.id = spb.user_id
            WHERE spb.service_category = $1 AND spb.city = $2 AND spb.currency = $3
              AND spb.expires_at = $4 AND spb.status = 'open'
            ORDER BY spb.bid_amount DESC, spb.updated_at ASC
          `;
          const bidsResult = await client.query(bidsQuery, [
            scope.service_category, scope.city, scope.currency, coverageEnd
          ]);
          
          let winnersCount = 0;
          
          for (const bid of bidsResult.rows) {
            if (winnersCount >= slotsRemaining) {
              // Mark as lost
              await client.query(`
                UPDATE sp_premium_bids SET status = 'lost', updated_at = NOW() WHERE id = $1
              `, [bid.id]);
              continue;
            }
            
            // Check if user has enough points
            const balanceQuery = `SELECT points_balance FROM users WHERE id = $1 FOR UPDATE`;
            const balanceResult = await client.query(balanceQuery, [bid.user_id]);
            const pointsBalance = Number(balanceResult.rows[0]?.points_balance || 0);
            const bidAmount = Number(bid.bid_amount);
            
            if (pointsBalance < bidAmount) {
              // Insufficient points, mark as lost
              await client.query(`
                UPDATE sp_premium_bids SET status = 'lost', updated_at = NOW() WHERE id = $1
              `, [bid.id]);
              continue;
            }
            
            // Deduct points and mark as won
            const newBalance = pointsBalance - bidAmount;
            await client.query(`
              UPDATE users
              SET points_balance = $1, points_total_spent = points_total_spent + $2
              WHERE id = $3
            `, [newBalance, bidAmount, bid.user_id]);
            
            await client.query(`
              UPDATE sp_premium_bids SET status = 'won', updated_at = NOW() WHERE id = $1
            `, [bid.id]);
            
            // Record transaction
            await client.query(`
              INSERT INTO sp_points_transactions (
                id, user_id, transaction_type, points_amount, balance_after, reason, metadata, created_at
              ) VALUES ($1, $2, 'spent', $3, $4, $5, $6, NOW())
            `, [
              uuidv4(),
              bid.user_id,
              bidAmount,
              newBalance,
              `VIP Won - ${scope.currency === 'HOMEPAGE_VIP' ? 'Начална страница' : 'Търсене'} - ${scope.service_category}`,
              JSON.stringify({
                feature: `vip_${scope.currency.toLowerCase()}`,
                vipType: scope.currency,
                categoryId: scope.service_category,
                city: scope.city,
                bidId: bid.id
              })
            ]);
            
            winnersCount++;
            winners++;
          }
          
          await client.query('COMMIT');
          processed++;
        } catch (error) {
          await client.query('ROLLBACK');
          logger.error('Failed to settle VIP auction scope', { scope, error });
          errors++;
        }
      }
      
      logger.info('VIP auction settlement completed', { processed, winners, errors });
      return { processed, winners, errors };
    } finally {
      client.release();
    }
  }
}

export const vipService = new VipService();
