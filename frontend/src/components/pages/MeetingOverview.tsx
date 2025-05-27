import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, VideoCamera, Clock, CheckCircle, Sparkle } from 'phosphor-react';
import { useAuth } from '@clerk/clerk-react';
import VideoPlayer from '../VideoPlayer';
import TaskSidebar from '../TaskSidebar';
import MeetingChangesModal from '../MeetingChangesModal';
import type { TeamMember, Task } from '../../interfaces';
import { meetingApi, userApi } from '../../utils/api';
import { useApiState } from '../../hooks/useApiState';
import { formatMeetingDateTime, formatDuration } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';

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
  createdBy?: string;
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
  const [generatingSuggestions, setGeneratingSuggestions] = useState(false);
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
          processedTasks = response.data.tasksData.map((item: any) => ({
            id: item.id,
            text: item.text,
            status: item.status as 'incomplete' | 'complete' | 'suggested',
            createdAt: item.createdAt,
            completedAt: item.completedAt,
            assignedTo: item.assignedTo,
            assigneeName: item.status === 'suggested' 
              ? undefined // Don't set assigneeName for suggested tasks
              : (item.assignedTo === currentUser.id ? 'Me' : (item.assignedTo ? teamMembersMap.get(item.assignedTo) : undefined)),
            reasoning: item.reasoning,
            relatedAreaForSupport: item.relatedAreaForSupport,
            suggestedAssignee: item.suggestedAssignee
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
        
        // Auto-suggest tasks if no tasks exist but areas for support do
        if ((!processedTasks || processedTasks.length === 0) && 
            meetingData.areasForSupport && 
            meetingData.areasForSupport.length > 0 &&
            meetingData.processingStatus === 'completed') {
          console.log('Auto-generating task suggestions since no tasks exist but areas for support found');
          // Automatically generate task suggestions
          setTimeout(() => {
            generateSuggestedTasks();
          }, 1000); // Small delay to ensure UI is ready
        }
        
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
      
      // Update selected task if it's the one being updated
      if (selectedTask && selectedTask.id === task.id) {
        setSelectedTask({ 
          ...selectedTask, 
          status: newStatus, 
          completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined 
        });
      }
      
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

  // Handle task text update
  const updateTaskText = async (task: Task, updates: Partial<Task>) => {
    if (!meeting || !meeting.id) return;
    
    try {
      const token = await getToken();
      await axios.patch(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}`, updates, {
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
              ? { ...t, ...updates }
              : t
          ) || []
        };
      });
      
      // Update selected task if it's the one being updated
      if (selectedTask && selectedTask.id === task.id) {
        setSelectedTask({ ...selectedTask, ...updates });
      }
    } catch (error) {
      console.error('Error updating task text:', error);
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

  // Generate suggested tasks from areas for support
  const generateSuggestedTasks = async () => {
    if (!meeting || !meeting.areasForSupport || meeting.areasForSupport.length === 0 || !meeting.id) return;
    
    setGeneratingSuggestions(true);
    try {
      const token = await getToken();
      await axios.post(`${API_URL}/api/meetings/${meeting.id}/suggest-tasks`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Refresh the meeting data to get the new suggested tasks
      const updatedMeetingResponse = await axios.get(`${API_URL}/api/meetings/${meeting.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Process tasks including suggested ones
      let processedTasks = [];
      
      if (updatedMeetingResponse.data.tasksData && updatedMeetingResponse.data.tasksData.length > 0) {
        processedTasks = updatedMeetingResponse.data.tasksData.map((item: any) => ({
          id: item.id,
          text: item.text,
          status: item.status as 'incomplete' | 'complete' | 'suggested',
          createdAt: item.createdAt,
          completedAt: item.completedAt,
          assignedTo: item.assignedTo,
          assigneeName: item.status === 'suggested' 
            ? undefined // Don't set assigneeName for suggested tasks
            : (item.assignedTo === currentUserId ? 'Me' : (item.assignedTo ? teamMembers.find(m => m.id === item.assignedTo)?.name : undefined)),
          reasoning: item.reasoning,
          relatedAreaForSupport: item.relatedAreaForSupport,
          suggestedAssignee: item.suggestedAssignee
        }));
      }
      
      // Update the meeting state with new tasks
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: processedTasks
        };
      });
      
    } catch (error) {
      console.error('Error generating task suggestions:', error);
      // You could add a toast notification here for better UX
    } finally {
      setGeneratingSuggestions(false);
    }
  };

  // Handle suggested task approval
  const approveSuggestedTask = async (task: Task) => {
    if (!meeting || !meeting.id || task.status !== 'suggested') return;
    
    try {
      const token = await getToken();
      
      // Approve the suggested task using the new API endpoint
      await axios.patch(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}/approve`, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the task in the local state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks?.map(t => 
            t.id === task.id 
              ? { 
                  ...t, 
                  status: 'incomplete' as const,
                  // Set assignedTo and assigneeName based on suggestedAssignee
                  assignedTo: task.suggestedAssignee === 'manager' 
                    ? currentUserId || undefined
                    : (task.suggestedAssignee === 'team_member' 
                        ? meeting.teamMemberId || undefined
                        : t.assignedTo),
                  assigneeName: task.suggestedAssignee === 'manager' 
                    ? 'Me' 
                    : (task.suggestedAssignee === 'team_member' 
                        ? meeting.teamMember 
                        : t.assigneeName)
                }
              : t
          ) || []
        };
      });
      
      // Close sidebar if it was showing this task
      if (selectedTask?.id === task.id) {
        closeSidebar();
      }
      
    } catch (error) {
      console.error('Error approving suggested task:', error);
    }
  };

  // Handle suggested task rejection (delete)
  const rejectSuggestedTask = async (task: Task) => {
    if (!meeting || !meeting.id || task.status !== 'suggested') return;
    
    try {
      const token = await getToken();
      
      // Delete the suggested task
      await axios.delete(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Remove the task from local state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks?.filter(t => t.id !== task.id) || []
        };
      });
      
      // Close sidebar if it was showing this task
      if (selectedTask?.id === task.id) {
        closeSidebar();
      }
      
    } catch (error) {
      console.error('Error rejecting suggested task:', error);
    }
  };

  // Handle suggested task editing
  const editSuggestedTask = async (task: Task, newText: string) => {
    if (!meeting || !meeting.id || task.status !== 'suggested') return;
    
    try {
      const token = await getToken();
      
      // Update the suggested task text
      await axios.patch(`${API_URL}/api/meetings/${meeting.id}/tasks/${task.id}`, {
        text: newText
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Update the task in local state
      setMeeting(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks?.map(t => 
            t.id === task.id 
              ? { ...t, text: newText }
              : t
          ) || []
        };
      });
      
    } catch (error) {
      console.error('Error editing suggested task:', error);
    }
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
                    <div className="space-y-3">
                      {meeting.wins && meeting.wins.length > 0 ? (
                        meeting.wins.map((win, index) => (
                          <div key={index} className="bg-green-50 p-4 rounded-lg">
                            <span className="text-gray-700">{win}</span>
                          </div>
                        ))
                      ) : (
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-gray-500 italic">No wins recorded</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Areas for Support */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Areas for Support</h2>
                    <div className="space-y-3">
                      {meeting.areasForSupport && meeting.areasForSupport.length > 0 ? (
                        meeting.areasForSupport.map((area, index) => (
                          <div key={index} className="bg-yellow-50 p-4 rounded-lg">
                            <span className="text-gray-700">{area}</span>
                          </div>
                        ))
                      ) : (
                        <div className="bg-yellow-50 p-4 rounded-lg">
                          <p className="text-gray-500 italic">No areas for support identified</p>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Tasks */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Tasks</h2>
                    <div className="space-y-3">
                      {meeting.tasks && meeting.tasks.length > 0 ? (
                        meeting.tasks.map((task, index) => (
                          <div 
                            key={task.id || index} 
                            className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer relative"
                            onClick={() => handleTaskClick(task)}
                          >
                            <div className="flex items-start flex-1 min-w-0">
                              <div className="flex-1 min-w-0">
                                <div
                                  className="text-left w-full text-base transition-colors text-gray-700"
                                >
                                  {task.text}
                                </div>
                                <div className="mt-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    task.status === 'suggested'
                                      ? (task.suggestedAssignee === 'team_member' 
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-gray-100 text-gray-800')
                                      : (task.assignedTo && task.assigneeName !== 'Me'
                                          ? 'bg-indigo-100 text-indigo-800' 
                                          : 'bg-gray-100 text-gray-800')
                                  }`}>
                                    {task.status === 'suggested' 
                                      ? (task.suggestedAssignee === 'manager' 
                                          ? 'Me' 
                                          : (task.suggestedAssignee === 'team_member' 
                                              ? (meeting?.teamMember || 'Team Member')
                                              : 'Unassigned'))
                                      : (task.assigneeName || 'Unassigned')
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="absolute bottom-3 right-3">
                              {task.status === 'complete' ? (
                                <CheckCircle size={20} weight="fill" className="text-green-600" />
                              ) : task.status === 'suggested' ? (
                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500">
                                  <Sparkle size={16} weight="fill" className="text-white" />
                                </div>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                  In Progress
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm text-center">
                          <p className="text-gray-500 italic mb-3">No tasks identified</p>
                          
                          {/* Show different options based on available data */}
                          {meeting.areasForSupport && meeting.areasForSupport.length > 0 ? (
                            <div className="space-y-2">
                              <button
                                onClick={generateSuggestedTasks}
                                disabled={generatingSuggestions}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                              >
                                {generatingSuggestions ? 'Generating Suggestions...' : 'Suggest Tasks from Areas for Support'}
                              </button>
                              <p className="text-xs text-gray-500">
                                AI will suggest actionable tasks based on the {meeting.areasForSupport.length} areas for support identified
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              No areas for support identified to generate task suggestions from
                            </p>
                          )}
                        </div>
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
        onTaskUpdate={updateTaskText}
        onApproveSuggestedTask={approveSuggestedTask}
        onRejectSuggestedTask={rejectSuggestedTask}
        onEditSuggestedTask={editSuggestedTask}
      />
    </div>
  );
};

export default MeetingOverview; 