// Security Controller - Admin security monitoring and management
// Provides comprehensive security insights and threat management

import { Request, Response, NextFunction } from 'express';
import SecurityEnhancementService from '../services/SecurityEnhancementService';
import SMSSecurityService from '../services/SMSSecurityService';
import logger from '../utils/logger';
import { requireAdmin } from '../middleware/rbac';

export class SecurityController {
  private securityService: SecurityEnhancementService;
  private smsSecurityService: SMSSecurityService;

  constructor() {
    this.securityService = SecurityEnhancementService.getInstance();
    this.smsSecurityService = SMSSecurityService.getInstance();
  }

  /**
   * Get comprehensive security dashboard data
   */
  async getSecurityDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('📊 Admin accessing security dashboard', { 
        adminId: req.user?.id,
        ipAddress: req.ip 
      });

      // Get security statistics
      const [securityStats, smsStats, recentThreats] = await Promise.all([
        this.securityService.getSecurityStats(),
        this.smsSecurityService.getSecurityStats(),
        this.securityService.getRecentSecurityThreats(20)
      ]);

      // Calculate threat trends
      const threatTrends = this.calculateThreatTrends(recentThreats);

      // Get system health metrics
      const systemHealth = await this.getSystemHealthMetrics();

      const dashboardData = {
        overview: {
          totalThreats: securityStats.totalThreats,
          blockedThreats: securityStats.blockedThreats,
          criticalThreats: securityStats.criticalThreats,
          threats24h: securityStats.threats24h,
          smsBlocked: smsStats.rateLimitEntries || 0,
          systemHealth: systemHealth.status
        },
        smsProtection: {
          premiumPatternsActive: smsStats.premiumPatterns,
          suspiciousPatternsActive: smsStats.suspiciousPatterns,
          lastCleanup: smsStats.lastCleanup,
          protectionLayers: 3
        },
        recentThreats: recentThreats.map(threat => ({
          id: threat.id,
          type: threat.type,
          severity: threat.severity,
          timestamp: threat.timestamp,
          ipAddress: this.maskIP(threat.ipAddress),
          blocked: threat.blocked,
          details: threat.details
        })),
        threatTrends,
        systemMetrics: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          activeConnections: securityStats.failedAttempts,
          deviceFingerprints: securityStats.deviceFingerprints
        }
      };

      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('❌ Security dashboard error:', error);
      next(error);
    }
  }

  /**
   * Get detailed security alerts
   */
  async getSecurityAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const severity = req.query.severity as string;
      const type = req.query.type as string;

      const threats = await this.securityService.getRecentSecurityThreats(limit);
      
      // Filter by severity and type if specified
      let filteredThreats = threats;
      if (severity) {
        filteredThreats = filteredThreats.filter(t => t.severity === severity);
      }
      if (type) {
        filteredThreats = filteredThreats.filter(t => t.type === type);
      }

      const alerts = filteredThreats.map(threat => ({
        id: threat.id,
        type: threat.type,
        severity: threat.severity,
        message: this.formatThreatMessage(threat),
        timestamp: threat.timestamp,
        ipAddress: this.maskIP(threat.ipAddress),
        userId: threat.userId,
        blocked: threat.blocked,
        details: threat.details,
        actionTaken: threat.blocked ? 'BLOCKED' : 'LOGGED'
      }));

      res.json({
        success: true,
        data: {
          alerts,
          total: alerts.length,
          filters: { severity, type, limit }
        }
      });

    } catch (error) {
      logger.error('❌ Security alerts error:', error);
      next(error);
    }
  }

  /**
   * Test SMS security system
   */
  async testSMSSecurity(req: Request, res: Response, next: NextFunction) {
    try {
      const { phoneNumber, message } = req.body;
      const userId = req.user?.id || 'admin-test';
      const ipAddress = req.ip || 'unknown';

      logger.info('🧪 Admin testing SMS security', {
        adminId: req.user?.id,
        testNumber: phoneNumber,
        ipAddress
      });

      // Test the SMS security system
      const securityCheck = await this.smsSecurityService.validateSMSRequest(
        phoneNumber || '0900123456', // Default premium number for testing
        message || 'Test premium number blocking',
        userId,
        ipAddress
      );

      // Log the test result
      const testResult = {
        testType: 'SMS_SECURITY_TEST',
        phoneNumber: phoneNumber || '0900123456',
        allowed: securityCheck.isAllowed,
        riskLevel: securityCheck.riskLevel,
        reason: securityCheck.reason,
        blockedReason: securityCheck.blockedReason,
        timestamp: new Date().toISOString(),
        adminId: req.user?.id
      };

      logger.info('🧪 SMS security test completed', testResult);

      res.json({
        success: true,
        data: {
          testResult: {
            allowed: securityCheck.isAllowed,
            riskLevel: securityCheck.riskLevel,
            reason: securityCheck.reason || 'SMS would be allowed',
            blockedReason: securityCheck.blockedReason,
            message: securityCheck.isAllowed 
              ? '✅ SMS Security Test: Message would be ALLOWED (this might indicate a security gap)'
              : '🚫 SMS Security Test: Message was BLOCKED (security working correctly)'
          },
          securityLayers: {
            layer1: 'Premium Number Detection',
            layer2: 'Extended Premium Patterns',
            layer3: 'Suspicious Characteristics',
            contentAnalysis: 'Message Content Scanning',
            rateLimiting: 'User & IP Rate Limits'
          }
        }
      });

    } catch (error) {
      logger.error('❌ SMS security test error:', error);
      next(error);
    }
  }

  /**
   * Get system security configuration
   */
  async getSecurityConfig(req: Request, res: Response, next: NextFunction) {
    try {
      const config = {
        smsProtection: {
          premiumPatterns: 10, // Number of premium patterns
          extendedPatterns: 15, // Number of extended patterns
          suspiciousPatterns: 6, // Number of suspicious patterns
          contentFilters: 14, // Number of content filters
          rateLimiting: {
            maxSMSPer15Min: 10,
            maxLoginAttempts: 5,
            bruteForceWindow: '15 minutes'
          }
        },
        authentication: {
          bcryptRounds: 12,
          jwtExpiration: '24 hours',
          refreshTokenExpiration: '7 days',
          deviceFingerprintingEnabled: true,
          geolocationMonitoring: true
        },
        apiSecurity: {
          rateLimitingEnabled: true,
          inputSanitization: true,
          xssProtection: true,
          sqlInjectionProtection: true,
          csrfProtection: true
        },
        monitoring: {
          threatDetection: true,
          behaviorAnalysis: true,
          realTimeAlerts: true,
          securityLogging: true
        }
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      logger.error('❌ Security config error:', error);
      next(error);
    }
  }

  /**
   * Trigger security system cleanup
   */
  async cleanupSecurity(req: Request, res: Response, next: NextFunction) {
    try {
      logger.info('🧹 Admin triggered security cleanup', {
        adminId: req.user?.id,
        ipAddress: req.ip
      });

      // Cleanup expired data
      await this.securityService.cleanup();
      this.smsSecurityService.cleanupRateLimits();

      res.json({
        success: true,
        data: {
          message: 'Security system cleanup completed',
          timestamp: new Date().toISOString(),
          actions: [
            'Expired rate limits cleared',
            'Old security threats archived',
            'Device fingerprints updated',
            'Failed login attempts reset'
          ]
        }
      });

    } catch (error) {
      logger.error('❌ Security cleanup error:', error);
      next(error);
    }
  }

  /**
   * Get real-time security metrics
   */
  async getRealtimeMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        activeThreats: 0, // Would be calculated from recent activity
        blockedRequests: 0, // Would be calculated from rate limiting
        suspiciousActivity: 0, // Would be calculated from behavior analysis
        systemLoad: {
          cpu: process.cpuUsage(),
          memory: process.memoryUsage(),
          uptime: process.uptime()
        },
        networkActivity: {
          activeConnections: 0, // Would be tracked
          requestsPerMinute: 0, // Would be calculated
          errorRate: 0 // Would be calculated
        }
      };

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('❌ Realtime metrics error:', error);
      next(error);
    }
  }

  /**
   * Private helper methods
   */
  private calculateThreatTrends(threats: any[]): any {
    const now = new Date();
    const last24h = threats.filter(t => 
      new Date(t.timestamp).getTime() > now.getTime() - 24 * 60 * 60 * 1000
    );
    const last7d = threats.filter(t => 
      new Date(t.timestamp).getTime() > now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    return {
      last24Hours: last24h.length,
      last7Days: last7d.length,
      trend: last24h.length > last7d.length / 7 ? 'increasing' : 'stable',
      severityBreakdown: {
        critical: threats.filter(t => t.severity === 'critical').length,
        high: threats.filter(t => t.severity === 'high').length,
        medium: threats.filter(t => t.severity === 'medium').length,
        low: threats.filter(t => t.severity === 'low').length
      }
    };
  }

  private async getSystemHealthMetrics(): Promise<any> {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    return {
      status: 'healthy', // Would be calculated based on various metrics
      uptime: uptime,
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      },
      responseTime: 0, // Would be tracked
      errorRate: 0 // Would be calculated
    };
  }

  private formatThreatMessage(threat: any): string {
    switch (threat.type) {
      case 'BRUTE_FORCE':
        return `Brute force attack detected from ${this.maskIP(threat.ipAddress)}`;
      case 'API_ABUSE':
        return `API abuse detected: ${threat.details.reason || 'Automated requests'}`;
      case 'SUSPICIOUS_BEHAVIOR':
        return `Suspicious user behavior: ${threat.details.pattern || 'Anomalous activity'}`;
      case 'GEOLOCATION_ANOMALY':
        return `Login from unusual location: ${threat.details.riskType || 'High-risk country'}`;
      default:
        return `Security threat detected: ${threat.type}`;
    }
  }

  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, ipAddress.length - 3) + '***';
  }
}

// Create controller instance
const securityController = new SecurityController();

// Export route handlers
export const getSecurityDashboard = [requireAdmin, securityController.getSecurityDashboard.bind(securityController)];
export const getSecurityAlerts = [requireAdmin, securityController.getSecurityAlerts.bind(securityController)];
export const testSMSSecurity = [requireAdmin, securityController.testSMSSecurity.bind(securityController)];
export const getSecurityConfig = [requireAdmin, securityController.getSecurityConfig.bind(securityController)];
export const cleanupSecurity = [requireAdmin, securityController.cleanupSecurity.bind(securityController)];
export const getRealtimeMetrics = [requireAdmin, securityController.getRealtimeMetrics.bind(securityController)];

export default securityController;
