import { useState } from 'react';
import { useParams } from 'react-router-dom';

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  joinDate: string;
  bio?: string;
  wins?: string[];
  areasForSupport?: string[];
  actionItems?: string[];
  recentActivity?: {
    date: string;
    action: string;
    details: string;
  }[];
}

const TeamMember = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  
  // Mock data - in a real app, you would fetch this from an API
  const teamMember: TeamMember = {
    id: parseInt(id || '1'),
    name: 'John Doe',
    email: 'john.doe@example.com',
    role: 'Senior Developer',
    department: 'Engineering',
    joinDate: '2023-03-15',
    bio: 'John is a senior developer with over 8 years of experience in web development. He specializes in React, TypeScript, and Node.js. He has been leading the frontend team for our core product.',
    wins: [
      'Successfully led the migration from Angular to React',
      'Improved application performance by 40%',
      'Mentored 3 junior developers'
    ],
    areasForSupport: [
      'Needs additional resources for the mobile app project',
      'Would benefit from advanced TypeScript training',
      'Requires a dedicated QA resource for the next sprint'
    ],
    actionItems: [
      'Complete code reviews for the authentication module by Friday',
      'Schedule 1:1 meetings with team members',
      'Document the new component library',
      'Present the new architecture at the next all-hands'
    ],
    recentActivity: [
      {
        date: '2025-05-18',
        action: 'Meeting Attended',
        details: 'Weekly Team Sync'
      },
      {
        date: '2025-05-15',
        action: 'Task Completed',
        details: 'Implement user authentication'
      },
      {
        date: '2025-05-12',
        action: 'Document Updated',
        details: 'API Documentation'
      },
      {
        date: '2025-05-10',
        action: 'Meeting Attended',
        details: 'Product Planning'
      }
    ]
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#171717]">{teamMember.name}</h1>
        <div className="text-gray-500 mt-1">
          {teamMember.role} • {teamMember.department} • {teamMember.email}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Team member since {new Date(teamMember.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex -mb-px">
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'details'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'activity'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {activeTab === 'details' ? (
          <div className="p-6">
            {/* Bio - Full Width */}
            <div className="mb-8">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Bio</h2>
              <div className="bg-gray-50 p-4 rounded-lg text-gray-700">
                {teamMember.bio}
              </div>
            </div>
            
            {/* Three Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Wins */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Wins</h2>
                <div className="bg-green-50 p-4 rounded-lg">
                  <ul className="space-y-2">
                    {teamMember.wins?.map((win, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-green-500 mr-2">•</span>
                        <span className="text-gray-700">{win}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Areas for Support */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Areas for Support</h2>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <ul className="space-y-2">
                    {teamMember.areasForSupport?.map((area, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-yellow-500 mr-2">•</span>
                        <span className="text-gray-700">{area}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              
              {/* Action Items */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Action Items</h2>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <ul className="space-y-2">
                    {teamMember.actionItems?.map((item, index) => (
                      <li key={index} className="flex items-start">
                        <span className="text-blue-500 mr-2">•</span>
                        <span className="text-gray-700">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
            <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
              {teamMember.recentActivity?.map((activity, index) => (
                <div key={index} className="p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-gray-900">{activity.action}</div>
                      <div className="text-sm text-gray-500">{activity.details}</div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(activity.date).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMember; 