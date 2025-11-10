// Test script to send SMS via Mobica
require('dotenv').config();
const axios = require('axios');

const MOBICA_API_URL = 'https://gate.mobica.bg/v2/multi/json/sms.php';

async function sendTestSMS() {
  const username = process.env.MOBICA_USERNAME;
  const password = process.env.MOBICA_PASSWORD;
  const senderId = process.env.MOBICA_SENDER_ID || 'MaystorFix';
  
  console.log('🔧 Mobica Configuration:');
  console.log('Username:', username);
  console.log('Sender ID:', senderId);
  console.log('');

  // Format phone number (remove + and ensure it starts with 359)
  const phoneNumber = '+359889665486';
  const formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
  
  const testMessage = 'Test SMS from MaystorFix! Your Mobica account is working correctly. 🎉';
  
  const request = {
    user: username,
    pass: password,
    sms: [
      {
        idd: `test_${Date.now()}`,
        phone: formattedPhone,
        message: testMessage,
        from: senderId
      }
    ]
  };

  console.log('📱 Sending test SMS to:', formattedPhone);
  console.log('Message:', testMessage);
  console.log('');

  try {
    const response = await axios.post(MOBICA_API_URL, request, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    console.log('📥 Response received:');
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.code === '1004') {
      console.log('✅ SUCCESS! SMS sent successfully!');
      console.log('Check your phone at +359889665486');
    } else {
      console.log('❌ FAILED! Error code:', response.data.code);
      console.log('Description:', response.data.description);
    }
  } catch (error) {
    console.error('❌ ERROR sending SMS:');
    console.error('Message:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
sendTestSMS();
