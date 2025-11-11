/**
 * Create Test Cases for Bidding System
 * Creates 3 cases for each budget range from test@abv.bg
 */

const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD || 'C58acfd5c!'
});

const budgetRanges = [
  '1-250',
  '250-500',
  '500-750',
  '750-1000',
  '1000-1250',
  '1250-1500',
  '1500-1750',
  '1750-2000',
  '2000+'
];

const serviceTypes = [
  'electrician',
  'plumber',
  'carpenter',
  'painter',
  'cleaner',
  'hvac',
  'locksmith',
  'gardener',
  'mason'
];

const cities = ['София', 'Пловдив', 'Варна'];
const neighborhoods = ['Център', 'Люлин', 'Младост'];

async function createTestCases() {
  const client = await pool.connect();
  
  try {
    console.log('\n=== Creating Test Cases ===\n');
    
    // Get test user
    const userResult = await client.query(
      `SELECT id, email FROM users WHERE email = 'test@abv.bg'`
    );
    
    if (userResult.rows.length === 0) {
      console.log('❌ User test@abv.bg not found. Creating user...');
      
      // Create test user
      const userId = uuidv4();
      await client.query(`
        INSERT INTO users (
          id, email, password_hash, role, status, first_name, last_name,
          phone_number, subscription_tier_id, subscription_status,
          data_retention_until, is_gdpr_compliant, created_at, updated_at
        ) VALUES (
          $1, 'test@abv.bg', '$2b$10$test', 'customer', 'active', 'Test', 'User',
          '0888123456', 'free', 'active',
          NOW() + INTERVAL '2 years', true, NOW(), NOW()
        )
      `, [userId]);
      
      console.log('✅ Created test user: test@abv.bg\n');
    }
    
    const customerId = userResult.rows.length > 0 ? userResult.rows[0].id : userId;
    
    let totalCreated = 0;
    
    // Create 3 cases for each budget range
    for (let i = 0; i < budgetRanges.length; i++) {
      const budgetRange = budgetRanges[i];
      const serviceType = serviceTypes[i];
      
      console.log(`Creating 3 cases for budget range: ${budgetRange}`);
      
      for (let j = 1; j <= 3; j++) {
        const caseId = uuidv4();
        const city = cities[j % cities.length];
        const neighborhood = neighborhoods[j % neighborhoods.length];
        
        await client.query(`
          INSERT INTO marketplace_service_cases (
            id,
            service_type,
            description,
            preferred_date,
            preferred_time,
            priority,
            city,
            neighborhood,
            phone,
            customer_id,
            customer_name,
            customer_email,
            customer_phone,
            is_open_case,
            assignment_type,
            status,
            budget,
            bidding_enabled,
            max_bidders,
            current_bidders,
            bidding_closed,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
          )
        `, [
          caseId,
          serviceType,
          `Test case ${j} for ${budgetRange} BGN range - ${serviceType} service needed`,
          'ASAP',
          'Flexible',
          'normal',
          city,
          neighborhood,
          '0888123456',
          customerId,
          'Test User',
          'test@abv.bg',
          '0888123456',
          true,
          'open',
          'pending',
          budgetRange,
          true,
          3,
          0,
          false,
          new Date(),
          new Date()
        ]);
        
        totalCreated++;
        console.log(`  ✓ Created case ${j}: ${serviceType} in ${city} (${budgetRange} BGN)`);
      }
      
      console.log('');
    }
    
    console.log(`\n✅ Successfully created ${totalCreated} test cases!\n`);
    
    // Show summary
    console.log('=== Summary by Budget Range ===\n');
    const summary = await client.query(`
      SELECT 
        budget,
        COUNT(*) as case_count,
        STRING_AGG(DISTINCT service_type, ', ') as services
      FROM marketplace_service_cases
      WHERE customer_email = 'test@abv.bg'
      GROUP BY budget
      ORDER BY 
        CASE 
          WHEN budget = '1-250' THEN 1
          WHEN budget = '250-500' THEN 2
          WHEN budget = '500-750' THEN 3
          WHEN budget = '750-1000' THEN 4
          WHEN budget = '1000-1250' THEN 5
          WHEN budget = '1250-1500' THEN 6
          WHEN budget = '1500-1750' THEN 7
          WHEN budget = '1750-2000' THEN 8
          WHEN budget = '2000+' THEN 9
          ELSE 10
        END
    `);
    
    console.table(summary.rows);
    
  } catch (error) {
    console.error('❌ Error creating test cases:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the script
createTestCases()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
