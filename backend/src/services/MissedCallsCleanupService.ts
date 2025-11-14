// GDPR-Compliant Missed Calls Cleanup Service
// Automatically removes expired call data according to retention policy

import { DatabaseFactory } from '../models/DatabaseFactory';
import { PostgreSQLDatabase } from '../models/PostgreSQLDatabase';
import logger from '../utils/logger';

export class MissedCallsCleanupService {
  private database = DatabaseFactory.getDatabase() as PostgreSQLDatabase;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * Start automatic cleanup job (runs daily)
   */
  public startCleanupJob(): void {
    if (this.cleanupInterval) {
      logger.warn('Cleanup job already running');
      return;
    }

    // Run immediately on start
    this.performCleanup();

    // Run every 24 hours
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, 24 * 60 * 60 * 1000);

    logger.info('✅ GDPR missed calls cleanup job started (runs daily)');
  }

  /**
   * Stop automatic cleanup job
   */
  public stopCleanupJob(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('🛑 GDPR missed calls cleanup job stopped');
    }
  }

  /**
   * Perform GDPR-compliant cleanup of expired call data
   */
  public async performCleanup(): Promise<void> {
    try {
      logger.info('🧹 Starting GDPR missed calls cleanup...');

      const query = `
        DELETE FROM missed_calls 
        WHERE data_retention_until < CURRENT_TIMESTAMP 
        AND deleted_at IS NULL
        RETURNING id
      `;

      const deletedRows = await this.database.query(query);
      const deletedCount = deletedRows.length;

      if (deletedCount > 0) {
        logger.info(`✅ GDPR cleanup completed: ${deletedCount} expired call records deleted`);
      } else {
        logger.info('✅ GDPR cleanup completed: No expired records found');
      }

      // Log cleanup for audit trail
      await this.logCleanupActivity(deletedCount);

    } catch (error) {
      logger.error('❌ Error during GDPR missed calls cleanup:', error);
    }
  }

  /**
   * Log cleanup activity for GDPR audit trail
   */
  private async logCleanupActivity(recordsDeleted: number): Promise<void> {
    try {
      const logQuery = `
        INSERT INTO gdpr_audit_log (
          id, 
          action_type, 
          description, 
          records_affected, 
          performed_at
        ) VALUES (
          'cleanup_' || extract(epoch from now())::text,
          'data_retention_cleanup',
          'Automatic cleanup of expired missed call records',
          $1,
          CURRENT_TIMESTAMP
        )
      `;

      await this.database.query(logQuery, [recordsDeleted]);
    } catch (error) {
      // Don't fail cleanup if audit logging fails
      logger.warn('⚠️ Failed to log cleanup activity:', error);
    }
  }

  /**
   * Manually delete user's call data (GDPR Right to Erasure)
   */
  public async deleteUserCallData(userId: string): Promise<number> {
    try {
      logger.info(`🗑️ Deleting all call data for user: ${userId}`);

      // Soft delete (keep for audit trail)
      const query = `
        UPDATE missed_calls 
        SET deleted_at = CURRENT_TIMESTAMP,
            phone_number = 'REDACTED'  -- Anonymize phone number
        WHERE user_id = $1 
        AND deleted_at IS NULL
        RETURNING id
      `;

      const deletedRows = await this.database.query(query, [userId]);
      const deletedCount = deletedRows.length;

      logger.info(`✅ Deleted ${deletedCount} call records for user ${userId}`);
      return deletedCount;

    } catch (error) {
      logger.error(`❌ Error deleting call data for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Export user's call data (GDPR Right to Data Portability)
   */
  public async exportUserCallData(userId: string): Promise<any[]> {
    try {
      const query = `
        SELECT 
          id,
          phone_number,
          timestamp,
          formatted_time,
          duration,
          call_type,
          sms_sent,
          sms_sent_at,
          ai_response_sent,
          created_at
        FROM missed_calls
        WHERE user_id = $1
        AND deleted_at IS NULL
        ORDER BY timestamp DESC
      `;

      const callData = await this.database.query(query, [userId]);
      logger.info(`📦 Exported ${callData.length} call records for user ${userId}`);
      
      return callData;

    } catch (error) {
      logger.error(`❌ Error exporting call data for user ${userId}:`, error);
      throw error;
    }
  }
}

export default new MissedCallsCleanupService();
