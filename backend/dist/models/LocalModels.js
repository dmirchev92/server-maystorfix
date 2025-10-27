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
exports.LocalDatabase = void 0;
const pg_1 = require("pg");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importStar(require("../utils/logger"));
class LocalDatabase {
    constructor() {
        this.isConnected = false;
        this.pool = new pg_1.Pool({
            host: config_1.default.database.postgresql.host,
            port: config_1.default.database.postgresql.port,
            database: config_1.default.database.postgresql.database,
            user: config_1.default.database.postgresql.username,
            password: config_1.default.database.postgresql.password,
            ssl: config_1.default.database.postgresql.ssl,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.setupEventHandlers();
    }
    setupEventHandlers() {
        this.pool.on('connect', () => {
            this.isConnected = true;
            logger_1.default.info('Local PostgreSQL connected');
        });
        this.pool.on('error', (err) => {
            logger_1.default.error('Local PostgreSQL error', { error: err.message });
            this.isConnected = false;
        });
    }
    async initialize() {
        try {
            await this.createAllTables();
            await this.createIndexes();
            await this.seedInitialData();
            logger_1.default.info('Local database initialized successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to initialize local database', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    async createAllTables() {
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
          business_id UUID,
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
          business_type VARCHAR(50) NOT NULL 
            CHECK (business_type IN ('electrical', 'plumbing', 'hvac', 'general_contractor', 'other')),
          service_areas TEXT[] DEFAULT '{}',
          emergency_contact VARCHAR(20),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
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
            CHECK (legal_basis IN ('legitimate_interest', 'consent', 'contract', 'legal_obligation'))
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS conversations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL,
          customer_phone_number VARCHAR(20) NOT NULL,
          customer_name VARCHAR(200),
          platform VARCHAR(20) NOT NULL 
            CHECK (platform IN ('whatsapp', 'viber', 'telegram', 'sms', 'email')),
          state VARCHAR(30) NOT NULL 
            CHECK (state IN ('initial_response', 'awaiting_description', 'analyzing', 'follow_up_questions', 'completed', 'closed')),
          priority VARCHAR(20) NOT NULL DEFAULT 'medium'
            CHECK (priority IN ('low', 'medium', 'high', 'emergency')),
          started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          closed_at TIMESTAMP WITH TIME ZONE,
          gdpr_retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
          platform VARCHAR(20) NOT NULL,
          direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
          content TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending'
            CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          delivered_at TIMESTAMP WITH TIME ZONE,
          read_at TIMESTAMP WITH TIME ZONE,
          metadata JSONB DEFAULT '{}'::jsonb,
          gdpr_retention_until TIMESTAMP WITH TIME ZONE NOT NULL
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS message_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          business_id UUID NOT NULL,
          name VARCHAR(200) NOT NULL,
          category VARCHAR(50) NOT NULL 
            CHECK (category IN ('emergency', 'business_hours', 'after_hours', 'new_customer', 'follow_up')),
          title VARCHAR(300) NOT NULL,
          content TEXT NOT NULL,
          variables TEXT[] DEFAULT '{}',
          triggers TEXT[] DEFAULT '{}',
          conditions JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          language VARCHAR(2) DEFAULT 'bg' CHECK (language IN ('bg', 'en')),
          usage_count INTEGER DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `);
            await client.query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          event_type VARCHAR(100) NOT NULL,
          user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          business_id UUID,
          event_data JSONB DEFAULT '{}'::jsonb,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          session_id VARCHAR(100),
          ip_address INET,
          user_agent TEXT,
          gdpr_retention_until TIMESTAMP WITH TIME ZONE NOT NULL,
          anonymized BOOLEAN DEFAULT FALSE
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
          session_id VARCHAR(255) NOT NULL UNIQUE,
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
            logger_1.default.info('All tables created successfully');
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
                'CREATE INDEX IF NOT EXISTS idx_users_status ON users(status)',
                'CREATE INDEX IF NOT EXISTS idx_users_business_id ON users(business_id)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_business_id ON conversations(business_id)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_customer_phone ON conversations(customer_phone_number)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_state ON conversations(state)',
                'CREATE INDEX IF NOT EXISTS idx_conversations_started_at ON conversations(started_at)',
                'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
                'CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_gdpr_consents_user_id ON gdpr_consents(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)',
                'CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_analytics_events_business_id ON analytics_events(business_id)',
                'CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp)',
                'CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON user_sessions(session_id)',
                'CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id)'
            ];
            for (const indexQuery of indexes) {
                await client.query(indexQuery);
            }
            logger_1.default.info('Database indexes created successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to create indexes', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
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
            const templates = [
                {
                    business_id: '00000000-0000-0000-0000-000000000000',
                    name: 'Спешен отговор',
                    category: 'emergency',
                    title: 'Спешна ситуация - незабавен отговор',
                    content: 'Здравейте! Получих Вашето спешно съобщение. Ще се свържа с Вас в рамките на 15 минути. За критични аварии: {emergency_phone}',
                    variables: ['emergency_phone', 'technician_name'],
                    triggers: ['спешно', 'авария', 'парене', 'искри'],
                    language: 'bg'
                },
                {
                    business_id: '00000000-0000-0000-0000-000000000000',
                    name: 'Работно време',
                    category: 'business_hours',
                    title: 'Отговор в работно време',
                    content: 'Здравейте! Благодаря за съобщението. Ще прегледам заявката Ви и ще се върна при Вас до {response_time} минути.',
                    variables: ['response_time', 'technician_name'],
                    triggers: [],
                    language: 'bg'
                },
                {
                    business_id: '00000000-0000-0000-0000-000000000000',
                    name: 'Извън работно време',
                    category: 'after_hours',
                    title: 'Отговор извън работно време',
                    content: 'Здравейте! Получих съобщението Ви извън работното ми време. Ще се свържа с Вас утре сутрин след {start_time}ч. За спешни случаи: {emergency_contact}',
                    variables: ['start_time', 'emergency_contact'],
                    triggers: [],
                    language: 'bg'
                }
            ];
            for (const template of templates) {
                await client.query(`
          INSERT INTO message_templates (
            business_id, name, category, title, content, variables, triggers, language
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                    template.business_id,
                    template.name,
                    template.category,
                    template.title,
                    template.content,
                    template.variables,
                    template.triggers,
                    template.language
                ]);
            }
            logger_1.default.info('Initial data seeded successfully');
        }
        catch (error) {
            logger_1.default.error('Failed to seed initial data', {
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createUser(user) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await client.query(`
        INSERT INTO users (
          email, password_hash, role, status, first_name, last_name, 
          phone_number, business_id, data_retention_until, is_gdpr_compliant
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
        RETURNING id
      `, [
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
                await client.query(`
          INSERT INTO gdpr_consents (
            user_id, consent_type, granted, timestamp, ip_address, 
            user_agent, withdrawn_at, legal_basis
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
                    userId,
                    consent.consentType,
                    consent.granted,
                    consent.timestamp,
                    consent.ipAddress,
                    consent.userAgent,
                    consent.withdrawnAt,
                    consent.legalBasis
                ]);
            }
            await client.query('COMMIT');
            logger_1.gdprLogger.logDataAccess(userId, 'user_creation', 'account_registration');
            return userId;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async findUserByEmail(email) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
        SELECT * FROM users WHERE email = $1 AND status != 'deleted'
      `, [email.toLowerCase()]);
            if (result.rows.length === 0) {
                return null;
            }
            const userData = result.rows[0];
            const consentsResult = await client.query(`
        SELECT * FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC
      `, [userData.id]);
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
            const result = await client.query(`
        SELECT * FROM users WHERE id = $1 AND status != 'deleted'
      `, [id]);
            if (result.rows.length === 0) {
                return null;
            }
            const userData = result.rows[0];
            const consentsResult = await client.query(`
        SELECT * FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC
      `, [userData.id]);
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
    async updateUser(user) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`
        UPDATE users SET 
          email = $2, password_hash = $3, role = $4, status = $5, 
          first_name = $6, last_name = $7, phone_number = $8, 
          business_id = $9, data_retention_until = $10, 
          is_gdpr_compliant = $11, last_login_at = $12, updated_at = $13
        WHERE id = $1
      `, [
                user.id,
                user.email,
                user.passwordHash,
                user.role,
                user.status,
                user.firstName,
                user.lastName,
                user.phoneNumber,
                user.businessId,
                user.dataRetentionUntil,
                user.isGdprCompliant,
                user.lastLoginAt,
                user.updatedAt
            ]);
            await client.query('COMMIT');
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    }
    async createConversation(conversation) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(`
        INSERT INTO conversations (
          business_id, customer_phone_number, customer_name, platform, 
          state, priority, gdpr_retention_until
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id
      `, [
                conversation.businessId,
                conversation.customerPhoneNumber,
                conversation.customerName,
                conversation.platform,
                conversation.state,
                conversation.priority,
                conversation.gdprRetentionUntil
            ]);
            const conversationId = result.rows[0].id;
            logger_1.default.info('Conversation created', { conversationId });
            return conversationId;
        }
        finally {
            client.release();
        }
    }
    async getBusinessMetrics(businessId, startDate, endDate) {
        const client = await this.pool.connect();
        try {
            const conversationStats = await client.query(`
        SELECT 
          COUNT(*) as total_conversations,
          COUNT(CASE WHEN state = 'completed' THEN 1 END) as completed_conversations,
          COUNT(CASE WHEN priority = 'emergency' THEN 1 END) as emergency_conversations
        FROM conversations 
        WHERE business_id = $1 AND started_at BETWEEN $2 AND $3
      `, [businessId, startDate, endDate]);
            const stats = conversationStats.rows[0];
            const messageStats = await client.query(`
        SELECT COUNT(*) as total_messages
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.business_id = $1 AND m.timestamp BETWEEN $2 AND $3
      `, [businessId, startDate, endDate]);
            const messageCount = messageStats.rows[0].total_messages;
            return {
                businessId,
                period: { start: startDate, end: endDate },
                missedCalls: parseInt(stats.total_conversations) || 0,
                responsesSent: parseInt(messageCount) || 0,
                conversationsStarted: parseInt(stats.total_conversations) || 0,
                conversationsCompleted: parseInt(stats.completed_conversations) || 0,
                conversionRate: stats.total_conversations > 0
                    ? (stats.completed_conversations / stats.total_conversations) * 100
                    : 0,
                averageResponseTime: 2.5,
                platformBreakdown: {
                    whatsapp: parseInt(stats.total_conversations) || 0,
                    viber: 0,
                    telegram: 0,
                    sms: 0,
                    email: 0
                }
            };
        }
        finally {
            client.release();
        }
    }
    async createSession(sessionData) {
        const client = await this.pool.connect();
        try {
            await client.query(`
        INSERT INTO user_sessions (
          user_id, session_id, token_hash, expires_at, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
                sessionData.userId,
                sessionData.id,
                sessionData.tokenHash,
                new Date(sessionData.expiresAt),
                sessionData.ipAddress,
                sessionData.userAgent
            ]);
            await client.query(`
        DELETE FROM user_sessions WHERE expires_at < NOW()
      `);
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
            const result = await this.pool.query(`
        SELECT COUNT(*) as table_count 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
      `);
            return {
                status: 'healthy',
                tables: parseInt(result.rows[0].table_count)
            };
        }
        catch (error) {
            return {
                status: 'unhealthy',
                tables: 0
            };
        }
    }
    async close() {
        await this.pool.end();
        this.isConnected = false;
        logger_1.default.info('Local database connection closed');
    }
}
exports.LocalDatabase = LocalDatabase;
//# sourceMappingURL=LocalModels.js.map