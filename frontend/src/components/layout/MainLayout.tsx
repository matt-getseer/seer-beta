import type { ReactNode } from 'react';
import Navbar from './Navbar';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { Navigate } from 'react-router-dom';

interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <>
      <SignedIn>
        <div className="flex flex-col min-h-screen bg-white">
          <Navbar />
          <main className="flex-1 overflow-auto pt-20 px-6 pb-6">
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