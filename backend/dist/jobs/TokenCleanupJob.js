"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenCleanupJob = void 0;
const ChatTokenService_1 = require("../services/ChatTokenService");
const logger_1 = __importDefault(require("../utils/logger"));
class TokenCleanupJob {
    constructor() {
        this.isRunning = false;
        this.chatTokenService = new ChatTokenService_1.ChatTokenService();
    }
    start() {
        setInterval(async () => {
            await this.runCleanup();
        }, 6 * 60 * 60 * 1000);
        setTimeout(async () => {
            await this.runCleanup();
        }, 5000);
        logger_1.default.info('Token cleanup job scheduled - runs every 6 hours');
    }
    async runCleanup() {
        if (this.isRunning) {
            logger_1.default.info('Token cleanup already running, skipping');
            return;
        }
        try {
            this.isRunning = true;
            logger_1.default.info('Starting token cleanup job');
            const deletedCount = await this.chatTokenService.cleanupExpiredTokens();
            logger_1.default.info('Token cleanup completed', { deletedCount });
        }
        catch (error) {
            logger_1.default.error('Token cleanup job failed', { error });
        }
        finally {
            this.isRunning = false;
        }
    }
    async runManual() {
        logger_1.default.info('Running manual token cleanup');
        return await this.chatTokenService.cleanupExpiredTokens();
    }
}
exports.TokenCleanupJob = TokenCleanupJob;
//# sourceMappingURL=TokenCleanupJob.js.map