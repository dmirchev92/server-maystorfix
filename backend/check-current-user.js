// Check Current Admin User in Database
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(process.cwd(), 'data', 'servicetext_pro.db');

async function checkCurrentUser() {
  console.log('🔍 Checking current admin user in database...');
  console.log('📁 Database path:', dbPath);
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // Get the admin user
    const user = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ?',
        ['admin@servicetextpro.com'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (user) {
      console.log('✅ Admin user found in database:');
      console.log('   ID:', user.id);
      console.log('   Email:', user.email);
      console.log('   First Name:', user.first_name);
      console.log('   Last Name:', user.last_name);
      console.log('   Role:', user.role);
      console.log('   Status:', user.status);
      console.log('   GDPR Compliant:', user.is_gdpr_compliant);
      
      if (user.role !== 'admin') {
        console.log('❌ PROBLEM: Role is not "admin"!');
        console.log('   Current role:', user.role);
        console.log('   Expected role: admin');
        
        // Fix the role
        console.log('🔧 Fixing user role...');
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE users SET role = ? WHERE email = ?',
            ['admin', 'admin@servicetextpro.com'],
            function(err) {
              if (err) reject(err);
              else {
                console.log('✅ Role updated to admin');
                resolve();
              }
            }
          );
        });
      } else {
        console.log('✅ Role is correctly set to "admin"');
      }
    } else {
      console.log('❌ Admin user not found in database');
    }
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    db.close();
  }
}

checkCurrentUser().catch(console.error);
