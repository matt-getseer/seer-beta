const axios = require('axios');
require('dotenv').config();

const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

async function checkEndpoint(endpoint, method = 'GET') {
  try {
    console.log(`\nTrying ${method} ${endpoint}...`);
    
    const config = {
      method,
      url: `${MEETINGBAAS_API_URL}${endpoint}`,
      headers: {
        'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const response = await axios(config);
    console.log(`✅ ${method} ${endpoint} - Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log(`❌ ${method} ${endpoint} - Status: ${error.response?.status || 'Error'}`);
    if (error.response?.data) {
      console.log('Error data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('Error:', error.message);
    }
  }
}

async function main() {
  console.log('Exploring MeetingBaas webhook endpoints...');
  
  // Try various webhook-related endpoints
  await checkEndpoint('/webhooks');
  await checkEndpoint('/bots/webhooks');
  await checkEndpoint('/calendar/webhooks');
  await checkEndpoint('/webhooks/calendar');
  await checkEndpoint('/webhooks/config');
  await checkEndpoint('/webhook/config');
  await checkEndpoint('/bots/webhook/config');
  
  // Try POST methods on some endpoints
  await checkEndpoint('/webhooks', 'POST');
  await checkEndpoint('/bots/webhooks', 'POST');
  
  // Check if there's a general API info endpoint
  await checkEndpoint('/');
  await checkEndpoint('/api');
  await checkEndpoint('/docs');
}

main(); 