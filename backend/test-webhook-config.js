const axios = require('axios');
require('dotenv').config();

const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

async function testEndpoint(endpoint, method = 'GET', data = null) {
  try {
    console.log(`\n🔍 Testing ${method} ${endpoint}...`);
    
    const config = {
      method,
      url: `${MEETINGBAAS_API_URL}${endpoint}`,
      headers: {
        'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (data && method !== 'GET') {
      config.data = data;
    }

    const response = await axios(config);
    console.log(`✅ Success! Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return true;
    
  } catch (error) {
    console.log(`❌ Failed! Status: ${error.response?.status || 'Error'}`);
    if (error.response?.data) {
      console.log('Error:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
}

async function main() {
  console.log('🔧 Testing MeetingBaas webhook configuration endpoints...\n');
  
  // Test various webhook-related endpoints
  const endpoints = [
    '/accounts',
    '/accounts/webhook_url',
    '/webhooks',
    '/webhook',
    '/bots/webhook',
    '/settings/webhook',
    '/config/webhook'
  ];

  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }

  console.log('\n📋 Summary:');
  console.log('- You are already receiving bot webhooks (complete, bot.status_change)');
  console.log('- Calendar webhooks (calendar.sync_events) should come to the same endpoint');
  console.log('- If no calendar webhooks are coming, it might be because:');
  console.log('  1. No calendar is connected to MeetingBaas');
  console.log('  2. Calendar integration needs to be enabled');
  console.log('  3. The meeting was not created through MeetingBaas calendar integration');
}

main(); 