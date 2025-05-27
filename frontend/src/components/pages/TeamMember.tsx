import { useState, useEffect, Fragment, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { userApi, meetingApi, keyAreaApi } from '../../utils/api';
import { analyzeMeetings } from '../../utils/anthropic';
import type { TeamMember as TeamMemberType, KeyArea, Activity, AnalysisHistory, Meeting } from '../../interfaces';
import { Dialog, Transition } from '@headlessui/react';
import { Link } from 'react-router-dom';
import { useApiState } from '../../hooks/useApiState';
import { getValidDate, formatJoinDate } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';

// getValidDate function now imported from utils/dateUtils

const TeamMember = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  const [teamMember, setTeamMember] = useState<TeamMemberType | null>(null);
  const [{ loading, error }, { setLoading, setError }] = useApiState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisInfo, setAnalysisInfo] = useState<{
    cached: boolean;
    lastAnalyzedAt?: string;
  } | null>(null);
  const [keyAreas, setKeyAreas] = useState<KeyArea[]>([]);
  const [keyAreaLoading, setKeyAreaLoading] = useState(false);
  const [newKeyArea, setNewKeyArea] = useState({ name: '', description: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [addingKeyArea, setAddingKeyArea] = useState(false);
  const [editingKeyArea, setEditingKeyArea] = useState<string | null>(null);
  const [editKeyAreaData, setEditKeyAreaData] = useState({ name: '', description: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyAreaToDelete, setKeyAreaToDelete] = useState<string | null>(null);
  const [keyAreasChanged, setKeyAreasChanged] = useState(false);
  const [refreshAnalysisLoading, setRefreshAnalysisLoading] = useState(false);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisHistory | null>(null);
  
  // Function to transform analysis history to activity entries
  const transformHistoryToActivities = useCallback((historyData: AnalysisHistory[]): Activity[] => {
    return historyData
      .filter(item => !!item.analyzedAt) // Filter out any items without dates
      .map(item => {
        // Get a valid date using our helper
        const analysisDate = getValidDate(item.analyzedAt);
        
        return {
          id: item.id,
          date: analysisDate.toISOString(),
          action: 'Analysis',
          details: `Performance analysis from ${analysisDate.toLocaleDateString()}`,
          type: 'analysis'
        };
      });
  }, []);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Check if current user is admin
        const currentUser = await userApi.getCurrentUser();
        setIsAdmin(currentUser.role === 'admin');
        
        // Fetch the user data - IDs are strings in backend, not numbers
        const userData = await userApi.getUser(id);
        
        // Initialize team member data with user details
        const memberData: TeamMemberType = {
          ...userData,
          lastSignedIn: userData.updatedAt,
          department: userData.role,
          joinDate: userData.createdAt,
          bio: 'Loading profile data...',
          wins: [],
          areasForSupport: [],
          tasks: [],
          recentActivity: []
        };
        
        setTeamMember(memberData);
        
        // Fetch key areas for this team member
        fetchKeyAreas(id);
        
        // Fetch meetings data for this team member
        setAnalyzing(true);
        try {
          const meetings = await meetingApi.getMeetingsByTeamMember(id);
          
          // Store all meetings for the meetings tab
          setMeetings(meetings as Meeting[]);
          
          // If no meetings or if API calls fail, try to use direct Anthropic analysis
          if (meetings.length === 0) {
            setTeamMember(prev => {
              if (!prev) return null;
              return {
                ...prev,
                bio: `${prev.name} has no meeting data available yet.`,
                wins: ['No meeting data available'],
                areasForSupport: ['No meeting data available'],
                tasks: ['No meeting data available']
              };
            });
            setAnalyzing(false);
            return;
          }
          
          // Get recent activity from meetings
          const recentActivity = meetings
            .slice(0, 5)
            .map(meeting => ({
              date: meeting.date,
              action: 'Meeting',
              details: meeting.title
            }));
          
          // Update with meetings data
          setTeamMember(prev => {
            if (!prev) return null;
            return {
              ...prev,
              recentActivity
            };
          });
          
          // Try to get analysis from API first
          try {
            const analysis = await meetingApi.analyzeTeamMemberMeetings(id);
            
            // Update analysis info to show if we're using cached data
            if ('cached' in analysis) {
              setAnalysisInfo({
                cached: analysis.cached || false,
                lastAnalyzedAt: analysis.lastAnalyzedAt
              });
            }
            
            // Fetch analysis history
            try {
              const historyData = await meetingApi.getAnalysisHistory(id);
              
              // Add analysis history entries to recent activity
              if (historyData && historyData.length > 0) {
                const analysisActivities = transformHistoryToActivities(historyData);
                
                // Combine with meeting activities
                const combinedActivity = [...recentActivity, ...analysisActivities]
                  .sort((a, b) => {
                    // Convert both dates to valid Date objects
                    const dateA = getValidDate(a.date);
                    const dateB = getValidDate(b.date);
                    // Sort descending (newest first)
                    return dateB.getTime() - dateA.getTime();
                  })
                  .slice(0, 10);
                
                setTeamMember(prev => {
                  if (!prev) return null;
                  return {
                    ...prev,
                    recentActivity: combinedActivity
                  };
                });
              }
            } catch (historyError) {
              // Error fetching analysis history - continue with basic data
            }
            
            // Update team member with analysis results
            setTeamMember(prev => {
              if (!prev) return null;
              return {
                ...prev,
                bio: `${prev.name} is a ${prev.role} who joined the team on ${formatJoinDate(prev.joinDate || '')}.`,
                wins: analysis.wins,
                areasForSupport: analysis.areasForSupport,
                tasks: analysis.tasks
              };
            });
          } catch (analysisError) {
            // Could not get pre-computed analysis, trying client-side analysis
            
            // If API analysis fails, do client-side analysis with Anthropic
            try {
              // Use local Anthropic integration as fallback
              const clientAnalysis = await analyzeMeetings(meetings);
              
              // Update team member with client-side analysis
              setTeamMember(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
                  wins: clientAnalysis.wins,
                  areasForSupport: clientAnalysis.areasForSupport,
                  tasks: clientAnalysis.tasks
                };
              });
            } catch (clientAnalysisError) {
              // Client-side analysis failed - using fallback data
              // Just show basic info if all analysis methods fail
              setTeamMember(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
                  wins: ['Analysis currently unavailable'],
                  areasForSupport: ['Analysis currently unavailable'],
                  tasks: ['Analysis currently unavailable']
                };
              });
            }
          }
        } catch (meetingsError) {
          // Error fetching meetings - using fallback data
          setTeamMember(prev => {
            if (!prev) return null;
            return {
              ...prev,
              bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
              wins: ['Failed to load meeting data'],
              areasForSupport: ['Failed to load meeting data'],
              tasks: ['Failed to load meeting data']
            };
          });
        } finally {
          setAnalyzing(false);
        }
      } catch (userError) {
        // Error fetching user data
        setError('Failed to load team member data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id, transformHistoryToActivities]);
  
  // Function to fetch key areas
  const fetchKeyAreas = async (userId: string) => {
    setKeyAreaLoading(true);
    try {
      const keyAreasData = await keyAreaApi.getKeyAreas(userId);
      setKeyAreas(keyAreasData);
    } catch (error) {
      // Error fetching key areas
    } finally {
      setKeyAreaLoading(false);
    }
  };
  
  // Function to load a historical analysis
  const loadHistoricalAnalysis = async (analysisId: string) => {
    if (!id) return;
    
    try {
      setLoading(true);
      const analysisData = await meetingApi.getAnalysisById(id, analysisId);
      
      setSelectedAnalysis(analysisData);
      
      // Update the UI with the historical analysis data
      setTeamMember(prev => {
        if (!prev) return null;
        return {
          ...prev,
          wins: analysisData.wins || [],
          areasForSupport: analysisData.areasForSupport || [],
          tasks: analysisData.tasks || []
        };
      });
      
      // Update analysis info to show we're viewing historical data
      setAnalysisInfo({
        cached: true,
        lastAnalyzedAt: analysisData.analyzedAt
      });
      
      // Switch to details tab to show the loaded analysis
      setActiveTab('details');
    } catch (error) {
      // Error loading historical analysis
    } finally {
      setLoading(false);
    }
  };
  
  // Function to clear selected analysis and return to current data
  const clearHistoricalAnalysis = async () => {
    if (!id || !selectedAnalysis) return;
    
    try {
      setLoading(true);
      // Reload the current analysis
      const currentAnalysis = await meetingApi.analyzeTeamMemberMeetings(id);
      
      setSelectedAnalysis(null);
      
      // Update analysis info
      setAnalysisInfo({
        cached: currentAnalysis.cached || false,
        lastAnalyzedAt: currentAnalysis.lastAnalyzedAt
      });
      
      // Update team member with current analysis
      setTeamMember(prev => {
        if (!prev) return null;
        return {
          ...prev,
          wins: currentAnalysis.wins,
          areasForSupport: currentAnalysis.areasForSupport,
          tasks: currentAnalysis.tasks
        };
      });
    } catch (error) {
      // Error returning to current analysis
    } finally {
      setLoading(false);
    }
  };
  
  // Function to add a new key area
  const handleAddKeyArea = async () => {
    if (!id || !newKeyArea.name || !newKeyArea.description) return;
    
    try {
      setAddingKeyArea(true);
      await keyAreaApi.createKeyArea(id, newKeyArea);
      setNewKeyArea({ name: '', description: '' });
      await fetchKeyAreas(id);
      setKeyAreasChanged(true);
    } catch (error) {
      // Error adding key area
    } finally {
      setAddingKeyArea(false);
    }
  };
  
  // Function to delete a key area
  const handleDeleteKeyArea = async (areaId: string) => {
    if (!id) return;
    
    try {
      await keyAreaApi.deleteKeyArea(id, areaId);
      await fetchKeyAreas(id);
      setDeleteDialogOpen(false);
      setKeyAreaToDelete(null);
      setKeyAreasChanged(true);
    } catch (error) {
      // Error deleting key area
    }
  };
  
  // Function to open delete dialog
  const openDeleteDialog = (areaId: string) => {
    setKeyAreaToDelete(areaId);
    setDeleteDialogOpen(true);
  };
  
  // Function to start editing a key area
  const handleStartEditKeyArea = (area: KeyArea) => {
    setEditingKeyArea(area.id);
    setEditKeyAreaData({
      name: area.name,
      description: area.description
    });
  };
  
  // Function to update a key area
  const handleUpdateKeyArea = async () => {
    if (!id || !editingKeyArea || !editKeyAreaData.name || !editKeyAreaData.description) return;
    
    try {
      await keyAreaApi.updateKeyArea(id, editingKeyArea, editKeyAreaData);
      setEditingKeyArea(null);
      await fetchKeyAreas(id);
      setKeyAreasChanged(true);
    } catch (error) {
      // Error updating key area
    }
  };
  
  // Function to cancel editing
  const handleCancelEdit = () => {
    setEditingKeyArea(null);
  };

  // Function to refresh analysis with new key areas
  const refreshAnalysis = async () => {
    if (!id) return;
    
    try {
      setRefreshAnalysisLoading(true);
      
      // Call API with forceRefresh=true to get fresh analysis
      const analysis = await meetingApi.analyzeTeamMemberMeetings(id, true);
      
      // Update analysis info
      setAnalysisInfo({
        cached: false,
        lastAnalyzedAt: analysis.lastAnalyzedAt
      });
      
      // Fetch updated analysis history
      try {
        const historyData = await meetingApi.getAnalysisHistory(id);
        
        // Add analysis history entries to recent activity
        if (historyData && historyData.length > 0) {
          const analysisActivities = transformHistoryToActivities(historyData);
          
          // Combine with meeting activities from current team member state
          const meetingActivities = teamMember?.recentActivity?.filter(act => act.action === 'Meeting') || [];
          
          const combinedActivity = [...meetingActivities, ...analysisActivities]
            .sort((a, b) => {
              // Convert both dates to valid Date objects
              const dateA = getValidDate(a.date);
              const dateB = getValidDate(b.date);
              // Sort descending (newest first)
              return dateB.getTime() - dateA.getTime();
            })
            .slice(0, 10);
          
          setTeamMember(prev => {
            if (!prev) return null;
            return {
              ...prev,
              recentActivity: combinedActivity
            };
          });
        }
              } catch (historyError) {
          // Error fetching updated analysis history
      }
      
      // Update team member with fresh analysis results
      setTeamMember(prev => {
        if (!prev) return null;
        return {
          ...prev,
          wins: analysis.wins,
          areasForSupport: analysis.areasForSupport,
          tasks: analysis.tasks
        };
      });
      
      // Reset the changed flag
      setKeyAreasChanged(false);
      
      // Reset any selected historical analysis
      setSelectedAnalysis(null);
      
      // Switch to details tab to show new analysis
      setActiveTab('details');
    } catch (error) {
      // Error refreshing analysis
    } finally {
      setRefreshAnalysisLoading(false);
    }
  };

  // Function to handle sorting in meetings tab
  const handleSort = (field: string) => {
    if (field === sortField) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render sort indicator
  const renderSortIndicator = (field: string) => {
    if (sortField !== field) return null;
    
    return sortDirection === 'asc' 
      ? <span className="ml-1">↑</span>
      : <span className="ml-1">↓</span>;
  };

  // Status functions now handled by StatusBadge component

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-700">Loading team member profile...</p>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error || !teamMember) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded">
        <p className="font-bold">Error</p>
        <p>{error || 'Team member not found'}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-[#171717]">{teamMember.name}</h1>
        <div className="text-gray-500 mt-1">
          {teamMember.role} • {teamMember.department} • {teamMember.email}
        </div>
        <div className="mt-2 text-sm text-gray-500">
          Team member since {formatJoinDate(teamMember.joinDate || '')}
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
              activeTab === 'meetings'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('meetings')}
          >
            Meetings
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
          <button
            className={`mr-4 py-2 px-1 font-medium text-base ${
              activeTab === 'kpis'
                ? 'text-[#171717] border-b-2 border-[#171717]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setActiveTab('kpis')}
          >
            Key areas
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
            
            {/* Historical Analysis Indicator */}
            {selectedAnalysis && (
              <div className="mb-6 bg-blue-50 p-4 rounded-lg border-l-4 border-blue-500">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-blue-700">
                      <span className="font-medium">Viewing historical analysis</span> from {new Date(selectedAnalysis.analyzedAt).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={clearHistoricalAnalysis}
                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Return to current analysis
                  </button>
                </div>
              </div>
            )}
            
            {/* Key Areas Changed Alert */}
            {keyAreasChanged && (
              <div className="mb-6 bg-yellow-50 p-4 rounded-lg border-l-4 border-yellow-500">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      Key areas have been updated. Go to the <button onClick={() => setActiveTab('kpis')} className="font-medium underline">Key areas</button> tab to refresh the analysis.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Analysis Info */}
            {analysisInfo && (
              <div className="mb-4 text-sm text-gray-500 italic">
                {analysisInfo.cached 
                  ? `Using cached analysis from ${new Date(analysisInfo.lastAnalyzedAt || '').toLocaleString()}`
                  : `Fresh analysis performed at ${new Date(analysisInfo.lastAnalyzedAt || '').toLocaleString()}`
                }
              </div>
            )}
            
            {/* Three Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Wins */}
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Wins
                  {analyzing && <span className="ml-2 text-sm text-gray-500">(Analyzing...)</span>}
                </h2>
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
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Areas for Support
                  {analyzing && <span className="ml-2 text-sm text-gray-500">(Analyzing...)</span>}
                </h2>
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
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  Tasks
                  {analyzing && <span className="ml-2 text-sm text-gray-500">(Analyzing...)</span>}
                </h2>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <ul className="space-y-2">
                    {teamMember.tasks?.map((item, index) => (
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
        ) : activeTab === 'meetings' ? (
          <div className="p-0">
            {meetings.length > 0 ? (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('date')}
                      >
                        Date {renderSortIndicator('date')}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('title')}
                      >
                        Meeting name {renderSortIndicator('title')}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('duration')}
                      >
                        Duration {renderSortIndicator('duration')}
                      </th>
                      <th 
                        scope="col" 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('status')}
                      >
                        Status {renderSortIndicator('status')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {meetings
                      .sort((a, b) => {
                        // Type-safe property access
                        let aValue: string | number | Date;
                        let bValue: string | number | Date;
                        
                        // Special case for date
                        if (sortField === 'date') {
                          aValue = new Date(a.date);
                          bValue = new Date(b.date);
                        } else if (sortField === 'title') {
                          aValue = a.title;
                          bValue = b.title;
                        } else if (sortField === 'duration') {
                          aValue = typeof a.duration === 'string' ? parseInt(a.duration) : a.duration;
                          bValue = typeof b.duration === 'string' ? parseInt(b.duration) : b.duration;
                        } else if (sortField === 'status') {
                          aValue = a.status;
                          bValue = b.status;
                        } else {
                          // Default to empty strings for unknown fields
                          aValue = '';
                          bValue = '';
                        }
                        
                        if (aValue < bValue) {
                          return sortDirection === 'asc' ? -1 : 1;
                        }
                        if (aValue > bValue) {
                          return sortDirection === 'asc' ? 1 : -1;
                        }
                        return 0;
                      })
                      .map((meeting) => (
                        <tr key={meeting.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                            {new Date(meeting.date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-base font-medium text-[#171717]">
                              <Link 
                                to={`/meetings/${meeting.id}`} 
                                state={{ from: 'teamMember', teamMemberId: id }}
                                className="hover:text-indigo-600 hover:underline"
                              >
                                {meeting.title}
                              </Link>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-base text-gray-500">
                            {meeting.duration} mins
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge 
                              status={meeting.status} 
                              processingStatus={meeting.processingStatus} 
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-gray-500 text-center">
                No meetings found for this team member
              </div>
            )}
          </div>
        ) : activeTab === 'activity' ? (
          <div className="p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
            {teamMember.recentActivity && teamMember.recentActivity.length > 0 ? (
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {teamMember.recentActivity.map((activity, index) => (
                  <div key={index} className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{activity.action}</div>
                        {activity.type === 'analysis' ? (
                          <div 
                            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer hover:underline flex items-center"
                            onClick={() => activity.id && loadHistoricalAnalysis(activity.id)}
                          >
                            {activity.details}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">{activity.details}</div>
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(getValidDate(activity.date).toISOString()).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-gray-500 text-center">
                No recent activity found
              </div>
            )}
          </div>
        ) : activeTab === 'kpis' ? (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900">Key areas</h2>
              <div className="flex space-x-2">
                {/* Only enable the button when key areas have changed */}
                <button 
                  onClick={refreshAnalysis}
                  disabled={refreshAnalysisLoading || !keyAreasChanged}
                  className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm disabled:bg-green-300 flex items-center"
                >
                  {refreshAnalysisLoading ? (
                    <>
                      <span className="animate-spin h-4 w-4 border-b-2 border-white rounded-full mr-2"></span>
                      Analyzing...
                    </>
                  ) : (
                    <>Refresh Analysis</>
                  )}
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => setAddingKeyArea(!addingKeyArea)}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    {addingKeyArea ? 'Cancel' : 'Add Key Area'}
                  </button>
                )}
              </div>
            </div>
            
            {keyAreaLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-gray-500 text-sm">Loading key areas...</p>
              </div>
            ) : (
              <>
                {addingKeyArea && isAdmin && (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <h3 className="font-medium text-gray-900 mb-2">Add New Key Area</h3>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input
                        type="text"
                        value={newKeyArea.name}
                        onChange={(e) => setNewKeyArea({...newKeyArea, name: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter key area name"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={newKeyArea.description}
                        onChange={(e) => setNewKeyArea({...newKeyArea, description: e.target.value})}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter key area description"
                        rows={3}
                      />
                    </div>
                    <button
                      onClick={handleAddKeyArea}
                      disabled={!newKeyArea.name || !newKeyArea.description}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                    >
                      Add
                    </button>
                  </div>
                )}
                
                {keyAreas.length > 0 ? (
                  <div className="space-y-4">
                    {keyAreas.map((area) => (
                      <div key={area.id} className="bg-purple-50 p-4 rounded-lg">
                        {editingKeyArea === area.id ? (
                          // Edit form
                          <div>
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                              <input
                                type="text"
                                value={editKeyAreaData.name}
                                onChange={(e) => setEditKeyAreaData({...editKeyAreaData, name: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter key area name"
                              />
                            </div>
                            <div className="mb-3">
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <textarea
                                value={editKeyAreaData.description}
                                onChange={(e) => setEditKeyAreaData({...editKeyAreaData, description: e.target.value})}
                                className="w-full p-2 border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Enter key area description"
                                rows={3}
                              />
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={handleUpdateKeyArea}
                                disabled={!editKeyAreaData.name || !editKeyAreaData.description}
                                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-blue-300"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="px-3 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          // Display mode
                          <div>
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium text-gray-900">{area.name}</h3>
                              {isAdmin && (
                                <div className="flex space-x-2">
                                  <button
                                    onClick={() => handleStartEditKeyArea(area)}
                                    className="text-blue-500 hover:text-blue-700"
                                    title="Edit key area"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => openDeleteDialog(area.id)}
                                    className="text-red-500 hover:text-red-700"
                                    title="Delete key area"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-gray-700 mt-2">{area.description}</p>
                            <div className="mt-2 text-sm text-gray-500">
                              Added by {area.createdBy?.name || 'Admin'} on {new Date(area.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 p-4 rounded-lg text-gray-500 text-center">
                    No key areas defined yet
                    {isAdmin && !addingKeyArea && (
                      <p className="mt-2 text-sm">
                        Click the "Add Key Area" button to define areas for the AI to focus on when analyzing this team member's meetings.
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
            
            <div className="mt-6 bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <h3 className="font-medium text-gray-900 mb-2">How Key Areas Work</h3>
              <p className="text-gray-700">
                Key areas are additional focus points when analyzing team member's meetings. 
                These will be added to the analysis prompts to provide more targeted insights relevant to the specific 
                areas you want to track.
                </p>
            </div>
          </div>
        ) : null}
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Transition appear show={deleteDialogOpen} as={Fragment}>
        <Dialog 
          as="div" 
          className="relative z-10" 
          onClose={() => setDeleteDialogOpen(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title 
                    as="h3" 
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Delete Key Area
                  </Dialog.Title>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Are you sure you want to delete this key area? This action cannot be undone.
                    </p>
                  </div>

                  <div className="mt-4 flex space-x-3 justify-end">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-gray-100 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                      onClick={() => setDeleteDialogOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                      onClick={() => keyAreaToDelete && handleDeleteKeyArea(keyAreaToDelete)}
                    >
                      Delete
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default TeamMember; 