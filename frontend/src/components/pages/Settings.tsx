import { useState } from 'react';

const Settings = () => {
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

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