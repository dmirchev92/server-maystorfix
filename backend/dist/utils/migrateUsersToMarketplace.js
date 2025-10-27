"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateUsersToMarketplace = migrateUsersToMarketplace;
exports.showMigrationStatus = showMigrationStatus;
const SQLiteDatabase_1 = require("../models/SQLiteDatabase");
const db = new SQLiteDatabase_1.SQLiteDatabase();
async function migrateUsersToMarketplace() {
    console.log('🔄 Migrating existing users to marketplace profiles...');
    try {
        const users = await getAllUsers();
        console.log(`📱 Found ${users.length} existing users`);
        if (users.length === 0) {
            console.log('ℹ️  No users found to migrate');
            return;
        }
        let migratedCount = 0;
        for (const user of users) {
            try {
                const existingProfile = await getExistingProfile(user.id);
                if (existingProfile) {
                    console.log(`⏭️  User ${user.first_name} ${user.last_name} already has a marketplace profile`);
                    continue;
                }
                const profileData = {
                    businessName: `${user.first_name} ${user.last_name}`,
                    serviceCategory: 'handyman',
                    description: `Професионални услуги от ${user.first_name} ${user.last_name}. Свържете се за повече информация.`,
                    experienceYears: 5,
                    hourlyRate: 25.0,
                    city: 'София',
                    neighborhood: 'Център',
                    phoneNumber: user.phone_number,
                    email: user.email,
                    isVerified: false,
                    isActive: true
                };
                await db.createOrUpdateProviderProfile(user.id, profileData);
                migratedCount++;
                console.log(`✅ Created marketplace profile for: ${user.first_name} ${user.last_name}`);
            }
            catch (error) {
                console.error(`❌ Error creating profile for user ${user.id}:`, error);
            }
        }
        console.log(`🎉 Successfully migrated ${migratedCount} users to marketplace profiles!`);
    }
    catch (error) {
        console.error('💥 Error during migration:', error);
        throw error;
    }
}
async function getAllUsers() {
    return new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM users WHERE role = ?', ['tradesperson'], (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows || []);
        });
    });
}
async function getExistingProfile(userId) {
    return new Promise((resolve, reject) => {
        db.db.get('SELECT id FROM service_provider_profiles WHERE user_id = ?', [userId], (err, row) => {
            if (err)
                reject(err);
            else
                resolve(row || null);
        });
    });
}
async function showMigrationStatus() {
    try {
        const users = await getAllUsers();
        const profiles = await getAllProfiles();
        console.log('\n📊 MIGRATION STATUS:');
        console.log(`👥 Total mobile app users: ${users.length}`);
        console.log(`🏪 Total marketplace profiles: ${profiles.length}`);
        console.log(`📱➡️🌐 Migration needed: ${users.length - profiles.length}`);
        if (profiles.length > 0) {
            console.log('\n🏪 Current marketplace profiles:');
            profiles.forEach((profile, index) => {
                console.log(`${index + 1}. ${profile.business_name} (${profile.service_category}) - ${profile.city}`);
            });
        }
    }
    catch (error) {
        console.error('❌ Error checking migration status:', error);
    }
}
async function getAllProfiles() {
    return new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM service_provider_profiles WHERE is_active = 1', (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows || []);
        });
    });
}
if (require.main === module) {
    showMigrationStatus()
        .then(() => {
        console.log('\n🚀 Starting migration...');
        return migrateUsersToMarketplace();
    })
        .then(() => {
        console.log('\n📊 Final status:');
        return showMigrationStatus();
    })
        .then(() => {
        console.log('\n✨ Migration completed successfully!');
        console.log('\n🌐 Your mobile app users should now appear on the marketplace website!');
        console.log('🔗 Test it at: http://localhost:3000/api/v1/marketplace/providers/search');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Migration failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=migrateUsersToMarketplace.js.map