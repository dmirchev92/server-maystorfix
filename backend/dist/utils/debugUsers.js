"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SQLiteDatabase_1 = require("../models/SQLiteDatabase");
const db = new SQLiteDatabase_1.SQLiteDatabase();
async function debugAllUsers() {
    console.log('🔍 Debugging all users in the database...');
    try {
        const allUsers = await getAllUsersDebug();
        console.log(`\n📊 TOTAL USERS FOUND: ${allUsers.length}`);
        if (allUsers.length === 0) {
            console.log('❌ No users found in the database at all!');
            console.log('💡 This means users from the mobile app are not being stored in the SQLite database.');
            console.log('🔧 Possible issues:');
            console.log('   - Mobile app is not connected to this database');
            console.log('   - Users are stored in AsyncStorage only (not synced to backend)');
            console.log('   - Different database file is being used');
            return;
        }
        console.log('\n👥 ALL USERS IN DATABASE:');
        allUsers.forEach((user, index) => {
            console.log(`\n${index + 1}. USER DETAILS:`);
            console.log(`   📧 Email: ${user.email}`);
            console.log(`   👤 Name: ${user.first_name} ${user.last_name}`);
            console.log(`   📱 Phone: ${user.phone_number || 'Not set'}`);
            console.log(`   🏷️  Role: ${user.role}`);
            console.log(`   📊 Status: ${user.status}`);
            console.log(`   📅 Created: ${user.created_at}`);
            console.log(`   🆔 ID: ${user.id}`);
        });
        const serviceProviders = allUsers.filter((u) => u.role === 'service_provider');
        const activeUsers = allUsers.filter((u) => u.status === 'active');
        console.log(`\n📊 USER BREAKDOWN:`);
        console.log(`   🔧 Service Providers: ${serviceProviders.length}`);
        console.log(`   ✅ Active Users: ${activeUsers.length}`);
        console.log(`   🚫 Inactive Users: ${allUsers.length - activeUsers.length}`);
        const roles = [...new Set(allUsers.map((u) => u.role))];
        const statuses = [...new Set(allUsers.map((u) => u.status))];
        console.log(`\n🏷️  UNIQUE ROLES: ${roles.join(', ')}`);
        console.log(`📊 UNIQUE STATUSES: ${statuses.join(', ')}`);
        const profiles = await getAllProfilesDebug();
        console.log(`\n🏪 MARKETPLACE PROFILES: ${profiles.length}`);
        if (profiles.length > 0) {
            profiles.forEach((profile, index) => {
                console.log(`   ${index + 1}. ${profile.business_name} (User ID: ${profile.user_id})`);
            });
        }
    }
    catch (error) {
        console.error('💥 Error during debug:', error);
    }
}
async function getAllUsersDebug() {
    return new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM users ORDER BY created_at DESC', (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows || []);
        });
    });
}
async function getAllProfilesDebug() {
    return new Promise((resolve, reject) => {
        db.db.all('SELECT * FROM service_provider_profiles ORDER BY created_at DESC', (err, rows) => {
            if (err)
                reject(err);
            else
                resolve(rows || []);
        });
    });
}
async function checkTables() {
    return new Promise((resolve, reject) => {
        db.db.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name", (err, rows) => {
            if (err) {
                reject(err);
            }
            else {
                console.log('\n📋 DATABASE TABLES:');
                rows.forEach((row, index) => {
                    console.log(`   ${index + 1}. ${row.name}`);
                });
                resolve();
            }
        });
    });
}
if (require.main === module) {
    checkTables()
        .then(() => debugAllUsers())
        .then(() => {
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. If no users found: Check mobile app database connection');
        console.log('2. If users found: Run migration script to create marketplace profiles');
        console.log('3. Test marketplace search: http://localhost:3000/api/v1/marketplace/providers/search');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Debug failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=debugUsers.js.map