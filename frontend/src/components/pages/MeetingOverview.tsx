import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, VideoCamera, Check, Clock } from 'phosphor-react';
import { useAuth } from '@clerk/clerk-react';
import VideoPlayer from '../VideoPlayer';
import ActionItemSidebar from '../ActionItemSidebar';
import MeetingChangesModal from '../MeetingChangesModal';
import type { TeamMember, ActionItem } from '../../interfaces';
import { meetingApi } from '../../utils/api';
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
  actionItems?: ActionItem[]; // Updated to use ActionItem type
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
  const [selectedActionItem, setSelectedActionItem] = useState<ActionItem | null>(null);
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
        
        setTeamMembers(teamResponse.data);
        
        const teamMembersMap = new Map();
        teamResponse.data.forEach((member: TeamMember) => {
          teamMembersMap.set(member.id, member.name);
        });
        
        // Process action items - prefer structured actionItemsData if available
        let processedActionItems = [];
        
        if (response.data.actionItemsData && response.data.actionItemsData.length > 0) {
          // We have the new structured format
          processedActionItems = response.data.actionItemsData.map((item: Omit<ActionItem, 'assigneeName'>) => ({
            id: item.id,
            text: item.text,
            status: item.status as 'incomplete' | 'complete',
            createdAt: item.createdAt,
            completedAt: item.completedAt,
            assignedTo: item.assignedTo,
            assigneeName: item.assignedTo === 'admin' ? 'Me' : (item.assignedTo ? teamMembersMap.get(item.assignedTo) : undefined)
          }));
        } else if (response.data.actionItems && response.data.actionItems.length > 0) {
          // Fall back to legacy string array format if needed
          processedActionItems = response.data.actionItems.map((item: string, index: number) => ({
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
          actionItems: processedActionItems,
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
  
  // Handle status toggle for action items
  const toggleActionItemStatus = async (actionItem: ActionItem) => {
    if (!meeting || !meeting.id) return;
    
    const newStatus = actionItem.status === 'complete' ? 'incomplete' : 'complete';
    
    try {
      const token = await getToken();
      
      // Check if this is a legacy action item (id starts with "legacy-")
      if (actionItem.id.startsWith('legacy-')) {
        // For legacy items, we'll just update locally since they're not in the database yet
        const updatedActionItems = meeting.actionItems?.map(item => 
          item.id === actionItem.id 
            ? { 
                ...item, 
                status: newStatus as 'complete' | 'incomplete',
                completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined
              } 
            : item
        );
        
        setMeeting({
          ...meeting,
          actionItems: updatedActionItems
        });
        
        // If the sidebar is open with this item, update it
        if (selectedActionItem && selectedActionItem.id === actionItem.id) {
          setSelectedActionItem({
            ...selectedActionItem,
            status: newStatus as 'complete' | 'incomplete',
            completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined
          });
        }
      } else {
        // For structured items, call the API
        await axios.patch(
          `${API_URL}/api/meetings/${meeting.id}/action-items/${actionItem.id}`,
          {
            status: newStatus,
            completedAt: newStatus === 'complete' ? new Date().toISOString() : null
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        // Update local state
        const updatedActionItems = meeting.actionItems?.map(item => 
          item.id === actionItem.id 
            ? { 
                ...item, 
                status: newStatus as 'complete' | 'incomplete',
                completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined
              } 
            : item
        );
        
        setMeeting({
          ...meeting,
          actionItems: updatedActionItems
        });
        
        // If the sidebar is open with this item, update it
        if (selectedActionItem && selectedActionItem.id === actionItem.id) {
          setSelectedActionItem({
            ...selectedActionItem,
            status: newStatus as 'complete' | 'incomplete',
            completedAt: newStatus === 'complete' ? new Date().toISOString() : undefined
          });
        }
      }
    } catch (error) {
      // Error updating action item status
      // Show error message to user
      alert('Error updating action item status. Please try again.');
    }
  };
  
  // Handle assignment change
  const updateActionItemAssignment = async (actionItem: ActionItem, teamMemberId: string) => {
    if (!meeting || !meeting.id) return;
    
    try {
      const token = await getToken();
      // Set assigneeName based on teamMemberId
      let assigneeName;
      if (teamMemberId === 'admin') {
        assigneeName = 'Me'; // Hard-coded name for admin
      } else if (teamMemberId) {
        assigneeName = teamMembers.find(member => member.id === teamMemberId)?.name;
      } else {
        assigneeName = undefined; // For unassigned
      }
      
      // Check if this is a legacy action item (id starts with "legacy-")
      if (actionItem.id.startsWith('legacy-')) {
        // For legacy items, we'll just update locally since they're not in the database yet
        const updatedActionItems = meeting.actionItems?.map(item => 
          item.id === actionItem.id 
            ? { 
                ...item, 
                assignedTo: teamMemberId,
                assigneeName: assigneeName || undefined
              } 
            : item
        );
        
        setMeeting({
          ...meeting,
          actionItems: updatedActionItems
        });
        
        // If the sidebar is open with this item, update it
        if (selectedActionItem && selectedActionItem.id === actionItem.id) {
          setSelectedActionItem({
            ...selectedActionItem,
            assignedTo: teamMemberId,
            assigneeName: assigneeName || undefined
          });
        }
      } else {
        // For structured items, call the API
        await axios.patch(
          `${API_URL}/api/meetings/${meeting.id}/action-items/${actionItem.id}`,
          {
            assignedTo: teamMemberId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        
        // Update local state
        const updatedActionItems = meeting.actionItems?.map(item => 
          item.id === actionItem.id 
            ? { 
                ...item, 
                assignedTo: teamMemberId,
                assigneeName: assigneeName || undefined
              } 
            : item
        );
        
        setMeeting({
          ...meeting,
          actionItems: updatedActionItems
        });
        
        // If the sidebar is open with this item, update it
        if (selectedActionItem && selectedActionItem.id === actionItem.id) {
          setSelectedActionItem({
            ...selectedActionItem,
            assignedTo: teamMemberId,
            assigneeName: assigneeName || undefined
          });
        }
      }
    } catch (error) {
      // Error updating action item assignment
      // Show error message to user
      alert('Error updating assignment. Please try again.');
    }
  };
  
  // Open sidebar for action item details
  const openActionItemDetails = (actionItem: ActionItem) => {
    setSelectedActionItem(actionItem);
    setSidebarOpen(true);
    // Delay setting visible for animation
    setTimeout(() => setSidebarVisible(true), 10);
  };
  
  // Close sidebar
  const closeSidebar = () => {
    // First hide with animation
    setSidebarVisible(false);
    // Then fully close after animation completes
    setTimeout(() => {
      setSidebarOpen(false);
      setSelectedActionItem(null);
    }, 300);
  };
  
  // Status functions now handled by StatusBadge component
  
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
                  
                  {/* Action Items - Updated with task functionality */}
                  <div>
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Action Items</h2>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      {meeting.actionItems && meeting.actionItems.length > 0 ? (
                        <ul className="space-y-2">
                          {meeting.actionItems.map((item) => (
                            <li 
                              key={item.id} 
                              className="flex items-start p-2 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                              onClick={() => openActionItemDetails(item)}
                            >
                              <button 
                                className={`flex-shrink-0 w-5 h-5 mr-2 rounded-full border ${
                                  item.status === 'complete' 
                                    ? 'bg-blue-500 border-blue-500 text-white flex items-center justify-center' 
                                    : 'border-blue-500'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleActionItemStatus(item);
                                }}
                                aria-label={item.status === 'complete' ? 'Mark as incomplete' : 'Mark as complete'}
                              >
                                {item.status === 'complete' && <Check size={12} weight="bold" />}
                              </button>
                              <div className="flex-1">
                                <span className={`text-gray-700 ${item.status === 'complete' ? 'line-through' : ''}`}>
                                  {item.text}
                                </span>
                                <div className="mt-1">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getAssignmentBadgeClass(!!item.assigneeName)}`}>
                                    {item.assigneeName || 'Unassigned'}
                                  </span>
                                </div>
                              </div>
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

      {/* Action Item Sidebar Component */}
      <ActionItemSidebar
        isOpen={sidebarOpen}
        isVisible={sidebarVisible}
        actionItem={selectedActionItem}
        teamMemberId={meeting?.teamMemberId}
        teamMemberName={meeting?.teamMember}
        onClose={closeSidebar}
        onStatusToggle={toggleActionItemStatus}
        onAssignmentUpdate={updateActionItemAssignment}
      />
    </div>
  );
};

export default MeetingOverview; 