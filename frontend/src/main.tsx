import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'

// Initialize Sentry asynchronously to reduce initial bundle size
import { initSentry } from './utils/sentry'
initSentry().catch(console.warn)

// Import CSS - make sure Tailwind is imported properly
import './output.css'
import App from './App.tsx'
import AuthCallback from './AuthCallback.tsx'

// Lazy load pages for code splitting
const Overview = lazy(() => import('./components/pages/Overview.tsx'))
const Team = lazy(() => import('./components/pages/Team.tsx'))
const Meetings = lazy(() => import('./components/pages/Meetings.tsx'))
const Settings = lazy(() => import('./components/pages/Settings.tsx'))
const MeetingOverview = lazy(() => import('./components/pages/MeetingOverview.tsx'))
const TeamMember = lazy(() => import('./components/pages/TeamMember.tsx'))

// Import layout (keep this as regular import since it's used on every page)
import MainLayout from './components/layout/MainLayout.tsx'

// Loading component for Suspense fallback
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

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
          <Suspense fallback={<LoadingSpinner />}>
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
          </Suspense>
        </ClerkProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

createRoot(document.getElementById('root')!).render(<Root />);
