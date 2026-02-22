/**
 * One-time migration: Encrypt existing plaintext phone numbers in missed_calls table
 * Run with: npx ts-node scripts/encrypt-phone-numbers.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import { encryptPhone, isEncrypted } from '../src/utils/phonePrivacy';

async function migrate() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'servicetext_pro',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'C58acfd5c!',
  });

  console.log('🔐 Starting phone number encryption migration...');

  const result = await pool.query(
    "SELECT id, phone_number FROM missed_calls WHERE phone_number != 'REDACTED' AND phone_number IS NOT NULL"
  );

  let encrypted = 0;
  let skipped = 0;

  for (const row of result.rows) {
    if (isEncrypted(row.phone_number)) {
      skipped++;
      continue;
    }

    const encryptedPhone = encryptPhone(row.phone_number);
    await pool.query(
      'UPDATE missed_calls SET phone_number = $1 WHERE id = $2',
      [encryptedPhone, row.id]
    );
    console.log(`  ✅ Encrypted: ${row.id} (${row.phone_number.slice(0, 4)}***)`);
    encrypted++;
  }

  console.log(`\n🔐 Migration complete: ${encrypted} encrypted, ${skipped} already encrypted`);
  await pool.end();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
