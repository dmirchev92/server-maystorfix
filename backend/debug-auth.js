// Debug Authentication - Test Login Directly
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');

async function debugAuth() {
  console.log('🔍 Debugging authentication...');
  
  const db = new sqlite3.Database(dbPath);
  
  try {
    // 1. Check if user exists
    console.log('📋 Step 1: Checking if admin user exists...');
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

    if (!user) {
      console.log('❌ User not found in database');
      return;
    }

    console.log('✅ User found:', {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      is_active: user.is_active,
      is_gdpr_compliant: user.is_gdpr_compliant
    });

    // 2. Test password verification
    console.log('\n🔐 Step 2: Testing password verification...');
    const testPassword = 'Admin123!';
    const isPasswordValid = await bcrypt.compare(testPassword, user.password_hash);
    
    console.log('Password test result:', isPasswordValid ? '✅ Valid' : '❌ Invalid');
    
    if (!isPasswordValid) {
      console.log('❌ Password hash mismatch!');
      console.log('Stored hash (first 20 chars):', user.password_hash.substring(0, 20) + '...');
      
      // Try creating a new hash to compare
      const newHash = await bcrypt.hash(testPassword, 12);
      console.log('New hash (first 20 chars):', newHash.substring(0, 20) + '...');
      return;
    }

    // 3. Check status conditions
    console.log('\n📊 Step 3: Checking user status conditions...');
    
    const statusCheck = user.status !== 'deleted';
    console.log('Status check (not deleted):', statusCheck ? '✅ Pass' : '❌ Fail');
    
    const activeCheck = user.is_active === 1;
    console.log('Active check:', activeCheck ? '✅ Pass' : '❌ Fail');
    
    const gdprCheck = user.is_gdpr_compliant === 1;
    console.log('GDPR check:', gdprCheck ? '✅ Pass' : '❌ Fail');

    // 4. Test the exact query that AuthService uses
    console.log('\n🔍 Step 4: Testing AuthService query...');
    const authServiceUser = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM users WHERE email = ? AND status != "deleted"',
        ['admin@servicetextpro.com'],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (authServiceUser) {
      console.log('✅ AuthService query successful');
      console.log('User data for AuthService:', {
        id: authServiceUser.id,
        email: authServiceUser.email,
        role: authServiceUser.role,
        status: authServiceUser.status
      });
    } else {
      console.log('❌ AuthService query failed - user not found');
    }

    // 5. Summary
    console.log('\n📋 AUTHENTICATION DEBUG SUMMARY:');
    console.log('================================');
    console.log('User exists:', user ? '✅' : '❌');
    console.log('Password valid:', isPasswordValid ? '✅' : '❌');
    console.log('Status not deleted:', statusCheck ? '✅' : '❌');
    console.log('User active:', activeCheck ? '✅' : '❌');
    console.log('GDPR compliant:', gdprCheck ? '✅' : '❌');
    console.log('AuthService query works:', authServiceUser ? '✅' : '❌');
    
    if (user && isPasswordValid && statusCheck && activeCheck && gdprCheck && authServiceUser) {
      console.log('\n🎉 ALL CHECKS PASSED! Login should work.');
      console.log('If login still fails, the issue is in the AuthService code or database connection.');
    } else {
      console.log('\n❌ Some checks failed. Login will not work until these are fixed.');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    db.close();
  }
}

debugAuth().catch(console.error);
