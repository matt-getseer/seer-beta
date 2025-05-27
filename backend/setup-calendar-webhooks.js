const axios = require('axios');
require('dotenv').config();

const MEETINGBAAS_API_URL = process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com';
const MEETINGBAAS_API_KEY = process.env.MEETINGBAAS_API_KEY;

// Your webhook endpoint URL - update this with your actual domain
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://your-domain.com/api/meetings/webhook';

async function setupCalendarWebhooks() {
  try {
    console.log('Setting up calendar webhooks with MeetingBaas...');
    console.log('API URL:', MEETINGBAAS_API_URL);
    console.log('Webhook URL:', WEBHOOK_URL);
    
    if (!MEETINGBAAS_API_KEY) {
      throw new Error('MEETINGBAAS_API_KEY not found in environment variables');
    }

    // Configure calendar webhooks
    const response = await axios.post(
      `${MEETINGBAAS_API_URL}/bots/webhooks/calendar`,
      {
        webhook_url: WEBHOOK_URL,
        events: ['calendar.sync_events', 'event.updated', 'event.deleted', 'event.added']
      },
      {
        headers: {
          'x-meeting-baas-api-key': MEETINGBAAS_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Calendar webhooks configured successfully!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error setting up calendar webhooks:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.error('Authentication failed. Please check your MEETINGBAAS_API_KEY.');
    } else if (error.response?.status === 404) {
      console.error('Endpoint not found. The calendar webhook API might not be available yet.');
    }
  }
}

// Also try to get current webhook configuration
async function getWebhookConfig() {
  try {
    console.log('\nChecking current webhook configuration...');
    
    const response = await axios.get(
      `${MEETINGBAAS_API_URL}/bots/webhooks/calendar`,
      {
        headers: {
          'x-meeting-baas-api-key': MEETINGBAAS_API_KEY
        }
      }
    );

    console.log('Current webhook config:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('Error getting webhook config:', error.response?.data || error.message);
  }
}

async function main() {
  await getWebhookConfig();
  await setupCalendarWebhooks();
}

main(); 