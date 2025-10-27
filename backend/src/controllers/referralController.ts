import { Request, Response } from 'express';
import { ReferralService } from '../services/ReferralService';
import { DatabaseFactory } from '../models/DatabaseFactory';

const db = DatabaseFactory.getDatabase();
const referralService = new ReferralService(db);

/**
 * Get referral code and link for authenticated SP
 */
export const getReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const referralCode = await referralService.getOrCreateReferralCode(userId);
    const referralLink = `${process.env.MARKETPLACE_URL || 'http://localhost:3002'}/signup?ref=${referralCode}`;

    res.json({
      success: true,
      data: {
        referralCode,
        referralLink
      }
    });
  } catch (error) {
    console.error('Error getting referral code:', error);
    res.status(500).json({ error: 'Failed to get referral code' });
  }
};

/**
 * Get referral dashboard with all referred users and stats
 */
export const getReferralDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const dashboard = await referralService.getReferralDashboard(userId);

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting referral dashboard:', error);
    res.status(500).json({ error: 'Failed to get referral dashboard' });
  }
};

/**
 * Track profile click (called when customer visits SP profile)
 */
export const trackProfileClick = async (req: Request, res: Response): Promise<void> => {
  try {
    const { profileId } = req.params;
    const { customerUserId, visitorId } = req.body;
    const customerIp = req.ip || (req as any).connection?.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent');

    console.log(`[REFERRAL CLICK] Profile: ${profileId}, IP: ${customerIp}`);
    console.log(`[REFERRAL CLICK] Customer ID: ${customerUserId}, Visitor ID: ${visitorId}`);

    // The profileId is actually a user ID from the marketplace
    // First check if this user exists
    const user = await new Promise<any>((resolve, reject) => {
      db.db.get(
        'SELECT id, role FROM users WHERE id = ?',
        [profileId],
        (err: any, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: 'Profile not found'
      });
      return;
    }

    console.log(`[REFERRAL CLICK] Found user: ${user.id}, role: ${user.role}`);

    const success = await referralService.trackProfileClick(
      profileId,
      customerIp,
      userAgent,
      customerUserId,
      visitorId
    );

    res.json({
      success: true,
      data: {
        tracked: success,
        profileId,
        customerUserId,
        visitorId,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[REFERRAL CONTROLLER] Error tracking profile click:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track profile click'
    });
  }
};

/**
 * Create referral when someone signs up via referral link
 */
export const createReferral = async (req: Request, res: Response): Promise<void> => {
  try {
    const { referralCode, referredUserId } = req.body;

    if (!referralCode || !referredUserId) {
      res.status(400).json({ error: 'Referral code and referred user ID are required' });
      return;
    }

    const referralId = await referralService.createReferral(referralCode, referredUserId);

    res.json({
      success: true,
      data: { referralId }
    });
  } catch (error: any) {
    console.error('Error creating referral:', error);
    if (error?.message === 'Invalid referral code') {
      res.status(400).json({ error: 'Invalid referral code' });
    } else {
      res.status(500).json({ error: 'Failed to create referral' });
    }
  }
};

/**
 * Activate referral when SP becomes verified/active
 */
export const activateReferral = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }

    await referralService.activateReferral(userId);

    res.json({
      success: true,
      message: 'Referral activated successfully'
    });
  } catch (error) {
    console.error('Error activating referral:', error);
    res.status(500).json({ error: 'Failed to activate referral' });
  }
};

/**
 * Get available rewards for authenticated user
 */
export const getAvailableRewards = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const rewards = await referralService.getAvailableRewards(userId);

    res.json({
      success: true,
      data: rewards
    });
  } catch (error) {
    console.error('Error getting available rewards:', error);
    res.status(500).json({ error: 'Failed to get available rewards' });
  }
};

/**
 * Apply reward discount
 */
export const applyReward = async (req: Request, res: Response): Promise<void> => {
  try {
    const { rewardId } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify reward belongs to user
    const rewards = await referralService.getAvailableRewards(userId);
    const reward = rewards.find(r => r.id === rewardId);

    if (!reward) {
      res.status(404).json({ error: 'Reward not found or not available' });
      return;
    }

    await referralService.applyReward(rewardId);

    res.json({
      success: true,
      message: 'Reward applied successfully',
      data: {
        rewardType: reward.rewardType,
        rewardValue: reward.rewardValue
      }
    });
  } catch (error) {
    console.error('Error applying reward:', error);
    res.status(500).json({ error: 'Failed to apply reward' });
  }
};

/**
 * Validate referral code (for signup page)
 */
export const validateReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.params;

    // Check if referral code exists and get referrer info
    const referrerInfo = await new Promise<any>((resolve, reject) => {
      db.db.get(
        'SELECT u.first_name, u.last_name, sp.business_name FROM sp_referral_codes src JOIN users u ON src.user_id = u.id LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id WHERE src.referral_code = ?',
        [code],
        (err: any, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    const isValid = !!referrerInfo;
    const referrerName = referrerInfo ? 
      (referrerInfo.business_name || `${referrerInfo.first_name} ${referrerInfo.last_name}`) : 
      null;

    res.json({
      success: true,
      data: { 
        valid: isValid,
        referrerName: referrerName
      }
    });
  } catch (error) {
    console.error('Error validating referral code:', error);
    res.status(500).json({ error: 'Failed to validate referral code' });
  }
};
