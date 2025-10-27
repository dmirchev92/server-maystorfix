/**
 * Add mockup income data for mirchev92@yahoo.com
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'servicetext_pro.db');

console.log('💰 Adding income data for mirchev92@yahoo.com...');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error opening database:', err);
    process.exit(1);
  }
  console.log('✅ Connected to database');
});

// Get the provider ID for mirchev92@yahoo.com
db.get("SELECT id FROM users WHERE email = 'mirchev92@yahoo.com'", async (err, provider) => {
  if (err || !provider) {
    console.error('❌ Provider mirchev92@yahoo.com not found');
    db.close();
    process.exit(1);
  }

  const providerId = provider.id;
  console.log('👤 Found provider ID:', providerId);

  // Payment methods with realistic distribution
  const paymentMethods = [
    { method: 'cash', weight: 50 },
    { method: 'card', weight: 30 },
    { method: 'bank_transfer', weight: 15 },
    { method: 'online', weight: 5 }
  ];

  // Generate data for past 6 months
  const mockupData = [];
  const now = new Date();
  
  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const month = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const monthStr = month.toISOString().slice(0, 7);
    
    // Random number of cases per month (3-8 cases)
    const casesThisMonth = Math.floor(Math.random() * 6) + 3;
    
    console.log(`📅 Generating ${casesThisMonth} cases for ${monthStr}...`);
    
    for (let i = 0; i < casesThisMonth; i++) {
      // Random day in the month
      const day = Math.floor(Math.random() * 28) + 1;
      const recordedAt = new Date(month.getFullYear(), month.getMonth(), day, 
                                   Math.floor(Math.random() * 24), 
                                   Math.floor(Math.random() * 60));
      
      // Random amount between 50 and 500 BGN
      const amount = Math.floor(Math.random() * 450) + 50;
      
      // Select payment method based on weights
      const rand = Math.random() * 100;
      let cumulative = 0;
      let selectedMethod = 'cash';
      
      for (const pm of paymentMethods) {
        cumulative += pm.weight;
        if (rand <= cumulative) {
          selectedMethod = pm.method;
          break;
        }
      }
      
      mockupData.push({
        id: uuidv4(),
        case_id: uuidv4(),
        provider_id: providerId,
        customer_id: null,
        amount: amount,
        currency: 'BGN',
        payment_method: selectedMethod,
        notes: `Mockup payment ${i + 1} for ${monthStr}`,
        recorded_at: recordedAt.toISOString(),
        created_at: recordedAt.toISOString(),
        updated_at: recordedAt.toISOString()
      });
    }
  }

  console.log(`\n✅ Generated ${mockupData.length} mockup income records`);
  
  // Calculate totals
  const totalAmount = mockupData.reduce((sum, item) => sum + item.amount, 0);
  const methodCounts = {};
  mockupData.forEach(item => {
    methodCounts[item.payment_method] = (methodCounts[item.payment_method] || 0) + 1;
  });
  
  console.log('\n📊 Summary:');
  console.log(`   Total Income: ${totalAmount.toFixed(2)} BGN`);
  console.log(`   Total Cases: ${mockupData.length}`);
  console.log(`   Average: ${(totalAmount / mockupData.length).toFixed(2)} BGN`);
  console.log('\n   Payment Methods:');
  Object.entries(methodCounts).forEach(([method, count]) => {
    console.log(`     - ${method}: ${count} cases`);
  });

  // Insert mockup data
  console.log('\n💾 Inserting mockup data into database...');
  
  const insertStmt = db.prepare(`
    INSERT INTO case_income (
      id, case_id, provider_id, customer_id, amount, 
      currency, payment_method, notes, recorded_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let inserted = 0;
  mockupData.forEach((data, index) => {
    insertStmt.run(
      data.id,
      data.case_id,
      data.provider_id,
      data.customer_id,
      data.amount,
      data.currency,
      data.payment_method,
      data.notes,
      data.recorded_at,
      data.created_at,
      data.updated_at,
      (err) => {
        if (err) {
          console.error(`❌ Error inserting record ${index + 1}:`, err.message);
        } else {
          inserted++;
          if (inserted === mockupData.length) {
            insertStmt.finalize();
            console.log(`\n✅ Successfully inserted ${inserted} mockup records!`);
            console.log('\n🎉 Mockup data creation complete!');
            console.log('📊 Refresh your dashboard to see the data.');
            db.close();
          }
        }
      }
    );
  });
});
