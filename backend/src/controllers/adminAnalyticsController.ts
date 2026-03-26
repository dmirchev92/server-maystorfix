import { Request, Response } from 'express';
import { Pool } from 'pg';
import logger from '../utils/logger';

// Get pool from environment
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'servicetext_pro',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'C58acfd5c!',
});

/**
 * Admin Analytics Controller
 * Provides comprehensive analytics for admin dashboard
 */

// Middleware to check admin role
export const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Admin access required' }
    });
  }
  next();
};

/**
 * GET /api/v1/admin/analytics/overview
 * Get high-level platform statistics
 */
export const getOverview = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        -- Users
        (SELECT COUNT(*) FROM users WHERE role = 'service_provider') as total_sps,
        (SELECT COUNT(*) FROM users WHERE role = 'customer') as total_customers,
        (SELECT COUNT(*) FROM users WHERE role = 'service_provider' AND created_at >= NOW() - INTERVAL '7 days') as new_sps_this_week,
        (SELECT COUNT(*) FROM users WHERE role = 'customer' AND created_at >= NOW() - INTERVAL '7 days') as new_customers_this_week,
        
        -- Cases
        (SELECT COUNT(*) FROM marketplace_service_cases) as total_cases,
        (SELECT COUNT(*) FROM marketplace_service_cases WHERE status = 'completed') as completed_cases,
        (SELECT COUNT(*) FROM marketplace_service_cases WHERE status = 'open') as open_cases,
        (SELECT COUNT(*) FROM marketplace_service_cases WHERE created_at >= NOW() - INTERVAL '7 days') as cases_this_week,
        (SELECT COUNT(*) FROM marketplace_service_cases WHERE created_at >= NOW() - INTERVAL '30 days') as cases_this_month,
        
        -- Bids
        (SELECT COUNT(*) FROM sp_case_bids) as total_bids,
        (SELECT COUNT(*) FROM sp_case_bids WHERE status = 'winner') as winning_bids,
        (SELECT COUNT(*) FROM sp_case_bids WHERE created_at >= NOW() - INTERVAL '7 days') as bids_this_week,
        
        -- Points
        (SELECT COALESCE(SUM(points_balance), 0) FROM users WHERE role = 'service_provider') as total_points_in_circulation,
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions WHERE transaction_type = 'spent') as total_points_spent,
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions WHERE transaction_type = 'spent' AND created_at >= NOW() - INTERVAL '7 days') as points_spent_this_week,
        
        -- Subscriptions
        (SELECT COUNT(*) FROM users WHERE role = 'service_provider' AND subscription_tier_id = 'free') as free_tier_sps,
        (SELECT COUNT(*) FROM users WHERE role = 'service_provider' AND subscription_tier_id = 'normal') as normal_tier_sps,
        (SELECT COUNT(*) FROM users WHERE role = 'service_provider' AND subscription_tier_id = 'pro') as pro_tier_sps
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error: any) {
    logger.error('Admin analytics overview error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/sp-performance
 * Get detailed SP performance analytics
 */
export const getSPPerformance = async (req: Request, res: Response) => {
  try {
    const { limit = 50, offset = 0, sortBy = 'cases_completed', order = 'desc' } = req.query;

    const validSortFields = ['cases_completed', 'cases_this_week', 'points_spent', 'rating', 'created_at'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy : 'cases_completed';
    const sortOrder = order === 'asc' ? 'ASC' : 'DESC';

    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        u.subscription_tier_id as tier,
        u.created_at,
        u.points_balance,
        u.points_total_earned,
        u.points_total_spent,
        spp.business_name,
        spp.city,
        spp.rating,
        spp.total_reviews,
        spp.service_category,
        
        -- Cases stats
        (SELECT COUNT(*) FROM marketplace_service_cases msc 
         WHERE msc.provider_id = u.id AND msc.status = 'completed') as cases_completed,
        
        (SELECT COUNT(*) FROM marketplace_service_cases msc 
         WHERE msc.provider_id = u.id AND msc.status = 'completed' 
         AND msc.completed_at >= NOW() - INTERVAL '7 days') as cases_this_week,
        
        (SELECT COUNT(*) FROM marketplace_service_cases msc 
         WHERE msc.provider_id = u.id AND msc.status = 'completed' 
         AND msc.completed_at >= NOW() - INTERVAL '30 days') as cases_this_month,
        
        -- Bids stats
        (SELECT COUNT(*) FROM sp_case_bids scb WHERE scb.provider_id = u.id) as total_bids,
        (SELECT COUNT(*) FROM sp_case_bids scb WHERE scb.provider_id = u.id AND scb.status = 'winner') as winning_bids,
        
        -- Points spent
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions spt 
         WHERE spt.user_id = u.id AND spt.transaction_type = 'spent') as points_spent,
        
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions spt 
         WHERE spt.user_id = u.id AND spt.transaction_type = 'spent'
         AND spt.created_at >= NOW() - INTERVAL '7 days') as points_spent_this_week

      FROM users u
      LEFT JOIN service_provider_profiles spp ON spp.user_id = u.id
      WHERE u.role = 'service_provider'
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const countResult = await pool.query(`
      SELECT COUNT(*) FROM users WHERE role = 'service_provider'
    `);

    res.json({
      success: true,
      data: {
        providers: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });
  } catch (error: any) {
    logger.error('Admin SP performance error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/budget-distribution
 * Get case distribution by budget range
 */
export const getBudgetDistribution = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        budget_range,
        COUNT(*) as case_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_count
      FROM marketplace_service_cases
      WHERE budget_range IS NOT NULL
      GROUP BY budget_range
      ORDER BY 
        CASE budget_range
          WHEN '1-250' THEN 1
          WHEN '251-500' THEN 2
          WHEN '501-750' THEN 3
          WHEN '751-1000' THEN 4
          WHEN '1001-2000' THEN 5
          WHEN '2001-3000' THEN 6
          WHEN '3001-4000' THEN 7
          WHEN '4001-5000' THEN 8
          WHEN '5001-6000' THEN 9
          WHEN '6001-7000' THEN 10
          WHEN '7001-8000' THEN 11
          WHEN '8001-9000' THEN 12
          WHEN '9001-10000' THEN 13
          WHEN '10000+' THEN 14
          ELSE 99
        END
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error: any) {
    logger.error('Admin budget distribution error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/points-economy
 * Get points economy statistics
 */
export const getPointsEconomy = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        -- Overall
        (SELECT COALESCE(SUM(points_balance), 0) FROM users WHERE role = 'service_provider') as total_balance,
        (SELECT COALESCE(SUM(points_total_earned), 0) FROM users WHERE role = 'service_provider') as total_earned,
        (SELECT COALESCE(SUM(points_total_spent), 0) FROM users WHERE role = 'service_provider') as total_spent,
        
        -- This week
        (SELECT COALESCE(SUM(points_amount), 0) FROM sp_points_transactions 
         WHERE transaction_type = 'earned' AND created_at >= NOW() - INTERVAL '7 days') as earned_this_week,
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions 
         WHERE transaction_type = 'spent' AND created_at >= NOW() - INTERVAL '7 days') as spent_this_week,
        
        -- This month
        (SELECT COALESCE(SUM(points_amount), 0) FROM sp_points_transactions 
         WHERE transaction_type = 'earned' AND created_at >= NOW() - INTERVAL '30 days') as earned_this_month,
        (SELECT COALESCE(SUM(ABS(points_amount)), 0) FROM sp_points_transactions 
         WHERE transaction_type = 'spent' AND created_at >= NOW() - INTERVAL '30 days') as spent_this_month,
        
        -- Transactions count
        (SELECT COUNT(*) FROM sp_points_transactions WHERE created_at >= NOW() - INTERVAL '7 days') as transactions_this_week,
        (SELECT COUNT(*) FROM sp_points_transactions WHERE created_at >= NOW() - INTERVAL '30 days') as transactions_this_month
    `);

    // Points spent by reason
    const reasonsResult = await pool.query(`
      SELECT 
        CASE 
          WHEN reason ILIKE '%bid%' OR reason ILIKE '%оферта%' THEN 'Bids'
          WHEN reason ILIKE '%sms%' THEN 'SMS'
          WHEN reason ILIKE '%vip%' THEN 'VIP'
          WHEN reason ILIKE '%direct%' OR reason ILIKE '%директ%' THEN 'Direct Assignment'
          ELSE 'Other'
        END as category,
        COUNT(*) as transaction_count,
        COALESCE(SUM(ABS(points_amount)), 0) as total_points
      FROM sp_points_transactions
      WHERE transaction_type = 'spent'
      GROUP BY category
      ORDER BY total_points DESC
    `);

    res.json({
      success: true,
      data: {
        overview: result.rows[0],
        spendingByCategory: reasonsResult.rows
      }
    });
  } catch (error: any) {
    logger.error('Admin points economy error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/recent-activity
 * Get recent platform activity
 */
export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;

    // Recent cases
    const casesResult = await pool.query(`
      SELECT 
        msc.id,
        msc.case_number,
        msc.title,
        msc.status,
        msc.budget_range,
        msc.service_category,
        msc.created_at,
        u.first_name as customer_first_name,
        u.last_name as customer_last_name
      FROM marketplace_service_cases msc
      LEFT JOIN users u ON u.id = msc.customer_id
      ORDER BY msc.created_at DESC
      LIMIT $1
    `, [limit]);

    // Recent bids
    const bidsResult = await pool.query(`
      SELECT 
        scb.id,
        scb.case_id,
        scb.provider_id,
        scb.status,
        scb.proposed_budget_range,
        scb.created_at,
        spp.business_name,
        u.first_name,
        u.last_name
      FROM sp_case_bids scb
      LEFT JOIN users u ON u.id = scb.provider_id
      LEFT JOIN service_provider_profiles spp ON spp.user_id = scb.provider_id
      ORDER BY scb.created_at DESC
      LIMIT $1
    `, [limit]);

    // Recent registrations
    const registrationsResult = await pool.query(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        role,
        subscription_tier_id,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT $1
    `, [limit]);

    res.json({
      success: true,
      data: {
        recentCases: casesResult.rows,
        recentBids: bidsResult.rows,
        recentRegistrations: registrationsResult.rows
      }
    });
  } catch (error: any) {
    logger.error('Admin recent activity error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/sp/:spId
 * Get detailed analytics for a specific SP
 */
export const getSPDetails = async (req: Request, res: Response) => {
  try {
    const { spId } = req.params;

    // SP profile
    const profileResult = await pool.query(`
      SELECT 
        u.*,
        spp.business_name,
        spp.description,
        spp.city,
        spp.neighborhood,
        spp.rating,
        spp.total_reviews,
        spp.service_category,
        spp.experience_years,
        spp.hourly_rate
      FROM users u
      LEFT JOIN service_provider_profiles spp ON spp.user_id = u.id
      WHERE u.id = $1 AND u.role = 'service_provider'
    `, [spId]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Service provider not found' }
      });
    }

    // Cases by budget range
    const casesByBudgetResult = await pool.query(`
      SELECT 
        budget_range,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
      FROM marketplace_service_cases
      WHERE provider_id = $1
      GROUP BY budget_range
    `, [spId]);

    // Points transactions
    const transactionsResult = await pool.query(`
      SELECT *
      FROM sp_points_transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [spId]);

    // Monthly activity (last 6 months)
    const monthlyResult = await pool.query(`
      SELECT 
        DATE_TRUNC('month', completed_at) as month,
        COUNT(*) as cases_completed
      FROM marketplace_service_cases
      WHERE provider_id = $1 AND status = 'completed'
        AND completed_at >= NOW() - INTERVAL '6 months'
      GROUP BY month
      ORDER BY month DESC
    `, [spId]);

    res.json({
      success: true,
      data: {
        profile: profileResult.rows[0],
        casesByBudget: casesByBudgetResult.rows,
        recentTransactions: transactionsResult.rows,
        monthlyActivity: monthlyResult.rows
      }
    });
  } catch (error: any) {
    logger.error('Admin SP details error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * POST /api/v1/admin/users/:userId/adjust-points
 * Manually adjust user points (admin only)
 */
export const adjustUserPoints = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { points, reason } = req.body;
    const adminUser = (req as any).user;

    if (!points || !reason) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Points and reason are required' }
      });
    }

    const pointsNum = parseInt(points);
    if (isNaN(pointsNum)) {
      return res.status(400).json({
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Points must be a number' }
      });
    }

    // Update user points
    const updateResult = await pool.query(`
      UPDATE users 
      SET 
        points_balance = points_balance + $1,
        points_total_earned = CASE WHEN $1 > 0 THEN points_total_earned + $1 ELSE points_total_earned END,
        points_total_spent = CASE WHEN $1 < 0 THEN points_total_spent + ABS($1) ELSE points_total_spent END
      WHERE id = $2
      RETURNING points_balance
    `, [pointsNum, userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found' }
      });
    }

    // Log transaction
    await pool.query(`
      INSERT INTO sp_points_transactions (id, user_id, transaction_type, points_amount, balance_after, reason, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      `admin_${Date.now()}`,
      userId,
      pointsNum > 0 ? 'earned' : 'spent',
      Math.abs(pointsNum),
      updateResult.rows[0].points_balance,
      `Admin adjustment by ${adminUser.email}: ${reason}`
    ]);

    logger.info('Admin adjusted user points', { 
      adminId: adminUser.id, 
      userId, 
      points: pointsNum, 
      reason 
    });

    res.json({
      success: true,
      data: {
        newBalance: updateResult.rows[0].points_balance,
        adjustment: pointsNum
      }
    });
  } catch (error: any) {
    logger.error('Admin adjust points error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ADJUST_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/sms
 * Get SMS statistics (tracked via points transactions with reason 'SMS sent')
 */
export const getSMSStats = async (req: Request, res: Response) => {
  try {
    const { userId, startDate, endDate } = req.query;

    let dateFilter = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (startDate) {
      dateFilter += ` AND created_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }
    if (endDate) {
      dateFilter += ` AND created_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    // Overall SMS stats
    const overallResult = await pool.query(`
      SELECT
        COUNT(*) as total_sms_sent,
        COUNT(DISTINCT user_id) as unique_senders,
        COALESCE(SUM(ABS(points_amount)), 0) as total_points_spent_on_sms
      FROM sp_points_transactions
      WHERE reason ILIKE '%sms%' ${dateFilter}
    `, params);

    // SMS this week
    const weekResult = await pool.query(`
      SELECT COUNT(*) as sms_this_week
      FROM sp_points_transactions
      WHERE reason ILIKE '%sms%' AND created_at >= NOW() - INTERVAL '7 days'
    `);

    // SMS this month
    const monthResult = await pool.query(`
      SELECT COUNT(*) as sms_this_month
      FROM sp_points_transactions
      WHERE reason ILIKE '%sms%' AND created_at >= NOW() - INTERVAL '30 days'
    `);

    // SMS by day (last 30 days)
    const dailyResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM sp_points_transactions
      WHERE reason ILIKE '%sms%' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Top SMS senders
    const topSendersResult = await pool.query(`
      SELECT 
        spt.user_id,
        u.email,
        u.first_name,
        u.last_name,
        spp.business_name,
        COUNT(*) as sms_count,
        COALESCE(SUM(ABS(spt.points_amount)), 0) as points_spent
      FROM sp_points_transactions spt
      LEFT JOIN users u ON u.id = spt.user_id
      LEFT JOIN service_provider_profiles spp ON spp.user_id = spt.user_id
      WHERE spt.reason ILIKE '%sms%'
      GROUP BY spt.user_id, u.email, u.first_name, u.last_name, spp.business_name
      ORDER BY sms_count DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: {
        overview: {
          ...overallResult.rows[0],
          sms_this_week: parseInt(weekResult.rows[0].sms_this_week),
          sms_this_month: parseInt(monthResult.rows[0].sms_this_month)
        },
        dailyStats: dailyResult.rows,
        topSenders: topSendersResult.rows
      }
    });
  } catch (error: any) {
    logger.error('Admin SMS stats error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

/**
 * GET /api/v1/admin/analytics/sms/user/:userId
 * Get SMS statistics for a specific user
 */
/**
 * GET /api/v1/admin/analytics/revenue
 * Get revenue and financial statistics
 */
export const getRevenueStats = async (req: Request, res: Response) => {
  try {
    // User tier distribution
    const tierDistribution = await pool.query(`
      SELECT 
        COALESCE(subscription_tier_id, 'free') as tier,
        COUNT(*) as count
      FROM users 
      WHERE role = 'service_provider'
      GROUP BY subscription_tier_id
      ORDER BY 
        CASE subscription_tier_id
          WHEN 'pro' THEN 1
          WHEN 'normal' THEN 2
          ELSE 3
        END
    `);

    // Points packages purchased (parse from reason field)
    const pointsPurchases = await pool.query(`
      SELECT 
        COUNT(*) as total_purchases,
        SUM(points_amount) as total_points_purchased,
        user_id,
        reason,
        created_at
      FROM sp_points_transactions 
      WHERE reason ILIKE '%purchased%'
      GROUP BY user_id, reason, created_at
      ORDER BY created_at DESC
    `);

    // Calculate revenue from points purchases (extract price from reason)
    const purchaseDetails = pointsPurchases.rows.map((row: any) => {
      // Parse "Points purchased (150 pts for 37.5 лв)" or similar
      const priceMatch = row.reason.match(/for\s+([\d.]+)\s*(лв|€|EUR)/i);
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      return {
        ...row,
        price,
        currency: priceMatch ? priceMatch[2] : 'лв'
      };
    });

    const totalPointsRevenue = purchaseDetails.reduce((sum: number, p: any) => sum + p.price, 0);

    // Subscription revenue (from subscription history)
    const subscriptionRevenue = await pool.query(`
      SELECT 
        tier_id,
        action,
        COUNT(*) as count,
        COALESCE(SUM(amount), 0) as total_amount,
        currency
      FROM sp_subscription_history
      WHERE action IN ('created', 'upgraded', 'renewed')
      GROUP BY tier_id, action, currency
      ORDER BY tier_id
    `);

    // Total subscription revenue
    const totalSubRevenue = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total
      FROM sp_subscription_history
      WHERE action IN ('created', 'upgraded', 'renewed')
    `);

    // Revenue this week/month
    const revenueThisWeek = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM sp_subscription_history
      WHERE action IN ('created', 'upgraded', 'renewed')
        AND created_at >= NOW() - INTERVAL '7 days'
    `);

    const revenueThisMonth = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM sp_subscription_history
      WHERE action IN ('created', 'upgraded', 'renewed')
        AND created_at >= NOW() - INTERVAL '30 days'
    `);

    // Monthly revenue breakdown (last 6 months)
    const monthlyRevenue = await pool.query(`
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COALESCE(SUM(amount), 0) as revenue,
        COUNT(*) as transactions
      FROM sp_subscription_history
      WHERE action IN ('created', 'upgraded', 'renewed')
        AND created_at >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `);

    // Get subscription tier prices for reference
    const tierPrices = await pool.query(`
      SELECT id, name, price_monthly, price_yearly FROM subscription_tiers
    `);

    res.json({
      success: true,
      data: {
        tierDistribution: tierDistribution.rows,
        pointsPurchases: {
          totalPurchases: pointsPurchases.rows.length,
          totalPointsPurchased: purchaseDetails.reduce((sum: number, p: any) => sum + parseInt(p.total_points_purchased), 0),
          totalRevenue: totalPointsRevenue,
          recentPurchases: purchaseDetails.slice(0, 20)
        },
        subscriptionRevenue: {
          byTier: subscriptionRevenue.rows,
          total: parseFloat(totalSubRevenue.rows[0]?.total || 0),
          thisWeek: parseFloat(revenueThisWeek.rows[0]?.total || 0),
          thisMonth: parseFloat(revenueThisMonth.rows[0]?.total || 0),
          monthly: monthlyRevenue.rows
        },
        tierPrices: tierPrices.rows,
        totalRevenue: totalPointsRevenue + parseFloat(totalSubRevenue.rows[0]?.total || 0)
      }
    });
  } catch (error: any) {
    logger.error('Admin revenue stats error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};

export const getUserSMSStats = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    // User SMS stats
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total_sms_sent,
        COALESCE(SUM(ABS(points_amount)), 0) as total_points_spent,
        MIN(created_at) as first_sms_at,
        MAX(created_at) as last_sms_at
      FROM sp_points_transactions
      WHERE user_id = $1 AND reason ILIKE '%sms%'
    `, [userId]);

    // SMS this week/month
    const periodResult = await pool.query(`
      SELECT
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as sms_this_week,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as sms_this_month
      FROM sp_points_transactions
      WHERE user_id = $1 AND reason ILIKE '%sms%'
    `, [userId]);

    // Recent SMS transactions
    const recentResult = await pool.query(`
      SELECT id, points_amount, balance_after, reason, created_at
      FROM sp_points_transactions
      WHERE user_id = $1 AND reason ILIKE '%sms%'
      ORDER BY created_at DESC
      LIMIT 50
    `, [userId]);

    // Daily breakdown (last 30 days)
    const dailyResult = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM sp_points_transactions
      WHERE user_id = $1 AND reason ILIKE '%sms%' AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `, [userId]);

    res.json({
      success: true,
      data: {
        stats: {
          ...statsResult.rows[0],
          ...periodResult.rows[0]
        },
        recentTransactions: recentResult.rows,
        dailyStats: dailyResult.rows
      }
    });
  } catch (error: any) {
    logger.error('Admin user SMS stats error', { error });
    res.status(500).json({
      success: false,
      error: { code: 'ANALYTICS_ERROR', message: error.message }
    });
  }
};
