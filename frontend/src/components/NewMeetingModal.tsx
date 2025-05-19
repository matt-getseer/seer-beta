import { useState, useEffect } from 'react';
import { X } from 'phosphor-react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface Team {
  id: string;
  name: string;
}

interface NewMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMeetingCreated: () => void;
}

const NewMeetingModal = ({ isOpen, onClose, onMeetingCreated }: NewMeetingModalProps) => {
  const [title, setTitle] = useState('');
  const [teamMember, setTeamMember] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [duration, setDuration] = useState('60');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Team[]>([]);
  const { getToken } = useAuth();

  // Fetch team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/users/team`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setTeamMembers(response.data);
      } catch (error) {
        console.error('Error fetching team members:', error);
        setError('Failed to load team members');
      }
    };

    if (isOpen) {
      fetchTeamMembers();
    }
  }, [isOpen, getToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Format the date and time
      const dateTime = new Date(`${date}T${time}`);
      
      const token = await getToken();
      const response = await axios.post(
        `${API_URL}/api/meetings`,
        {
          title,
          teamMemberId: teamMember,
          date: dateTime.toISOString(),
          duration: parseInt(duration),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      setLoading(false);
      onMeetingCreated();
      onClose();
      
      // Reset form
      setTitle('');
      setTeamMember('');
      setDate('');
      setTime('');
      setDuration('60');
    } catch (error) {
      console.error('Error creating meeting:', error);
      setLoading(false);
      
      // Handle detailed error messages from API
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data;
        if (apiError.details) {
          setError(`${apiError.error}: ${apiError.details}`);
        } else if (apiError.note) {
          setError(`${apiError.error} - ${apiError.note}`);
        } else {
          setError(apiError.error || 'Failed to create meeting. Please try again.');
        }
      } else {
        setError('Failed to create meeting. Please try again.');
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">New Meeting</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {error && (
            <div className="mb-4 bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
              <p>{error}</p>
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Meeting Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Weekly Team Sync"
            />
          </div>

          <div className="mb-4">
            <label htmlFor="teamMember" className="block text-sm font-medium text-gray-700 mb-1">
              Team Member
            </label>
            <select
              id="teamMember"
              value={teamMember}
              onChange={(e) => setTeamMember(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">Select a team member</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-1">
                Time
              </label>
              <input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="mb-4">
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
              Duration (minutes)
            </label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
              <option value="120">2 hours</option>
            </select>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewMeetingModal; 