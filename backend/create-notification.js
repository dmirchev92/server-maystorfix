const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'servicetext_pro',
  user: 'servicetextpro',
  password: 'C58acfd5c!'
});

async function createNotification() {
  try {
    const result = await pool.query(`
      INSERT INTO notifications (
        id, user_id, type, title, message, data, read, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING *
    `, [
      uuidv4(),
      '4461d442-720e-442f-b935-f595c1dc5d97',
      'case_completed',
      'Завършена: TE',
      'Заявката "TE" от Danail Mirchev е завършена. Моля оценете получената услуга.',
      JSON.stringify({
        caseId: '8f062189-278f-47bc-b339-d2dbb60744a2',
        providerId: 'a2daa3b4-388c-4c13-a376-960b69f3c47c',
        action: 'review_service'
      }),
      false
    ]);
    
    console.log('✅ Notification created:', result.rows[0]);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createNotification();
