// Clear Security Blocks - Reset all failed attempts
const SecurityEnhancementService = require('./src/services/SecurityEnhancementServiceSimple').default;

async function clearAllBlocks() {
  console.log('🧹 Clearing all security blocks...\n');

  try {
    const securityService = SecurityEnhancementService.getInstance();
    
    // Clear all failed attempts
    await securityService.cleanup();
    
    // Also manually clear the in-memory store
    securityService.failedAttempts?.clear();
    
    console.log('✅ All security blocks cleared!');
    console.log('📋 You can now:');
    console.log('   - Login with any email address');
    console.log('   - Test the new improved security logic');
    console.log('   - Try different users from the same IP');
    console.log('');
    console.log('🔒 NEW SECURITY LOGIC:');
    console.log('   📧 Email-based: 5 attempts → 15 minutes lock');
    console.log('   🌐 IP-based: 20 attempts → 1 hour restriction');
    console.log('   👥 Multiple users from same IP: Now supported!');
    
  } catch (error) {
    console.error('❌ Failed to clear blocks:', error.message);
  }
}

clearAllBlocks().catch(console.error);
