// Token Cleanup Job - Automated cleanup of expired chat tokens
// Runs periodically to maintain database performance

// Using setInterval instead of node-cron to avoid dependency issues
import { ChatTokenService } from '../services/ChatTokenService';
import logger from '../utils/logger';

export class TokenCleanupJob {
  private readonly chatTokenService: ChatTokenService;
  private isRunning = false;

  constructor() {
    this.chatTokenService = new ChatTokenService();
  }

  /**
   * Start the cleanup job
   * Runs every 6 hours using setInterval
   */
  start(): void {
    // Run cleanup every 6 hours (6 * 60 * 60 * 1000 ms)
    setInterval(async () => {
      await this.runCleanup();
    }, 6 * 60 * 60 * 1000);

    // Run initial cleanup on startup
    setTimeout(async () => {
      await this.runCleanup();
    }, 5000); // Wait 5 seconds after startup

    logger.info('Token cleanup job scheduled - runs every 6 hours');
  }

  /**
   * Run the cleanup process
   */
  private async runCleanup(): Promise<void> {
    if (this.isRunning) {
      logger.info('Token cleanup already running, skipping');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting token cleanup job');

      const deletedCount = await this.chatTokenService.cleanupExpiredTokens();
      
      logger.info('Token cleanup completed', { deletedCount });

    } catch (error) {
      logger.error('Token cleanup job failed', { error });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run cleanup manually (for testing)
   */
  async runManual(): Promise<number> {
    logger.info('Running manual token cleanup');
    return await this.chatTokenService.cleanupExpiredTokens();
  }
}
