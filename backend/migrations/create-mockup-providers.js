const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('👷 Creating 5 mockup service providers');
console.log('📁 Database path:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err.message);
    process.exit(1);
  }
  console.log('✅ Connected to database\n');
});

// Mockup providers data
const providers = [
  {
    firstName: 'Иван',
    lastName: 'Петров',
    email: 'ivan.petrov@test.bg',
    phone: '+359888111111',
    businessName: 'Електро Експерт',
    category: 'electrician',
    city: 'София',
    neighborhood: 'Младост 1',
    description: 'Професионален електротехник с 10 години опит',
    experienceYears: 10,
    hourlyRate: 50
  },
  {
    firstName: 'Георги',
    lastName: 'Димитров',
    email: 'georgi.dimitrov@test.bg',
    phone: '+359888222222',
    businessName: 'Водопровод Майстор',
    category: 'plumber',
    city: 'София',
    neighborhood: 'Люлин',
    description: 'Водопроводчик с богат опит в ремонти',
    experienceYears: 8,
    hourlyRate: 45
  },
  {
    firstName: 'Мария',
    lastName: 'Иванова',
    email: 'maria.ivanova@test.bg',
    phone: '+359888333333',
    businessName: 'Чисто и Красиво',
    category: 'cleaner',
    city: 'София',
    neighborhood: 'Лозенец',
    description: 'Професионално почистване на домове и офиси',
    experienceYears: 5,
    hourlyRate: 30
  },
  {
    firstName: 'Петър',
    lastName: 'Стоянов',
    email: 'petar.stoyanov@test.bg',
    phone: '+359888444444',
    businessName: 'Климатик Сервиз Пловдив',
    category: 'hvac',
    city: 'Пловдив',
    neighborhood: null,
    description: 'Монтаж и ремонт на климатични системи',
    experienceYears: 12,
    hourlyRate: 60
  },
  {
    firstName: 'Стефан',
    lastName: 'Николов',
    email: 'stefan.nikolov@test.bg',
    phone: '+359888555555',
    businessName: 'Боядисване Варна',
    category: 'painter',
    city: 'Варна',
    neighborhood: null,
    description: 'Качествено боядисване на жилища и офиси',
    experienceYears: 7,
    hourlyRate: 40
  }
];

const password = 'Test123!'; // Simple password for all test accounts

async function createProvider(provider) {
  return new Promise(async (resolve, reject) => {
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();

    // Insert user
    db.run(
      `INSERT INTO users (
        id, email, password_hash, first_name, last_name, phone_number, 
        role, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        provider.email,
        hashedPassword,
        provider.firstName,
        provider.lastName,
        provider.phone,
        'tradesperson',
        'active',
        now,
        now
      ],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            console.log(`⚠️  User ${provider.email} already exists, skipping...`);
            resolve(false);
          } else {
            reject(err);
          }
          return;
        }

        console.log(`✅ Created user: ${provider.firstName} ${provider.lastName} (${provider.email})`);

        // Insert service provider profile
        const profileId = uuidv4();
        db.run(
          `INSERT INTO service_provider_profiles (
            id, user_id, business_name, service_category, description,
            experience_years, hourly_rate, city, neighborhood,
            phone_number, email, is_active, rating, total_reviews,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            profileId,
            userId,
            provider.businessName,
            provider.category,
            provider.description,
            provider.experienceYears,
            provider.hourlyRate,
            provider.city,
            provider.neighborhood,
            provider.phone,
            provider.email,
            1, // is_active
            4.5, // default rating
            0, // total_reviews
            now,
            now
          ],
          function(err) {
            if (err) {
              reject(err);
            } else {
              console.log(`   📋 Created profile: ${provider.businessName} - ${provider.city}${provider.neighborhood ? ', ' + provider.neighborhood : ''}`);
              resolve(true);
            }
          }
        );
      }
    );
  });
}

async function createAllProviders() {
  console.log('🚀 Starting provider creation...\n');
  
  let created = 0;
  let skipped = 0;

  for (const provider of providers) {
    try {
      const result = await createProvider(provider);
      if (result) {
        created++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`❌ Error creating provider ${provider.email}:`, error.message);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   ✅ Created: ${created} providers`);
  console.log(`   ⚠️  Skipped: ${skipped} providers (already exist)`);
  console.log(`   📍 Locations:`);
  console.log(`      - София, Младост 1: 1 provider (Електротехник)`);
  console.log(`      - София, Люлин: 1 provider (Водопроводчик)`);
  console.log(`      - София, Лозенец: 1 provider (Почистване)`);
  console.log(`      - Пловдив: 1 provider (Климатик)`);
  console.log(`      - Варна: 1 provider (Бояджия)`);
  console.log('\n🔐 All test accounts use password: Test123!');
  console.log('\n✨ You can now test location filtering on the homepage!');

  db.close();
}

createAllProviders();
