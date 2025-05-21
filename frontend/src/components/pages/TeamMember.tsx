import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { userApi, meetingApi } from '../../utils/api';
import { analyzeMeetings } from '../../utils/anthropic';
import type { TeamMember as TeamMemberType } from '../../interfaces';

const TeamMember = () => {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState('details');
  const [teamMember, setTeamMember] = useState<TeamMemberType | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisInfo, setAnalysisInfo] = useState<{
    cached: boolean;
    lastAnalyzedAt?: string;
  } | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        // Fetch the user data - IDs are strings in backend, not numbers
        const userData = await userApi.getUser(id);
        
        // Check if the user has either USER or ADMIN role
        // No need for role check here - both USER and ADMIN can access profiles
        
        // Initialize team member data with user details
        let memberData: TeamMemberType = {
          ...userData,
          lastSignedIn: userData.updatedAt,
          department: userData.role,
          joinDate: userData.createdAt,
          bio: 'Loading profile data...',
          wins: [],
          areasForSupport: [],
          actionItems: [],
          recentActivity: []
        };
        
        setTeamMember(memberData);
        
        // Fetch meetings data for this team member
        setAnalyzing(true);
        try {
          const meetings = await meetingApi.getMeetingsByTeamMember(id);
          
          // If no meetings or if API calls fail, try to use direct Anthropic analysis
          if (meetings.length === 0) {
            setTeamMember(prev => {
              if (!prev) return null;
              return {
                ...prev,
                bio: `${prev.name} has no meeting data available yet.`,
                wins: ['No meeting data available'],
                areasForSupport: ['No meeting data available'],
                actionItems: ['No meeting data available']
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
            
            // Update team member with analysis results
            setTeamMember(prev => {
              if (!prev) return null;
              return {
                ...prev,
                bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
                wins: analysis.wins,
                areasForSupport: analysis.areasForSupport,
                actionItems: analysis.actionItems
              };
            });
          } catch (analysisError) {
            console.warn('Could not get pre-computed analysis, doing client-side analysis', analysisError);
            
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
                  actionItems: clientAnalysis.actionItems
                };
              });
            } catch (clientAnalysisError) {
              console.error('Client-side analysis failed:', clientAnalysisError);
              // Just show basic info if all analysis methods fail
              setTeamMember(prev => {
                if (!prev) return null;
                return {
                  ...prev,
                  bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
                  wins: ['Analysis currently unavailable'],
                  areasForSupport: ['Analysis currently unavailable'],
                  actionItems: ['Analysis currently unavailable']
                };
              });
            }
          }
        } catch (meetingsError) {
          console.error('Error fetching meetings:', meetingsError);
          setTeamMember(prev => {
            if (!prev) return null;
            return {
              ...prev,
              bio: `${prev.name} is a ${prev.role} who joined the team on ${new Date(prev.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}.`,
              wins: ['Failed to load meeting data'],
              areasForSupport: ['Failed to load meeting data'],
              actionItems: ['Failed to load meeting data']
            };
          });
        } finally {
          setAnalyzing(false);
        }
      } catch (userError) {
        console.error('Error fetching user data:', userError);
        setError('Failed to load team member data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [id]);

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
          Team member since {new Date(teamMember.joinDate || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
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
                  Action Items
                  {analyzing && <span className="ml-2 text-sm text-gray-500">(Analyzing...)</span>}
                </h2>
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
            {teamMember.recentActivity && teamMember.recentActivity.length > 0 ? (
              <div className="bg-gray-50 rounded-lg divide-y divide-gray-200">
                {teamMember.recentActivity.map((activity, index) => (
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
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg text-gray-500 text-center">
                No recent activity found
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMember; 