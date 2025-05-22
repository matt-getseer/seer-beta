import { useState, useEffect } from 'react';
import { X } from 'phosphor-react';
import axios from 'axios';
import { useAuth } from '@clerk/clerk-react';
import { format } from 'date-fns';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface MeetingChange {
  id: string;
  meetingId: string;
  changeType: string;
  eventId: string | null;
  changeData: any;
  previousTitle: string | null;
  previousDate: Date | null;
  previousDuration: number | null;
  newTitle: string | null;
  newDate: Date | null;
  newDuration: number | null;
  createdAt: string;
}

interface MeetingChangesModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingId: string;
}

const MeetingChangesModal = ({ isOpen, onClose, meetingId }: MeetingChangesModalProps) => {
  const [changes, setChanges] = useState<MeetingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();

  useEffect(() => {
    const fetchChanges = async () => {
      if (!isOpen || !meetingId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const token = await getToken();
        
        const response = await axios.get(`${API_URL}/api/meetings/${meetingId}/changes`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        setChanges(response.data);
      } catch (error) {
        console.error('Error fetching meeting changes:', error);
        setError('Failed to load meeting changes. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchChanges();
  }, [isOpen, meetingId, getToken]);

  if (!isOpen) {
    return null;
  }

  // Helper function to format the change type for display
  const formatChangeType = (changeType: string) => {
    switch (changeType) {
      case 'updated':
        return 'Updated';
      case 'deleted':
        return 'Deleted';
      case 'synced':
        return 'Synced';
      default:
        return changeType.charAt(0).toUpperCase() + changeType.slice(1);
    }
  };

  // Helper function to format dates
  const formatDate = (date: string | Date | null) => {
    if (!date) return 'N/A';
    
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return format(dateObj, 'MMM d, yyyy h:mm a');
  };

  // Helper function to format duration
  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return 'N/A';
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-semibold text-gray-800">Meeting Change History</h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-4 overflow-auto flex-1">
          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading meeting changes...</p>
            </div>
          ) : error ? (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
              <p>{error}</p>
            </div>
          ) : changes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No changes have been recorded for this meeting.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {changes.map((change) => (
                <div key={change.id} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        change.changeType === 'updated' 
                          ? 'bg-blue-100 text-blue-800'
                          : change.changeType === 'deleted'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {formatChangeType(change.changeType)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(change.createdAt)}
                    </div>
                  </div>
                  
                  {(change.previousTitle || change.newTitle) && (
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Title</h4>
                      {change.previousTitle && (
                        <div className="text-sm">
                          <span className="text-gray-500">Previous: </span>
                          <span className="text-red-500 line-through">{change.previousTitle}</span>
                        </div>
                      )}
                      {change.newTitle && (
                        <div className="text-sm">
                          <span className="text-gray-500">New: </span>
                          <span className="text-green-500">{change.newTitle}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {(change.previousDate || change.newDate) && (
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Date</h4>
                      {change.previousDate && (
                        <div className="text-sm">
                          <span className="text-gray-500">Previous: </span>
                          <span className="text-red-500 line-through">{formatDate(change.previousDate)}</span>
                        </div>
                      )}
                      {change.newDate && (
                        <div className="text-sm">
                          <span className="text-gray-500">New: </span>
                          <span className="text-green-500">{formatDate(change.newDate)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {(change.previousDuration || change.newDuration) && (
                    <div className="mb-2">
                      <h4 className="text-sm font-medium text-gray-700">Duration</h4>
                      {change.previousDuration && (
                        <div className="text-sm">
                          <span className="text-gray-500">Previous: </span>
                          <span className="text-red-500 line-through">{formatDuration(change.previousDuration)}</span>
                        </div>
                      )}
                      {change.newDuration && (
                        <div className="text-sm">
                          <span className="text-gray-500">New: </span>
                          <span className="text-green-500">{formatDuration(change.newDuration)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingChangesModal; 