import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';
import config from '../utils/config';
import { SMSSecurityService } from '../services/SMSSecurityService';
import { SMSActivityService } from '../services/SMSActivityService';

const db = DatabaseFactory.getDatabase();

/**
 * Get provider information by user ID
 */
export const getProvider = async (req: Request, res: Response): Promise<void> => {
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

    logger.info('🔍 Getting provider info for user ID:', { userId: id });

    let actualUserId = id;
    
    // If it's a device ID, we need to find the actual user
    if (id.startsWith('device_')) {
      logger.info('🔄 Device ID detected, using fallback user mapping...', { deviceId: id });
      
      // For device IDs, use the most recent tradesperson user as fallback
      // This works for single-user scenarios and can be enhanced later for multi-user
      const fallbackUser = await new Promise<any>((resolve, reject) => {
        db.db.get(
          `SELECT id FROM users WHERE role = 'tradesperson' ORDER BY created_at DESC LIMIT 1`,
          [],
          (err: any, row: any) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      if (fallbackUser) {
        actualUserId = fallbackUser.id;
        logger.info('✅ Mapped device ID to user:', { deviceId: id, actualUserId });
      } else {
        logger.error('❌ No tradesperson user found for device ID mapping');
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

    // Get user information using the actual user ID
    const user = await new Promise<any>((resolve, reject) => {
      db.db.get(
        `SELECT id, email, first_name, last_name, phone_number, role FROM users WHERE id = ?`,
        [actualUserId],
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
        error: {
          code: 'NOT_FOUND',
          message: 'Provider not found'
        }
      });
      return;
    }

    // Get service provider profile using the actual user ID
    const profile = await new Promise<any>((resolve, reject) => {
      db.db.get(
        `SELECT 
          id, user_id, business_name, service_category, description,
          experience_years, hourly_rate, city, neighborhood, address, 
          phone_number, email, website_url, profile_image_url, 
          rating, total_reviews, is_active, created_at, updated_at
         FROM service_provider_profiles 
         WHERE user_id = ?`,
        [actualUserId],
        (err: any, row: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(row);
          }
        }
      );
    });

    // Get provider certificates
    const certificates = await new Promise<any[]>((resolve, reject) => {
      db.db.all(
        `SELECT id, title, file_url as fileUrl, issued_by as issuedBy, issued_at as issuedAt 
         FROM provider_certificates 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [actualUserId],
        (err: any, rows: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    // Get provider gallery images
    const gallery = await new Promise<string[]>((resolve, reject) => {
      db.db.all(
        `SELECT image_url 
         FROM provider_gallery 
         WHERE user_id = ? 
         ORDER BY created_at DESC`,
        [actualUserId],
        (err: any, rows: any) => {
          if (err) {
            reject(err);
          } else {
            resolve((rows || []).map((row: any) => row.image_url));
          }
        }
      );
    });

    // Combine user and profile data
    const providerData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phoneNumber: user.phone_number,
      role: user.role,
      // Profile information (may be null if no profile exists)
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

    logger.info('✅ Provider info retrieved successfully', { 
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

  } catch (error) {
    logger.error('❌ Error getting provider info:', { 
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

/**
 * Search providers based on criteria
 */
export const searchProviders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { city, neighborhood, category, limit = 50, offset = 0, lat, lng, radius } = req.query;

    logger.info('🔍 Searching providers with filters:', { city, neighborhood, category, limit, offset, lat, lng, radius });

    // Base selection
    let selectQuery = `
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone_number,
        spp.business_name, spp.service_category, spp.description,
        spp.experience_years, spp.hourly_rate, spp.city, spp.neighborhood, 
        spp.address, spp.phone_number as profile_phone, 
        spp.email as profile_email, spp.website_url as website, 
        spp.profile_image_url, spp.rating, spp.total_reviews, spp.is_active,
        spp.latitude, spp.longitude,
        COALESCE((SELECT json_agg(psc.category_id) FROM provider_service_categories psc WHERE psc.provider_id = u.id), '[]'::json) as service_categories,
        COALESCE((SELECT COUNT(*) FROM marketplace_service_cases msc WHERE msc.provider_id = u.id AND msc.status = 'completed'), 0) as completed_projects
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (lat && lng) {
      // Haversine distance calculation
      selectQuery += `,
        (6371 * acos(
          LEAST(1.0, GREATEST(-1.0, 
            cos(radians($${paramIndex})) * cos(radians(spp.latitude)) * cos(radians(spp.longitude) - radians($${paramIndex+1})) +
            sin(radians($${paramIndex+2})) * sin(radians(spp.latitude))
          ))
        )) as distance`;
      
      params.push(Number(lat)); // $1 (cos lat)
      params.push(Number(lng)); // $2 (cos long diff)
      params.push(Number(lat)); // $3 (sin lat)
      paramIndex += 3;
    } else {
      selectQuery += `, NULL as distance`;
    }

    let fromWhereClause = `
      FROM users u
      LEFT JOIN service_provider_profiles spp ON u.id = spp.user_id
      WHERE u.role = 'tradesperson' 
        AND (spp.is_active = TRUE OR spp.is_active IS NULL)
        AND (u.subscription_tier_id != 'free' OR u.trial_expired = FALSE OR u.trial_expired IS NULL)
        AND spp.latitude IS NOT NULL 
        AND spp.longitude IS NOT NULL
    `;

    if (city) {
      fromWhereClause += ` AND spp.city = $${paramIndex++}`;
      params.push(city);
    }

    if (neighborhood) {
      fromWhereClause += ` AND spp.neighborhood = $${paramIndex++}`;
      params.push(neighborhood);
    }

    if (category) {
      fromWhereClause += ` AND EXISTS (SELECT 1 FROM provider_service_categories psc WHERE psc.provider_id = u.id AND psc.category_id = $${paramIndex++})`;
      params.push(category);
    }

    // Final Query Construction
    let finalQuery = `WITH ranked_providers AS (${selectQuery} ${fromWhereClause}) SELECT * FROM ranked_providers`;

    if (lat && lng && radius) {
      finalQuery += ` WHERE distance <= $${paramIndex++}`;
      params.push(Number(radius));
    }

    // Sorting
    if (lat && lng) {
      finalQuery += ` ORDER BY distance ASC, rating DESC NULLS LAST`;
    } else {
      finalQuery += ` ORDER BY rating DESC NULLS LAST, total_reviews DESC, completed_projects DESC`;
    }

    finalQuery += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    logger.info('🔍 Executing SQL:', finalQuery);
    logger.info('🔍 Params:', params);

    // Execute Query
    const result = await (db as any).query(finalQuery, params);
    
    // Handle Result Format
    let providers: any[] = [];
    if (Array.isArray(result)) {
      providers = result;
    } else if (result && Array.isArray(result.rows)) {
      providers = result.rows;
    } else {
      logger.warn('⚠️ Unexpected database result format:', result);
      providers = [];
    }

    // Transform Data
    const transformedProviders = providers.map((provider: any) => ({
      id: provider.id,
      email: provider.email,
      firstName: provider.first_name,
      lastName: provider.last_name,
      phoneNumber: provider.phone_number,
      businessName: provider.business_name || `${provider.first_name} ${provider.last_name}`,
      serviceCategory: provider.service_category || 'general',
      serviceCategories: Array.isArray(provider.service_categories) ? provider.service_categories : [],
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
      completedProjects: parseInt(provider.completed_projects) || 0,
      isActive: Boolean(provider.is_active),
      latitude: provider.latitude ? parseFloat(provider.latitude) : null,
      longitude: provider.longitude ? parseFloat(provider.longitude) : null,
      distance: provider.distance ? parseFloat(provider.distance) : null
    }));

    logger.info('✅ Provider search completed', { 
      resultsCount: transformedProviders.length,
      filters: { city, neighborhood, category, radius }
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

  } catch (error) {
    logger.error('❌ Error searching providers:', error);
    console.error('❌ DEBUG Error details:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to search providers'
      }
    });
  }
};

/**
 * Get provider's marketplace conversations
 */
export const getProviderConversations = async (req: Request, res: Response): Promise<void> => {
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

    logger.info('🔍 Getting marketplace conversations for provider:', { providerId: id });

    // Get marketplace conversations for this provider
    const conversations = await db.getAllUserConversations(id);
    
    // Filter only marketplace conversations
    const marketplaceConversations = conversations.filter((conv: any) => conv.conversation_type === 'marketplace');

    logger.info('✅ Provider conversations retrieved', { 
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

  } catch (error) {
    logger.error('❌ Error getting provider conversations:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve provider conversations'
      }
    });
  }
};

/**
 * Update user profile (for settings page)
 */
export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const { firstName, lastName, phoneNumber, profile, currentPassword, newPassword } = req.body;

    logger.info('🔄 Updating user profile:', { userId, hasProfile: !!profile, hasPasswordChange: !!newPassword });

    // Update user basic information
    if (firstName || lastName || phoneNumber) {
      await new Promise<void>((resolve, reject) => {
        const updates: string[] = [];
        const params: any[] = [];

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

          db.db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            params,
            (err: any) => {
              if (err) reject(err);
              else resolve();
            }
          );
        } else {
          resolve();
        }
      });
    }

    // Update service provider profile if provided
    if (profile) {
      await db.createOrUpdateProviderProfile(userId, profile);
    }

    // Handle password change
    if (currentPassword && newPassword) {
      // TODO: Implement password change logic
      // For now, we'll skip this as it requires password hashing verification
      logger.info('⚠️ Password change requested but not implemented yet');
    }

    // Get updated user data
    const updatedUser = await new Promise<any>((resolve, reject) => {
      db.db.get(
        'SELECT id, email, first_name, last_name, phone_number, role FROM users WHERE id = ?',
        [userId],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    logger.info('✅ User profile updated successfully:', { userId });

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
  } catch (error) {
    logger.error('❌ Error updating user profile:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
  }
};

/**
 * Create or update provider profile with real-time updates
 */
export const createOrUpdateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, profile, gallery, certificates } = req.body || {};
    if (!userId) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'userId is required' } });
      return;
    }

    logger.info('🔄 Updating provider profile:', { userId, profile: !!profile });

    // Update users table if firstName, lastName, or phoneNumber are provided
    if (profile && (profile.firstName || profile.lastName || profile.phoneNumber)) {
      await new Promise<void>((resolve, reject) => {
        const updates: string[] = [];
        const params: any[] = [];

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

          db.db.run(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
            params,
            (err: any) => {
              if (err) {
                logger.error('❌ Error updating users table:', err);
                reject(err);
              } else {
                logger.info('✅ Updated users table:', { userId, updates: updates.slice(0, -1) });
                resolve();
              }
            }
          );
        } else {
          resolve();
        }
      });
    }

    // Update profile data
    await db.createOrUpdateProviderProfile(userId, profile || {});
    if (Array.isArray(gallery)) await db.replaceProviderGallery(userId, gallery);
    if (Array.isArray(certificates)) await db.replaceProviderCertificates(userId, certificates);

    // Get the updated provider data to broadcast
    const updatedProvider = await getUpdatedProviderData(userId);

    logger.info('✅ Provider profile updated successfully:', { 
      userId, 
      businessName: updatedProvider?.businessName 
    });

    // Broadcast real-time update to all connected Marketplace clients
    const io = (req as any).io; // Socket.IO instance attached to request
    if (io && updatedProvider) {
      const updateData = {
        type: 'profile_update',
        providerId: userId,
        provider: updatedProvider,
        timestamp: new Date().toISOString()
      };

      // Broadcast to all marketplace clients
      io.emit('provider_profile_updated', updateData);
      
      // Broadcast to specific location rooms
      if (updatedProvider.city) {
        io.to(`location-${updatedProvider.city}`).emit('provider_profile_updated', updateData);
        
        if (updatedProvider.neighborhood) {
          io.to(`location-${updatedProvider.city}-${updatedProvider.neighborhood}`).emit('provider_profile_updated', updateData);
        }
      }
      
      // Broadcast to specific category room
      if (updatedProvider.service_category) {
        io.to(`category-${updatedProvider.service_category}`).emit('provider_profile_updated', updateData);
      }
      
      logger.info('📡 Real-time update broadcasted to Marketplace clients:', { 
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
  } catch (error) {
    logger.error('❌ Error updating provider profile:', error);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update profile' } });
  }
};

/**
 * Helper function to get updated provider data in marketplace format
 */
const getUpdatedProviderData = async (userId: string): Promise<any> => {
  try {
    // Get user information
    const user = await new Promise<any>((resolve, reject) => {
      db.db.get(
        `SELECT id, email, first_name, last_name, phone_number FROM users WHERE id = ?`,
        [userId],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!user) return null;

    // Get service provider profile
    const profile = await new Promise<any>((resolve, reject) => {
      db.db.get(
        `SELECT * FROM service_provider_profiles WHERE user_id = ?`,
        [userId],
        (err: any, row: any) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Return data in marketplace format
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
  } catch (error) {
    logger.error('❌ Error getting updated provider data:', error);
    return null;
  }
};

/**
 * Get service categories
 */
export const getServiceCategories = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: [
      { id: 'electrician', name: 'Електроуслуги', nameEn: 'Electrical Services' },
      { id: 'plumber', name: 'ВиК Услуги', nameEn: 'Plumbing Services' },
      { id: 'hvac', name: 'Отопление и климатизация', nameEn: 'HVAC' },
      { id: 'carpenter', name: 'Дърводелски услуги', nameEn: 'Carpentry' },
      { id: 'painter', name: 'Боядисване', nameEn: 'Painting' },
      { id: 'locksmith', name: 'Ключар', nameEn: 'Locksmith' },
      { id: 'cleaner', name: 'Почистване', nameEn: 'Cleaning' },
      { id: 'gardener', name: 'Озеленяване', nameEn: 'Gardening' },
      { id: 'handyman', name: 'Цялостни ремонти', nameEn: 'General Repairs' },
      { id: 'roofer', name: 'Ремонти на покрив', nameEn: 'Roofing' },
      { id: 'moving', name: 'Хамалски Услуги', nameEn: 'Moving Services' },
      { id: 'tiler', name: 'Плочки и теракот', nameEn: 'Tiling' },
      { id: 'welder', name: 'Железарски услуги', nameEn: 'Welding' },
      { id: 'design', name: 'Дизайн', nameEn: 'Design' }
    ]
  });
};

/**
 * Get cities (placeholder)
 */
export const getCities = async (req: Request, res: Response): Promise<void> => {
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

/**
 * Get neighborhoods (placeholder)
 */
export const getNeighborhoods = async (req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: []
  });
};

/**
 * Create inquiry (placeholder)
 */
export const createInquiry = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Inquiry system not yet implemented'
    }
  });
};

/**
 * Get inquiries (placeholder)
 */
export const getInquiries = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Inquiry system not yet implemented'
    }
  });
};

/**
 * Send message to marketplace conversation
 */
export const sendMessage = async (req: Request, res: Response): Promise<void> => {
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

    logger.info('💬 Sending marketplace message:', { 
      conversationId, 
      senderType, 
      senderName,
      messageLength: message.length 
    });

    // Add message to marketplace_chat_messages table
    const messageId = await new Promise<string>((resolve, reject) => {
      const id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      db.db.run(
        `INSERT INTO marketplace_chat_messages (
          id, conversation_id, sender_type, sender_name, message, message_type, sent_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [id, conversationId, senderType, senderName, message, messageType],
        function(err: any) {
          if (err) {
            reject(err);
          } else {
            resolve(id);
          }
        }
      );
    });

    // Update conversation's last_message_at
    await new Promise<void>((resolve, reject) => {
      db.db.run(
        `UPDATE marketplace_conversations 
         SET last_message_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [conversationId],
        (err: any) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    logger.info('✅ Marketplace message sent successfully:', { 
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

  } catch (error) {
    logger.error('❌ Error sending marketplace message:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to send message'
      }
    });
  }
};

/**
 * Add review (placeholder)
 */
export const addReview = async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({
    success: false,
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Review system not yet implemented'
    }
  });
};

/**
 * Update conversation details (customer info)
 */
export const updateConversation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    const { customerName, customerPhone, customerEmail, customerId } = req.body;

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

    logger.info('💬 Updating conversation details:', { 
      conversationId, 
      customerName,
      customerId,
      customerPhone: customerPhone ? customerPhone.substring(0, 4) + '***' : undefined,
      customerEmail: customerEmail ? customerEmail.substring(0, 3) + '***' : undefined
    });

    // Update conversation details using PostgreSQL
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (customerName) {
      updates.push(`customer_name = $${paramIndex++}`);
      values.push(customerName);
    }
    if (customerPhone) {
      updates.push(`customer_phone = $${paramIndex++}`);
      values.push(customerPhone);
    }
    if (customerEmail) {
      updates.push(`customer_email = $${paramIndex++}`);
      values.push(customerEmail);
    }
    if (customerId) {
      updates.push(`customer_id = $${paramIndex++}`);
      values.push(customerId);
    }
    
    if (updates.length === 0) {
      res.json({
        success: true,
        data: {
          conversationId,
          message: 'No updates provided'
        }
      });
      return;
    }
    
    values.push(conversationId);
    
    const pool = (db as any).getPool();
    await pool.query(
      `UPDATE marketplace_conversations 
       SET ${updates.join(', ')}, last_message_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex}`,
      values
    );

    logger.info('✅ Conversation details updated successfully:', { conversationId });

    res.json({
      success: true,
      data: {
        conversationId,
        message: 'Conversation updated successfully'
      }
    });

  } catch (error) {
    logger.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update conversation'
      }
    });
  }
};