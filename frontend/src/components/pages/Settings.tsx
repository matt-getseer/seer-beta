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
  
  // AI Processing states
  const [useCustomAI, setUseCustomAI] = useState(false);
  const [aiProvider, setAiProvider] = useState('anthropic'); // 'anthropic' or 'openai'
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [aiSaveError, setAiSaveError] = useState('');

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
    
    // Get AI settings
    const fetchAISettings = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/users/ai-settings`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const settings = response.data;
        if (settings) {
          setUseCustomAI(settings.useCustomAI || false);
          setAiProvider(settings.aiProvider || 'anthropic');
          // We don't retrieve API keys for security reasons, only the status
        }
      } catch (error) {
        console.error('Error fetching AI settings:', error);
      }
    };
    
    fetchAISettings();
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
  
  const saveAISettings = async () => {
    try {
      setIsSavingAI(true);
      setAiSaveSuccess(false);
      setAiSaveError('');
      
      const token = await getToken();
      const payload = {
        useCustomAI,
        aiProvider,
        apiKey: aiProvider === 'anthropic' ? anthropicApiKey : openaiApiKey
      };
      
      await axios.post(`${API_URL}/api/users/ai-settings`, payload, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setAiSaveSuccess(true);
      
      // Clear API keys from state for security
      setAnthropicApiKey('');
      setOpenaiApiKey('');
      
      // Set timeout to clear success message after 3 seconds
      setTimeout(() => {
        setAiSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving AI settings:', error);
      setAiSaveError('Failed to save AI settings. Please try again.');
    } finally {
      setIsSavingAI(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#171717] mb-6">Settings</h1>
      
      <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
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
        
        {/* New AI Processing Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[#171717]">AI Processing</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#171717]">Use Custom AI Credentials</h3>
                <p className="text-sm text-gray-500">Process meeting data using your own AI provider credentials</p>
              </div>
              <button 
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${useCustomAI ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => setUseCustomAI(!useCustomAI)}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${useCustomAI ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>
            
            {useCustomAI && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">AI Provider</label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-blue-600"
                        checked={aiProvider === 'anthropic'}
                        onChange={() => setAiProvider('anthropic')}
                      />
                      <span className="ml-2 text-sm text-gray-700">Anthropic Claude</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-blue-600"
                        checked={aiProvider === 'openai'}
                        onChange={() => setAiProvider('openai')}
                      />
                      <span className="ml-2 text-sm text-gray-700">OpenAI GPT</span>
                    </label>
                  </div>
                </div>
                
                {aiProvider === 'anthropic' ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Anthropic API Key
                    </label>
                    <input
                      type="password"
                      value={anthropicApiKey}
                      onChange={(e) => setAnthropicApiKey(e.target.value)}
                      placeholder="sk-ant-..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Your API key will be encrypted and securely stored
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      OpenAI API Key
                    </label>
                    <input
                      type="password"
                      value={openaiApiKey}
                      onChange={(e) => setOpenaiApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Your API key will be encrypted and securely stored
                    </p>
                  </div>
                )}
                
                {aiSaveError && (
                  <p className="text-sm text-red-600">{aiSaveError}</p>
                )}
                
                {aiSaveSuccess && (
                  <p className="text-sm text-green-600">AI settings saved successfully!</p>
                )}
                
                <button
                  onClick={saveAISettings}
                  disabled={isSavingAI || (aiProvider === 'anthropic' && !anthropicApiKey) || (aiProvider === 'openai' && !openaiApiKey)}
                  className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
                    ${isSavingAI || (aiProvider === 'anthropic' && !anthropicApiKey) || (aiProvider === 'openai' && !openaiApiKey)
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    }`}
                >
                  {isSavingAI ? 'Saving...' : 'Save AI Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings; 