import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Import CSS - make sure Tailwind is imported properly
import './output.css'
import App from './App.tsx'
import AuthCallback from './AuthCallback.tsx'

// Import pages
import Overview from './components/pages/Overview.tsx'
import Team from './components/pages/Team.tsx'
import Meetings from './components/pages/Meetings.tsx'
import Settings from './components/pages/Settings.tsx'

// Import layout
import MainLayout from './components/layout/MainLayout.tsx'

// Get your Clerk publishable key from environment variables
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in your .env file.");
}

const clerkConfig = {
  publishableKey,
  redirectUrl: '/api/auth',
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/',
  afterSignUpUrl: '/'
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider {...clerkConfig}>
        <Routes>
          <Route path="/" element={
            <MainLayout>
              <Overview />
            </MainLayout>
          } />
          <Route path="/team" element={
            <MainLayout>
              <Team />
            </MainLayout>
          } />
          <Route path="/meetings" element={
            <MainLayout>
              <Meetings />
            </MainLayout>
          } />
          <Route path="/settings" element={
            <MainLayout>
              <Settings />
            </MainLayout>
          } />
          <Route path="/sign-in" element={<App />} />
          <Route path="/sign-up" element={<App />} />
          <Route path="/api/auth" element={<AuthCallback />} />
        </Routes>
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
)
