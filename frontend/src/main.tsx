import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

// Import CSS - make sure Tailwind is imported properly
import './output.css'
import App from './App.tsx'
import AuthCallback from './AuthCallback.tsx'

// Import pages
import Overview from './components/pages/Overview.tsx'
import Team from './components/pages/Team.tsx'
import Meetings from './components/pages/Meetings.tsx'
import Settings from './components/pages/Settings.tsx'
import MeetingOverview from './components/pages/MeetingOverview.tsx'
import TeamMember from './components/pages/TeamMember.tsx'

// Import layout
import MainLayout from './components/layout/MainLayout.tsx'

// Get your Clerk publishable key from environment variables
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error("Missing Clerk publishable key. Set VITE_CLERK_PUBLISHABLE_KEY in your .env file.");
}

// Component to handle invite redirect
function InviteRedirect() {
  const location = useLocation();
  const token = new URLSearchParams(location.search).get('token');
  
  // Store the token in sessionStorage for retrieval after auth
  if (token) {
    sessionStorage.setItem('invitationToken', token);
  }
  
  return <Navigate to="/sign-up" replace />;
}

const clerkConfig = {
  publishableKey,
  redirectUrl: '/api/auth',
  signInUrl: '/sign-in',
  signUpUrl: '/sign-up',
  afterSignInUrl: '/',
  afterSignUpUrl: '/'
};

// Export the root component for Fast Refresh to work properly
export default function Root() {
  return (
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
            <Route path="/team/:id" element={
              <MainLayout>
                <TeamMember />
              </MainLayout>
            } />
            <Route path="/meetings" element={
              <MainLayout>
                <Meetings />
              </MainLayout>
            } />
            <Route path="/meetings/:id" element={
              <MainLayout>
                <MeetingOverview />
              </MainLayout>
            } />
            <Route path="/settings" element={
              <MainLayout>
                <Settings />
              </MainLayout>
            } />
            <Route path="/invite" element={<InviteRedirect />} />
            <Route path="/sign-in" element={<App />} />
            <Route path="/sign-up" element={<App />} />
            <Route path="/api/auth" element={<AuthCallback />} />
          </Routes>
        </ClerkProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
