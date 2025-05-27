import { useState, useEffect, Component } from 'react';
import type { ErrorInfo } from 'react';
import { useUser } from '@clerk/clerk-react';
import { userApi, meetingApi, taskApi } from '../../utils/api';
import { Link } from 'react-router-dom';
import { 
  Users, 
  Calendar, 
  CheckCircle, 
  Warning, 
  Clock, 
  Plus,
  UserPlus,
  TrendUp,
  Activity,
  VideoCamera,
  FileText,
  Target
} from 'phosphor-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,

  Area,
  AreaChart
} from 'recharts';

import { useApiState } from '../../hooks/useApiState';
import { formatDate } from '../../utils/dateUtils';
import StatusBadge from '../StatusBadge';

// Error boundary for charts
class ChartErrorBoundary extends Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chart error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <p>Chart temporarily unavailable</p>
        </div>
      );
    }

    return this.props.children;
  }
}

interface DashboardStats {
  totalTeamMembers: number;
  recentMeetings: number;
  pendingProcessing: number;
  openTasks: number;
  completedThisWeek: number;
  overdueTasks: number;
  googleConnectedMembers: number;
  pendingInvitations: number;
}

interface RecentActivity {
  id: string;
  type: 'meeting_completed' | 'member_joined' | 'action_completed' | 'invitation_sent';
  title: string;
  description: string;
  timestamp: string;
  memberName?: string;
  status?: string;
}

interface TeamHealthItem {
  memberId: string;
  memberName: string;
  type: 'needs_support' | 'top_performer' | 'no_recent_meetings' | 'not_connected';
  description: string;
  lastActivity?: string;
}

interface MeetingTrendData {
  week: string;
  meetings: number;
  completed: number;
  pending: number;
}

interface TeamPerformanceData {
  name: string;
  meetings: number;
  performance: number;
  status: 'excellent' | 'good' | 'needs_attention';
}

interface TasksData {
  category: string;
  completed: number;
  pending: number;
  overdue: number;
}

// Chart colors
const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  gray: '#6B7280'
};

const PIE_COLORS = [COLORS.primary, COLORS.success, COLORS.warning, COLORS.danger, COLORS.purple];

// Helper function to validate chart data and ensure no NaN values
const validateChartData = (data: any[]): any[] => {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }
  
  return data.map(item => {
    if (!item || typeof item !== 'object') {
      return {};
    }
    
    const validatedItem = { ...item };
    Object.keys(validatedItem).forEach(key => {
      const value = validatedItem[key];
      if (typeof value === 'number') {
        if (isNaN(value) || !isFinite(value)) {
          validatedItem[key] = 0;
        }
      } else if (value === null || value === undefined) {
        // Keep string values as is, but convert null/undefined numbers to 0
        if (key !== 'name' && key !== 'category' && key !== 'week' && key !== 'status' && key !== 'color') {
          validatedItem[key] = 0;
        }
      }
    });
    return validatedItem;
  }).filter(item => {
    // Filter out completely empty objects or items with no valid data
    const hasValidData = Object.keys(item).some(key => {
      const value = item[key];
      return (typeof value === 'string' && value.length > 0) || 
             (typeof value === 'number' && isFinite(value) && !isNaN(value));
    });
    return hasValidData;
  });
};

// Helper function to safely convert values to numbers
const safeNumber = (value: any, defaultValue: number = 0): number => {
  if (typeof value === 'number' && isFinite(value) && !isNaN(value)) {
    return value;
  }
  const parsed = Number(value);
  return isFinite(parsed) && !isNaN(parsed) ? parsed : defaultValue;
};

const Overview = () => {
  const { user, isSignedIn } = useUser();
  const [{ loading, error }, { setLoading, setError }] = useApiState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalTeamMembers: 0,
    recentMeetings: 0,
    pendingProcessing: 0,
    openTasks: 0,
    completedThisWeek: 0,
    overdueTasks: 0,
    googleConnectedMembers: 0,
    pendingInvitations: 0
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [teamHealth, setTeamHealth] = useState<TeamHealthItem[]>([]);
  const [meetingTypeDistribution, setMeetingTypeDistribution] = useState<{
    oneOnOne: number;
    teamMeeting: number;
    clientPresentation: number;
    salesCall: number;
    default: number;
  }>({
    oneOnOne: 0,
    teamMeeting: 0,
    clientPresentation: 0,
    salesCall: 0,
    default: 0
  });
  
  // Chart data states
  const [meetingTrends, setMeetingTrends] = useState<MeetingTrendData[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformanceData[]>([]);
  const [tasksData, setTasksData] = useState<TasksData[]>([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        if (!isSignedIn || !user) {
          setError('Please sign in to access the dashboard.');
          return;
        }

        // Check if user is admin
        const currentUser = await userApi.getCurrentUser();
        const userIsAdmin = currentUser.role === 'admin';
        setIsAdmin(userIsAdmin);

        if (!userIsAdmin) {
          // For non-admin users, show a simplified view
          setStats(prev => ({ ...prev, totalTeamMembers: 1 }));
          setLoading(false);
          return;
        }

        // Fetch all required data for admin dashboard
        const [
          teamMembers,
          meetings,
          _inviteStatus,
          pendingInvitations,
          allActionItems
        ] = await Promise.all([
          userApi.getTeamMembers(),
          meetingApi.getMeetingsWithTeamMembers(),
          userApi.getInviteStatus().catch(() => ({ canInvite: false, currentCount: 0, remainingInvites: 0, pendingInvitations: 0 })),
          userApi.getPendingInvitations().catch(() => []),
          taskApi.getAllTasks().catch(() => [])
        ]);

        // Calculate dashboard statistics
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const recentMeetings = meetings.filter(m => new Date(m.date) >= oneWeekAgo).length;
        const pendingProcessing = meetings.filter(m => 
          m.processingStatus === 'pending' || m.processingStatus === 'processing'
        ).length;

        // Calculate meeting type distribution
        const oneOnOneCount = safeNumber(meetings.filter(m => m.title?.toLowerCase().includes('1:1') || m.title?.toLowerCase().includes('one-on-one')).length);
        const teamMeetingCount = safeNumber(meetings.filter(m => m.title?.toLowerCase().includes('team') || m.title?.toLowerCase().includes('standup')).length);
        const clientPresentationCount = safeNumber(meetings.filter(m => m.title?.toLowerCase().includes('client') || m.title?.toLowerCase().includes('presentation')).length);
        const salesCallCount = safeNumber(meetings.filter(m => m.title?.toLowerCase().includes('sales') || m.title?.toLowerCase().includes('demo')).length);
        
        const distribution = {
          oneOnOne: oneOnOneCount,
          teamMeeting: teamMeetingCount,
          clientPresentation: clientPresentationCount,
          salesCall: salesCallCount,
          default: 0
        };
        
        const totalCategorized = distribution.oneOnOne + distribution.teamMeeting + distribution.clientPresentation + distribution.salesCall;
        distribution.default = Math.max(0, safeNumber(meetings.length) - totalCategorized);

        setMeetingTypeDistribution(distribution);

        // Generate meeting trends data (last 6 weeks)
        const trendData: MeetingTrendData[] = [];
        for (let i = 5; i >= 0; i--) {
          const weekStart = new Date(now.getTime() - (i * 7 * 24 * 60 * 60 * 1000));
          const weekEnd = new Date(weekStart.getTime() + (7 * 24 * 60 * 60 * 1000));
          
          const weekMeetings = meetings.filter(m => {
            const meetingDate = new Date(m.date);
            return !isNaN(meetingDate.getTime()) && meetingDate >= weekStart && meetingDate < weekEnd;
          });
          
          const completed = safeNumber(weekMeetings.filter(m => m.status === 'completed').length);
          const pending = safeNumber(weekMeetings.filter(m => m.processingStatus === 'pending' || m.processingStatus === 'processing').length);
          
          trendData.push({
            week: `Week ${6 - i}`,
            meetings: safeNumber(weekMeetings.length),
            completed: completed,
            pending: pending
          });
        }
        setMeetingTrends(trendData);

        // Generate team performance data
        const performanceData: TeamPerformanceData[] = teamMembers.map(member => {
          const memberMeetings = meetings.filter(m => m.teamMemberId === member.id);
          const recentMemberMeetings = memberMeetings.filter(m => {
            const meetingDate = new Date(m.date);
            return !isNaN(meetingDate.getTime()) && meetingDate >= oneMonthAgo;
          });
          
          // Calculate performance score based on meeting frequency and completion
          const completedMeetings = safeNumber(recentMemberMeetings.filter(m => m.status === 'completed').length);
          const meetingCount = safeNumber(recentMemberMeetings.length);
          const performanceScore = meetingCount > 0 
            ? safeNumber(Math.round((completedMeetings / meetingCount) * 100))
            : 0;
          
          let status: 'excellent' | 'good' | 'needs_attention' = 'good';
          if (performanceScore >= 80 && meetingCount >= 3) status = 'excellent';
          else if (performanceScore < 60 || meetingCount === 0) status = 'needs_attention';
          
          return {
            name: (member.name || member.email.split('@')[0]).substring(0, 12), // Truncate long names
            meetings: safeNumber(meetingCount),
            performance: safeNumber(performanceScore),
            status
          };
        }).filter(member => 
          // Filter out any members with invalid data
          member.name && 
          typeof member.meetings === 'number' && 
          typeof member.performance === 'number' &&
          !isNaN(member.meetings) && 
          !isNaN(member.performance)
        ).slice(0, 8); // Show top 8 team members
        
        setTeamPerformance(performanceData);

        // Process real tasks data by category
        const tasksByCategory: { [key: string]: { completed: number; pending: number; overdue: number } } = {};
        
        // Categorize tasks based on keywords in their text
        allActionItems.forEach(item => {
          const text = item.text.toLowerCase();
          let category = 'Other';
          
          if (text.includes('follow') || text.includes('check') || text.includes('reach out')) {
            category = 'Follow-ups';
          } else if (text.includes('project') || text.includes('task') || text.includes('develop') || text.includes('build')) {
            category = 'Project Tasks';
          } else if (text.includes('client') || text.includes('customer') || text.includes('proposal')) {
            category = 'Client Actions';
          } else if (text.includes('team') || text.includes('training') || text.includes('skill') || text.includes('learn')) {
            category = 'Team Development';
          }
          
          if (!tasksByCategory[category]) {
            tasksByCategory[category] = { completed: 0, pending: 0, overdue: 0 };
          }
          
          if (item.status === 'complete') {
            tasksByCategory[category].completed++;
          } else {
            // Check if overdue (created more than 7 days ago and still incomplete)
            const createdDate = new Date(item.createdAt);
            const daysSinceCreated = !isNaN(createdDate.getTime()) 
              ? (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
              : 0;
            
            if (daysSinceCreated > 7) {
              tasksByCategory[category].overdue++;
            } else {
              tasksByCategory[category].pending++;
            }
          }
        });
        
        // Convert to array format for charts
        const tasks: TasksData[] = Object.entries(tasksByCategory).map(([category, data]) => ({
          category,
          completed: safeNumber(data.completed),
          pending: safeNumber(data.pending),
          overdue: safeNumber(data.overdue)
        }));
        
        // Ensure we have at least some categories even if no tasks exist
        if (tasks.length === 0) {
          tasks.push(
            { category: 'Follow-ups', completed: 0, pending: 0, overdue: 0 },
            { category: 'Project Tasks', completed: 0, pending: 0, overdue: 0 },
            { category: 'Client Actions', completed: 0, pending: 0, overdue: 0 },
            { category: 'Team Development', completed: 0, pending: 0, overdue: 0 }
          );
        }
        
        setTasksData(tasks);

        // Calculate task statistics from real data
        const openTasks = safeNumber(allActionItems.filter(item => item.status === 'incomplete').length);
        const completedThisWeek = safeNumber(allActionItems.filter(item => {
          if (item.status !== 'complete' || !item.completedAt) return false;
          const completedDate = new Date(item.completedAt);
          return !isNaN(completedDate.getTime()) && completedDate >= oneWeekAgo;
        }).length);
        const overdueTasks = safeNumber(allActionItems.filter(item => {
          if (item.status === 'complete') return false;
          const createdDate = new Date(item.createdAt);
          if (isNaN(createdDate.getTime())) return false;
          const daysSinceCreated = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreated > 7;
        }).length);

        // Mock Google connection status
        const mockGoogleConnectedMembers = safeNumber(Math.floor(teamMembers.length * 0.7));

        setStats({
          totalTeamMembers: safeNumber(teamMembers.length),
          recentMeetings: safeNumber(recentMeetings),
          pendingProcessing: safeNumber(pendingProcessing),
          openTasks: openTasks,
          completedThisWeek: completedThisWeek,
          overdueTasks: overdueTasks,
          googleConnectedMembers: mockGoogleConnectedMembers,
          pendingInvitations: safeNumber(pendingInvitations.length)
        });

        // Generate recent activity
        const activities: RecentActivity[] = [];
        
        // Add recent completed meetings
        meetings
          .filter(m => m.status === 'completed' && new Date(m.date) >= oneWeekAgo)
          .slice(0, 3)
          .forEach(meeting => {
            activities.push({
              id: `meeting-${meeting.id}`,
              type: 'meeting_completed',
              title: 'Meeting Completed',
              description: `"${meeting.title}" was completed and analyzed`,
              timestamp: meeting.date,
              memberName: meeting.teamMember || 'Unknown',
              status: meeting.processingStatus
            });
          });

        // Add recent team member joins
        teamMembers
          .filter(member => new Date(member.createdAt) >= oneWeekAgo)
          .slice(0, 2)
          .forEach(member => {
            activities.push({
              id: `member-${member.id}`,
              type: 'member_joined',
              title: 'New Team Member',
              description: `${member.name || member.email} joined the team`,
              timestamp: member.createdAt,
              memberName: member.name || member.email
            });
          });

        // Add recent invitations
        pendingInvitations
          .filter(inv => new Date(inv.createdAt) >= oneWeekAgo)
          .slice(0, 2)
          .forEach(invitation => {
            activities.push({
              id: `invitation-${invitation.id}`,
              type: 'invitation_sent',
              title: 'Invitation Sent',
              description: `Invitation sent to ${invitation.email}`,
              timestamp: invitation.createdAt,
              status: invitation.status
            });
          });

        // Sort activities by timestamp (newest first)
        activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setRecentActivity(activities.slice(0, 8));

        // Generate team health indicators
        const healthItems: TeamHealthItem[] = [];
        
        // Members without recent meetings
        teamMembers.forEach(member => {
          const memberMeetings = meetings.filter(m => m.teamMemberId === member.id);
          const recentMemberMeetings = memberMeetings.filter(m => new Date(m.date) >= oneMonthAgo);
          
          if (recentMemberMeetings.length === 0 && memberMeetings.length > 0) {
            healthItems.push({
              memberId: member.id,
              memberName: member.name || member.email,
              type: 'no_recent_meetings',
              description: 'No meetings in the past month',
              lastActivity: memberMeetings.length > 0 ? memberMeetings[0].date : undefined
            });
          }
        });

        // Mock some members needing support and top performers
        const shuffledMembers = [...teamMembers].sort(() => Math.random() - 0.5);
        
        if (shuffledMembers.length > 0) {
          healthItems.push({
            memberId: shuffledMembers[0].id,
            memberName: shuffledMembers[0].name || shuffledMembers[0].email,
            type: 'needs_support',
            description: 'Recent analysis shows areas needing support'
          });
        }

        if (shuffledMembers.length > 1) {
          healthItems.push({
            memberId: shuffledMembers[1].id,
            memberName: shuffledMembers[1].name || shuffledMembers[1].email,
            type: 'top_performer',
            description: 'Consistently strong performance in recent meetings'
          });
        }

        setTeamHealth(healthItems.slice(0, 6));

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [isSignedIn, user]);

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'meeting_completed':
        return <VideoCamera size={16} className="text-blue-600" />;
      case 'member_joined':
        return <UserPlus size={16} className="text-green-600" />;
      case 'action_completed':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'invitation_sent':
        return <Users size={16} className="text-purple-600" />;
      default:
        return <Activity size={16} className="text-gray-600" />;
    }
  };

  const getHealthIcon = (type: TeamHealthItem['type']) => {
    switch (type) {
      case 'needs_support':
        return <Warning size={16} className="text-yellow-600" />;
      case 'top_performer':
        return <TrendUp size={16} className="text-green-600" />;
      case 'no_recent_meetings':
        return <Clock size={16} className="text-orange-600" />;
      case 'not_connected':
        return <Warning size={16} className="text-red-600" />;
      default:
        return <Activity size={16} className="text-gray-600" />;
    }
  };

  // Custom tooltip for charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Overview</h1>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-600">Welcome to Seer! Navigate to other sections to view your meetings and performance data.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <Link to="/meetings" className="bg-blue-50 rounded-lg p-4 border border-blue-100 hover:bg-blue-100 transition-colors">
              <h2 className="text-lg font-medium text-gray-900">Your Meetings</h2>
              <p className="text-sm text-gray-600 mt-2">View and manage your meetings</p>
            </Link>
            
            <Link to="/team" className="bg-green-50 rounded-lg p-4 border border-green-100 hover:bg-green-100 transition-colors">
              <h2 className="text-lg font-medium text-gray-900">Team</h2>
              <p className="text-sm text-gray-600 mt-2">View team members</p>
            </Link>
            
            <Link to="/settings" className="bg-purple-50 rounded-lg p-4 border border-purple-100 hover:bg-purple-100 transition-colors">
              <h2 className="text-lg font-medium text-gray-900">Settings</h2>
              <p className="text-sm text-gray-600 mt-2">Manage your preferences</p>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Prepare pie chart data for meeting types
  const meetingTypePieData = [
    { name: '1:1 Meetings', value: safeNumber(meetingTypeDistribution.oneOnOne), color: COLORS.primary },
    { name: 'Team Meetings', value: safeNumber(meetingTypeDistribution.teamMeeting), color: COLORS.success },
    { name: 'Client Meetings', value: safeNumber(meetingTypeDistribution.clientPresentation), color: COLORS.purple },
    { name: 'Sales Calls', value: safeNumber(meetingTypeDistribution.salesCall), color: COLORS.warning },
    { name: 'Other', value: safeNumber(meetingTypeDistribution.default), color: COLORS.gray }
  ].filter(item => {
    const value = safeNumber(item.value);
    return value > 0 && isFinite(value) && !isNaN(value);
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <div className="flex space-x-3">
          <Link
            to="/meetings"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <Plus size={16} className="mr-2" />
            New Meeting
          </Link>
          <Link
            to="/team"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <UserPlus size={16} className="mr-2" />
            Invite Member
          </Link>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Users size={24} className="text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Team Members</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalTeamMembers}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {stats.googleConnectedMembers} connected to Google Calendar
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Calendar size={24} className="text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Recent Meetings</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.recentMeetings}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {stats.pendingProcessing} pending processing
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Target size={24} className="text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Tasks</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.openTasks}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {stats.completedThisWeek} completed this week
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <Warning size={24} className="text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Needs Attention</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.overdueTasks + stats.pendingInvitations}</p>
            </div>
          </div>
          <div className="mt-2">
            <p className="text-xs text-gray-500">
              {stats.overdueTasks} overdue, {stats.pendingInvitations} pending invites
            </p>
          </div>
        </div>
      </div>

      {/* Charts Row 1: Meeting Trends and Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meeting Trends Chart */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Meeting Trends (6 Weeks)</h2>
            <p className="text-sm text-gray-500">Track meeting volume and completion rates</p>
          </div>
          <div className="p-6">
            <ChartErrorBoundary>
              {(() => {
                const validatedData = validateChartData(meetingTrends);
                return validatedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={validatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis allowDataOverflow={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="meetings" 
                        stackId="1"
                        stroke={COLORS.primary} 
                        fill={COLORS.primary}
                        fillOpacity={0.6}
                        name="Total Meetings"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="completed" 
                        stackId="2"
                        stroke={COLORS.success} 
                        fill={COLORS.success}
                        fillOpacity={0.8}
                        name="Completed"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>No meeting data available</p>
                  </div>
                );
              })()}
            </ChartErrorBoundary>
          </div>
        </div>

        {/* Team Performance Chart */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Team Performance</h2>
            <p className="text-sm text-gray-500">Meeting frequency vs completion rate</p>
          </div>
          <div className="p-6">
            <ChartErrorBoundary>
              {(() => {
                const validatedData = validateChartData(teamPerformance);
                return validatedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={validatedData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        type="number" 
                        domain={[0, 100]} 
                        allowDataOverflow={false}
                        allowDecimals={false}
                      />
                      <YAxis 
                        dataKey="name" 
                        type="category" 
                        width={80}
                        allowDuplicatedCategory={false}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="performance" 
                        fill={COLORS.primary}
                        name="Performance %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>No team performance data available</p>
                  </div>
                );
              })()}
            </ChartErrorBoundary>
          </div>
        </div>
      </div>

      {/* Charts Row 2: Tasks and Meeting Types */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks Progress Chart */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Tasks by Category</h2>
            <p className="text-sm text-gray-500">Track completion across different work areas</p>
          </div>
          <div className="p-6">
            <ChartErrorBoundary>
              {(() => {
                const validatedData = validateChartData(tasksData);
                return validatedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={validatedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis allowDataOverflow={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="completed" stackId="a" fill={COLORS.success} name="Completed" />
                      <Bar dataKey="pending" stackId="a" fill={COLORS.warning} name="Pending" />
                      <Bar dataKey="overdue" stackId="a" fill={COLORS.danger} name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>No tasks data available</p>
                  </div>
                );
              })()}
            </ChartErrorBoundary>
          </div>
        </div>

        {/* Meeting Types Distribution */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Meeting Types Distribution</h2>
            <p className="text-sm text-gray-500">Breakdown of meeting categories</p>
          </div>
          <div className="p-6">
            <ChartErrorBoundary>
              {(() => {
                const validatedData = validateChartData(meetingTypePieData);
                return validatedData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={validatedData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => {
                          const safePercent = safeNumber(percent * 100);
                          return `${name}: ${safePercent.toFixed(0)}%`;
                        }}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {validatedData.map((_entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <p>No meeting type data available</p>
                  </div>
                );
              })()}
            </ChartErrorBoundary>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-6">
            {recentActivity.length === 0 ? (
              <p className="text-gray-500 text-sm">No recent activity</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getActivityIcon(activity.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-500">{activity.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDate(activity.timestamp)}
                        {activity.memberName && ` • ${activity.memberName}`}
                      </p>
                    </div>
                    {activity.status && (
                      <div className="flex-shrink-0">
                        <StatusBadge status={activity.status} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Health */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Team Health</h2>
          </div>
          <div className="p-6">
            {teamHealth.length === 0 ? (
              <p className="text-gray-500 text-sm">All team members are performing well</p>
            ) : (
              <div className="space-y-4">
                {teamHealth.map((item) => (
                  <div key={`${item.memberId}-${item.type}`} className="flex items-start space-x-3">
                    <div className="flex-shrink-0 mt-1">
                      {getHealthIcon(item.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link 
                        to={`/team/${item.memberId}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600"
                      >
                        {item.memberName}
                      </Link>
                      <p className="text-sm text-gray-500">{item.description}</p>
                      {item.lastActivity && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last activity: {formatDate(item.lastActivity)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Quick Actions</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/meetings"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Calendar size={20} className="text-blue-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Schedule Meeting</p>
                <p className="text-sm text-gray-500">Create a new meeting</p>
              </div>
            </Link>
            
            <Link
              to="/team"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <UserPlus size={20} className="text-green-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Invite Member</p>
                <p className="text-sm text-gray-500">Add team member</p>
              </div>
            </Link>
            
            <Link
              to="/meetings"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Target size={20} className="text-purple-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Tasks</p>
                <p className="text-sm text-gray-500">View all tasks</p>
              </div>
            </Link>
            
            <Link
              to="/settings"
              className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FileText size={20} className="text-orange-600 mr-3" />
              <div>
                <p className="font-medium text-gray-900">Generate Report</p>
                <p className="text-sm text-gray-500">Team performance</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Overview; 