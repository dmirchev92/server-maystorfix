const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Connect to database
const dbPath = path.join(__dirname, 'data', 'servicetext_pro.db');
const db = new sqlite3.Database(dbPath);

console.log('🔧 Creating test users for ServiceText Pro...');

// Test users data
const testUsers = [
  {
    id: uuidv4(),
    email: 'test@servicetext.pro',
    password: 'password123',
    role: 'service_provider',
    firstName: 'Тест',
    lastName: 'Потребител',
    phoneNumber: '+359888000001',
    businessName: 'Тест Електро ЕООД',
    serviceCategory: 'electrician',
    description: 'Тестов електротехник за демонстрация на системата.',
    experienceYears: 10,
    hourlyRate: 45.00,
    city: 'София',
    neighborhood: 'Център',
    address: 'ул. Тестова 1',
    rating: 4.8,
    totalReviews: 50
  },
  {
    id: uuidv4(),
    email: 'admin@servicetext.pro',
    password: 'admin123',
    role: 'service_provider',
    firstName: 'Админ',
    lastName: 'Потребител',
    phoneNumber: '+359888000002',
    businessName: 'Админ Услуги ООД',
    serviceCategory: 'handyman',
    description: 'Административен потребител за тестване.',
    experienceYears: 15,
    hourlyRate: 50.00,
    city: 'София',
    neighborhood: 'Лозенец',
    address: 'ул. Админска 2',
    rating: 5.0,
    totalReviews: 25
  },
  {
    id: uuidv4(),
    email: 'customer@servicetext.pro',
    password: 'customer123',
    role: 'customer',
    firstName: 'Клиент',
    lastName: 'Тестов',
    phoneNumber: '+359888000003'
  }
];

async function createTestUsers() {
  try {
    console.log('📝 Creating test users...');
    
    for (const userData of testUsers) {
      // Hash password
      const passwordHash = await bcrypt.hash(userData.password, 10);
      
      // Insert user
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR REPLACE INTO users (id, email, password_hash, role, first_name, last_name, phone_number, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userData.id,
            userData.email,
            passwordHash,
            userData.role,
            userData.firstName,
            userData.lastName,
            userData.phoneNumber,
            new Date().toISOString()
          ],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Insert service provider profile if applicable
      if (userData.role === 'service_provider' && userData.businessName) {
        await new Promise((resolve, reject) => {
          db.run(
            `INSERT OR REPLACE INTO service_provider_profiles (
              id, user_id, business_name, service_category, description, experience_years,
              hourly_rate, city, neighborhood, address, rating, total_reviews, 
              is_verified, is_active, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              uuidv4(),
              userData.id,
              userData.businessName,
              userData.serviceCategory,
              userData.description,
              userData.experienceYears,
              userData.hourlyRate,
              userData.city,
              userData.neighborhood,
              userData.address,
              userData.rating,
              userData.totalReviews,
              1, // is_verified
              1, // is_active
              new Date().toISOString(),
              new Date().toISOString()
            ],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      console.log(`✅ Created user: ${userData.email} (${userData.role})`);
    }

    console.log('🎯 Adding service categories...');
    
    const categories = [
      { id: uuidv4(), name: 'electrician', name_bg: 'Електротехник', description: 'Електротехнически услуги', icon_name: 'electric' },
      { id: uuidv4(), name: 'plumber', name_bg: 'Водопроводчик', description: 'Водопроводни услуги', icon_name: 'plumbing' },
      { id: uuidv4(), name: 'hvac', name_bg: 'Климатик', description: 'Климатични системи', icon_name: 'hvac' },
      { id: uuidv4(), name: 'carpenter', name_bg: 'Дърводелец', description: 'Дърводелски услуги', icon_name: 'carpenter' },
      { id: uuidv4(), name: 'painter', name_bg: 'Бояджия', description: 'Боядисване', icon_name: 'painter' },
      { id: uuidv4(), name: 'locksmith', name_bg: 'Ключар', description: 'Ключарски услуги', icon_name: 'locksmith' },
      { id: uuidv4(), name: 'cleaner', name_bg: 'Почистване', description: 'Почистващи услуги', icon_name: 'cleaner' },
      { id: uuidv4(), name: 'gardener', name_bg: 'Градинар', description: 'Градинарски услуги', icon_name: 'gardener' },
      { id: uuidv4(), name: 'handyman', name_bg: 'Майстор за всичко', description: 'Общи ремонти', icon_name: 'handyman' },
      { id: uuidv4(), name: 'appliance_repair', name_bg: 'Ремонт на уреди', description: 'Ремонт на домакински уреди', icon_name: 'appliance' }
    ];

    for (const category of categories) {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT OR IGNORE INTO service_categories (id, name, name_bg, description, icon_name, created_at) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [category.id, category.name, category.name_bg, category.description, category.icon_name, new Date().toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    console.log('✅ Test data created successfully!');
    console.log('\n🔑 Test Login Credentials:');
    console.log('Service Provider: test@servicetext.pro / password123');
    console.log('Admin User: admin@servicetext.pro / admin123');
    console.log('Customer: customer@servicetext.pro / customer123');
    console.log('\n📊 Database populated with:');
    console.log(`- ${testUsers.length} test users`);
    console.log(`- ${categories.length} service categories`);
    console.log(`- ${testUsers.filter(u => u.role === 'service_provider').length} service provider profiles`);
    
  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    db.close();
  }
}

createTestUsers();
