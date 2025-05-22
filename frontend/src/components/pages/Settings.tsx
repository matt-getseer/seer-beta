import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

const Settings = () => {
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Add refresh trigger counter
  const { getToken } = useAuth();
  
  // Disconnect confirmation dialog
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  const [showAIDisconnectDialog, setShowAIDisconnectDialog] = useState(false);
  
  // AI Processing states
  const [useCustomAI, setUseCustomAI] = useState(false);
  const [aiProvider, setAiProvider] = useState('anthropic'); // 'anthropic' or 'openai'
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isSavingAI, setIsSavingAI] = useState(false);
  const [aiSaveSuccess, setAiSaveSuccess] = useState(false);
  const [aiSaveError, setAiSaveError] = useState('');
  const [aiConnected, setAiConnected] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    // Check if Google account is connected directly from the database
    const checkGoogleConnection = async () => {
      try {
        setLoading(true);
        const token = await getToken();
        console.log('Checking Google connection status...');
        const response = await axios.get(`${API_URL}/api/auth/google/status`, {
          headers: {
            Authorization: `Bearer ${token}`
          },
          withCredentials: true // Include cookies
        });
        console.log('Google connection response:', response.data);
        
        // Force the state to update based on API response
        if (response.data && typeof response.data.connected === 'boolean') {
          setGoogleConnected(response.data.connected);
          console.log('Setting Google connected to:', response.data.connected);
        } else {
          console.warn('Unexpected API response format:', response.data);
        }
      } catch (error) {
        console.error('Error checking Google connection from database:', error);
      } finally {
        setLoading(false);
      }
    };

    checkGoogleConnection();
    
    // Get AI settings
    const fetchAISettings = async () => {
      try {
        setAiLoading(true);
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
          setAiConnected(settings.hasValidApiKey || false);
          // We don't retrieve API keys for security reasons, only the status
        }
      } catch (error) {
        console.error('Error fetching AI settings:', error);
      } finally {
        setAiLoading(false);
      }
    };
    
    fetchAISettings();
  }, [getToken, refreshTrigger]); // Add refreshTrigger as dependency

  // Function to manually refresh connection status
  const refreshConnectionStatus = () => {
    console.log('Manually refreshing connection status...');
    setRefreshTrigger(prev => prev + 1);
  };

  const handleGoogleAuth = async () => {
    if (googleConnected) {
      // For disconnect, show confirmation dialog instead of immediate action
      setShowDisconnectDialog(true);
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
  
  const confirmDisconnectGoogle = async () => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
      setShowDisconnectDialog(false);
    }
  };
  
  
  const confirmDisconnectAI = async () => {
    try {
      setAiLoading(true);
      const token = await getToken();
      await axios.post(`${API_URL}/api/users/ai-settings`, {
        useCustomAI: false,
        aiProvider: aiProvider,
        apiKey: "" // Empty API key to disconnect
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      // Turn off the toggle and set connection status to false
      setUseCustomAI(false);
      setAiConnected(false);
      // Clear API keys from state for security
      setAnthropicApiKey('');
      setOpenaiApiKey('');
    } catch (error) {
      console.error('Error disconnecting AI provider:', error);
    } finally {
      setAiLoading(false);
      setShowAIDisconnectDialog(false);
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
      setAiConnected(true);
      
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
                <div className="flex items-center space-x-3">
                  <div className="flex items-center">
                    <div className={`h-2.5 w-2.5 rounded-full mr-2 ${googleConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-xs font-medium text-gray-600">
                      {googleConnected ? 'Connected' : 'Not connected'}
                    </span>
                  </div>
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
                  <button
                    onClick={refreshConnectionStatus}
                    className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                    title="Refresh connection status"
                  >
                    ↻
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* New AI Processing Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-[#171717]">Custom AI Key</h2>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-[#171717]">Use your own AI account</h3>
                <p className="text-sm text-gray-500">Process meeting data using either ChatGPT or Anthropic</p>
              </div>
              <button 
                className={`relative inline-flex h-6 w-11 items-center rounded-full ${useCustomAI ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => {
                  // If turning off and currently connected, show disconnect dialog
                  if (useCustomAI && aiConnected) {
                    setShowAIDisconnectDialog(true);
                  } else {
                    // Otherwise just toggle the state
                    setUseCustomAI(!useCustomAI);
                  }
                }}
              >
                <span 
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${useCustomAI ? 'translate-x-6' : 'translate-x-1'}`} 
                />
              </button>
            </div>
            
            {useCustomAI && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-md">
                {/* AI API Connection status */}
                <div className={`flex items-center justify-between ${!aiConnected ? 'mb-4 pb-4 border-b border-gray-200' : ''}`}>
                  <div>
                    <h3 className="text-sm font-medium text-gray-700">Connection Status</h3>
                  </div>
                  {aiLoading ? (
                    <div className="animate-pulse h-10 w-24 bg-gray-200 rounded-md"></div>
                  ) : (
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center">
                        <div className={`h-2.5 w-2.5 rounded-full mr-2 ${aiConnected ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                        <span className="text-xs font-medium text-gray-600">
                          {aiConnected ? `Connected (${aiProvider})` : 'Not connected'}
                        </span>
                      </div>
                      {aiConnected && (
                        <button 
                          onClick={() => setShowAIDisconnectDialog(true)}
                          className="px-4 py-2 rounded-md text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100"
                        >
                          Disconnect
                        </button>
                      )}
                      <button
                        onClick={refreshConnectionStatus}
                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200"
                        title="Refresh connection status"
                      >
                        ↻
                      </button>
                    </div>
                  )}
                </div>

                {!aiConnected && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Disconnect confirmation dialog */}
      {showDisconnectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Disconnect Google Calendar?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will remove the Google Calendar integration. You won't be able to create Google Meet links for meetings until you reconnect.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDisconnectDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnectGoogle}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* AI Disconnect confirmation dialog */}
      {showAIDisconnectDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Disconnect AI Provider?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will remove your custom AI credentials. Meeting data processing will use default system credentials until you reconnect.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowAIDisconnectDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDisconnectAI}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings; 