import { Pool } from 'pg';
import { NotificationService } from '../services/NotificationService';
import logger from '../utils/logger';

export class BidSelectionReminderJob {
  private pool: Pool;
  private notificationService: NotificationService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.notificationService = new NotificationService();
  }

  /**
   * Check for cases with multiple bids but no winner selected after 24 hours
   */
  async runBidSelectionReminders(): Promise<void> {
    try {
      logger.info('🔔 Running bid selection reminder job...');

      // Find cases with bids but no winner selected after 24 hours
      const query = `
        SELECT 
          c.id as case_id,
          c.customer_id,
          c.description,
          COUNT(b.id) as bid_count,
          MAX(b.created_at) as last_bid_time,
          c.created_at as case_created_at
        FROM marketplace_service_cases c
        INNER JOIN sp_case_bids b ON c.id = b.case_id
        WHERE c.status = 'pending' 
          AND c.bidding_closed = false
          AND c.created_at <= NOW() - INTERVAL '24 hours'
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = c.customer_id 
            AND n.type = 'bid_selection_reminder' 
            AND n.data->>'caseId' = c.id
            AND n.created_at >= NOW() - INTERVAL '24 hours'
          )
        GROUP BY c.id, c.customer_id, c.description, c.created_at
        HAVING COUNT(b.id) >= 2
      `;

      const result = await this.pool.query(query);

      for (const row of result.rows) {
        try {
          await this.notificationService.notifyBidSelectionReminder(
            row.case_id,
            row.customer_id,
            parseInt(row.bid_count)
          );

          logger.info(`🔔 Sent bid selection reminder for case ${row.case_id} to customer ${row.customer_id}`);
        } catch (error) {
          logger.error(`❌ Error sending reminder for case ${row.case_id}:`, error);
        }
      }

      logger.info(`🔔 Bid selection reminder job completed. Sent ${result.rows.length} reminders.`);
    } catch (error) {
      logger.error('❌ Error in bid selection reminder job:', error);
    }
  }

  /**
   * Check for new cases to notify service providers
   */
  async runNewCaseNotifications(): Promise<void> {
    try {
      logger.info('🔔 Running new case notification job...');

      // Find new cases created in the last hour that haven't been notified
      const query = `
        SELECT 
          c.id as case_id,
          c.service_type,
          c.description,
          c.city,
          c.neighborhood,
          c.category,
          c.budget,
          c.priority,
          u.id as provider_id,
          psc.category_id as service_category,
          sp.city as provider_city,
          sp.neighborhood as provider_neighborhood
        FROM marketplace_service_cases c
        CROSS JOIN users u
        INNER JOIN service_provider_profiles sp ON u.id = sp.user_id
        INNER JOIN provider_service_categories psc ON sp.user_id = psc.provider_id
        WHERE c.status = 'pending'
          AND c.bidding_enabled = true
          AND c.bidding_closed = false
          AND c.created_at >= NOW() - INTERVAL '6 hours'
          AND c.customer_id != u.id
          AND sp.is_active = true
          AND psc.category_id = c.category
          AND sp.city = c.city
          -- Require exact match for both city AND neighborhood
          AND c.neighborhood IS NOT NULL
          AND sp.neighborhood IS NOT NULL
          AND c.neighborhood = sp.neighborhood
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = u.id 
            AND n.type IN ('new_case_available', 'job_incoming')
            AND n.data->>'caseId' = c.id
          )
      `;

      const result = await this.pool.query(query);

      // Group by case to avoid duplicate notifications
      const casesToNotify: { [caseId: string]: { caseDetails: any, providers: string[] } } = {};

      for (const row of result.rows) {
        if (!casesToNotify[row.case_id]) {
          casesToNotify[row.case_id] = {
            caseDetails: {
              id: row.case_id,
              service_type: row.service_type,
              description: row.description,
              city: row.city,
              category: row.category,
              budget: row.budget,
              priority: row.priority
            },
            providers: []
          };
        }
        casesToNotify[row.case_id].providers.push(row.provider_id);
      }

      for (const [caseId, data] of Object.entries(casesToNotify)) {
        try {
          await this.notificationService.notifyNewCaseAvailable(
            caseId,
            data.caseDetails.service_type,
            data.caseDetails.city,
            data.providers,
            data.caseDetails.budget,
            data.caseDetails.priority
          );

          logger.info(`🔔 Sent new case notification for case ${caseId} to ${data.providers.length} providers`);
        } catch (error) {
          logger.error(`❌ Error sending new case notification for case ${caseId}:`, error);
        }
      }

      logger.info(`🔔 New case notification job completed. Sent notifications for ${Object.keys(casesToNotify).length} cases.`);
    } catch (error) {
      logger.error('❌ Error in new case notification job:', error);
    }
  }

  /**
   * Check for low points warnings
   */
  async runPointsLowWarnings(): Promise<void> {
    try {
      logger.info('🔔 Running points low warning job...');

      const query = `
        SELECT 
          u.id as user_id,
          u.points_balance,
          sp.business_name
        FROM users u
        INNER JOIN service_provider_profiles sp ON u.id = sp.user_id
        WHERE u.points_balance <= 50
          AND u.points_balance > 0
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = u.id 
            AND n.type = 'points_low_warning' 
            AND n.created_at >= NOW() - INTERVAL '24 hours'
          )
      `;

      const result = await this.pool.query(query);

      for (const row of result.rows) {
        try {
          await this.notificationService.notifyPointsLowWarning(
            row.user_id,
            parseInt(row.points_balance),
            50
          );

          logger.info(`🔔 Sent points low warning to user ${row.user_id} with ${row.points_balance} points`);
        } catch (error) {
          logger.error(`❌ Error sending points warning to user ${row.user_id}:`, error);
        }
      }

      logger.info(`🔔 Points low warning job completed. Sent ${result.rows.length} warnings.`);
    } catch (error) {
      logger.error('❌ Error in points low warning job:', error);
    }
  }

  /**
   * Notify matching providers for a specific case (event-driven)
   */
  async notifyMatchingProvidersForCase(caseId: string, excludedProviderIds: string[] = []): Promise<void> {
    try {
      logger.info(`🔔 Finding matching providers for case ${caseId} (excluding ${excludedProviderIds.length} providers)...`);

      const query = `
        SELECT 
          c.id as case_id,
          c.service_type,
          c.description,
          c.city,
          c.neighborhood,
          c.category,
          c.budget,
          c.priority,
          u.id as provider_id,
          psc.category_id as service_category,
          sp.city as provider_city,
          sp.neighborhood as provider_neighborhood
        FROM marketplace_service_cases c
        CROSS JOIN users u
        INNER JOIN service_provider_profiles sp ON u.id = sp.user_id
        INNER JOIN provider_service_categories psc ON sp.user_id = psc.provider_id
        WHERE c.id = $1
          AND c.status = 'pending'
          AND c.bidding_enabled = true
          AND c.bidding_closed = false
          AND c.customer_id != u.id
          AND sp.is_active = true
          AND psc.category_id = c.category
          AND sp.city = c.city
          AND c.neighborhood IS NOT NULL
          AND sp.neighborhood IS NOT NULL
          AND c.neighborhood = sp.neighborhood
          AND NOT EXISTS (
            SELECT 1 FROM notifications n 
            WHERE n.user_id = u.id 
            AND n.type IN ('new_case_available', 'job_incoming')
            AND n.data->>'caseId' = c.id
          )
      `;

      const result = await this.pool.query(query, [caseId]);

      if (result.rows.length === 0) {
        logger.info(`🔔 No matching providers found for case ${caseId}`);
        return;
      }

      // Deduplicate providers and filter excluded ones
      const allProviderIds = result.rows.map(row => row.provider_id);
      const uniqueProviders = [...new Set(allProviderIds)].filter(id => !excludedProviderIds.includes(id));
      
      if (uniqueProviders.length === 0) {
        logger.info(`🔔 No new providers to notify for case ${caseId} (after exclusion)`);
        return;
      }

      const caseDetails = result.rows[0];

      await this.notificationService.notifyNewCaseAvailable(
        caseId,
        caseDetails.service_type,
        caseDetails.city,
        uniqueProviders,
        caseDetails.budget,
        caseDetails.priority
      );

      logger.info(`🔔 Sent new case notification for case ${caseId} to ${uniqueProviders.length} providers`);
    } catch (error) {
      logger.error(`❌ Error notifying providers for case ${caseId}:`, error);
    }
  }
}
