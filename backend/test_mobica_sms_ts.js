// Test script to send SMS via Mobica using the TypeScript service
require('dotenv').config();

async function sendTestSMS() {
  // Import the compiled TypeScript service
  const { MobicaService } = require('./dist/services/MobicaService');
  
  const mobicaService = new MobicaService();
  
  console.log('🔧 Testing Mobica Service');
  console.log('Service configured:', mobicaService.isServiceConfigured());
  console.log('');

  const phoneNumber = '+359889665486';
  const testMessage = 'Test SMS #2 from MaystorFix! Phone as INTEGER fix applied. 🚀';
  
  console.log('📱 Sending test SMS to:', phoneNumber);
  console.log('Message:', testMessage);
  console.log('');

  try {
    const result = await mobicaService.sendSMS(phoneNumber, testMessage, `test_${Date.now()}`);
    
    console.log('📥 Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
      console.log('✅ SUCCESS! SMS sent successfully!');
      console.log('Message ID:', result.messageId);
      console.log('Check your phone at +359889665486');
    } else {
      console.log('❌ FAILED!');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ ERROR:', error.message);
  }
}

// Run the test
sendTestSMS();
