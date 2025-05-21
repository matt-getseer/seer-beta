import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { userApi } from './utils/api';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessingInvite, setIsProcessingInvite] = useState(false);

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
        
        // Check for invitation token in sessionStorage first, then URL
        let invitationToken = sessionStorage.getItem('invitationToken');
        
        // Also check URL in case it was passed directly
        if (!invitationToken) {
          invitationToken = searchParams.get('invitation_token');
        }
        
        if (invitationToken) {
          await processInvitation(invitationToken);
          // Clear the token from storage after use
          sessionStorage.removeItem('invitationToken');
        } else {
          // Redirect to the home page if no invitation
          navigate('/');
        }
      } catch (err) {
        console.error('Failed to register user:', err);
        setError('Failed to complete registration. Please try again.');
      } finally {
        setIsRegistering(false);
      }
    };

    const processInvitation = async (token: string) => {
      try {
        setIsProcessingInvite(true);
        console.log('Processing invitation token:', token);
        
        // Check if user exists and has an ID
        if (!user || !user.id) {
          throw new Error('User information is not available');
        }
        
        console.log('Accepting invitation with Clerk ID:', user.id);
        
        // Accept the invitation
        const response = await userApi.acceptInvitation(token, user.id);
        
        console.log('Invitation accepted successfully:', response);
        
        // Redirect to the team page
        navigate('/team');
      } catch (err) {
        console.error('Failed to process invitation:', err);
        setError('Failed to accept the team invitation. It may be expired or invalid.');
      } finally {
        setIsProcessingInvite(false);
      }
    };

    registerUser();
  }, [isLoaded, isSignedIn, user, navigate, isRegistering, searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4 text-red-600">Authentication Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-4">Processing authentication...</h2>
        <p className="text-gray-600">
          {isProcessingInvite 
            ? "Please wait while we process your team invitation." 
            : "Please wait while we verify your credentials."}
        </p>
      </div>
    </div>
  );
};

export default AuthCallback; 