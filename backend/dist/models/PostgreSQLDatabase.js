"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgreSQLDatabase = void 0;
const pg_1 = require("pg");
const config_1 = __importDefault(require("../utils/config"));
const logger_1 = __importDefault(require("../utils/logger"));
class PostgreSQLDatabase {
    constructor() {
        this.isConnected = false;
        this.pool = new pg_1.Pool({
            host: config_1.default.database.postgresql.host,
            port: config_1.default.database.postgresql.port,
            database: config_1.default.database.postgresql.database,
            user: config_1.default.database.postgresql.username,
            password: config_1.default.database.postgresql.password,
            ssl: config_1.default.database.postgresql.ssl ? { rejectUnauthorized: false } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
        this.pool.connect((err, client, release) => {
            if (err) {
                logger_1.default.error('Error connecting to PostgreSQL database:', err);
            }
            else {
                logger_1.default.info('✅ Connected to PostgreSQL database');
                this.isConnected = true;
                release();
                this.initializeTables();
            }
        });
        this.pool.on('error', (err) => {
            logger_1.default.error('Unexpected PostgreSQL pool error:', err);
        });
    }
    async query(text, params) {
        const result = await this.pool.query(text, params);
        return result.rows;
    }
    async getClient() {
        return this.pool.connect();
    }
    async initializeTables() {
        const createTables = `
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'service_provider',
        status TEXT NOT NULL DEFAULT 'active',
        public_id TEXT UNIQUE,
        first_name TEXT,
        last_name TEXT,
        phone_number TEXT,
        business_id TEXT,
        data_retention_until TIMESTAMP,
        is_gdpr_compliant BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- GDPR Consents table
      CREATE TABLE IF NOT EXISTS gdpr_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        consent_type TEXT NOT NULL,
        granted BOOLEAN NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        withdrawn_at TIMESTAMP,
        legal_basis TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- Business metrics table
      CREATE TABLE IF NOT EXISTS business_metrics (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        date DATE NOT NULL,
        total_calls INTEGER DEFAULT 0,
        missed_calls INTEGER DEFAULT 0,
        answered_calls INTEGER DEFAULT 0,
        sms_sent INTEGER DEFAULT 0,
        conversations_started INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- Service provider profiles table
      CREATE TABLE IF NOT EXISTS service_provider_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        business_name TEXT,
        service_category TEXT NOT NULL,
        description TEXT,
        experience_years INTEGER,
        hourly_rate DECIMAL(10,2),
        city TEXT NOT NULL,
        neighborhood TEXT,
        address TEXT,
        latitude DECIMAL(10,8),
        longitude DECIMAL(11,8),
        phone_number TEXT,
        email TEXT,
        website_url TEXT,
        profile_image_url TEXT,
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        rating DECIMAL(3,2) DEFAULT 0.0,
        total_reviews INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- Provider gallery images
      CREATE TABLE IF NOT EXISTS provider_gallery (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- Provider certificates
      CREATE TABLE IF NOT EXISTS provider_certificates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        file_url TEXT,
        issued_by TEXT,
        issued_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      );

      -- Service categories table
      CREATE TABLE IF NOT EXISTS service_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        name_bg TEXT NOT NULL,
        description TEXT,
        icon_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Service provider services table
      CREATE TABLE IF NOT EXISTS provider_services (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        service_name TEXT NOT NULL,
        service_name_bg TEXT NOT NULL,
        price_from DECIMAL(10,2),
        price_to DECIMAL(10,2),
        unit TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id) ON DELETE CASCADE
      );

      -- Reviews and ratings table
      CREATE TABLE IF NOT EXISTS provider_reviews (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        communication INTEGER CHECK (communication >= 1 AND communication <= 5),
        quality INTEGER CHECK (quality >= 1 AND quality <= 5),
        timeliness INTEGER CHECK (timeliness >= 1 AND timeliness <= 5),
        value_for_money INTEGER CHECK (value_for_money >= 1 AND value_for_money <= 5),
        would_recommend BOOLEAN,
        review_text TEXT,
        service_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id) ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users (id) ON DELETE SET NULL
      );

      -- Marketplace inquiries/bookings table
      CREATE TABLE IF NOT EXISTS marketplace_inquiries (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        customer_email TEXT,
        service_needed TEXT NOT NULL,
        description TEXT,
        preferred_date TIMESTAMP,
        city TEXT NOT NULL,
        neighborhood TEXT,
        address TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id) ON DELETE CASCADE
      );

      -- Marketplace Chat Conversations
      CREATE TABLE IF NOT EXISTS marketplace_conversations (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT,
        status TEXT DEFAULT 'active',
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (user_id) ON DELETE CASCADE
      );

      -- Marketplace chat messages table
      CREATE TABLE IF NOT EXISTS marketplace_chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'provider')),
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'case_template', 'service_request', 'case_created', 'case_filled', 'survey')),
        is_read BOOLEAN DEFAULT FALSE,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id) ON DELETE CASCADE
      );

      -- Case templates table
      CREATE TABLE IF NOT EXISTS case_templates (
        id TEXT PRIMARY KEY,
        service_category TEXT NOT NULL,
        template_name TEXT NOT NULL,
        template_data TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- Service cases table
      CREATE TABLE IF NOT EXISTS service_cases (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        provider_id TEXT,
        case_data TEXT NOT NULL,
        status TEXT DEFAULT 'template_sent' CHECK (status IN ('template_sent', 'filled_by_customer', 'pending_provider', 'accepted', 'declined', 'in_queue', 'assigned', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        city TEXT,
        neighborhood TEXT,
        estimated_cost DECIMAL(10,2),
        estimated_duration INTEGER,
        scheduled_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_at TIMESTAMP,
        completed_at TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES case_templates(id),
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Case queue table
      CREATE TABLE IF NOT EXISTS case_queue (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        original_provider_id TEXT NOT NULL,
        queue_position INTEGER,
        available_to_all BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
        FOREIGN KEY (original_provider_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Case assignments tracking
      CREATE TABLE IF NOT EXISTS case_assignments (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        status TEXT DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'expired')),
        offered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        responded_at TIMESTAMP,
        expires_at TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES service_cases(id) ON DELETE CASCADE,
        FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Service Provider Identifiers Table
      CREATE TABLE IF NOT EXISTS service_provider_identifiers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        identifier TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Chat Tokens Table
      CREATE TABLE IF NOT EXISTS chat_tokens (
        id TEXT PRIMARY KEY,
        token TEXT UNIQUE NOT NULL,
        user_id TEXT NOT NULL,
        sp_identifier TEXT NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        conversation_id TEXT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Chat Sessions Table
      CREATE TABLE IF NOT EXISTS chat_sessions (
        session_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        sp_identifier TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- SP Referrals Table
      CREATE TABLE IF NOT EXISTS sp_referrals (
        id TEXT PRIMARY KEY,
        referrer_user_id TEXT NOT NULL,
        referred_user_id TEXT NOT NULL,
        referral_code TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        activated_at TIMESTAMP NULL,
        FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Referral Clicks Table
      CREATE TABLE IF NOT EXISTS referral_clicks (
        id TEXT PRIMARY KEY,
        referral_id TEXT NOT NULL,
        customer_user_id TEXT,
        visitor_id TEXT,
        customer_ip TEXT,
        customer_user_agent TEXT,
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_valid BOOLEAN DEFAULT TRUE,
        month_year TEXT NOT NULL,
        FOREIGN KEY (referral_id) REFERENCES sp_referrals(id) ON DELETE CASCADE
      );

      -- Referral Rewards Table
      CREATE TABLE IF NOT EXISTS referral_rewards (
        id TEXT PRIMARY KEY,
        referrer_user_id TEXT NOT NULL,
        referral_id TEXT NOT NULL,
        reward_type TEXT NOT NULL,
        reward_value DECIMAL(3,2) NOT NULL,
        clicks_required INTEGER NOT NULL,
        clicks_achieved INTEGER NOT NULL,
        earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        applied_at TIMESTAMP NULL,
        expires_at TIMESTAMP NOT NULL,
        status TEXT NOT NULL DEFAULT 'earned',
        FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (referral_id) REFERENCES sp_referrals(id) ON DELETE CASCADE
      );

      -- Referral Codes Table
      CREATE TABLE IF NOT EXISTS sp_referral_codes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        referral_code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Marketplace Service Cases Table
      CREATE TABLE IF NOT EXISTS marketplace_service_cases (
        id TEXT PRIMARY KEY,
        service_type TEXT NOT NULL,
        description TEXT NOT NULL,
        preferred_date TEXT,
        preferred_time TEXT DEFAULT 'morning',
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'urgent')),
        city TEXT,
        neighborhood TEXT,
        phone TEXT NOT NULL,
        additional_details TEXT,
        provider_id TEXT,
        customer_id TEXT,
        customer_name TEXT,
        customer_email TEXT,
        customer_phone TEXT,
        provider_name TEXT,
        is_open_case BOOLEAN DEFAULT FALSE,
        assignment_type TEXT DEFAULT 'open' CHECK (assignment_type IN ('open', 'specific')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
        decline_reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE SET NULL
      );

      -- Case Screenshots Table
      CREATE TABLE IF NOT EXISTS case_screenshots (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id) ON DELETE CASCADE
      );

      -- SMS Settings Table
      CREATE TABLE IF NOT EXISTS sms_settings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        is_enabled BOOLEAN DEFAULT FALSE,
        message_template TEXT DEFAULT 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
        last_sent_time BIGINT,
        sent_count INTEGER DEFAULT 0,
        sent_call_ids TEXT DEFAULT '[]',
        filter_known_contacts BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Notifications Table
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Create indexes for better performance
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_provider_profiles_user_id ON service_provider_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_provider_profiles_city ON service_provider_profiles(city);
      CREATE INDEX IF NOT EXISTS idx_provider_profiles_category ON service_provider_profiles(service_category);
      CREATE INDEX IF NOT EXISTS idx_conversations_provider ON marketplace_conversations(provider_id);
      CREATE INDEX IF NOT EXISTS idx_conversations_customer ON marketplace_conversations(customer_id);
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON marketplace_chat_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_messages_sent_at ON marketplace_chat_messages(sent_at);
      CREATE INDEX IF NOT EXISTS idx_cases_provider ON marketplace_service_cases(provider_id);
      CREATE INDEX IF NOT EXISTS idx_cases_customer ON marketplace_service_cases(customer_id);
      CREATE INDEX IF NOT EXISTS idx_cases_status ON marketplace_service_cases(status);
      CREATE INDEX IF NOT EXISTS idx_sms_settings_user_id ON sms_settings(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_tokens_user_id ON chat_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_tokens_token ON chat_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
      CREATE INDEX IF NOT EXISTS idx_reviews_provider ON provider_reviews(provider_id);
    `;
        try {
            await this.pool.query(createTables);
            logger_1.default.info('✅ PostgreSQL database tables initialized');
        }
        catch (err) {
            logger_1.default.error('Error creating PostgreSQL tables:', err);
        }
    }
    async close() {
        await this.pool.end();
        this.isConnected = false;
        logger_1.default.info('PostgreSQL connection pool closed');
    }
    async findUserByEmail(email) {
        try {
            const result = await this.pool.query('SELECT * FROM users WHERE email = $1 AND status != $2', [email, 'deleted']);
            if (result.rows.length === 0) {
                return null;
            }
            const consents = await this.getGDPRConsentsForUser(result.rows[0].id);
            return this.mapUserFromDatabase(result.rows[0], consents);
        }
        catch (error) {
            logger_1.default.error('Error finding user by email:', error);
            throw error;
        }
    }
    async findUserById(id) {
        try {
            const result = await this.pool.query('SELECT * FROM users WHERE id = $1 AND status != $2', [id, 'deleted']);
            if (result.rows.length === 0) {
                return null;
            }
            const consents = await this.getGDPRConsentsForUser(result.rows[0].id);
            return this.mapUserFromDatabase(result.rows[0], consents);
        }
        catch (error) {
            logger_1.default.error('Error finding user by ID:', error);
            throw error;
        }
    }
    async createUser(user) {
        try {
            const userId = user.id || this.generateId();
            const publicId = await this.generateUniquePublicId();
            await this.pool.query(`INSERT INTO users (
          id, email, password_hash, role, status, public_id, first_name, last_name,
          phone_number, business_id, data_retention_until, is_gdpr_compliant,
          created_at, last_login_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`, [
                userId, user.email, user.passwordHash, user.role, user.status, publicId,
                user.firstName, user.lastName, user.phoneNumber, user.businessId,
                user.dataRetentionUntil, user.isGdprCompliant, user.createdAt,
                user.lastLoginAt, user.updatedAt
            ]);
            return userId;
        }
        catch (error) {
            logger_1.default.error('Error creating user:', error);
            throw error;
        }
    }
    async updateUser(user) {
        try {
            await this.pool.query(`UPDATE users SET 
          email = $1, password_hash = $2, role = $3, status = $4,
          first_name = $5, last_name = $6, phone_number = $7,
          business_id = $8, data_retention_until = $9,
          is_gdpr_compliant = $10, last_login_at = $11, updated_at = $12
        WHERE id = $13`, [
                user.email, user.passwordHash, user.role, user.status,
                user.firstName, user.lastName, user.phoneNumber, user.businessId,
                user.dataRetentionUntil, user.isGdprCompliant, user.lastLoginAt,
                user.updatedAt, user.id
            ]);
        }
        catch (error) {
            logger_1.default.error('Error updating user:', error);
            throw error;
        }
    }
    async getGDPRConsentsForUser(userId) {
        try {
            const result = await this.pool.query('SELECT * FROM gdpr_consents WHERE user_id = $1 ORDER BY timestamp DESC', [userId]);
            return result.rows.map(row => ({
                id: row.id,
                userId: row.user_id,
                consentType: row.consent_type,
                granted: Boolean(row.granted),
                timestamp: new Date(row.timestamp),
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at) : undefined,
                legalBasis: row.legal_basis
            }));
        }
        catch (error) {
            logger_1.default.error('Error getting GDPR consents:', error);
            return [];
        }
    }
    mapUserFromDatabase(row, consents) {
        return {
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            role: row.role,
            status: row.status,
            firstName: row.first_name,
            lastName: row.last_name,
            phoneNumber: row.phone_number,
            businessId: row.business_id,
            dataRetentionUntil: new Date(row.data_retention_until),
            isGdprCompliant: Boolean(row.is_gdpr_compliant),
            createdAt: new Date(row.created_at),
            lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
            gdprConsents: consents,
            updatedAt: new Date(row.updated_at)
        };
    }
    generateId() {
        return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    generatePublicIdCandidate() {
        const uppers = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const lowers = 'abcdefghijklmnopqrstuvwxyz';
        const digits = '0123456789';
        const symbols = '-_';
        const pick = (s) => s.charAt(Math.floor(Math.random() * s.length));
        const chars = [pick(uppers), pick(lowers), pick(digits), pick(symbols)];
        for (let i = chars.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [chars[i], chars[j]] = [chars[j], chars[i]];
        }
        return chars.join('');
    }
    async isPublicIdUnique(publicId) {
        try {
            const result = await this.pool.query('SELECT 1 FROM users WHERE public_id = $1 LIMIT 1', [publicId]);
            return result.rows.length === 0;
        }
        catch (error) {
            return false;
        }
    }
    async generateUniquePublicId(maxAttempts = 50) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const candidate = this.generatePublicIdCandidate();
            if (!/^[A-Za-z0-9\-_]{4}$/.test(candidate))
                continue;
            if (!/[A-Z]/.test(candidate) || !/[a-z]/.test(candidate) || !/[0-9]/.test(candidate) || !/[-_]/.test(candidate))
                continue;
            const unique = await this.isPublicIdUnique(candidate);
            if (unique)
                return candidate;
        }
        return (Math.random().toString(36) + Math.random().toString(36)).replace(/[^A-Za-z0-9]/g, '').slice(0, 2) + '-_';
    }
    async ensureUserPublicId(userId) {
        try {
            const result = await this.pool.query('SELECT public_id FROM users WHERE id = $1', [userId]);
            if (result.rows.length > 0 && result.rows[0].public_id) {
                return result.rows[0].public_id;
            }
            const publicId = await this.generateUniquePublicId();
            await this.pool.query('UPDATE users SET public_id = $1 WHERE id = $2', [publicId, userId]);
            return publicId;
        }
        catch (error) {
            logger_1.default.error('Error ensuring user public ID:', error);
            throw error;
        }
    }
    async getUserIdByPublicId(publicId) {
        try {
            const result = await this.pool.query('SELECT id FROM users WHERE public_id = $1', [publicId]);
            return result.rows.length > 0 ? result.rows[0].id : null;
        }
        catch (error) {
            logger_1.default.error('Error getting user ID by public ID:', error);
            return null;
        }
    }
    get db() {
        return {
            query: this.query.bind(this),
            get: async (sql, params, callback) => {
                try {
                    let paramIndex = 0;
                    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
                    const result = await this.pool.query(pgSql, params);
                    callback(null, result.rows[0] || null);
                }
                catch (err) {
                    callback(err, null);
                }
            },
            all: async (sql, params, callback) => {
                try {
                    let paramIndex = 0;
                    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
                    const result = await this.pool.query(pgSql, params);
                    callback(null, result.rows);
                }
                catch (err) {
                    callback(err, []);
                }
            },
            run: async (sql, params, callback) => {
                try {
                    if (typeof params === 'function') {
                        callback = params;
                        params = [];
                    }
                    let paramIndex = 0;
                    const pgSql = sql.replace(/\?/g, () => `$${++paramIndex}`);
                    await this.pool.query(pgSql, params || []);
                    if (callback)
                        callback(null);
                }
                catch (err) {
                    if (callback)
                        callback(err);
                }
            }
        };
    }
    async getAllUserConversations(userId) {
        try {
            const userResult = await this.pool.query(`SELECT email FROM users WHERE id = $1`, [userId]);
            const userEmail = userResult.rows[0]?.email;
            const result = await this.pool.query(`SELECT 
           c.*,
           COUNT(m.id) as message_count,
           COUNT(CASE WHEN m.is_read = false THEN 1 END) as unread_count,
           COALESCE(sp.business_name, u.first_name || ' ' || u.last_name) as service_provider_name,
           sp.service_category
         FROM marketplace_conversations c
         LEFT JOIN marketplace_chat_messages m ON c.id = m.conversation_id
         LEFT JOIN service_provider_profiles sp ON c.provider_id = sp.user_id
         LEFT JOIN users u ON c.provider_id = u.id
         WHERE c.provider_id = $1 
            OR c.customer_id = $2 
            OR (c.customer_email = $3 AND c.customer_email IS NOT NULL AND c.customer_email != '')
         GROUP BY c.id, sp.business_name, sp.service_category, u.first_name, u.last_name
         ORDER BY c.last_message_at DESC NULLS LAST, c.created_at DESC`, [userId, userId, userEmail]);
            return result.rows || [];
        }
        catch (error) {
            console.error('Error getting user conversations:', error);
            return [];
        }
    }
    async createOrUpdateProviderProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            this.db.get(`SELECT id, is_active FROM service_provider_profiles WHERE user_id = ?`, [userId], (err, existingProfile) => {
                if (err) {
                    reject(err);
                    return;
                }
                const id = existingProfile?.id || this.generateId();
                const isActive = profileData.isActive !== undefined
                    ? (profileData.isActive ? 1 : 0)
                    : (existingProfile?.is_active !== undefined ? existingProfile.is_active : 1);
                this.db.run(`INSERT INTO service_provider_profiles (
              id, user_id, business_name, service_category, description,
              experience_years, hourly_rate, city, neighborhood, address,
              latitude, longitude, phone_number, email, website_url,
              profile_image_url, is_verified, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) DO UPDATE SET
              business_name = EXCLUDED.business_name,
              service_category = EXCLUDED.service_category,
              description = EXCLUDED.description,
              experience_years = EXCLUDED.experience_years,
              hourly_rate = EXCLUDED.hourly_rate,
              city = EXCLUDED.city,
              neighborhood = EXCLUDED.neighborhood,
              address = EXCLUDED.address,
              latitude = EXCLUDED.latitude,
              longitude = EXCLUDED.longitude,
              phone_number = EXCLUDED.phone_number,
              email = EXCLUDED.email,
              website_url = EXCLUDED.website_url,
              profile_image_url = EXCLUDED.profile_image_url,
              is_verified = EXCLUDED.is_verified,
              is_active = EXCLUDED.is_active,
              updated_at = CURRENT_TIMESTAMP`, [
                    id, userId, profileData.businessName, profileData.serviceCategory,
                    profileData.description, profileData.experienceYears, profileData.hourlyRate,
                    profileData.city, profileData.neighborhood, profileData.address,
                    profileData.latitude, profileData.longitude, profileData.phoneNumber,
                    profileData.email, profileData.websiteUrl, profileData.profileImageUrl,
                    profileData.isVerified ? 1 : 0, isActive
                ], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        });
    }
    async replaceProviderGallery(userId, imageUrls) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.pool.query('DELETE FROM provider_gallery WHERE user_id = $1', [userId]);
                for (const url of imageUrls || []) {
                    await this.pool.query('INSERT INTO provider_gallery (id, user_id, image_url) VALUES ($1, $2, $3)', [this.generateId(), userId, url]);
                }
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async replaceProviderCertificates(userId, certificates) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.pool.query('DELETE FROM provider_certificates WHERE user_id = $1', [userId]);
                for (const c of certificates || []) {
                    await this.pool.query('INSERT INTO provider_certificates (id, user_id, title, file_url, issued_by, issued_at) VALUES ($1, $2, $3, $4, $5, $6)', [this.generateId(), userId, c.title || null, c.fileUrl || null, c.issuedBy || null, c.issuedAt || null]);
                }
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async getSMSSettings(userId) {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.pool.query('SELECT * FROM sms_settings WHERE user_id = $1', [userId]);
                if (result.rows.length > 0) {
                    const row = result.rows[0];
                    resolve({
                        id: row.id,
                        userId: row.user_id,
                        isEnabled: Boolean(row.is_enabled),
                        message: row.message_template,
                        lastSentTime: row.last_sent_time,
                        sentCount: row.sent_count,
                        sentCallIds: JSON.parse(row.sent_call_ids || '[]'),
                        filterKnownContacts: Boolean(row.filter_known_contacts),
                        createdAt: row.created_at,
                        updatedAt: row.updated_at
                    });
                }
                else {
                    const id = this.generateId();
                    await this.pool.query('INSERT INTO sms_settings (id, user_id) VALUES ($1, $2)', [id, userId]);
                    resolve({
                        id,
                        userId,
                        isEnabled: false,
                        message: 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
                        lastSentTime: null,
                        sentCount: 0,
                        sentCallIds: [],
                        filterKnownContacts: true,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    });
                }
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async updateSMSSettings(userId, updates) {
        return new Promise(async (resolve, reject) => {
            try {
                const fields = [];
                const values = [];
                let paramCount = 1;
                if (updates.isEnabled !== undefined) {
                    fields.push(`is_enabled = $${paramCount++}`);
                    values.push(updates.isEnabled);
                }
                if (updates.message !== undefined) {
                    fields.push(`message_template = $${paramCount++}`);
                    values.push(updates.message);
                }
                if (updates.lastSentTime !== undefined) {
                    fields.push(`last_sent_time = $${paramCount++}`);
                    values.push(updates.lastSentTime);
                }
                if (updates.sentCount !== undefined) {
                    fields.push(`sent_count = $${paramCount++}`);
                    values.push(updates.sentCount);
                }
                if (updates.sentCallIds !== undefined) {
                    fields.push(`sent_call_ids = $${paramCount++}`);
                    values.push(JSON.stringify(updates.sentCallIds));
                }
                if (updates.filterKnownContacts !== undefined) {
                    fields.push(`filter_known_contacts = $${paramCount++}`);
                    values.push(updates.filterKnownContacts);
                }
                if (fields.length === 0) {
                    resolve();
                    return;
                }
                fields.push('updated_at = CURRENT_TIMESTAMP');
                values.push(userId);
                await this.pool.query(`UPDATE sms_settings SET ${fields.join(', ')} WHERE user_id = $${paramCount}`, values);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async clearSMSHistory(userId) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.pool.query(`UPDATE sms_settings 
           SET sent_call_ids = '[]', updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1`, [userId]);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async createOrGetConversation(data) {
        try {
            console.log('🔍 PostgreSQL createOrGetConversation - Received data:', JSON.stringify(data, null, 2));
            let query;
            let params;
            if (data.customerId) {
                query = `SELECT id, customer_id, customer_name FROM marketplace_conversations 
                 WHERE provider_id = $1 AND (
                   customer_id = $2 OR 
                   (customer_id IS NULL AND customer_email = $3) OR
                   (customer_id IS NULL AND (customer_email = '' OR customer_email IS NULL))
                 )
                 ORDER BY 
                   CASE WHEN customer_id = $4 THEN 1 
                        WHEN customer_id IS NULL AND customer_email = $5 THEN 2
                        WHEN customer_id IS NULL THEN 3 
                        ELSE 4 
                   END,
                   created_at DESC 
                 LIMIT 1`;
                params = [data.providerId, data.customerId, data.customerEmail, data.customerId, data.customerEmail];
            }
            else {
                query = `SELECT id FROM marketplace_conversations 
                 WHERE provider_id = $1 AND customer_email = $2`;
                params = [data.providerId, data.customerEmail];
            }
            console.log('🔍 Executing query with params:', params);
            const existingConv = await this.pool.query(query, params);
            if (existingConv.rows.length > 0) {
                const conversationId = existingConv.rows[0].id;
                console.log('✅ Found existing conversation:', conversationId);
                if (data.customerId && (!existingConv.rows[0].customer_id || existingConv.rows[0].customer_name === 'Chat Customer')) {
                    console.log('🔄 Updating conversation with authenticated user info...');
                    await this.pool.query(`UPDATE marketplace_conversations 
             SET customer_id = $1, customer_name = $2, customer_email = $3, customer_phone = $4
             WHERE id = $5`, [data.customerId, data.customerName, data.customerEmail, data.customerPhone, conversationId]);
                    console.log('✅ Updated conversation with user:', data.customerId, data.customerName);
                    const welcomeMessage = 'Здравейте! Извинявам се, че пропуснах обаждането Ви. Ще Ви се обадя възможно най-скоро.\n\nАко не Ви е трудно, моля опишете проблема тук и ще Ви отговоря при първа възможност. Благодаря за разбирането! 🙏';
                    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    await this.pool.query(`INSERT INTO marketplace_chat_messages (
              id, conversation_id, sender_type, sender_name, message, message_type, sent_at
            ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)`, [messageId, conversationId, 'provider', 'Специалист', welcomeMessage, 'text']);
                    console.log('✅ Sent welcome message to conversation:', conversationId);
                }
                return conversationId;
            }
            const conversationId = this.generateId();
            await this.pool.query(`INSERT INTO marketplace_conversations (
          id, provider_id, customer_id, customer_name, customer_email, customer_phone
        ) VALUES ($1, $2, $3, $4, $5, $6)`, [conversationId, data.providerId, data.customerId || null, data.customerName, data.customerEmail, data.customerPhone]);
            console.log('✅ Created new marketplace conversation:', conversationId);
            return conversationId;
        }
        catch (error) {
            console.log('❌ Error in createOrGetConversation:', error);
            throw error;
        }
    }
    async getConversationMessages(conversationId, limit = 50) {
        try {
            const result = await this.pool.query(`SELECT 
          id,
          conversation_id as "conversationId",
          sender_type as "senderType",
          sender_name as "senderName",
          message,
          message_type as "messageType",
          is_read as "isRead",
          sent_at as "timestamp"
         FROM marketplace_chat_messages 
         WHERE conversation_id = $1 
         ORDER BY sent_at ASC 
         LIMIT $2`, [conversationId, limit]);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error in getConversationMessages:', error);
            throw error;
        }
    }
    async getProviderConversations(providerId) {
        try {
            const result = await this.pool.query(`SELECT c.*, 
                COUNT(m.id) as message_count,
                (SELECT message FROM marketplace_chat_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message
         FROM marketplace_conversations c
         LEFT JOIN marketplace_chat_messages m ON c.id = m.conversation_id
         WHERE c.provider_id = $1
         GROUP BY c.id
         ORDER BY c.last_message_at DESC`, [providerId]);
            return result.rows;
        }
        catch (error) {
            console.error('❌ Error in getProviderConversations:', error);
            throw error;
        }
    }
    async getConversationDetails(conversationId) {
        try {
            const result = await this.pool.query(`SELECT c.*, 
                p.business_name as provider_business_name,
                u.first_name as provider_first_name,
                u.last_name as provider_last_name
         FROM marketplace_conversations c
         LEFT JOIN service_provider_profiles p ON c.provider_id = p.user_id
         LEFT JOIN users u ON c.provider_id = u.id
         WHERE c.id = $1`, [conversationId]);
            return result.rows[0] || null;
        }
        catch (error) {
            console.error('❌ Error in getConversationDetails:', error);
            throw error;
        }
    }
    async sendMessage(data) {
        try {
            const messageId = this.generateId();
            await this.pool.query(`INSERT INTO marketplace_chat_messages (
          id, conversation_id, sender_type, sender_name, message, message_type
        ) VALUES ($1, $2, $3, $4, $5, $6)`, [
                messageId,
                data.conversationId,
                data.senderType,
                data.senderName,
                data.message,
                data.messageType || 'text'
            ]);
            await this.pool.query(`UPDATE marketplace_conversations 
         SET last_message_at = CURRENT_TIMESTAMP 
         WHERE id = $1`, [data.conversationId]);
            return messageId;
        }
        catch (error) {
            console.error('❌ Error in sendMessage:', error);
            throw error;
        }
    }
    async markMessagesAsRead(conversationId, senderType) {
        try {
            const otherSenderType = senderType === 'customer' ? 'provider' : 'customer';
            await this.pool.query(`UPDATE marketplace_chat_messages 
         SET is_read = TRUE 
         WHERE conversation_id = $1 AND sender_type = $2 AND is_read = FALSE`, [conversationId, otherSenderType]);
        }
        catch (error) {
            console.error('❌ Error in markMessagesAsRead:', error);
            throw error;
        }
    }
}
exports.PostgreSQLDatabase = PostgreSQLDatabase;
exports.default = PostgreSQLDatabase;
//# sourceMappingURL=PostgreSQLDatabase.js.map