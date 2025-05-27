const axios = require('axios');
require('dotenv').config();

const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

// Your webhook endpoint URL - update this with your actual domain
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://localhost:3001/api/meetings/webhook';

async function setupAccountWebhook() {
  try {
    console.log('Setting up account-level webhook URL for calendar events...');
    console.log('API URL:', MEETINGBAAS_API_URL);
    console.log('Webhook URL:', WEBHOOK_URL);
    
    if (!MEETINGBAAS_API_KEY) {
      throw new Error('MEETINGBAAS_API_KEY not found in environment variables');
    }

    // Set account-level webhook URL
    const response = await axios.post(
      `${MEETINGBAAS_API_URL}/accounts/webhook_url`,
      {
        webhook_url: WEBHOOK_URL
      },
      {
        headers: {
          'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Account webhook URL configured successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error setting up account webhook:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('Authentication failed. Please check your MEETINGBAAS_API_KEY.');
    } else if (error.response?.status === 404) {
      console.error('Endpoint not found. Please check the API documentation.');
    }
  }
}

// Get current account webhook configuration
async function getAccountWebhook() {
  try {
    console.log('\nChecking current account webhook configuration...');
    
    const response = await axios.get(
      `${MEETINGBAAS_API_URL}/accounts/webhook_url`,
      {
        headers: {
          'x-meeting-baas-api-key': MEETINGBAAS_API_KEY
        }
      }
    );

    console.log('Current account webhook URL:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error getting account webhook config:', error.response?.data || error.message);
  }
}

async function main() {
  await getAccountWebhook();
  await setupAccountWebhook();
  console.log('\n📝 Note: Calendar events will now be sent to your webhook endpoint.');
  console.log('Try changing a meeting in Google Calendar to test!');
}

main(); 