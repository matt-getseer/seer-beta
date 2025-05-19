import type { ReactNode } from 'react';
import Sidebar from './Sidebar';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <>
      <SignedIn>
        <div className="flex h-screen bg-white">
          <Sidebar />
          <main className="flex-1 overflow-auto p-6">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </SignedIn>
      
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  );
};

export default MainLayout; 