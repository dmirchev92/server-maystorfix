// @ts-nocheck
import crypto from 'crypto';

export interface ReferralCode {
  id: string;
  userId: string;
  referralCode: string;
  createdAt: Date;
}

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  status: 'pending' | 'active' | 'inactive';
  createdAt: Date;
  activatedAt?: Date;
}

export interface ReferralClick {
  id: string;
  referralId: string;
  customerIp: string;
  customerUserAgent?: string;
  clickedAt: Date;
  isValid: boolean;
  monthYear: string;
}

export interface ReferralReward {
  id: string;
  referrerUserId: string;
  referralId?: string; // Optional for aggregate rewards
  rewardType: 'sms_30' | 'free_normal_month' | 'free_pro_month';
  rewardValue: number; // 30 for SMS, 1 for free months
  clicksRequired: number; // 50, 250, 500
  clicksAchieved: number;
  earnedAt: Date;
  appliedAt?: Date;
  expiresAt: Date;
  status: 'earned' | 'applied' | 'expired';
  isAggregate: boolean; // true for 250/500 click rewards, false for individual 50 click rewards
}

export interface ReferralStats {
  referralId: string;
  referredUser: {
    id: string;
    firstName: string;
    lastName: string;
    businessName?: string;
  };
  totalClicks: number;
  validClicks: number;
  monthlyClicks: number;
  status: string;
  profileUrl: string;
}

export interface AggregateReferralProgress {
  totalValidClicks: number; // Sum of all valid clicks from all referrals that reached 50+
  referralsAt50Plus: number; // Count of referrals with 50+ clicks
  nextMilestone: 250 | 500 | null;
  progressToNext: number; // Clicks needed to reach next milestone
  earnedRewards: {
    sms30Count: number; // Number of 30 SMS rewards earned
    freeNormalMonth: boolean;
    freeProMonth: boolean;
  };
}

export class ReferralService {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  private generateReferralCode(): string {
    // Generate 8-character alphanumeric code
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  /**
   * Get or create referral code for a service provider
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // First check if user already has a referral code
      this.db.db.get(
        'SELECT referral_code FROM sp_referral_codes WHERE user_id = ?',
        [userId],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            resolve(row.referral_code);
            return;
          }

          // Generate new unique referral code
          const generateUniqueCode = () => {
            const code = this.generateReferralCode();
            
            // Check if code is unique
            this.db.db.get(
              'SELECT 1 FROM sp_referral_codes WHERE referral_code = ?',
              [code],
              (checkErr, existingRow) => {
                if (checkErr) {
                  reject(checkErr);
                  return;
                }

                if (existingRow) {
                  // Code exists, try again
                  generateUniqueCode();
                  return;
                }

                // Code is unique, insert it
                this.db.db.run(
                  'INSERT INTO sp_referral_codes (id, user_id, referral_code) VALUES (?, ?, ?)',
                  [this.generateId(), userId, code],
                  (insertErr) => {
                    if (insertErr) {
                      reject(insertErr);
                    } else {
                      resolve(code);
                    }
                  }
                );
              }
            );
          };

          generateUniqueCode();
        }
      );
    });
  }

  /**
   * Create referral relationship when someone signs up via referral link
   */
  async createReferral(referralCode: string, referredUserId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Find the referrer by referral code
      this.db.db.get(
        'SELECT user_id FROM sp_referral_codes WHERE referral_code = ?',
        [referralCode],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            reject(new Error('Invalid referral code'));
            return;
          }

          const referrerUserId = row.user_id;

          // Check if referral already exists
          this.db.db.get(
            'SELECT id FROM sp_referrals WHERE referrer_user_id = ? AND referred_user_id = ?',
            [referrerUserId, referredUserId],
            (checkErr, existingReferral) => {
              if (checkErr) {
                reject(checkErr);
                return;
              }

              if (existingReferral) {
                resolve((existingReferral as any).id);
                return;
              }

              // Create new referral
              const referralId = this.generateId();
              this.db.db.run(
                'INSERT INTO sp_referrals (id, referrer_user_id, referred_user_id, referral_code, status, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [referralId, referrerUserId, referredUserId, referralCode, 'pending'],
                (insertErr) => {
                  if (insertErr) {
                    console.error('Error inserting referral:', insertErr);
                    reject(insertErr);
                  } else {
                    console.log(`✅ Created referral relationship: ${referralId} (${referrerUserId} -> ${referredUserId})`);
                    resolve(referralId);
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Track profile click with fraud prevention
   */
  async trackProfileClick(
    referredUserId: string,
    customerIp: string,
    userAgent?: string,
    customerUserId?: string,
    visitorId?: string
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const currentDate = new Date();
      const monthYear = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

      // Find active or pending referral for this user
      this.db.db.get(
        'SELECT id, referrer_user_id, status FROM sp_referrals WHERE referred_user_id = ? AND status IN (?, ?)',
        [referredUserId, 'active', 'pending'],
        (err, referral: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!referral) {
            console.log(`[REFERRAL SERVICE] No active referral found for user: ${referredUserId}`);
            // No active referral, still count as valid click but don't track
            resolve(true);
            return;
          }

          console.log(`[REFERRAL SERVICE] Found ${referral.status} referral: ${referral.id}, referrer: ${referral.referrer_user_id}`);

          // Check monthly click limit (25 clicks per month)
          this.db.db.get(
            'SELECT COUNT(*) as count FROM referral_clicks WHERE referral_id = ? AND month_year = ? AND is_valid = TRUE',
            [referral.id, monthYear],
            (countErr, countRow: any) => {
              if (countErr) {
                reject(countErr);
                return;
              }

              const monthlyClicks = countRow.count || 0;
              const isValid = monthlyClicks < 25;
              console.log(`[REFERRAL SERVICE] Monthly clicks: ${monthlyClicks}/25, valid: ${isValid}`);

              // Check for duplicate clicks based on user ID or visitor ID
              const identifierField = customerUserId ? 'customer_user_id' : 'visitor_id';
              const identifierValue = customerUserId || visitorId;
              
              if (!identifierValue) {
                console.log(`[REFERRAL SERVICE] No identifier provided - rejecting click`);
                resolve(false);
                return;
              }

              const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
              this.db.db.get(
                `SELECT COUNT(*) as count FROM referral_clicks WHERE referral_id = ? AND ${identifierField} = ? AND clicked_at > ?`,
                [referral.id, identifierValue, fiveMinutesAgo],
                (selfClickErr, selfClickRow: any) => {
                  if (selfClickErr) {
                    reject(selfClickErr);
                    return;
                  }

                  const recentClicksFromSameUser = selfClickRow.count || 0;
                  console.log(`[REFERRAL SERVICE] Recent clicks from ${identifierField} ${identifierValue}: ${recentClicksFromSameUser}`);
                  
                  // Allow 1 click per 5 minutes per user/visitor
                  const allowedClicks = recentClicksFromSameUser < 1;
                  const finalIsValid = isValid && allowedClicks;
                  console.log(`[REFERRAL SERVICE] Final validation: ${finalIsValid} (monthly limit: ${isValid}, allowed clicks: ${allowedClicks})`)

                  // Record the click
                  const clickId = this.generateId();
                  this.db.db.run(
                    'INSERT INTO referral_clicks (id, referral_id, customer_user_id, visitor_id, customer_ip, customer_user_agent, is_valid, month_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [clickId, referral.id, customerUserId, visitorId, customerIp, userAgent, finalIsValid, monthYear],
                    (insertErr) => {
                      if (insertErr) {
                        reject(insertErr);
                        return;
                      }

                      if (finalIsValid) {
                        // Check if we need to award any rewards
                        this.checkAndAwardRewards(referral.referrer_user_id, referral.id);
                      }

                      resolve(finalIsValid);
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Check and award rewards based on click milestones
   */
  private async checkAndAwardRewards(referrerUserId: string, referralId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get total valid clicks for this referral
      this.db.db.get(
        'SELECT COUNT(*) as totalClicks FROM referral_clicks WHERE referral_id = ? AND is_valid = TRUE',
        [referralId],
        (err, row: any) => {
          if (err) {
            reject(err);
            return;
          }

          const totalClicks = row.totalClicks || 0;
          
          // Individual referral reward: 30 SMS at 50 clicks
          const individualReward = { clicks: 50, type: 'sms_30', value: 30, isAggregate: false };
          
          // Check if this referral reached 50 clicks and award SMS
          if (totalClicks >= individualReward.clicks) {
            this.awardIndividualReward(referrerUserId, referralId, individualReward, totalClicks);
          }
          
          // Check aggregate rewards (across all referrals)
          this.checkAggregateRewards(referrerUserId);

          resolve();
        }
      );
    });
  }

  /**
   * Award individual referral reward (30 SMS at 50 clicks)
   */
  private async awardIndividualReward(
    referrerUserId: string,
    referralId: string,
    reward: any,
    totalClicks: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if reward already exists for this referral
      this.db.db.get(
        'SELECT id FROM referral_rewards WHERE referrer_user_id = ? AND referral_id = ? AND reward_type = ? AND is_aggregate = FALSE',
        [referrerUserId, referralId, reward.type],
        (checkErr, existingReward) => {
          if (checkErr) {
            console.error('Error checking existing individual reward:', checkErr);
            resolve();
            return;
          }

          if (!existingReward) {
            // Award new reward
            const rewardId = this.generateId();
            const expiresAt = new Date();
            expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months expiry

            this.db.db.run(
              'INSERT INTO referral_rewards (id, referrer_user_id, referral_id, reward_type, reward_value, clicks_required, clicks_achieved, expires_at, is_aggregate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [rewardId, referrerUserId, referralId, reward.type, reward.value, reward.clicks, totalClicks, expiresAt.toISOString(), reward.isAggregate ? 1 : 0],
              (insertErr) => {
                if (insertErr) {
                  console.error('Error inserting individual reward:', insertErr);
                } else {
                  console.log(`✅ Awarded ${reward.value} SMS to user ${referrerUserId} for referral ${referralId}`);
                }
                resolve();
              }
            );
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Check and award aggregate rewards (250 clicks = Normal month, 500 clicks = Pro month)
   */
  private async checkAggregateRewards(referrerUserId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get all referrals with 50+ clicks
      this.db.db.all(
        `SELECT r.id, COUNT(rc.id) as valid_clicks 
         FROM sp_referrals r
         LEFT JOIN referral_clicks rc ON r.id = rc.referral_id AND rc.is_valid = TRUE
         WHERE r.referrer_user_id = ? AND r.status IN ('active', 'pending')
         GROUP BY r.id
         HAVING COUNT(rc.id) >= 50`,
        [referrerUserId],
        (err, referrals: any[]) => {
          if (err) {
            console.error('Error getting aggregate referral data:', err);
            resolve();
            return;
          }

          const totalAggregateClicks = referrals.reduce((sum, ref) => sum + parseInt(ref.valid_clicks || 0), 0);
          const referralsAt50Plus = referrals.length;

          console.log(`[AGGREGATE] User ${referrerUserId}: ${referralsAt50Plus} referrals with 50+ clicks, total ${totalAggregateClicks} clicks`);

          const aggregateRewards = [
            { clicks: 250, type: 'free_normal_month', value: 1, referralsNeeded: 5 },
            { clicks: 500, type: 'free_pro_month', value: 1, referralsNeeded: 10 }
          ];

          // Check each aggregate milestone
          for (const reward of aggregateRewards) {
            if (totalAggregateClicks >= reward.clicks && referralsAt50Plus >= reward.referralsNeeded) {
              // Check if reward already exists
              this.db.db.get(
                'SELECT id FROM referral_rewards WHERE referrer_user_id = ? AND reward_type = ? AND is_aggregate = TRUE',
                [referrerUserId, reward.type],
                (checkErr, existingReward) => {
                  if (checkErr) {
                    console.error('Error checking existing aggregate reward:', checkErr);
                    return;
                  }

                  if (!existingReward) {
                    // Award new aggregate reward
                    const rewardId = this.generateId();
                    const expiresAt = new Date();
                    expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months expiry

                    this.db.db.run(
                      'INSERT INTO referral_rewards (id, referrer_user_id, referral_id, reward_type, reward_value, clicks_required, clicks_achieved, expires_at, is_aggregate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                      [rewardId, referrerUserId, null, reward.type, reward.value, reward.clicks, totalAggregateClicks, expiresAt.toISOString(), 1],
                      (insertErr) => {
                        if (insertErr) {
                          console.error('Error inserting aggregate reward:', insertErr);
                        } else {
                          console.log(`✅ Awarded ${reward.type} to user ${referrerUserId} (${referralsAt50Plus} referrals, ${totalAggregateClicks} total clicks)`);
                        }
                      }
                    );
                  }
                }
              );
            }
          }

          resolve();
        }
      );
    });
  }

  /**
   * Get referral dashboard data for a service provider
   */
  async getReferralDashboard(userId: string): Promise<{
    referralCode: string;
    referralLink: string;
    referredUsers: ReferralStats[];
    totalRewards: ReferralReward[];
  }> {
    return new Promise(async (resolve, reject) => {
      try {
        // Get referral code
        const referralCode = await this.getOrCreateReferralCode(userId);
        const referralLink = `${process.env.MARKETPLACE_URL || 'https://marketplace.servicetextpro.com'}/signup?ref=${referralCode}`;

        // Get referred users with stats
        this.db.db.all(
          `SELECT 
            r.id as referral_id,
            r.referred_user_id,
            r.status,
            u.first_name,
            u.last_name,
            sp.business_name,
            sp.id as profile_id
          FROM sp_referrals r
          JOIN users u ON r.referred_user_id = u.id
          LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id
          WHERE r.referrer_user_id = ?
          ORDER BY r.created_at DESC`,
          [userId],
          (err, referrals: any[]) => {
            if (err) {
              reject(err);
              return;
            }

            // Get click stats for each referral
            const referralPromises = (referrals || []).map((referral: any) => {
              return new Promise<ReferralStats>((resolveReferral) => {
                const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                
                this.db.db.all(
                  `SELECT 
                    COUNT(*) as total_clicks,
                    SUM(CASE WHEN is_valid = TRUE THEN 1 ELSE 0 END) as valid_clicks,
                    SUM(CASE WHEN is_valid = TRUE AND month_year = ? THEN 1 ELSE 0 END) as monthly_clicks
                  FROM referral_clicks 
                  WHERE referral_id = ?`,
                  [currentMonth, referral.referral_id],
                  (clickErr, clickStats: any[]) => {
                    const stats = clickStats[0] || { total_clicks: 0, valid_clicks: 0, monthly_clicks: 0 };
                    
                    resolveReferral({
                      referralId: referral.referral_id,
                      referredUser: {
                        id: referral.referred_user_id,
                        firstName: referral.first_name,
                        lastName: referral.last_name,
                        businessName: referral.business_name
                      },
                      totalClicks: stats.total_clicks || 0,
                      validClicks: stats.valid_clicks || 0,
                      monthlyClicks: stats.monthly_clicks || 0,
                      status: referral.status,
                      profileUrl: referral.profile_id ? `/provider/${referral.profile_id}` : '#'
                    });
                  }
                );
              });
            });

            Promise.all(referralPromises).then(referredUsers => {
              // Get rewards
              this.db.db.all(
                'SELECT * FROM referral_rewards WHERE referrer_user_id = ? ORDER BY earned_at DESC',
                [userId],
                (rewardErr, rewards: any[]) => {
                  if (rewardErr) {
                    reject(rewardErr);
                    return;
                  }

                  // Transform snake_case to camelCase for frontend
                  const transformedRewards = (rewards || []).map((r: any) => ({
                    id: r.id,
                    referralId: r.referral_id,
                    rewardType: r.reward_type,
                    rewardValue: r.reward_value,
                    clicksRequired: r.clicks_required,
                    clicksAchieved: r.clicks_achieved,
                    earnedAt: r.earned_at,
                    appliedAt: r.applied_at,
                    expiresAt: r.expires_at,
                    status: r.status,
                    isAggregate: r.is_aggregate,
                    smsSent: r.sms_sent
                  }));

                  resolve({
                    referralCode,
                    referralLink,
                    referredUsers,
                    totalRewards: transformedRewards
                  });
                }
              );
            }).catch(reject);
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Activate referral when referred SP becomes active/verified
   */
  async activateReferral(referredUserId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.db.run(
        'UPDATE sp_referrals SET status = ?, activated_at = CURRENT_TIMESTAMP WHERE referred_user_id = ? AND status = ?',
        ['active', referredUserId, 'pending'],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Apply reward discount
   */
  async applyReward(rewardId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.db.run(
        'UPDATE referral_rewards SET status = ?, applied_at = CURRENT_TIMESTAMP WHERE id = ? AND status = ?',
        ['applied', rewardId, 'earned'],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get available rewards for a user
   */
  async getAvailableRewards(userId: string): Promise<ReferralReward[]> {
    return new Promise((resolve, reject) => {
      this.db.db.all(
        'SELECT * FROM referral_rewards WHERE referrer_user_id = ? AND status = ? AND expires_at > NOW() ORDER BY earned_at DESC',
        [userId, 'earned'],
        (err, rows: any[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  /**
   * Get aggregate referral progress for display
   * Shows: 130|250|500 format (current clicks | Normal milestone | Pro milestone)
   */
  async getAggregateProgress(userId: string): Promise<AggregateReferralProgress> {
    return new Promise((resolve, reject) => {
      // Get ALL referrals with their click counts (for display)
      this.db.db.all(
        `SELECT r.id, COUNT(rc.id) as valid_clicks 
         FROM sp_referrals r
         LEFT JOIN referral_clicks rc ON r.id = rc.referral_id AND rc.is_valid = TRUE
         WHERE r.referrer_user_id = ? AND r.status IN ('active', 'pending')
         GROUP BY r.id`,
        [userId],
        (err, allReferrals: any[]) => {
          if (err) {
            reject(err);
            return;
          }

          // Calculate total clicks from ALL referrals (for display)
          const totalValidClicks = allReferrals.reduce((sum, ref) => sum + parseInt(ref.valid_clicks || 0), 0);
          
          // Count how many referrals have reached 50+ clicks (for rewards)
          const referralsAt50Plus = allReferrals.filter(ref => parseInt(ref.valid_clicks || 0) >= 50).length;

          // Check earned rewards
          this.db.db.all(
            'SELECT reward_type, COUNT(*) as count FROM referral_rewards WHERE referrer_user_id = ? AND status IN (?, ?) GROUP BY reward_type',
            [userId, 'earned', 'applied'],
            (rewardErr, rewards: any[]) => {
              if (rewardErr) {
                reject(rewardErr);
                return;
              }

              const sms30Count = rewards.find(r => r.reward_type === 'sms_30')?.count || 0;
              const freeNormalMonth = rewards.some(r => r.reward_type === 'free_normal_month');
              const freeProMonth = rewards.some(r => r.reward_type === 'free_pro_month');

              // Determine next milestone
              let nextMilestone: 250 | 500 | null = null;
              let progressToNext = 0;

              if (!freeProMonth) {
                nextMilestone = 500;
                progressToNext = 500 - totalValidClicks;
              } else if (!freeNormalMonth) {
                nextMilestone = 250;
                progressToNext = 250 - totalValidClicks;
              }

              resolve({
                totalValidClicks,
                referralsAt50Plus,
                nextMilestone,
                progressToNext: Math.max(0, progressToNext),
                earnedRewards: {
                  sms30Count,
                  freeNormalMonth,
                  freeProMonth
                }
              });
            }
          );
        }
      );
    });
  }

  /**
   * Generate claim token for reward (no SMS, direct claim)
   */
  async generateClaimToken(referrerUserId: string, rewardId: string): Promise<{ success: boolean; message?: string; token?: string }> {
    return new Promise((resolve, reject) => {
      // Get reward details
      this.db.db.get(
        'SELECT * FROM referral_rewards WHERE id = ? AND referrer_user_id = ? AND reward_type = ? AND is_aggregate = FALSE',
        [rewardId, referrerUserId, 'sms_30'],
        async (err, reward: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!reward) {
            resolve({ success: false, message: 'Reward not found' });
            return;
          }

          if (reward.status === 'applied') {
            resolve({ success: false, message: 'Reward already claimed' });
            return;
          }

          // Generate unique token (16 chars = 8 bytes)
          const token = crypto.randomBytes(8).toString('hex');
          const tokenId = this.generateId();
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

          // Create claim token
          this.db.db.run(
            'INSERT INTO referral_sms_claim_tokens (id, referral_id, reward_id, referrer_user_id, token, sms_amount, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [tokenId, reward.referral_id, rewardId, referrerUserId, token, 30, expiresAt.toISOString()],
            (insertErr) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }

              resolve({ 
                success: true, 
                token: token
              });
            }
          );
        }
      );
    });
  }

  /**
   * Send SMS reward claim link to referrer (legacy - not used)
   */
  async sendSMSRewardClaim(referrerUserId: string, rewardId: string): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve, reject) => {
      // Get reward details
      this.db.db.get(
        'SELECT * FROM referral_rewards WHERE id = ? AND referrer_user_id = ? AND reward_type = ? AND is_aggregate = FALSE',
        [rewardId, referrerUserId, 'sms_30'],
        async (err, reward: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!reward) {
            resolve({ success: false, message: 'Reward not found' });
            return;
          }

          if (reward.sms_sent) {
            resolve({ success: false, message: 'SMS already sent for this reward' });
            return;
          }

          // Get referrer phone number
          this.db.db.get(
            'SELECT phone_number FROM users WHERE id = ?',
            [referrerUserId],
            async (userErr, user: any) => {
              if (userErr) {
                reject(userErr);
                return;
              }

              if (!user || !user.phone_number) {
                resolve({ success: false, message: 'Phone number not found' });
                return;
              }

              // Generate unique token (16 chars = 8 bytes)
              const token = crypto.randomBytes(8).toString('hex');
              const tokenId = this.generateId();
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

              // Create claim token
              this.db.db.run(
                'INSERT INTO referral_sms_claim_tokens (id, referral_id, reward_id, referrer_user_id, token, sms_amount, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [tokenId, reward.referral_id, rewardId, referrerUserId, token, 30, expiresAt.toISOString()],
                async (insertErr) => {
                  if (insertErr) {
                    reject(insertErr);
                    return;
                  }

                  // Send SMS via Twilio/Mobica
                  const claimUrl = `${process.env.MARKETPLACE_URL || 'https://maystorfix.com'}/claim-sms/${token}`;
                  const message = `Поздравления! Спечелихте 30 SMS. Получете ги тук: ${claimUrl}`;

                  try {
                    // TODO: Integrate with actual SMS service
                    console.log(`📱 SMS would be sent to ${user.phone_number}: ${message}`);

                    // Mark SMS as sent
                    this.db.db.run(
                      'UPDATE referral_rewards SET sms_sent = TRUE, sms_sent_at = NOW() WHERE id = ?',
                      [rewardId],
                      (updateErr) => {
                        if (updateErr) {
                          console.error('Error updating sms_sent flag:', updateErr);
                        }
                      }
                    );

                    resolve({ 
                      success: true, 
                      message: 'SMS sent successfully',
                    });
                  } catch (smsErr) {
                    console.error('Error sending SMS:', smsErr);
                    resolve({ success: false, message: 'Failed to send SMS' });
                  }
                }
              );
            }
          );
        }
      );
    });
  }

  /**
   * Claim SMS reward using one-time token
   */
  async claimSMSReward(token: string): Promise<{ success: boolean; message: string; smsAdded?: number }> {
    return new Promise((resolve, reject) => {
      // Get claim token
      this.db.db.get(
        'SELECT * FROM referral_sms_claim_tokens WHERE token = ?',
        [token],
        async (err, claimToken: any) => {
          if (err) {
            reject(err);
            return;
          }

          if (!claimToken) {
            resolve({ success: false, message: 'Invalid token' });
            return;
          }

          if (claimToken.status === 'claimed') {
            resolve({ success: false, message: 'Reward already claimed' });
            return;
          }

          if (claimToken.status === 'expired' || new Date(claimToken.expires_at) < new Date()) {
            resolve({ success: false, message: 'Token expired' });
            return;
          }

          // Add 30 SMS to referrer's addon balance
          this.db.db.run(
            `INSERT INTO sp_sms_packages (id, user_id, package_type, sms_count, sms_remaining, price, purchased_at, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW() + INTERVAL '1 year')`,
            [this.generateId(), claimToken.referrer_user_id, 'referral_reward', 30, 30, 0],
            (insertErr) => {
              if (insertErr) {
                reject(insertErr);
                return;
              }

              // Mark token as claimed
              this.db.db.run(
                'UPDATE referral_sms_claim_tokens SET status = ?, claimed_at = NOW() WHERE id = ?',
                ['claimed', claimToken.id],
                (updateErr) => {
                  if (updateErr) {
                    console.error('Error updating claim token:', updateErr);
                  }
                }
              );

              // Mark reward as applied
              this.db.db.run(
                'UPDATE referral_rewards SET status = ?, applied_at = NOW() WHERE id = ?',
                ['applied', claimToken.reward_id],
                (rewardUpdateErr) => {
                  if (rewardUpdateErr) {
                    console.error('Error updating reward status:', rewardUpdateErr);
                  }
                }
              );

              resolve({ 
                success: true, 
                message: '30 SMS successfully added to your account!',
                smsAdded: 30
              });
            }
          );
        }
      );
    });
  }
}
