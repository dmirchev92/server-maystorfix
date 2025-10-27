"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLDatabase = void 0;
const pg_1 = require("pg");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
const types_1 = require("../types");
class PostgreSQLDatabase {
    constructor() {
        this.isConnected = false;
        this.pool = new pg_1.Pool({
            host: config_1.default.database.postgresql.host,
            port: config_1.default.database.postgresql.port,
            database: config_1.default.database.postgresql.database,
            user: config_1.default.database.postgresql.username,
            password: config_1.default.database.postgresql.password,
            ssl: config_1.default.database.postgresql.ssl,
            max: config_1.default.database.postgresql.maxConnections,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.pool.on('connect', () => {
            this.isConnected = true;
            logger_1.default.info('PostgreSQL client connected');
        });
        this.pool.on('error', (err) => {
            logger_1.default.error('PostgreSQL client error', { error: err.message });
            this.isConnected = false;
        });
        this.pool.on('remove', () => {
            logger_1.default.info('PostgreSQL client removed');
        });
    }
    async initialize() {
        try {
            await this.createTables();
            await this.createIndexes();
            await this.seedInitialData();
            logger_1.default.info('PostgreSQL database initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize PostgreSQL database', { error: error.message });
            throw error;
        }
    }
    async createTables() {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL CHECK (role IN ('tradesperson', 'employee', 'admin')),
          status VARCHAR(50) NOT NULL DEFAULT 'pending_verification' 
            CHECK (status IN ('active', 'suspended', 'deleted', 'pending_verification')),
          first_name VARCHAR(100) NOT NULL,
          last_name VARCHAR(100) NOT NULL,
          phone_number VARCHAR(20) NOT NULL,
          profile_picture_url TEXT,
          business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_login_at TIMESTAMP WITH TIME ZONE,
          data_retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
          is_gdpr_compliant BOOLEAN DEFAULT TRUE,
          CONSTRAINT valid_bulgarian_phone CHECK (phone_number ~ '^\\+359[0-9]{8,9}$')
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS businesses (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          eik VARCHAR(13) UNIQUE NOT NULL,
          dds_number VARCHAR(15),
          company_name VARCHAR(255) NOT NULL,
          company_name_bg VARCHAR(255) NOT NULL,
          legal_address TEXT NOT NULL,
          business_type VARCHAR(50) NOT NULL 
            CHECK (business_type IN ('electrical', 'plumbing', 'hvac', 'general_contractor', 'other')),
          service_areas JSONB DEFAULT '[]'::jsonb,
          working_hours JSONB NOT NULL,
          emergency_contact VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE,
          CONSTRAINT valid_eik CHECK (LENGTH(eik) IN (9, 13))
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS certifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL 
            CHECK (type IN ('electrical', 'plumbing', 'hvac', 'safety', 'other')),
          certification_number VARCHAR(100) NOT NULL,
          issued_by VARCHAR(255) NOT NULL,
          issued_at DATE NOT NULL,
          expires_at DATE,
          is_active BOOLEAN DEFAULT TRUE,
          document_url TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(certification_number, type)
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS gdpr_consents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          consent_type VARCHAR(50) NOT NULL 
            CHECK (consent_type IN ('essential_service', 'analytics', 'marketing', 'third_party_integrations', 'data_sharing')),
          granted BOOLEAN NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ip_address INET,
          user_agent TEXT,
          withdrawn_at TIMESTAMP WITH TIME ZONE,
          legal_basis VARCHAR(50) NOT NULL 
            CHECK (legal_basis IN ('legitimate_interest', 'consent', 'contract', 'legal_obligation')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          resource VARCHAR(100) NOT NULL,
          resource_id VARCHAR(255) NOT NULL,
          details JSONB DEFAULT '{}'::jsonb,
          ip_address INET NOT NULL,
          user_agent TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          gdpr_relevant BOOLEAN DEFAULT FALSE,
          retention_until TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 years')
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS data_processing_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          data_subject_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          data_type VARCHAR(100) NOT NULL,
          processing_purpose TEXT NOT NULL,
          legal_basis VARCHAR(50) NOT NULL 
            CHECK (legal_basis IN ('legitimate_interest', 'consent', 'contract', 'legal_obligation')),
          data_source VARCHAR(100) NOT NULL,
          processing_started TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          processing_ended TIMESTAMP WITH TIME ZONE,
          retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
          third_party_processors JSONB DEFAULT '[]'::jsonb,
          gdpr_rights JSONB DEFAULT '{
            "access_requested": false,
            "rectification_requested": false,
            "erasure_requested": false,
            "portability_requested": false,
            "objecting_to_processing": false
          }'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token UUID NOT NULL UNIQUE,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          used_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ip_address INET
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          ip_address INET,
          user_agent TEXT,
          is_active BOOLEAN DEFAULT TRUE
        );
      `);
            await client.query('COMMIT');
            logger_1.default.info('PostgreSQL tables created successfully');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createIndexes() {
        const client = await this.pool.connect();
        try {
            const indexes = [
                'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
                'CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id)',
                'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
                'CREATE INDEX IF NOT EXISTS idx_users_data_retention ON users(data_retention_until)',
                'CREATE INDEX IF NOT EXISTS idx_businesses_eik ON businesses(eik)',
                'CREATE INDEX IF NOT EXISTS idx_businesses_type ON businesses(business_type)',
                'CREATE INDEX IF NOT EXISTS idx_businesses_active ON businesses(is_active)',
                'CREATE INDEX IF NOT EXISTS idx_certifications_business_id ON certifications(business_id)',
                'CREATE INDEX IF NOT EXISTS idx_certifications_type ON certifications(type)',
                'CREATE INDEX IF NOT EXISTS idx_certifications_expires ON certifications(expires_at)',
                'CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user_id ON gdpr_consents(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_gdpr_consents_type ON gdpr_consents(consent_type)',
                'CREATE INDEX IF NOT EXISTS idx_gdpr_consents_granted ON gdpr_consents(granted)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_gdpr ON audit_logs(gdpr_relevant)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_retention ON audit_logs(retention_until)',
                'CREATE INDEX IF NOT EXISTS idx_data_processing_subject ON data_processing_records(data_subject_id)',
                'CREATE INDEX IF NOT EXISTS idx_data_processing_type ON data_processing_records(data_type)',
                'CREATE INDEX IF NOT EXISTS idx_data_processing_retention ON data_processing_records(retention_until)',
                'CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token)',
                'CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at)',
                'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(token_hash)',
                'CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at)'
            ];
            for (const indexQuery of indexes) {
                await client.query(indexQuery);
            }
            logger_1.default.info('PostgreSQL indexes created successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to create PostgreSQL indexes', { error: error.message });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async seedInitialData() {
        const client = await this.pool.connect();
        try {
            const userCount = await client.query('SELECT COUNT(*) FROM users');
            if (parseInt(userCount.rows[0].count) > 0) {
                logger_1.default.info('Database already has data, skipping seed');
                return;
            }
            const adminUserId = await this.createUser(client, {
                email: 'admin@servicetextpro.bg',
                passwordHash: '$2a$12$dummy.hash.for.demo',
                role: types_1.UserRole.ADMIN,
                status: types_1.UserStatus.ACTIVE,
                firstName: 'System',
                lastName: 'Administrator',
                phoneNumber: '+359888000000',
                gdprConsents: [
                    {
                        id: '',
                        userId: '',
                        consentType: types_1.ConsentType.ESSENTIAL_SERVICE,
                        granted: true,
                        timestamp: new Date(),
                        legalBasis: types_1.DataProcessingBasis.LEGITIMATE_INTEREST
                    }
                ],
                dataRetentionUntil: new Date(Date.now() + 7 * 365 * 24 * 60 * 60 * 1000),
                isGdprCompliant: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            logger_1.default.info('Initial admin user created', { userId: adminUserId });
        }
        catch (error) {
            logger_1.default.error('Failed to seed initial data', { error: error.message });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createUser(client, user) {
        const queryClient = client || await this.pool.connect();
        const shouldRelease = !client;
        try {
            const result = await queryClient.query(`INSERT INTO users (
          email, password_hash, role, status, first_name, last_name, 
          phone_number, business_id, data_retention_until, is_gdpr_compliant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING id`, [
                user.email,
                user.passwordHash,
                user.role,
                user.status,
                user.firstName,
                user.lastName,
                user.phoneNumber,
                user.businessId,
                user.dataRetentionUntil,
                user.isGdprCompliant
            ]);
            const userId = result.rows[0].id;
            for (const consent of user.gdprConsents) {
                await this.createGDPRConsent(queryClient, {
                    ...consent,
                    userId
                });
            }
            logger_1.gdprLogger.logDataAccess(userId, 'user_creation', 'account_registration');
            return userId;
        }
        finally {
            if (shouldRelease) {
                queryClient.release();
            }
        }
    }
    async findUserByEmail(email) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM users WHERE email = $1 AND status != $2', [email.toLowerCase(), types_1.UserStatus.DELETED]);
            if (result.rows.length === 0) {
                return null;
            }
            const userData = result.rows[0];
            const consentsResult = await client.query('SELECT * FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC', [userData.id]);
            const gdprConsents = consentsResult.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                consentType: row.consent_type,
                granted: row.granted,
                timestamp: row.timestamp,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                withdrawnAt: row.withdrawn_at,
                legalBasis: row.legal_basis
            }));
            return this.mapUserFromDatabase(userData, gdprConsents);
        }
        finally {
            client.release();
        }
    }
    async findUserById(id) {
        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT * FROM users WHERE id = $1 AND status != $2', [id, types_1.UserStatus.DELETED]);
            if (result.rows.length === 0) {
                return null;
            }
            const userData = result.rows[0];
            const consentsResult = await client.query('SELECT * FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC', [id]);
            const gdprConsents = consentsResult.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                consentType: row.consent_type,
                granted: row.granted,
                timestamp: row.timestamp,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                withdrawnAt: row.withdrawn_at,
                legalBasis: row.legal_basis
            }));
            return this.mapUserFromDatabase(userData, gdprConsents);
        }
        finally {
            client.release();
        }
    }
    async createGDPRConsent(client, consent) {
        await client.query(`INSERT INTO gdpr_consents (
        user_id, consent_type, granted, timestamp, ip_address, 
        user_agent, withdrawn_at, legal_basis
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
            consent.userId,
            consent.consentType,
            consent.granted,
            consent.timestamp,
            consent.ipAddress,
            consent.userAgent,
            consent.withdrawnAt,
            consent.legalBasis
        ]);
    }
    async createAuditLog(auditLog) {
        const client = await this.pool.connect();
        try {
            await client.query(`INSERT INTO audit_logs (
          user_id, action, resource, resource_id, details, 
          ip_address, user_agent, timestamp, gdpr_relevant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, [
                auditLog.userId,
                auditLog.action,
                auditLog.resource,
                auditLog.resourceId,
                JSON.stringify(auditLog.details),
                auditLog.ipAddress,
                auditLog.userAgent,
                auditLog.timestamp,
                auditLog.gdprRelevant
            ]);
        }
        finally {
            client.release();
        }
    }
    async cleanupExpiredData() {
        const client = await this.pool.connect();
        let deletedRecords = 0;
        try {
            await client.query('BEGIN');
            const tokenResult = await client.query('DELETE FROM password_reset_tokens WHERE expires_at < NOW()');
            deletedRecords += tokenResult.rowCount || 0;
            const sessionResult = await client.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
            deletedRecords += sessionResult.rowCount || 0;
            const auditResult = await client.query('DELETE FROM audit_logs WHERE retention_until < NOW() AND gdpr_relevant = FALSE');
            deletedRecords += auditResult.rowCount || 0;
            await client.query('COMMIT');
            logger_1.default.info('PostgreSQL data cleanup completed', { deletedRecords });
            return { deletedRecords };
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    mapUserFromDatabase(userData, gdprConsents) {
        return {
            id: userData.id,
            email: userData.email,
            passwordHash: userData.password_hash,
            role: userData.role,
            status: userData.status,
            firstName: userData.first_name,
            lastName: userData.last_name,
            phoneNumber: userData.phone_number,
            profilePictureUrl: userData.profile_picture_url,
            businessId: userData.business_id,
            createdAt: userData.created_at,
            updatedAt: userData.updated_at,
            lastLoginAt: userData.last_login_at,
            gdprConsents,
            dataRetentionUntil: userData.data_retention_until,
            isGdprCompliant: userData.is_gdpr_compliant
        };
    }
    async healthCheck() {
        try {
            const result = await this.pool.query('SELECT NOW()');
            return {
                status: 'healthy',
                connections: this.pool.totalCount
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                connections: 0
            };
        }
    }
    async close() {
        await this.pool.end();
        this.isConnected = false;
        logger_1.default.info('PostgreSQL connection closed');
    }
}
exports.PostgreSQLDatabase = PostgreSQLDatabase;
//# sourceMappingURL=PostgreSQLModels.js.map