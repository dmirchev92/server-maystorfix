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
export declare class ReferralService {
    private db;
    constructor(db: any);
    private generateId;
    private generateReferralCode;
    getOrCreateReferralCode(userId: string): Promise<string>;
    createReferral(referralCode: string, referredUserId: string): Promise<string>;
    trackProfileClick(referredUserId: string, customerIp: string, userAgent?: string, customerUserId?: string, visitorId?: string): Promise<boolean>;
    private checkAndAwardRewards;
    getReferralDashboard(userId: string): Promise<{
        referralCode: string;
        referralLink: string;
        referredUsers: ReferralStats[];
        totalRewards: ReferralReward[];
    }>;
    activateReferral(referredUserId: string): Promise<void>;
    applyReward(rewardId: string): Promise<void>;
    getAvailableRewards(userId: string): Promise<ReferralReward[]>;
}
//# sourceMappingURL=ReferralService.d.ts.map