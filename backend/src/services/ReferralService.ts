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
  referralId: string;
  rewardType: 'discount_10' | 'discount_50' | 'free_month';
  rewardValue: number;
  clicksRequired: number;
  clicksAchieved: number;
  earnedAt: Date;
  appliedAt?: Date;
  expiresAt: Date;
  status: 'earned' | 'applied' | 'expired';
}

export interface ReferralStats {
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
          const rewards = [
            { clicks: 50, type: 'discount_10', value: 0.1 },
            { clicks: 100, type: 'discount_50', value: 0.5 },
            { clicks: 500, type: 'free_month', value: 1.0 }
          ];

          // Check which rewards should be awarded
          for (const reward of rewards) {
            if (totalClicks >= reward.clicks) {
              // Check if reward already exists
              this.db.db.get(
                'SELECT id FROM referral_rewards WHERE referrer_user_id = ? AND referral_id = ? AND reward_type = ?',
                [referrerUserId, referralId, reward.type],
                (checkErr, existingReward) => {
                  if (checkErr) {
                    console.error('Error checking existing reward:', checkErr);
                    return;
                  }

                  if (!existingReward) {
                    // Award new reward
                    const rewardId = this.generateId();
                    const expiresAt = new Date();
                    expiresAt.setMonth(expiresAt.getMonth() + 6); // 6 months expiry

                    this.db.db.run(
                      'INSERT INTO referral_rewards (id, referrer_user_id, referral_id, reward_type, reward_value, clicks_required, clicks_achieved, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                      [rewardId, referrerUserId, referralId, reward.type, reward.value, reward.clicks, totalClicks, expiresAt.toISOString()],
                      (insertErr) => {
                        if (insertErr) {
                          console.error('Error inserting reward:', insertErr);
                        } else {
                          console.log(`✅ Awarded ${reward.type} reward to user ${referrerUserId}`);
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

                  resolve({
                    referralCode,
                    referralLink,
                    referredUsers,
                    totalRewards: rewards || []
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
}
