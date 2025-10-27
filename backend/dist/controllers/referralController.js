"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReferralCode = exports.applyReward = exports.getAvailableRewards = exports.activateReferral = exports.createReferral = exports.trackProfileClick = exports.getReferralDashboard = exports.getReferralCode = void 0;
const ReferralService_1 = require("../services/ReferralService");
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
const referralService = new ReferralService_1.ReferralService(db);
const getReferralCode = async (req, res) => {
    try {
        const userId = req.user?.id;
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
    }
    catch (error) {
        console.error('Error getting referral code:', error);
        res.status(500).json({ error: 'Failed to get referral code' });
    }
};
exports.getReferralCode = getReferralCode;
const getReferralDashboard = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const dashboard = await referralService.getReferralDashboard(userId);
        res.json({
            success: true,
            data: dashboard
        });
    }
    catch (error) {
        console.error('Error getting referral dashboard:', error);
        res.status(500).json({ error: 'Failed to get referral dashboard' });
    }
};
exports.getReferralDashboard = getReferralDashboard;
const trackProfileClick = async (req, res) => {
    try {
        const { profileId } = req.params;
        const { customerUserId, visitorId } = req.body;
        const customerIp = req.ip || req.connection?.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent');
        console.log(`[REFERRAL CLICK] Profile: ${profileId}, IP: ${customerIp}`);
        console.log(`[REFERRAL CLICK] Customer ID: ${customerUserId}, Visitor ID: ${visitorId}`);
        const user = await new Promise((resolve, reject) => {
            db.db.get('SELECT id, role FROM users WHERE id = ?', [profileId], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
        if (!user) {
            res.status(404).json({
                success: false,
                error: 'Profile not found'
            });
            return;
        }
        console.log(`[REFERRAL CLICK] Found user: ${user.id}, role: ${user.role}`);
        const success = await referralService.trackProfileClick(profileId, customerIp, userAgent, customerUserId, visitorId);
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
    }
    catch (error) {
        console.error('[REFERRAL CONTROLLER] Error tracking profile click:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to track profile click'
        });
    }
};
exports.trackProfileClick = trackProfileClick;
const createReferral = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error creating referral:', error);
        if (error?.message === 'Invalid referral code') {
            res.status(400).json({ error: 'Invalid referral code' });
        }
        else {
            res.status(500).json({ error: 'Failed to create referral' });
        }
    }
};
exports.createReferral = createReferral;
const activateReferral = async (req, res) => {
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
    }
    catch (error) {
        console.error('Error activating referral:', error);
        res.status(500).json({ error: 'Failed to activate referral' });
    }
};
exports.activateReferral = activateReferral;
const getAvailableRewards = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        const rewards = await referralService.getAvailableRewards(userId);
        res.json({
            success: true,
            data: rewards
        });
    }
    catch (error) {
        console.error('Error getting available rewards:', error);
        res.status(500).json({ error: 'Failed to get available rewards' });
    }
};
exports.getAvailableRewards = getAvailableRewards;
const applyReward = async (req, res) => {
    try {
        const { rewardId } = req.params;
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
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
    }
    catch (error) {
        console.error('Error applying reward:', error);
        res.status(500).json({ error: 'Failed to apply reward' });
    }
};
exports.applyReward = applyReward;
const validateReferralCode = async (req, res) => {
    try {
        const { code } = req.params;
        const referrerInfo = await new Promise((resolve, reject) => {
            db.db.get('SELECT u.first_name, u.last_name, sp.business_name FROM sp_referral_codes src JOIN users u ON src.user_id = u.id LEFT JOIN service_provider_profiles sp ON u.id = sp.user_id WHERE src.referral_code = ?', [code], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
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
    }
    catch (error) {
        console.error('Error validating referral code:', error);
        res.status(500).json({ error: 'Failed to validate referral code' });
    }
};
exports.validateReferralCode = validateReferralCode;
//# sourceMappingURL=referralController.js.map