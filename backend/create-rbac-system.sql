-- Industry Standard RBAC System
-- Role-Based Access Control Database Schema

-- 1. Users table with role support
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'moderator', 'service_provider', 'customer')),
    is_active BOOLEAN DEFAULT 1,
    email_verified BOOLEAN DEFAULT 0,
    phone_number TEXT,
    business_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login_at DATETIME,
    
    -- GDPR Compliance
    gdpr_consent_given BOOLEAN DEFAULT 0,
    gdpr_consent_date DATETIME,
    data_retention_until DATETIME,
    
    -- Security
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until DATETIME,
    password_changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Role definitions table (for future expansion)
CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    permissions TEXT, -- JSON array of permissions
    is_system_role BOOLEAN DEFAULT 0, -- System roles can't be deleted
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. User permissions (for granular control)
CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL, -- e.g., 'admin.users.read', 'admin.sms.manage'
    granted_by TEXT REFERENCES users(id),
    granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME, -- NULL = never expires
    
    UNIQUE(user_id, permission)
);

-- 4. Admin activity log (audit trail)
CREATE TABLE IF NOT EXISTS admin_activity_log (
    id TEXT PRIMARY KEY,
    admin_user_id TEXT NOT NULL REFERENCES users(id),
    action TEXT NOT NULL, -- 'user.disable', 'settings.view', 'security.scan'
    target_user_id TEXT REFERENCES users(id), -- If action affects another user
    target_resource TEXT, -- Resource being accessed
    ip_address TEXT,
    user_agent TEXT,
    details TEXT, -- JSON with additional details
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert default system roles
INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system_role) VALUES
('role-user', 'user', 'Standard user with basic permissions', '["profile.read", "profile.update", "sms.send"]', 1),
('role-admin', 'admin', 'Full system administrator', '["*"]', 1),
('role-moderator', 'moderator', 'Limited administrative access', '["users.read", "users.moderate", "reports.manage"]', 1),
('role-service-provider', 'service_provider', 'Service provider with business features', '["profile.read", "profile.update", "sms.send", "business.manage"]', 1),
('role-customer', 'customer', 'Customer with basic access', '["profile.read", "profile.update", "bookings.manage"]', 1);

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_permission ON user_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_admin_activity_admin_user_id ON admin_activity_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_activity_timestamp ON admin_activity_log(timestamp);

-- 7. Create triggers for updated_at
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_roles_timestamp 
    AFTER UPDATE ON roles
    FOR EACH ROW
    BEGIN
        UPDATE roles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;
