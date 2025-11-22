import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import logger from '../utils/logger';

export class ScreenshotCleanupJob {
  private pool: Pool;
  private uploadsDir: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.uploadsDir = path.join(__dirname, '../../uploads/case-screenshots');
  }

  /**
   * Start the cleanup job - runs daily at 3 AM
   */
  start() {
    // Run daily at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
      logger.info('🧹 Starting screenshot cleanup job...');
      await this.cleanupOldScreenshots();
    });

    logger.info('✅ Screenshot cleanup job scheduled (daily at 3:00 AM)');
  }

  /**
   * Clean up screenshots older than 30 days
   */
  async cleanupOldScreenshots() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Get screenshots older than 30 days from database
      const result = await this.pool.query(
        `SELECT id, image_url, created_at 
         FROM case_screenshots 
         WHERE created_at < $1`,
        [thirtyDaysAgo]
      );

      const oldScreenshots = result.rows;
      logger.info(`📊 Found ${oldScreenshots.length} screenshots older than 30 days`);

      let deletedCount = 0;
      let errorCount = 0;

      for (const screenshot of oldScreenshots) {
        try {
          // Extract filename from URL
          const url = screenshot.image_url;
          const filename = path.basename(url);
          const filePath = path.join(this.uploadsDir, filename);

          // Delete file from filesystem if it exists
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`🗑️ Deleted file: ${filename}`);
          }

          // Delete database record
          await this.pool.query(
            'DELETE FROM case_screenshots WHERE id = $1',
            [screenshot.id]
          );

          deletedCount++;
        } catch (error) {
          logger.error(`❌ Error deleting screenshot ${screenshot.id}:`, error);
          errorCount++;
        }
      }

      logger.info(`✅ Screenshot cleanup completed: ${deletedCount} deleted, ${errorCount} errors`);

      // Also clean up orphaned files (files without database records)
      await this.cleanupOrphanedFiles();

    } catch (error) {
      logger.error('❌ Error in screenshot cleanup job:', error);
    }
  }

  /**
   * Clean up files that exist on disk but not in database
   */
  private async cleanupOrphanedFiles() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        return;
      }

      const files = fs.readdirSync(this.uploadsDir);
      logger.info(`📁 Checking ${files.length} files for orphaned entries...`);

      let orphanedCount = 0;

      for (const filename of files) {
        const filePath = path.join(this.uploadsDir, filename);
        const stats = fs.statSync(filePath);

        // Check if file is older than 30 days
        const fileAge = Date.now() - stats.mtime.getTime();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        if (fileAge > thirtyDaysInMs) {
          // Check if file exists in database
          const baseUrl = process.env.BACKEND_URL || 'https://maystorfix.com';
          const url = `${baseUrl}/uploads/case-screenshots/${filename}`;
          
          const result = await this.pool.query(
            'SELECT id FROM case_screenshots WHERE image_url = $1',
            [url]
          );

          if (result.rows.length === 0) {
            // Orphaned file - delete it
            fs.unlinkSync(filePath);
            logger.info(`🗑️ Deleted orphaned file: ${filename}`);
            orphanedCount++;
          }
        }
      }

      if (orphanedCount > 0) {
        logger.info(`✅ Cleaned up ${orphanedCount} orphaned files`);
      }

    } catch (error) {
      logger.error('❌ Error cleaning up orphaned files:', error);
    }
  }

  /**
   * Run cleanup immediately (for testing)
   */
  async runNow() {
    logger.info('🧹 Running screenshot cleanup job immediately...');
    await this.cleanupOldScreenshots();
  }
}
