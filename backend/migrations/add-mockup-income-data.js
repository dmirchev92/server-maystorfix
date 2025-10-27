/**
 * Migration: Add mockup income data for 2023 and 2024
 * For user: mirchev92@yahoo.com
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database path from user's global rules
const DB_PATH = path.join(__dirname, '..', 'data', 'servicetext_pro.db');

console.log('💰 Adding mockup income data for 2023 and 2024...');
console.log('📂 Database path:', DB_PATH);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Payment methods
const paymentMethods = ['cash', 'card', 'bank_transfer', 'online'];

// Function to generate random amount between min and max
function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

// Function to get random payment method
function randomPaymentMethod() {
  return paymentMethods[Math.floor(Math.random() * paymentMethods.length)];
}

db.serialize(() => {
  // First, get the user ID for mirchev92@yahoo.com
  db.get("SELECT id FROM users WHERE email = ?", ['mirchev92@yahoo.com'], (err, user) => {
    if (err) {
      console.error('❌ Error finding user:', err);
      db.close();
      process.exit(1);
    }

    if (!user) {
      console.error('❌ User mirchev92@yahoo.com not found in database');
      db.close();
      process.exit(1);
    }

    const providerId = user.id;
    console.log('✅ Found user:', providerId);

    const incomeData = [];

    // Generate 2023 data (12 months)
    for (let month = 0; month < 12; month++) {
      const numTransactions = Math.floor(Math.random() * 8) + 3; // 3-10 transactions per month
      
      for (let i = 0; i < numTransactions; i++) {
        const day = Math.floor(Math.random() * 28) + 1; // 1-28 to avoid month issues
        const recordedAt = `2023-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`;
        
        incomeData.push({
          id: uuidv4(),
          case_id: uuidv4(), // Mock case ID
          provider_id: providerId,
          customer_id: null,
          amount: randomAmount(50, 500),
          currency: 'BGN',
          payment_method: randomPaymentMethod(),
          notes: `Mockup transaction for 2023-${String(month + 1).padStart(2, '0')}`,
          recorded_at: recordedAt,
          created_at: recordedAt,
          updated_at: recordedAt
        });
      }
    }

    // Generate 2024 data (12 months)
    for (let month = 0; month < 12; month++) {
      const numTransactions = Math.floor(Math.random() * 10) + 5; // 5-14 transactions per month
      
      for (let i = 0; i < numTransactions; i++) {
        const day = Math.floor(Math.random() * 28) + 1;
        const recordedAt = `2024-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`;
        
        incomeData.push({
          id: uuidv4(),
          case_id: uuidv4(), // Mock case ID
          provider_id: providerId,
          customer_id: null,
          amount: randomAmount(80, 600),
          currency: 'BGN',
          payment_method: randomPaymentMethod(),
          notes: `Mockup transaction for 2024-${String(month + 1).padStart(2, '0')}`,
          recorded_at: recordedAt,
          created_at: recordedAt,
          updated_at: recordedAt
        });
      }
    }

    console.log(`📊 Generated ${incomeData.length} mockup transactions`);

    // Insert all income data
    const insertSQL = `
      INSERT INTO case_income (
        id, case_id, provider_id, customer_id, amount, currency, 
        payment_method, notes, recorded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const stmt = db.prepare(insertSQL);
    let insertedCount = 0;

    incomeData.forEach((income) => {
      stmt.run(
        income.id,
        income.case_id,
        income.provider_id,
        income.customer_id,
        income.amount,
        income.currency,
        income.payment_method,
        income.notes,
        income.recorded_at,
        income.created_at,
        income.updated_at,
        (err) => {
          if (err) {
            console.error('❌ Error inserting income:', err);
          } else {
            insertedCount++;
          }
        }
      );
    });

    stmt.finalize((err) => {
      if (err) {
        console.error('❌ Error finalizing statement:', err);
      } else {
        console.log(`✅ Inserted ${insertedCount} income records`);
        
        // Calculate and display summary
        db.all(`
          SELECT 
            strftime('%Y', recorded_at) as year,
            COUNT(*) as count,
            SUM(amount) as total,
            AVG(amount) as average
          FROM case_income
          WHERE provider_id = ?
          GROUP BY strftime('%Y', recorded_at)
          ORDER BY year
        `, [providerId], (err, summary) => {
          if (err) {
            console.error('❌ Error getting summary:', err);
          } else {
            console.log('\n📊 Income Summary:');
            summary.forEach(row => {
              console.log(`  ${row.year}: ${row.count} transactions, ${row.total.toFixed(2)} BGN total, ${row.average.toFixed(2)} BGN average`);
            });
          }

          db.close((err) => {
            if (err) {
              console.error('❌ Error closing database:', err);
            } else {
              console.log('\n✅ Mockup data added successfully!');
              console.log('💰 You can now test the year dropdown in the dashboard.');
            }
          });
        });
      }
    });
  });
});
