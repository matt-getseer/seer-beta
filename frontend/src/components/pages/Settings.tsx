import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

const Settings = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const { getToken } = useAuth();

  useEffect(() => {
    // Check if Google account is connected
    const checkGoogleConnection = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/auth/google/status`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true // Include cookies
        });
        setGoogleConnected(response.data.connected);
      } catch (error) {
        console.error('Error checking Google connection:', error);
      } finally {
        setLoading(false);
      }
    };

    checkGoogleConnection();
  }, [getToken]);

  const handleGoogleAuth = async () => {
    if (googleConnected) {
      // Disconnect Google account
      try {
        const token = await getToken();
        await axios.post(`${API_URL}/api/auth/google/disconnect`, {}, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true // Include cookies
        });
        setGoogleConnected(false);
      } catch (error) {
        console.error('Error disconnecting Google account:', error);
      }
    } else {
      // Connect Google account - get token first
      try {
        setLoading(true);
        const token = await getToken();
        
        // First send token to backend to store in session
        const response = await axios.post(`${API_URL}/api/auth/google/prepare`, { token }, { 
          withCredentials: true // Include cookies
        });
        
        // Then redirect to Google OAuth URL
        if (response.data.authUrl) {
          window.location.href = response.data.authUrl;
        } else {
          console.error('No auth URL returned from server');
          setLoading(false);
        }
      } catch (error) {
        console.error('Error starting Google auth flow:', error);
        setLoading(false);
      }
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171717] mb-6">Settings</h1>
      
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#171717] mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#171717]">Email Notifications</h3>
                <p className="text-sm text-gray-500">Receive email notifications for important updates</p>
              </div>
              <button 
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${emailNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => setEmailNotifications(!emailNotifications)}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${emailNotifications ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#171717]">Push Notifications</h3>
                <p className="text-sm text-gray-500">Receive push notifications for important updates</p>
              </div>
              <button 
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${pushNotifications ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => setPushNotifications(!pushNotifications)}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${pushNotifications ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-medium text-[#171717] mb-4">Integrations</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#171717]">Google Calendar</h3>
                <p className="text-sm text-gray-500">Connect your Google account to create Google Meet links for meetings</p>
              </div>
              {loading ? (
                <div className="animate-pulse h-10 w-24 bg-gray-200 rounded-md"></div>
              ) : (
                <button 
                  onClick={handleGoogleAuth}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    googleConnected 
                      ? 'bg-red-50 text-red-700 hover:bg-red-100' 
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {googleConnected ? 'Disconnect' : 'Connect'}
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#171717] mb-4">Appearance</h2>
          
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-[#171717]">Dark Mode</h3>
              <p className="text-sm text-gray-500">Switch between light and dark themes</p>
            </div>
            <button 
              className={`relative inline-flex h-6 w-11 items-center rounded-full ${darkMode ? 'bg-blue-600' : 'bg-gray-200'}`}
              onClick={() => setDarkMode(!darkMode)}
            >
              <span 
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${darkMode ? 'translate-x-6' : 'translate-x-1'}`} 
              />
            </button>
          </div>
        </div>
        
        <div className="p-6">
          <h2 className="text-lg font-medium text-[#171717] mb-4">Account</h2>
          
          <div className="space-y-4">
            <button className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Update Profile
            </button>
            
            <button className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 