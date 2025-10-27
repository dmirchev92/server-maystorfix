const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: process.env.POSTGRES_PORT || 5432,
  database: process.env.POSTGRES_DB || 'servicetext_pro',
  user: process.env.POSTGRES_USER || 'servicetextpro',
  password: process.env.POSTGRES_PASSWORD
});

async function checkNeighborhood() {
  try {
    console.log('🔍 Checking service provider profiles...\n');

    const result = await pool.query(`
      SELECT 
        u.id,
        u.email,
        u.first_name,
        u.last_name,
        spp.business_name,
        spp.service_category,
        spp.city,
        spp.neighborhood,
        spp.created_at
      FROM users u
      LEFT JOIN service_provider_profiles spp ON u.id = spp.user_id
      WHERE u.role = 'tradesperson'
      ORDER BY u.created_at DESC
      LIMIT 5
    `);

    console.log(`Found ${result.rows.length} service providers:\n`);

    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.email}`);
      console.log(`   Name: ${row.first_name} ${row.last_name}`);
      console.log(`   Business: ${row.business_name || 'N/A'}`);
      console.log(`   Category: ${row.service_category || 'N/A'}`);
      console.log(`   City: ${row.city || 'N/A'}`);
      console.log(`   Neighborhood: "${row.neighborhood || ''}" ${row.neighborhood ? '✅' : '❌ EMPTY'}`);
      console.log(`   Created: ${row.created_at}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkNeighborhood();
