import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, VideoCamera } from 'phosphor-react';
import { useAuth } from '@clerk/clerk-react';
import VideoPlayer from '../VideoPlayer';

// Use a direct URL reference instead of process.env
const API_URL = 'http://localhost:3001';

interface Meeting {
  id: string;
  title: string;
  teamMemberId: string;
  teamMember?: string;
  date: string;
  duration: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  processingStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  googleMeetLink?: string;
  executiveSummary?: string;
  wins?: string[];
  areasForSupport?: string[];
  actionItems?: string[];
  transcript?: string;
  recordingUrl?: string;
}

const MeetingOverview = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  
  useEffect(() => {
    const fetchMeeting = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        const response = await axios.get(`${API_URL}/api/meetings/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Get team member name
        const teamResponse = await axios.get(`${API_URL}/api/users/team`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        const teamMembersMap = new Map();
        teamResponse.data.forEach((member: any) => {
          teamMembersMap.set(member.id, member.name);
        });
        
        // Format date for display
        const meetingData = {
          ...response.data,
          teamMember: teamMembersMap.get(response.data.teamMemberId) || 'Unknown',
          date: new Date(response.data.date).toLocaleString('en-US', {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
          }),
          duration: `${response.data.duration} min${response.data.duration !== 1 ? 's' : ''}`
        };
        
        setMeeting(meetingData);
        setError(null);
      } catch (error) {
        console.error('Error fetching meeting:', error);
        setError('Failed to load meeting details');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchMeeting();
    }
  }, [id, getToken]);
  
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
  
  // Loading state
  if (loading) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Loading meeting details...</p>
      </div>
    );
  }
  
  // Error state
  if (error || !meeting) {
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
        <p>{error || 'Meeting not found'}</p>
        <Link to="/meetings" className="underline text-red-700 font-medium mt-2 inline-block">
          Back to Meetings
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2">
        <Link to="/meetings" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft size={16} className="mr-1" />
          Back to Meetings
        </Link>
      </div>
      
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#171717]">{meeting.title}</h1>
        <div className="text-gray-500 mt-1">
          {meeting.date} • {meeting.duration} • {meeting.teamMember}
        </div>
        <div className="mt-2 flex items-center">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            getStatusStyle(meeting.status, meeting.processingStatus)
          }`}>
            {getStatusText(meeting.status, meeting.processingStatus)}
          </span>
          
          {meeting.googleMeetLink && meeting.status === 'scheduled' && (
            <a 
              href={meeting.googleMeetLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="ml-3 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              <VideoCamera size={18} className="mr-1" />
              Join Google Meet
            </a>
          )}
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
              activeTab === 'transcript'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('transcript')}
            disabled={!meeting.transcript}
          >
            Transcript
          </button>
        </div>
      </div>
      
      {/* Tab Content */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {activeTab === 'details' ? (
          <div className="p-6">
            {/* Processing Status Message */}
            {(meeting.processingStatus === 'pending' || meeting.processingStatus === 'processing') && (
              <div className="mb-8 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                <p className="text-yellow-700">
                  {meeting.processingStatus === 'pending' 
                    ? 'This meeting is waiting to be processed. Check back later for the summary and transcript.' 
                    : 'This meeting is currently being processed. The summary and transcript will be available soon.'}
                </p>
              </div>
            )}
            
            {/* Failed Processing Message */}
            {meeting.processingStatus === 'failed' && (
              <div className="mb-8 bg-red-50 border-l-4 border-red-400 p-4 rounded">
                <p className="text-red-700">
                  There was an error processing this meeting. Please contact support for assistance.
                </p>
              </div>
            )}
            
            {/* Executive Summary - Full Width */}
            {meeting.executiveSummary ? (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Executive Summary</h2>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-700">
                  {meeting.executiveSummary}
                </div>
              </div>
            ) : meeting.processingStatus === 'completed' && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Executive Summary</h2>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-700 italic">
                  No summary available for this meeting.
                </div>
              </div>
            )}
            
            {/* Three Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Wins */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Wins</h2>
                <div className="bg-green-50 p-4 rounded-lg">
                  {meeting.wins && meeting.wins.length > 0 ? (
                    <ul className="space-y-2">
                      {meeting.wins.map((win, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-500 mr-2">•</span>
                          <span className="text-gray-700">{win}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No wins recorded</p>
                  )}
                </div>
              </div>
              
              {/* Areas for Support */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Areas for Support</h2>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  {meeting.areasForSupport && meeting.areasForSupport.length > 0 ? (
                    <ul className="space-y-2">
                      {meeting.areasForSupport.map((area, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-yellow-500 mr-2">•</span>
                          <span className="text-gray-700">{area}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No areas for support identified</p>
                  )}
                </div>
              </div>
              
              {/* Action Items */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Action Items</h2>
                <div className="bg-blue-50 p-4 rounded-lg">
                  {meeting.actionItems && meeting.actionItems.length > 0 ? (
                    <ul className="space-y-2">
                      {meeting.actionItems.map((item, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500 italic">No action items recorded</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            {/* Video Player - Only show if recording URL exists */}
            {meeting.recordingUrl ? (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recording</h2>
                <VideoPlayer 
                  videoUrl={meeting.recordingUrl} 
                  transcript={meeting.transcript} 
                />
              </div>
            ) : (meeting.status === 'completed' && meeting.processingStatus === 'completed') && (
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Recording</h2>
                <div className="bg-gray-50 p-4 rounded-lg text-gray-700 italic">
                  No recording available for this meeting.
                </div>
              </div>
            )}

            <h2 className="text-lg font-medium text-gray-900 mb-4">Transcript</h2>
            {meeting.transcript ? (
              <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-line text-gray-700">
                {meeting.transcript}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-gray-500 italic">
                No transcript available for this meeting.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetingOverview; 