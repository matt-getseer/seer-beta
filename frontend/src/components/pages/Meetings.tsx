import { useState, useEffect } from 'react';
import { MagnifyingGlass, CaretDown, Plus } from 'phosphor-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import NewMeetingModal from '../NewMeetingModal';
import type { TeamMember } from '../../interfaces';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface Meeting {
  id: string;
  title: string;
  teamMemberId: string;
  teamMember?: string; // Will be populated from user data
  date: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  googleMeetLink?: string;
}

// User interface
interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

const Meetings = () => {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { getToken } = useAuth();
  
  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      
      const response = await axios.get(`${API_URL}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      setCurrentUser(response.data);
      setIsAdmin(response.data.role === 'admin');
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };
  
  // Fetch meetings from API
  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      
      const response = await axios.get(`${API_URL}/api/meetings`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Get team members to display names
      const teamResponse = await axios.get(`${API_URL}/api/users/team`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const teamMembersMap = new Map();
      teamResponse.data.forEach((member: TeamMember) => {
        teamMembersMap.set(member.id, member.name);
      });
      
      // Add team member names to meetings
      const meetingsWithNames = response.data.map((meeting: Meeting) => ({
        ...meeting,
        teamMember: teamMembersMap.get(meeting.teamMemberId) || 'Unknown',
        // Format date for display
        date: new Date(meeting.date).toLocaleString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        }),
        // Format duration for display
        duration: `${meeting.duration} min${meeting.duration !== 1 ? 's' : ''}`
      }));
      
      setMeetings(meetingsWithNames);
      setError(null);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      setError('Failed to load meetings');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchCurrentUser();
    fetchMeetings();
  }, []);
  
  // Filter meetings based on search term and active tab
  const filteredMeetings = meetings.filter(meeting => {
    // First filter by tab
    if (activeTab !== 'all' && meeting.status !== activeTab) {
      return false;
    }
    
    // Then filter by search term
    const searchTermLower = searchTerm.toLowerCase();
    return (
      meeting.title.toLowerCase().includes(searchTermLower) ||
      meeting.teamMember?.toLowerCase().includes(searchTermLower) ||
      meeting.date.toLowerCase().includes(searchTermLower) ||
      meeting.status.toLowerCase().includes(searchTermLower)
    );
  });

  // Get status style based on meeting status
  const getStatusStyle = (status: string, processingStatus?: string) => {
    // If processing is pending or in progress, show a special status
    if (processingStatus === 'pending' || processingStatus === 'processing') {
      return 'bg-yellow-100 text-yellow-800';
    }
    
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Get display text for status
  const getStatusText = (status: string, processingStatus?: string) => {
    if (status === 'completed') {
      if (processingStatus === 'pending') {
        return 'Processing Pending';
      } else if (processingStatus === 'processing') {
        return 'Processing';
      } else if (processingStatus === 'failed') {
        return 'Processing Failed';
      }
    }
    
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Handle new meeting created
  const handleMeetingCreated = () => {
    fetchMeetings();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-[#171717] mb-6">Meetings</h1>
      
      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <div className="flex -mb-px">
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'all'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('all')}
          >
            All
          </button>
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'scheduled'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('scheduled')}
          >
            Scheduled
          </button>
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'completed'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </button>
        </div>
      </div>
      
      {/* Search and Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlass size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <div className="flex items-center">
          <div className="relative inline-block text-left mr-3">
            <button className="inline-flex justify-between items-center w-48 rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none">
              <span>Sort by: Date</span>
              <CaretDown size={20} weight="fill" />
            </button>
          </div>
          
          {isAdmin && (
            <button
              className="inline-flex items-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              onClick={() => setShowNewMeetingModal(true)}
            >
              <Plus size={20} className="mr-2" />
              New Meeting
            </button>
          )}
        </div>
      </div>
      
      {/* Error State */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>{error}</p>
          <button 
            onClick={fetchMeetings}
            className="underline text-red-700 font-medium mt-2"
          >
            Try Again
          </button>
        </div>
      )}
      
      {/* Loading State */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading meetings...</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No meetings found</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meeting name</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team member</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredMeetings.map((meeting) => (
                  <tr key={meeting.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-medium text-[#171717]">
                        <Link to={`/meetings/${meeting.id}`} className="hover:text-indigo-600 hover:underline">
                          {meeting.title}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {meeting.teamMember}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {meeting.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                      {meeting.duration}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusStyle(meeting.status, meeting.processingStatus)}`}>
                        {getStatusText(meeting.status, meeting.processingStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      
      {/* New Meeting Modal */}
      <NewMeetingModal 
        isOpen={showNewMeetingModal}
        onClose={() => setShowNewMeetingModal(false)}
        onMeetingCreated={handleMeetingCreated}
      />
    </div>
  );
};

export default Meetings; 