"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedServiceCategories = seedServiceCategories;
exports.createSampleProvider = createSampleProvider;
const SQLiteDatabase_1 = require("../models/SQLiteDatabase");
const db = new SQLiteDatabase_1.SQLiteDatabase();
const serviceCategories = [
    {
        id: 'electrician',
        name: 'Electrician',
        name_bg: 'Електротехник',
        description: 'Electrical installation, repair and maintenance',
        icon_name: 'bolt'
    },
    {
        id: 'plumber',
        name: 'Plumber',
        name_bg: 'Водопроводчик',
        description: 'Plumbing installation, repair and maintenance',
        icon_name: 'wrench'
    },
    {
        id: 'hvac',
        name: 'HVAC Technician',
        name_bg: 'Климатик',
        description: 'Heating, ventilation and air conditioning services',
        icon_name: 'snowflake'
    },
    {
        id: 'carpenter',
        name: 'Carpenter',
        name_bg: 'Дърводелец',
        description: 'Woodworking, furniture and construction',
        icon_name: 'hammer'
    },
    {
        id: 'painter',
        name: 'Painter',
        name_bg: 'Бояджия',
        description: 'Interior and exterior painting services',
        icon_name: 'paint-brush'
    },
    {
        id: 'locksmith',
        name: 'Locksmith',
        name_bg: 'Ключар',
        description: 'Lock installation, repair and emergency services',
        icon_name: 'key'
    },
    {
        id: 'cleaner',
        name: 'Cleaning Service',
        name_bg: 'Почистване',
        description: 'House and office cleaning services',
        icon_name: 'broom'
    },
    {
        id: 'gardener',
        name: 'Gardener',
        name_bg: 'Градинар',
        description: 'Garden maintenance and landscaping',
        icon_name: 'leaf'
    },
    {
        id: 'handyman',
        name: 'Handyman',
        name_bg: 'Майстор за всичко',
        description: 'General maintenance and repair services',
        icon_name: 'tools'
    },
    {
        id: 'appliance_repair',
        name: 'Appliance Repair',
        name_bg: 'Ремонт на уреди',
        description: 'Home appliance repair and maintenance',
        icon_name: 'cog'
    }
];
async function seedServiceCategories() {
    console.log('🌱 Seeding service categories...');
    try {
        const insertCategory = (category) => {
            return new Promise((resolve, reject) => {
                db.db.run(`INSERT OR IGNORE INTO service_categories (id, name, name_bg, description, icon_name) 
           VALUES (?, ?, ?, ?, ?)`, [category.id, category.name, category.name_bg, category.description, category.icon_name], (err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        };
        for (const category of serviceCategories) {
            await insertCategory(category);
        }
        console.log(`✅ Successfully seeded ${serviceCategories.length} service categories`);
    }
    catch (error) {
        console.error('❌ Error seeding service categories:', error);
        throw error;
    }
}
async function createSampleProvider() {
    console.log('🌱 Creating sample service provider...');
    try {
        const userId = 'sample_user_' + Date.now();
        const sampleProfile = {
            businessName: 'Електро Експерт ЕООД',
            serviceCategory: 'electrician',
            description: 'Професионални електротехнически услуги в София. 15 години опит. Всички видове електроинсталации.',
            experienceYears: 15,
            hourlyRate: 35.0,
            city: 'София',
            neighborhood: 'Център',
            address: 'ул. Витоша 15',
            latitude: 42.6977,
            longitude: 23.3219,
            phoneNumber: '+359888123456',
            email: 'info@elektro-expert.bg',
            websiteUrl: 'https://elektro-expert.bg',
            isVerified: true,
            isActive: true
        };
        await db.createOrUpdateProviderProfile(userId, sampleProfile);
        console.log('✅ Successfully created sample service provider');
    }
    catch (error) {
        console.error('❌ Error creating sample provider:', error);
        throw error;
    }
}
if (require.main === module) {
    seedServiceCategories()
        .then(() => createSampleProvider())
        .then(() => {
        console.log('🎉 Database seeding completed successfully!');
        process.exit(0);
    })
        .catch((error) => {
        console.error('💥 Database seeding failed:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=seedData.js.map