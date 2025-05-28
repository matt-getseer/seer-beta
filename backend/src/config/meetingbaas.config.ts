import dotenv from 'dotenv';

dotenv.config();

export const MeetingBaasConfig = {
  client: {
    apiKey: process.env.MEETINGBAAS_API_KEY!,
    baseUrl: process.env.MEETINGBAAS_API_URL || 'https://api.meetingbaas.com',
  },
  bot: {
    defaultName: "Seer Meeting Bot",
    defaultWebhookUrl: `${process.env.BASE_URL || 'http://localhost:3001'}/api/meetingbaas/webhooks`,
    recordingMode: "speaker_view" as const,
    speechToText: {
      provider: "deepgram" as const,
      apiKey: process.env.DEEPGRAM_API_KEY,
    },
    automaticLeave: {
      nooneJoinedTimeout: 300, // 5 minutes
      waitingRoomTimeout: 120, // 2 minutes
    },
  },
  calendar: {
    autoScheduling: true, // Enable automatic scheduling of recordings
    syncInterval: 300000, // 5 minutes in milliseconds
  },
  webhook: {
    verificationEnabled: false, // Simplified for now
    retryAttempts: 3,
    retryDelay: 2000, // 2 seconds
    idempotencyTtl: 86400000, // 24 hours
  },
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    },
  },
} as const;

// Validation
if (!MeetingBaasConfig.client.apiKey) {
  throw new Error('MEETINGBAAS_API_KEY is required');
}

export type MeetingBaasConfigType = typeof MeetingBaasConfig; 