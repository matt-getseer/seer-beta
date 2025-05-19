import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { userApi } from './utils/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const registerUser = async () => {
      if (!isLoaded || !isSignedIn || !user || isRegistering) return;
      
      try {
        setIsRegistering(true);
        
        // Get the primary email
        const primaryEmail = user.primaryEmailAddress?.emailAddress;
        if (!primaryEmail) {
          throw new Error('No primary email found');
        }
        
        // Get user's full name
        const fullName = user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim();
        
        // Register the user with our backend
        await userApi.registerUser({
          email: primaryEmail,
          name: fullName || null
        });
        
        console.log('User registered successfully');
        // Redirect to the home page
        navigate('/');
      } catch (err) {
        console.error('Failed to register user:', err);
        setError('Failed to complete registration. Please try again.');
      } finally {
        setIsRegistering(false);
      }
    };

    registerUser();
  }, [isLoaded, isSignedIn, user, navigate, isRegistering]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Registration Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Processing authentication...</h2>
        <p className="text-gray-600">Please wait while we verify your credentials.</p>
      </div>
    </div>
  );
};

export default AuthCallback; 