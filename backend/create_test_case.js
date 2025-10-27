const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'password'
});

async function createTestCase() {
  try {
    const caseId = uuidv4();
    const now = new Date().toISOString();
    
    console.log('Creating test unassigned case...');
    
    await pool.query(`
      INSERT INTO marketplace_service_cases (
        id, service_type, description, preferred_date, preferred_time,
        priority, city, neighborhood, phone, additional_details, 
        provider_id, provider_name, is_open_case, assignment_type, status,
        customer_id, category, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    `, [
      caseId,
      'Test Service - API Fix Verification',
      'This is a test case to verify the API fix for showing unassigned cases in the mobile app.',
      '2025-10-25',
      'morning',
      'normal',
      'София',
      'Център',
      '+359888123456',
      'Test case created via script',
      null,  // provider_id = NULL (unassigned)
      null,  // provider_name = NULL
      1,     // is_open_case = true
      'open', // assignment_type = 'open'
      'pending',
      null,  // customer_id (can be null for test)
      'general',
      now,
      now
    ]);
    
    console.log('✅ Test case created successfully!');
    console.log('Case ID:', caseId);
    console.log('Status: pending');
    console.log('Provider ID: NULL (unassigned)');
    console.log('\nThis case should now appear in the "Налични" tab of the mobile app!');
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createTestCase();
