import { Pool } from 'pg';
import { NotificationService } from '../services/NotificationService';
import logger from '../utils/logger';

export class LocationSearchJob {
  private pool: Pool;
  private notificationService: NotificationService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.notificationService = new NotificationService();
  }

  /**
   * Main entry point for the job
   */
  async runLocationSearch(): Promise<void> {
    try {
      logger.info('📍 Running location search job...');
      await this.processInitialSearch();
      await this.processExpansion();
      await this.processExpandedSearch();
      logger.info('📍 Location search job completed.');
    } catch (error) {
      logger.error('❌ Error in location search job:', error);
    }
  }

  /**
   * Step 1: Process 'active' cases (Radius 5km)
   * Finds cases marked 'active', searches for SPs within 5km, sends notifications,
   * and moves status to 'active_waiting'.
   */
  private async processInitialSearch(): Promise<void> {
    try {
      const cases = await this.pool.query(`
        SELECT * FROM marketplace_service_cases 
        WHERE location_search_status = 'active' 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      `);

      for (const caseRow of cases.rows) {
        logger.info(`📍 Processing initial 5km search for case ${caseRow.id}`);
        
        // Find SPs within 5km
        // Haversine formula: 6371 * acos(...)
        const spQuery = `
          SELECT 
            sp.user_id,
            (
              6371 * acos(
                cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(sp.latitude))
              )
            ) AS distance
          FROM service_provider_profiles sp
          WHERE sp.latitude IS NOT NULL 
          AND sp.longitude IS NOT NULL
          AND sp.is_active = true
          AND (
            6371 * acos(
              cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(sp.latitude))
            )
          ) <= 5
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = sp.user_id 
            AND n.data->>'caseId' = $3
          )
        `;

        const sps = await this.pool.query(spQuery, [caseRow.latitude, caseRow.longitude, caseRow.id]);
        
        if (sps.rows.length > 0) {
          const providerIds = sps.rows.map(row => row.user_id);
          
          // Notify providers
          await this.notificationService.notifyNewCaseAvailable(
            caseRow.id,
            caseRow.category || caseRow.service_type,
            caseRow.formatted_address || caseRow.city,
            providerIds,
            caseRow.budget,
            caseRow.priority
          );
          
          logger.info(`📍 Notified ${providerIds.length} providers within 5km for case ${caseRow.id}`);
        } else {
          logger.info(`📍 No providers found within 5km for case ${caseRow.id}`);
        }

        // Update status to 'active_waiting'
        await this.pool.query(
          `UPDATE marketplace_service_cases 
           SET location_search_status = 'active_waiting' 
           WHERE id = $1`,
          [caseRow.id]
        );
      }
    } catch (error) {
      logger.error('❌ Error in processInitialSearch:', error);
    }
  }

  /**
   * Step 2: Check for expansion (10 mins passed)
   * Moves 'active_waiting' -> 'expanded' if time passed.
   */
  private async processExpansion(): Promise<void> {
    try {
      const result = await this.pool.query(`
        UPDATE marketplace_service_cases
        SET location_search_status = 'expanded',
            search_radius_km = 10
        WHERE location_search_status = 'active_waiting'
        AND location_search_started_at < NOW() - INTERVAL '10 minutes'
        RETURNING id
      `);
      
      if (result.rowCount && result.rowCount > 0) {
        logger.info(`📍 Expanded radius for ${result.rowCount} cases to 10km`);
      }
    } catch (error) {
      logger.error('❌ Error in processExpansion:', error);
    }
  }

  /**
   * Step 3: Process 'expanded' cases (Radius 10km)
   * Finds cases marked 'expanded', searches for SPs within 10km, sends notifications,
   * and moves status to 'completed'.
   */
  private async processExpandedSearch(): Promise<void> {
    try {
      const cases = await this.pool.query(`
        SELECT * FROM marketplace_service_cases 
        WHERE location_search_status = 'expanded' 
        AND latitude IS NOT NULL 
        AND longitude IS NOT NULL
      `);

      for (const caseRow of cases.rows) {
        logger.info(`📍 Processing expanded 10km search for case ${caseRow.id}`);
        
        // Find SPs within 10km
        // Exclude those who were already notified (assumed if they were in 5km, they got notified)
        // But simpler to just check notifications table or distance > 5
        const spQuery = `
          SELECT 
            sp.user_id,
            (
              6371 * acos(
                cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) +
                sin(radians($1)) * sin(radians(sp.latitude))
              )
            ) AS distance
          FROM service_provider_profiles sp
          WHERE sp.latitude IS NOT NULL 
          AND sp.longitude IS NOT NULL
          AND sp.is_active = true
          AND (
            6371 * acos(
              cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(sp.latitude))
            )
          ) <= 10
          AND (
            6371 * acos(
              cos(radians($1)) * cos(radians(sp.latitude)) * cos(radians(sp.longitude) - radians($2)) +
              sin(radians($1)) * sin(radians(sp.latitude))
            )
          ) > 5 -- Only notify those between 5km and 10km (avoid duplicates)
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = sp.user_id 
            AND n.data->>'caseId' = $3
          )
        `;

        const sps = await this.pool.query(spQuery, [caseRow.latitude, caseRow.longitude, caseRow.id]);
        
        if (sps.rows.length > 0) {
          const providerIds = sps.rows.map(row => row.user_id);
          
          await this.notificationService.notifyNewCaseAvailable(
            caseRow.id,
            caseRow.category || caseRow.service_type,
            caseRow.formatted_address || caseRow.city,
            providerIds,
            caseRow.budget,
            caseRow.priority
          );
          
          logger.info(`📍 Notified ${providerIds.length} NEW providers (5-10km) for case ${caseRow.id}`);
        } else {
          logger.info(`📍 No new providers found in 5-10km range for case ${caseRow.id}`);
        }

        // Update status to 'completed'
        await this.pool.query(
          `UPDATE marketplace_service_cases 
           SET location_search_status = 'completed' 
           WHERE id = $1`,
          [caseRow.id]
        );
      }
    } catch (error) {
      logger.error('❌ Error in processExpandedSearch:', error);
    }
  }
}
