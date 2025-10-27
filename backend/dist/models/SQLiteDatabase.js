"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SQLiteDatabase = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const path_1 = __importDefault(require("path"));
class SQLiteDatabase {
    get db() {
        return this._db;
    }
    constructor() {
        this.isConnected = false;
        const dbPath = path_1.default.join(process.cwd(), 'data', 'servicetext_pro.db');
        this._db = new sqlite3_1.default.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening SQLite database:', err);
                console.error('Attempted path:', dbPath);
            }
            else {
                console.log('✅ Connected to SQLite database at:', dbPath);
                this.isConnected = true;
                this.initializeTables();
            }
        });
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
        data_retention_until DATETIME,
        is_gdpr_compliant BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- GDPR Consents table
      CREATE TABLE IF NOT EXISTS gdpr_consents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        consent_type TEXT NOT NULL,
        granted BOOLEAN NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT,
        withdrawn_at DATETIME,
        legal_basis TEXT,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Legacy tables removed - using unified marketplace_conversations and marketplace_chat_messages

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Service provider profiles table (for marketplace)
      CREATE TABLE IF NOT EXISTS service_provider_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL UNIQUE,
        business_name TEXT,
        service_category TEXT NOT NULL, -- electrician, plumber, etc.
        description TEXT,
        experience_years INTEGER,
        hourly_rate REAL,
        city TEXT NOT NULL,
        neighborhood TEXT,
        address TEXT,
        latitude REAL,
        longitude REAL,
        phone_number TEXT,
        email TEXT,
        website_url TEXT,
        profile_image_url TEXT,
        is_verified BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        rating REAL DEFAULT 0.0,
        total_reviews INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Provider gallery images
      CREATE TABLE IF NOT EXISTS provider_gallery (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Provider certificates
      CREATE TABLE IF NOT EXISTS provider_certificates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT,
        file_url TEXT,
        issued_by TEXT,
        issued_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );

      -- Service categories table
      CREATE TABLE IF NOT EXISTS service_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        name_bg TEXT NOT NULL, -- Bulgarian name
        description TEXT,
        icon_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Service provider services table (many-to-many)
      CREATE TABLE IF NOT EXISTS provider_services (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        service_name TEXT NOT NULL,
        service_name_bg TEXT NOT NULL,
        price_from REAL,
        price_to REAL,
        unit TEXT, -- per hour, per job, per m2, etc.
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id)
      );

      -- Reviews and ratings table
      CREATE TABLE IF NOT EXISTS provider_reviews (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT,
        service_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT 0,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id)
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
        preferred_date DATETIME,
        city TEXT NOT NULL,
        neighborhood TEXT,
        address TEXT,
        status TEXT NOT NULL DEFAULT 'pending', -- pending, accepted, declined, completed
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (id)
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
        last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES service_provider_profiles (user_id)
      );

      -- Marketplace chat messages table
      CREATE TABLE IF NOT EXISTS marketplace_chat_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_type TEXT NOT NULL CHECK (sender_type IN ('customer', 'provider')),
        sender_name TEXT NOT NULL,
        message TEXT NOT NULL,
        message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'system', 'case_template', 'service_request', 'case_created', 'case_filled')),
        is_read INTEGER DEFAULT 0,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id)
      );

      -- Case templates table
      CREATE TABLE IF NOT EXISTS case_templates (
        id TEXT PRIMARY KEY,
        service_category TEXT NOT NULL,
        template_name TEXT NOT NULL,
        template_data TEXT NOT NULL, -- JSON structure for form fields
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Service cases table
      CREATE TABLE IF NOT EXISTS service_cases (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        customer_id TEXT NOT NULL,
        provider_id TEXT,
        case_data TEXT NOT NULL, -- JSON with customer responses
        status TEXT DEFAULT 'template_sent' CHECK (status IN ('template_sent', 'filled_by_customer', 'pending_provider', 'accepted', 'declined', 'in_queue', 'assigned', 'in_progress', 'completed', 'cancelled')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        city TEXT,
        neighborhood TEXT,
        estimated_cost DECIMAL(10,2),
        estimated_duration INTEGER, -- in minutes
        scheduled_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_at DATETIME,
        completed_at DATETIME,
        FOREIGN KEY (conversation_id) REFERENCES marketplace_conversations(id),
        FOREIGN KEY (template_id) REFERENCES case_templates(id),
        FOREIGN KEY (customer_id) REFERENCES users(id),
        FOREIGN KEY (provider_id) REFERENCES users(id)
      );

      -- Case queue table for declined cases
      CREATE TABLE IF NOT EXISTS case_queue (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        original_provider_id TEXT NOT NULL,
        queue_position INTEGER,
        available_to_all INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (case_id) REFERENCES service_cases(id),
        FOREIGN KEY (original_provider_id) REFERENCES users(id)
      );

      -- Case assignments tracking
      CREATE TABLE IF NOT EXISTS case_assignments (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        status TEXT DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'expired')),
        offered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        responded_at DATETIME,
        expires_at DATETIME,
        FOREIGN KEY (case_id) REFERENCES service_cases(id),
        FOREIGN KEY (provider_id) REFERENCES users(id)
      );

      -- Service Provider Identifiers Table
      -- Stores unique identifiers for each service provider (e.g., k1N_)
      CREATE TABLE IF NOT EXISTS service_provider_identifiers (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          identifier TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Chat Tokens Table
      -- Stores dynamic tokens for chat sessions with automatic lifecycle management
      CREATE TABLE IF NOT EXISTS chat_tokens (
          id TEXT PRIMARY KEY,
          token TEXT UNIQUE NOT NULL,
          user_id TEXT NOT NULL,
          sp_identifier TEXT NOT NULL,
          is_used INTEGER DEFAULT 0,
          used_at DATETIME NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          conversation_id TEXT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Chat Sessions Table
      -- Stores permanent chat sessions created from token validation
      CREATE TABLE IF NOT EXISTS chat_sessions (
          session_id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          sp_identifier TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Referral System Tables
      
      -- SP Referrals Table - tracks who referred whom
      CREATE TABLE IF NOT EXISTS sp_referrals (
          id TEXT PRIMARY KEY,
          referrer_user_id TEXT NOT NULL, -- SP who made the referral
          referred_user_id TEXT NOT NULL, -- SP who was referred
          referral_code TEXT UNIQUE NOT NULL, -- unique code for the referral link
          status TEXT NOT NULL DEFAULT 'pending', -- pending, active, inactive
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          activated_at DATETIME NULL, -- when referred SP became active/verified
          FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Referral Clicks Table - tracks customer clicks on referred SP profiles
      CREATE TABLE IF NOT EXISTS referral_clicks (
          id TEXT PRIMARY KEY,
          referral_id TEXT NOT NULL, -- links to sp_referrals
          customer_user_id TEXT, -- for registered users
          visitor_id TEXT, -- for non-registered users (cookie-based)
          customer_ip TEXT, -- kept for additional fraud detection
          customer_user_agent TEXT,
          clicked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          is_valid BOOLEAN DEFAULT 1, -- false if detected as fraud/self-click
          month_year TEXT NOT NULL, -- format: YYYY-MM for monthly limits
          FOREIGN KEY (referral_id) REFERENCES sp_referrals(id) ON DELETE CASCADE
      );

      -- Referral Rewards Table - tracks earned rewards and discounts
      CREATE TABLE IF NOT EXISTS referral_rewards (
          id TEXT PRIMARY KEY,
          referrer_user_id TEXT NOT NULL,
          referral_id TEXT NOT NULL,
          reward_type TEXT NOT NULL, -- 'discount_10', 'discount_50', 'free_month'
          reward_value REAL NOT NULL, -- 0.1, 0.5, 1.0
          clicks_required INTEGER NOT NULL, -- 50, 100, 500
          clicks_achieved INTEGER NOT NULL,
          earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          applied_at DATETIME NULL, -- when discount was used
          expires_at DATETIME NOT NULL, -- reward expiration
          status TEXT NOT NULL DEFAULT 'earned', -- earned, applied, expired
          FOREIGN KEY (referrer_user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (referral_id) REFERENCES sp_referrals(id) ON DELETE CASCADE
      );

      -- Referral Codes Table - stores unique referral codes for each SP
      CREATE TABLE IF NOT EXISTS sp_referral_codes (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          referral_code TEXT UNIQUE NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      -- Marketplace Service Cases Table (for direct case creation)
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
          provider_name TEXT,
          is_open_case INTEGER DEFAULT 0,
          assignment_type TEXT DEFAULT 'open' CHECK (assignment_type IN ('open', 'specific')),
          status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed', 'cancelled')),
          decline_reason TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (provider_id) REFERENCES users(id)
      );

      -- Case Screenshots Table
      CREATE TABLE IF NOT EXISTS case_screenshots (
          id TEXT PRIMARY KEY,
          case_id TEXT NOT NULL,
          image_url TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (case_id) REFERENCES marketplace_service_cases(id) ON DELETE CASCADE
      );

      -- SMS Settings Table (synchronized between mobile app and web app)
      CREATE TABLE IF NOT EXISTS sms_settings (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          is_enabled INTEGER DEFAULT 0,
          message_template TEXT DEFAULT 'Zaet sum, shte vurna obajdane sled nqkolko minuti.\n\nZapochnete chat tuk:\n[chat_link]\n\n',
          last_sent_time INTEGER,
          sent_count INTEGER DEFAULT 0,
          sent_call_ids TEXT DEFAULT '[]',
          filter_known_contacts INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sms_settings_user_id ON sms_settings(user_id);

    `;
        this._db.exec(createTables, (err) => {
            if (err) {
                console.error('Error creating tables:', err);
            }
            else {
                console.log('✅ Database tables initialized');
            }
        });
        this.ensureUserPublicIdColumn();
    }
    async findUserByEmail(email) {
        return new Promise((resolve, reject) => {
            this._db.get('SELECT * FROM users WHERE email = ? AND status != "deleted"', [email], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                this.getGDPRConsentsForUser(row.id).then(consents => {
                    resolve(this.mapUserFromDatabase(row, consents));
                }).catch(reject);
            });
        });
    }
    async findUserById(id) {
        return new Promise((resolve, reject) => {
            this._db.get('SELECT * FROM users WHERE id = ? AND status != "deleted"', [id], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                this.getGDPRConsentsForUser(row.id).then(consents => {
                    resolve(this.mapUserFromDatabase(row, consents));
                }).catch(reject);
            });
        });
    }
    async createUser(user) {
        return new Promise((resolve, reject) => {
            const userId = user.id || this.generateId();
            const publicIdPromise = this.generateUniquePublicId();
            const userData = {
                ...user,
                id: userId
            };
            publicIdPromise.then((publicId) => {
                this._db.run(`INSERT INTO users (
            id, email, password_hash, role, status, public_id, first_name, last_name,
            phone_number, business_id, data_retention_until, is_gdpr_compliant,
            created_at, last_login_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    userData.id, userData.email, userData.passwordHash, userData.role,
                    userData.status, publicId, userData.firstName, userData.lastName,
                    userData.phoneNumber, userData.businessId, userData.dataRetentionUntil,
                    userData.isGdprCompliant ? 1 : 0, userData.createdAt, userData.lastLoginAt,
                    userData.updatedAt
                ], function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(userId);
                });
            }).catch(reject);
        });
    }
    async updateUser(user) {
        return new Promise((resolve, reject) => {
            this._db.run(`UPDATE users SET 
          email = ?, password_hash = ?, role = ?, status = ?, 
          first_name = ?, last_name = ?, phone_number = ?, 
          business_id = ?, data_retention_until = ?, 
          is_gdpr_compliant = ?, last_login_at = ?, updated_at = ?
        WHERE id = ?`, [
                user.email, user.passwordHash, user.role, user.status,
                user.firstName, user.lastName, user.phoneNumber, user.businessId,
                user.dataRetentionUntil, user.isGdprCompliant ? 1 : 0,
                user.lastLoginAt, user.updatedAt, user.id
            ], (err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
    async getGDPRConsentsForUser(userId) {
        return new Promise((resolve, reject) => {
            this._db.all('SELECT * FROM gdpr_consents WHERE user_id = ? ORDER BY timestamp DESC', [userId], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                const consents = rows.map(row => ({
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
                resolve(consents);
            });
        });
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
    ensureUserPublicIdColumn() {
        this._db.all(`PRAGMA table_info(users)`, (err, rows) => {
            if (err) {
                console.error('Error checking users table schema:', err);
                return;
            }
            const hasPublicId = rows?.some((r) => r.name === 'public_id');
            const createIndex = () => {
                this._db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_id ON users(public_id)`, (idxErr) => {
                    if (idxErr) {
                        if (!(idxErr.message || '').includes('already exists')) {
                            console.error('Error creating unique index for users.public_id:', idxErr);
                        }
                    }
                    else {
                        console.log('✅ Ensured unique index idx_users_public_id');
                    }
                });
            };
            if (!hasPublicId) {
                this._db.run(`ALTER TABLE users ADD COLUMN public_id TEXT`, (alterErr) => {
                    if (alterErr) {
                        if ((alterErr.message || '').includes('duplicate column name')) {
                            console.warn('public_id column already exists; continuing');
                            createIndex();
                            return;
                        }
                        console.error('Error adding public_id column to users:', alterErr);
                        return;
                    }
                    console.log('✅ Added public_id column to users table');
                    createIndex();
                });
            }
            else {
                createIndex();
            }
        });
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
        return new Promise((resolve) => {
            this._db.get(`SELECT 1 FROM users WHERE public_id = ? LIMIT 1`, [publicId], (err, row) => {
                if (err) {
                    resolve(false);
                }
                else {
                    resolve(!row);
                }
            });
        });
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
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT public_id FROM users WHERE id = ?`, [userId], async (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (row && row.public_id) {
                    resolve(row.public_id);
                    return;
                }
                try {
                    const publicId = await this.generateUniquePublicId();
                    this._db.run(`UPDATE users SET public_id = ? WHERE id = ?`, [publicId, userId], (updErr) => {
                        if (updErr)
                            reject(updErr);
                        else
                            resolve(publicId);
                    });
                }
                catch (genErr) {
                    reject(genErr);
                }
            });
        });
    }
    async getUserIdByPublicId(publicId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT id FROM users WHERE public_id = ?`, [publicId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row?.id || null);
            });
        });
    }
    async createOrUpdateProviderProfile(userId, profileData) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT id, is_active FROM service_provider_profiles WHERE user_id = ?`, [userId], (err, existingProfile) => {
                if (err) {
                    reject(err);
                    return;
                }
                const id = existingProfile?.id || this.generateId();
                const isActive = profileData.isActive !== undefined
                    ? (profileData.isActive ? 1 : 0)
                    : (existingProfile?.is_active !== undefined ? existingProfile.is_active : 1);
                this._db.run(`INSERT OR REPLACE INTO service_provider_profiles (
              id, user_id, business_name, service_category, description,
              experience_years, hourly_rate, city, neighborhood, address,
              latitude, longitude, phone_number, email, website_url,
              profile_image_url, is_verified, is_active, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
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
        return new Promise((resolve, reject) => {
            this._db.serialize(() => {
                this._db.run(`DELETE FROM provider_gallery WHERE user_id = ?`, [userId]);
                const stmt = this._db.prepare(`INSERT INTO provider_gallery (id, user_id, image_url) VALUES (?, ?, ?)`);
                for (const url of imageUrls || []) {
                    stmt.run(this.generateId(), userId, url);
                }
                stmt.finalize((err) => err ? reject(err) : resolve());
            });
        });
    }
    async replaceProviderCertificates(userId, certificates) {
        return new Promise((resolve, reject) => {
            this._db.serialize(() => {
                this._db.run(`DELETE FROM provider_certificates WHERE user_id = ?`, [userId]);
                const stmt = this._db.prepare(`INSERT INTO provider_certificates (id, user_id, title, file_url, issued_by, issued_at) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const c of certificates || []) {
                    stmt.run(this.generateId(), userId, c.title || null, c.fileUrl || null, c.issuedBy || null, c.issuedAt || null);
                }
                stmt.finalize((err) => err ? reject(err) : resolve());
            });
        });
    }
    async getProviderGallery(userId) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT image_url FROM provider_gallery WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve((rows || []).map(r => r.image_url));
            });
        });
    }
    async getProviderCertificates(userId) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT id, title, file_url as fileUrl, issued_by as issuedBy, issued_at as issuedAt FROM provider_certificates WHERE user_id = ? ORDER BY created_at DESC`, [userId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async searchProviders(filters) {
        return new Promise((resolve, reject) => {
            let query = `
        SELECT sp.*, u.first_name, u.last_name 
        FROM service_provider_profiles sp
        JOIN users u ON sp.user_id = u.id
        WHERE sp.is_active = 1
      `;
            const params = [];
            if (filters.category) {
                query += ' AND sp.service_category = ?';
                params.push(filters.category);
            }
            if (filters.city) {
                query += ' AND sp.city = ?';
                params.push(filters.city);
            }
            if (filters.neighborhood) {
                query += ' AND sp.neighborhood = ?';
                params.push(filters.neighborhood);
            }
            if (filters.minRating) {
                query += ' AND sp.rating >= ?';
                params.push(filters.minRating);
            }
            query += ' ORDER BY sp.rating DESC, sp.total_reviews DESC';
            if (filters.limit) {
                query += ' LIMIT ?';
                params.push(filters.limit);
            }
            console.log('🔍 Database query:', query);
            console.log('🔍 Query params:', params);
            this._db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('❌ Database query error:', err);
                    reject(err);
                }
                else {
                    console.log('✅ Database query result:', rows?.length || 0, 'rows');
                    resolve(rows || []);
                }
            });
        });
    }
    async getProviderProfile(providerId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT sp.*, u.first_name, u.last_name 
         FROM service_provider_profiles sp
         JOIN users u ON sp.user_id = u.id
         WHERE sp.id = ?`, [providerId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row || null);
            });
        });
    }
    async getServiceCategories() {
        return new Promise((resolve, reject) => {
            this._db.all('SELECT * FROM service_categories ORDER BY name', (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async createMarketplaceInquiry(inquiryData) {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            this._db.run(`INSERT INTO marketplace_inquiries (
          id, provider_id, customer_name, customer_phone, customer_email,
          service_needed, description, preferred_date, city, neighborhood, address
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                id, inquiryData.providerId, inquiryData.customerName, inquiryData.customerPhone,
                inquiryData.customerEmail, inquiryData.serviceNeeded, inquiryData.description,
                inquiryData.preferredDate, inquiryData.city, inquiryData.neighborhood, inquiryData.address
            ], function (err) {
                if (err)
                    reject(err);
                else
                    resolve(id);
            });
        });
    }
    async getProviderInquiries(providerId) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT * FROM marketplace_inquiries 
         WHERE provider_id = ? 
         ORDER BY created_at DESC`, [providerId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async addProviderReview(reviewData) {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            this._db.run(`INSERT INTO provider_reviews (
          id, provider_id, customer_name, customer_phone, rating, review_text, service_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                id, reviewData.providerId, reviewData.customerName, reviewData.customerPhone,
                reviewData.rating, reviewData.reviewText, reviewData.serviceDate
            ], (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this.updateProviderRating(reviewData.providerId);
                    resolve();
                }
            });
        });
    }
    async updateProviderRating(providerId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT AVG(rating) as avg_rating, COUNT(*) as review_count 
         FROM provider_reviews 
         WHERE provider_id = ?`, [providerId], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    this._db.run(`UPDATE service_provider_profiles 
               SET rating = ?, total_reviews = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?`, [row.avg_rating || 0, row.review_count || 0, providerId], (updateErr) => {
                        if (updateErr)
                            reject(updateErr);
                        else
                            resolve();
                    });
                }
            });
        });
    }
    async getCitiesWithProviders() {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT DISTINCT city FROM service_provider_profiles 
         WHERE city IS NOT NULL AND is_active = 1 
         ORDER BY city`, (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => row.city));
            });
        });
    }
    async getNeighborhoodsInCity(city) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT DISTINCT neighborhood FROM service_provider_profiles 
         WHERE city = ? AND neighborhood IS NOT NULL AND is_active = 1 
         ORDER BY neighborhood`, [city], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows.map(row => row.neighborhood));
            });
        });
    }
    async createOrGetConversation(data) {
        return new Promise((resolve, reject) => {
            const resolveProviderUserId = (cb) => {
                if (data.providerId.startsWith('device_')) {
                    this._db.get(`SELECT id FROM users WHERE role = 'tradesperson' ORDER BY created_at DESC LIMIT 1`, [], (mapErr, row) => {
                        if (mapErr) {
                            reject(mapErr);
                            return;
                        }
                        const providerUserId = row?.id || data.providerId;
                        if (row?.id) {
                            this._db.run(`UPDATE marketplace_conversations SET provider_id = ? WHERE provider_id = ?`, [providerUserId, data.providerId], () => cb(providerUserId));
                        }
                        else {
                            cb(providerUserId);
                        }
                    });
                }
                else {
                    cb(data.providerId);
                }
            };
            resolveProviderUserId((providerUserId) => {
                this._db.get(`SELECT id, user_id FROM service_provider_profiles WHERE user_id = ?`, [providerUserId], (err, providerRow) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    if (!providerRow) {
                        const profileId = this.generateId();
                        this._db.run(`INSERT INTO service_provider_profiles (
                  id, user_id, business_name, service_category, description,
                  city, is_active, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [
                            profileId,
                            providerUserId,
                            'Service Provider',
                            'general',
                            'Professional service provider',
                            'Sofia',
                            1
                        ], (insertErr) => {
                            if (insertErr) {
                                reject(insertErr);
                                return;
                            }
                            console.log('✅ Created basic service provider profile for user:', providerUserId);
                            this.continueConversationCreation(data, providerUserId, resolve, reject);
                        });
                        return;
                    }
                    const userId = providerRow.user_id;
                    console.log('🔄 Found existing provider profile for user:', providerUserId);
                    this.continueConversationCreation(data, userId, resolve, reject);
                });
            });
        });
    }
    continueConversationCreation(data, userId, resolve, reject) {
        console.log('🔍 continueConversationCreation - Received data:', JSON.stringify(data, null, 2));
        console.log('🔍 customerId value:', data.customerId, 'type:', typeof data.customerId);
        const query = data.customerId
            ? `SELECT id FROM marketplace_conversations 
         WHERE provider_id = ? AND (
           customer_id = ? OR 
           (customer_id IS NULL AND customer_email = ?) OR
           (customer_id IS NULL AND (customer_email = '' OR customer_email IS NULL))
         )
         ORDER BY 
           CASE WHEN customer_id = ? THEN 1 
                WHEN customer_id IS NULL AND customer_email = ? THEN 2
                WHEN customer_id IS NULL THEN 3 
                ELSE 4 
           END,
           created_at DESC 
         LIMIT 1`
            : `SELECT id FROM marketplace_conversations 
         WHERE provider_id = ? AND customer_email = ?`;
        const params = data.customerId
            ? [data.providerId, data.customerId, data.customerEmail, data.customerId, data.customerEmail]
            : [data.providerId, data.customerEmail];
        console.log('🔍 Executing query:', query);
        console.log('🔍 Query params:', params);
        this._db.get(query, params, (err, row) => {
            if (err) {
                reject(err);
                return;
            }
            if (row) {
                console.log('✅ Found existing conversation:', row.id);
                if (data.customerId) {
                    this._db.get(`SELECT customer_id, customer_name FROM marketplace_conversations WHERE id = ?`, [row.id], (checkErr, convRow) => {
                        if (checkErr) {
                            console.error('Error checking conversation:', checkErr);
                            resolve(row.id);
                            return;
                        }
                        if (!convRow.customer_id || convRow.customer_name === 'Chat Customer') {
                            console.log('🔄 Updating conversation with authenticated user info...');
                            this._db.run(`UPDATE marketplace_conversations 
                     SET customer_id = ?, customer_name = ?, customer_email = ?, customer_phone = ?
                     WHERE id = ?`, [data.customerId, data.customerName, data.customerEmail, data.customerPhone, row.id], (updateErr) => {
                                if (updateErr) {
                                    console.error('Error updating conversation:', updateErr);
                                    resolve(row.id);
                                }
                                else {
                                    console.log('✅ Updated conversation with user:', data.customerId, data.customerName);
                                    const welcomeMessage = 'Здравейте! Извинявам се, че пропуснах обаждането Ви. Ще Ви се обадя възможно най-скоро.\n\nАко не Ви е трудно, моля опишете проблема тук и ще Ви отговоря при първа възможност. Благодаря за разбирането! 🙏';
                                    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                                    this._db.run(`INSERT INTO marketplace_chat_messages (
                            id, conversation_id, sender_type, sender_name, message, message_type, sent_at
                          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`, [messageId, row.id, 'provider', 'Специалист', welcomeMessage, 'text'], (msgErr) => {
                                        if (msgErr) {
                                            console.error('❌ Failed to send welcome message:', msgErr);
                                        }
                                        else {
                                            console.log('✅ Sent welcome message to conversation:', row.id);
                                        }
                                        resolve(row.id);
                                    });
                                }
                            });
                        }
                        else {
                            resolve(row.id);
                        }
                    });
                }
                else {
                    resolve(row.id);
                }
            }
            else {
                const conversationId = this.generateId();
                this._db.run(`INSERT INTO marketplace_conversations (
              id, provider_id, customer_id, customer_name, customer_email, customer_phone
            ) VALUES (?, ?, ?, ?, ?, ?)`, [conversationId, data.providerId, data.customerId || null, data.customerName, data.customerEmail, data.customerPhone], (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        console.log('✅ Created new marketplace conversation:');
                        console.log('  - Conversation ID:', conversationId);
                        console.log('  - Provider User ID:', data.providerId);
                        console.log('  - Customer ID:', data.customerId || 'null (unauthenticated)');
                        console.log('  - Customer Name:', data.customerName);
                        console.log('  - Customer Email:', data.customerEmail);
                        this.autoSendServiceRequestButton(conversationId, data.providerId, data.customerName)
                            .then(() => {
                            console.log('📋 Service request button auto-sent successfully');
                            resolve(conversationId);
                        })
                            .catch((templateErr) => {
                            console.error('⚠️ Failed to auto-send service request button:', templateErr);
                            resolve(conversationId);
                        });
                    }
                });
            }
        });
    }
    async autoSendServiceRequestButton(conversationId, providerId, customerName) {
        return new Promise(async (resolve, reject) => {
            try {
                const providerProfile = await new Promise((profileResolve, profileReject) => {
                    this._db.get(`SELECT service_category FROM service_provider_profiles WHERE user_id = ?`, [providerId], (err, row) => {
                        if (err)
                            profileReject(err);
                        else
                            profileResolve(row);
                    });
                });
                const serviceCategory = providerProfile?.service_category || 'general';
                const template = await this.getCaseTemplate(serviceCategory);
                if (!template) {
                    console.log('⚠️ No template found for category:', serviceCategory);
                    resolve();
                    return;
                }
                const messageId = this.generateId();
                const serviceRequestMessage = `Здравейте ${customerName}! 👋

Добре дошли в нашия чат за спешни ремонти. Готов съм да ви помогна с вашия проблем.

Можете да започнете като кликнете на бутона по-долу за да създадете заявка за услуга:`;
                this._db.run(`INSERT INTO marketplace_chat_messages (
            id, conversation_id, sender_type, sender_name, message, message_type
          ) VALUES (?, ?, ?, ?, ?, ?)`, [messageId, conversationId, 'provider', 'Система', serviceRequestMessage, 'service_request'], (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        this._db.run(`UPDATE marketplace_conversations 
                 SET last_message_at = CURRENT_TIMESTAMP 
                 WHERE id = ?`, [conversationId], (updateErr) => {
                            if (updateErr) {
                                console.error('⚠️ Failed to update conversation timestamp:', updateErr);
                            }
                            else {
                                console.log('✅ Service request message sent successfully');
                            }
                            resolve();
                        });
                    }
                });
            }
            catch (error) {
                console.error('❌ Error in autoSendCaseTemplate:', error);
                reject(error);
            }
        });
    }
    async sendMessage(data) {
        return new Promise((resolve, reject) => {
            const messageId = this.generateId();
            this._db.run(`INSERT INTO marketplace_chat_messages (
          id, conversation_id, sender_type, sender_name, message, message_type
        ) VALUES (?, ?, ?, ?, ?, ?)`, [
                messageId,
                data.conversationId,
                data.senderType,
                data.senderName,
                data.message,
                data.messageType || 'text'
            ], (err) => {
                if (err) {
                    reject(err);
                }
                else {
                    this._db.run(`UPDATE marketplace_conversations 
               SET last_message_at = CURRENT_TIMESTAMP 
               WHERE id = ?`, [data.conversationId], (updateErr) => {
                        if (updateErr)
                            reject(updateErr);
                        else
                            resolve(messageId);
                    });
                }
            });
        });
    }
    async getConversationMessages(conversationId, limit = 50) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT * FROM marketplace_chat_messages 
         WHERE conversation_id = ? 
         ORDER BY sent_at ASC 
         LIMIT ?`, [conversationId, limit], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async getProviderConversations(providerId) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT c.*, 
                COALESCE(cu.first_name || ' ' || cu.last_name, c.customer_name) as customer_name,
                COUNT(m.id) as message_count,
                COUNT(CASE WHEN m.sender_type = 'customer' AND m.is_read = 0 THEN 1 END) as unread_count,
                (SELECT message FROM marketplace_chat_messages WHERE conversation_id = c.id ORDER BY sent_at DESC LIMIT 1) as last_message
         FROM marketplace_conversations c
         LEFT JOIN marketplace_chat_messages m ON c.id = m.conversation_id
         LEFT JOIN users cu ON c.customer_id = cu.id
         WHERE c.provider_id = ?
         GROUP BY c.id
         ORDER BY c.last_message_at DESC`, [providerId], (err, rows) => {
                if (err)
                    reject(err);
                else
                    resolve(rows || []);
            });
        });
    }
    async getAllUserConversations(userId) {
        return new Promise((resolve, reject) => {
            this._db.run(`UPDATE marketplace_conversations SET provider_id = ? WHERE provider_id LIKE 'device_%'`, [userId], () => {
                const query = `
        SELECT 
          'marketplace' as conversation_type,
          mc.id,
          mc.customer_phone,
          COALESCE(cu.first_name || ' ' || cu.last_name, mc.customer_name) as customer_name,
          mc.customer_email,
          mc.provider_id,
          mc.customer_id,
          mc.status,
          mc.created_at,
          mc.last_message_at,
          COUNT(mm.id) as message_count,
          COUNT(CASE WHEN mm.sender_type = 'customer' AND mm.is_read = 0 THEN 1 END) as unread_count,
          (SELECT message FROM marketplace_chat_messages WHERE conversation_id = mc.id ORDER BY sent_at DESC LIMIT 1) as last_message_content,
          COALESCE(u.first_name || ' ' || u.last_name, p.business_name) as serviceProviderName,
          p.service_category as serviceCategory
        FROM marketplace_conversations mc
        LEFT JOIN marketplace_chat_messages mm ON mc.id = mm.conversation_id
        LEFT JOIN service_provider_profiles p ON mc.provider_id = p.user_id
        LEFT JOIN users u ON mc.provider_id = u.id
        LEFT JOIN users cu ON mc.customer_id = cu.id
        WHERE mc.provider_id = ? OR mc.customer_id = ?
        GROUP BY mc.id
        
        ORDER BY last_message_at DESC
      `;
                this._db.all(query, [userId, userId], (err, rows) => {
                    if (err) {
                        console.error('❌ Error getting user conversations:', err);
                        reject(err);
                    }
                    else {
                        console.log('📱 Found conversations for user', userId + ':', rows?.length || 0);
                        rows?.forEach((row) => {
                            console.log('  -', row.conversation_type, 'conversation:', row.id, 'provider:', row.provider_id, 'customer:', row.customer_id, 'customer_name:', row.customer_name || row.customer_phone, 'messages:', row.message_count);
                        });
                        resolve(rows || []);
                    }
                });
            });
        });
    }
    async getUnifiedConversationMessages(conversationId, conversationType) {
        return new Promise((resolve, reject) => {
            if (conversationType === 'marketplace') {
                this._db.all(`SELECT 
             id, conversation_id, sender_type as sender, sender_name, 
             message as content, sent_at as timestamp, is_read
           FROM marketplace_chat_messages 
           WHERE conversation_id = ? 
           ORDER BY sent_at ASC`, [conversationId], (err, rows) => {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            }
            else {
                resolve([]);
            }
        });
    }
    async getConversationDetails(conversationId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT c.*, 
                p.business_name as provider_business_name,
                u.first_name as provider_first_name,
                u.last_name as provider_last_name
         FROM marketplace_conversations c
         LEFT JOIN service_provider_profiles p ON c.provider_id = p.user_id
         LEFT JOIN users u ON c.provider_id = u.id
         WHERE c.id = ?`, [conversationId], (err, row) => {
                if (err)
                    reject(err);
                else
                    resolve(row);
            });
        });
    }
    async createCaseTemplate(data) {
        return new Promise((resolve, reject) => {
            const templateId = this.generateId();
            this._db.run(`INSERT INTO case_templates (id, service_category, template_name, template_data)
         VALUES (?, ?, ?, ?)`, [templateId, data.serviceCategory, data.templateName, JSON.stringify(data.templateData)], (err) => {
                if (err)
                    reject(err);
                else
                    resolve(templateId);
            });
        });
    }
    async getCaseTemplate(serviceCategory) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT * FROM case_templates 
         WHERE service_category = ? AND is_active = 1 
         ORDER BY created_at DESC LIMIT 1`, [serviceCategory], (err, row) => {
                if (err)
                    reject(err);
                else {
                    if (row && row.template_data) {
                        row.template_data = JSON.parse(row.template_data);
                    }
                    resolve(row);
                }
            });
        });
    }
    async createServiceCase(data) {
        return new Promise((resolve, reject) => {
            const caseId = this.generateId();
            this._db.run(`INSERT INTO service_cases (id, conversation_id, template_id, customer_id, provider_id, case_data, priority)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                caseId,
                data.conversationId,
                data.templateId,
                data.customerId,
                data.providerId || null,
                JSON.stringify(data.caseData),
                data.priority || 'normal'
            ], (err) => {
                if (err)
                    reject(err);
                else
                    resolve(caseId);
            });
        });
    }
    async updateServiceCase(caseId, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            if (updates.status) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.caseData) {
                fields.push('case_data = ?');
                values.push(JSON.stringify(updates.caseData));
            }
            if (updates.providerId) {
                fields.push('provider_id = ?');
                values.push(updates.providerId);
            }
            if (updates.estimatedCost) {
                fields.push('estimated_cost = ?');
                values.push(updates.estimatedCost);
            }
            if (updates.estimatedDuration) {
                fields.push('estimated_duration = ?');
                values.push(updates.estimatedDuration);
            }
            if (updates.scheduledDate) {
                fields.push('scheduled_date = ?');
                values.push(updates.scheduledDate);
            }
            if (updates.assignedAt) {
                fields.push('assigned_at = ?');
                values.push(updates.assignedAt);
            }
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(caseId);
            this._db.run(`UPDATE service_cases SET ${fields.join(', ')} WHERE id = ?`, values, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getServiceCaseByConversation(conversationId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT sc.*, ct.template_name, ct.template_data
         FROM service_cases sc
         LEFT JOIN case_templates ct ON sc.template_id = ct.id
         WHERE sc.conversation_id = ?
         ORDER BY sc.created_at DESC LIMIT 1`, [conversationId], (err, row) => {
                if (err)
                    reject(err);
                else {
                    if (row) {
                        if (row.case_data)
                            row.case_data = JSON.parse(row.case_data);
                        if (row.template_data)
                            row.template_data = JSON.parse(row.template_data);
                    }
                    resolve(row);
                }
            });
        });
    }
    async addCaseToQueue(caseId, originalProviderId) {
        return new Promise((resolve, reject) => {
            const queueId = this.generateId();
            this._db.get(`SELECT MAX(queue_position) as max_position FROM case_queue`, [], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                const nextPosition = (row?.max_position || 0) + 1;
                this._db.run(`INSERT INTO case_queue (id, case_id, original_provider_id, queue_position)
             VALUES (?, ?, ?, ?)`, [queueId, caseId, originalProviderId, nextPosition], (insertErr) => {
                    if (insertErr)
                        reject(insertErr);
                    else
                        resolve(queueId);
                });
            });
        });
    }
    async getAvailableCasesFromQueue(providerId, limit = 10) {
        return new Promise((resolve, reject) => {
            this._db.all(`SELECT cq.*, sc.*, ct.template_name, ct.template_data,
                u.first_name as customer_first_name, u.last_name as customer_last_name
         FROM case_queue cq
         JOIN service_cases sc ON cq.case_id = sc.id
         JOIN case_templates ct ON sc.template_id = ct.id
         JOIN users u ON sc.customer_id = u.id
         WHERE cq.available_to_all = 1 
         AND cq.original_provider_id != ?
         AND sc.status = 'in_queue'
         ORDER BY cq.queue_position ASC
         LIMIT ?`, [providerId, limit], (err, rows) => {
                if (err)
                    reject(err);
                else {
                    const cases = rows.map(row => {
                        if (row.case_data)
                            row.case_data = JSON.parse(row.case_data);
                        if (row.template_data)
                            row.template_data = JSON.parse(row.template_data);
                        return row;
                    });
                    resolve(cases);
                }
            });
        });
    }
    async markMessagesAsRead(conversationId, senderType) {
        return new Promise((resolve, reject) => {
            const otherSenderType = senderType === 'customer' ? 'provider' : 'customer';
            this._db.run(`UPDATE marketplace_chat_messages 
         SET is_read = 1 
         WHERE conversation_id = ? AND sender_type = ? AND is_read = 0`, [conversationId, otherSenderType], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async getSMSSettings(userId) {
        return new Promise((resolve, reject) => {
            this._db.get(`SELECT * FROM sms_settings WHERE user_id = ?`, [userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                if (row) {
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
                    this._db.run(`INSERT INTO sms_settings (id, user_id) VALUES (?, ?)`, [id, userId], (err) => {
                        if (err) {
                            reject(err);
                        }
                        else {
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
                    });
                }
            });
        });
    }
    async updateSMSSettings(userId, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            if (updates.isEnabled !== undefined) {
                fields.push('is_enabled = ?');
                values.push(updates.isEnabled ? 1 : 0);
            }
            if (updates.message !== undefined) {
                fields.push('message_template = ?');
                values.push(updates.message);
            }
            if (updates.lastSentTime !== undefined) {
                fields.push('last_sent_time = ?');
                values.push(updates.lastSentTime);
            }
            if (updates.sentCount !== undefined) {
                fields.push('sent_count = ?');
                values.push(updates.sentCount);
            }
            if (updates.sentCallIds !== undefined) {
                fields.push('sent_call_ids = ?');
                values.push(JSON.stringify(updates.sentCallIds));
            }
            if (updates.filterKnownContacts !== undefined) {
                fields.push('filter_known_contacts = ?');
                values.push(updates.filterKnownContacts ? 1 : 0);
            }
            if (fields.length === 0) {
                resolve();
                return;
            }
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(userId);
            this._db.run(`UPDATE sms_settings SET ${fields.join(', ')} WHERE user_id = ?`, values, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async clearSMSHistory(userId) {
        return new Promise((resolve, reject) => {
            this._db.run(`UPDATE sms_settings 
         SET sent_call_ids = '[]', updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = ?`, [userId], (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    close() {
        this._db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
            else {
                console.log('Database connection closed');
            }
        });
    }
}
exports.SQLiteDatabase = SQLiteDatabase;
//# sourceMappingURL=SQLiteDatabase.js.map