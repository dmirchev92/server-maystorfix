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
