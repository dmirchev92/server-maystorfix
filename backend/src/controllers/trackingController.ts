import { Request, Response } from 'express';
import { DatabaseFactory } from '../models/DatabaseFactory';
import logger from '../utils/logger';

const db = DatabaseFactory.getDatabase();

/**
 * Update provider location
 * POST /api/v1/tracking/update
 */
export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    const { caseId, latitude, longitude, heading, speed } = req.body;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    if (!latitude || !longitude) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_COORDS', message: 'Latitude and longitude are required' }
      });
      return;
    }

    const now = new Date().toISOString();

    if (DatabaseFactory.isPostgreSQL()) {
      // 1. Update latest location in service_provider_profiles
      await (db as any).query(
        `UPDATE service_provider_profiles 
         SET latitude = $1, longitude = $2, updated_at = $3 
         WHERE user_id = $4`,
        [latitude, longitude, now, userId]
      );

      // 2. Insert into tracking history if caseId is provided (Active Job Tracking)
      if (caseId) {
        await (db as any).query(
          `INSERT INTO sp_tracking_sessions (
            provider_id, case_id, latitude, longitude, heading, speed, timestamp
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId, 
            caseId, 
            latitude, 
            longitude, 
            heading || null, 
            speed || null, 
            now
          ]
        );

        // 3. Emit real-time event via Socket.IO
        const io = (req as any).io;
        if (io) {
          // Emit to specific case room
          io.to(`case_${caseId}`).emit('tracking_update', {
            caseId,
            providerId: userId,
            latitude,
            longitude,
            heading,
            speed,
            timestamp: now
          });
          
          logger.info(`📍 Tracking update emitted for case ${caseId}`, { userId, lat: latitude, lng: longitude });
        }
      }
    } else {
      // Fallback for SQLite (only profile update supported for now as table might not exist)
       await new Promise<void>((resolve, reject) => {
        (db as any).db.run(
          `UPDATE service_provider_profiles 
           SET latitude = ?, longitude = ?, updated_at = ? 
           WHERE user_id = ?`,
          [latitude, longitude, now, userId],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Location updated successfully',
        timestamp: now
      }
    });

  } catch (error) {
    logger.error('❌ Error updating location:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update location'
      }
    });
  }
};

/**
 * Clear provider location (Stop Tracking)
 * DELETE /api/v1/tracking/location
 */
export const clearLocation = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    const now = new Date().toISOString();

    if (DatabaseFactory.isPostgreSQL()) {
      // Set lat/lng to NULL in service_provider_profiles
      await (db as any).query(
        `UPDATE service_provider_profiles 
         SET latitude = NULL, longitude = NULL, updated_at = $1 
         WHERE user_id = $2`,
        [now, userId]
      );
    } else {
      // SQLite fallback
       await new Promise<void>((resolve, reject) => {
        (db as any).db.run(
          `UPDATE service_provider_profiles 
           SET latitude = NULL, longitude = NULL, updated_at = ? 
           WHERE user_id = ?`,
          [now, userId],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Location cleared successfully'
      }
    });

  } catch (error) {
    logger.error('❌ Error clearing location:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to clear location'
      }
    });
  }
};

/**
 * Get latest location for a case (Customer view)
 * GET /api/v1/tracking/case/:caseId
 */
export const getCaseTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { caseId } = req.params;
    
    if (DatabaseFactory.isPostgreSQL()) {
      // Get latest tracking point
      const result = await (db as any).query(
        `SELECT latitude, longitude, heading, speed, timestamp, provider_id
         FROM sp_tracking_sessions 
         WHERE case_id = $1 
         ORDER BY timestamp DESC 
         LIMIT 1`,
        [caseId]
      );

      if (result.rows.length > 0) {
        res.json({
          success: true,
          data: result.rows[0]
        });
      } else {
        // Fallback: Get provider's profile location if assigned
        const caseRes = await (db as any).query(
          `SELECT provider_id FROM marketplace_service_cases WHERE id = $1`,
          [caseId]
        );
        
        if (caseRes.rows.length > 0 && caseRes.rows[0].provider_id) {
          const providerId = caseRes.rows[0].provider_id;
          const profileRes = await (db as any).query(
            `SELECT latitude, longitude, user_id as provider_id FROM service_provider_profiles WHERE user_id = $1`,
            [providerId]
          );
          
          if (profileRes.rows.length > 0) {
             res.json({
              success: true,
              data: {
                ...profileRes.rows[0],
                isProfileLocation: true
              }
            });
            return;
          }
        }

        res.status(404).json({
          success: false,
          error: { code: 'NO_TRACKING_DATA', message: 'No tracking data found' }
        });
      }
    } else {
      res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not available on SQLite' } });
    }

  } catch (error) {
    logger.error('❌ Error getting tracking data:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get tracking data'
      }
    });
  }
};

// ============ Location Schedule Endpoints ============

/**
 * Get location schedule settings for the current provider
 * GET /api/v1/tracking/schedule
 */
export const getLocationSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    logger.info('📅 getLocationSchedule called', { userId });

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    if (!DatabaseFactory.isPostgreSQL()) {
      res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not available on SQLite' } });
      return;
    }

    const result = await (db as any).query(
      `SELECT 
        schedule_enabled,
        start_time,
        end_time,
        disable_weekends,
        monday_enabled,
        tuesday_enabled,
        wednesday_enabled,
        thursday_enabled,
        friday_enabled,
        saturday_enabled,
        sunday_enabled
       FROM provider_location_schedule 
       WHERE user_id = $1`,
      [userId]
    );

    // Handle both array and {rows: []} format
    const rows = Array.isArray(result) ? result : (result.rows || []);
    logger.info('📅 getLocationSchedule query result', { rowCount: rows.length, firstRow: rows[0] });

    if (rows.length > 0) {
      logger.info('📅 getLocationSchedule returning data from DB', { data: rows[0] });
      res.json({
        success: true,
        data: rows[0]
      });
    } else {
      // Return default settings if no record exists
      const defaultData = {
        schedule_enabled: false,
        start_time: '08:00',
        end_time: '21:00',
        disable_weekends: false,
        monday_enabled: true,
        tuesday_enabled: true,
        wednesday_enabled: true,
        thursday_enabled: true,
        friday_enabled: true,
        saturday_enabled: true,
        sunday_enabled: true
      };
      logger.info('📅 getLocationSchedule returning DEFAULT data (no record)', { data: defaultData });
      res.json({
        success: true,
        data: defaultData
      });
    }

  } catch (error) {
    logger.error('❌ Error getting location schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get location schedule'
      }
    });
  }
};

/**
 * Update location schedule settings for the current provider
 * PUT /api/v1/tracking/schedule
 */
export const updateLocationSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    
    logger.info('📅 updateLocationSchedule called', { userId, body: req.body });

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    if (!DatabaseFactory.isPostgreSQL()) {
      res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not available on SQLite' } });
      return;
    }

    const {
      schedule_enabled,
      start_time,
      end_time,
      disable_weekends,
      monday_enabled,
      tuesday_enabled,
      wednesday_enabled,
      thursday_enabled,
      friday_enabled,
      saturday_enabled,
      sunday_enabled
    } = req.body;
    
    logger.info('📅 Parsed schedule values', { 
      schedule_enabled, start_time, end_time, disable_weekends,
      monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled,
      friday_enabled, saturday_enabled, sunday_enabled 
    });

    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (start_time && !timeRegex.test(start_time)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME', message: 'Invalid start_time format. Use HH:MM' }
      });
      return;
    }
    if (end_time && !timeRegex.test(end_time)) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_TIME', message: 'Invalid end_time format. Use HH:MM' }
      });
      return;
    }

    const now = new Date().toISOString();

    // Upsert the schedule settings
    await (db as any).query(
      `INSERT INTO provider_location_schedule (
        user_id, schedule_enabled, start_time, end_time, disable_weekends,
        monday_enabled, tuesday_enabled, wednesday_enabled, thursday_enabled,
        friday_enabled, saturday_enabled, sunday_enabled, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (user_id) DO UPDATE SET
        schedule_enabled = COALESCE($2, provider_location_schedule.schedule_enabled),
        start_time = COALESCE($3, provider_location_schedule.start_time),
        end_time = COALESCE($4, provider_location_schedule.end_time),
        disable_weekends = COALESCE($5, provider_location_schedule.disable_weekends),
        monday_enabled = COALESCE($6, provider_location_schedule.monday_enabled),
        tuesday_enabled = COALESCE($7, provider_location_schedule.tuesday_enabled),
        wednesday_enabled = COALESCE($8, provider_location_schedule.wednesday_enabled),
        thursday_enabled = COALESCE($9, provider_location_schedule.thursday_enabled),
        friday_enabled = COALESCE($10, provider_location_schedule.friday_enabled),
        saturday_enabled = COALESCE($11, provider_location_schedule.saturday_enabled),
        sunday_enabled = COALESCE($12, provider_location_schedule.sunday_enabled),
        updated_at = $13`,
      [
        userId,
        schedule_enabled ?? false,
        start_time ?? '08:00',
        end_time ?? '21:00',
        disable_weekends ?? false,
        monday_enabled ?? true,
        tuesday_enabled ?? true,
        wednesday_enabled ?? true,
        thursday_enabled ?? true,
        friday_enabled ?? true,
        saturday_enabled ?? true,
        sunday_enabled ?? true,
        now
      ]
    );

    logger.info(`📅 Location schedule updated for user ${userId}`);

    res.json({
      success: true,
      data: {
        message: 'Location schedule updated successfully'
      }
    });

  } catch (error) {
    logger.error('❌ Error updating location schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update location schedule'
      }
    });
  }
};

/**
 * Check if location sharing should be active based on schedule
 * GET /api/v1/tracking/schedule/check
 * Returns whether the provider should be sharing location right now
 */
export const checkLocationSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.id;
    logger.info('📅 ========== checkLocationSchedule START ==========');
    logger.info('📅 checkLocationSchedule called', { userId });

    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'User not authenticated' }
      });
      return;
    }

    if (!DatabaseFactory.isPostgreSQL()) {
      res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Not available on SQLite' } });
      return;
    }

    const rows = await (db as any).query(
      `SELECT 
        schedule_enabled,
        start_time,
        end_time,
        disable_weekends,
        monday_enabled,
        tuesday_enabled,
        wednesday_enabled,
        thursday_enabled,
        friday_enabled,
        saturday_enabled,
        sunday_enabled
       FROM provider_location_schedule 
       WHERE user_id = $1`,
      [userId]
    );

    logger.info('📅 DB query returned rows:', { rowCount: rows.length, data: rows[0] || 'NO DATA' });

    // If no schedule exists or schedule is disabled, always allow tracking
    if (rows.length === 0 || !rows[0].schedule_enabled) {
      logger.info('📅 No schedule OR schedule_enabled=false -> should_track=TRUE');
      res.json({
        success: true,
        data: {
          should_track: true,
          reason: 'schedule_disabled'
        }
      });
      return;
    }

    const schedule = rows[0];
    logger.info('📅 Schedule is ENABLED, checking time window...');
    
    // Get current time in Sofia timezone
    const now = new Date();
    const sofiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Sofia' }));
    const currentHour = sofiaTime.getHours();
    const currentMinute = sofiaTime.getMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;
    
    // Parse schedule times
    const [startHour, startMinute] = schedule.start_time.split(':').map(Number);
    const [endHour, endMinute] = schedule.end_time.split(':').map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = endHour * 60 + endMinute;
    
    // Check day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    const dayOfWeek = sofiaTime.getDay();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKey = `${dayNames[dayOfWeek]}_enabled`;
    
    // Check if today is enabled
    const isDayEnabled = schedule[dayKey];
    
    logger.info('📅 Time check details:', {
      sofiaTime: sofiaTime.toISOString(),
      currentHour,
      currentMinute,
      currentTimeMinutes,
      startTimeMinutes,
      endTimeMinutes,
      dayOfWeek,
      dayName: dayNames[dayOfWeek],
      dayKey,
      isDayEnabled,
      schedule_start: schedule.start_time,
      schedule_end: schedule.end_time,
      disable_weekends: schedule.disable_weekends
    });
    
    // Check weekend override
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (schedule.disable_weekends && isWeekend) {
      logger.info('📅 Weekend disabled -> should_track=FALSE');
      res.json({
        success: true,
        data: {
          should_track: false,
          reason: 'weekend_disabled'
        }
      });
      return;
    }
    
    // Check if day is enabled
    if (!isDayEnabled) {
      logger.info('📅 Day not enabled -> should_track=FALSE');
      res.json({
        success: true,
        data: {
          should_track: false,
          reason: 'day_disabled'
        }
      });
      return;
    }
    
    // Check time window
    const isWithinTimeWindow = currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
    
    logger.info('📅 Final result:', {
      isWithinTimeWindow,
      comparison: `${currentTimeMinutes} >= ${startTimeMinutes} && ${currentTimeMinutes} < ${endTimeMinutes}`
    });
    logger.info('📅 ========== checkLocationSchedule END ==========');
    
    res.json({
      success: true,
      data: {
        should_track: isWithinTimeWindow,
        reason: isWithinTimeWindow ? 'within_schedule' : 'outside_time_window',
        current_time: `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`,
        schedule_start: schedule.start_time,
        schedule_end: schedule.end_time
      }
    });

  } catch (error) {
    logger.error('❌ Error checking location schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to check location schedule'
      }
    });
  }
};
