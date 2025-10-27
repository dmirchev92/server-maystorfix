const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD
});

async function createTestUsers() {
  try {
    console.log('🧪 Creating test users...\n');

    // Hash password
    const hashedPassword = await bcrypt.hash('TestPass123!', 10);

    // 1. Create test customer
    const customerId = uuidv4();
    const customerResult = await pool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
      RETURNING id, email, role
    `, [
      customerId,
      'test-customer@example.com',
      hashedPassword,
      'Test',
      'Customer',
      '+359888111222',
      'customer'
    ]);

    console.log('✅ Test Customer Created:');
    console.log(`   Email: test-customer@example.com`);
    console.log(`   Password: TestPass123!`);
    console.log(`   ID: ${customerResult.rows[0].id}\n`);

    // 2. Create test service provider
    const providerId = uuidv4();
    const providerResult = await pool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name
      RETURNING id, email, role
    `, [
      providerId,
      'test-provider@example.com',
      hashedPassword,
      'Test',
      'Provider',
      '+359888333444',
      'service_provider'
    ]);

    console.log('✅ Test Service Provider Created:');
    console.log(`   Email: test-provider@example.com`);
    console.log(`   Password: TestPass123!`);
    console.log(`   ID: ${providerId}\n`);

    // 3. Create service provider profile
    await pool.query(`
      INSERT INTO service_provider_profiles (
        user_id, business_name, description, service_categories, 
        service_area, years_experience, hourly_rate, availability_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        business_name = EXCLUDED.business_name,
        description = EXCLUDED.description
    `, [
      providerId,
      'Test Service Company',
      'Test service provider for testing purposes',
      JSON.stringify(['plumbing', 'electrical']),
      JSON.stringify(['Sofia', 'Plovdiv']),
      5,
      50.00,
      'available'
    ]);

    console.log('✅ Service Provider Profile Created\n');

    // 4. Create another customer for testing
    const customer2Id = uuidv4();
    const customer2Result = await pool.query(`
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash
      RETURNING id, email, role
    `, [
      customer2Id,
      'test-customer2@example.com',
      hashedPassword,
      'Test2',
      'Customer2',
      '+359888555666',
      'customer'
    ]);

    console.log('✅ Test Customer 2 Created:');
    console.log(`   Email: test-customer2@example.com`);
    console.log(`   Password: TestPass123!`);
    console.log(`   ID: ${customer2Result.rows[0].id}\n`);

    console.log('🎉 All test users created successfully!\n');
    console.log('📝 Test Credentials:');
    console.log('   Customer 1: test-customer@example.com / TestPass123!');
    console.log('   Customer 2: test-customer2@example.com / TestPass123!');
    console.log('   Provider: test-provider@example.com / TestPass123!\n');

  } catch (error) {
    console.error('❌ Error creating test users:', error);
  } finally {
    await pool.end();
  }
}

createTestUsers();
