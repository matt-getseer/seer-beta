import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, VideoCamera, Check, Clock } from 'phosphor-react';
import { useAuth } from '@clerk/clerk-react';
import VideoPlayer from '../VideoPlayer';
import TaskSidebar from '../TaskSidebar';
import MeetingChangesModal from '../MeetingChangesModal';
import type { TeamMember, Task } from '../../interfaces';
import { meetingApi, userApi } from '../../utils/api';
import { useApiState } from '../../hooks/useApiState';
import { formatMeetingDateTime, formatDuration } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';
import { getAssignmentBadgeClass } from '../../utils/statusUtils';

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
  tasks?: Task[]; // Updated to use Task type
  transcript?: string;
  recordingUrl?: string;
}

const MeetingOverview = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const fromTeamMember = location.state?.from === 'teamMember';
  const teamMemberId = location.state?.teamMemberId;
  const [activeTab, setActiveTab] = useState('details');
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [{ loading, error }, { setLoading, setError }] = useApiState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [showChangesModal, setShowChangesModal] = useState(false);
  const { getToken } = useAuth();
  const [agenda, setAgenda] = useState<{
    phases: {
      name: string;
      items: string[];
    }[];
    note?: string;
    error?: string;
  } | null>(null);
  const [loadingAgenda, setLoadingAgenda] = useState(false);
  const [agendaError, setAgendaError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchMeeting = async () => {
      setLoading(true);
      try {
        const token = await getToken();
        
        // Get current user ID
        const currentUser = await userApi.getCurrentUser();
        setCurrentUserId(currentUser.id);
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
        
        setTeamMembers(teamResponse.data);
        
        const teamMembersMap = new Map();
        teamResponse.data.forEach((member: TeamMember) => {
          teamMembersMap.set(member.id, member.name);
        });
        
        // Process tasks - prefer structured tasksData if available
        let processedTasks = [];
        
        if (response.data.tasksData && response.data.tasksData.length > 0) {
          // We have the new structured format
          processedTasks = response.data.tasksData.map((item: Omit<Task, 'assigneeName'>) => ({
            id: item.id,
            text: item.text,
            status: item.status as 'incomplete' | 'complete',
            createdAt: item.createdAt,
            completedAt: item.completedAt,
            assignedTo: item.assignedTo,
            assigneeName: item.assignedTo === currentUser.id ? 'Me' : (item.assignedTo ? teamMembersMap.get(item.assignedTo) : undefined)
          }));
        } else if (response.data.actionItems && response.data.actionItems.length > 0) {
          // Fall back to legacy string array format if needed
          processedTasks = response.data.actionItems.map((item: string, index: number) => ({
            id: `legacy-${index}`,
            text: item,
            status: 'incomplete' as 'incomplete' | 'complete',
            createdAt: new Date().toISOString(),
            assignedTo: response.data.teamMemberId,
            assigneeName: teamMembersMap.get(response.data.teamMemberId)
          }));
        }
        
        // Format date for display
        const meetingData = {
          ...response.data,
          tasks: processedTasks,
          teamMember: teamMembersMap.get(response.data.teamMemberId) || 'Unknown',
          date: formatMeetingDateTime(response.data.date),
          duration: formatDuration(response.data.duration)
        };
        
        setMeeting(meetingData);
        setError(null);
      } catch (error) {
        // Error fetching meeting
        setError('Failed to load meeting details');
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchMeeting();
    }
  }, [id, getToken]);

  // Fetch agenda when the activeTab is changed to 'agenda'
  useEffect(() => {
    if (activeTab === 'agenda' && id && !agenda && !loadingAgenda) {
      const fetchAgenda = async () => {
        setLoadingAgenda(true);
        setAgendaError(null);
        
        try {
          const agendaData = await meetingApi.generateAgenda(id);
          setAgenda(agendaData);
        } catch (error) {
          // Error fetching agenda
          setAgendaError('Failed to generate agenda. Please try again.');
        } finally {
          setLoadingAgenda(false);
        }
      };
      
      fetchAgenda();
    }
  }, [activeTab, id, agenda, loadingAgenda]);
  
  // Handle status toggle for tasks
  const toggleTaskStatus = async (task: Task) => {
    if (!meeting || !meeting.id) return;
    
    const newStatus = task.status === 'complete' ? 'incomplete' : 'complete';
    
    try {
      const token = await getToken();
      await axios.patch(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}`, {
        status: newStatus
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the meeting state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks?.map(t => 
                         t.id === task.id 
               ? { ...t, status: newStatus, completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined }
              : t
          ) || []
        };
      });
      
      // Close sidebar if task was completed
      if (newStatus === 'complete') {
        closeSidebar();
      }
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  // Handle assignment update for tasks
  const updateTaskAssignment = async (task: Task, newAssigneeId: string) => {
    if (!meeting || !meeting.id) return;
    
    try {
      const token = await getToken();
      await axios.patch(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}`, {
        assignedTo: newAssigneeId
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Find the assignee name
      const assigneeName = newAssigneeId === currentUserId ? 'Me' : teamMembers.find(m => m.id === newAssigneeId)?.name || undefined;
      
      // Update the meeting state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks?.map(t => 
            t.id === task.id 
              ? { ...t, assignedTo: newAssigneeId, assigneeName }
              : t
          ) || []
        };
      });
      
      // Update selected task if it's the one being updated
      if (selectedTask && selectedTask.id === task.id) {
        setSelectedTask({ ...selectedTask, assignedTo: newAssigneeId, assigneeName });
      }
    } catch (error) {
      console.error('Error updating task assignment:', error);
    }
  };

  // Handle task click
  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setSidebarVisible(true);
    setTimeout(() => setSidebarOpen(true), 50);
  };

  // Close sidebar
  const closeSidebar = () => {
    setSidebarOpen(false);
    setTimeout(() => {
      setSidebarVisible(false);
      setSelectedTask(null);
    }, 300);
  };
  
  return (
    <div className="relative">
      <div className="mb-2">
        {fromTeamMember && teamMemberId ? (
          <Link to={`/team/${teamMemberId}`} className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} className="mr-1" />
            Back to Team Member
          </Link>
        ) : (
          <Link to="/meetings" className="inline-flex items-center text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} className="mr-1" />
            Back to Meetings
          </Link>
        )}
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading meeting details...</p>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>{error}</p>
        </div>
      ) : meeting ? (
        <>
          <div className="mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
              <div>
                <h1 className="text-2xl font-semibold text-[#171717]">{meeting.title}</h1>
                <div className="text-gray-500 mt-1">
                  {meeting.date} • {meeting.duration} • {meeting.teamMember}
                </div>
              </div>
              
              {/* Changes History Button */}
              <div className="mt-3 md:mt-0">
                <button
                  onClick={() => setShowChangesModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 mr-3"
                >
                  <Clock size={16} className="mr-1.5" />
                  Changes History
                </button>
                
                {meeting.googleMeetLink && meeting.status === 'scheduled' && (
                  <a
                    href={meeting.googleMeetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
                  >
                    <VideoCamera size={18} className="mr-1" />
                    Join Google Meet
                  </a>
                )}
              </div>
            </div>
            
            <div className="mt-2 flex items-center">
              <StatusBadge 
                status={meeting.status} 
                processingStatus={meeting.processingStatus} 
              />
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
                  activeTab === 'agenda'
                    ? 'text-[#171717] border-b-2 border-[#171717]'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                onClick={() => setActiveTab('agenda')}
              >
                Agenda
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
                  
                  {/* Tasks */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Tasks</h2>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      {meeting.tasks && meeting.tasks.length > 0 ? (
                        <ul className="space-y-3">
                          {meeting.tasks.map((task, index) => (
                            <li key={task.id || index} className="flex items-start justify-between">
                              <div className="flex items-start flex-1 min-w-0">
                                <button
                                  onClick={() => toggleTaskStatus(task)}
                                  className={`flex-shrink-0 mt-0.5 mr-3 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                    task.status === 'complete'
                                      ? 'bg-green-500 border-green-500 text-white'
                                      : 'border-gray-300 hover:border-green-400'
                                  }`}
                                >
                                  {task.status === 'complete' && <Check size={12} />}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <button
                                    onClick={() => handleTaskClick(task)}
                                    className={`text-left w-full text-sm transition-colors hover:text-blue-600 ${
                                      task.status === 'complete' ? 'line-through text-gray-500' : 'text-gray-700'
                                    }`}
                                  >
                                    {task.text}
                                  </button>
                                  <div className="mt-1">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAssignmentBadgeClass(!!task.assignedTo)}`}>
                                      {task.assigneeName || 'Unassigned'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-gray-500 italic">No tasks identified</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'agenda' ? (
              <div className="p-6">
                {loadingAgenda ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Generating agenda...</p>
                  </div>
                ) : agendaError ? (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
                    <p>{agendaError}</p>
                  </div>
                ) : agenda ? (
                  <div>
                    {/* Agenda header with regenerate button */}
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-medium text-gray-900">Meeting Agenda</h2>
                    </div>
                    
                    {/* Display a note if one is provided */}
                    {agenda.note && (
                      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
                        <p className="text-yellow-700">{agenda.note}</p>
                      </div>
                    )}
                    
                    {/* Display an error if one is provided */}
                    {agenda.error && (
                      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 rounded">
                        <p className="text-red-700">{agenda.error}</p>
                      </div>
                    )}
                    
                    {/* Agenda phases */}
                    <div className="space-y-8">
                      {agenda.phases.map((phase, phaseIndex) => (
                        <div key={phaseIndex} className="border border-gray-200 rounded-lg overflow-hidden">
                          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                            <h3 className="text-base font-medium text-gray-900">{phase.name}</h3>
                          </div>
                          <div className="p-4">
                            <ul className="space-y-3">
                              {phase.items.map((item, itemIndex) => (
                                <li key={itemIndex} className="flex items-start">
                                  <span className="text-indigo-500 mr-2">•</span>
                                  <span className="text-gray-700">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No agenda available</p>
                  </div>
                )}
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
        </>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">Meeting not found</p>
        </div>
      )}

      {/* Meeting Changes Modal */}
      {id && (
        <MeetingChangesModal 
          isOpen={showChangesModal}
          onClose={() => setShowChangesModal(false)}
          meetingId={id}
        />
      )}

      {/* Task Sidebar Component */}
      <TaskSidebar
        isOpen={sidebarOpen}
        isVisible={sidebarVisible}
        task={selectedTask}
        currentUserId={currentUserId}
        teamMemberId={meeting?.teamMemberId}
        teamMemberName={meeting?.teamMember}
        onClose={closeSidebar}
        onStatusToggle={toggleTaskStatus}
        onAssignmentUpdate={updateTaskAssignment}
      />
    </div>
  );
};

export default MeetingOverview; 