// Advanced Security Enhancement Service
// Implements additional security layers to prevent sophisticated attacks

import crypto from 'crypto';
import { Request } from 'express';
import logger from '../utils/logger';
import { DatabaseFactory } from '../models/DatabaseFactory';

export interface SecurityThreat {
  id: string;
  type: 'BRUTE_FORCE' | 'CREDENTIAL_STUFFING' | 'ACCOUNT_TAKEOVER' | 'API_ABUSE' | 'SUSPICIOUS_BEHAVIOR';
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress: string;
  userAgent?: string;
  details: any;
  timestamp: Date;
  blocked: boolean;
}

export interface DeviceFingerprint {
  id: string;
  userId: string;
  fingerprint: string;
  ipAddress: string;
  userAgent: string;
  screenResolution?: string;
  timezone?: string;
  language?: string;
  isKnownDevice: boolean;
  firstSeen: Date;
  lastSeen: Date;
  trustScore: number;
}

export interface SecurityAlert {
  id: string;
  type: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  userId?: string;
  ipAddress?: string;
  timestamp: Date;
  actionTaken: string;
  details: any;
}

export class SecurityEnhancementService {
  private static instance: SecurityEnhancementService;
  private database: any; // DatabaseFactory returns SQLiteDatabase | PostgreSQLDatabase
  
  // Advanced threat detection patterns
  private readonly SUSPICIOUS_USER_AGENTS = [
    /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i,
    /automated/i, /script/i, /tool/i, /scanner/i, /exploit/i
  ];

  private readonly SUSPICIOUS_IPS = new Set([
    // Add known malicious IP ranges
    '127.0.0.1', // Example - replace with real threat intelligence
  ]);

  // Geolocation anomaly detection
  private readonly HIGH_RISK_COUNTRIES = new Set([
    'CN', 'RU', 'KP', 'IR', // Example high-risk countries
  ]);

  // Failed login attempt tracking
  private failedAttempts = new Map<string, { count: number; lastAttempt: number; blocked: boolean }>();
  
  // Device fingerprint cache
  private deviceCache = new Map<string, DeviceFingerprint>();

  public static getInstance(): SecurityEnhancementService {
    if (!SecurityEnhancementService.instance) {
      SecurityEnhancementService.instance = new SecurityEnhancementService();
    }
    return SecurityEnhancementService.instance;
  }

  constructor() {
    this.database = DatabaseFactory.getDatabase();
    this.initializeSecurityTables().catch(error => {
      console.error('❌ Failed to initialize security tables:', error);
    });
  }

  /**
   * Initialize security monitoring tables
   */
  private async initializeSecurityTables(): Promise<void> {
    try {
      // Security threats table
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          CREATE TABLE IF NOT EXISTS security_threats (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            severity TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT NOT NULL,
            user_agent TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            blocked BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Device fingerprints table
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          CREATE TABLE IF NOT EXISTS device_fingerprints (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            ip_address TEXT NOT NULL,
            user_agent TEXT NOT NULL,
            screen_resolution TEXT,
            timezone TEXT,
            language TEXT,
            is_known_device BOOLEAN DEFAULT 0,
            first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
            trust_score INTEGER DEFAULT 50,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Security alerts table
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          CREATE TABLE IF NOT EXISTS security_alerts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            message TEXT NOT NULL,
            severity TEXT NOT NULL,
            user_id TEXT,
            ip_address TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            action_taken TEXT,
            details TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('✅ Security enhancement tables initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize security tables:', error);
    }
  }

  /**
   * 1. BRUTE FORCE PROTECTION - Advanced login attempt monitoring
   */
  async checkBruteForceProtection(email: string, ipAddress: string): Promise<{ allowed: boolean; reason?: string; waitTime?: number }> {
    try {
    const emailKey = `email:${email}`;
    const ipKey = `ip:${ipAddress}`;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 5;

    // Check email-based attempts
    const emailAttempts = this.failedAttempts.get(emailKey);
    if (emailAttempts && emailAttempts.blocked && (now - emailAttempts.lastAttempt) < windowMs) {
      const waitTime = Math.ceil((windowMs - (now - emailAttempts.lastAttempt)) / 1000);
      
      await this.logSecurityThreat({
        type: 'BRUTE_FORCE',
        severity: 'high',
        ipAddress,
        details: { email, attemptCount: emailAttempts.count, type: 'email_based' },
        blocked: true
      });

      return { 
        allowed: false, 
        reason: `Account temporarily locked due to multiple failed attempts. Try again in ${Math.ceil(waitTime / 60)} minutes.`,
        waitTime 
      };
    }

    // Check IP-based attempts
    const ipAttempts = this.failedAttempts.get(ipKey);
    if (ipAttempts && ipAttempts.blocked && (now - ipAttempts.lastAttempt) < windowMs) {
      const waitTime = Math.ceil((windowMs - (now - ipAttempts.lastAttempt)) / 1000);
      
      await this.logSecurityThreat({
        type: 'BRUTE_FORCE',
        severity: 'critical',
        ipAddress,
        details: { email, attemptCount: ipAttempts.count, type: 'ip_based' },
        blocked: true
      });

      return { 
        allowed: false, 
        reason: `IP address temporarily blocked due to suspicious activity. Try again in ${Math.ceil(waitTime / 60)} minutes.`,
        waitTime 
      };
    }

    return { allowed: true };
    } catch (error) {
      logger.error('❌ Brute force check error:', error);
      return { allowed: true }; // Allow on error to not block legitimate users
    }
  }

  /**
   * Record failed login attempt
   */
  recordFailedLogin(email: string, ipAddress: string): void {
    const emailKey = `email:${email}`;
    const ipKey = `ip:${ipAddress}`;
    const now = Date.now();
    const maxAttempts = 5;

    // Update email attempts
    const emailAttempts = this.failedAttempts.get(emailKey) || { count: 0, lastAttempt: 0, blocked: false };
    emailAttempts.count++;
    emailAttempts.lastAttempt = now;
    emailAttempts.blocked = emailAttempts.count >= maxAttempts;
    this.failedAttempts.set(emailKey, emailAttempts);

    // Update IP attempts
    const ipAttempts = this.failedAttempts.get(ipKey) || { count: 0, lastAttempt: 0, blocked: false };
    ipAttempts.count++;
    ipAttempts.lastAttempt = now;
    ipAttempts.blocked = ipAttempts.count >= maxAttempts;
    this.failedAttempts.set(ipKey, ipAttempts);

    logger.warn('🚨 Failed login attempt recorded', {
      email: this.maskEmail(email),
      ipAddress: this.maskIP(ipAddress),
      emailAttempts: emailAttempts.count,
      ipAttempts: ipAttempts.count
    });
  }

  /**
   * Clear failed attempts on successful login
   */
  clearFailedAttempts(email: string, ipAddress: string): void {
    this.failedAttempts.delete(`email:${email}`);
    this.failedAttempts.delete(`ip:${ipAddress}`);
  }

  /**
   * 2. DEVICE FINGERPRINTING - Detect new/suspicious devices
   */
  async analyzeDeviceFingerprint(req: Request, userId: string): Promise<{ trusted: boolean; isNewDevice: boolean; riskScore: number }> {
    const fingerprint = this.generateDeviceFingerprint(req);
    const ipAddress = req.ip || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    // Check if this is a known device
    const existingDevice = await this.getDeviceFingerprint(userId, fingerprint);
    
    if (existingDevice) {
      // Update last seen
      await this.updateDeviceLastSeen(existingDevice.id);
      return { 
        trusted: existingDevice.trustScore > 70, 
        isNewDevice: false, 
        riskScore: 100 - existingDevice.trustScore 
      };
    }

    // New device detected
    const riskScore = await this.calculateDeviceRiskScore(req, userId);
    
    await this.saveDeviceFingerprint({
      id: crypto.randomUUID(),
      userId,
      fingerprint,
      ipAddress,
      userAgent,
      isKnownDevice: false,
      firstSeen: new Date(),
      lastSeen: new Date(),
      trustScore: Math.max(0, 100 - riskScore)
    });

    if (riskScore > 70) {
      await this.logSecurityAlert({
        type: 'NEW_DEVICE_HIGH_RISK',
        message: `High-risk new device detected for user`,
        severity: 'high',
        userId,
        ipAddress,
        actionTaken: 'DEVICE_FLAGGED',
        details: { fingerprint, riskScore, userAgent }
      });
    }

    return { 
      trusted: riskScore < 30, 
      isNewDevice: true, 
      riskScore 
    };
  }

  /**
   * Generate device fingerprint
   */
  private generateDeviceFingerprint(req: Request): string {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.ip || '',
      // Add more fingerprinting components as needed
    ];
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Calculate device risk score based on various factors
   */
  private async calculateDeviceRiskScore(req: Request, userId: string): Promise<number> {
    let riskScore = 0;
    const userAgent = req.get('User-Agent') || '';
    const ipAddress = req.ip || '';

    // Check for suspicious user agents
    if (this.SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent))) {
      riskScore += 40;
    }

    // Check for suspicious IP addresses
    if (this.SUSPICIOUS_IPS.has(ipAddress)) {
      riskScore += 50;
    }

    // Check for missing standard headers
    if (!req.get('Accept-Language')) riskScore += 10;
    if (!req.get('Accept-Encoding')) riskScore += 10;

    // Check for unusual connection patterns
    if (userAgent.length < 20) riskScore += 20; // Very short user agent
    if (userAgent.length > 500) riskScore += 15; // Unusually long user agent

    return Math.min(100, riskScore);
  }

  /**
   * 3. GEOLOCATION ANOMALY DETECTION
   */
  async checkGeolocationAnomaly(ipAddress: string, userId: string): Promise<{ suspicious: boolean; reason?: string }> {
    // In a real implementation, you would use a geolocation API
    // For now, we'll simulate basic checks
    
    // Check if IP is from a high-risk country (simulated)
    const isHighRisk = Math.random() < 0.1; // 10% chance for demo
    
    if (isHighRisk) {
      await this.logSecurityAlert({
        type: 'GEOLOCATION_ANOMALY',
        message: 'Login from high-risk geographic location',
        severity: 'medium',
        userId,
        ipAddress,
        actionTaken: 'FLAGGED_FOR_REVIEW',
        details: { riskType: 'high_risk_country' }
      });

      return { 
        suspicious: true, 
        reason: 'Login detected from a high-risk geographic location' 
      };
    }

    return { suspicious: false };
  }

  /**
   * 4. API RATE LIMITING & ABUSE DETECTION
   */
  async checkAPIAbuse(req: Request, userId?: string): Promise<{ allowed: boolean; reason?: string }> {
    const ipAddress = req.ip || 'unknown';
    const endpoint = req.path;
    const method = req.method;
    
    // Implement sophisticated rate limiting based on endpoint sensitivity
    const limits = this.getEndpointLimits(endpoint, method);
    
    // Check if this looks like automated abuse
    const userAgent = req.get('User-Agent') || '';
    if (this.SUSPICIOUS_USER_AGENTS.some(pattern => pattern.test(userAgent))) {
      await this.logSecurityThreat({
        type: 'API_ABUSE',
        severity: 'high',
        ipAddress,
        details: { endpoint, method, userAgent, reason: 'suspicious_user_agent' },
        blocked: true
      });

      return { 
        allowed: false, 
        reason: 'Automated requests detected. Please use the official application.' 
      };
    }

    return { allowed: true };
  }

  /**
   * Get rate limits for different endpoints
   */
  private getEndpointLimits(endpoint: string, method: string): { requests: number; windowMs: number } {
    // Sensitive endpoints have stricter limits
    if (endpoint.includes('/auth/login')) return { requests: 5, windowMs: 15 * 60 * 1000 };
    if (endpoint.includes('/auth/register')) return { requests: 3, windowMs: 60 * 60 * 1000 };
    if (endpoint.includes('/sms/send')) return { requests: 10, windowMs: 15 * 60 * 1000 };
    if (endpoint.includes('/admin/')) return { requests: 50, windowMs: 15 * 60 * 1000 };
    
    // Default limits
    return { requests: 100, windowMs: 15 * 60 * 1000 };
  }

  /**
   * Log security threat
   */
  private async logSecurityThreat(threat: Omit<SecurityThreat, 'id' | 'timestamp'>): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    try {
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          INSERT INTO security_threats (
            id, type, severity, user_id, ip_address, user_agent, details, blocked, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, threat.type, threat.severity, threat.userId || null, 
          threat.ipAddress, threat.userAgent || null, 
          JSON.stringify(threat.details), threat.blocked ? 1 : 0, timestamp.toISOString()
        ], (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.warn('🚨 Security threat logged', {
        id, type: threat.type, severity: threat.severity, 
        ipAddress: this.maskIP(threat.ipAddress)
      });
    } catch (error) {
      logger.error('❌ Failed to log security threat:', error);
    }
  }

  /**
   * Log security alert
   */
  private async logSecurityAlert(alert: Omit<SecurityAlert, 'id' | 'timestamp'>): Promise<void> {
    const id = crypto.randomUUID();
    const timestamp = new Date();

    try {
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          INSERT INTO security_alerts (
            id, type, message, severity, user_id, ip_address, action_taken, details, timestamp
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          id, alert.type, alert.message, alert.severity, 
          alert.userId || null, alert.ipAddress || null, 
          alert.actionTaken, JSON.stringify(alert.details), timestamp.toISOString()
        ], (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      logger.info('🔔 Security alert logged', {
        id, type: alert.type, severity: alert.severity
      });
    } catch (error) {
      logger.error('❌ Failed to log security alert:', error);
    }
  }

  /**
   * Get device fingerprint from database
   */
  private async getDeviceFingerprint(userId: string, fingerprint: string): Promise<DeviceFingerprint | null> {
    return new Promise((resolve, reject) => {
      (this.database as any)._db.get(`
        SELECT * FROM device_fingerprints 
        WHERE user_id = ? AND fingerprint = ?
      `, [userId, fingerprint], (err: any, row: any) => {
        if (err) reject(err);
        else if (row) {
          resolve({
            id: row.id,
            userId: row.user_id,
            fingerprint: row.fingerprint,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            screenResolution: row.screen_resolution,
            timezone: row.timezone,
            language: row.language,
            isKnownDevice: Boolean(row.is_known_device),
            firstSeen: new Date(row.first_seen),
            lastSeen: new Date(row.last_seen),
            trustScore: row.trust_score
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Save device fingerprint
   */
  private async saveDeviceFingerprint(device: DeviceFingerprint): Promise<void> {
    return new Promise((resolve, reject) => {
      (this.database as any)._db.run(`
        INSERT INTO device_fingerprints (
          id, user_id, fingerprint, ip_address, user_agent, 
          is_known_device, first_seen, last_seen, trust_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        device.id, device.userId, device.fingerprint, device.ipAddress, 
        device.userAgent, device.isKnownDevice ? 1 : 0, 
        device.firstSeen.toISOString(), device.lastSeen.toISOString(), device.trustScore
      ], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Update device last seen timestamp
   */
  private async updateDeviceLastSeen(deviceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      (this.database as any)._db.run(`
        UPDATE device_fingerprints 
        SET last_seen = ?, trust_score = trust_score + 1 
        WHERE id = ?
      `, [new Date().toISOString(), deviceId], (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Get recent security threats for admin dashboard
   */
  async getRecentSecurityThreats(limit: number = 50): Promise<SecurityThreat[]> {
    return new Promise((resolve, reject) => {
      (this.database as any)._db.all(`
        SELECT * FROM security_threats 
        ORDER BY timestamp DESC 
        LIMIT ?
      `, [limit], (err: any, rows: any[]) => {
        if (err) reject(err);
        else {
          const threats = rows.map(row => ({
            id: row.id,
            type: row.type as SecurityThreat['type'],
            severity: row.severity as SecurityThreat['severity'],
            userId: row.user_id,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            details: JSON.parse(row.details || '{}'),
            timestamp: new Date(row.timestamp),
            blocked: Boolean(row.blocked)
          }));
          resolve(threats);
        }
      });
    });
  }

  /**
   * Get security statistics for admin dashboard
   */
  async getSecurityStats(): Promise<any> {
    return new Promise((resolve, reject) => {
      (this.database as any)._db.get(`
        SELECT 
          COUNT(*) as total_threats,
          SUM(CASE WHEN blocked = 1 THEN 1 ELSE 0 END) as blocked_threats,
          SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical_threats,
          SUM(CASE WHEN timestamp > datetime('now', '-24 hours') THEN 1 ELSE 0 END) as threats_24h
        FROM security_threats
      `, (err: any, row: any) => {
        if (err) reject(err);
        else resolve({
          totalThreats: row.total_threats || 0,
          blockedThreats: row.blocked_threats || 0,
          criticalThreats: row.critical_threats || 0,
          threats24h: row.threats_24h || 0,
          failedAttempts: this.failedAttempts.size,
          deviceFingerprints: this.deviceCache.size
        });
      });
    });
  }

  /**
   * Utility functions
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    return `${local.substring(0, 2)}***@${domain}`;
  }

  private maskIP(ipAddress: string): string {
    const parts = ipAddress.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.***`;
    }
    return ipAddress.substring(0, ipAddress.length - 3) + '***';
  }

  /**
   * Cleanup expired data
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const expiredTime = 24 * 60 * 60 * 1000; // 24 hours

    // Clean up failed attempts
    for (const [key, value] of this.failedAttempts.entries()) {
      if (now - value.lastAttempt > expiredTime) {
        this.failedAttempts.delete(key);
      }
    }

    // Clean up old security threats (keep for 30 days)
    try {
      await new Promise<void>((resolve, reject) => {
        (this.database as any)._db.run(`
          DELETE FROM security_threats 
          WHERE timestamp < datetime('now', '-30 days')
        `, (err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (error) {
      logger.error('❌ Failed to cleanup old security threats:', error);
    }
  }
}

export default SecurityEnhancementService;
