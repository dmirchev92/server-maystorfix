"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConversation = exports.addReview = exports.sendMessage = exports.getInquiries = exports.createInquiry = exports.getNeighborhoods = exports.getCities = exports.getServiceCategories = exports.createOrUpdateProfile = exports.updateUserProfile = exports.getProviderConversations = exports.searchProviders = exports.getProvider = void 0;
const DatabaseFactory_1 = require("../models/DatabaseFactory");
const logger_1 = __importDefault(require("../utils/logger"));
const db = DatabaseFactory_1.DatabaseFactory.getDatabase();
const getProvider = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Provider ID is required'
                }
            });
            return;
        }
        logger_1.default.info('🔍 Getting provider info for user ID:', { userId: id });
        let actualUserId = id;
        if (id.startsWith('device_')) {
            logger_1.default.info('🔄 Device ID detected, using fallback user mapping...', { deviceId: id });
            const fallbackUser = await new Promise((resolve, reject) => {
                db.db.get(`SELECT id FROM users WHERE role = 'tradesperson' ORDER BY created_at DESC LIMIT 1`, [], (err, row) => {
                    if (err)
                        reject(err);
                    else
                        resolve(row);
                });
            });
            if (fallbackUser) {
                actualUserId = fallbackUser.id;
                logger_1.default.info('✅ Mapped device ID to user:', { deviceId: id, actualUserId });
            }
            else {
                logger_1.default.error('❌ No tradesperson user found for device ID mapping');
                res.status(404).json({
                    success: false,
                    error: {
                        code: 'NOT_FOUND',
                        message: 'No service provider found'
                    }
                });
                return;
            }
        }
        const user = await new Promise((resolve, reject) => {
            db.db.get(`SELECT id, email, first_name, last_name, phone_number, role FROM users WHERE id = ?`, [actualUserId], (err, row) => {
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
                error: {
                    code: 'NOT_FOUND',
                    message: 'Provider not found'
                }
            });
            return;
        }
        const profile = await new Promise((resolve, reject) => {
            db.db.get(`SELECT 
          id, user_id, business_name, service_category, description,
          experience_years, hourly_rate, city, neighborhood, address, 
          phone_number, email, website_url, profile_image_url, 
          rating, total_reviews, is_active, created_at, updated_at
         FROM service_provider_profiles 
         WHERE user_id = ?`, [actualUserId], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row);
                }
            });
        });
        const certificates = await new Promise((resolve, reject) => {
            db.db.all(`SELECT id, title, file_url as fileUrl, issued_by as issuedBy, issued_at as issuedAt 
         FROM provider_certificates 
         WHERE user_id = ? 
         ORDER BY created_at DESC`, [actualUserId], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
        const gallery = await new Promise((resolve, reject) => {
            db.db.all(`SELECT image_url 
         FROM provider_gallery 
         WHERE user_id = ? 
         ORDER BY created_at DESC`, [actualUserId], (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve((rows || []).map((row) => row.image_url));
                }
            });
        });
        const providerData = {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            phoneNumber: user.phone_number,
            role: user.role,
            businessName: profile?.business_name || `${user.first_name} ${user.last_name}`,
            serviceCategory: profile?.service_category || 'general',
            description: profile?.description || 'Professional service provider',
            experienceYears: profile?.experience_years || 0,
            hourlyRate: profile?.hourly_rate || 0,
            city: profile?.city || 'Sofia',
            neighborhood: profile?.neighborhood,
            address: profile?.address,
            profilePhone: profile?.phone_number,
            profileEmail: profile?.email,
            website: profile?.website_url,
            profileImageUrl: profile?.profile_image_url,
            rating: profile?.rating || 0,
            totalReviews: profile?.total_reviews || 0,
            isActive: profile?.is_active !== undefined ? Boolean(profile.is_active) : true,
            profileCreatedAt: profile?.created_at,
            profileUpdatedAt: profile?.updated_at,
            certificates: certificates,
            gallery: gallery
        };
        logger_1.default.info('✅ Provider info retrieved successfully', {
            userId: id,
            businessName: providerData.businessName,
            serviceCategory: providerData.serviceCategory,
            hasProfile: !!profile
        });
        res.json({
            success: true,
            data: providerData,
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error getting provider info:', {
            error: error instanceof Error ? error.message : error,
            stack: error instanceof Error ? error.stack : undefined,
            userId: req.params.id
        });
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to retrieve provider information'
            }
        });
    }
};
exports.getProvider = getProvider;
const searchProviders = async (req, res) => {
    try {
        const { city, neighborhood, category, limit = 50, offset = 0 } = req.query;
        logger_1.default.info('🔍 Searching providers with filters:', { city, neighborhood, category, limit, offset });
        let query = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone_number,
        spp.business_name, spp.service_category, spp.description,
        spp.experience_years, spp.hourly_rate, spp.city, spp.neighborhood, 
        spp.address, spp.phone_number as profile_phone, 
        spp.email as profile_email, spp.website_url as website, 
        spp.profile_image_url, spp.rating, spp.total_reviews, spp.is_active
      FROM users u
      LEFT JOIN service_provider_profiles spp ON u.id = spp.user_id
      WHERE u.role = 'tradesperson' AND (spp.is_active = TRUE OR spp.is_active IS NULL)
    `;
        const params = [];
        if (city) {
            query += ' AND spp.city = ?';
            params.push(city);
        }
        if (neighborhood) {
            query += ' AND spp.neighborhood = ?';
            params.push(neighborhood);
        }
        if (category) {
            query += ' AND spp.service_category = ?';
            params.push(category);
        }
        query += ' ORDER BY spp.created_at DESC LIMIT ? OFFSET ?';
        params.push(Number(limit), Number(offset));
        const providers = await new Promise((resolve, reject) => {
            db.db.all(query, params, (err, rows) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(rows || []);
                }
            });
        });
        const transformedProviders = providers.map(provider => ({
            id: provider.id,
            email: provider.email,
            firstName: provider.first_name,
            lastName: provider.last_name,
            phoneNumber: provider.phone_number,
            businessName: provider.business_name || `${provider.first_name} ${provider.last_name}`,
            serviceCategory: provider.service_category || 'general',
            description: provider.description || 'Professional service provider',
            experienceYears: provider.experience_years || 0,
            hourlyRate: provider.hourly_rate || 0,
            city: provider.city || 'Sofia',
            neighborhood: provider.neighborhood,
            address: provider.address,
            profilePhone: provider.profile_phone,
            profileEmail: provider.profile_email,
            website: provider.website,
            profileImageUrl: provider.profile_image_url,
            rating: provider.rating || 0,
            totalReviews: provider.total_reviews || 0,
            isActive: Boolean(provider.is_active)
        }));
        logger_1.default.info('✅ Provider search completed', {
            resultsCount: transformedProviders.length,
            filters: { city, neighborhood, category }
        });
        res.json({
            success: true,
            data: transformedProviders,
            metadata: {
                total: transformedProviders.length,
                limit: Number(limit),
                offset: Number(offset),
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error searching providers:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to search providers'
            }
        });
    }
};
exports.searchProviders = searchProviders;
const getProviderConversations = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Provider ID is required'
                }
            });
            return;
        }
        logger_1.default.info('🔍 Getting marketplace conversations for provider:', { providerId: id });
        const conversations = await db.getAllUserConversations(id);
        const marketplaceConversations = conversations.filter((conv) => conv.conversation_type === 'marketplace');
        logger_1.default.info('✅ Provider conversations retrieved', {
            providerId: id,
            conversationsCount: marketplaceConversations.length
        });
        res.json({
            success: true,
            data: marketplaceConversations,
            metadata: {
                total: marketplaceConversations.length,
                timestamp: new Date().toISOString(),
                version: '1.0.0'
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error getting provider conversations:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to retrieve provider conversations'
            }
        });
    }
};
exports.getProviderConversations = getProviderConversations;
const updateUserProfile = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
            return;
        }
        const { firstName, lastName, phoneNumber, profile, currentPassword, newPassword } = req.body;
        logger_1.default.info('🔄 Updating user profile:', { userId, hasProfile: !!profile, hasPasswordChange: !!newPassword });
        if (firstName || lastName || phoneNumber) {
            await new Promise((resolve, reject) => {
                const updates = [];
                const params = [];
                if (firstName) {
                    updates.push('first_name = ?');
                    params.push(firstName);
                }
                if (lastName) {
                    updates.push('last_name = ?');
                    params.push(lastName);
                }
                if (phoneNumber) {
                    updates.push('phone_number = ?');
                    params.push(phoneNumber);
                }
                if (updates.length > 0) {
                    updates.push('updated_at = CURRENT_TIMESTAMP');
                    params.push(userId);
                    db.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        }
        if (profile) {
            await db.createOrUpdateProviderProfile(userId, profile);
        }
        if (currentPassword && newPassword) {
            logger_1.default.info('⚠️ Password change requested but not implemented yet');
        }
        const updatedUser = await new Promise((resolve, reject) => {
            db.db.get('SELECT id, email, first_name, last_name, phone_number, role FROM users WHERE id = ?', [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
        logger_1.default.info('✅ User profile updated successfully:', { userId });
        res.json({
            success: true,
            data: {
                message: 'Profile updated successfully',
                user: {
                    id: updatedUser.id,
                    email: updatedUser.email,
                    firstName: updatedUser.first_name,
                    lastName: updatedUser.last_name,
                    phoneNumber: updatedUser.phone_number,
                    role: updatedUser.role
                }
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error updating user profile:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
    }
};
exports.updateUserProfile = updateUserProfile;
const createOrUpdateProfile = async (req, res) => {
    try {
        const { userId, profile, gallery, certificates } = req.body || {};
        if (!userId) {
            res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'userId is required' } });
            return;
        }
        logger_1.default.info('🔄 Updating provider profile:', { userId, profile: !!profile });
        if (profile && (profile.firstName || profile.lastName || profile.phoneNumber)) {
            await new Promise((resolve, reject) => {
                const updates = [];
                const params = [];
                if (profile.firstName) {
                    updates.push('first_name = ?');
                    params.push(profile.firstName);
                }
                if (profile.lastName) {
                    updates.push('last_name = ?');
                    params.push(profile.lastName);
                }
                if (profile.phoneNumber) {
                    updates.push('phone_number = ?');
                    params.push(profile.phoneNumber);
                }
                if (updates.length > 0) {
                    updates.push('updated_at = CURRENT_TIMESTAMP');
                    params.push(userId);
                    db.db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
                        if (err) {
                            logger_1.default.error('❌ Error updating users table:', err);
                            reject(err);
                        }
                        else {
                            logger_1.default.info('✅ Updated users table:', { userId, updates: updates.slice(0, -1) });
                            resolve();
                        }
                    });
                }
                else {
                    resolve();
                }
            });
        }
        await db.createOrUpdateProviderProfile(userId, profile || {});
        if (Array.isArray(gallery))
            await db.replaceProviderGallery(userId, gallery);
        if (Array.isArray(certificates))
            await db.replaceProviderCertificates(userId, certificates);
        const updatedProvider = await getUpdatedProviderData(userId);
        logger_1.default.info('✅ Provider profile updated successfully:', {
            userId,
            businessName: updatedProvider?.businessName
        });
        const io = req.io;
        if (io && updatedProvider) {
            const updateData = {
                type: 'profile_update',
                providerId: userId,
                provider: updatedProvider,
                timestamp: new Date().toISOString()
            };
            io.emit('provider_profile_updated', updateData);
            if (updatedProvider.city) {
                io.to(`location-${updatedProvider.city}`).emit('provider_profile_updated', updateData);
                if (updatedProvider.neighborhood) {
                    io.to(`location-${updatedProvider.city}-${updatedProvider.neighborhood}`).emit('provider_profile_updated', updateData);
                }
            }
            if (updatedProvider.service_category) {
                io.to(`category-${updatedProvider.service_category}`).emit('provider_profile_updated', updateData);
            }
            logger_1.default.info('📡 Real-time update broadcasted to Marketplace clients:', {
                userId,
                city: updatedProvider.city,
                neighborhood: updatedProvider.neighborhood,
                category: updatedProvider.service_category
            });
        }
        res.json({
            success: true,
            data: {
                message: 'Profile updated successfully',
                provider: updatedProvider
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error updating provider profile:', error);
        res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
    }
};
exports.createOrUpdateProfile = createOrUpdateProfile;
const getUpdatedProviderData = async (userId) => {
    try {
        const user = await new Promise((resolve, reject) => {
            db.db.get(`SELECT id, email, first_name, last_name, phone_number FROM users WHERE id = ?`, [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
        if (!user)
            return null;
        const profile = await new Promise((resolve, reject) => {
            db.db.get(`SELECT * FROM service_provider_profiles WHERE user_id = ?`, [userId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
        return {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            phone_number: user.phone_number,
            business_name: profile?.business_name || `${user.first_name} ${user.last_name}`,
            service_category: profile?.service_category || 'general',
            description: profile?.description || 'Professional service provider',
            experience_years: profile?.experience_years || 0,
            hourly_rate: profile?.hourly_rate || 0,
            city: profile?.city || 'Sofia',
            neighborhood: profile?.neighborhood,
            rating: profile?.rating || 0,
            total_reviews: profile?.total_reviews || 0,
            profile_image_url: profile?.profile_image_url,
            is_active: profile?.is_active !== undefined ? Boolean(profile.is_active) : true,
            updated_at: new Date().toISOString()
        };
    }
    catch (error) {
        logger_1.default.error('❌ Error getting updated provider data:', error);
        return null;
    }
};
const getServiceCategories = async (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'electrician', name: 'Electrician', nameEn: 'Electrician' },
            { id: 'plumber', name: 'Plumber', nameEn: 'Plumber' },
            { id: 'carpenter', name: 'Carpenter', nameEn: 'Carpenter' },
            { id: 'painter', name: 'Painter', nameEn: 'Painter' },
            { id: 'general', name: 'General Services', nameEn: 'General Services' }
        ]
    });
};
exports.getServiceCategories = getServiceCategories;
const getCities = async (req, res) => {
    res.json({
        success: true,
        data: [
            { id: 'sofia', name: 'Sofia', nameEn: 'Sofia' },
            { id: 'plovdiv', name: 'Plovdiv', nameEn: 'Plovdiv' },
            { id: 'varna', name: 'Varna', nameEn: 'Varna' },
            { id: 'burgas', name: 'Burgas', nameEn: 'Burgas' }
        ]
    });
};
exports.getCities = getCities;
const getNeighborhoods = async (req, res) => {
    res.json({
        success: true,
        data: []
    });
};
exports.getNeighborhoods = getNeighborhoods;
const createInquiry = async (req, res) => {
    res.status(501).json({
        success: false,
        error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Inquiry system not yet implemented'
        }
    });
};
exports.createInquiry = createInquiry;
const getInquiries = async (req, res) => {
    res.status(501).json({
        success: false,
        error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Inquiry system not yet implemented'
        }
    });
};
exports.getInquiries = getInquiries;
const sendMessage = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { senderType, senderName, message, messageType = 'text' } = req.body;
        if (!conversationId || !senderType || !senderName || !message) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Conversation ID, sender type, sender name, and message are required'
                }
            });
            return;
        }
        logger_1.default.info('💬 Sending marketplace message:', {
            conversationId,
            senderType,
            senderName,
            messageLength: message.length
        });
        const messageId = await new Promise((resolve, reject) => {
            const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            db.db.run(`INSERT INTO marketplace_chat_messages (
          id, conversation_id, sender_type, sender_name, message, message_type, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [id, conversationId, senderType, senderName, message, messageType], function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(id);
                }
            });
        });
        await new Promise((resolve, reject) => {
            db.db.run(`UPDATE marketplace_conversations 
         SET last_message_at = CURRENT_TIMESTAMP 
         WHERE id = ?`, [conversationId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
        logger_1.default.info('✅ Marketplace message sent successfully:', {
            conversationId,
            messageId,
            senderType
        });
        res.status(201).json({
            success: true,
            data: {
                messageId,
                conversationId,
                timestamp: new Date().toISOString()
            }
        });
    }
    catch (error) {
        logger_1.default.error('❌ Error sending marketplace message:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to send message'
            }
        });
    }
};
exports.sendMessage = sendMessage;
const addReview = async (req, res) => {
    res.status(501).json({
        success: false,
        error: {
            code: 'NOT_IMPLEMENTED',
            message: 'Review system not yet implemented'
        }
    });
};
exports.addReview = addReview;
const updateConversation = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { customerName, customerPhone, customerEmail } = req.body;
        if (!conversationId) {
            res.status(400).json({
                success: false,
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Conversation ID is required'
                }
            });
            return;
        }
        logger_1.default.info('💬 Updating conversation details:', {
            conversationId,
            customerName,
            customerPhone: customerPhone ? customerPhone.substring(0, 4) + '***' : undefined,
            customerEmail: customerEmail ? customerEmail.substring(0, 3) + '***' : undefined
        });
        await new Promise((resolve, reject) => {
            const updates = [];
            const values = [];
            if (customerName) {
                updates.push('customer_name = ?');
                values.push(customerName);
            }
            if (customerPhone) {
                updates.push('customer_phone = ?');
                values.push(customerPhone);
            }
            if (customerEmail) {
                updates.push('customer_email = ?');
                values.push(customerEmail);
            }
            if (updates.length === 0) {
                resolve();
                return;
            }
            values.push(conversationId);
            db.db.run(`UPDATE marketplace_conversations 
         SET ${updates.join(', ')}, last_message_at = CURRENT_TIMESTAMP
         WHERE id = ?`, values, function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
        logger_1.default.info('✅ Conversation details updated successfully:', { conversationId });
        res.json({
            success: true,
            data: {
                conversationId,
                message: 'Conversation updated successfully'
            }
        });
    }
    catch (error) {
        logger_1.default.error('Error updating conversation:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Failed to update conversation'
            }
        });
    }
};
exports.updateConversation = updateConversation;
//# sourceMappingURL=marketplaceController.js.map