import 'express-session';

declare module 'express-session' {
  interface SessionData {
    authToken?: string;
    testValue?: string;
  }
} 