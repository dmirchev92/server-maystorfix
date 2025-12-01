import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';
import { NotificationService } from '../services/NotificationService';

const db = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
const notificationService = new NotificationService();

// List of all available service categories
export const SERVICE_CATEGORIES = [
  { id: 'electrician', name: 'Електроуслуги', nameEn: 'Electrician' },
  { id: 'plumber', name: 'ВиК Услуги', nameEn: 'Plumber' },
  { id: 'painter', name: 'Боядисване', nameEn: 'Painter' },
  { id: 'carpenter', name: 'Дърводелски услуги', nameEn: 'Carpenter' },
  { id: 'hvac', name: 'Отопление и климатизация', nameEn: 'HVAC' },
  { id: 'locksmith', name: 'Ключар', nameEn: 'Locksmith' },
  { id: 'cleaner', name: 'Почистване', nameEn: 'Cleaner' },
  { id: 'gardener', name: 'Озеленяване', nameEn: 'Gardener' },
  { id: 'handyman', name: 'Цялостни ремонти', nameEn: 'Handyman' },
  { id: 'roofer', name: 'Ремонти на покриви', nameEn: 'Roofer' },
  { id: 'tiler', name: 'Плочки и теракот', nameEn: 'Tiler' },
  { id: 'appliance_repair', name: 'Хамалски Услуги', nameEn: 'Moving' },
  { id: 'pest_control', name: 'Железарски услуги', nameEn: 'Metalwork' },
  { id: 'design', name: 'Дизайн', nameEn: 'Design' },
];

/**
 * Get all service categories
 */
export const getServiceCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: { categories: SERVICE_CATEGORIES }
    });
  } catch (error) {
    logger.error('❌ Error getting service categories:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get service categories' }
    });
  }
};

/**
 * SP: Toggle free inspection mode
 */
export const toggleFreeInspection = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { active } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    if (typeof active !== 'boolean') {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'active must be a boolean' } });
      return;
    }

    logger.info('🔧 Toggling free inspection mode', { userId, active });

    // Update SP profile
    const updateQuery = active
      ? `UPDATE service_provider_profiles 
         SET free_inspection_active = true, free_inspection_activated_at = NOW() 
         WHERE user_id = $1 
         RETURNING user_id, free_inspection_active, service_category, latitude, longitude, business_name`
      : `UPDATE service_provider_profiles 
         SET free_inspection_active = false 
         WHERE user_id = $1 
         RETURNING user_id, free_inspection_active, service_category, latitude, longitude, business_name`;

    const result = await db.query(updateQuery, [userId]);

    if (result.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service provider profile not found' } });
      return;
    }

    const profile = result[0];

    // If activated, notify nearby customers
    if (active && profile.latitude && profile.longitude) {
      await notifyNearbyCustomers(profile);
    }

    logger.info('✅ Free inspection mode updated', { userId, active });

    res.json({
      success: true,
      data: {
        freeInspectionActive: profile.free_inspection_active,
        message: active ? 'Безплатен оглед активиран' : 'Безплатен оглед деактивиран'
      }
    });

  } catch (error) {
    logger.error('❌ Error toggling free inspection:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to toggle free inspection' }
    });
  }
};

/**
 * SP: Get free inspection status
 */
export const getFreeInspectionStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const result = await db.query(
      `SELECT free_inspection_active, free_inspection_activated_at 
       FROM service_provider_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Service provider profile not found' } });
      return;
    }

    res.json({
      success: true,
      data: {
        freeInspectionActive: result[0].free_inspection_active || false,
        activatedAt: result[0].free_inspection_activated_at
      }
    });

  } catch (error) {
    logger.error('❌ Error getting free inspection status:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get free inspection status' }
    });
  }
};

/**
 * Customer: Get free inspection preferences
 */
export const getCustomerPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    const result = await db.query(
      `SELECT enabled, radius_km, categories, show_only_free_inspection, latitude, longitude 
       FROM customer_free_inspection_preferences WHERE user_id = $1`,
      [userId]
    );

    if (result.length === 0) {
      // Return default preferences if not set
      res.json({
        success: true,
        data: {
          enabled: false,
          radiusKm: 3,
          categories: [],
          showOnlyFreeInspection: false,
          latitude: null,
          longitude: null
        }
      });
      return;
    }

    const prefs = result[0];
    res.json({
      success: true,
      data: {
        enabled: prefs.enabled,
        radiusKm: prefs.radius_km,
        categories: prefs.categories || [],
        showOnlyFreeInspection: prefs.show_only_free_inspection,
        latitude: prefs.latitude ? parseFloat(prefs.latitude) : null,
        longitude: prefs.longitude ? parseFloat(prefs.longitude) : null
      }
    });

  } catch (error) {
    logger.error('❌ Error getting customer preferences:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get preferences' }
    });
  }
};

/**
 * Customer: Update free inspection preferences
 */
export const updateCustomerPreferences = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { enabled, radiusKm, categories, showOnlyFreeInspection, latitude, longitude } = req.body;

    if (!userId) {
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'User not authenticated' } });
      return;
    }

    // Validate radiusKm
    if (radiusKm !== undefined && (radiusKm < 1 || radiusKm > 5)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'radiusKm must be between 1 and 5' } });
      return;
    }

    logger.info('🔧 Updating customer free inspection preferences', { userId, enabled, radiusKm, categories });

    // Upsert preferences
    const result = await db.query(
      `INSERT INTO customer_free_inspection_preferences 
         (user_id, enabled, radius_km, categories, show_only_free_inspection, latitude, longitude, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         enabled = COALESCE($2, customer_free_inspection_preferences.enabled),
         radius_km = COALESCE($3, customer_free_inspection_preferences.radius_km),
         categories = COALESCE($4, customer_free_inspection_preferences.categories),
         show_only_free_inspection = COALESCE($5, customer_free_inspection_preferences.show_only_free_inspection),
         latitude = COALESCE($6, customer_free_inspection_preferences.latitude),
         longitude = COALESCE($7, customer_free_inspection_preferences.longitude),
         updated_at = NOW()
       RETURNING enabled, radius_km, categories, show_only_free_inspection, latitude, longitude`,
      [userId, enabled, radiusKm, categories, showOnlyFreeInspection, latitude, longitude]
    );

    const prefs = result[0];
    logger.info('✅ Customer preferences updated', { userId });

    res.json({
      success: true,
      data: {
        enabled: prefs.enabled,
        radiusKm: prefs.radius_km,
        categories: prefs.categories || [],
        showOnlyFreeInspection: prefs.show_only_free_inspection,
        latitude: prefs.latitude ? parseFloat(prefs.latitude) : null,
        longitude: prefs.longitude ? parseFloat(prefs.longitude) : null
      }
    });

  } catch (error) {
    logger.error('❌ Error updating customer preferences:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update preferences' }
    });
  }
};

/**
 * Get providers with free inspection filter
 */
export const getProvidersForMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { latitude, longitude, radiusKm, category, freeInspectionOnly } = req.query;

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const radius = parseInt(radiusKm as string) || 10;
    const onlyFreeInspection = freeInspectionOnly === 'true';

    if (isNaN(lat) || isNaN(lng)) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid latitude or longitude' } });
      return;
    }

    logger.info('🗺️ Getting providers for map', { lat, lng, radius, category, onlyFreeInspection });

    let query = `
      SELECT 
        spp.user_id as id,
        spp.business_name,
        spp.service_category,
        spp.latitude,
        spp.longitude,
        spp.free_inspection_active,
        spp.rating,
        spp.total_reviews,
        spp.phone_number,
        u.first_name,
        u.last_name,
        (6371 * acos(cos(radians($1)) * cos(radians(spp.latitude)) * cos(radians(spp.longitude) - radians($2)) + sin(radians($1)) * sin(radians(spp.latitude)))) AS distance_km
      FROM service_provider_profiles spp
      JOIN users u ON spp.user_id = u.id
      WHERE spp.latitude IS NOT NULL 
        AND spp.longitude IS NOT NULL
        AND spp.is_active = true
        AND (6371 * acos(cos(radians($1)) * cos(radians(spp.latitude)) * cos(radians(spp.longitude) - radians($2)) + sin(radians($1)) * sin(radians(spp.latitude)))) <= $3
    `;

    const params: any[] = [lat, lng, radius];
    let paramIndex = 4;

    if (onlyFreeInspection) {
      query += ` AND spp.free_inspection_active = true`;
    }

    if (category && category !== 'all') {
      query += ` AND spp.service_category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    query += ` ORDER BY spp.free_inspection_active DESC, distance_km ASC LIMIT 100`;

    const result = await db.query(query, params);

    const providers = result.map((row: any) => ({
      id: row.id,
      businessName: row.business_name,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.business_name,
      serviceCategory: row.service_category,
      latitude: parseFloat(row.latitude),
      longitude: parseFloat(row.longitude),
      freeInspectionActive: row.free_inspection_active || false,
      rating: row.rating ? parseFloat(row.rating) : null,
      totalReviews: row.total_reviews || 0,
      phoneNumber: row.phone_number,
      distanceKm: parseFloat(row.distance_km.toFixed(2))
    }));

    logger.info(`✅ Found ${providers.length} providers for map`);

    res.json({
      success: true,
      data: { providers }
    });

  } catch (error) {
    logger.error('❌ Error getting providers for map:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get providers' }
    });
  }
};

/**
 * Helper: Notify nearby customers when SP activates free inspection
 */
async function notifyNearbyCustomers(spProfile: any): Promise<void> {
  try {
    logger.info('📢 Looking for nearby customers to notify about free inspection', {
      providerId: spProfile.user_id,
      category: spProfile.service_category
    });

    // Find customers with matching preferences
    const customersQuery = `
      SELECT 
        cfip.user_id,
        cfip.radius_km,
        cfip.categories,
        cfip.latitude,
        cfip.longitude,
        (6371 * acos(cos(radians(cfip.latitude)) * cos(radians($1)) * cos(radians($2) - radians(cfip.longitude)) + sin(radians(cfip.latitude)) * sin(radians($1)))) AS distance_km
      FROM customer_free_inspection_preferences cfip
      WHERE cfip.enabled = true
        AND cfip.latitude IS NOT NULL
        AND cfip.longitude IS NOT NULL
        AND (cfip.categories = '{}' OR $3 = ANY(cfip.categories))
        AND NOT EXISTS (
          SELECT 1 FROM free_inspection_notifications fin 
          WHERE fin.customer_id = cfip.user_id AND fin.provider_id = $4
        )
    `;

    const customers = await db.query(customersQuery, [
      spProfile.latitude,
      spProfile.longitude,
      spProfile.service_category,
      spProfile.user_id
    ]);

    logger.info(`📢 Found ${customers.length} potential customers to check`);

    for (const customer of customers) {
      // Check if customer is within their desired radius
      if (customer.distance_km <= customer.radius_km) {
        logger.info('📢 Notifying customer about free inspection', {
          customerId: customer.user_id,
          providerId: spProfile.user_id,
          distance: customer.distance_km
        });

        // Record that we sent this notification
        await db.query(
          `INSERT INTO free_inspection_notifications (customer_id, provider_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [customer.user_id, spProfile.user_id]
        );

        // Get category translation
        const categoryInfo = SERVICE_CATEGORIES.find(c => c.id === spProfile.service_category);
        const categoryName = categoryInfo?.name || spProfile.service_category;

        // Send notification
        await notificationService.createNotification(
          customer.user_id,
          'free_inspection_available',
          '🔧 Безплатен оглед наблизо!',
          `${spProfile.business_name || 'Майстор'} (${categoryName}) предлага безплатен оглед на ${customer.distance_km.toFixed(1)} км от вас.`,
          {
            providerId: spProfile.user_id,
            providerName: spProfile.business_name,
            serviceCategory: spProfile.service_category,
            distance: customer.distance_km.toFixed(1),
            action: 'view_on_map'
          }
        );
      }
    }

  } catch (error) {
    logger.error('❌ Error notifying customers about free inspection:', error);
    // Don't throw - this is a non-critical operation
  }
}
